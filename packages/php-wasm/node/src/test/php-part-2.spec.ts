import {
	__private__dont__use,
	loadPHPRuntime,
	PHP,
	PHPProcessManager,
	sandboxedSpawnHandlerFactory,
	setPhpIniEntries,
	type SpawnedPHP,
	SupportedPHPVersions,
} from '@php-wasm/universal';
import { joinPaths } from '@php-wasm/util';
import { RecommendedPHPVersion } from '@wp-playground/common';
import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	statfsSync,
	writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { vi } from 'vitest';
import type { PHPLoaderOptions } from '..';
import { getPHPLoaderModule, loadNodeRuntime } from '..';
import { createNodeFsMountHandler } from '../lib/node-fs-mount';

const phpVersions =
	'PHP' in process.env ? [process.env['PHP']!] : SupportedPHPVersions;

const phpLoaderOptions: PHPLoaderOptions[] = [{}, { withXdebug: true }];

phpLoaderOptions.forEach((options) => {
	// Tests are skipped when Xdebug is enabled because Xdebug alters PHP's
	// output format and process behavior, which breaks exact text assertions.
	// These tests cover core features that only need to run once without Xdebug.
	const skip = !!options.withXdebug;

	describe.each(phpVersions)('PHP %s', (phpVersion) => {
		let php: PHP;
		beforeEach(async () => {
			php = new PHP(await loadNodeRuntime(phpVersion as any, options));
			php.mkdir('/php');
			await setPhpIniEntries(php, {
				disable_functions: '',
				html_errors: false,
			});
		});
		afterEach(async () => {
			php.exit();
		});

		describe('Exit codes', { skip }, () => {
			describe('Returns exit code 0', () => {
				const testsSnippets = {
					'on empty code': '',
					'on successful run': '<?php echo "Hello world!";',
					'on notice':
						'<?php trigger_error("This is a custom notice!", E_USER_NOTICE);',
					'on warning':
						'<?php trigger_error("This is a custom warning!", E_USER_WARNING);',
					'on deprecated error':
						'<?php trigger_error("This is a custom deprecation info!", E_USER_DEPRECATED);',
					'on a warning issued by an incorrect usage of PHP':
						'<?php echo $test; ',
					'on die()': '<?php die();',
					'on die("test")': '<?php die("Test");',
					'on exit()': '<?php exit();',
					'on exit(0)': '<?php exit(0);',
				};
				for (const [testName, testSnippet] of Object.entries(
					testsSnippets
				)) {
					// Run via `code`
					it(testName, async () => {
						const result = await php.run({
							code: testSnippet,
						});
						expect(result.exitCode).toEqual(0);
					});

					// Run via request handler
					it(testName, async () => {
						php.writeFile('/test.php', testSnippet);
						const result = await php.run({
							scriptPath: '/test.php',
						});
						expect(result.exitCode).toEqual(0);
					});
				}
			});
			describe('Returns exit code > 0', () => {
				const testsSnippets = {
					'syntax error': '<?php @$!;',
					'undefined function call': '<?php no_such_function();',
					'on fatal error':
						'<?php trigger_error("This is a custom fatal error!", E_USER_ERROR);',
					'on exit(1)': '<?php exit(1);',
					'on uncaught exception': '<?php throw new Exception();',
				};
				for (const [testName, testSnippet] of Object.entries(
					testsSnippets
				)) {
					// Run via `code`
					it(testName, async () => {
						const promise = php.run({
							code: testSnippet,
						});
						await expect(promise).rejects.toThrow();
					});

					// Run via the request handler
					it(testName, async () => {
						php.writeFile('/test.php', testSnippet);
						const promise = php.run({
							scriptPath: '/test.php',
						});
						await expect(promise).rejects.toThrow();
					});
				}
			});
			it('Returns the correct exit code on subsequent runs', async () => {
				const promise1 = php.run({
					code: '<?php throw new Exception();',
				});
				// expect(result1.exitCode).toBe(255);
				await expect(promise1).rejects.toThrow(
					'PHP.run() failed with exit code 255'
				);

				const result2 = await php.run({
					code: '<?php exit(0);',
				});
				expect(result2.exitCode).toBe(0);

				const promise3 = php.run({
					code: '<?php exit(1);',
				});
				await expect(promise3).rejects.toThrow(
					'PHP.run() failed with exit code 1'
				);
			});
			it('After failure, returns the correct exit code on subsequent runs', async () => {
				const promise1 = php.run({
					code: '<?php throw new Exception();',
				});
				// expect(result1.exitCode).toBe(255);
				await expect(promise1).rejects.toThrow(
					'PHP.run() failed with exit code 255'
				);

				const result2 = await php.run({
					code: '<?php ',
				});
				expect(result2.exitCode).toBe(0);

				const promise3 = php.run({
					code: '<?php exit(1);',
				});
				await expect(promise3).rejects.toThrow(
					'PHP.run() failed with exit code 1'
				);
			});
		});

		describe('Stdio', { skip }, () => {
			it('should output strings (1)', async () => {
				expect(
					await php.run({ code: '<?php echo "Hello world!";' })
				).toEqual({
					headers: expect.any(Object),
					httpStatusCode: 200,
					bytes: new TextEncoder().encode('Hello world!'),
					errors: '',
					exitCode: 0,
				});
			});
			it('should output strings (2) ', async () => {
				expect(
					await php.run({
						code: '<?php echo "Hello world!\nI am PHP";',
					})
				).toEqual({
					headers: expect.any(Object),
					httpStatusCode: 200,
					bytes: new TextEncoder().encode('Hello world!\nI am PHP'),
					errors: '',
					exitCode: 0,
				});
			});
			it('should output bytes ', async () => {
				const results = await php.run({
					code: '<?php echo chr(1).chr(0).chr(1).chr(0).chr(2); ',
				});
				expect(results).toEqual({
					headers: expect.any(Object),
					httpStatusCode: 200,
					bytes: new Uint8Array([1, 0, 1, 0, 2]),
					errors: '',
					exitCode: 0,
				});
			});
			it('should output strings when .run() is called twice', async () => {
				expect(
					await php.run({ code: '<?php echo "Hello world!";' })
				).toEqual({
					headers: expect.any(Object),
					httpStatusCode: 200,
					bytes: new TextEncoder().encode('Hello world!'),
					errors: '',
					exitCode: 0,
				});

				expect(
					await php.run({ code: '<?php echo "Ehlo world!";' })
				).toEqual({
					headers: expect.any(Object),
					httpStatusCode: 200,
					bytes: new TextEncoder().encode('Ehlo world!'),
					errors: '',
					exitCode: 0,
				});
			});
			it('should capture error data from stderr', async () => {
				const code = `<?php
					$stdErr = fopen('php://stderr', 'w');
					fwrite($stdErr, "Hello from stderr!");
					`;
				expect(await php.run({ code })).toEqual({
					headers: expect.any(Object),
					httpStatusCode: 200,
					bytes: new TextEncoder().encode(''),
					errors: 'Hello from stderr!',
					exitCode: 0,
				});
			});
			it('should provide response text through .text', async () => {
				const code = `<?php
					echo "Hello world!";
					`;
				const response = await php.run({ code });
				expect(response.text).toEqual('Hello world!');
			});
			it('should provide response JSON through .json', async () => {
				const code = `<?php
					echo json_encode(["hello" => "world"]);
					`;
				const response = await php.run({ code });
				expect(response.json).toEqual({ hello: 'world' });
			});
		});

		describe('Interface', { skip }, () => {
			it('run() should throw an error when neither `code` nor `scriptFile` is provided', async () => {
				await expect(() => php.run({})).rejects.toThrowError(
					/The request object must have either a `code` or a `scriptPath` property/
				);
			});
		});

		describe('Startup sequence – basics', { skip }, () => {
			/**
			 * This test ensures that the PHP runtime can be loaded twice.
			 *
			 * It protects from a regression that happened in the past
			 * after making the Emscripten module's main function the
			 * default export. Turns out, the generated Emscripten code
			 * replaces the default export with an instantiated module upon
			 * the first call.
			 */
			it('Should spawn two PHP runtimes', async () => {
				const phpLoaderModule1 = await getPHPLoaderModule(
					phpVersion as any
				);
				const runtimeId1 = await loadPHPRuntime(phpLoaderModule1);

				const phpLoaderModule2 = await getPHPLoaderModule(
					phpVersion as any
				);
				const runtimeId2 = await loadPHPRuntime(phpLoaderModule2);

				expect(runtimeId1).not.toEqual(runtimeId2);
			});
		});

		describe('Startup sequence', { skip }, () => {
			const testScriptPath = '/test.php';
			afterEach(() => {
				if (existsSync(testScriptPath)) {
					rmSync(testScriptPath);
				}
			});

			/**
			 * Issue https://github.com/WordPress/wordpress-playground/issues/169
			 */
			it('Should work with long POST body', async () => {
				php.writeFile(testScriptPath, '<?php echo "Hello world!"; ?>');
				const body = new Uint8Array(
					readFileSync(
						new URL(
							'./test-data/long-post-body.txt',
							import.meta.url
						).pathname
					)
				);
				// 0x4000 is SAPI_POST_BLOCK_SIZE
				expect(body.length).toBeGreaterThan(0x4000);
				await expect(
					php.run({
						code: 'echo "A";',
						relativeUri: '/test.php?a=b',
						body,
						method: 'POST',
						headers: {
							'Content-Type': 'application/x-www-form-urlencoded',
						},
					})
				).resolves.not.toThrow();
			});

			it('Should run a script when no code snippet is provided', async () => {
				php.writeFile(
					testScriptPath,
					`<?php echo "Hello world!"; ?>\n`
				);
				const response = await php.run({
					scriptPath: testScriptPath,
				});
				const bodyText = new TextDecoder().decode(response.bytes);
				expect(bodyText).toEqual('Hello world!');
			});

			it('Should run a code snippet when provided, even if scriptPath is set', async () => {
				php.writeFile(testScriptPath, '<?php echo "Hello world!"; ?>');
				const response = await php.run({
					scriptPath: testScriptPath,
					code: '<?php echo "Hello from a code snippet!";',
				});
				const bodyText = new TextDecoder().decode(response.bytes);
				expect(bodyText).toEqual('Hello from a code snippet!');
			});

			it('Should have access to raw request data via the php://input stream', async () => {
				const response = await php.run({
					headers: { 'Content-Type': 'application/json' },
					method: 'POST',
					body: new TextEncoder().encode('{"foo": "bar"}'),
					code: `<?php echo file_get_contents('php://input');`,
				});
				const bodyText = new TextDecoder().decode(response.bytes);
				expect(bodyText).toEqual('{"foo": "bar"}');
			});

			it('Can accept a request body with a size of 1MB without crashing', async () => {
				php.writeFile('/php/index.php', `<?php echo 'Hello World';`);
				const response = await php.run({
					scriptPath: '/php/index.php',
					body: new TextEncoder().encode('#'.repeat(1024 * 1024)),
				});
				expect(response.httpStatusCode).toEqual(200);
				expect(response.text).toEqual('Hello World');
				expect(response.errors).toEqual('');
				expect(response.exitCode).toEqual(0);
			});

			it('Can accept a request body with a size of ~512MB without crashing', async () => {
				php.writeFile('/php/index.php', `<?php echo 'Hello World';`);
				const response = await php.run({
					scriptPath: '/php/index.php',
					body: new TextEncoder().encode(
						'#'.repeat(1024 * 1024 * 512 + -24)
					),
				});
				expect(response.httpStatusCode).toEqual(200);
				expect(response.text).toEqual('Hello World');
				expect(response.errors).toEqual('');
				expect(response.exitCode).toEqual(0);
			});

			it('Frees up the heap memory after handling a request body with a size of ~400MB', async () => {
				const estimateFreeMemory = () =>
					php[__private__dont__use].HEAPU32.reduce(
						(count: number, byte: number) =>
							byte === 0 ? count + 1 : count,
						0
					) / 4;

				// The initial request will allocate a lot of memory so let's get that
				// out of the way before we start measuring.
				php.writeFile('/php/index.php', `<?php echo 'Hello World';`);
				await php.run({ scriptPath: '/php/index.php' });

				// Overwrite the memory-related functions to:
				// * Capture the body HEAP pointer
				// * Capture the encoded body length
				// * Overwrite the HEAP memory with zeros after freeing the
				//   body pointer.
				// This will allow us to estimate the amount of the memory that
				// was not freed after the request.
				const body = '#'.repeat(1024 * 1024 * 400 - 24);

				let contentLength = 0;
				const _lengthBytesUTF8 =
					php[__private__dont__use].lengthBytesUTF8;
				php[__private__dont__use].lengthBytesUTF8 = function (
					data: string
				) {
					const retval = _lengthBytesUTF8.call(this, data);
					if (data === body) {
						contentLength = retval;
					}
					return retval;
				};

				let bodyPtr = 0;
				const malloc = php[__private__dont__use].malloc;
				php[__private__dont__use].malloc = function newMalloc(
					size: number,
					...args: any
				) {
					const retval = malloc.call(this, size, ...args);
					if (size === contentLength + 1) {
						bodyPtr = retval;
					}
					return retval;
				};

				const free = php[__private__dont__use].free;
				php[__private__dont__use].free = function (
					addr: number,
					...args: any
				) {
					const retval = free.call(this, ...args);
					if (addr === bodyPtr) {
						php[__private__dont__use].HEAPU8.fill(
							0,
							addr,
							addr + contentLength
						);
					}
					return retval;
				};

				const getFreeMemoryBefore = estimateFreeMemory();

				php.writeFile('/php/index.php', `<?php echo 'Hello World';`);
				await php.run({
					scriptPath: '/php/index.php',
					body,
				});

				const getFreeMemoryAfter = estimateFreeMemory();

				// PHP has a memory leak, so we can't expect the memory to be exactly
				// the same as before the request, but it should be close to the original
				// value. Let's abitrarily pick 100KB as the "close enough" threshold.
				//
				// @see https://github.com/WordPress/wordpress-playground/pull/990 for more
				//      details on the memory leak in PHP.
				const memoryDifference =
					getFreeMemoryBefore - getFreeMemoryAfter;
				expect(memoryDifference).toBeLessThan(100 * 1024);
			});

			it('Should set $_SERVER entries for provided headers', async () => {
				const response = await php.run({
					code: `<?php echo json_encode($_SERVER);`,
					method: 'POST',
					body: new TextEncoder().encode('foo=bar'),
					headers: {
						'Content-Type': 'text/plain',
						'Content-Length': '15',
						'User-agent': 'my-user-agent',
						'custom-header': 'custom value',
						'x-test': 'x custom value',
					},
				});
				const json = response.json;
				expect(json).toHaveProperty('HTTP_USER_AGENT', 'my-user-agent');
				expect(json).toHaveProperty(
					'HTTP_CUSTOM_HEADER',
					'custom value'
				);
				expect(json).toHaveProperty('HTTP_X_TEST', 'x custom value');
				/*
				 * The following headers should be set without the HTTP_ prefix,
				 * as PHP follows the following convention:
				 * https://www.ietf.org/rfc/rfc3875
				 */
				expect(json).toHaveProperty('CONTENT_TYPE', 'text/plain');
				expect(json).toHaveProperty('CONTENT_LENGTH', '15');
			});

			it('Should have appropriate SCRIPT_NAME, SCRIPT_FILENAME and PHP_SELF entries in $_SERVER when serving request', async () => {
				php.writeFile(
					'/php/index.php',
					`<?php echo json_encode($_SERVER);`
				);

				const response = await php.run({
					relativeUri: '/',
					scriptPath: '/php/index.php',
					method: 'GET',
					$_SERVER: {
						DOCUMENT_ROOT: '/php',
					},
				});

				const json = response.json;

				expect(json).toHaveProperty('REQUEST_URI', '/');
				expect(json).toHaveProperty('SCRIPT_NAME', '/index.php');
				expect(json).toHaveProperty(
					'SCRIPT_FILENAME',
					'/php/index.php'
				);
				expect(json).toHaveProperty('PHP_SELF', '/index.php');
			});

			it('Should have appropriate SCRIPT_NAME, SCRIPT_FILENAME and PHP_SELF entries in $_SERVER when running PHP code', async () => {
				const response = await php.run({
					code: '<?php echo json_encode($_SERVER);',
					method: 'GET',
				});

				const json = response.json;

				expect(json).toHaveProperty('REQUEST_URI', '');
				expect(json).toHaveProperty('SCRIPT_NAME', '');
				expect(json).toHaveProperty('SCRIPT_FILENAME', '');
				expect(json).toHaveProperty('PHP_SELF', '');
			});

			it('Should have appropriate SCRIPT_NAME, SCRIPT_FILENAME and PHP_SELF entries in $_SERVER when serving request from a test file in a subdirectory', async () => {
				php.mkdir('/php/subdirectory');

				php.writeFile(
					`/php/subdirectory/test.php`,
					`<?php echo json_encode($_SERVER);`
				);

				const response = await php.run({
					scriptPath: '/php/subdirectory/test.php',
					relativeUri: '/subdirectory/test.php',
					method: 'GET',
					$_SERVER: {
						DOCUMENT_ROOT: '/php',
					},
				});

				const json = response.json;

				expect(json).toHaveProperty(
					'REQUEST_URI',
					'/subdirectory/test.php'
				);
				expect(json).toHaveProperty(
					'SCRIPT_NAME',
					'/subdirectory/test.php'
				);
				expect(json).toHaveProperty(
					'SCRIPT_FILENAME',
					'/php/subdirectory/test.php'
				);
				expect(json).toHaveProperty(
					'PHP_SELF',
					'/subdirectory/test.php'
				);
			});

			it('Should expose urlencoded POST data in $_POST', async () => {
				const response = await php.run({
					code: `<?php echo json_encode($_POST);`,
					method: 'POST',
					body: new TextEncoder().encode('foo=bar'),
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded',
					},
				});
				const bodyText = new TextDecoder().decode(response.bytes);
				expect(bodyText).toEqual('{"foo":"bar"}');
			});

			it('Should expose urlencoded POST arrays in $_POST', async () => {
				const response = await php.run({
					code: `<?php echo json_encode($_POST);`,
					method: 'POST',
					body: new TextEncoder().encode(
						'foo[]=bar1&foo[]=bar2&indexed[key]=value'
					),
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded',
					},
				});
				const bodyText = new TextDecoder().decode(response.bytes);
				expect(bodyText).toEqual(
					'{"foo":["bar1","bar2"],"indexed":{"key":"value"}}'
				);
			});

			it('Should expose multipart POST data in $_POST', async () => {
				const response = await php.run({
					code: `<?php echo json_encode($_POST);`,
					method: 'POST',
					body: new TextEncoder().encode(
						`--boundary\r\n` +
							`Content-Disposition: form-data; name="foo"\r\n` +
							`\r\n` +
							`bar\r\n` +
							`--boundary--\r\n`
					),
					headers: {
						'Content-Type':
							'multipart/form-data; boundary=boundary',
					},
				});
				const bodyText = new TextDecoder().decode(response.bytes);
				expect(bodyText).toEqual('{"foo":"bar"}');
			});

			it('Should expose multipart POST files in $_FILES', async () => {
				const response = await php.run({
					code: `<?php echo json_encode(array(
								"files" => $_FILES,
								"is_uploaded" => is_uploaded_file($_FILES["myFile"]["tmp_name"])
							));`,
					method: 'POST',
					body: new TextEncoder().encode(
						`--boundary\r\n` +
							`Content-Disposition: form-data; name="myFile"; filename="text.txt"\r\n` +
							`Content-Type: text/plain\r\n` +
							`\r\n` +
							`bar\r\n` +
							`--boundary--\r\n`
					),
					headers: {
						'Content-Type':
							'multipart/form-data; boundary=boundary',
					},
				});
				const bodyText = new TextDecoder().decode(response.bytes);
				const expectedResult = {
					files: {
						myFile: {
							name: 'text.txt',
							type: 'text/plain',
							tmp_name: expect.any(String),
							error: 0,
							size: 3,
						},
					},
					is_uploaded: true,
				};
				if (Number(phpVersion) > 8) {
					(expectedResult.files.myFile as any).full_path = 'text.txt';
				}
				expect(JSON.parse(bodyText)).toEqual(expectedResult);
			});

			it('Should provide the correct $_SERVER information', async () => {
				php.writeFile(
					testScriptPath,
					'<?php echo json_encode($_SERVER); ?>'
				);
				const response = await php.run({
					scriptPath: testScriptPath,
					relativeUri: '/test.php?a=b',
					method: 'POST',
					body: new TextEncoder().encode(`--boundary
		Content-Disposition: form-data; name="myFile1"; filename="from_body.txt"
		Content-Type: text/plain

		bar1
		--boundary--`),
					headers: {
						'Content-Type':
							'multipart/form-data; boundary=boundary',
						Host: 'https://example.com:1235',
						'X-is-ajax': 'true',
					},
				});
				const bodyText = new TextDecoder().decode(response.bytes);
				const $_SERVER = JSON.parse(bodyText);
				expect($_SERVER).toHaveProperty('REQUEST_URI', '/test.php?a=b');
				expect($_SERVER).toHaveProperty('REQUEST_METHOD', 'POST');
				expect($_SERVER).toHaveProperty(
					'CONTENT_TYPE',
					'multipart/form-data; boundary=boundary'
				);
				expect($_SERVER).toHaveProperty(
					'HTTP_HOST',
					'https://example.com:1235'
				);
				expect($_SERVER).toHaveProperty(
					'SERVER_NAME',
					'https://example.com:1235'
				);
				expect($_SERVER).toHaveProperty('HTTP_X_IS_AJAX', 'true');
				expect($_SERVER).toHaveProperty('SERVER_PORT', '1235');
				expect($_SERVER).toHaveProperty('QUERY_STRING', 'a=b');
			});

			it('Should have an empty QUERY_STRING when the URI has no query string', async () => {
				const response = await php.run({
					code: `<?php echo json_encode($_SERVER);`,
					relativeUri: '/test.php',
				});
				const bodyText = new TextDecoder().decode(response.bytes);
				const $_SERVER = JSON.parse(bodyText);
				expect($_SERVER).toHaveProperty('QUERY_STRING', '');
			});
		});

		describe('Event dispatching', () => {
			it('Should emit a request.error event when PHP.run() exits with a non-zero exit code', async () => {
				const spyListener = vi.fn();
				php.addEventListener('request.error', spyListener);
				try {
					await php.run({
						code: `<?php throw new Error('mock error');`,
					});
				} catch {
					// Ignore the thrown error
				}
				expect(spyListener).toHaveBeenCalledTimes(1);
				expect(spyListener).toHaveBeenCalledWith({
					type: 'request.error',
					error: new Error('PHP.run() failed with exit code 255.'),
					source: 'php-wasm',
				});
			});
			it('Should emit a request.error event when PHP.runStream() exits with a non-zero exit code', async () => {
				const spyListener = vi.fn();
				php.addEventListener('request.error', spyListener);
				try {
					const response = await php.runStream({
						code: `<?php throw new Error('mock error');`,
					});
					await response.finished;
				} catch {
					// Ignore the thrown error
				}
				expect(spyListener).toHaveBeenCalledTimes(1);
				expect(spyListener).toHaveBeenCalledWith({
					type: 'request.error',
					error: new Error('PHP.run() failed with exit code 255.'),
					source: 'php-wasm',
				});
			});
		});

		/**
		 * libsqlite3 path needs to be explicitly provided in Dockerfile
		 * for PHP < 7.4 – let's make sure it works
		 */
		describe('PDO SQLite support', { skip }, () => {
			it('Should be able to create a database', async () => {
				const response = await php.run({
					code: `<?php
							$db = new PDO('sqlite::memory:');
							$db->exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
							$db->exec('INSERT INTO test (name) VALUES ("This is a test")');
							$result = $db->query('SELECT name FROM test');
							$rows = $result->fetchAll(PDO::FETCH_COLUMN);
							echo json_encode($rows);
						?>`,
				});
				const bodyText = new TextDecoder().decode(response.bytes);
				expect(JSON.parse(bodyText)).toEqual(['This is a test']);
			});

			it('Should support modern libsqlite (ON CONFLICT)', async () => {
				const response = await php.run({
					code: `<?php
							$db = new PDO('sqlite::memory:');
							$db->exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
							$db->exec('CREATE UNIQUE INDEX test_name ON test (name)');
							$db->exec('INSERT INTO test (name) VALUES ("This is a test")');
							$db->exec('INSERT INTO test (name) VALUES ("This is a test") ON CONFLICT DO NOTHING');
							$result = $db->query('SELECT name FROM test');
							$rows = $result->fetchAll(PDO::FETCH_COLUMN);
							echo json_encode($rows);
						?>`,
				});
				const bodyText = new TextDecoder().decode(response.bytes);
				expect(JSON.parse(bodyText)).toEqual(['This is a test']);
			});
		});

		/**
		 * hash extension needs to be explicitly enabled in Dockerfile
		 * for PHP < 7.4 – let's make sure it works
		 */
		describe('Hash extension support', { skip }, () => {
			it('Should be able to hash a string', async () => {
				const response = await php.run({
					code: `<?php
							echo json_encode([
								'md5' => md5('test'),
								'sha1' => sha1('test'),
								'hash' => hash('sha256', 'test'),
							]);
						?>`,
				});
				const bodyText = new TextDecoder().decode(response.bytes);
				expect(JSON.parse(bodyText)).toEqual({
					md5: '098f6bcd4621d373cade4e832627b4f6',
					sha1: 'a94a8fe5ccb19ba61c4c0873d391e987982fbbd3',
					hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
				});
			});
		});

		/**
		 * mbregex support
		 */
		describe('mbregex extension support', { skip }, () => {
			it('Should be able to use mb_regex_encoding functions', async () => {
				const promise = php.run({
					code: `<?php
							mb_regex_encoding('UTF-8');
						?>`,
				});
				const response = await promise;
				expect(response.errors).toBe('');
			});
		});

		describe('64 bit integer support', { skip }, () => {
			it('Should be able to use 64 bit integers', async () => {
				const response = await php.run({
					code: `<?php echo json_encode(9223372036854775807);`,
				});
				expect(response.text).toEqual('9223372036854775807');
			});

			it('Should handle strtotime() correctly', async () => {
				const response = await php.run({
					code: `<?php
						$timestamp = strtotime('2040-01-19 03:14:07');
						echo json_encode([
							'value' => $timestamp,
							'type' => gettype($timestamp),
						]);`,
				});
				const result = JSON.parse(response.text);
				expect(result.value).toEqual(2210555647);
				expect(result.type).toBe('integer');
			});

			it('Should handle adding 64 bit integers', async () => {
				const response = await php.run({
					code: `<?php
						$product = 4611686018427387000 + 4611686018427387000;
						echo json_encode([
							'value' => $product,
							'type' => gettype($product),
						]);
						`,
				});
				const result = JSON.parse(response.text);
				expect(result.value + '').toEqual('9223372036854774000');
				expect(result.type).toEqual('integer');
			});

			it('Should handle multiplying 64 bit integers', async () => {
				const response = await php.run({
					code: `<?php
						$product = 2 * 4611686018427387000;
						echo json_encode([
							'value' => $product,
							'type' => gettype($product),
						]);
						`,
				});
				const result = JSON.parse(response.text);
				expect(result.value + '').toEqual('9223372036854774000');
				expect(result.type).toEqual('integer');
			});

			it('Should handle large integer division', async () => {
				const response = await php.run({
					code: `<?php
						$division = intdiv(9223372036854774000, 2);
						echo json_encode([
							'value' => $division,
							'type' => gettype($division),
						]);`,
				});
				const result = JSON.parse(response.text);
				expect(result.value + '').toEqual('4611686018427387000');
				expect(result.type).toEqual('integer');
			});

			it('Should handle PHP_MAX_INT', async () => {
				const response = await php.run({
					code: `<?php
					$maxInt = PHP_INT_MAX;
					echo json_encode([
						'value' => $maxInt,
						'type' => gettype($maxInt),
					]);
					`,
				});
				const result = JSON.parse(response.text);
				expect(result.value + '').toEqual('9223372036854776000');
				expect(result.type).toEqual('integer');
			});
		});

		/**
		 * fileinfo support
		 */
		describe('fileinfo extension support', { skip }, () => {
			it('Should be able to use finfo_file', async () => {
				await php.writeFile('/test.php', '<?php echo "Hello world!";');
				const response = await php.run({
					code: `<?php
							$finfo = new finfo(FILEINFO_MIME_TYPE);
							echo $finfo->file('/test.php');
						?>`,
				});
				expect(response.text).toEqual('text/x-php');
			});
		});

		/**
		 *  exif support
		 */
		describe('exif extension support', { skip }, () => {
			beforeEach(async () => {
				await php.writeFile(
					'/image.jpg',
					new Uint8Array(
						readFileSync(
							joinPaths(__dirname, 'test-data', 'image.jpg')
						)
					)
				);
			});
			it('should return correct image type using exif_imagetype', async () => {
				const response = await php.run({
					code: `<?php echo exif_imagetype('/image.jpg');`,
				});
				expect(response.errors).toBe('');
				expect(response.text).toBe('2');
			});
			it('should be able to use exif_read_data', async () => {
				const response = await php.run({
					code: `<?php echo json_encode(exif_read_data('/image.jpg'));`,
				});
				expect(response.errors).toBe('');
				expect(response.json).toMatchObject({
					FileName: 'image.jpg',
					FileDateTime: expect.any(Number),
					FileSize: 1241,
					FileType: 2,
					MimeType: 'image/jpeg',
					SectionsFound: 'COMMENT',
					COMPUTED: {
						html: 'width="30" height="30"',
						Height: 30,
						Width: 30,
						IsColor: 1,
					},
					COMMENT: ['Created with GIMP'],
				});
			});
			it('should be able to use exif_tagname ', async () => {
				const response = await php.run({
					code: `<?php echo exif_tagname(256);`,
				});
				expect(response.errors).toBe('');
				expect(response.text).toBe('ImageWidth');
			});
			it('should be able to use exif_thumbnail', async () => {
				const response = await php.run({
					code: `<?php
						var_dump(exif_thumbnail('/image.jpg'));
						`,
				});
				expect(response.errors).toBe('');
				// TODO: we could improve this by providing an image with a valid thumbnail
				expect(response.text).toBe('bool(false)\n');
			});
		});

		describe('onMessage', { skip }, () => {
			it('should pass messages to JS', async () => {
				let messageReceived = '';
				php.onMessage((message) => {
					messageReceived = message;
				});
				const out = await php.run({
					code: `<?php
						post_message_to_js('world');
						`,
				});
				expect(out.errors).toBe('');
				expect(messageReceived).toBe('world');
			});

			it('should return sync messages from JS', async () => {
				php.onMessage(async (message) => message + '!');
				const out = await php.run({
					code: `<?php echo post_message_to_js('a');`,
				});
				expect(out.errors).toBe('');
				expect(out.text).toBe('a!');
			});

			it('should return async messages from JS', async () => {
				php.onMessage(async (message) => {
					// Simulate getting data asynchronously.
					return await new Promise<string>((resolve) =>
						setTimeout(() => resolve(message + '!'), 100)
					);
				});
				const out = await php.run({
					code: `<?php echo post_message_to_js('a');`,
				});
				expect(out.errors).toBe('');
				expect(out.text).toBe('a!');
			});

			it('should return null when JS message handler throws an error', async () => {
				php.onMessage(async () => {
					// Simulate getting data asynchronously.
					return await new Promise<string>((resolve, reject) =>
						setTimeout(() => reject('Failure!'), 100)
					);
				});
				const out = await php.run({
					code: `<?php var_dump(post_message_to_js('a'));`,
				});
				expect(out.errors).toBe('');
				expect(out.text).toBe('NULL\n');
			});
		});

		describe('CLI', { skip }, () => {
			let consoleLogMock: any;
			let consoleErrorMock: any;
			beforeEach(() => {
				consoleLogMock = vi
					.spyOn(console, 'log')
					.mockImplementation(() => {});
				consoleErrorMock = vi
					.spyOn(console, 'error')
					.mockImplementation(() => {});
			});

			afterAll(() => {
				consoleLogMock.mockReset();
				consoleErrorMock.mockReset();
			});
			it('should not log an error message on exit status 0', async () => {
				await php.cli(['php', '-r', '$tmp = "Hello";']);
				expect(consoleLogMock).not.toHaveBeenCalled();
				expect(consoleErrorMock).not.toHaveBeenCalled();
			});

			it('should define the PHP_BINARY constant', async () => {
				const response = await php.cli([
					'php',
					'-r',
					'echo PHP_BINARY;',
				]);
				expect(await response.stdoutText).toBe(
					'/internal/shared/bin/php'
				);
			});

			it('should support multiple calls to php.cli() and php.runStream() when runtime rotation is enabled', async () => {
				php.enableRuntimeRotation({
					maxRequests: 1,
					recreateRuntime: () =>
						loadNodeRuntime(phpVersion as any, options),
				});
				const response = await php.cli(['php', '-r', 'echo "Hello";']);
				expect(await response.stdoutText).toBe('Hello');
				const response2 = await php.runStream({
					code: `<?php echo "Hello";`,
				});
				expect(await response2.stdoutText).toBe('Hello');
				const response3 = await php.cli(['php', '-r', 'echo "Hello";']);
				expect(await response3.stdoutText).toBe('Hello');
			});
		});

		describe('Response parsing', { skip }, () => {
			it('should encode response headers', async () => {
				const out = await php.run({
					code: `<?php header('Location: /(?P<id>[\\d]+)');`,
				});
				expect(out.headers['location'][0]).toEqual('/(?P<id>[\\d]+)');
			});
		});

		describe('Disk space', { skip }, () => {
			it('should return the correct total disk space', async () => {
				const response = await php.run({
					code: `<?php echo disk_total_space('/');`,
				});
				const expectedStatfs = statfsSync('/');
				const expectedTotalDiskSpace =
					expectedStatfs.blocks * expectedStatfs.bsize;
				expect(response.text).toBe(expectedTotalDiskSpace.toString());
			});

			it('should return the correct free disk space', async () => {
				const response = await php.run({
					code: `<?php echo json_encode(disk_free_space('/'));`,
				});
				const expectedStatfs = statfsSync('/');
				const expectedFreeDiskSpace =
					expectedStatfs.bavail * expectedStatfs.bsize;
				expect(response.text).toBe(expectedFreeDiskSpace.toString());
			});

			it('should return a hardcoded value from MEMFS for a file created in MEMFS', async () => {
				php.writeFile('/test.txt', new Uint8Array(1024));
				const response = await php.run({
					code: `<?php echo json_encode(disk_total_space('/test.txt'));`,
				});
				expect(response.text).toBe('4096000000');
			});

			it('should return the correct total disk space when passing a subdirectory', async () => {
				const tempDir = mkdtempSync(
					joinPaths(tmpdir(), 'php-wasm-test-')
				);
				const filePath = joinPaths(tempDir, 'test.txt');
				writeFileSync(filePath, new Uint8Array(1024));
				php.mount('/tmp', createNodeFsMountHandler(tempDir));

				const response = await php.run({
					code: `<?php echo json_encode(disk_total_space('/tmp'));`,
				});
				const expectedStatfs = statfsSync('/');
				const expectedTotalDiskSpace =
					expectedStatfs.blocks * expectedStatfs.bsize;
				expect(response.text).toBe(expectedTotalDiskSpace.toString());
			});
		});
	});
});

