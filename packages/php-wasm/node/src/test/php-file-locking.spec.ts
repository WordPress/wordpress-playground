import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { PHP } from '@php-wasm/universal';
import type { SupportedPHPVersions } from '@php-wasm/universal';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { createNodeFsMountHandler, FileLockManagerForNode, loadNodeRuntime } from '../lib';
import type { Promised } from '@php-wasm/util';
import { jspi } from 'wasm-feature-detect';

// TODO: Is this really necessary? Probably, if we want to avoid
// discovering the insufficiency of just iterating over own keys at the top-level.
// An alternative would be to wrap the object in a Proxy. Consider it and probably
// move this to a utility library.
function toPromised<T extends object>(obj: T) : Promised<T> {
	const keysAlreadySeen = new Set<string | symbol>();
	const keysToMakePromised = new Set<string | symbol>();
	const looksLikeBuiltInObject =
		// NOTE: We don't generally add custom things to the global scope,
		// so let's use this as a heuristic to determine if an object is a built-in object type.
		(obj: object) => (globalThis as any)[obj.constructor.name] !== obj.constructor;

	let proto: object = obj;
	while (
		proto !== null &&
		!looksLikeBuiltInObject(proto)
	) {
		const allKeys = [
			...Object.getOwnPropertyNames(proto),
			...Object.getOwnPropertySymbols(proto),
		];
		for (const key of allKeys) {
			if (
				// Track keys already seen so an inherited method property
				// masked by a descendant property of the same name is not considered.
				!keysAlreadySeen.has(key) &&
				!keysToMakePromised.has(key) &&
				typeof (proto as any)[key] === 'function'
			) {
				keysToMakePromised.add(key);
			}
			keysAlreadySeen.add(key);
		}
		proto = Object.getPrototypeOf(proto);
	}

	const promisifiedObj = Object.create(obj);
	for (const key of keysToMakePromised) {
		promisifiedObj[key] = function(...args: any[]) {
			return Promise.resolve((obj as any)[key](...args));
		};
	}
	return promisifiedObj;
}

