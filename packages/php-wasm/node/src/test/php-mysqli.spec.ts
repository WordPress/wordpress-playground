import fs from 'fs';
import path from 'path';
import {
	PHP,
	SupportedPHPVersions,
	setPhpIniEntries,
} from '@php-wasm/universal';
// eslint-disable-next-line @nx/enforce-module-boundaries
import InitialDockerfile from '../../../compile/php/Dockerfile?raw';
import { loadNodeRuntime } from '../lib';
import { jspi } from 'wasm-feature-detect';

const runtimeMode = (await jspi()) ? 'jspi' : 'asyncify';

const phpVersions =
	'PHP' in process.env ? [process.env['PHP']] : SupportedPHPVersions;

// Run MySQL functions if credentials are provided
const mysqlCredentials = {
	host: process.env['MYSQL_HOST'] ?? '127.0.0.1',
	user: process.env['MYSQL_USER'],
	password: process.env['MYSQL_PASSWORD'],
	database: process.env['MYSQL_DATABASE'],
	port: process.env['MYSQL_PORT'] ?? '3306',
};

describe('MySQL network functions', () => {
	if (
		!mysqlCredentials.host ||
		!mysqlCredentials.user ||
		!mysqlCredentials.password ||
		!mysqlCredentials.database
	) {
		test.skip(
			'Skipping MySQL network functions because no credentials were provided.'
		);
		console.log(`
			Skipping MySQL network functions because no credentials were provided.

			To run MySQL network function tests, set the following environment variables:
			- MYSQL_HOST
			- MYSQL_USER
			- MYSQL_PASSWORD
			- MYSQL_DATABASE

			Use 127.0.0.1 instead of localhost to ensure MySQL uses
			TCP instead of socket, because MySQL in Playground
			still doesn't support sockets.
		`);
		return;
	}
	describe.each(phpVersions)(`PHP %s – ${runtimeMode}`, (phpVersion) => {
		let php: PHP;
		beforeEach(async () => {
			php = new PHP(await loadNodeRuntime(phpVersion as any));
			await setPhpIniEntries(php, { allow_url_fopen: 1 });
		});

		afterEach(async () => {
			php.exit();
		});

		test('MySQL network functions', () => {
			assertNoCrash(`
				$mysqli = new mysqli(
					"${mysqlCredentials.host}",
					"${mysqlCredentials.user}",
					"${mysqlCredentials.password}",
					"${mysqlCredentials.database}",
					${mysqlCredentials.port}
				);
				if (mysqli_connect_errno()) {
					// This should crash the process I hope
					klfhjkljfkdjfd();
				}
				mysqli_ping($mysqli);
				mysqli_query($mysqli, "SELECT 1");
				mysqli_multi_query($mysqli, "SELECT 1; SELECT 2;");
				mysqli_get_server_info($mysqli);
				mysqli_get_server_version($mysqli);
				mysqli_get_proto_info($mysqli);
				mysqli_close($mysqli);
			`);
		});

		test('Can connect to "localhost"', () => {
			assertNoCrash(`
				$mysqli = new mysqli(
					"localhost",
					"${mysqlCredentials.user}",
					"${mysqlCredentials.password}",
					"${mysqlCredentials.database}",
					${mysqlCredentials.port}
				);
				if (mysqli_connect_errno()) {
					// This should crash the process I hope
					klfhjkljfkdjfd();
				}
				mysqli_ping($mysqli);
				mysqli_query($mysqli, "SELECT 1");
				mysqli_multi_query($mysqli, "SELECT 1; SELECT 2;");
				mysqli_get_server_info($mysqli);
				mysqli_get_server_version($mysqli);
				mysqli_get_proto_info($mysqli);
				mysqli_close($mysqli);
			`);
		});

		test('mysqli_poll honors its timeout while a query waits on a lock', async () => {
			const result = await php.run({
				code: `<?php
					mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
					$first = null;
					$second = null;
					$table = 'playground_mysqli_poll_timeout_${String(phpVersion).replace('.', '_')}_' . bin2hex(random_bytes(6));
					$table_created = false;
					$first_transaction = false;
					$second_transaction = false;
					$query_pending = false;
					try {
						$first = new mysqli(
							"${mysqlCredentials.host}",
							"${mysqlCredentials.user}",
							"${mysqlCredentials.password}",
							"${mysqlCredentials.database}",
							${mysqlCredentials.port}
						);
						$second = new mysqli(
							"${mysqlCredentials.host}",
							"${mysqlCredentials.user}",
							"${mysqlCredentials.password}",
							"${mysqlCredentials.database}",
							${mysqlCredentials.port}
						);
						$first->query("CREATE TABLE $table (id INT PRIMARY KEY) ENGINE=InnoDB");
						$table_created = true;
						$first->query("INSERT INTO $table VALUES (1)");
						$first->begin_transaction();
						$first_transaction = true;
						$first->query("SELECT id FROM $table WHERE id = 1 FOR UPDATE");
						$second->begin_transaction();
						$second_transaction = true;
						$second->query(
							"SELECT id FROM $table WHERE id = 1 FOR UPDATE",
							MYSQLI_ASYNC
						);
						$query_pending = true;
						$read = array($second);
						$error = array();
						$reject = array();
						$started = microtime(true);
						$ready = mysqli_poll($read, $error, $reject, 0, 100000);
						$elapsed_ms = (microtime(true) - $started) * 1000;
						$timeout_set_counts = array(count($read), count($error), count($reject));
						$first->rollback();
						$first_transaction = false;
						$cleanup_ready = false;
						for ($attempt = 0; $attempt < 20; $attempt++) {
							$read = array($second);
							$error = array();
							$reject = array();
							if (mysqli_poll($read, $error, $reject, 0, 100000) > 0) {
								$cleanup_ready = true;
								break;
							}
						}
						if (!$cleanup_ready) {
							throw new RuntimeException('Async query did not become ready after releasing the lock');
						}
						$second->reap_async_query();
						$query_pending = false;
						$second->rollback();
						$second_transaction = false;
					} finally {
						if ($first_transaction && $first instanceof mysqli) {
							try { $first->rollback(); } catch (Throwable $e) {}
						}
						if ($second instanceof mysqli) {
							if ($second_transaction && !$query_pending) {
								try { $second->rollback(); } catch (Throwable $e) {}
							}
							try { $second->close(); } catch (Throwable $e) {}
						}
						if ($table_created && $first instanceof mysqli) {
							try { $first->query("DROP TABLE $table"); } catch (Throwable $e) {}
						}
						if ($first instanceof mysqli) {
							try { $first->close(); } catch (Throwable $e) {}
						}
					}
					echo json_encode(array(
						'ready' => $ready,
						'elapsed_ms' => $elapsed_ms,
						'timeout_set_counts' => $timeout_set_counts,
						'cleanup_ready' => $cleanup_ready,
					));
				`,
			});
			expect(result.errors).toBeFalsy();
			const output = JSON.parse(result.text);
			expect(output.ready).toBe(0);
			expect(output.elapsed_ms).toBeGreaterThanOrEqual(50);
			expect(output.elapsed_ms).toBeLessThan(2_000);
			expect(output.timeout_set_counts).toEqual([0, 0, 0]);
			expect(output.cleanup_ready).toBe(true);
		});

		async function assertNoCrash(code: string) {
			try {
				const result = await php.run({
					code: `<?php ${code}`,
				});
				expect(result).toBeTruthy();
				expect(result.text).toBe('');
				expect(result.errors).toBeFalsy();
			} catch (e) {
				if (
					'FIX_DOCKERFILE' in process.env &&
					process.env['FIX_DOCKERFILE'] === 'true' &&
					runtimeMode == 'asyncify' &&
					'functionsMaybeMissingFromAsyncify' in php
				) {
					const missingCandidates = (
						php.functionsMaybeMissingFromAsyncify as string[]
					)
						.map((candidate) =>
							candidate.replace('byn$fpcast-emu$', '')
						)
						.filter(
							(candidate) =>
								!Dockerfile.includes(`"${candidate}"`)
						);
					if (missingCandidates.length) {
						addAsyncifyFunctionsToDockerfile(missingCandidates);
						throw new Error(
							`Asyncify crash! The following missing functions were just auto-added to the ASYNCIFY_ONLY list in the Dockerfile: \n ` +
								missingCandidates.join(', ') +
								`\nYou now need to rebuild PHP and re-run this test: \n` +
								`  npm run recompile:php:node:asyncify:8.0\n` +
								`  node --stack-trace-limit=100 ./node_modules/.bin/nx test php-wasm-node --test-name-pattern='asyncify'\n`
						);
					}

					const err = new Error(
						`Asyncify crash! No C functions present in the stack trace were missing ` +
							`from the Dockerfile. This could mean the stack trace is too short – try increasing the stack trace limit ` +
							`with --stack-trace-limit=100. If you already did that, fixing this problem will likely take more digging.`
					);
					err.cause = e;
					throw err;
				}
			}
		}
	});
});

let Dockerfile = InitialDockerfile;
const DockerfilePath = path.resolve(
	__dirname,
	'../../../compile/php/Dockerfile'
);
function addAsyncifyFunctionsToDockerfile(functions: string[]) {
	const currentDockerfile = fs.readFileSync(DockerfilePath, 'utf8') + '';
	const lookup = `export ASYNCIFY_ONLY=$'`;
	const idx = currentDockerfile.indexOf(lookup) + lookup.length;
	const updatedDockerfile =
		currentDockerfile.substring(0, idx) +
		functions.map((f) => `"${f}",\\\n`).join('') +
		currentDockerfile.substring(idx);
	fs.writeFileSync(DockerfilePath, updatedDockerfile);
	Dockerfile = updatedDockerfile;
}
