import { randomUUID } from 'node:crypto';
import { runCLI } from '../src/run-cli';
import type { RunCLIServer } from '../src/run-cli';
import { mkdtempSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const VFS_TEST_DIR = '/test';
const SCRIPT_RUNNER_HTTP_PATH = '/__cli-file-locking/script-runner.php';
const SCRIPT_RUNNER_VFS_PATH = `/wordpress${SCRIPT_RUNNER_HTTP_PATH}`;
const SCRIPT_RUNNER_DIR = '/wordpress/__cli-file-locking';

const TEST_TIMEOUT = 30_000;

// TODO: Remove unnecessary indirection here. The tests can just make direct HTTP requests.
const SCRIPT_RUNNER_SOURCE = `<?php
declare(strict_types=1);
$script = $_GET['script'] ?? '';
if ($script === '') {
	http_response_code(400);
	echo 'Missing script parameter';
	return;
}
if (!preg_match('/^[A-Za-z0-9_-]+$/', $script)) {
	http_response_code(400);
	echo 'Invalid script name';
	return;
}
$scriptPath = '${VFS_TEST_DIR}/' . $script . '.php';
if (!file_exists($scriptPath)) {
	http_response_code(404);
	echo 'Script not found';
	return;
}
require $scriptPath;
`;

describe.only(
	'Playground CLI file locking',
	() => {
		let cliServer: RunCLIServer;
		let testId: string;

		beforeAll(async () => {
			const testDir = mkdtempSync(
				path.join(os.tmpdir(), 'playground-cli-file-locking-test-')
			);
			cliServer = await runCLI({
				command: 'server',
				wordpressInstallMode: 'download-and-install',
				mount: [
					{
						hostPath: testDir,
						vfsPath: VFS_TEST_DIR,
					},
				],
				// TODO: Tests with all supported PHP versions
			});
			await prepareScriptRunner();
		}, TEST_TIMEOUT);

		// afterAll(async () => {
		// 	if (cliServer) {
		// 		await cliServer[Symbol.asyncDispose]();
		// 	}
		// });

		beforeEach(() => {
			testId = randomUUID();
		});

		async function prepareScriptRunner() {
			await ensureDir(VFS_TEST_DIR);
			await ensureDir(SCRIPT_RUNNER_DIR);
			await cliServer.playground.writeFile(
				SCRIPT_RUNNER_VFS_PATH,
				SCRIPT_RUNNER_SOURCE
			);
		}

		async function ensureDir(path: string) {
			try {
				await cliServer.playground.mkdir(path);
			} catch (error) {
				const message =
					error instanceof Error ? error.message : String(error);
				if (!/exists/i.test(message)) {
					throw error;
				}
			}
		}

		function uniqueScriptName(label: string) {
			return `${testId}-${label}`;
		}

		async function createScript(label: string, code: string) {
			const scriptName = uniqueScriptName(label);
			await cliServer.playground.writeFile(
				`${VFS_TEST_DIR}/${scriptName}.php`,
				code
			);
			return scriptName;
		}

		async function createCoordinationFile(initialStage: string) {
			const path = `${VFS_TEST_DIR}/${testId}-coordination.txt`;
			await writeFile(path, initialStage);
			return path;
		}

		type ScriptRunResult = {
			status: number;
			text: string;
		};

		async function runScript(scriptName: string): Promise<ScriptRunResult> {
			const url = new URL(SCRIPT_RUNNER_HTTP_PATH, cliServer.serverUrl);
			url.searchParams.set('script', scriptName);
			console.log('Running script:', url.toString());
			const response = await fetch(url);
			const text = await response.text();
			console.log('Script result text:', scriptName, text);
			return { status: response.status, text };
		}

		async function runScriptAndParseJson(scriptName: string) {
			console.log('Running script and parsing JSON...', scriptName);
			const result = await runScript(scriptName);
			console.log('Script result:', scriptName, result);
			expect(result.status).toBe(200);
			return result.text ? JSON.parse(result.text) : {};
		}

		async function seedSqliteDatabase(dbPath: string) {
			const setupScript = await createScript(
				'seed-sqlite',
				`<?php
				ob_start();
				$db = new SQLite3('${dbPath}');
				$result = $db->exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
				if ($result === false) {
					ob_clean();
					echo json_encode(['error' => $db->lastErrorMsg()]);
					exit(1);
				}
				$db->close();
				echo 'ok';
			`
			);
			const setupResult = await runScript(setupScript);
			expect(setupResult.status).toBe(200);
			expect(setupResult.text.trim()).toBe('ok');
		}

		async function writeFile(path: string, contents: string) {
			await cliServer.playground.writeFile(path, contents);
		}

		describe(
			'SQLite DB locking (relying upon fcntl())',
			() => {
				it(
					'cannot write to DB while another process has an exclusive lock',
					async () => {
						const vfsDbFilePath = `${VFS_TEST_DIR}/${testId}-exclusive.db`;
						const coordinationFile =
							await createCoordinationFile('php1-locking');
						const stages = {
							php1Locked: 'php1-locked',
							php2ReadyForUnlock: 'php2-ready-for-unlock',
							php1Unlocked: 'php1-unlocked',
						} as const;

						console.log('Seeding SQLite database...');
						await seedSqliteDatabase(vfsDbFilePath);

						console.log('Creating PHP1 script...');
						const php1Script = await createScript(
							'sqlite-exclusive-locker',
							`<?php
							$db = new SQLite3('${vfsDbFilePath}');
							$db->exec('BEGIN EXCLUSIVE;');

							file_put_contents('${coordinationFile}', '${stages.php1Locked}');
							while (file_get_contents('${coordinationFile}') !== '${stages.php2ReadyForUnlock}') {
								usleep(100 * 1000);
							}

							$db->exec('INSERT INTO test (name) VALUES ("test1")');
							$db->exec('COMMIT;');
							$db->close();
							file_put_contents('${coordinationFile}', '${stages.php1Unlocked}');
						`
						);

						console.log('Creating PHP2 script...');
						const php2Script = await createScript(
							'sqlite-exclusive-contender',
							`<?php
							ob_start();
							while (file_get_contents('${coordinationFile}') !== '${stages.php1Locked}') {
								usleep(100 * 1000);
							}

							$db = new SQLite3('${vfsDbFilePath}');
							$db->exec('INSERT INTO test (name) VALUES ("test-while-locked")');
							$attempt_while_exclusively_locked = [
								'lastErrorCode' => $db->lastErrorCode(),
								'lastErrorMsg' => $db->lastErrorMsg(),
							];

							file_put_contents('${coordinationFile}', '${stages.php2ReadyForUnlock}');
							while (file_get_contents('${coordinationFile}') !== '${stages.php1Unlocked}') {
								usleep(100 * 1000);
							}

							$db->exec('INSERT INTO test (name) VALUES ("test-while-unlocked")');
							$attempt_while_unlocked = [
								'lastErrorCode' => $db->lastErrorCode(),
								'lastErrorMsg' => $db->lastErrorMsg(),
							];
							$db->close();

							ob_clean();
							echo json_encode([
								'attempt_while_exclusively_locked' => $attempt_while_exclusively_locked,
								'attempt_while_unlocked' => $attempt_while_unlocked,
							]);
						`
						);

						console.log('Running PHP1 script...');
						console.log('Running PHP2 script...');
						const [php1Result, php2Result] = await Promise.all([
							runScript(php1Script),
							runScript(php2Script),
						]);
						expect(php1Result.status).toBe(200);
						expect(php2Result.status).toBe(200);

						const parsed = php2Result.text
							? JSON.parse(php2Result.text)
							: {};
						expect(
							parsed.attempt_while_exclusively_locked
						).toMatchObject({
							lastErrorCode: 5,
							lastErrorMsg: 'database is locked',
						});
						expect(parsed.attempt_while_unlocked).toMatchObject({
							lastErrorCode: 0,
							lastErrorMsg: 'not an error',
						});
					},
					// TODO: Remove individual test timeouts
					TEST_TIMEOUT
				);

				it(
					'cannot read from DB while another process has an exclusive lock',
					async () => {
						const dbFilePath = `${VFS_TEST_DIR}/${testId}-exclusive-read.db`;
						const coordinationFile =
							await createCoordinationFile('php1-locking');
						const stages = {
							php1WaitingForPhp2ToTry:
								'php1-waiting-for-php2-to-try',
							php2ReadyForUnlock: 'php2-ready-for-unlock',
							php1Unlocked: 'php1-unlocked',
						} as const;

						await seedSqliteDatabase(dbFilePath);

						const php1Script = await createScript(
							'sqlite-exclusive-reader-locker',
							`<?php
							ob_start();
							$db = new SQLite3('${dbFilePath}');
							$db->exec('BEGIN EXCLUSIVE;');
							$db->exec('INSERT INTO test (name) VALUES ("test1")');

							file_put_contents('${coordinationFile}', '${stages.php1WaitingForPhp2ToTry}');
							while (file_get_contents('${coordinationFile}') !== '${stages.php2ReadyForUnlock}') {
								usleep(100 * 1000);
							}

							$db->exec('COMMIT;');
							$db->close();
							file_put_contents('${coordinationFile}', '${stages.php1Unlocked}');
						`
						);

						const php2Script = await createScript(
							'sqlite-exclusive-reader',
							`<?php
							ob_start();
							while (file_get_contents('${coordinationFile}') !== '${stages.php1WaitingForPhp2ToTry}') {
								usleep(100 * 1000);
							}

							$db = new SQLite3('${dbFilePath}');
							$db->querySingle('SELECT COUNT(*) FROM test');
							$attempt_while_exclusively_locked = [
								'lastErrorCode' => $db->lastErrorCode(),
								'lastErrorMsg' => $db->lastErrorMsg(),
							];

							file_put_contents('${coordinationFile}', '${stages.php2ReadyForUnlock}');
							while (file_get_contents('${coordinationFile}') !== '${stages.php1Unlocked}') {
								usleep(100 * 1000);
							}

							$db->querySingle('SELECT COUNT(*) FROM test');
							$attempt_while_unlocked = [
								'lastErrorCode' => $db->lastErrorCode(),
								'lastErrorMsg' => $db->lastErrorMsg(),
							];
							$db->close();

							ob_clean();
							echo json_encode([
								'attempt_while_exclusively_locked' => $attempt_while_exclusively_locked,
								'attempt_while_unlocked' => $attempt_while_unlocked,
							]);
						`
						);

						const [php1Result, php2Result] = await Promise.all([
							runScript(php1Script),
							runScript(php2Script),
						]);
						expect(php1Result.status).toBe(200);
						expect(php2Result.status).toBe(200);
						const parsed = php2Result.text
							? JSON.parse(php2Result.text)
							: {};
						expect(
							parsed.attempt_while_exclusively_locked
						).toMatchObject({
							lastErrorCode: 5,
							lastErrorMsg: 'database is locked',
						});
						expect(parsed.attempt_while_unlocked).toMatchObject({
							lastErrorCode: 0,
							lastErrorMsg: 'not an error',
						});
					},
					TEST_TIMEOUT
				);

				it(
					'cannot write to DB while another process has a shared lock',
					async () => {
						const dbFilePath = `${VFS_TEST_DIR}/${testId}-shared-write.db`;
						const coordinationFile =
							await createCoordinationFile('php1-locking');
						const stages = {
							php1WaitingForPhp2ToTry:
								'php1-waiting-for-php2-to-try',
							php2ReadyForUnlock: 'php2-ready-for-unlock',
							php1Unlocked: 'php1-unlocked',
						} as const;

						await seedSqliteDatabase(dbFilePath);

						const php1Script = await createScript(
							'sqlite-shared-locker',
							`<?php
							$db = new SQLite3('${dbFilePath}');
							$db->exec('BEGIN;');
							$db->querySingle('SELECT COUNT(*) FROM test');

							file_put_contents('${coordinationFile}', '${stages.php1WaitingForPhp2ToTry}');
							while (file_get_contents('${coordinationFile}') !== '${stages.php2ReadyForUnlock}') {
								usleep(100 * 1000);
							}

							$db->exec('COMMIT;');
							$db->close();
							file_put_contents('${coordinationFile}', '${stages.php1Unlocked}');
						`
						);

						const php2Script = await createScript(
							'sqlite-shared-writer',
							`<?php
							ob_start();
							while (file_get_contents('${coordinationFile}') !== '${stages.php1WaitingForPhp2ToTry}') {
								usleep(100 * 1000);
							}

							$db = new SQLite3('${dbFilePath}');
							$db->exec('INSERT INTO test (name) VALUES ("test-while-shared-locked")');
							$attempt_while_shared_locked = [
								'lastErrorCode' => $db->lastErrorCode(),
								'lastErrorMsg' => $db->lastErrorMsg(),
							];

							file_put_contents('${coordinationFile}', '${stages.php2ReadyForUnlock}');
							while (file_get_contents('${coordinationFile}') !== '${stages.php1Unlocked}') {
								usleep(100 * 1000);
							}

							$db->exec('INSERT INTO test (name) VALUES ("test-while-unlocked")');
							$attempt_while_unlocked = [
								'lastErrorCode' => $db->lastErrorCode(),
								'lastErrorMsg' => $db->lastErrorMsg(),
							];

							ob_clean();
							echo json_encode([
								'attempt_while_shared_locked' => $attempt_while_shared_locked,
								'attempt_while_unlocked' => $attempt_while_unlocked,
							]);
							$db->close();
						`
						);

						const [php1Result, php2Result] = await Promise.all([
							runScript(php1Script),
							runScript(php2Script),
						]);
						expect(php1Result.status).toBe(200);
						expect(php2Result.status).toBe(200);
						const parsed = php2Result.text
							? JSON.parse(php2Result.text)
							: {};
						expect(
							parsed.attempt_while_shared_locked
						).toMatchObject({
							lastErrorCode: 5,
							lastErrorMsg: 'database is locked',
						});
						expect(parsed.attempt_while_unlocked).toMatchObject({
							lastErrorCode: 0,
							lastErrorMsg: 'not an error',
						});
					},
					TEST_TIMEOUT
				);

				it(
					'can read from DB while another process has a shared lock',
					async () => {
						const dbFilePath = `${VFS_TEST_DIR}/${testId}-shared-read.db`;
						const coordinationFile =
							await createCoordinationFile('php1-locking');
						const stages = {
							php1WaitingForPhp2ToTry:
								'php1-waiting-for-php2-to-try',
							php2ReadyForUnlock: 'php2-ready-for-unlock',
							php1Unlocked: 'php1-unlocked',
						} as const;

						await seedSqliteDatabase(dbFilePath);

						const php1Script = await createScript(
							'sqlite-shared-reader-locker',
							`<?php
							$db = new SQLite3('${dbFilePath}');
							$db->exec('BEGIN;');
							$db->querySingle('SELECT COUNT(*) FROM test');

							file_put_contents('${coordinationFile}', '${stages.php1WaitingForPhp2ToTry}');
							while (file_get_contents('${coordinationFile}') !== '${stages.php2ReadyForUnlock}') {
								usleep(100 * 1000);
							}

							$db->exec('COMMIT;');
							$db->close();
							file_put_contents('${coordinationFile}', '${stages.php1Unlocked}');
						`
						);

						const php2Script = await createScript(
							'sqlite-shared-reader',
							`<?php
							ob_start();
							while (file_get_contents('${coordinationFile}') !== '${stages.php1WaitingForPhp2ToTry}') {
								usleep(100 * 1000);
							}

							$db = new SQLite3('${dbFilePath}');
							$result = $db->querySingle('SELECT COUNT(*) FROM test');
							$attempt_while_shared_locked = [
								'lastErrorCode' => $db->lastErrorCode(),
								'lastErrorMsg' => $db->lastErrorMsg(),
								'result' => $result,
							];

							file_put_contents('${coordinationFile}', '${stages.php2ReadyForUnlock}');
							while (file_get_contents('${coordinationFile}') !== '${stages.php1Unlocked}') {
								usleep(100 * 1000);
							}

							$result = $db->querySingle('SELECT COUNT(*) FROM test');
							$attempt_while_unlocked = [
								'lastErrorCode' => $db->lastErrorCode(),
								'lastErrorMsg' => $db->lastErrorMsg(),
								'result' => $result,
							];

							ob_clean();
							echo json_encode([
								'attempt_while_shared_locked' => $attempt_while_shared_locked,
								'attempt_while_unlocked' => $attempt_while_unlocked,
							]);
							$db->close();
						`
						);

						const [php1Result, php2Result] = await Promise.all([
							runScript(php1Script),
							runScript(php2Script),
						]);
						expect(php1Result.status).toBe(200);
						expect(php2Result.status).toBe(200);
						const parsed = php2Result.text
							? JSON.parse(php2Result.text)
							: {};
						expect(
							parsed.attempt_while_shared_locked
						).toMatchObject({
							lastErrorCode: 0,
							lastErrorMsg: 'not an error',
						});
						expect(parsed.attempt_while_unlocked).toMatchObject({
							lastErrorCode: 0,
							lastErrorMsg: 'not an error',
						});
					},
					TEST_TIMEOUT
				);

				it(
					'should release a shared lock when its associated process exits',
					async () => {
						const dbFilePath = `${VFS_TEST_DIR}/${testId}-shared-exit.db`;
						const coordinationFile =
							await createCoordinationFile('php1-locking');
						const stages = {
							php1Locked: 'php1-locked',
							php2ConfirmedDbLocked: 'php2-confirmed-db-locked',
							php1EndOfScript: 'php1-end-of-script',
						} as const;

						await seedSqliteDatabase(dbFilePath);

						const php1Script = await createScript(
							'sqlite-shared-locker-exit',
							`<?php
							$db = new SQLite3('${dbFilePath}');
							$db->exec('BEGIN;');
							$db->querySingle('SELECT COUNT(*) FROM test');

							file_put_contents('${coordinationFile}', '${stages.php1Locked}');
							while (file_get_contents('${coordinationFile}') !== '${stages.php2ConfirmedDbLocked}') {
								usleep(100 * 1000);
							}

							file_put_contents('${coordinationFile}', '${stages.php1EndOfScript}');
						`
						);

						const php2Script = await createScript(
							'sqlite-shared-writer-after-exit',
							`<?php
							ob_start();
							while (file_get_contents('${coordinationFile}') !== '${stages.php1Locked}') {
								usleep(100 * 1000);
							}

							$db = new SQLite3('${dbFilePath}');
							$db->exec('INSERT INTO test (name) VALUES ("test-locked")');
							$attempt_while_locked = [
								'lastErrorCode' => $db->lastErrorCode(),
								'lastErrorMsg' => $db->lastErrorMsg(),
							];

							file_put_contents('${coordinationFile}', '${stages.php2ConfirmedDbLocked}');
							while (file_get_contents('${coordinationFile}') !== '${stages.php1EndOfScript}') {
								usleep(100 * 1000);
							}

							$db->exec('INSERT INTO test (name) VALUES ("test-after-exit")');
							$attempt_after_exit = [
								'lastErrorCode' => $db->lastErrorCode(),
								'lastErrorMsg' => $db->lastErrorMsg(),
							];

							ob_clean();
							echo json_encode([
								'attempt_while_locked' => $attempt_while_locked,
								'attempt_after_exit' => $attempt_after_exit,
							]);
							$db->close();
						`
						);

						const [php1Result, php2Result] = await Promise.all([
							runScript(php1Script),
							runScript(php2Script),
						]);
						expect(php1Result.status).toBe(200);
						expect(php2Result.status).toBe(200);
						const parsed = php2Result.text
							? JSON.parse(php2Result.text)
							: {};
						expect(parsed.attempt_while_locked).toMatchObject({
							lastErrorCode: 5,
							lastErrorMsg: 'database is locked',
						});
						expect(parsed.attempt_after_exit).toMatchObject({
							lastErrorCode: 0,
							lastErrorMsg: 'not an error',
						});
					},
					TEST_TIMEOUT
				);

				it(
					'should release an exclusive lock when its associated process exits',
					async () => {
						const dbFilePath = `${VFS_TEST_DIR}/${testId}-exclusive-exit.db`;
						const coordinationFile =
							await createCoordinationFile('php1-locking');
						const stages = {
							php1Locked: 'php1-locked',
							php2ConfirmedDbLocked: 'php2-confirmed-db-locked',
							php1EndOfScript: 'php1-end-of-script',
						} as const;

						await seedSqliteDatabase(dbFilePath);

						const php1Script = await createScript(
							'sqlite-exclusive-locker-exit',
							`<?php
							$db = new SQLite3('${dbFilePath}');
							$db->exec('BEGIN EXCLUSIVE;');
							$db->exec('INSERT INTO test (name) VALUES ("test1")');

							file_put_contents('${coordinationFile}', '${stages.php1Locked}');
							while (file_get_contents('${coordinationFile}') !== '${stages.php2ConfirmedDbLocked}') {
								usleep(100 * 1000);
							}

							file_put_contents('${coordinationFile}', '${stages.php1EndOfScript}');
						`
						);

						const php2Script = await createScript(
							'sqlite-exclusive-writer-after-exit',
							`<?php
							ob_start();
							while (file_get_contents('${coordinationFile}') !== '${stages.php1Locked}') {
								usleep(100 * 1000);
							}

							$db = new SQLite3('${dbFilePath}');
							$db->exec('INSERT INTO test (name) VALUES ("test-locked")');
							$attempt_while_locked = [
								'lastErrorCode' => $db->lastErrorCode(),
								'lastErrorMsg' => $db->lastErrorMsg(),
							];

							file_put_contents('${coordinationFile}', '${stages.php2ConfirmedDbLocked}');
							while (file_get_contents('${coordinationFile}') !== '${stages.php1EndOfScript}') {
								usleep(100 * 1000);
							}

							$db->exec('INSERT INTO test (name) VALUES ("test-after-exit")');
							$attempt_after_exit = [
								'lastErrorCode' => $db->lastErrorCode(),
								'lastErrorMsg' => $db->lastErrorMsg(),
							];

							ob_clean();
							echo json_encode([
								'attempt_while_locked' => $attempt_while_locked,
								'attempt_after_exit' => $attempt_after_exit,
							]);
							$db->close();
						`
						);

						const [php1Result, php2Result] = await Promise.all([
							runScript(php1Script),
							runScript(php2Script),
						]);
						expect(php1Result.status).toBe(200);
						expect(php2Result.status).toBe(200);
						const parsed = php2Result.text
							? JSON.parse(php2Result.text)
							: {};
						expect(parsed.attempt_while_locked).toMatchObject({
							lastErrorCode: 5,
							lastErrorMsg: 'database is locked',
						});
						expect(parsed.attempt_after_exit).toMatchObject({
							lastErrorCode: 0,
							lastErrorMsg: 'not an error',
						});
					},
					TEST_TIMEOUT
				);

				it(
					'should release a lock when its database connection is closed',
					async () => {
						const dbFilePath = `${VFS_TEST_DIR}/${testId}-connection-closed.db`;
						const coordinationFile =
							await createCoordinationFile('php1-locking');
						const stages = {
							php1WaitingForPhp2ToTry:
								'php1-waiting-for-php2-to-try',
							php2ReadyForUnlock: 'php2-ready-for-unlock',
							php1ClosedDbConnection: 'php1-closed-db-connection',
						} as const;

						await seedSqliteDatabase(dbFilePath);

						const php1Script = await createScript(
							'sqlite-exclusive-close-connection',
							`<?php
							$db = new SQLite3('${dbFilePath}');
							$db->exec('BEGIN EXCLUSIVE;');
							$db->exec('INSERT INTO test (name) VALUES ("test1")');

							file_put_contents('${coordinationFile}', '${stages.php1WaitingForPhp2ToTry}');
							while (file_get_contents('${coordinationFile}') !== '${stages.php2ReadyForUnlock}') {
								usleep(100 * 1000);
							}

							$db->close();
							file_put_contents('${coordinationFile}', '${stages.php1ClosedDbConnection}');

							while (file_get_contents('${coordinationFile}') === '${stages.php1ClosedDbConnection}') {
								usleep(100 * 1000);
							}
						`
						);

						const php2Script = await createScript(
							'sqlite-exclusive-after-close',
							`<?php
							ob_start();
							while (file_get_contents('${coordinationFile}') !== '${stages.php1WaitingForPhp2ToTry}') {
								usleep(100 * 1000);
							}

							$db = new SQLite3('${dbFilePath}');
							$db->exec('INSERT INTO test (name) VALUES ("test-locked")');
							$attempt_while_locked = [
								'lastErrorCode' => $db->lastErrorCode(),
								'lastErrorMsg' => $db->lastErrorMsg(),
							];

							file_put_contents('${coordinationFile}', '${stages.php2ReadyForUnlock}');
							while (file_get_contents('${coordinationFile}') !== '${stages.php1ClosedDbConnection}') {
								usleep(100 * 1000);
							}

							$db->exec('INSERT INTO test (name) VALUES ("test-after-close")');
							$attempt_after_fd_closed = [
								'lastErrorCode' => $db->lastErrorCode(),
								'lastErrorMsg' => $db->lastErrorMsg(),
							];

							ob_clean();
							echo json_encode([
								'attempt_while_locked' => $attempt_while_locked,
								'attempt_after_fd_closed' => $attempt_after_fd_closed,
							]);
							$db->close();

							file_put_contents('${coordinationFile}', 'done');
						`
						);

						const [php1Result, php2Result] = await Promise.all([
							runScript(php1Script),
							runScript(php2Script),
						]);
						expect(php1Result.status).toBe(200);
						expect(php2Result.status).toBe(200);
						const parsed = php2Result.text
							? JSON.parse(php2Result.text)
							: {};
						expect(parsed.attempt_while_locked).toMatchObject({
							lastErrorCode: 5,
							lastErrorMsg: 'database is locked',
						});
						expect(parsed.attempt_after_fd_closed).toMatchObject({
							lastErrorCode: 0,
							lastErrorMsg: 'not an error',
						});
					},
					TEST_TIMEOUT
				);
			},
			TEST_TIMEOUT
		);

		describe('PHP flock()', () => {
			it(
				'should be able to acquire an exclusive lock on a file',
				async () => {
					const testFilePath = `${VFS_TEST_DIR}/${testId}-lock.txt`;
					const script = await createScript(
						'exclusive-lock',
						`<?php
						ob_start();
						$fp = fopen('${testFilePath}', 'w');
						$lockResult = flock($fp, LOCK_EX | LOCK_NB);
						fwrite($fp, 'test content');
						flock($fp, LOCK_UN);
						fclose($fp);

						ob_clean();
						echo json_encode([
							'lock_acquired' => $lockResult,
							'file_contents' => file_get_contents('${testFilePath}')
						]);
						`
					);

					const result = await runScriptAndParseJson(script);
					expect(result.lock_acquired).toBe(true);
					expect(result.file_contents).toBe('test content');
				},
				TEST_TIMEOUT
			);

			it(
				'should be able to acquire a shared lock on a file',
				async () => {
					const testFilePath = `${VFS_TEST_DIR}/${testId}-shared.txt`;
					await writeFile(testFilePath, 'test content');
					const script = await createScript(
						'shared-lock',
						`<?php
						ob_start();
						$fp = fopen('${testFilePath}', 'r+');
						$lockResult = flock($fp, LOCK_SH | LOCK_NB);
						fseek($fp, 0);
						$file_contents = fread($fp, 1024);
						flock($fp, LOCK_UN);
						fclose($fp);

						ob_clean();
						echo json_encode([
							'lock_acquired' => $lockResult,
							'file_contents' => $file_contents,
						]);
						`
					);

					const result = await runScriptAndParseJson(script);
					expect(result.lock_acquired).toBe(true);
					expect(result.file_contents).toBe('test content');
				},
				TEST_TIMEOUT
			);

			it(
				'should deny an exclusive lock when another process has a shared lock on a file',
				async () => {
					const testFilePath = `${VFS_TEST_DIR}/${testId}-shared-exclusive.txt`;
					await writeFile(testFilePath, 'test content');
					const coordinationFile =
						await createCoordinationFile('php1-locking');
					const stages = {
						php1WaitingForPhp2ToTry: 'php1-waiting-for-php2-to-try',
						php2ReadyForUnlock: 'php2-ready-for-unlock',
						php1Unlocked: 'php1-unlocked',
					} as const;

					const php1Script = await createScript(
						'shared-lock-holder',
						`<?php
						$fp = fopen('${testFilePath}', 'r+');
						flock($fp, LOCK_SH | LOCK_NB);

						file_put_contents('${coordinationFile}', '${stages.php1WaitingForPhp2ToTry}');
						while (file_get_contents('${coordinationFile}') !== '${stages.php2ReadyForUnlock}') {
							usleep(100 * 1000);
						}

						flock($fp, LOCK_UN);
						fclose($fp);
						file_put_contents('${coordinationFile}', '${stages.php1Unlocked}');
						`
					);

					const php2Script = await createScript(
						'exclusive-contender',
						`<?php
						ob_start();
						while (file_get_contents('${coordinationFile}') !== '${stages.php1WaitingForPhp2ToTry}') {
							usleep(100 * 1000);
						}

						$fp = fopen('${testFilePath}', 'r+');
						$lockResult = flock($fp, LOCK_EX | LOCK_NB);
						$attempt_while_shared_locked = [
							'lock_acquired' => $lockResult,
						];
						if ($lockResult) {
							flock($fp, LOCK_UN);
						}
						fclose($fp);

						file_put_contents('${coordinationFile}', '${stages.php2ReadyForUnlock}');
						while (file_get_contents('${coordinationFile}') !== '${stages.php1Unlocked}') {
							usleep(100 * 1000);
						}

						$fp = fopen('${testFilePath}', 'r+');
						$lockResult = flock($fp, LOCK_EX | LOCK_NB);
						$attempt_while_unlocked = [
							'lock_acquired' => $lockResult,
						];
						if ($lockResult) {
							flock($fp, LOCK_UN);
						}
						fclose($fp);

						ob_clean();
						echo json_encode([
							'attempt_while_shared_locked' => $attempt_while_shared_locked,
							'attempt_while_unlocked' => $attempt_while_unlocked,
						]);
						`
					);

					const [sharedResult, contenderResult] = await Promise.all([
						runScript(php1Script),
						runScript(php2Script),
					]);
					expect(sharedResult.status).toBe(200);
					expect(contenderResult.status).toBe(200);
					const parsed = contenderResult.text
						? JSON.parse(contenderResult.text)
						: {};
					expect(
						parsed.attempt_while_shared_locked.lock_acquired
					).toBe(false);
					expect(parsed.attempt_while_unlocked.lock_acquired).toBe(
						true
					);
				},
				TEST_TIMEOUT
			);

			it(
				'should deny a shared lock when another process has an exclusive lock on a file',
				async () => {
					const testFilePath = `${VFS_TEST_DIR}/${testId}-exclusive-shared.txt`;
					await writeFile(testFilePath, 'test content');
					const coordinationFile =
						await createCoordinationFile('php1-locking');
					const stages = {
						php1WaitingForPhp2ToTry: 'php1-waiting-for-php2-to-try',
						php2ReadyForUnlock: 'php2-ready-for-unlock',
						php1Unlocked: 'php1-unlocked',
					} as const;

					const php1Script = await createScript(
						'exclusive-lock-holder',
						`<?php
						$fp = fopen('${testFilePath}', 'r+');
						flock($fp, LOCK_EX | LOCK_NB);

						file_put_contents('${coordinationFile}', '${stages.php1WaitingForPhp2ToTry}');
						while (file_get_contents('${coordinationFile}') !== '${stages.php2ReadyForUnlock}') {
							usleep(100 * 1000);
						}

						flock($fp, LOCK_UN);
						fclose($fp);
						file_put_contents('${coordinationFile}', '${stages.php1Unlocked}');
						`
					);

					const php2Script = await createScript(
						'shared-contender',
						`<?php
						ob_start();
						while (file_get_contents('${coordinationFile}') !== '${stages.php1WaitingForPhp2ToTry}') {
							usleep(100 * 1000);
						}

						$fp = fopen('${testFilePath}', 'r+');
						$lockResult = flock($fp, LOCK_SH | LOCK_NB);
						$attempt_while_exclusive_locked = [
							'lock_acquired' => $lockResult,
						];
						if ($lockResult) {
							flock($fp, LOCK_UN);
						}
						fclose($fp);

						file_put_contents('${coordinationFile}', '${stages.php2ReadyForUnlock}');
						while (file_get_contents('${coordinationFile}') !== '${stages.php1Unlocked}') {
							usleep(100 * 1000);
						}

						$fp = fopen('${testFilePath}', 'r+');
						$lockResult = flock($fp, LOCK_SH | LOCK_NB);
						$attempt_while_unlocked = [
							'lock_acquired' => $lockResult,
						];
						if ($lockResult) {
							flock($fp, LOCK_UN);
						}
						fclose($fp);

						ob_clean();
						echo json_encode([
							'attempt_while_exclusive_locked' => $attempt_while_exclusive_locked,
							'attempt_while_unlocked' => $attempt_while_unlocked,
						]);
						`
					);

					const [exclusiveResult, sharedResult] = await Promise.all([
						runScript(php1Script),
						runScript(php2Script),
					]);
					expect(exclusiveResult.status).toBe(200);
					expect(sharedResult.status).toBe(200);
					const parsed = sharedResult.text
						? JSON.parse(sharedResult.text)
						: {};
					expect(
						parsed.attempt_while_exclusive_locked.lock_acquired
					).toBe(false);
					expect(parsed.attempt_while_unlocked.lock_acquired).toBe(
						true
					);
				},
				TEST_TIMEOUT
			);

			it(
				'should grant multiple shared locks on a file',
				async () => {
					const testFilePath = `${VFS_TEST_DIR}/${testId}-multi-shared.txt`;
					await writeFile(testFilePath, 'test content');
					const coordinationFile =
						await createCoordinationFile('php1-locking');
					const stages = {
						php1Locked: 'php1-locked',
						php2Locked: 'php2-locked',
						php3CanUnlock: 'php3-can-unlock',
					} as const;

					const php1Script = await createScript(
						'shared-locker-one',
						`<?php
						ob_start();
						$fp = fopen('${testFilePath}', 'r+');
						$lockResult = flock($fp, LOCK_SH | LOCK_NB);
						file_put_contents('${coordinationFile}', '${stages.php1Locked}');
						while (file_get_contents('${coordinationFile}') !== '${stages.php3CanUnlock}') {
							usleep(100 * 1000);
						}
						flock($fp, LOCK_UN);
						fclose($fp);
						ob_clean();
						echo json_encode(['lock_acquired' => $lockResult]);
						`
					);

					const php2Script = await createScript(
						'shared-locker-two',
						`<?php
						ob_start();
						while (file_get_contents('${coordinationFile}') !== '${stages.php1Locked}') {
							usleep(100 * 1000);
						}
						$fp = fopen('${testFilePath}', 'r+');
						$lockResult = flock($fp, LOCK_SH | LOCK_NB);
						file_put_contents('${coordinationFile}', '${stages.php2Locked}');
						while (file_get_contents('${coordinationFile}') !== '${stages.php3CanUnlock}') {
							usleep(100 * 1000);
						}
						if ($lockResult) {
							flock($fp, LOCK_UN);
						}
						fclose($fp);
						ob_clean();
						echo json_encode(['lock_acquired' => $lockResult]);
						`
					);

					const php3Script = await createScript(
						'shared-locker-three',
						`<?php
						ob_start();
						while (file_get_contents('${coordinationFile}') !== '${stages.php2Locked}') {
							usleep(100 * 1000);
						}
						$fp = fopen('${testFilePath}', 'r+');
						$lockResult = flock($fp, LOCK_SH | LOCK_NB);
						file_put_contents('${coordinationFile}', '${stages.php3CanUnlock}');
						if ($lockResult) {
							flock($fp, LOCK_UN);
						}
						fclose($fp);
						ob_clean();
						echo json_encode(['lock_acquired' => $lockResult]);
						`
					);

					const [first, second, third] = await Promise.all([
						runScript(php1Script),
						runScript(php2Script),
						runScript(php3Script),
					]);
					expect(first.status).toBe(200);
					expect(second.status).toBe(200);
					expect(third.status).toBe(200);
					expect(JSON.parse(first.text).lock_acquired).toBe(true);
					expect(JSON.parse(second.text).lock_acquired).toBe(true);
					expect(JSON.parse(third.text).lock_acquired).toBe(true);
				},
				TEST_TIMEOUT
			);

			it(
				'should release a shared lock when its associated file descriptor is closed',
				async () => {
					const testFilePath = `${VFS_TEST_DIR}/${testId}-shared-close.txt`;
					await writeFile(testFilePath, 'test content');
					const coordinationFile =
						await createCoordinationFile('php1-locking');
					const stages = {
						php1WaitingForPhp2ToTry: 'php1-waiting-for-php2-to-try',
						php2ReadyForUnlock: 'php2-ready-for-unlock',
						php1Unlocked: 'php1-unlocked',
					} as const;

					const php1Script = await createScript(
						'shared-locker-close',
						`<?php
						$fp = fopen('${testFilePath}', 'r+');
						flock($fp, LOCK_SH | LOCK_NB);

						file_put_contents('${coordinationFile}', '${stages.php1WaitingForPhp2ToTry}');
						while (file_get_contents('${coordinationFile}') !== '${stages.php2ReadyForUnlock}') {
							usleep(100 * 1000);
						}

						fclose($fp);
						file_put_contents('${coordinationFile}', '${stages.php1Unlocked}');

						while (file_get_contents('${coordinationFile}') === '${stages.php1Unlocked}') {
							usleep(100 * 1000);
						}
						`
					);

					const php2Script = await createScript(
						'exclusive-after-shared-close',
						`<?php
						ob_start();
						while (file_get_contents('${coordinationFile}') !== '${stages.php1WaitingForPhp2ToTry}') {
							usleep(100 * 1000);
						}

						$fp = fopen('${testFilePath}', 'r+');
						$lockResult = flock($fp, LOCK_EX | LOCK_NB);
						$attempt_while_locked = [
							'lock_acquired' => $lockResult,
						];
						if ($lockResult) {
							flock($fp, LOCK_UN);
						}
						fclose($fp);

						file_put_contents('${coordinationFile}', '${stages.php2ReadyForUnlock}');
						while (file_get_contents('${coordinationFile}') !== '${stages.php1Unlocked}') {
							usleep(100 * 1000);
						}

						$fp = fopen('${testFilePath}', 'r+');
						$lockResult = flock($fp, LOCK_EX | LOCK_NB);
						$attempt_after_fd_closed = [
							'lock_acquired' => $lockResult,
						];
						if ($lockResult) {
							flock($fp, LOCK_UN);
						}
						fclose($fp);

						ob_clean();
						echo json_encode([
							'attempt_while_locked' => $attempt_while_locked,
							'attempt_after_fd_closed' => $attempt_after_fd_closed,
						]);
						file_put_contents('${coordinationFile}', 'done');
						`
					);

					const [sharedResult, exclusiveResult] = await Promise.all([
						runScript(php1Script),
						runScript(php2Script),
					]);
					expect(sharedResult.status).toBe(200);
					expect(exclusiveResult.status).toBe(200);
					const parsed = exclusiveResult.text
						? JSON.parse(exclusiveResult.text)
						: {};
					expect(parsed.attempt_while_locked.lock_acquired).toBe(
						false
					);
					expect(parsed.attempt_after_fd_closed.lock_acquired).toBe(
						true
					);
				},
				TEST_TIMEOUT
			);

			it(
				'should release an exclusive lock when its associated file descriptor is closed',
				async () => {
					const testFilePath = `${VFS_TEST_DIR}/${testId}-exclusive-close.txt`;
					await writeFile(testFilePath, 'test content');
					const coordinationFile =
						await createCoordinationFile('php1-locking');
					const stages = {
						php1WaitingForPhp2ToTry: 'php1-waiting-for-php2-to-try',
						php2ReadyForUnlock: 'php2-ready-for-unlock',
						php1Unlocked: 'php1-unlocked',
					} as const;

					const php1Script = await createScript(
						'exclusive-locker-close',
						`<?php
						$fp = fopen('${testFilePath}', 'r+');
						flock($fp, LOCK_EX | LOCK_NB);

						file_put_contents('${coordinationFile}', '${stages.php1WaitingForPhp2ToTry}');
						while (file_get_contents('${coordinationFile}') !== '${stages.php2ReadyForUnlock}') {
							usleep(100 * 1000);
						}

						fclose($fp);
						file_put_contents('${coordinationFile}', '${stages.php1Unlocked}');

						while (file_get_contents('${coordinationFile}') === '${stages.php1Unlocked}') {
							usleep(100 * 1000);
						}
						`
					);

					const php2Script = await createScript(
						'shared-after-exclusive-close',
						`<?php
						ob_start();
						while (file_get_contents('${coordinationFile}') !== '${stages.php1WaitingForPhp2ToTry}') {
							usleep(100 * 1000);
						}

						$fp = fopen('${testFilePath}', 'r+');
						$lockResult = flock($fp, LOCK_SH | LOCK_NB);
						$attempt_while_locked = [
							'lock_acquired' => $lockResult,
						];
						if ($lockResult) {
							flock($fp, LOCK_UN);
						}
						fclose($fp);

						file_put_contents('${coordinationFile}', '${stages.php2ReadyForUnlock}');
						while (file_get_contents('${coordinationFile}') !== '${stages.php1Unlocked}') {
							usleep(100 * 1000);
						}

						$fp = fopen('${testFilePath}', 'r+');
						$lockResult = flock($fp, LOCK_SH | LOCK_NB);
						$attempt_after_fd_closed = [
							'lock_acquired' => $lockResult,
						];
						if ($lockResult) {
							flock($fp, LOCK_UN);
						}
						fclose($fp);

						ob_clean();
						echo json_encode([
							'attempt_while_locked' => $attempt_while_locked,
							'attempt_after_fd_closed' => $attempt_after_fd_closed,
						]);
						file_put_contents('${coordinationFile}', 'done');
						`
					);

					const [exclusiveResult, sharedResult] = await Promise.all([
						runScript(php1Script),
						runScript(php2Script),
					]);
					expect(exclusiveResult.status).toBe(200);
					expect(sharedResult.status).toBe(200);
					const parsed = sharedResult.text
						? JSON.parse(sharedResult.text)
						: {};
					expect(parsed.attempt_while_locked.lock_acquired).toBe(
						false
					);
					expect(parsed.attempt_after_fd_closed.lock_acquired).toBe(
						true
					);
				},
				TEST_TIMEOUT
			);

			it(
				'should release a shared lock when the owning process exits',
				async () => {
					const testFilePath = `${VFS_TEST_DIR}/${testId}-shared-exit-file.txt`;
					await writeFile(testFilePath, 'test content');
					const coordinationFile =
						await createCoordinationFile('php1-locking');
					const stages = {
						php1Locked: 'php1-locked',
						php2ConfirmedFileLocked: 'php2-confirmed-file-locked',
						php1EndOfScript: 'php1-end-of-script',
					} as const;

					const php1Script = await createScript(
						'shared-locker-process-exit',
						`<?php
						$fp = fopen('${testFilePath}', 'r+');
						flock($fp, LOCK_SH | LOCK_NB);
						file_put_contents('${coordinationFile}', '${stages.php1Locked}');
						while (file_get_contents('${coordinationFile}') !== '${stages.php2ConfirmedFileLocked}') {
							usleep(100 * 1000);
						}
						file_put_contents('${coordinationFile}', '${stages.php1EndOfScript}');
						`
					);

					const php2Script = await createScript(
						'exclusive-after-shared-exit',
						`<?php
						ob_start();
						while (file_get_contents('${coordinationFile}') !== '${stages.php1Locked}') {
							usleep(100 * 1000);
						}

						$fp = fopen('${testFilePath}', 'r+');
						$lockResult = flock($fp, LOCK_EX | LOCK_NB);
						$attempt_while_locked = $lockResult;

						file_put_contents('${coordinationFile}', '${stages.php2ConfirmedFileLocked}');
						while (file_get_contents('${coordinationFile}') !== '${stages.php1EndOfScript}') {
							usleep(100 * 1000);
						}

						$lockResult = flock($fp, LOCK_EX | LOCK_NB);
						$attempt_after_exit = $lockResult;
						ob_clean();
						echo json_encode([
							'attempt_while_locked' => $attempt_while_locked,
							'attempt_after_exit' => $attempt_after_exit,
						]);
						fclose($fp);
						`
					);

					const [sharedResult, exclusiveResult] = await Promise.all([
						runScript(php1Script),
						runScript(php2Script),
					]);
					expect(sharedResult.status).toBe(200);
					expect(exclusiveResult.status).toBe(200);
					const parsed = exclusiveResult.text
						? JSON.parse(exclusiveResult.text)
						: {};
					expect(parsed.attempt_while_locked).toBe(false);
					expect(parsed.attempt_after_exit).toBe(true);
				},
				TEST_TIMEOUT
			);

			it(
				'should release an exclusive lock when the owning process exits',
				async () => {
					const testFilePath = `${VFS_TEST_DIR}/${testId}-exclusive-exit-file.txt`;
					await writeFile(testFilePath, 'test content');
					const coordinationFile =
						await createCoordinationFile('php1-locking');
					const stages = {
						php1Locked: 'php1-locked',
						php2ConfirmedFileLocked: 'php2-confirmed-file-locked',
						php1EndOfScript: 'php1-end-of-script',
					} as const;

					const php1Script = await createScript(
						'exclusive-locker-process-exit',
						`<?php
						$fp = fopen('${testFilePath}', 'r+');
						flock($fp, LOCK_EX | LOCK_NB);
						file_put_contents('${coordinationFile}', '${stages.php1Locked}');
						while (file_get_contents('${coordinationFile}') !== '${stages.php2ConfirmedFileLocked}') {
							usleep(100 * 1000);
						}
						file_put_contents('${coordinationFile}', '${stages.php1EndOfScript}');
						`
					);

					const php2Script = await createScript(
						'shared-after-exclusive-exit',
						`<?php
						ob_start();
						while (file_get_contents('${coordinationFile}') !== '${stages.php1Locked}') {
							usleep(100 * 1000);
						}

						$fp = fopen('${testFilePath}', 'r+');
						$lockResult = flock($fp, LOCK_SH | LOCK_NB);
						$attempt_while_locked = $lockResult;

						file_put_contents('${coordinationFile}', '${stages.php2ConfirmedFileLocked}');
						while (file_get_contents('${coordinationFile}') !== '${stages.php1EndOfScript}') {
							usleep(100 * 1000);
						}

						$lockResult = flock($fp, LOCK_SH | LOCK_NB);
						$attempt_after_exit = $lockResult;
						ob_clean();
						echo json_encode([
							'attempt_while_locked' => $attempt_while_locked,
							'attempt_after_exit' => $attempt_after_exit,
						]);
						fclose($fp);
						`
					);

					const [exclusiveResult, sharedResult] = await Promise.all([
						runScript(php1Script),
						runScript(php2Script),
					]);
					expect(exclusiveResult.status).toBe(200);
					expect(sharedResult.status).toBe(200);
					const parsed = sharedResult.text
						? JSON.parse(sharedResult.text)
						: {};
					expect(parsed.attempt_while_locked).toBe(false);
					expect(parsed.attempt_after_exit).toBe(true);
				},
				TEST_TIMEOUT
			);
		});
	},
	TEST_TIMEOUT
);