describe('File locking', () => {
	const vfsMountPoint = '/test';

	let tempDir: string;
	// TODO: Use one file lock manager per test
	let fileLockManager: FileLockManagerForNode | Promised<FileLockManagerForNode>;
	let nextProcessId: number;

	beforeEach(async () => {
		tempDir = mkdtempSync(join(tmpdir(), 'php-wasm-file-locking-'));
		fileLockManager = (await jspi())
			? toPromised(new FileLockManagerForNode())
			: new FileLockManagerForNode();
		nextProcessId = 1;
	});
	afterEach(async () => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	async function createPhpRuntimeWithFileLockingAndTestMount(
		phpVersion: typeof SupportedPHPVersions[number]
	): Promise<PHP> {
		const runtimeId = await loadNodeRuntime(phpVersion, {
			emscriptenOptions: {
				processId: nextProcessId++,
				fileLockManager: fileLockManager!
			},
		});
		const php = new PHP(runtimeId);
		const errorLogPath = `${vfsMountPoint}/error.log`;
		// Set php.ini to disable display_errors and log errors to a file.
		php.writeFile(
			'/internal/shared/php.ini',
			`memory_limit = 128M
max_execution_time = 30 ; seconds
error_reporting = E_ALL & ~E_DEPRECATED & ~E_STRICT
display_errors = Off
log_errors = On
error_log = ${errorLogPath}
`
		);
		php.mount(vfsMountPoint, createNodeFsMountHandler(tempDir));
		return php;
	};

	describe('SQLite DB locking (relying upon fcntl())', () => {
		const dbFileName = 'test.db';
		const vfsDbFilePath = `${vfsMountPoint}/${dbFileName}`;

		beforeEach(async () => {
			using php = await createPhpRuntimeWithFileLockingAndTestMount(RecommendedPHPVersion);
			const result = await php.runStream({
				code: `<?php
					$db = new SQLite3('${vfsDbFilePath}');
					try {
						$result = $db->exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
						if ($result === false) {
							echo json_encode($db->lastErrorMsg());
							exit(1);
						}
					} finally {
						$db->close();
					}
				`,
			});
			const dbFilePath = join(tempDir, dbFileName);
			if (!existsSync(dbFilePath)) {
				throw new Error(`Database file not created: ${dbFilePath}`);
			}
			if (await result.exitCode !== 0) {
				throw new Error(
					`Failed to create table: ${await result.stderrText || 'Unknown error'}`
				);
			}
		});

		it('cannot write to DB while another process has an exclusive lock', async () => {
			using php1 = await createPhpRuntimeWithFileLockingAndTestMount(RecommendedPHPVersion);
			using php2 = await createPhpRuntimeWithFileLockingAndTestMount(RecommendedPHPVersion);

			const phpCoordinationFile = join(tempDir, 'php-instance-coordination');
			const vfsPhpCoordinationFile = `${vfsMountPoint}/php-instance-coordination`;
			const stages = {
				php1Locking: 'php1-locking',
				php1WaitingForPhp2ToTry: 'php1-waiting-for-php2-to-try',
				php2ReadyForUnlock: 'php2-ready-for-unlock',
				php1Unlocked: 'php1-unlocked',
			} as const;

			writeFileSync(phpCoordinationFile, stages.php1Locking);
			const promisedPhp1Result = php1.run({
				code: `<?php
					$db = new SQLite3('${vfsDbFilePath}');
					$db->exec('BEGIN EXCLUSIVE;');
					$db->exec('INSERT INTO test (name) VALUES ("test1")');

					// Wait until php2 notifies us by deleting the sleep file
					file_put_contents('${vfsPhpCoordinationFile}', '${stages.php1WaitingForPhp2ToTry}');
					while (
						file_get_contents('${vfsPhpCoordinationFile}') !== '${stages.php2ReadyForUnlock}'
					) {
						usleep(100 * 1000);
					}

					$db->exec('COMMIT;');
					$db->close();
					file_put_contents('${vfsPhpCoordinationFile}', '${stages.php1Unlocked}');
				`,
			});
			const promisedPhp2Result = php2.run({
				code: `<?php
					while (
						file_get_contents('${vfsPhpCoordinationFile}') !== '${stages.php1WaitingForPhp2ToTry}'
					) {
						usleep(100 * 1000);
					}

					$db = new SQLite3('${vfsDbFilePath}');
					$result = $db->exec('INSERT INTO test (name) VALUES ("test-while-locked")');
					$attempt_while_exclusively_locked = [
						'lastErrorCode' => $db->lastErrorCode(),
						'lastErrorMsg' => $db->lastErrorMsg(),
					];

					file_put_contents('${vfsPhpCoordinationFile}', '${stages.php2ReadyForUnlock}');
					while (
						file_get_contents('${vfsPhpCoordinationFile}') !== '${stages.php1Unlocked}'
					) {
						usleep(100 * 1000);
					}

					$result = $db->exec('INSERT INTO test (name) VALUES ("test-while-unlocked")');
					$attempt_while_unlocked = [
						'lastErrorCode' => $db->lastErrorCode(),
						'lastErrorMsg' => $db->lastErrorMsg(),
					];

					echo json_encode([
						'attempt_while_exclusively_locked' => $attempt_while_exclusively_locked,
						'attempt_while_unlocked' => $attempt_while_unlocked,
					]);
					$db->close();
				`,
			});

			const [php1Result, php2Result] = await Promise.all([
				promisedPhp1Result,
				promisedPhp2Result
			]);
			expect(php1Result.exitCode).toBe(0);
			expect(php2Result.exitCode).toBe(0);
			const result2Data = JSON.parse(php2Result.text || '{}');
			expect(result2Data.attempt_while_exclusively_locked).toMatchObject({
				'lastErrorCode': 5, // SQLITE_BUSY
				'lastErrorMsg': 'database is locked',
			});
			expect(result2Data.attempt_while_unlocked).toMatchObject({
				'lastErrorCode': 0,
				'lastErrorMsg': 'not an error',
			});
		});
		it.todo('cannot read from DB while another process has an exclusive lock');
		it.todo('cannot write to DB while another process has a shared lock');
		it.todo('can read from DB while another process has a shared lock');
		it.todo('cannot write to DB while another process has a shared lock');
		it.todo('should release a shared lock when its associated process is terminated');
		it.todo('should release an exclusive lock when its associated process is terminated');
		it.todo(
			'should release a lock when its associated file descriptor is closed'
		);
	}, 5000);

	describe('PHP flock()', () => {
		it.todo('should be able to acquire an exclusive lock on a file');
		it.todo('should be able to acquire a shared lock on a file');
		it.todo('should deny an exclusive lock when another process has a shared lock on a file');
		it.todo('should deny a shared lock when another process has an exclusive lock on a file');
		it.todo('should grant multiple shared locks on a file');
		it.todo('should release a shared lock when its associated file descriptor is closed');
		it.todo('should release an exclusive lock when its associated file descriptor is closed');
		it.todo('should release a shared lock when its associated process is terminated');
		it.todo('should release an exclusive lock when its associated process is terminated');
	});
});
