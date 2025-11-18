import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { PHP } from '@php-wasm/universal';
import { SupportedPHPVersions } from '@php-wasm/universal';
import {
	createNodeFsMountHandler,
	FileLockManagerForNode,
	loadNodeRuntime,
} from '../lib';
import type { Promised } from '@php-wasm/util';
import { jspi } from 'wasm-feature-detect';

// TODO: Is this really necessary? Probably, if we want to avoid
// discovering the insufficiency of just iterating over own keys at the top-level.
// An alternative would be to wrap the object in a Proxy. Consider it and probably
// move this to a utility library.
function toPromised<T extends object>(obj: T): Promised<T> {
	const keysAlreadySeen = new Set<string | symbol>();
	const keysToMakePromised = new Set<string | symbol>();
	const looksLikeBuiltInObject =
		// NOTE: We don't generally add custom things to the global scope,
		// so let's use this as a heuristic to determine if an object is a built-in object type.
		(obj: object) =>
			(globalThis as any)[obj.constructor.name] !== obj.constructor;

	let proto: object = obj;
	while (proto !== null && !looksLikeBuiltInObject(proto)) {
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
		promisifiedObj[key] = function (...args: any[]) {
			return Promise.resolve((obj as any)[key](...args));
		};
	}
	return promisifiedObj;
}

