/**
 * Test suite for legacy PHP versions (5.6).
 *
 * This is a SEPARATE test suite from the main PHP 7.4-8.5 tests.
 * It tests basic functionality for legacy PHP versions that have
 * been compiled to WebAssembly for WordPress Playground.
 *
 * Run independently with:
 *   npx nx run php-wasm-node:test-legacy-php
 */
import { existsSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { spawn } from 'child_process';
import { PHP, setPhpIniEntries } from '@php-wasm/universal';
import { loadNodeRuntime } from '../lib';

const legacyVersions = ['5.6'] as const;

const nodeBuildsRoot = resolve(__dirname, '../../../node-builds');

/**
 * Check if a legacy PHP version has actual compiled WASM binaries
 * available, not just placeholder directories. Checks both asyncify
 * and jspi variants — if either has a real .wasm file, the version
 * is considered built.
 */
function isVersionBuilt(version: string): boolean {
	const dirName = version.replace('.', '-');
	const [major, minor] = version.split('.');
	const wasmFilename = `php_${major}_${minor}.wasm`;
	for (const variant of ['asyncify', 'jspi']) {
		const wasmDir = resolve(nodeBuildsRoot, dirName, variant);
		// Check for the actual WASM binary in the patch-version subdirectory
		const entries = existsSync(wasmDir)
			? readdirSync(wasmDir).filter((e) =>
					e.startsWith(`${major}_${minor}`)
				)
			: [];
		for (const entry of entries) {
			if (
				existsSync(resolve(wasmDir, entry, wasmFilename))
			) {
				return true;
			}
		}
	}
	return false;
}

describe('Legacy PHP versions (5.x)', () => {
	it('detects legacy version availability', () => {
		const available = legacyVersions.filter(isVersionBuilt);
		// This test documents which legacy versions have binaries.
		// When no binaries are compiled, all functional tests are
		// skipped via it.skipIf(!available).
		expect(available.length).toBeGreaterThanOrEqual(0);
	});

	describe.each(legacyVersions)('PHP %s', (phpVersion) => {
		const available = isVersionBuilt(phpVersion);
		let php: PHP;

		beforeEach(async () => {
			if (!available) {
				return;
			}
			php = new PHP(await loadNodeRuntime(phpVersion));
			php.setSpawnHandler(spawn as any);
			await setPhpIniEntries(php, {
				disable_functions: '',
				html_errors: false,
			});
		});

		afterEach(() => {
			if (available && php) {
				php.exit();
			}
		});

		it.skipIf(!available)('reports correct PHP version', async () => {
			const result = await php.run({
				code: '<?php echo PHP_MAJOR_VERSION . "." . PHP_MINOR_VERSION;',
			});
			expect(result.text).toBe(phpVersion);
		});

		it.skipIf(!available)('basic execution: echo Hello World', async () => {
			const result = await php.run({
				code: '<?php echo "Hello World";',
			});
			expect(result.text).toBe('Hello World');
		});

		it.skipIf(!available)(
			'file I/O: file_put_contents and file_get_contents',
			async () => {
				const result = await php.run({
					code: `<?php
					file_put_contents('/tmp/legacy_test.txt', 'legacy php');
					echo file_get_contents('/tmp/legacy_test.txt');
				`,
				});
				expect(result.text).toBe('legacy php');
			}
		);

		it.skipIf(!available)(
			'networking: gethostbyname does not crash',
			async () => {
				const result = await php.run({
					code: `<?php
					$result = gethostbyname('localhost');
					echo is_string($result) ? 'ok' : 'fail';
				`,
				});
				expect(result.text).toBe('ok');
			}
		);

		it.skipIf(!available)('proc_open: basic process spawning', async () => {
			const result = await php.run({
				code: `<?php
					$desc = array(
						1 => array("pipe", "w"),
						2 => array("pipe", "w")
					);
					$proc = proc_open("echo hello", $desc, $pipes);
					if (!is_resource($proc)) {
						echo 'not_supported';
					} else {
						$stdout = stream_get_contents($pipes[1]);
						proc_close($proc);
						echo trim($stdout);
					}
				`,
			});
			// PHP 5.x uses stubs that return false;
			// PHP 7+ has full proc_open support.
			expect(['hello', 'not_supported']).toContain(result.text);
		});

		it.skipIf(!available)(
			'SQLite: CREATE TABLE, INSERT, SELECT',
			async () => {
				const result = await php.run({
					code: `<?php
					$db = new SQLite3(':memory:');
					$db->exec('CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)');
					$db->exec("INSERT INTO t (name) VALUES ('Alice')");
					$row = $db->querySingle("SELECT name FROM t WHERE id = 1");
					echo $row;
					$db->close();
				`,
				});
				expect(result.text).toBe('Alice');
			}
		);

		it.skipIf(!available)('JSON: json_encode and json_decode', async () => {
			const result = await php.run({
				code: `<?php
					$data = array('key' => 'value', 'num' => 42);
					$json = json_encode($data);
					$decoded = json_decode($json, true);
					echo $decoded['key'] . ':' . $decoded['num'];
				`,
			});
			expect(result.text).toBe('value:42');
		});

		it.skipIf(!available)('session: session_start', async () => {
			const result = await php.run({
				code: `<?php
					session_start();
					$_SESSION['test'] = 'legacy';
					echo $_SESSION['test'];
				`,
			});
			expect(result.text).toBe('legacy');
		});

		it.skipIf(!available)('strings: mbstring functions', async () => {
			const result = await php.run({
				code: `<?php
					echo mb_strtoupper('hello') . ':' . mb_strlen('test');
				`,
			});
			expect(result.text).toBe('HELLO:4');
		});

		it.skipIf(!available)('error handling: set_error_handler', async () => {
			const result = await php.run({
				code: `<?php
					set_error_handler(function($errno, $errstr) {
						echo "caught:" . $errstr;
					});
					trigger_error("test_error", E_USER_NOTICE);
				`,
			});
			expect(result.text).toBe('caught:test_error');
		});

		it.skipIf(!available)(
			'memory: allocate arrays and check memory_get_usage',
			async () => {
				const result = await php.run({
					code: `<?php
					$before = memory_get_usage();
					$arr = array_fill(0, 10000, 'x');
					$after = memory_get_usage();
					echo ($after > $before) ? 'allocated' : 'failed';
				`,
				});
				expect(result.text).toBe('allocated');
			}
		);

		it.skipIf(!available)('filesystem: mkdir, is_dir, rmdir', async () => {
			const result = await php.run({
				code: `<?php
					mkdir('/tmp/legacy_dir');
					echo is_dir('/tmp/legacy_dir') ? 'yes' : 'no';
					rmdir('/tmp/legacy_dir');
					echo ':';
					echo is_dir('/tmp/legacy_dir') ? 'yes' : 'no';
				`,
			});
			expect(result.text).toBe('yes:no');
		});
	});
});
