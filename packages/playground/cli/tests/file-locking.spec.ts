import { randomUUID } from 'node:crypto';
import { runCLI, internalsKeyForTesting } from '../src/run-cli';
import type { RunCLIServer } from '../src/run-cli';
import { mkdtempSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const TEST_SUITE_PREP_TIMEOUT = 120_000;
const TEST_SUITE_CLEANUP_TIMEOUT = 120_000;
const TEST_CASE_TIMEOUT = 60_000;
const TEST_DIR = '/wordpress/test';
const TEST_DIR_URI = '/test';
const MULTI_WORKER_COUNT = 4;

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
			// Test locking across multiple workers
			experimentalMultiWorker: MULTI_WORKER_COUNT,
		});
	}, TEST_SUITE_PREP_TIMEOUT);

	afterAll(async () => {
		if (cliServer) {
			await cliServer[Symbol.asyncDispose]();
		}
	}, TEST_SUITE_CLEANUP_TIMEOUT);

	function writeScript(script: string, content: string): Promise<void> {
		return cliServer.playground.writeFile(`${TEST_DIR}/${script}`, content);
	}

	function fetchScript(script: string): Promise<Response> {
		return fetch(new URL(`${TEST_DIR_URI}/${script}`, cliServer.serverUrl));
	}

	function assertProcessIdsFromDifferentWorkers(...pids: number[]) {
		// Confirm that the process IDs look like process IDs.
		for (const pid of pids) {
			expect(pid).toBeTypeOf('number');
			expect(pid).toBeGreaterThan(0);
		}
		const workerNumbers = pids.map(
			cliServer[internalsKeyForTesting].getWorkerNumberFromProcessId
		);
		for (const workerNumber of workerNumbers) {
			// +1 to account for the initial worker.
			expect(workerNumber).toBeLessThan(MULTI_WORKER_COUNT + 1);
		}
		expect(new Set(workerNumbers).size).toBe(workerNumbers.length);
	}

	describe(
		'SQLite DB locking (relying upon fcntl())',
		() => {
			async function seedSqliteDatabase(dbFilePath: string) {
				const seedScript = `${randomUUID()}-seed.php`;
				await writeScript(
					seedScript,
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
				const seedResponse = await fetchScript(seedScript);
				expect(seedResponse.status).toBe(200);
				expect((await seedResponse.text()).trim()).toBe('ok');
			}

			it('cannot write to DB while another process has an exclusive lock', async () => {
				const testId = randomUUID();
				const dbFilePath = `${TEST_DIR}/${testId}-exclusive.db`;
				const coordinationFile = `${TEST_DIR}/${testId}-coordination.txt`;
				await cliServer.playground.writeFile(
					coordinationFile,
					'php1-locking'
				);

				await seedSqliteDatabase(dbFilePath);

				const php1Script = `${testId}-exclusive-locker.php`;
				await writeScript(
					php1Script,
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

					echo json_encode([
						'pid' => getmypid(),
					]);
					`
				);

				const php2Script = `${testId}-exclusive-contender.php`;
				await writeScript(
					php2Script,
					`<?php
					ob_start();
					while (file_get_contents('${coordinationFile}') !== 'php1-locked') {
						usleep(100 * 1000);
					}

					$db = new SQLite3('${dbFilePath}');
					$db->exec('INSERT INTO test (name) VALUES ("test-while-locked")');
					$attempt_while_exclusively_locked = [
						'last_error_code' => $db->lastErrorCode(),
						'last_error_msg' => $db->lastErrorMsg(),
					];

					file_put_contents('${coordinationFile}', 'php2-ready-for-unlock');
					while (file_get_contents('${coordinationFile}') !== 'php1-unlocked') {
						usleep(100 * 1000);
					}

					$db->exec('INSERT INTO test (name) VALUES ("test-while-unlocked")');
					$attempt_while_unlocked = [
						'last_error_code' => $db->lastErrorCode(),
						'last_error_msg' => $db->lastErrorMsg(),
					];

					ob_clean();
					echo json_encode([
						'pid' => getmypid(),
						'attempt_while_exclusively_locked' => $attempt_while_exclusively_locked,
						'attempt_while_unlocked' => $attempt_while_unlocked,
					]);
					$db->close();
					`
				);

				const [php1Response, php2Response] = await Promise.all([
					fetchScript(php1Script),
					fetchScript(php2Script),
				]);
				expect(php1Response.status).toBe(200);
				expect(php2Response.status).toBe(200);
				const php1Output = await php1Response.json();
				const php2Output = await php2Response.json();

				// Confirm that we are testing with separate workers.
				assertProcessIdsFromDifferentWorkers(
					php1Output.pid,
					php2Output.pid
				);

				expect(php2Output).toMatchObject({
					attempt_while_exclusively_locked: {
						last_error_code: 5,
						last_error_msg: 'database is locked',
					},
					attempt_while_unlocked: {
						last_error_code: 0,
						last_error_msg: 'not an error',
					},
				});
			});

			it('cannot read from DB while another process has an exclusive lock', async () => {
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

				const php1Script = `${testId}-exclusive-reader-locker.php`;
				await writeScript(
					php1Script,
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

					echo json_encode([
						'pid' => getmypid(),
					]);
					`
				);

				const php2Script = `${testId}-exclusive-reader.php`;
				await writeScript(
					php2Script,
					`<?php
					ob_start();
					while (file_get_contents('${coordinationFile}') !== '${stages.waitingForPhp2}') {
						usleep(100 * 1000);
					}

					$db = new SQLite3('${dbFilePath}');
					$db->querySingle('SELECT COUNT(*) FROM test');
					$attempt_while_exclusively_locked = [
						'last_error_code' => $db->lastErrorCode(),
						'last_error_msg' => $db->lastErrorMsg(),
					];

					file_put_contents('${coordinationFile}', '${stages.php2Ready}');
					while (file_get_contents('${coordinationFile}') !== '${stages.php1Unlocked}') {
						usleep(100 * 1000);
					}

					$db->querySingle('SELECT COUNT(*) FROM test');
					$attempt_while_unlocked = [
						'last_error_code' => $db->lastErrorCode(),
						'last_error_msg' => $db->lastErrorMsg(),
					];

					ob_clean();
					echo json_encode([
						'pid' => getmypid(),
						'attempt_while_exclusively_locked' => $attempt_while_exclusively_locked,
						'attempt_while_unlocked' => $attempt_while_unlocked,
					]);
					$db->close();
					`
				);

				const [php1Response, php2Response] = await Promise.all([
					fetchScript(php1Script),
					fetchScript(php2Script),
				]);
				expect(php1Response.status).toBe(200);
				expect(php2Response.status).toBe(200);
				const php1Output = await php1Response.json();
				const php2Output = await php2Response.json();

				assertProcessIdsFromDifferentWorkers(
					php1Output.pid,
					php2Output.pid
				);

				expect(php2Output).toMatchObject({
					attempt_while_exclusively_locked: {
						last_error_code: 5,
						last_error_msg: 'database is locked',
					},
					attempt_while_unlocked: {
						last_error_code: 0,
						last_error_msg: 'not an error',
					},
				});
			});

			it('cannot write to DB while another process has a shared lock', async () => {
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

				const php1Script = `${testId}-shared-locker.php`;
				await writeScript(
					php1Script,
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

					echo json_encode([
						'pid' => getmypid(),
					]);
					`
				);

				const php2Script = `${testId}-shared-writer.php`;
				await writeScript(
					php2Script,
					`<?php
					ob_start();
					while (file_get_contents('${coordinationFile}') !== '${stages.waitingForPhp2}') {
						usleep(100 * 1000);
					}

					$db = new SQLite3('${dbFilePath}');
					$db->exec('INSERT INTO test (name) VALUES ("test-while-shared-locked")');
					$attempt_while_shared_locked = [
						'last_error_code' => $db->lastErrorCode(),
						'last_error_msg' => $db->lastErrorMsg(),
					];

					file_put_contents('${coordinationFile}', '${stages.php2Ready}');
					while (file_get_contents('${coordinationFile}') !== '${stages.php1Unlocked}') {
						usleep(100 * 1000);
					}

					$db->exec('INSERT INTO test (name) VALUES ("test-while-unlocked")');
					$attempt_while_unlocked = [
						'last_error_code' => $db->lastErrorCode(),
						'last_error_msg' => $db->lastErrorMsg(),
					];

					ob_clean();
					echo json_encode([
						'pid' => getmypid(),
						'attempt_while_shared_locked' => $attempt_while_shared_locked,
						'attempt_while_unlocked' => $attempt_while_unlocked,
					]);
					$db->close();
					`
				);

				const [php1Response, php2Response] = await Promise.all([
					fetchScript(php1Script),
					fetchScript(php2Script),
				]);
				expect(php1Response.status).toBe(200);
				expect(php2Response.status).toBe(200);
				const php1Output = await php1Response.json();
				const php2Output = await php2Response.json();

				assertProcessIdsFromDifferentWorkers(
					php1Output.pid,
					php2Output.pid
				);

				expect(php2Output).toMatchObject({
					attempt_while_shared_locked: {
						last_error_code: 5,
						last_error_msg: 'database is locked',
					},
					attempt_while_unlocked: {
						last_error_code: 0,
						last_error_msg: 'not an error',
					},
				});
			});

			it('can read from DB while another process has a shared lock', async () => {
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

				const php1Script = `${testId}-shared-reader-locker.php`;
				await writeScript(
					php1Script,
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

					echo json_encode([
						'pid' => getmypid(),
					]);
					`
				);

				const php2Script = `${testId}-shared-reader.php`;
				await writeScript(
					php2Script,
					`<?php
					ob_start();
					while (file_get_contents('${coordinationFile}') !== '${stages.waitingForPhp2}') {
						usleep(100 * 1000);
					}

					$db = new SQLite3('${dbFilePath}');
					$result = $db->querySingle('SELECT COUNT(*) FROM test');
					$attempt_while_shared_locked = [
						'last_error_code' => $db->lastErrorCode(),
						'last_error_msg' => $db->lastErrorMsg(),
						'result' => $result,
					];

					file_put_contents('${coordinationFile}', '${stages.php2Ready}');
					while (file_get_contents('${coordinationFile}') !== '${stages.php1Unlocked}') {
						usleep(100 * 1000);
					}

					$result = $db->querySingle('SELECT COUNT(*) FROM test');
					$attempt_while_unlocked = [
						'last_error_code' => $db->lastErrorCode(),
						'last_error_msg' => $db->lastErrorMsg(),
						'result' => $result,
					];

					ob_clean();
					echo json_encode([
						'pid' => getmypid(),
						'attempt_while_shared_locked' => $attempt_while_shared_locked,
						'attempt_while_unlocked' => $attempt_while_unlocked,
					]);
					$db->close();
					`
				);

				const [php1Response, php2Response] = await Promise.all([
					fetchScript(php1Script),
					fetchScript(php2Script),
				]);
				expect(php1Response.status).toBe(200);
				expect(php2Response.status).toBe(200);
				const php1Output = await php1Response.json();
				const php2Output = await php2Response.json();

				assertProcessIdsFromDifferentWorkers(
					php1Output.pid,
					php2Output.pid
				);

				expect(php2Output).toMatchObject({
					attempt_while_shared_locked: {
						last_error_code: 0,
						last_error_msg: 'not an error',
					},
					attempt_while_unlocked: {
						last_error_code: 0,
						last_error_msg: 'not an error',
					},
				});
			});

			it('should release a shared lock when its associated process exits', async () => {
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

				const php1Script = `${testId}-shared-exit-locker.php`;
				await writeScript(
					php1Script,
					`<?php
					$db = new SQLite3('${dbFilePath}');
					$db->exec('BEGIN;');
					$db->querySingle('SELECT COUNT(*) FROM test');

					file_put_contents('${coordinationFile}', '${stages.php1Locked}');
					while (file_get_contents('${coordinationFile}') !== '${stages.php2Confirmed}') {
						usleep(100 * 1000);
					}

					// Intentionally keep the database connection open until the process exits.
					echo json_encode([
						'pid' => getmypid(),
					]);
					`
				);

				const php2Script = `${testId}-shared-exit-writer.php`;
				await writeScript(
					php2Script,
					`<?php
					ob_start();
					while (file_get_contents('${coordinationFile}') !== '${stages.php1Locked}') {
						usleep(100 * 1000);
					}

					$db = new SQLite3('${dbFilePath}');
					$db->exec('INSERT INTO test (name) VALUES ("test-after-termination")');
					$attempt_while_locked = [
						'last_error_code' => $db->lastErrorCode(),
						'last_error_msg' => $db->lastErrorMsg(),
					];

					file_put_contents('${coordinationFile}', '${stages.php2Confirmed}');
					while (file_get_contents('${coordinationFile}') !== '${stages.php1End}') {
						usleep(100 * 1000);
					}

					$db->exec('INSERT INTO test (name) VALUES ("test-after-termination")');
					$attempt_after_exit = [
						'last_error_code' => $db->lastErrorCode(),
						'last_error_msg' => $db->lastErrorMsg(),
					];

					$db->close();
					ob_clean();
					echo json_encode([
						'pid' => getmypid(),
						'attempt_while_locked' => $attempt_while_locked,
						'attempt_after_exit' => $attempt_after_exit,
					]);
					`
				);

				const php1ResponsePromise = fetchScript(php1Script);
				const php2ResponsePromise = fetchScript(php2Script);

				const php1Response = await php1ResponsePromise;
				expect(php1Response.status).toBe(200);
				const php1Output = await php1Response.json();

				// Since php1 has exited, signal php2 to proceed.
				await cliServer.playground.writeFile(
					coordinationFile,
					stages.php1End
				);

				const php2Response = await php2ResponsePromise;
				expect(php2Response.status).toBe(200);
				const php2Output = await php2Response.json();

				assertProcessIdsFromDifferentWorkers(
					php1Output.pid,
					php2Output.pid
				);

				expect(php2Output).toMatchObject({
					attempt_while_locked: {
						last_error_code: 5,
						last_error_msg: 'database is locked',
					},
					attempt_after_exit: {
						last_error_code: 0,
						last_error_msg: 'not an error',
					},
				});
			});

			it('should release an exclusive lock when its associated process exits', async () => {
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

				const php1Script = `${testId}-exclusive-exit-locker.php`;
				await writeScript(
					php1Script,
					`<?php
					$db = new SQLite3('${dbFilePath}');
					$db->exec('BEGIN EXCLUSIVE;');
					$db->querySingle('SELECT COUNT(*) FROM test');

					file_put_contents('${coordinationFile}', '${stages.php1Locked}');
					while (file_get_contents('${coordinationFile}') !== '${stages.php2Confirmed}') {
						usleep(100 * 1000);
					}

					// Keep the transaction open until the process exits.
					echo json_encode([
						'pid' => getmypid(),
					]);
					`
				);

				const php2Script = `${testId}-exclusive-exit-writer.php`;
				await writeScript(
					php2Script,
					`<?php
					ob_start();
					while (file_get_contents('${coordinationFile}') !== '${stages.php1Locked}') {
						usleep(100 * 1000);
					}

					$db = new SQLite3('${dbFilePath}');
					$db->exec('INSERT INTO test (name) VALUES ("test-after-termination")');
					$attempt_while_locked = [
						'last_error_code' => $db->lastErrorCode(),
						'last_error_msg' => $db->lastErrorMsg(),
					];

					file_put_contents('${coordinationFile}', '${stages.php2Confirmed}');
					while (file_get_contents('${coordinationFile}') !== '${stages.php1End}') {
						usleep(100 * 1000);
					}

					$db->exec('INSERT INTO test (name) VALUES ("test-after-termination")');
					$attempt_after_exit = [
						'last_error_code' => $db->lastErrorCode(),
						'last_error_msg' => $db->lastErrorMsg(),
					];

					$db->close();
					ob_clean();
					echo json_encode([
						'pid' => getmypid(),
						'attempt_while_locked' => $attempt_while_locked,
						'attempt_after_exit' => $attempt_after_exit,
					]);
					`
				);

				const php1ResponsePromise = fetchScript(php1Script);
				const php2ResponsePromise = fetchScript(php2Script);

				const php1Response = await php1ResponsePromise;
				expect(php1Response.status).toBe(200);
				const php1Output = await php1Response.json();

				// Since php1 has exited, signal php2 to proceed.
				await cliServer.playground.writeFile(
					coordinationFile,
					stages.php1End
				);

				const php2Response = await php2ResponsePromise;
				expect(php2Response.status).toBe(200);
				const php2Output = await php2Response.json();

				assertProcessIdsFromDifferentWorkers(
					php1Output.pid,
					php2Output.pid
				);

				expect(php2Output).toMatchObject({
					attempt_while_locked: {
						last_error_code: 5,
						last_error_msg: 'database is locked',
					},
					attempt_after_exit: {
						last_error_code: 0,
						last_error_msg: 'not an error',
					},
				});
			});

			it('should release a lock when its database connection is closed', async () => {
				const testId = randomUUID();
				const dbFilePath = `${TEST_DIR}/${testId}-connection-closed.db`;
				const coordinationFile = `${TEST_DIR}/${testId}-coordination.txt`;
				const stages = {
					initial: 'php1-locking',
					waitingForPhp2: 'php1-waiting-for-php2-to-try',
					php2Ready: 'php2-ready-for-unlock',
					closed: 'php1-closed-db-connection',
					php2CheckedDbUnlocked: 'php2-checked-db-unlocked',
				} as const;
				await cliServer.playground.writeFile(
					coordinationFile,
					stages.initial
				);

				await seedSqliteDatabase(dbFilePath);

				const php1Script = `${testId}-close-connection-locker.php`;
				await writeScript(
					php1Script,
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

					// Avoid exiting before php2 has checked that the database is unlocked
					// to make clear that an unlock did not occur due to php1 exiting.
					while (file_get_contents('${coordinationFile}') !== '${stages.php2CheckedDbUnlocked}') {
						usleep(100 * 1000);
					}

					echo json_encode([
						'pid' => getmypid(),
					]);
					`
				);

				const php2Script = `${testId}-close-connection-writer.php`;
				await writeScript(
					php2Script,
					`<?php
					ob_start();
					while (file_get_contents('${coordinationFile}') !== '${stages.waitingForPhp2}') {
						usleep(100 * 1000);
					}

					$db = new SQLite3('${dbFilePath}');
					$db->exec('INSERT INTO test (name) VALUES ("test-while-locked")');
					$attempt_while_locked = [
						'last_error_code' => $db->lastErrorCode(),
						'last_error_msg' => $db->lastErrorMsg(),
					];

					file_put_contents('${coordinationFile}', '${stages.php2Ready}');
					while (file_get_contents('${coordinationFile}') !== '${stages.closed}') {
						usleep(100 * 1000);
					}

					$db->exec('INSERT INTO test (name) VALUES ("test-after-fd-closed")');
					$attempt_after_fd_closed = [
						'last_error_code' => $db->lastErrorCode(),
						'last_error_msg' => $db->lastErrorMsg(),
					];

					ob_clean();
					echo json_encode([
						'pid' => getmypid(),
						'attempt_while_locked' => $attempt_while_locked,
						'attempt_after_fd_closed' => $attempt_after_fd_closed,
					]);
					$db->close();
					file_put_contents('${coordinationFile}', '${stages.php2CheckedDbUnlocked}');
					`
				);

				const [php1Response, php2Response] = await Promise.all([
					fetchScript(php1Script),
					fetchScript(php2Script),
				]);
				expect(php1Response.status).toBe(200);
				expect(php2Response.status).toBe(200);
				const php1Output = await php1Response.json();
				const php2Output = await php2Response.json();

				assertProcessIdsFromDifferentWorkers(
					php1Output.pid,
					php2Output.pid
				);

				expect(php2Output).toMatchObject({
					attempt_while_locked: {
						last_error_code: 5,
						last_error_msg: 'database is locked',
					},
					attempt_after_fd_closed: {
						last_error_code: 0,
						last_error_msg: 'not an error',
					},
				});
			});
		},
		TEST_CASE_TIMEOUT
	);

	describe(
		'PHP flock()',
		() => {
			it('should be able to acquire an exclusive lock on a file', async () => {
				const testId = randomUUID();
				const testFilePath = `${TEST_DIR}/${testId}-exclusive.txt`;
				const scriptName = `${testId}-exclusive-lock.php`;
				await writeScript(
					scriptName,
					`<?php
					ob_start();
					$fp = fopen('${testFilePath}', 'w');
					$lockResult = flock($fp, LOCK_EX | LOCK_NB);
					fwrite($fp, 'test content');
					flock($fp, LOCK_UN);
					fclose($fp);

					ob_clean();
					echo json_encode([
						'pid' => getmypid(),
						'lock_acquired' => $lockResult,
						'file_contents' => file_get_contents('${testFilePath}'),
					]);
					`
				);
				const response = await fetchScript(scriptName);
				expect(response.status).toBe(200);
				const text = await response.text();
				const data = text ? JSON.parse(text) : {};
				expect(data.lock_acquired).toBe(true);
				expect(data.file_contents).toBe('test content');
			});

			it('should be able to acquire a shared lock on a file', async () => {
				const testId = randomUUID();
				const testFilePath = `${TEST_DIR}/${testId}-shared.txt`;
				await cliServer.playground.writeFile(
					testFilePath,
					'test content'
				);
				const scriptName = `${testId}-shared-lock.php`;
				await writeScript(
					scriptName,
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
						'pid' => getmypid(),
						'lock_acquired' => $lockResult,
						'file_contents' => $file_contents,
					]);
					`
				);
				const response = await fetchScript(scriptName);
				expect(response.status).toBe(200);
				const text = await response.text();
				const data = text ? JSON.parse(text) : {};
				expect(data.lock_acquired).toBe(true);
				expect(data.file_contents).toBe('test content');
			});

			it('should deny an exclusive lock when another process has a shared lock on a file', async () => {
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

				const php1Script = `${testId}-shared-holder.php`;
				await writeScript(
					php1Script,
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

					echo json_encode([
						'pid' => getmypid(),
					]);
					`
				);

				const php2Script = `${testId}-exclusive-contender.php`;
				await writeScript(
					php2Script,
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
						'pid' => getmypid(),
						'attempt_while_shared_locked' => $attempt_while_shared_locked,
						'attempt_while_unlocked' => $attempt_while_unlocked,
					]);
					`
				);

				const [sharedResponse, exclusiveResponse] = await Promise.all([
					fetchScript(php1Script),
					fetchScript(php2Script),
				]);
				expect(sharedResponse.status).toBe(200);
				expect(exclusiveResponse.status).toBe(200);
				const sharedOutput = await sharedResponse.json();
				const exclusiveOutput = await exclusiveResponse.json();

				assertProcessIdsFromDifferentWorkers(
					sharedOutput.pid,
					exclusiveOutput.pid
				);

				expect(
					exclusiveOutput.attempt_while_shared_locked.lock_acquired
				).toBe(false);
				expect(
					exclusiveOutput.attempt_while_unlocked.lock_acquired
				).toBe(true);
			});

			it('should deny a shared lock when another process has an exclusive lock on a file', async () => {
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

				const php1Script = `${testId}-exclusive-holder.php`;
				await writeScript(
					php1Script,
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

					echo json_encode([
						'pid' => getmypid(),
					]);
					`
				);

				const php2Script = `${testId}-shared-contender.php`;
				await writeScript(
					php2Script,
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
						'pid' => getmypid(),
						'attempt_while_exclusive_locked' => $attempt_while_exclusive_locked,
						'attempt_while_unlocked' => $attempt_while_unlocked,
					]);
					`
				);

				const [exclusiveResponse, sharedResponse] = await Promise.all([
					fetchScript(php1Script),
					fetchScript(php2Script),
				]);
				expect(exclusiveResponse.status).toBe(200);
				expect(sharedResponse.status).toBe(200);
				const exclusiveOutput = await exclusiveResponse.json();
				const sharedOutput = await sharedResponse.json();

				assertProcessIdsFromDifferentWorkers(
					exclusiveOutput.pid,
					sharedOutput.pid
				);

				expect(
					sharedOutput.attempt_while_exclusive_locked.lock_acquired
				).toBe(false);
				expect(sharedOutput.attempt_while_unlocked.lock_acquired).toBe(
					true
				);
			});

			it('should grant multiple shared locks on a file', async () => {
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

				const php1Script = `${testId}-shared-one.php`;
				await writeScript(
					php1Script,
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
					echo json_encode([
						'pid' => getmypid(),
						'lock_acquired' => $lockResult,
					]);
					`
				);

				const php2Script = `${testId}-shared-two.php`;
				await writeScript(
					php2Script,
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
					echo json_encode([
						'pid' => getmypid(),
						'lock_acquired' => $lockResult,
					]);
					`
				);

				const php3Script = `${testId}-shared-three.php`;
				await writeScript(
					php3Script,
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
					echo json_encode([
						'pid' => getmypid(),
						'lock_acquired' => $lockResult,
					]);
					`
				);

				const [resp1, resp2, resp3] = await Promise.all([
					fetchScript(php1Script),
					fetchScript(php2Script),
					fetchScript(php3Script),
				]);
				expect(resp1.status).toBe(200);
				expect(resp2.status).toBe(200);
				expect(resp3.status).toBe(200);
				const [out1, out2, out3] = await Promise.all([
					resp1.json(),
					resp2.json(),
					resp3.json(),
				]);

				assertProcessIdsFromDifferentWorkers(
					out1.pid,
					out2.pid,
					out3.pid
				);

				expect(out1.lock_acquired).toBe(true);
				expect(out2.lock_acquired).toBe(true);
				expect(out3.lock_acquired).toBe(true);
			});

			it('should release a shared lock when its associated file descriptor is closed', async () => {
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

				const php1Script = `${testId}-shared-close-locker.php`;
				await writeScript(
					php1Script,
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

					echo json_encode([
						'pid' => getmypid(),
					]);
					`
				);

				const php2Script = `${testId}-shared-close-contender.php`;
				await writeScript(
					php2Script,
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
						'pid' => getmypid(),
						'attempt_while_locked' => $attempt_while_locked,
						'attempt_after_fd_closed' => $attempt_after_fd_closed,
					]);
					file_put_contents('${coordinationFile}', 'done');
					`
				);

				const [sharedResponse, exclusiveResponse] = await Promise.all([
					fetchScript(php1Script),
					fetchScript(php2Script),
				]);
				expect(sharedResponse.status).toBe(200);
				expect(exclusiveResponse.status).toBe(200);
				const sharedOutput = await sharedResponse.json();
				const exclusiveOutput = await exclusiveResponse.json();

				assertProcessIdsFromDifferentWorkers(
					sharedOutput.pid,
					exclusiveOutput.pid
				);

				expect(exclusiveOutput.attempt_while_locked.lock_acquired).toBe(
					false
				);
				expect(
					exclusiveOutput.attempt_after_fd_closed.lock_acquired
				).toBe(true);
			});

			it('should release an exclusive lock when its associated file descriptor is closed', async () => {
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

				const php1Script = `${testId}-exclusive-close-locker.php`;
				await writeScript(
					php1Script,
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

					echo json_encode([
						'pid' => getmypid(),
					]);
					`
				);

				const php2Script = `${testId}-shared-after-close.php`;
				await writeScript(
					php2Script,
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
						'pid' => getmypid(),
						'attempt_while_locked' => $attempt_while_locked,
						'attempt_after_fd_closed' => $attempt_after_fd_closed,
					]);
					file_put_contents('${coordinationFile}', 'done');
					`
				);

				const [exclusiveResponse, sharedResponse] = await Promise.all([
					fetchScript(php1Script),
					fetchScript(php2Script),
				]);
				expect(exclusiveResponse.status).toBe(200);
				expect(sharedResponse.status).toBe(200);
				const exclusiveOutput = await exclusiveResponse.json();
				const sharedOutput = await sharedResponse.json();

				assertProcessIdsFromDifferentWorkers(
					exclusiveOutput.pid,
					sharedOutput.pid
				);

				expect(sharedOutput.attempt_while_locked.lock_acquired).toBe(
					false
				);
				expect(sharedOutput.attempt_after_fd_closed.lock_acquired).toBe(
					true
				);
			});

			it('should release a shared lock when the owning process exits', async () => {
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

				const php1Script = `${testId}-shared-owner-exit.php`;
				await writeScript(
					php1Script,
					`<?php
					$fp = fopen('${testFilePath}', 'r+');
					flock($fp, LOCK_SH | LOCK_NB);
					file_put_contents('${coordinationFile}', 'php1-locked');
					while (file_get_contents('${coordinationFile}') !== 'php2-confirmed-file-locked') {
						usleep(100 * 1000);
					}

					echo json_encode([
						'pid' => getmypid(),
					]);

					// Leave communicating PHP1 end-of-script to the test case which owns PHP1.
					`
				);

				const php2Script = `${testId}-exclusive-after-shared-exit.php`;
				await writeScript(
					php2Script,
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
						'pid' => getmypid(),
						'attempt_while_locked' => $attempt_while_locked,
						'attempt_after_exit' => $attempt_after_exit,
					]);
					fclose($fp);
					`
				);

				const promisedSharedResponse = fetchScript(php1Script);
				const promisedExclusiveResponse = fetchScript(php2Script);

				const sharedResponse = await promisedSharedResponse;
				await cliServer.playground.writeFile(
					coordinationFile,
					'php1-end-of-script'
				);
				const exclusiveResponse = await promisedExclusiveResponse;

				expect(sharedResponse.status).toBe(200);
				expect(exclusiveResponse.status).toBe(200);
				const sharedOutput = await sharedResponse.json();
				const exclusiveOutput = await exclusiveResponse.json();

				assertProcessIdsFromDifferentWorkers(
					sharedOutput.pid,
					exclusiveOutput.pid
				);

				expect(exclusiveOutput.attempt_while_locked).toBe(false);
				expect(exclusiveOutput.attempt_after_exit).toBe(true);
			});

			it('should release an exclusive lock when the owning process exits', async () => {
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

				const php1Script = `${testId}-exclusive-owner-exit.php`;
				await writeScript(
					php1Script,
					`<?php
					$fp = fopen('${testFilePath}', 'r+');
					flock($fp, LOCK_EX | LOCK_NB);
					file_put_contents('${coordinationFile}', 'php1-locked');
					while (file_get_contents('${coordinationFile}') !== 'php2-confirmed-file-locked') {
						usleep(100 * 1000);
					}

					echo json_encode([
						'pid' => getmypid(),
					]);

					// Leave communicating PHP1 end-of-script to the test case which owns PHP1.
					`
				);

				const php2Script = `${testId}-shared-after-exclusive-exit.php`;
				await writeScript(
					php2Script,
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
						'pid' => getmypid(),
						'attempt_while_locked' => $attempt_while_locked,
						'attempt_after_exit' => $attempt_after_exit,
					]);
					fclose($fp);
					`
				);

				const promisedExclusiveResponse = fetchScript(php1Script);
				const promisedSharedResponse = fetchScript(php2Script);

				const exclusiveResponse = await promisedExclusiveResponse;
				await cliServer.playground.writeFile(
					coordinationFile,
					'php1-end-of-script'
				);
				const sharedResponse = await promisedSharedResponse;

				expect(exclusiveResponse.status).toBe(200);
				expect(sharedResponse.status).toBe(200);
				const exclusiveOutput = await exclusiveResponse.json();
				const sharedOutput = await sharedResponse.json();

				assertProcessIdsFromDifferentWorkers(
					exclusiveOutput.pid,
					sharedOutput.pid
				);

				expect(sharedOutput.attempt_while_locked).toBe(false);
				expect(sharedOutput.attempt_after_exit).toBe(true);
			});
		},
		TEST_CASE_TIMEOUT
	);
});