describe('sandboxedSpawnHandlerFactory', () => {
	const phpVersion = RecommendedPHPVersion;
	let php: PHP;
	let spawnedPhp: SpawnedPHP;
	let processManager: PHPProcessManager;
	beforeEach(async () => {
		processManager = new PHPProcessManager({
			phpFactory: async () => {
				const php = new PHP(
					await loadNodeRuntime(phpVersion as any, {})
				);
				php.mkdir('/tmp/shared-test-directory');
				php.chdir('/tmp/shared-test-directory');

				php.writeFile(
					'/tmp/shared-test-directory/README.md',
					'Hello, world!'
				);
				php.mkdir('/tmp/shared-test-directory/code');
				php.writeFile(
					'/tmp/shared-test-directory/code/index.php',
					'Hello, world!'
				);
				await php.setSpawnHandler(
					sandboxedSpawnHandlerFactory(() =>
						processManager.acquirePHPInstance()
					)
				);
				// Match production behavior (boot.ts): enable runtime
				// rotation on subprocess instances. Rotation won't
				// actually trigger for CLI-only instances (the C-level
				// fixes allow repeated run_cli() calls), but we enable
				// it to mirror the real configuration.
				php.enableRuntimeRotation({
					recreateRuntime: () =>
						loadNodeRuntime(phpVersion as any, {}),
					maxRequests: 400,
				});
				return php;
			},
			maxPhpInstances: 5,
		});
		spawnedPhp = await processManager.acquirePHPInstance();
		php = spawnedPhp.php;
	});
	afterEach(async () => {
		await processManager[Symbol.asyncDispose]();
		spawnedPhp?.reap();
	});
	it.each([
		// Default cwd
		{
			command: 'ls',
			expected: ['README.md', 'code', ''].join('\n'),
		},
		// Explicit path
		{
			command: 'ls /tmp/shared-test-directory',
			expected: ['README.md', 'code', ''].join('\n'),
		},
		// Subdirectory – we expect a different output
		{
			command: 'ls /tmp/shared-test-directory/code',
			expected: ['index.php', ''].join('\n'),
		},
		// pwd
		{
			command: 'pwd',
			expected: '/tmp/shared-test-directory\n',
		},
	])('should be able to run "$command"', async ({ command, expected }) => {
		const response = await php.run({
			code: `<?php
				$output = shell_exec(getenv('COMMAND'));
				echo $output;
			`,
			env: {
				COMMAND: command,
			},
		});
		expect(response.text).toEqual(expected);
	});

	it('Should be able to run CLI commands via php.cli()', async () => {
		const response = await php.cli(['ls', '/tmp/shared-test-directory']);
		expect(await response.stdoutText).toEqual(
			['README.md', 'code', ''].join('\n')
		);
	});

	it('Should be able to call proc_open(php ...) multiple times in a row', async () => {
		const response = await php.run({
			code: `<?php
				$results = [];
				for ($i = 1; $i <= 3; $i++) {
					$descriptorspec = [
						1 => ["pipe", "w"],
						2 => ["pipe", "w"]
					];
					$proc = proc_open(
						'php -r "echo ' . $i . ';"',
						$descriptorspec,
						$pipes
					);
					$stdout = stream_get_contents($pipes[1]);
					fclose($pipes[1]);
					fclose($pipes[2]);
					proc_close($proc);
					$results[] = $stdout;
				}
				echo implode(',', $results);
			`,
		});
		expect(response.text).toEqual('1,2,3');
	}, 60000);
});
