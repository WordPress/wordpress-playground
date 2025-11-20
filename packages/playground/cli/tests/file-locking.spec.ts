import { randomUUID } from 'node:crypto';
import { runCLI } from '../src/run-cli';
import type { RunCLIServer } from '../src/run-cli';
import { mkdtempSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const TEST_DIR = '/test';
const SCRIPT_RUNNER_HTTP_PATH = '/__cli-file-locking/script-runner.php';
const SCRIPT_RUNNER_VFS_PATH = `/wordpress${SCRIPT_RUNNER_HTTP_PATH}`;
const SCRIPT_RUNNER_DIR = '/wordpress/__cli-file-locking';
const TEST_TIMEOUT = 120_000;

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
$scriptPath = '${TEST_DIR}/' . $script . '.php';
if (!file_exists($scriptPath)) {
	http_response_code(404);
	echo 'Script not found';
	return;
}
require $scriptPath;
`;

describe('Playground CLI file locking', () => {
	let cliServer: RunCLIServer;
	let nativeTestDir: string;

	beforeAll(async () => {
		nativeTestDir = mkdtempSync(
			path.join(os.tmpdir(), 'playground-cli-file-locking-test-')
		);

		cliServer = await runCLI({
			command: 'server',
			mount: [
				{
					hostPath: nativeTestDir,
					vfsPath: TEST_DIR,
				},
			],
		});
		await prepareScriptRunner();
	}, TEST_TIMEOUT);

	afterAll(async () => {
		if (cliServer) {
			await cliServer[Symbol.asyncDispose]();
		}
	});

	async function prepareScriptRunner() {
		await ensureDir(TEST_DIR);
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

	function scriptUrl(scriptName: string) {
		const url = new URL(SCRIPT_RUNNER_HTTP_PATH, cliServer.serverUrl);
		url.searchParams.set('script', scriptName);
		return url;
	}

	async function seedSqliteDatabase(dbFilePath: string) {
		const seedScript = `${randomUUID()}-seed`;
		await cliServer.playground.writeFile(
			`${TEST_DIR}/${seedScript}.php`,
			`<?php
			ob_start();
			$db = new SQLite3('${dbFilePath}');
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
		const seedResponse = await fetch(scriptUrl(seedScript));
		expect(seedResponse.status).toBe(200);
		expect((await seedResponse.text()).trim()).toBe('ok');
	}

	describe('SQLite DB locking (relying upon fcntl())', () => {
		it(
			'cannot write to DB while another process has an exclusive lock',
			async () => {
				const testId = randomUUID();
				const dbFilePath = `${TEST_DIR}/${testId}-exclusive.db`;
				const coordinationFile = `${TEST_DIR}/${testId}-coordination.txt`;
				await cliServer.playground.writeFile(
					coordinationFile,
					'php1-locking'
				);

				await seedSqliteDatabase(dbFilePath);

				const php1Script = `${testId}-exclusive-locker`;
				await cliServer.playground.writeFile(
					`${TEST_DIR}/${php1Script}.php`,
					`<?php
					$db = new SQLite3('${dbFilePath}');
					$db->exec('BEGIN EXCLUSIVE;');

					file_put_contents('${coordinationFile}', 'php1-locked');
					while (file_get_contents('${coordinationFile}') !== 'php2-ready-for-unlock') {
						usleep(100 * 1000);
					}

					$db->exec('INSERT INTO test (name) VALUES ("test1")');
					$db->exec('COMMIT;');
					$db->close();
					file_put_contents('${coordinationFile}', 'php1-unlocked');
					`
				);

				const php2Script = `${testId}-exclusive-contender`;
				await cliServer.playground.writeFile(
					`${TEST_DIR}/${php2Script}.php`,
					`<?php
				ob_start();
				while (file_get_contents('${coordinationFile}') !== 'php1-locked') {
					usleep(100 * 1000);
				}

					$db = new SQLite3('${dbFilePath}');
					$db->exec('INSERT INTO test (name) VALUES ("test-while-locked")');
					$attempt_while_exclusively_locked = [
						'lastErrorCode' => $db->lastErrorCode(),
						'lastErrorMsg' => $db->lastErrorMsg(),
					];

					file_put_contents('${coordinationFile}', 'php2-ready-for-unlock');
					while (file_get_contents('${coordinationFile}') !== 'php1-unlocked') {
						usleep(100 * 1000);
					}

					$db->exec('INSERT INTO test (name) VALUES ("test-while-unlocked")');
					$attempt_while_unlocked = [
						'lastErrorCode' => $db->lastErrorCode(),
						'lastErrorMsg' => $db->lastErrorMsg(),
					];

					ob_clean();
					echo json_encode([
						'attempt_while_exclusively_locked' => $attempt_while_exclusively_locked,
						'attempt_while_unlocked' => $attempt_while_unlocked,
					]);
					$db->close();
					`
				);

				const [php1Response, php2Response] = await Promise.all([
					fetch(scriptUrl(php1Script)),
					fetch(scriptUrl(php2Script)),
				]);
				expect(php1Response.status).toBe(200);
				expect(php2Response.status).toBe(200);
				const php2Text = await php2Response.text();
				const parsed = php2Text ? JSON.parse(php2Text) : {};
				expect(parsed.attempt_while_exclusively_locked).toMatchObject({
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
			'cannot read from DB while another process has an exclusive lock',
			async () => {
				const testId = randomUUID();
				const dbFilePath = `${TEST_DIR}/${testId}-exclusive-read.db`;
				const coordinationFile = `${TEST_DIR}/${testId}-coordination.txt`;
				const stages = {
					initial: 'php1-locking',
					waitingForPhp2: 'php1-waiting-for-php2-to-try',
					php2Ready: 'php2-ready-for-unlock',
					php1Unlocked: 'php1-unlocked',
				} as const;
				await cliServer.playground.writeFile(
					coordinationFile,
					stages.initial
				);

				await seedSqliteDatabase(dbFilePath);

				const php1Script = `${testId}-exclusive-reader-locker`;
				await cliServer.playground.writeFile(
					`${TEST_DIR}/${php1Script}.php`,
					`<?php
					$db = new SQLite3('${dbFilePath}');
					$db->exec('BEGIN EXCLUSIVE;');
					$db->exec('INSERT INTO test (name) VALUES ("test1")');

					file_put_contents('${coordinationFile}', '${stages.waitingForPhp2}');
					while (file_get_contents('${coordinationFile}') !== '${stages.php2Ready}') {
						usleep(100 * 1000);
					}

					$db->exec('COMMIT;');
					$db->close();
					file_put_contents('${coordinationFile}', '${stages.php1Unlocked}');
					`
				);

				const php2Script = `${testId}-exclusive-reader`;
				await cliServer.playground.writeFile(
					`${TEST_DIR}/${php2Script}.php`,
					`<?php
				ob_start();
				while (file_get_contents('${coordinationFile}') !== '${stages.waitingForPhp2}') {
					usleep(100 * 1000);
				}

					$db = new SQLite3('${dbFilePath}');
					$db->querySingle('SELECT COUNT(*) FROM test');
					$attempt_while_exclusively_locked = [
						'lastErrorCode' => $db->lastErrorCode(),
						'lastErrorMsg' => $db->lastErrorMsg(),
					];

					file_put_contents('${coordinationFile}', '${stages.php2Ready}');
					while (file_get_contents('${coordinationFile}') !== '${stages.php1Unlocked}') {
						usleep(100 * 1000);
					}

					$db->querySingle('SELECT COUNT(*) FROM test');
					$attempt_while_unlocked = [
						'lastErrorCode' => $db->lastErrorCode(),
						'lastErrorMsg' => $db->lastErrorMsg(),
					];

					ob_clean();
					echo json_encode([
						'attempt_while_exclusively_locked' => $attempt_while_exclusively_locked,
						'attempt_while_unlocked' => $attempt_while_unlocked,
					]);
					$db->close();
					`
				);

				const [php1Response, php2Response] = await Promise.all([
					fetch(scriptUrl(php1Script)),
					fetch(scriptUrl(php2Script)),
				]);
				expect(php1Response.status).toBe(200);
				expect(php2Response.status).toBe(200);
				const php2Text = await php2Response.text();
				const parsed = php2Text ? JSON.parse(php2Text) : {};
				expect(parsed.attempt_while_exclusively_locked).toMatchObject({
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
				const testId = randomUUID();
				const dbFilePath = `${TEST_DIR}/${testId}-shared-write.db`;
				const coordinationFile = `${TEST_DIR}/${testId}-coordination.txt`;
				const stages = {
					initial: 'php1-locking',
					waitingForPhp2: 'php1-waiting-for-php2-to-try',
					php2Ready: 'php2-ready-for-unlock',
					php1Unlocked: 'php1-unlocked',
				} as const;
				await cliServer.playground.writeFile(
					coordinationFile,
					stages.initial
				);

				await seedSqliteDatabase(dbFilePath);

				const php1Script = `${testId}-shared-locker`;
				await cliServer.playground.writeFile(
					`${TEST_DIR}/${php1Script}.php`,
					`<?php
					$db = new SQLite3('${dbFilePath}');
					$db->exec('BEGIN;');
					$db->querySingle('SELECT COUNT(*) FROM test');

					file_put_contents('${coordinationFile}', '${stages.waitingForPhp2}');
					while (file_get_contents('${coordinationFile}') !== '${stages.php2Ready}') {
						usleep(100 * 1000);
					}

					$db->exec('COMMIT;');
					$db->close();
					file_put_contents('${coordinationFile}', '${stages.php1Unlocked}');
					`
				);

				const php2Script = `${testId}-shared-writer`;
				await cliServer.playground.writeFile(
					`${TEST_DIR}/${php2Script}.php`,
					`<?php
				ob_start();
				while (file_get_contents('${coordinationFile}') !== '${stages.waitingForPhp2}') {
					usleep(100 * 1000);
				}

					$db = new SQLite3('${dbFilePath}');
					$db->exec('INSERT INTO test (name) VALUES ("test-while-shared-locked")');
					$attempt_while_shared_locked = [
						'lastErrorCode' => $db->lastErrorCode(),
						'lastErrorMsg' => $db->lastErrorMsg(),
					];

					file_put_contents('${coordinationFile}', '${stages.php2Ready}');
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

				const [php1Response, php2Response] = await Promise.all([
					fetch(scriptUrl(php1Script)),
					fetch(scriptUrl(php2Script)),
				]);
				expect(php1Response.status).toBe(200);
				expect(php2Response.status).toBe(200);
				const php2Text = await php2Response.text();
				const parsed = php2Text ? JSON.parse(php2Text) : {};
				expect(parsed.attempt_while_shared_locked).toMatchObject({
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
				const testId = randomUUID();
				const dbFilePath = `${TEST_DIR}/${testId}-shared-read.db`;
				const coordinationFile = `${TEST_DIR}/${testId}-coordination.txt`;
				const stages = {
					initial: 'php1-locking',
					waitingForPhp2: 'php1-waiting-for-php2-to-try',
					php2Ready: 'php2-ready-for-unlock',
					php1Unlocked: 'php1-unlocked',
				} as const;
				await cliServer.playground.writeFile(
					coordinationFile,
					stages.initial
				);

				await seedSqliteDatabase(dbFilePath);

				const php1Script = `${testId}-shared-reader-locker`;
				await cliServer.playground.writeFile(
					`${TEST_DIR}/${php1Script}.php`,
					`<?php
					$db = new SQLite3('${dbFilePath}');
					$db->exec('BEGIN;');
					$db->querySingle('SELECT COUNT(*) FROM test');

					file_put_contents('${coordinationFile}', '${stages.waitingForPhp2}');
					while (file_get_contents('${coordinationFile}') !== '${stages.php2Ready}') {
						usleep(100 * 1000);
					}

					$db->exec('COMMIT;');
					$db->close();
					file_put_contents('${coordinationFile}', '${stages.php1Unlocked}');
					`
				);

				const php2Script = `${testId}-shared-reader`;
				await cliServer.playground.writeFile(
					`${TEST_DIR}/${php2Script}.php`,
					`<?php
				ob_start();
				while (file_get_contents('${coordinationFile}') !== '${stages.waitingForPhp2}') {
					usleep(100 * 1000);
				}

					$db = new SQLite3('${dbFilePath}');
					$result = $db->querySingle('SELECT COUNT(*) FROM test');
					$attempt_while_shared_locked = [
						'lastErrorCode' => $db->lastErrorCode(),
						'lastErrorMsg' => $db->lastErrorMsg(),
						'result' => $result,
					];

					file_put_contents('${coordinationFile}', '${stages.php2Ready}');
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

				const [php1Response, php2Response] = await Promise.all([
					fetch(scriptUrl(php1Script)),
					fetch(scriptUrl(php2Script)),
				]);
				expect(php1Response.status).toBe(200);
				expect(php2Response.status).toBe(200);
				const php2Text = await php2Response.text();
				const parsed = php2Text ? JSON.parse(php2Text) : {};
				expect(parsed.attempt_while_shared_locked).toMatchObject({
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
				const testId = randomUUID();
				const dbFilePath = `${TEST_DIR}/${testId}-shared-exit.db`;
				const coordinationFile = `${TEST_DIR}/${testId}-coordination.txt`;
				const stages = {
					initial: 'php1-locking',
					php1Locked: 'php1-locked',
					php2Confirmed: 'php2-confirmed-db-locked',
					php1End: 'php1-end-of-script',
				} as const;
				await cliServer.playground.writeFile(
					coordinationFile,
					stages.initial
				);

				await seedSqliteDatabase(dbFilePath);

				const php1Script = `${testId}-shared-exit-locker`;
				await cliServer.playground.writeFile(
					`${TEST_DIR}/${php1Script}.php`,
					`<?php
					$db = new SQLite3('${dbFilePath}');
					$db->exec('BEGIN;');
					$db->querySingle('SELECT COUNT(*) FROM test');

					file_put_contents('${coordinationFile}', '${stages.php1Locked}');
					while (file_get_contents('${coordinationFile}') !== '${stages.php2Confirmed}') {
						usleep(100 * 1000);
					}

					// Intentionally keep the database connection open until the process exits.
					`
				);

				const php2Script = `${testId}-shared-exit-writer`;
				await cliServer.playground.writeFile(
					`${TEST_DIR}/${php2Script}.php`,
					`<?php
				ob_start();
				while (file_get_contents('${coordinationFile}') !== '${stages.php1Locked}') {
					usleep(100 * 1000);
				}

					$db = new SQLite3('${dbFilePath}');
					$db->exec('INSERT INTO test (name) VALUES ("test-after-termination")');
					$attempt_while_locked = [
						'lastErrorCode' => $db->lastErrorCode(),
						'lastErrorMsg' => $db->lastErrorMsg(),
					];

					file_put_contents('${coordinationFile}', '${stages.php2Confirmed}');
					while (file_get_contents('${coordinationFile}') !== '${stages.php1End}') {
						usleep(100 * 1000);
					}

					$db->exec('INSERT INTO test (name) VALUES ("test-after-termination")');
					$attempt_after_exit = [
						'lastErrorCode' => $db->lastErrorCode(),
						'lastErrorMsg' => $db->lastErrorMsg(),
					];

					$db->close();
					ob_clean();
					echo json_encode([
						'attempt_while_locked' => $attempt_while_locked,
						'attempt_after_exit' => $attempt_after_exit,
					]);
					`
				);

				const php1ResponsePromise = fetch(scriptUrl(php1Script));
				const php2ResponsePromise = fetch(scriptUrl(php2Script));

				const php1Response = await php1ResponsePromise;
				expect(php1Response.status).toBe(200);
				await cliServer.playground.writeFile(
					coordinationFile,
					stages.php1End
				);

				const php2Response = await php2ResponsePromise;
				expect(php2Response.status).toBe(200);
				const php2Text = await php2Response.text();
				const parsed = php2Text ? JSON.parse(php2Text) : {};
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
				const testId = randomUUID();
				const dbFilePath = `${TEST_DIR}/${testId}-exclusive-exit.db`;
				const coordinationFile = `${TEST_DIR}/${testId}-coordination.txt`;
				const stages = {
					initial: 'php1-locking',
					php1Locked: 'php1-locked',
					php2Confirmed: 'php2-confirmed-db-locked',
					php1End: 'php1-end-of-script',
				} as const;
				await cliServer.playground.writeFile(
					coordinationFile,
					stages.initial
				);

				await seedSqliteDatabase(dbFilePath);

				const php1Script = `${testId}-exclusive-exit-locker`;
				await cliServer.playground.writeFile(
					`${TEST_DIR}/${php1Script}.php`,
					`<?php
					$db = new SQLite3('${dbFilePath}');
					$db->exec('BEGIN EXCLUSIVE;');
					$db->querySingle('SELECT COUNT(*) FROM test');

					file_put_contents('${coordinationFile}', '${stages.php1Locked}');
					while (file_get_contents('${coordinationFile}') !== '${stages.php2Confirmed}') {
						usleep(100 * 1000);
					}

					// Keep the transaction open until the process exits.
					`
				);

				const php2Script = `${testId}-exclusive-exit-writer`;
				await cliServer.playground.writeFile(
					`${TEST_DIR}/${php2Script}.php`,
					`<?php
				ob_start();
				while (file_get_contents('${coordinationFile}') !== '${stages.php1Locked}') {
					usleep(100 * 1000);
				}

					$db = new SQLite3('${dbFilePath}');
					$db->exec('INSERT INTO test (name) VALUES ("test-after-termination")');
					$attempt_while_locked = [
						'lastErrorCode' => $db->lastErrorCode(),
						'lastErrorMsg' => $db->lastErrorMsg(),
					];

					file_put_contents('${coordinationFile}', '${stages.php2Confirmed}');
					while (file_get_contents('${coordinationFile}') !== '${stages.php1End}') {
						usleep(100 * 1000);
					}

					$db->exec('INSERT INTO test (name) VALUES ("test-after-termination")');
					$attempt_after_exit = [
						'lastErrorCode' => $db->lastErrorCode(),
						'lastErrorMsg' => $db->lastErrorMsg(),
					];

					$db->close();
					ob_clean();
					echo json_encode([
						'attempt_while_locked' => $attempt_while_locked,
						'attempt_after_exit' => $attempt_after_exit,
					]);
					`
				);

				const php1ResponsePromise = fetch(scriptUrl(php1Script));
				const php2ResponsePromise = fetch(scriptUrl(php2Script));

				const php1Response = await php1ResponsePromise;
				expect(php1Response.status).toBe(200);
				await cliServer.playground.writeFile(
					coordinationFile,
					stages.php1End
				);

				const php2Response = await php2ResponsePromise;
				expect(php2Response.status).toBe(200);
				const php2Text = await php2Response.text();
				const parsed = php2Text ? JSON.parse(php2Text) : {};
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
				const testId = randomUUID();
				const dbFilePath = `${TEST_DIR}/${testId}-connection-closed.db`;
				const coordinationFile = `${TEST_DIR}/${testId}-coordination.txt`;
				const stages = {
					initial: 'php1-locking',
					waitingForPhp2: 'php1-waiting-for-php2-to-try',
					php2Ready: 'php2-ready-for-unlock',
					closed: 'php1-closed-db-connection',
				} as const;
				await cliServer.playground.writeFile(
					coordinationFile,
					stages.initial
				);

				await seedSqliteDatabase(dbFilePath);

				const php1Script = `${testId}-close-connection-locker`;
				await cliServer.playground.writeFile(
					`${TEST_DIR}/${php1Script}.php`,
					`<?php
					$db = new SQLite3('${dbFilePath}');
					$db->exec('BEGIN EXCLUSIVE;');
					$db->exec('INSERT INTO test (name) VALUES ("test1")');

					file_put_contents('${coordinationFile}', '${stages.waitingForPhp2}');
					while (file_get_contents('${coordinationFile}') !== '${stages.php2Ready}') {
						usleep(100 * 1000);
					}

					$db->close();
					file_put_contents('${coordinationFile}', '${stages.closed}');

					while (file_get_contents('${coordinationFile}') === '${stages.closed}') {
						usleep(100 * 1000);
					}
					`
				);

				const php2Script = `${testId}-close-connection-writer`;
				await cliServer.playground.writeFile(
					`${TEST_DIR}/${php2Script}.php`,
					`<?php
				ob_start();
				while (file_get_contents('${coordinationFile}') !== '${stages.waitingForPhp2}') {
					usleep(100 * 1000);
				}

					$db = new SQLite3('${dbFilePath}');
					$db->exec('INSERT INTO test (name) VALUES ("test-while-locked")');
					$attempt_while_locked = [
						'lastErrorCode' => $db->lastErrorCode(),
						'lastErrorMsg' => $db->lastErrorMsg(),
					];

					file_put_contents('${coordinationFile}', '${stages.php2Ready}');
					while (file_get_contents('${coordinationFile}') !== '${stages.closed}') {
						usleep(100 * 1000);
					}

					$db->exec('INSERT INTO test (name) VALUES ("test-after-fd-closed")');
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

				const [php1Response, php2Response] = await Promise.all([
					fetch(scriptUrl(php1Script)),
					fetch(scriptUrl(php2Script)),
				]);
				expect(php1Response.status).toBe(200);
				expect(php2Response.status).toBe(200);
				const php2Text = await php2Response.text();
				const parsed = php2Text ? JSON.parse(php2Text) : {};
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
	});

	describe('PHP flock()', () => {
		it(
			'should be able to acquire an exclusive lock on a file',
			async () => {
				const testId = randomUUID();
				const testFilePath = `${TEST_DIR}/${testId}-exclusive.txt`;
				const scriptName = `${testId}-exclusive-lock`;
				await cliServer.playground.writeFile(
					`${TEST_DIR}/${scriptName}.php`,
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
					'file_contents' => file_get_contents('${testFilePath}'),
				]);
				`
				);
				const response = await fetch(scriptUrl(scriptName));
				expect(response.status).toBe(200);
				const text = await response.text();
				const data = text ? JSON.parse(text) : {};
				expect(data.lock_acquired).toBe(true);
				expect(data.file_contents).toBe('test content');
			},
			TEST_TIMEOUT
		);

		it(
			'should be able to acquire a shared lock on a file',
			async () => {
				const testId = randomUUID();
				const testFilePath = `${TEST_DIR}/${testId}-shared.txt`;
				await cliServer.playground.writeFile(
					testFilePath,
					'test content'
				);
				const scriptName = `${testId}-shared-lock`;
				await cliServer.playground.writeFile(
					`${TEST_DIR}/${scriptName}.php`,
					`<?php
				ob_start();
				$fp = fopen('${testFilePath}', 'r+');
				if ($fp === false) {
					ob_clean();
					echo json_encode(['error' => 'Failed to open file']);
					exit(1);
				}
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
				const response = await fetch(scriptUrl(scriptName));
				expect(response.status).toBe(200);
				const text = await response.text();
				const data = text ? JSON.parse(text) : {};
				expect(data.lock_acquired).toBe(true);
				expect(data.file_contents).toBe('test content');
			},
			TEST_TIMEOUT
		);

		it(
			'should deny an exclusive lock when another process has a shared lock on a file',
			async () => {
				const testId = randomUUID();
				const testFilePath = `${TEST_DIR}/${testId}-shared-exclusive.txt`;
				const coordinationFile = `${TEST_DIR}/${testId}-coordination.txt`;
				await cliServer.playground.writeFile(
					testFilePath,
					'test content'
				);
				await cliServer.playground.writeFile(
					coordinationFile,
					'php1-locking'
				);

				const php1Script = `${testId}-shared-holder`;
				await cliServer.playground.writeFile(
					`${TEST_DIR}/${php1Script}.php`,
					`<?php
					$fp = fopen('${testFilePath}', 'r+');
					flock($fp, LOCK_SH | LOCK_NB);

					file_put_contents('${coordinationFile}', 'php1-waiting-for-php2-to-try');
					while (file_get_contents('${coordinationFile}') !== 'php2-ready-for-unlock') {
						usleep(100 * 1000);
					}

					flock($fp, LOCK_UN);
					fclose($fp);
					file_put_contents('${coordinationFile}', 'php1-unlocked');
					`
				);

				const php2Script = `${testId}-exclusive-contender`;
				await cliServer.playground.writeFile(
					`${TEST_DIR}/${php2Script}.php`,
					`<?php
				ob_start();
				while (file_get_contents('${coordinationFile}') !== 'php1-waiting-for-php2-to-try') {
					usleep(100 * 1000);
				}

					$fp = fopen('${testFilePath}', 'r+');
					$lockResult = flock($fp, LOCK_EX | LOCK_NB);
					$attempt_while_shared_locked = ['lock_acquired' => $lockResult];
					if ($lockResult) {
						flock($fp, LOCK_UN);
					}
					fclose($fp);

					file_put_contents('${coordinationFile}', 'php2-ready-for-unlock');
					while (file_get_contents('${coordinationFile}') !== 'php1-unlocked') {
						usleep(100 * 1000);
					}

					$fp = fopen('${testFilePath}', 'r+');
					$lockResult = flock($fp, LOCK_EX | LOCK_NB);
					$attempt_while_unlocked = ['lock_acquired' => $lockResult];
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

				const [sharedResponse, exclusiveResponse] = await Promise.all([
					fetch(scriptUrl(php1Script)),
					fetch(scriptUrl(php2Script)),
				]);
				expect(sharedResponse.status).toBe(200);
				expect(exclusiveResponse.status).toBe(200);
				const exclusiveText = await exclusiveResponse.text();
				const parsed = exclusiveText ? JSON.parse(exclusiveText) : {};
				expect(parsed.attempt_while_shared_locked.lock_acquired).toBe(
					false
				);
				expect(parsed.attempt_while_unlocked.lock_acquired).toBe(true);
			},
			TEST_TIMEOUT
		);

		it(
			'should deny a shared lock when another process has an exclusive lock on a file',
			async () => {
				const testId = randomUUID();
				const testFilePath = `${TEST_DIR}/${testId}-exclusive-shared.txt`;
				const coordinationFile = `${TEST_DIR}/${testId}-coordination.txt`;
				await cliServer.playground.writeFile(
					testFilePath,
					'test content'
				);
				await cliServer.playground.writeFile(
					coordinationFile,
					'php1-locking'
				);

				const php1Script = `${testId}-exclusive-holder`;
				await cliServer.playground.writeFile(
					`${TEST_DIR}/${php1Script}.php`,
					`<?php
					$fp = fopen('${testFilePath}', 'r+');
					flock($fp, LOCK_EX | LOCK_NB);

					file_put_contents('${coordinationFile}', 'php1-waiting-for-php2-to-try');
					while (file_get_contents('${coordinationFile}') !== 'php2-ready-for-unlock') {
						usleep(100 * 1000);
					}

					flock($fp, LOCK_UN);
					fclose($fp);
					file_put_contents('${coordinationFile}', 'php1-unlocked');
					`
				);

				const php2Script = `${testId}-shared-contender`;
				await cliServer.playground.writeFile(
					`${TEST_DIR}/${php2Script}.php`,
					`<?php
				ob_start();
				while (file_get_contents('${coordinationFile}') !== 'php1-waiting-for-php2-to-try') {
					usleep(100 * 1000);
				}

					$fp = fopen('${testFilePath}', 'r+');
					$lockResult = flock($fp, LOCK_SH | LOCK_NB);
					$attempt_while_exclusive_locked = ['lock_acquired' => $lockResult];
					if ($lockResult) {
						flock($fp, LOCK_UN);
					}
					fclose($fp);

					file_put_contents('${coordinationFile}', 'php2-ready-for-unlock');
					while (file_get_contents('${coordinationFile}') !== 'php1-unlocked') {
						usleep(100 * 1000);
					}

					$fp = fopen('${testFilePath}', 'r+');
					$lockResult = flock($fp, LOCK_SH | LOCK_NB);
					$attempt_while_unlocked = ['lock_acquired' => $lockResult];
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

				const [exclusiveResponse, sharedResponse] = await Promise.all([
					fetch(scriptUrl(php1Script)),
					fetch(scriptUrl(php2Script)),
				]);
				expect(exclusiveResponse.status).toBe(200);
				expect(sharedResponse.status).toBe(200);
				const sharedText = await sharedResponse.text();
				const parsed = sharedText ? JSON.parse(sharedText) : {};
				expect(
					parsed.attempt_while_exclusive_locked.lock_acquired
				).toBe(false);
				expect(parsed.attempt_while_unlocked.lock_acquired).toBe(true);
			},
			TEST_TIMEOUT
		);

		it(
			'should grant multiple shared locks on a file',
			async () => {
				const testId = randomUUID();
				const testFilePath = `${TEST_DIR}/${testId}-multi-shared.txt`;
				const coordinationFile = `${TEST_DIR}/${testId}-coordination.txt`;
				await cliServer.playground.writeFile(
					testFilePath,
					'test content'
				);
				await cliServer.playground.writeFile(
					coordinationFile,
					'php1-locking'
				);

				const php1Script = `${testId}-shared-one`;
				await cliServer.playground.writeFile(
					`${TEST_DIR}/${php1Script}.php`,
					`<?php
				ob_start();
				$fp = fopen('${testFilePath}', 'r+');
				$lockResult = flock($fp, LOCK_SH | LOCK_NB);

					file_put_contents('${coordinationFile}', 'php1-locked');
					while (file_get_contents('${coordinationFile}') !== 'php3-can-unlock') {
						usleep(100 * 1000);
					}

					flock($fp, LOCK_UN);
					fclose($fp);
					ob_clean();
					echo json_encode(['lock_acquired' => $lockResult]);
					`
				);

				const php2Script = `${testId}-shared-two`;
				await cliServer.playground.writeFile(
					`${TEST_DIR}/${php2Script}.php`,
					`<?php
				ob_start();
				while (file_get_contents('${coordinationFile}') !== 'php1-locked') {
					usleep(100 * 1000);
				}

					$fp = fopen('${testFilePath}', 'r+');
					$lockResult = flock($fp, LOCK_SH | LOCK_NB);

					file_put_contents('${coordinationFile}', 'php2-locked');
					while (file_get_contents('${coordinationFile}') !== 'php3-can-unlock') {
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

				const php3Script = `${testId}-shared-three`;
				await cliServer.playground.writeFile(
					`${TEST_DIR}/${php3Script}.php`,
					`<?php
				ob_start();
				while (file_get_contents('${coordinationFile}') !== 'php2-locked') {
					usleep(100 * 1000);
				}

					$fp = fopen('${testFilePath}', 'r+');
					$lockResult = flock($fp, LOCK_SH | LOCK_NB);

					file_put_contents('${coordinationFile}', 'php3-can-unlock');
					if ($lockResult) {
						flock($fp, LOCK_UN);
					}
					fclose($fp);
					ob_clean();
					echo json_encode(['lock_acquired' => $lockResult]);
					`
				);

				const [resp1, resp2, resp3] = await Promise.all([
					fetch(scriptUrl(php1Script)),
					fetch(scriptUrl(php2Script)),
					fetch(scriptUrl(php3Script)),
				]);
				expect(resp1.status).toBe(200);
				expect(resp2.status).toBe(200);
				expect(resp3.status).toBe(200);
				expect(JSON.parse(await resp1.text()).lock_acquired).toBe(true);
				expect(JSON.parse(await resp2.text()).lock_acquired).toBe(true);
				expect(JSON.parse(await resp3.text()).lock_acquired).toBe(true);
			},
			TEST_TIMEOUT
		);

		it(
			'should release a shared lock when its associated file descriptor is closed',
			async () => {
				const testId = randomUUID();
				const testFilePath = `${TEST_DIR}/${testId}-shared-close.txt`;
				const coordinationFile = `${TEST_DIR}/${testId}-coordination.txt`;
				await cliServer.playground.writeFile(
					testFilePath,
					'test content'
				);
				await cliServer.playground.writeFile(
					coordinationFile,
					'php1-locking'
				);

				const php1Script = `${testId}-shared-close-locker`;
				await cliServer.playground.writeFile(
					`${TEST_DIR}/${php1Script}.php`,
					`<?php
					$fp = fopen('${testFilePath}', 'r+');
					flock($fp, LOCK_SH | LOCK_NB);

					file_put_contents('${coordinationFile}', 'php1-waiting-for-php2-to-try');
					while (file_get_contents('${coordinationFile}') !== 'php2-ready-for-unlock') {
						usleep(100 * 1000);
					}

					fclose($fp);
					file_put_contents('${coordinationFile}', 'php1-unlocked');

					while (file_get_contents('${coordinationFile}') === 'php1-unlocked') {
						usleep(100 * 1000);
					}
					`
				);

				const php2Script = `${testId}-shared-close-contender`;
				await cliServer.playground.writeFile(
					`${TEST_DIR}/${php2Script}.php`,
					`<?php
				ob_start();
				while (file_get_contents('${coordinationFile}') !== 'php1-waiting-for-php2-to-try') {
					usleep(100 * 1000);
				}

					$fp = fopen('${testFilePath}', 'r+');
					$lockResult = flock($fp, LOCK_EX | LOCK_NB);
					$attempt_while_locked = ['lock_acquired' => $lockResult];
					if ($lockResult) {
						flock($fp, LOCK_UN);
					}
					fclose($fp);

					file_put_contents('${coordinationFile}', 'php2-ready-for-unlock');
					while (file_get_contents('${coordinationFile}') !== 'php1-unlocked') {
						usleep(100 * 1000);
					}

					$fp = fopen('${testFilePath}', 'r+');
					$lockResult = flock($fp, LOCK_EX | LOCK_NB);
					$attempt_after_fd_closed = ['lock_acquired' => $lockResult];
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

				const [sharedResponse, exclusiveResponse] = await Promise.all([
					fetch(scriptUrl(php1Script)),
					fetch(scriptUrl(php2Script)),
				]);
				expect(sharedResponse.status).toBe(200);
				expect(exclusiveResponse.status).toBe(200);
				const exclusiveText = await exclusiveResponse.text();
				const parsed = exclusiveText ? JSON.parse(exclusiveText) : {};
				expect(parsed.attempt_while_locked.lock_acquired).toBe(false);
				expect(parsed.attempt_after_fd_closed.lock_acquired).toBe(true);
			},
			TEST_TIMEOUT
		);

		it(
			'should release an exclusive lock when its associated file descriptor is closed',
			async () => {
				const testId = randomUUID();
				const testFilePath = `${TEST_DIR}/${testId}-exclusive-close.txt`;
				const coordinationFile = `${TEST_DIR}/${testId}-coordination.txt`;
				await cliServer.playground.writeFile(
					testFilePath,
					'test content'
				);
				await cliServer.playground.writeFile(
					coordinationFile,
					'php1-locking'
				);

				const php1Script = `${testId}-exclusive-close-locker`;
				await cliServer.playground.writeFile(
					`${TEST_DIR}/${php1Script}.php`,
					`<?php
					$fp = fopen('${testFilePath}', 'r+');
					flock($fp, LOCK_EX | LOCK_NB);

					file_put_contents('${coordinationFile}', 'php1-waiting-for-php2-to-try');
					while (file_get_contents('${coordinationFile}') !== 'php2-ready-for-unlock') {
						usleep(100 * 1000);
					}

					fclose($fp);
					file_put_contents('${coordinationFile}', 'php1-unlocked');

					while (file_get_contents('${coordinationFile}') === 'php1-unlocked') {
						usleep(100 * 1000);
					}
					`
				);

				const php2Script = `${testId}-shared-after-close`;
				await cliServer.playground.writeFile(
					`${TEST_DIR}/${php2Script}.php`,
					`<?php
				ob_start();
				while (file_get_contents('${coordinationFile}') !== 'php1-waiting-for-php2-to-try') {
					usleep(100 * 1000);
				}

					$fp = fopen('${testFilePath}', 'r+');
					$lockResult = flock($fp, LOCK_SH | LOCK_NB);
					$attempt_while_locked = ['lock_acquired' => $lockResult];
					if ($lockResult) {
						flock($fp, LOCK_UN);
					}
					fclose($fp);

					file_put_contents('${coordinationFile}', 'php2-ready-for-unlock');
					while (file_get_contents('${coordinationFile}') !== 'php1-unlocked') {
						usleep(100 * 1000);
					}

					$fp = fopen('${testFilePath}', 'r+');
					$lockResult = flock($fp, LOCK_SH | LOCK_NB);
					$attempt_after_fd_closed = ['lock_acquired' => $lockResult];
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

				const [exclusiveResponse, sharedResponse] = await Promise.all([
					fetch(scriptUrl(php1Script)),
					fetch(scriptUrl(php2Script)),
				]);
				expect(exclusiveResponse.status).toBe(200);
				expect(sharedResponse.status).toBe(200);
				const sharedText = await sharedResponse.text();
				const parsed = sharedText ? JSON.parse(sharedText) : {};
				expect(parsed.attempt_while_locked.lock_acquired).toBe(false);
				expect(parsed.attempt_after_fd_closed.lock_acquired).toBe(true);
			},
			TEST_TIMEOUT
		);

		it(
			'should release a shared lock when the owning process exits',
			async () => {
				const testId = randomUUID();
				const testFilePath = `${TEST_DIR}/${testId}-shared-exit-file.txt`;
				const coordinationFile = `${TEST_DIR}/${testId}-coordination.txt`;
				await cliServer.playground.writeFile(
					testFilePath,
					'test content'
				);
				await cliServer.playground.writeFile(
					coordinationFile,
					'php1-locking'
				);

				const php1Script = `${testId}-shared-owner-exit`;
				await cliServer.playground.writeFile(
					`${TEST_DIR}/${php1Script}.php`,
					`<?php
					$fp = fopen('${testFilePath}', 'r+');
					flock($fp, LOCK_SH | LOCK_NB);
					file_put_contents('${coordinationFile}', 'php1-locked');
					while (file_get_contents('${coordinationFile}') !== 'php2-confirmed-file-locked') {
						usleep(100 * 1000);
					}
					file_put_contents('${coordinationFile}', 'php1-end-of-script');
					`
				);

				const php2Script = `${testId}-exclusive-after-shared-exit`;
				await cliServer.playground.writeFile(
					`${TEST_DIR}/${php2Script}.php`,
					`<?php
				ob_start();
				while (file_get_contents('${coordinationFile}') !== 'php1-locked') {
					usleep(100 * 1000);
				}

					$fp = fopen('${testFilePath}', 'r+');
					$lockResult = flock($fp, LOCK_EX | LOCK_NB);
					$attempt_while_locked = $lockResult;

					file_put_contents('${coordinationFile}', 'php2-confirmed-file-locked');
					while (file_get_contents('${coordinationFile}') !== 'php1-end-of-script') {
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

				const [sharedResponse, exclusiveResponse] = await Promise.all([
					fetch(scriptUrl(php1Script)),
					fetch(scriptUrl(php2Script)),
				]);
				expect(sharedResponse.status).toBe(200);
				expect(exclusiveResponse.status).toBe(200);
				const exclusiveText = await exclusiveResponse.text();
				const parsed = exclusiveText ? JSON.parse(exclusiveText) : {};
				expect(parsed.attempt_while_locked).toBe(false);
				expect(parsed.attempt_after_exit).toBe(true);
			},
			TEST_TIMEOUT
		);

		it(
			'should release an exclusive lock when the owning process exits',
			async () => {
				const testId = randomUUID();
				const testFilePath = `${TEST_DIR}/${testId}-exclusive-exit-file.txt`;
				const coordinationFile = `${TEST_DIR}/${testId}-coordination.txt`;
				await cliServer.playground.writeFile(
					testFilePath,
					'test content'
				);
				await cliServer.playground.writeFile(
					coordinationFile,
					'php1-locking'
				);

				const php1Script = `${testId}-exclusive-owner-exit`;
				await cliServer.playground.writeFile(
					`${TEST_DIR}/${php1Script}.php`,
					`<?php
					$fp = fopen('${testFilePath}', 'r+');
					flock($fp, LOCK_EX | LOCK_NB);
					file_put_contents('${coordinationFile}', 'php1-locked');
					while (file_get_contents('${coordinationFile}') !== 'php2-confirmed-file-locked') {
						usleep(100 * 1000);
					}
					file_put_contents('${coordinationFile}', 'php1-end-of-script');
					`
				);

				const php2Script = `${testId}-shared-after-exclusive-exit`;
				await cliServer.playground.writeFile(
					`${TEST_DIR}/${php2Script}.php`,
					`<?php
				ob_start();
				while (file_get_contents('${coordinationFile}') !== 'php1-locked') {
					usleep(100 * 1000);
				}

					$fp = fopen('${testFilePath}', 'r+');
					$lockResult = flock($fp, LOCK_SH | LOCK_NB);
					$attempt_while_locked = $lockResult;

					file_put_contents('${coordinationFile}', 'php2-confirmed-file-locked');
					while (file_get_contents('${coordinationFile}') !== 'php1-end-of-script') {
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

				const [exclusiveResponse, sharedResponse] = await Promise.all([
					fetch(scriptUrl(php1Script)),
					fetch(scriptUrl(php2Script)),
				]);
				expect(exclusiveResponse.status).toBe(200);
				expect(sharedResponse.status).toBe(200);
				const sharedText = await sharedResponse.text();
				const parsed = sharedText ? JSON.parse(sharedText) : {};
				expect(parsed.attempt_while_locked).toBe(false);
				expect(parsed.attempt_after_exit).toBe(true);
			},
			TEST_TIMEOUT
		);
	});
});