describe.each(SupportedPHPVersions)('PHP %s: File locking', (phpVersion) => {
	const vfsMountPoint = '/test';

	let tempDir: string;
	// TODO: Use one file lock manager per test
	let fileLockManager:
		| FileLockManagerForNode
		| Promised<FileLockManagerForNode>;
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

	async function createPhpRuntimeWithFileLockingAndTestMount(): Promise<PHP> {
		const runtimeId = await loadNodeRuntime(phpVersion, {
			emscriptenOptions: {
				processId: nextProcessId++,
				fileLockManager: fileLockManager!,
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
	}

	describe('SQLite DB locking (relying upon fcntl())', () => {
		const dbFileName = 'test.db';
		const vfsDbFilePath = `${vfsMountPoint}/${dbFileName}`;

		beforeEach(async () => {
			using php = await createPhpRuntimeWithFileLockingAndTestMount();
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
			// TODO: Why does this DB file check fail for PHP 8.0 and under? The tests pass. The DB must exist.
			//       Sleeping for 500ms avoids the issue.
			// const dbFilePath = join(tempDir, dbFileName);
			// if (!existsSync(dbFilePath)) {
			// 	throw new Error(`Database file not created: ${dbFilePath}`);
			// }
			if ((await result.exitCode) !== 0) {
				throw new Error(
					`Failed to create table: ${(await result.stderrText) || 'Unknown error'}`
				);
			}
		});

		it('cannot write to DB while another process has an exclusive lock', async () => {
			using php1 = await createPhpRuntimeWithFileLockingAndTestMount();
			using php2 = await createPhpRuntimeWithFileLockingAndTestMount();

			const phpCoordinationFile = join(
				tempDir,
				'php-instance-coordination'
			);
			const vfsPhpCoordinationFile = `${vfsMountPoint}/php-instance-coordination`;
			const stages = {
				php1Locking: 'php1-locking',
				php1Locked: 'php1-locked',
				php2ReadyForUnlock: 'php2-ready-for-unlock',
				php1Unlocked: 'php1-unlocked',
			} as const;

			writeFileSync(phpCoordinationFile, stages.php1Locking);
			const promisedPhp1Result = php1.run({
				code: `<?php
					$db = new SQLite3('${vfsDbFilePath}');
					$db->exec('BEGIN EXCLUSIVE;');

					// Wait until php2 notifies us by deleting the sleep file
					file_put_contents('${vfsPhpCoordinationFile}', '${stages.php1Locked}');
					while (
						file_get_contents('${vfsPhpCoordinationFile}') !== '${stages.php2ReadyForUnlock}'
					) {
						usleep(100 * 1000);
					}

					$db->exec('INSERT INTO test (name) VALUES ("test1")');
					$db->exec('COMMIT;');
					$db->close();
					file_put_contents('${vfsPhpCoordinationFile}', '${stages.php1Unlocked}');
				`,
			});
			const promisedPhp2Result = php2.run({
				code: `<?php
					while (
						file_get_contents('${vfsPhpCoordinationFile}') !== '${stages.php1Locked}'
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
				promisedPhp2Result,
			]);
			expect(php1Result.exitCode).toBe(0);
			expect(php2Result.exitCode).toBe(0);
			const result2Data = JSON.parse(php2Result.text || '{}');
			expect(result2Data.attempt_while_exclusively_locked).toMatchObject({
				lastErrorCode: 5, // SQLITE_BUSY
				lastErrorMsg: 'database is locked',
			});
			expect(result2Data.attempt_while_unlocked).toMatchObject({
				lastErrorCode: 0,
				lastErrorMsg: 'not an error',
			});
		});
		it('cannot read from DB while another process has an exclusive lock', async () => {
			using php1 = await createPhpRuntimeWithFileLockingAndTestMount();
			using php2 = await createPhpRuntimeWithFileLockingAndTestMount();

			const phpCoordinationFile = join(
				tempDir,
				'php-instance-coordination'
			);
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

					// Wait until php2 notifies us by updating the coordination file
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
					$result = $db->querySingle('SELECT COUNT(*) FROM test');
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

					$result = $db->querySingle('SELECT COUNT(*) FROM test');
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
				promisedPhp2Result,
			]);
			expect(php1Result.exitCode).toBe(0);
			expect(php2Result.exitCode).toBe(0);
			const result2Data = JSON.parse(php2Result.text || '{}');
			expect(result2Data.attempt_while_exclusively_locked).toMatchObject({
				lastErrorCode: 5, // SQLITE_BUSY
				lastErrorMsg: 'database is locked',
			});
			expect(result2Data.attempt_while_unlocked).toMatchObject({
				lastErrorCode: 0,
				lastErrorMsg: 'not an error',
			});
		});
		it('cannot write to DB while another process has a shared lock', async () => {
			using php1 = await createPhpRuntimeWithFileLockingAndTestMount();
			using php2 = await createPhpRuntimeWithFileLockingAndTestMount();

			const phpCoordinationFile = join(
				tempDir,
				'php-instance-coordination'
			);
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
					$db->exec('BEGIN;'); // Shared lock (read transaction)
					$db->querySingle('SELECT COUNT(*) FROM test');

					// Wait until php2 notifies us by updating the coordination file
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
					$result = $db->exec('INSERT INTO test (name) VALUES ("test-while-shared-locked")');
					$attempt_while_shared_locked = [
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
						'attempt_while_shared_locked' => $attempt_while_shared_locked,
						'attempt_while_unlocked' => $attempt_while_unlocked,
					]);
					$db->close();
				`,
			});

			const [php1Result, php2Result] = await Promise.all([
				promisedPhp1Result,
				promisedPhp2Result,
			]);
			expect(php1Result.exitCode).toBe(0);
			expect(php2Result.exitCode).toBe(0);
			const result2Data = JSON.parse(php2Result.text || '{}');
			expect(result2Data.attempt_while_shared_locked).toMatchObject({
				lastErrorCode: 5, // SQLITE_BUSY
				lastErrorMsg: 'database is locked',
			});
			expect(result2Data.attempt_while_unlocked).toMatchObject({
				lastErrorCode: 0,
				lastErrorMsg: 'not an error',
			});
		});
		it('can read from DB while another process has a shared lock', async () => {
			using php1 = await createPhpRuntimeWithFileLockingAndTestMount();
			using php2 = await createPhpRuntimeWithFileLockingAndTestMount();

			const phpCoordinationFile = join(
				tempDir,
				'php-instance-coordination'
			);
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
					$db->exec('BEGIN;'); // Shared lock (read transaction)
					$db->querySingle('SELECT COUNT(*) FROM test');

					// Wait until php2 notifies us by updating the coordination file
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
					$result = $db->querySingle('SELECT COUNT(*) FROM test');
					$attempt_while_shared_locked = [
						'lastErrorCode' => $db->lastErrorCode(),
						'lastErrorMsg' => $db->lastErrorMsg(),
						'result' => $result,
					];

					file_put_contents('${vfsPhpCoordinationFile}', '${stages.php2ReadyForUnlock}');
					while (
						file_get_contents('${vfsPhpCoordinationFile}') !== '${stages.php1Unlocked}'
					) {
						usleep(100 * 1000);
					}

					$result = $db->querySingle('SELECT COUNT(*) FROM test');
					$attempt_while_unlocked = [
						'lastErrorCode' => $db->lastErrorCode(),
						'lastErrorMsg' => $db->lastErrorMsg(),
						'result' => $result,
					];

					echo json_encode([
						'attempt_while_shared_locked' => $attempt_while_shared_locked,
						'attempt_while_unlocked' => $attempt_while_unlocked,
					]);
					$db->close();
				`,
			});

			const [php1Result, php2Result] = await Promise.all([
				promisedPhp1Result,
				promisedPhp2Result,
			]);
			expect(php1Result.exitCode).toBe(0);
			expect(php2Result.exitCode).toBe(0);
			const result2Data = JSON.parse(php2Result.text || '{}');
			// Both reads should succeed with shared locks
			expect(result2Data.attempt_while_shared_locked).toMatchObject({
				lastErrorCode: 0,
				lastErrorMsg: 'not an error',
			});
			expect(result2Data.attempt_while_unlocked).toMatchObject({
				lastErrorCode: 0,
				lastErrorMsg: 'not an error',
			});
		});
		it('should release a shared lock when its associated process exits', async () => {
			using php1 = await createPhpRuntimeWithFileLockingAndTestMount();
			using php2 = await createPhpRuntimeWithFileLockingAndTestMount();

			const phpCoordinationFile = join(
				tempDir,
				'php-instance-coordination'
			);
			const vfsPhpCoordinationFile = `${vfsMountPoint}/php-instance-coordination`;
			const stages = {
				php1Locking: 'php1-locking',
				php1Locked: 'php1-locked',
				php2ConfirmedDbLocked: 'php2-confirmed-db-locked',
				php1EndOfScript: 'php1-end-of-script',
			} as const;

			writeFileSync(phpCoordinationFile, stages.php1Locking);
			const promisedPhp1Result = php1.run({
				code: `<?php
					$db = new SQLite3('${vfsDbFilePath}');
					$db->exec('BEGIN;'); // Shared lock (read transaction)
					$db->querySingle('SELECT COUNT(*) FROM test');

					file_put_contents('${vfsPhpCoordinationFile}', '${stages.php1Locked}');

					while (
						file_get_contents('${vfsPhpCoordinationFile}') !== '${stages.php2ConfirmedDbLocked}'
					) {
						usleep(100 * 1000);
					}

					// NOTE: We intentionally skip closing the database connection.
				`,
			});

			const promisedPhp2Result = php2.run({
				code: `<?php
					while (
						file_get_contents('${vfsPhpCoordinationFile}') !== '${stages.php1Locked}'
					) {
						usleep(100 * 1000);
					}

					$db = new SQLite3('${vfsDbFilePath}');
					$result = $db->exec('INSERT INTO test (name) VALUES ("test-after-termination")');
					$attempt_while_locked = [
						'lastErrorCode' => $db->lastErrorCode(),
						'lastErrorMsg' => $db->lastErrorMsg(),
					];

					file_put_contents('${vfsPhpCoordinationFile}', '${stages.php2ConfirmedDbLocked}');
					while (
						file_get_contents('${vfsPhpCoordinationFile}') !== '${stages.php1EndOfScript}'
					) {
						usleep(100 * 1000);
					}

					$result = $db->exec('INSERT INTO test (name) VALUES ("test-after-termination")');
					$attempt_after_termination = [
						'lastErrorCode' => $db->lastErrorCode(),
						'lastErrorMsg' => $db->lastErrorMsg(),
					];

					$db->close();

					echo json_encode([
						'attempt_after_termination' => $attempt_after_termination,
						'attempt_while_locked' => $attempt_while_locked,
					]);
				`,
			});

			// Wait for php1 to exit before notifying php2.
			await promisedPhp1Result;
			writeFileSync(phpCoordinationFile, stages.php1EndOfScript);

			const php2Result = await promisedPhp2Result;
			expect(php2Result.exitCode).toBe(0);
			const result2Data = JSON.parse(php2Result.text || '{}');
			expect(result2Data.attempt_while_locked).toMatchObject({
				lastErrorCode: 5, // SQLITE_BUSY
				lastErrorMsg: 'database is locked',
			});
			expect(result2Data.attempt_after_termination).toMatchObject({
				lastErrorCode: 0,
				lastErrorMsg: 'not an error',
			});
		});
		it('should release an exclusive lock when its associated process exits', async () => {
			using php1 = await createPhpRuntimeWithFileLockingAndTestMount();
			using php2 = await createPhpRuntimeWithFileLockingAndTestMount();

			const phpCoordinationFile = join(
				tempDir,
				'php-instance-coordination'
			);
			const vfsPhpCoordinationFile = `${vfsMountPoint}/php-instance-coordination`;
			const stages = {
				php1Locking: 'php1-locking',
				php1Locked: 'php1-locked',
				php2ConfirmedDbLocked: 'php2-confirmed-db-locked',
				php1EndOfScript: 'php1-end-of-script',
			} as const;

			writeFileSync(phpCoordinationFile, stages.php1Locking);
			const promisedPhp1Result = php1.run({
				code: `<?php
					$db = new SQLite3('${vfsDbFilePath}');
					$db->exec('BEGIN EXCLUSIVE;'); // Exclusive lock (write transaction)
					$db->querySingle('SELECT COUNT(*) FROM test');

					file_put_contents('${vfsPhpCoordinationFile}', '${stages.php1Locked}');

					while (
						file_get_contents('${vfsPhpCoordinationFile}') !== '${stages.php2ConfirmedDbLocked}'
					) {
						usleep(100 * 1000);
					}

					// NOTE: We intentionally skip closing the database connection.
				`,
			});

			const promisedPhp2Result = php2.run({
				code: `<?php
					while (
						file_get_contents('${vfsPhpCoordinationFile}') !== '${stages.php1Locked}'
					) {
						usleep(100 * 1000);
					}

					$db = new SQLite3('${vfsDbFilePath}');
					$result = $db->exec('INSERT INTO test (name) VALUES ("test-after-termination")');
					$attempt_while_locked = [
						'lastErrorCode' => $db->lastErrorCode(),
						'lastErrorMsg' => $db->lastErrorMsg(),
					];

					file_put_contents('${vfsPhpCoordinationFile}', '${stages.php2ConfirmedDbLocked}');
					while (
						file_get_contents('${vfsPhpCoordinationFile}') !== '${stages.php1EndOfScript}'
					) {
						usleep(100 * 1000);
					}

					$result = $db->exec('INSERT INTO test (name) VALUES ("test-after-termination")');
					$attempt_after_termination = [
						'lastErrorCode' => $db->lastErrorCode(),
						'lastErrorMsg' => $db->lastErrorMsg(),
					];

					$db->close();

					echo json_encode([
						'attempt_after_termination' => $attempt_after_termination,
						'attempt_while_locked' => $attempt_while_locked,
					]);
				`,
			});

			// Wait for php1 to exit before notifying php2.
			await promisedPhp1Result;
			writeFileSync(phpCoordinationFile, stages.php1EndOfScript);

			const php2Result = await promisedPhp2Result;
			expect(php2Result.exitCode).toBe(0);
			const result2Data = JSON.parse(php2Result.text || '{}');
			expect(result2Data.attempt_while_locked).toMatchObject({
				lastErrorCode: 5, // SQLITE_BUSY
				lastErrorMsg: 'database is locked',
			});
			expect(result2Data.attempt_after_termination).toMatchObject({
				lastErrorCode: 0,
				lastErrorMsg: 'not an error',
			});
		});
		it('should release a lock when its database connection is closed', async () => {
			using php1 = await createPhpRuntimeWithFileLockingAndTestMount();
			using php2 = await createPhpRuntimeWithFileLockingAndTestMount();

			const phpCoordinationFile = join(
				tempDir,
				'php-instance-coordination'
			);
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

					// Wait until php2 notifies us by updating the coordination file
					file_put_contents('${vfsPhpCoordinationFile}', '${stages.php1WaitingForPhp2ToTry}');
					while (
						file_get_contents('${vfsPhpCoordinationFile}') !== '${stages.php2ReadyForUnlock}'
					) {
						usleep(100 * 1000);
					}

					$db->exec('COMMIT;');
					$db->close(); // Explicitly close the file descriptor
					file_put_contents('${vfsPhpCoordinationFile}', '${stages.php1Unlocked}');

					// Keep the process alive to ensure lock is released by closing fd, not process termination
					while (
						file_get_contents('${vfsPhpCoordinationFile}') === '${stages.php1Unlocked}'
					) {
						usleep(100 * 1000);
					}
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
					$attempt_while_locked = [
						'lastErrorCode' => $db->lastErrorCode(),
						'lastErrorMsg' => $db->lastErrorMsg(),
					];

					file_put_contents('${vfsPhpCoordinationFile}', '${stages.php2ReadyForUnlock}');
					while (
						file_get_contents('${vfsPhpCoordinationFile}') !== '${stages.php1Unlocked}'
					) {
						usleep(100 * 1000);
					}

					$result = $db->exec('INSERT INTO test (name) VALUES ("test-after-fd-closed")');
					$attempt_after_fd_closed = [
						'lastErrorCode' => $db->lastErrorCode(),
						'lastErrorMsg' => $db->lastErrorMsg(),
					];

					echo json_encode([
						'attempt_while_locked' => $attempt_while_locked,
						'attempt_after_fd_closed' => $attempt_after_fd_closed,
					]);
					$db->close();

					// Signal php1 to exit
					file_put_contents('${vfsPhpCoordinationFile}', 'done');
				`,
			});

			const [php1Result, php2Result] = await Promise.all([
				promisedPhp1Result,
				promisedPhp2Result,
			]);
			expect(php1Result.exitCode).toBe(0);
			expect(php2Result.exitCode).toBe(0);
			const result2Data = JSON.parse(php2Result.text || '{}');
			expect(result2Data.attempt_while_locked).toMatchObject({
				lastErrorCode: 5, // SQLITE_BUSY
				lastErrorMsg: 'database is locked',
			});
			expect(result2Data.attempt_after_fd_closed).toMatchObject({
				lastErrorCode: 0,
				lastErrorMsg: 'not an error',
			});
		});
	}, 5000);

	describe('PHP flock()', () => {
		it('should be able to acquire an exclusive lock on a file', async () => {
			using php = await createPhpRuntimeWithFileLockingAndTestMount();

			const testFilePath = `${vfsMountPoint}/test.txt`;
			const result = await php.run({
				code: `<?php
					$fp = fopen('${testFilePath}', 'w');
					$lockResult = flock($fp, LOCK_EX | LOCK_NB);
					fwrite($fp, 'test content');
					flock($fp, LOCK_UN);
					fclose($fp);

					echo json_encode([
						'lockAcquired' => $lockResult,
						'fileContents' => file_get_contents('${testFilePath}'),
					]);
				`,
			});

			expect(result.exitCode).toBe(0);
			const resultData = JSON.parse(result.text || '{}');
			expect(resultData.lockAcquired).toBe(true);
			expect(resultData.fileContents).toBe('test content');
		});
		it('should be able to acquire a shared lock on a file', async () => {
			using php = await createPhpRuntimeWithFileLockingAndTestMount();

			const testFilePath = `${vfsMountPoint}/test.txt`;
			const result = await php.run({
				code: `<?php
					file_put_contents('${testFilePath}', 'test content');
					$fp = fopen('${testFilePath}', 'r+');
					if ($fp === false) {
						echo json_encode(['error' => 'Failed to open file']);
						exit(1);
					}
					$lockResult = flock($fp, LOCK_SH | LOCK_NB);
					fseek($fp, 0);
					$fileContents = fread($fp, 1024);
					flock($fp, LOCK_UN);
					fclose($fp);

					echo json_encode([
						'lockAcquired' => $lockResult,
						'fileContents' => $fileContents,
					]);
				`,
			});

			expect(result.exitCode).toBe(0);
			const resultData = JSON.parse(result.text || '{}');
			expect(resultData.lockAcquired).toBe(true);
			expect(resultData.fileContents).toBe('test content');
		});
		it('should deny an exclusive lock when another process has a shared lock on a file', async () => {
			using php1 = await createPhpRuntimeWithFileLockingAndTestMount();
			using php2 = await createPhpRuntimeWithFileLockingAndTestMount();

			const testFilePath = `${vfsMountPoint}/test.txt`;
			const phpCoordinationFile = join(
				tempDir,
				'php-instance-coordination'
			);
			const vfsPhpCoordinationFile = `${vfsMountPoint}/php-instance-coordination`;
			const stages = {
				php1Locking: 'php1-locking',
				php1WaitingForPhp2ToTry: 'php1-waiting-for-php2-to-try',
				php2ReadyForUnlock: 'php2-ready-for-unlock',
				php1Unlocked: 'php1-unlocked',
			} as const;

			writeFileSync(phpCoordinationFile, stages.php1Locking);
			writeFileSync(join(tempDir, 'test.txt'), 'test content');

			const promisedPhp1Result = php1.run({
				code: `<?php
					$fp = fopen('${testFilePath}', 'r+');
					flock($fp, LOCK_SH | LOCK_NB); // Acquire shared lock (non-blocking)

					file_put_contents('${vfsPhpCoordinationFile}', '${stages.php1WaitingForPhp2ToTry}');
					while (
						file_get_contents('${vfsPhpCoordinationFile}') !== '${stages.php2ReadyForUnlock}'
					) {
						usleep(100 * 1000);
					}

					flock($fp, LOCK_UN);
					fclose($fp);
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

					$fp = fopen('${testFilePath}', 'r+');
					$lockResult = flock($fp, LOCK_EX | LOCK_NB); // Try non-blocking exclusive lock
					$attempt_while_shared_locked = [
						'lockAcquired' => $lockResult,
					];
					if ($lockResult) {
						flock($fp, LOCK_UN);
					}
					fclose($fp);

					file_put_contents('${vfsPhpCoordinationFile}', '${stages.php2ReadyForUnlock}');
					while (
						file_get_contents('${vfsPhpCoordinationFile}') !== '${stages.php1Unlocked}'
					) {
						usleep(100 * 1000);
					}

					$fp = fopen('${testFilePath}', 'r+');
					$lockResult = flock($fp, LOCK_EX | LOCK_NB);
					$attempt_while_unlocked = [
						'lockAcquired' => $lockResult,
					];
					if ($lockResult) {
						flock($fp, LOCK_UN);
					}
					fclose($fp);

					echo json_encode([
						'attempt_while_shared_locked' => $attempt_while_shared_locked,
						'attempt_while_unlocked' => $attempt_while_unlocked,
					]);
				`,
			});

			const [php1Result, php2Result] = await Promise.all([
				promisedPhp1Result,
				promisedPhp2Result,
			]);
			expect(php1Result.exitCode).toBe(0);
			expect(php2Result.exitCode).toBe(0);
			const result2Data = JSON.parse(php2Result.text || '{}');
			expect(result2Data.attempt_while_shared_locked.lockAcquired).toBe(
				false
			);
			expect(result2Data.attempt_while_unlocked.lockAcquired).toBe(true);
		});
		it('should deny a shared lock when another process has an exclusive lock on a file', async () => {
			using php1 = await createPhpRuntimeWithFileLockingAndTestMount();
			using php2 = await createPhpRuntimeWithFileLockingAndTestMount();

			const testFilePath = `${vfsMountPoint}/test.txt`;
			const phpCoordinationFile = join(
				tempDir,
				'php-instance-coordination'
			);
			const vfsPhpCoordinationFile = `${vfsMountPoint}/php-instance-coordination`;
			const stages = {
				php1Locking: 'php1-locking',
				php1WaitingForPhp2ToTry: 'php1-waiting-for-php2-to-try',
				php2ReadyForUnlock: 'php2-ready-for-unlock',
				php1Unlocked: 'php1-unlocked',
			} as const;

			writeFileSync(phpCoordinationFile, stages.php1Locking);
			writeFileSync(join(tempDir, 'test.txt'), 'test content');

			const promisedPhp1Result = php1.run({
				code: `<?php
					$fp = fopen('${testFilePath}', 'r+');
					flock($fp, LOCK_EX | LOCK_NB); // Acquire exclusive lock (non-blocking)

					file_put_contents('${vfsPhpCoordinationFile}', '${stages.php1WaitingForPhp2ToTry}');
					while (
						file_get_contents('${vfsPhpCoordinationFile}') !== '${stages.php2ReadyForUnlock}'
					) {
						usleep(100 * 1000);
					}

					flock($fp, LOCK_UN);
					fclose($fp);
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

					$fp = fopen('${testFilePath}', 'r+');
					$lockResult = flock($fp, LOCK_SH | LOCK_NB); // Try non-blocking shared lock
					$attempt_while_exclusively_locked = [
						'lockAcquired' => $lockResult,
					];
					if ($lockResult) {
						flock($fp, LOCK_UN);
					}
					fclose($fp);

					file_put_contents('${vfsPhpCoordinationFile}', '${stages.php2ReadyForUnlock}');
					while (
						file_get_contents('${vfsPhpCoordinationFile}') !== '${stages.php1Unlocked}'
					) {
						usleep(100 * 1000);
					}

					$fp = fopen('${testFilePath}', 'r+');
					$lockResult = flock($fp, LOCK_SH | LOCK_NB);
					$attempt_while_unlocked = [
						'lockAcquired' => $lockResult,
					];
					if ($lockResult) {
						flock($fp, LOCK_UN);
					}
					fclose($fp);

					echo json_encode([
						'attempt_while_exclusively_locked' => $attempt_while_exclusively_locked,
						'attempt_while_unlocked' => $attempt_while_unlocked,
					]);
				`,
			});

			const [php1Result, php2Result] = await Promise.all([
				promisedPhp1Result,
				promisedPhp2Result,
			]);
			expect(php1Result.exitCode).toBe(0);
			expect(php2Result.exitCode).toBe(0);
			const result2Data = JSON.parse(php2Result.text || '{}');
			expect(
				result2Data.attempt_while_exclusively_locked.lockAcquired
			).toBe(false);
			expect(result2Data.attempt_while_unlocked.lockAcquired).toBe(true);
		});
		it('should grant multiple shared locks on a file', async () => {
			using php1 = await createPhpRuntimeWithFileLockingAndTestMount();
			using php2 = await createPhpRuntimeWithFileLockingAndTestMount();
			using php3 = await createPhpRuntimeWithFileLockingAndTestMount();

			const testFilePath = `${vfsMountPoint}/test.txt`;
			const phpCoordinationFile = join(
				tempDir,
				'php-instance-coordination'
			);
			const vfsPhpCoordinationFile = `${vfsMountPoint}/php-instance-coordination`;
			const stages = {
				php1Locking: 'php1-locking',
				php1Locked: 'php1-locked',
				php2Locked: 'php2-locked',
				php3CanUnlock: 'php3-can-unlock',
			} as const;

			writeFileSync(phpCoordinationFile, stages.php1Locking);
			writeFileSync(join(tempDir, 'test.txt'), 'test content');

			const promisedPhp1Result = php1.run({
				code: `<?php
					$fp = fopen('${testFilePath}', 'r+');
					$lockResult = flock($fp, LOCK_SH | LOCK_NB); // Acquire shared lock (non-blocking)

					file_put_contents('${vfsPhpCoordinationFile}', '${stages.php1Locked}');
					while (
						file_get_contents('${vfsPhpCoordinationFile}') !== '${stages.php3CanUnlock}'
					) {
						usleep(100 * 1000);
					}

					flock($fp, LOCK_UN);
					fclose($fp);
					echo json_encode(['lockAcquired' => $lockResult]);
				`,
			});
			const promisedPhp2Result = php2.run({
				code: `<?php
					while (
						file_get_contents('${vfsPhpCoordinationFile}') !== '${stages.php1Locked}'
					) {
						usleep(100 * 1000);
					}

					$fp = fopen('${testFilePath}', 'r+');
					$lockResult = flock($fp, LOCK_SH | LOCK_NB); // Try non-blocking shared lock

					file_put_contents('${vfsPhpCoordinationFile}', '${stages.php2Locked}');
					while (
						file_get_contents('${vfsPhpCoordinationFile}') !== '${stages.php3CanUnlock}'
					) {
						usleep(100 * 1000);
					}

					if ($lockResult) {
						flock($fp, LOCK_UN);
					}
					fclose($fp);
					echo json_encode(['lockAcquired' => $lockResult]);
				`,
			});
			const promisedPhp3Result = php3.run({
				code: `<?php
					while (
						file_get_contents('${vfsPhpCoordinationFile}') !== '${stages.php2Locked}'
					) {
						usleep(100 * 1000);
					}

					$fp = fopen('${testFilePath}', 'r+');
					$lockResult = flock($fp, LOCK_SH | LOCK_NB); // Try non-blocking shared lock

					file_put_contents('${vfsPhpCoordinationFile}', '${stages.php3CanUnlock}');

					if ($lockResult) {
						flock($fp, LOCK_UN);
					}
					fclose($fp);
					echo json_encode(['lockAcquired' => $lockResult]);
				`,
			});

			const [php1Result, php2Result, php3Result] = await Promise.all([
				promisedPhp1Result,
				promisedPhp2Result,
				promisedPhp3Result,
			]);
			expect(php1Result.exitCode).toBe(0);
			expect(php2Result.exitCode).toBe(0);
			expect(php3Result.exitCode).toBe(0);
			const result1Data = JSON.parse(php1Result.text || '{}');
			const result2Data = JSON.parse(php2Result.text || '{}');
			const result3Data = JSON.parse(php3Result.text || '{}');
			// All three should be able to acquire shared locks
			expect(result1Data.lockAcquired).toBe(true);
			expect(result2Data.lockAcquired).toBe(true);
			expect(result3Data.lockAcquired).toBe(true);
		});
		it('should release a shared lock when its associated file descriptor is closed', async () => {
			using php1 = await createPhpRuntimeWithFileLockingAndTestMount();
			using php2 = await createPhpRuntimeWithFileLockingAndTestMount();

			const vfsTestFilePath = `${vfsMountPoint}/test.txt`;
			const phpCoordinationFile = join(
				tempDir,
				'php-instance-coordination'
			);
			const vfsPhpCoordinationFile = `${vfsMountPoint}/php-instance-coordination`;
			const stages = {
				php1Locking: 'php1-locking',
				php1WaitingForPhp2ToTry: 'php1-waiting-for-php2-to-try',
				php2ReadyForUnlock: 'php2-ready-for-unlock',
				php1Unlocked: 'php1-unlocked',
			} as const;

			writeFileSync(phpCoordinationFile, stages.php1Locking);
			writeFileSync(join(tempDir, 'test.txt'), 'test content');

			const promisedPhp1Result = php1.run({
				code: `<?php
					$fp = fopen('${vfsTestFilePath}', 'r+');
					flock($fp, LOCK_SH | LOCK_NB); // Acquire shared lock (non-blocking)

					file_put_contents('${vfsPhpCoordinationFile}', '${stages.php1WaitingForPhp2ToTry}');
					while (
						file_get_contents('${vfsPhpCoordinationFile}') !== '${stages.php2ReadyForUnlock}'
					) {
						usleep(100 * 1000);
					}

					fclose($fp); // Explicitly close the file descriptor
					file_put_contents('${vfsPhpCoordinationFile}', '${stages.php1Unlocked}');

					// Keep the process alive to ensure lock is released by closing fd, not process termination
					while (
						file_get_contents('${vfsPhpCoordinationFile}') === '${stages.php1Unlocked}'
					) {
						usleep(100 * 1000);
					}
				`,
			});
			const promisedPhp2Result = php2.run({
				code: `<?php
					while (
						file_get_contents('${vfsPhpCoordinationFile}') !== '${stages.php1WaitingForPhp2ToTry}'
					) {
						usleep(100 * 1000);
					}

					$fp = fopen('${vfsTestFilePath}', 'r+');
					$lockResult = flock($fp, LOCK_EX | LOCK_NB); // Try non-blocking exclusive lock
					$attempt_while_locked = [
						'lockAcquired' => $lockResult,
					];
					if ($lockResult) {
						flock($fp, LOCK_UN);
					}
					fclose($fp);

					file_put_contents('${vfsPhpCoordinationFile}', '${stages.php2ReadyForUnlock}');
					while (
						file_get_contents('${vfsPhpCoordinationFile}') !== '${stages.php1Unlocked}'
					) {
						usleep(100 * 1000);
					}

					$fp = fopen('${vfsTestFilePath}', 'r+');
					$lockResult = flock($fp, LOCK_EX | LOCK_NB);
					$attempt_after_fd_closed = [
						'lockAcquired' => $lockResult,
					];
					if ($lockResult) {
						flock($fp, LOCK_UN);
					}
					fclose($fp);

					echo json_encode([
						'attempt_while_locked' => $attempt_while_locked,
						'attempt_after_fd_closed' => $attempt_after_fd_closed,
					]);

					// Signal php1 to exit
					file_put_contents('${vfsPhpCoordinationFile}', 'done');
				`,
			});

			const [php1Result, php2Result] = await Promise.all([
				promisedPhp1Result,
				promisedPhp2Result,
			]);
			expect(php1Result.exitCode).toBe(0);
			expect(php2Result.exitCode).toBe(0);
			const result2Data = JSON.parse(php2Result.text || '{}');
			expect(result2Data.attempt_while_locked.lockAcquired).toBe(false);
			expect(result2Data.attempt_after_fd_closed.lockAcquired).toBe(true);
		});
		it('should release an exclusive lock when its associated file descriptor is closed', async () => {
			using php1 = await createPhpRuntimeWithFileLockingAndTestMount();
			using php2 = await createPhpRuntimeWithFileLockingAndTestMount();

			const testFilePath = `${vfsMountPoint}/test.txt`;
			const phpCoordinationFile = join(
				tempDir,
				'php-instance-coordination'
			);
			const vfsPhpCoordinationFile = `${vfsMountPoint}/php-instance-coordination`;
			const stages = {
				php1Locking: 'php1-locking',
				php1WaitingForPhp2ToTry: 'php1-waiting-for-php2-to-try',
				php2ReadyForUnlock: 'php2-ready-for-unlock',
				php1Unlocked: 'php1-unlocked',
			} as const;

			writeFileSync(phpCoordinationFile, stages.php1Locking);
			writeFileSync(join(tempDir, 'test.txt'), 'test content');

			const promisedPhp1Result = php1.run({
				code: `<?php
					$fp = fopen('${testFilePath}', 'r+');
					flock($fp, LOCK_EX | LOCK_NB); // Acquire exclusive lock (non-blocking)

					file_put_contents('${vfsPhpCoordinationFile}', '${stages.php1WaitingForPhp2ToTry}');
					while (
						file_get_contents('${vfsPhpCoordinationFile}') !== '${stages.php2ReadyForUnlock}'
					) {
						usleep(100 * 1000);
					}

					fclose($fp); // Explicitly close the file descriptor
					file_put_contents('${vfsPhpCoordinationFile}', '${stages.php1Unlocked}');

					// Keep the process alive to ensure lock is released by closing fd, not process termination
					while (
						file_get_contents('${vfsPhpCoordinationFile}') === '${stages.php1Unlocked}'
					) {
						usleep(100 * 1000);
					}
				`,
			});
			const promisedPhp2Result = php2.run({
				code: `<?php
					while (
						file_get_contents('${vfsPhpCoordinationFile}') !== '${stages.php1WaitingForPhp2ToTry}'
					) {
						usleep(100 * 1000);
					}

					$fp = fopen('${testFilePath}', 'r+');
					$lockResult = flock($fp, LOCK_SH | LOCK_NB); // Try non-blocking shared lock
					$attempt_while_locked = [
						'lockAcquired' => $lockResult,
					];
					if ($lockResult) {
						flock($fp, LOCK_UN);
					}
					fclose($fp);

					file_put_contents('${vfsPhpCoordinationFile}', '${stages.php2ReadyForUnlock}');
					while (
						file_get_contents('${vfsPhpCoordinationFile}') !== '${stages.php1Unlocked}'
					) {
						usleep(100 * 1000);
					}

					$fp = fopen('${testFilePath}', 'r+');
					$lockResult = flock($fp, LOCK_SH | LOCK_NB);
					$attempt_after_fd_closed = [
						'lockAcquired' => $lockResult,
					];
					if ($lockResult) {
						flock($fp, LOCK_UN);
					}
					fclose($fp);

					echo json_encode([
						'attempt_while_locked' => $attempt_while_locked,
						'attempt_after_fd_closed' => $attempt_after_fd_closed,
					]);

					// Signal php1 to exit
					file_put_contents('${vfsPhpCoordinationFile}', 'done');
				`,
			});

			const [php1Result, php2Result] = await Promise.all([
				promisedPhp1Result,
				promisedPhp2Result,
			]);
			expect(php1Result.exitCode).toBe(0);
			expect(php2Result.exitCode).toBe(0);
			const result2Data = JSON.parse(php2Result.text || '{}');
			expect(result2Data.attempt_while_locked.lockAcquired).toBe(false);
			expect(result2Data.attempt_after_fd_closed.lockAcquired).toBe(true);
		});
		it('should release a shared lock when the owning process exits', async () => {
			using php1 = await createPhpRuntimeWithFileLockingAndTestMount();
			using php2 = await createPhpRuntimeWithFileLockingAndTestMount();

			const testFilePath = `${vfsMountPoint}/test.txt`;
			const phpCoordinationFile = join(
				tempDir,
				'php-instance-coordination'
			);
			const vfsPhpCoordinationFile = `${vfsMountPoint}/php-instance-coordination`;
			const stages = {
				php1Locking: 'php1-locking',
				php1Locked: 'php1-locked',
				php2ConfirmedFileLocked: 'php2-confirmed-file-locked',
				php1EndOfScript: 'php1-end-of-script',
			} as const;

			writeFileSync(phpCoordinationFile, stages.php1Locking);
			writeFileSync(join(tempDir, 'test.txt'), 'test content');

			const promisedPhp1Result = php1.run({
				code: `<?php
					$fp = fopen('${testFilePath}', 'r+');
					flock($fp, LOCK_SH | LOCK_NB); // Acquire shared lock (non-blocking)

					file_put_contents('${vfsPhpCoordinationFile}', '${stages.php1Locked}');

					while (
						file_get_contents('${vfsPhpCoordinationFile}') !== '${stages.php2ConfirmedFileLocked}'
					) {
						usleep(100 * 1000);
					}

					// NOTE: We intentionally skip closing the file descriptor.
				`,
			});
			const promisedPhp2Result = php2.run({
				code: `<?php
					$fp = fopen('${testFilePath}', 'r+');
					$lockResult = flock($fp, LOCK_EX | LOCK_NB);
					$attempt_while_locked = $lockResult;

					file_put_contents('${vfsPhpCoordinationFile}', '${stages.php2ConfirmedFileLocked}');
					while (file_get_contents('${vfsPhpCoordinationFile}') !== '${stages.php1EndOfScript}') {
						usleep(100 * 1000);
					}

					$lockResult = flock($fp, LOCK_EX | LOCK_NB);
					$attempt_after_exit = $lockResult;

					echo json_encode([
						'attempt_while_locked' => $attempt_while_locked,
						'attempt_after_exit' => $attempt_after_exit,
					]);
				`,
			});

			// Wait for php1 to exit before notifying php2.
			await promisedPhp1Result;
			writeFileSync(phpCoordinationFile, stages.php1EndOfScript);

			const php2Result = await promisedPhp2Result;
			expect(php2Result.exitCode).toBe(0);
			const result2Data = JSON.parse(php2Result.text || '{}');
			expect(result2Data.attempt_while_locked).toBe(false);
			expect(result2Data.attempt_after_exit).toBe(true);
		});
		it('should release an exclusive lock when the owning process exits', async () => {
			using php1 = await createPhpRuntimeWithFileLockingAndTestMount();
			using php2 = await createPhpRuntimeWithFileLockingAndTestMount();

			const testFilePath = `${vfsMountPoint}/test.txt`;
			const phpCoordinationFile = join(
				tempDir,
				'php-instance-coordination'
			);
			const vfsPhpCoordinationFile = `${vfsMountPoint}/php-instance-coordination`;
			const stages = {
				php1Locking: 'php1-locking',
				php1Locked: 'php1-locked',
				php2ConfirmedFileLocked: 'php2-confirmed-file-locked',
				php1EndOfScript: 'php1-end-of-script',
			} as const;

			writeFileSync(phpCoordinationFile, stages.php1Locking);
			writeFileSync(join(tempDir, 'test.txt'), 'test content');

			const promisedPhp1Result = php1.run({
				code: `<?php
					$fp = fopen('${testFilePath}', 'r+');
					flock($fp, LOCK_EX | LOCK_NB); // Acquire exclusive lock (non-blocking)

					file_put_contents('${vfsPhpCoordinationFile}', '${stages.php1Locked}');

					while (
						file_get_contents('${vfsPhpCoordinationFile}') !== '${stages.php2ConfirmedFileLocked}'
					) {
						usleep(100 * 1000);
					}

					// NOTE: We intentionally skip closing the file descriptor.
				`,
			});
			const promisedPhp2Result = php2.run({
				code: `<?php
					$fp = fopen('${testFilePath}', 'r+');
					$lockResult = flock($fp, LOCK_SH | LOCK_NB);
					$attempt_while_locked = $lockResult;

					file_put_contents('${vfsPhpCoordinationFile}', '${stages.php2ConfirmedFileLocked}');
					while (file_get_contents('${vfsPhpCoordinationFile}') !== '${stages.php1EndOfScript}') {
						usleep(100 * 1000);
					}

					$lockResult = flock($fp, LOCK_EX | LOCK_NB);
					$attempt_after_exit = $lockResult;

					echo json_encode([
						'attempt_while_locked' => $attempt_while_locked,
						'attempt_after_exit' => $attempt_after_exit,
					]);
				`,
			});

			// Wait for php1 to exit before notifying php2.
			await promisedPhp1Result;
			writeFileSync(phpCoordinationFile, stages.php1EndOfScript);

			const php2Result = await promisedPhp2Result;
			expect(php2Result.exitCode).toBe(0);
			const result2Data = JSON.parse(php2Result.text || '{}');
			expect(result2Data.attempt_while_locked).toBe(false);
			expect(result2Data.attempt_after_exit).toBe(true);
		});
	}, 5000);
});
