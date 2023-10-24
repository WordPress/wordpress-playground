import { getPHPLoaderModule, NodePHP } from '..';
import { vi } from 'vitest';
import {
	loadPHPRuntime,
	SupportedPHPVersions,
	__private__dont__use,
} from '@php-wasm/universal';
import { existsSync, rmSync, readFileSync } from 'fs';

const testDirPath = '/__test987654321';
const testFilePath = '/__test987654321.txt';

// SupportedPHPVersions
describe.each(SupportedPHPVersions)('PHP %s', (phpVersion) => {
	let php: NodePHP;
	beforeEach(async () => {
		php = await NodePHP.load(phpVersion as any);
		php.setPhpIniEntry('disable_functions', '');
	});

	describe('exec()', () => {
		it('echo', async () => {
			const result = await php.run({
				code: `<?php
				echo 'stdout: ' . exec("echo WordPress");
			`,
			});
			expect(result.text).toEqual('stdout: WordPress');
		});
	});

	describe('proc_open()', () => {
		it('echo – stdin=file (empty), stdout=file, stderr=file', async () => {
			const result = await php.run({
				code: `<?php
				file_put_contents('/tmp/process_in', '');
				$res = proc_open(
					"echo WordPress",
					array(
						array("file","/tmp/process_in", "r"),
						array("file","/tmp/process_out", "w"),
						array("file","/tmp/process_err", "w"),
					),
					$pipes
				);

				// Yields back to JS event loop to capture and process the 
				// child_process output. This is fine. Regular PHP scripts
				// typically wait for the child process to finish.
				sleep(1);

				$stdout = file_get_contents("/tmp/process_out");
				$stderr = file_get_contents("/tmp/process_err");

				echo 'stdout: ' . $stdout . "";
				echo 'stderr: ' . $stderr . PHP_EOL;
			`,
			});
			expect(result.text).toEqual('stdout: WordPress\nstderr: \n');
		});

		it('echo – stdin=file (empty), stdout=pipe, stderr=pipe', async () => {
			const result = await php.run({
				code: `<?php
				file_put_contents('/tmp/process_in', '');
				$res = proc_open(
					"echo WordPress",
					array(
						array("file","/tmp/process_in", "r"),
						array("pipe","w"),
						array("pipe","w"),
					),
					$pipes
				);

				// stream_get_contents yields back to JS event loop internally.
				sleep(1);
				$stdout = stream_get_contents($pipes[1]);
				$stderr = stream_get_contents($pipes[2]);
				proc_close($res);

				echo 'stdout: ' . $stdout . "";
				echo 'stderr: ' . $stderr . PHP_EOL;
			`,
			});
			expect(result.text).toEqual('stdout: WordPress\nstderr: \n');
		});

		// This test fails
		// if (!['7.0', '7.1', '7.2', '7.3'].includes(phpVersion))
		{
			it('cat – stdin=pipe, stdout=file, stderr=file', async () => {
				const result = await php.run({
					code: `<?php
			$res = proc_open(
				"cat",
				array(
					array("pipe","r"),
					array("file","/tmp/process_out", "w"),
					array("file","/tmp/process_err", "w"),
				),
				$pipes
			);
			fwrite($pipes[0], 'WordPress\n');

			// Yields back to JS event loop to capture and process the 
			// child_process output. This is fine. Regular PHP scripts
			// typically wait for the child process to finish.
			sleep(1);

			$stdout = file_get_contents("/tmp/process_out");
			$stderr = file_get_contents("/tmp/process_err");
			proc_close($res);

			echo 'stdout: ' . $stdout . "";
			echo 'stderr: ' . $stderr . PHP_EOL;
		`,
				});
				expect(result.text).toEqual('stdout: WordPress\nstderr: \n');
			});
		}

		it('cat – stdin=file, stdout=file, stderr=file', async () => {
			const result = await php.run({
				code: `<?php
				file_put_contents('/tmp/process_in', 'WordPress\n');
				$res = proc_open(
					"cat",
					array(
						array("file","/tmp/process_in", "r"),
						array("file","/tmp/process_out", "w"),
						array("file","/tmp/process_err", "w"),
					),
					$pipes
				);

				// Yields back to JS event loop to capture and process the 
				// child_process output. This is fine. Regular PHP scripts
				// typically wait for the child process to finish.
				sleep(1);

				$stdout = file_get_contents("/tmp/process_out");
				$stderr = file_get_contents("/tmp/process_err");
				proc_close($res);

				echo 'stdout: ' . $stdout . "";
				echo 'stderr: ' . $stderr . PHP_EOL;
			`,
			});

			expect(result.text).toEqual('stdout: WordPress\nstderr: \n');
		});

		it('Uses the specified spawn handler', async () => {
			let spawnHandlerCalled = false;
			php.setSpawnHandler(() => {
				spawnHandlerCalled = true;
				return {
					stdout: {
						on: () => {},
					},
					stderr: {
						on: () => {},
					},
					stdin: {
						write: () => {},
					},
					on: () => {},
					kill: () => {},
				} as any;
			});
			await php.run({
				code: `<?php
				$res = proc_open(
					"echo 'Hello World!'",
					array(
						array("pipe","r"),
						array("pipe","w"),
						array("pipe","w"),
					),
					$pipes
				);
				proc_close($res);
			`,
			});
			expect(spawnHandlerCalled).toEqual(true);
		});
	});

	describe('Filesystem', () => {
		// Unit tests for the filesystem methods of the
		// PHP runtime.
		it('writeFile() should create a file when it does not exist', () => {
			php.writeFile(testFilePath, 'Hello World!');
			expect(php.fileExists(testFilePath)).toEqual(true);
		});

		it('writeFile() should throw a useful error when parent directory does not exist', () => {
			expect(() => {
				php.writeFile('/a/b/c/d/e/f', 'Hello World!');
			}).toThrowError(
				'Could not write to "/a/b/c/d/e/f": There is no such file or directory OR the parent directory does not exist.'
			);
		});

		it('writeFile() should throw a useful error when the specified path is a directory', () => {
			php.mkdir('/dir');
			expect(() => {
				php.writeFile('/dir', 'Hello World!');
			}).toThrowError(
				new Error(
					`Could not write to "/dir": There is a directory under that path.`
				)
			);
		});

		it('writeFile() should overwrite a file when it exists', () => {
			php.writeFile(testFilePath, 'Hello World!');
			php.writeFile(testFilePath, 'New contents');
			expect(php.readFileAsText(testFilePath)).toEqual('New contents');
		});

		it('readFileAsText() should read a file as text', () => {
			php.writeFile(testFilePath, 'Hello World!');
			expect(php.readFileAsText(testFilePath)).toEqual('Hello World!');
		});

		it('readFileAsBuffer() should read a file as buffer', () => {
			php.writeFile(testFilePath, 'Hello World!');
			expect(php.readFileAsBuffer(testFilePath)).toEqual(
				new TextEncoder().encode('Hello World!')
			);
		});

		it('unlink() should delete a file', () => {
			php.writeFile(testFilePath, 'Hello World!');
			expect(php.fileExists(testFilePath)).toEqual(true);
			php.unlink(testFilePath);
			expect(php.fileExists(testFilePath)).toEqual(false);
		});

		it('mv() should move a file', () => {
			php.mkdir(testDirPath);
			const file1 = testDirPath + '/1.txt';
			const file2 = testDirPath + '/2.txt';
			php.writeFile(file1, '1');
			php.mv(file1, file2);
			expect(php.fileExists(file1)).toEqual(false);
			expect(php.fileExists(file2)).toEqual(true);
			expect(php.readFileAsText(file2)).toEqual('1');
		});

		it('mv() should replace target file if it exists', () => {
			php.mkdir(testDirPath);
			const file1 = testDirPath + '/1.txt';
			const file2 = testDirPath + '/2.txt';
			php.writeFile(file1, '1');
			php.writeFile(file2, '2');
			php.mv(file1, file2);
			expect(php.fileExists(file1)).toEqual(false);
			expect(php.fileExists(file2)).toEqual(true);
			expect(php.readFileAsText(file2)).toEqual('1');
		});

		it('mv() should throw a useful error when source file does not exist', () => {
			php.mkdir(testDirPath);
			const file1 = testDirPath + '/1.txt';
			const file2 = testDirPath + '/2.txt';
			expect(() => {
				php.mv(file1, file2);
			}).toThrowError(
				`Could not move "${testDirPath}/1.txt": There is no such file or directory OR the parent directory does not exist.`
			);
		});

		it('mv() should throw a useful error when target directory does not exist', () => {
			php.mkdir(testDirPath);
			const file1 = testDirPath + '/1.txt';
			const file2 = testDirPath + '/nowhere/2.txt';
			php.writeFile(file1, '1');
			expect(() => {
				php.mv(file1, file2);
			}).toThrowError(
				`Could not move "${testDirPath}/1.txt": There is no such file or directory OR the parent directory does not exist.`
			);
		});

		it('mkdir() should create a directory', () => {
			php.mkdir(testDirPath);
			expect(php.fileExists(testDirPath)).toEqual(true);
		});

		it('mkdir() should create all nested directories', () => {
			php.mkdir(testDirPath + '/nested/doubly/triply');
			expect(php.isDir(testDirPath + '/nested/doubly/triply')).toEqual(
				true
			);
		});

		it('unlink() should throw a useful error when parent directory does not exist', () => {
			expect(() => {
				php.unlink('/a/b/c/d/e/f');
			}).toThrowError(
				'Could not unlink "/a/b/c/d/e/f": There is no such file or directory OR the parent directory does not exist.'
			);
		});

		it('isDir() should correctly distinguish between a file and a directory', () => {
			php.mkdir(testDirPath);
			expect(php.fileExists(testDirPath)).toEqual(true);
			expect(php.isDir(testDirPath)).toEqual(true);

			php.writeFile(testFilePath, 'Hello World!');
			expect(php.fileExists(testFilePath)).toEqual(true);
			expect(php.isDir(testFilePath)).toEqual(false);
		});

		it('listFiles() should return a list of files in a directory', () => {
			php.mkdir(testDirPath);
			php.writeFile(testDirPath + '/test.txt', 'Hello World!');
			php.writeFile(testDirPath + '/test2.txt', 'Hello World!');
			expect(php.listFiles(testDirPath)).toEqual([
				'test.txt',
				'test2.txt',
			]);
		});

		it('listFiles() option prependPath should prepend given path to all files returned', () => {
			php.mkdir(testDirPath);
			php.writeFile(testDirPath + '/test.txt', 'Hello World!');
			php.writeFile(testDirPath + '/test2.txt', 'Hello World!');
			expect(php.listFiles(testDirPath, { prependPath: true })).toEqual([
				testDirPath + '/test.txt',
				testDirPath + '/test2.txt',
			]);
		});
	});

	describe('Stdio', () => {
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
				await php.run({ code: '<?php echo "Hello world!\nI am PHP";' })
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

	describe('Startup sequence – basics', () => {
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

	describe('Startup sequence', () => {
		const testScriptPath = '/test.php';
		afterEach(() => {
			if (existsSync(testScriptPath)) {
				rmSync(testScriptPath);
			}
		});

		/**
		 * Issue https://github.com/WordPress/wordpress-playground/issues/169
		 */
		it('Should work with long POST body', () => {
			php.writeFile(testScriptPath, '<?php echo "Hello world!"; ?>');
			const body =
				readFileSync(
					new URL('./test-data/long-post-body.txt', import.meta.url)
						.pathname,
					'utf8'
				) + '';
			// 0x4000 is SAPI_POST_BLOCK_SIZE
			expect(body.length).toBeGreaterThan(0x4000);
			expect(async () => {
				await php.run({
					code: 'echo "A";',
					relativeUri: '/test.php?a=b',
					body,
					method: 'POST',
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded',
					},
				});
			}).not.toThrowError();
		});

		it('Should run a script when no code snippet is provided', async () => {
			php.writeFile(testScriptPath, '<?php echo "Hello world!"; ?>');
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
				method: 'POST',
				body: '{"foo": "bar"}',
				code: `<?php echo file_get_contents('php://input');`,
			});
			const bodyText = new TextDecoder().decode(response.bytes);
			expect(bodyText).toEqual('{"foo": "bar"}');
		});

		it('Should set $_SERVER entries for provided headers', async () => {
			const response = await php.run({
				code: `<?php echo json_encode($_SERVER);`,
				method: 'POST',
				body: 'foo=bar',
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
			expect(json).toHaveProperty('HTTP_CUSTOM_HEADER', 'custom value');
			expect(json).toHaveProperty('HTTP_X_TEST', 'x custom value');
			/*
			 * The following headers should be set without the HTTP_ prefix,
			 * as PHP follows the following convention:
			 * https://www.ietf.org/rfc/rfc3875
			 */
			expect(json).toHaveProperty('CONTENT_TYPE', 'text/plain');
			expect(json).toHaveProperty('CONTENT_LENGTH', '15');
		});
		it('Should expose urlencoded POST data in $_POST', async () => {
			const response = await php.run({
				code: `<?php echo json_encode($_POST);`,
				method: 'POST',
				body: 'foo=bar',
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
				body: 'foo[]=bar1&foo[]=bar2&indexed[key]=value',
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
				body: `--boundary
Content-Disposition: form-data; name="foo"

bar`,
				headers: {
					'Content-Type': 'multipart/form-data; boundary=boundary',
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
				body: `--boundary
Content-Disposition: form-data; name="myFile"; filename="text.txt"
Content-Type: text/plain

bar
--boundary--`,
				headers: {
					'Content-Type': 'multipart/form-data; boundary=boundary',
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

		it('Should expose uploaded files in $_FILES', async () => {
			const response = await php.run({
				code: `<?php echo json_encode(array(
						"files" => $_FILES,
						"is_uploaded" => is_uploaded_file($_FILES["myFile"]["tmp_name"])
					));`,
				method: 'POST',
				fileInfos: [
					{
						name: 'text.txt',
						key: 'myFile',
						data: new TextEncoder().encode('bar'),
						type: 'text/plain',
					},
				],
				headers: {
					'Content-Type': 'multipart/form-data; boundary=boundary',
				},
			});
			const bodyText = new TextDecoder().decode(response.bytes);
			expect(JSON.parse(bodyText)).toEqual({
				files: {
					myFile: {
						name: 'text.txt',
						type: 'text/plain',
						tmp_name: expect.any(String),
						error: '0',
						size: '3',
					},
				},
				is_uploaded: true,
			});
		});

		it('Should expose both the multipart/form-data request body AND uploaded files in $_FILES', async () => {
			const response = await php.run({
				code: `<?php echo json_encode(array(
						"files" => $_FILES,
						"is_uploaded1" => is_uploaded_file($_FILES["myFile1"]["tmp_name"]),
						"is_uploaded2" => is_uploaded_file($_FILES["myFile2"]["tmp_name"])
					));`,
				relativeUri: '/',
				method: 'POST',
				body: `--boundary
Content-Disposition: form-data; name="myFile1"; filename="from_body.txt"
Content-Type: text/plain

bar1
--boundary--`,
				fileInfos: [
					{
						name: 'from_files.txt',
						key: 'myFile2',
						data: new TextEncoder().encode('bar2'),
						type: 'application/json',
					},
				],
				headers: {
					'Content-Type': 'multipart/form-data; boundary=boundary',
				},
			});
			const bodyText = new TextDecoder().decode(response.bytes);
			const expectedResult = {
				files: {
					myFile1: {
						name: 'from_body.txt',
						type: 'text/plain',
						tmp_name: expect.any(String),
						error: 0,
						size: 4,
					},
					myFile2: {
						name: 'from_files.txt',
						type: 'application/json',
						tmp_name: expect.any(String),
						error: '0',
						size: '4',
					},
				},
				is_uploaded1: true,
				is_uploaded2: true,
			};
			if (Number(phpVersion) > 8) {
				(expectedResult.files.myFile1 as any).full_path =
					'from_body.txt';
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
				body: `--boundary
Content-Disposition: form-data; name="myFile1"; filename="from_body.txt"
Content-Type: text/plain

bar1
--boundary--`,
				fileInfos: [
					{
						name: 'from_files.txt',
						key: 'myFile2',
						data: new TextEncoder().encode('bar2'),
						type: 'application/json',
					},
				],
				headers: {
					'Content-Type': 'multipart/form-data; boundary=boundary',
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
		});
	});

	/**
	 * libsqlite3 path needs to be explicitly provided in Dockerfile
	 * for PHP < 7.4 – let's make sure it works
	 */
	describe('PDO SQLite support', () => {
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
	 * for PHP < 7.3 – let's make sure it works
	 */
	describe('Hash extension support', () => {
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

	describe('onMessage', () => {
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
	});

	describe('CLI', () => {
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
	});
});

// @TODO Prevent crash on PHP versions 5.6, 7.2, 8.2
describe.each(['7.0', '7.1', '7.3', '7.4', '8.0', '8.1'])(
	'PHP %s – process crash',
	(phpVersion) => {
		let php: NodePHP;
		beforeEach(async () => {
			php = await NodePHP.load(phpVersion as any);
			php.setPhpIniEntry('allow_url_fopen', '1');
			vi.restoreAllMocks();
		});

		it('Does not crash due to an unhandled Asyncify error ', async () => {
			let caughtError;
			try {
				/**
				 * PHP is intentionally built without network support for __clone()
				 * because it's an extremely unlikely place for any network activity
				 * and not supporting it allows us to test the error handling here.
				 *
				 * `clone $x` will throw an asynchronous error out when attempting
				 * to do a network call ("unreachable" WASM instruction executed).
				 * This test should gracefully catch and handle that error.
				 *
				 * A failure to do so will crash the entire process
				 */
				await php.run({
					code: `<?php
				class Top {
					function __clone() {
						file_get_contents("http://127.0.0.1");
					}
				}
				$x = new Top();
				clone $x;
				`,
				});
			} catch (error: unknown) {
				caughtError = error;
				if (error instanceof Error) {
					expect(error.message).toMatch(
						/Aborted|Program terminated with exit\(1\)|/
					);
				}
			}
			if (!caughtError) {
				expect.fail('php.run should have thrown an error');
			}
		});

		it('Does not crash due to an unhandled non promise error ', async () => {
			let caughtError;
			try {
				const spy = vi.spyOn(php[__private__dont__use], 'ccall');
				expect(spy.getMockName()).toEqual('ccall');
				spy.mockImplementation((c_func) => {
					if (c_func === 'wasm_sapi_handle_request') {
						throw new Error('test');
					}
				});

				await php.run({
					code: `<?php
              function top() {
						     file_get_contents("http://127.0.0.1");
              }
              top();
				`,
				});
			} catch (error: unknown) {
				caughtError = error;
				if (error instanceof Error) {
					expect(error.message).toMatch('test');
					expect(error.stack).toContain('#handleRequest');
				}
			}
			if (!caughtError) {
				expect.fail('php.run should have thrown an error');
			}
		});
	}
);
