import * as phpLoaderModule from '../../../build/php-7.4.node.js';
import { PHP, startPHP } from '../php-node';
import { existsSync, rmSync } from 'fs';

const { TextEncoder, TextDecoder } = require('util');

describe('PHP – boot', () => {
	it('should boot', async () => {
		const php = await startPHP(phpLoaderModule, 'NODE');
		expect(php).toBeTruthy();
	});
});

const testDirPath = __dirname + '/__test987654321';
const testFilePath = __dirname + '/__test987654321.txt';
describe('PHP – filesystem', () => {
	let php;
	beforeEach(async () => {
		php = await startPHP(phpLoaderModule, 'NODE');
		if (existsSync(testDirPath)) {
			rmSync(testDirPath, { recursive: true });
		}
		if (existsSync(testFilePath)) {
			rmSync(testFilePath);
		}
	});

	// Unit tests for the filesystem methods of the
	// PHP runtime.
	it('writeFile() should create a file when it does not exist', () => {
		php.writeFile(testFilePath, 'Hello World!');
		expect(php.fileExists(testFilePath)).toEqual(true);
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

	it('mkdirTree() should create a directory', () => {
		php.mkdirTree(testDirPath);
		expect(php.fileExists(testDirPath)).toEqual(true);
	});

	it('mkdirTree() should create all nested directories', () => {
		php.mkdirTree(testDirPath + '/nested/doubly/triply');
		expect(php.isDir(testDirPath + '/nested/doubly/triply')).toEqual(true);
	});

	it('isDir() should correctly distinguish between a file and a directory', () => {
		php.mkdirTree(testDirPath);
		expect(php.fileExists(testDirPath)).toEqual(true);
		expect(php.isDir(testDirPath)).toEqual(true);

		php.writeFile(testFilePath, 'Hello World!');
		expect(php.fileExists(testFilePath)).toEqual(true);
		expect(php.isDir(testFilePath)).toEqual(false);
	});

	it('listFiles() should return a list of files in a directory', () => {
		php.mkdirTree(testDirPath);
		php.writeFile(testDirPath + '/test.txt', 'Hello World!');
		php.writeFile(testDirPath + '/test2.txt', 'Hello World!');
		expect(php.listFiles(testDirPath)).toEqual(['test.txt', 'test2.txt']);
	});
});

describe('PHP – stdio', () => {
	let php;
	beforeEach(async () => {
		php = await startPHP(phpLoaderModule, 'NODE');
	});

	it('should output strings (1)', () => {
		expect(php.run({ code: '<?php echo "Hello world!";' })).toEqual({
			headers: expect.any(Object),
			httpStatusCode: 200,
			body: new TextEncoder().encode('Hello world!'),
			errors: '',
			exitCode: 0,
		});
	});
	it('should output strings (2) ', () => {
		expect(
			php.run({ code: '<?php echo "Hello world!\nI am PHP";' })
		).toEqual({
			headers: expect.any(Object),
			httpStatusCode: 200,
			body: new TextEncoder().encode('Hello world!\nI am PHP'),
			errors: '',
			exitCode: 0,
		});
	});
	it('should output bytes ', () => {
		const results = php.run({
			code: '<?php echo chr(1).chr(0).chr(1).chr(0).chr(2); ',
		});
		expect(results).toEqual({
			headers: expect.any(Object),
			httpStatusCode: 200,
			body: new Uint8Array([1, 0, 1, 0, 2]),
			errors: '',
			exitCode: 0,
		});
	});
	it('should output strings when .run() is called twice', () => {
		expect(php.run({ code: '<?php echo "Hello world!";' })).toEqual({
			headers: expect.any(Object),
			httpStatusCode: 200,
			body: new TextEncoder().encode('Hello world!'),
			errors: '',
			exitCode: 0,
		});

		expect(php.run({ code: '<?php echo "Ehlo world!";' })).toEqual({
			headers: expect.any(Object),
			httpStatusCode: 200,
			body: new TextEncoder().encode('Ehlo world!'),
			errors: '',
			exitCode: 0,
		});
	});
	it('should capture error data from stderr', () => {
		const code = `<?php
		$stdErr = fopen('php://stderr', 'w');
		fwrite($stdErr, "Hello from stderr!");
		`;
		expect(php.run({ code })).toEqual({
			headers: expect.any(Object),
			httpStatusCode: 200,
			body: new TextEncoder().encode(''),
			errors: 'Hello from stderr!',
			exitCode: 0,
		});
	});
});

describe('PHP – startup sequence', () => {
	let php: PHP;
	beforeEach(async () => {
		php = await startPHP(phpLoaderModule, 'NODE');
	});
	const testScriptPath = __dirname + '/test.php';
	afterEach(() => {
		if (existsSync(testScriptPath)) {
			rmSync(testScriptPath);
		}
	});

	it('Should run a script when no code snippet is provided', () => {
		php.writeFile(testScriptPath, '<?php echo "Hello world!"; ?>');
		const response = php.run({
			scriptPath: testScriptPath,
		});
		const bodyText = new TextDecoder().decode(response.body);
		expect(bodyText).toEqual('Hello world!');
	});

	it('Should run a code snippet when provided, even if scriptPath is set', () => {
		php.writeFile(testScriptPath, '<?php echo "Hello world!"; ?>');
		const response = php.run({
			scriptPath: testScriptPath,
			code: '<?php echo "Hello from a code snippet!";',
		});
		const bodyText = new TextDecoder().decode(response.body);
		expect(bodyText).toEqual('Hello from a code snippet!');
	});

	it('Should have access to raw request data via the php://input stream', () => {
		const response = php.run({
			method: 'POST',
			body: '{"foo": "bar"}',
			code: `<?php echo file_get_contents('php://input');`,
		});
		const bodyText = new TextDecoder().decode(response.body);
		expect(bodyText).toEqual('{"foo": "bar"}');
	});

	it('Should expose urlencoded POST data in $_POST', () => {
		const response = php.run({
			code: `<?php echo json_encode($_POST);`,
			method: 'POST',
			body: 'foo=bar',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
		});
		const bodyText = new TextDecoder().decode(response.body);
		expect(bodyText).toEqual('{"foo":"bar"}');
	});

	it('Should expose urlencoded POST arrays in $_POST', () => {
		const response = php.run({
			code: `<?php echo json_encode($_POST);`,
			method: 'POST',
			body: 'foo[]=bar1&foo[]=bar2&indexed[key]=value',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
		});
		const bodyText = new TextDecoder().decode(response.body);
		expect(bodyText).toEqual(
			'{"foo":["bar1","bar2"],"indexed":{"key":"value"}}'
		);
	});

	it('Should expose multipart POST data in $_POST', () => {
		const response = php.run({
			code: `<?php echo json_encode($_POST);`,
			method: 'POST',
			body: `--boundary
Content-Disposition: form-data; name="foo"

bar`,
			headers: {
				'Content-Type': 'multipart/form-data; boundary=boundary',
			},
		});
		const bodyText = new TextDecoder().decode(response.body);
		expect(bodyText).toEqual('{"foo":"bar"}');
	});

	it('Should expose multipart POST files in $_FILES', () => {
		const response = php.run({
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
		const bodyText = new TextDecoder().decode(response.body);
		expect(JSON.parse(bodyText)).toEqual({
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
		});
	});

	it('Should expose uploaded files in $_FILES', () => {
		const response = php.run({
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
		const bodyText = new TextDecoder().decode(response.body);
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

	it('Should expose both the multipart/form-data request body AND uploaded files in $_FILES', () => {
		const response = php.run({
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
		const bodyText = new TextDecoder().decode(response.body);
		expect(JSON.parse(bodyText)).toEqual({
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
		});
	});

	it('Should provide the correct $_SERVER information', () => {
		php.writeFile(testScriptPath, '<?php echo json_encode($_SERVER); ?>');
		const response = php.run({
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
		const bodyText = new TextDecoder().decode(response.body);
		const $_SERVER = JSON.parse(bodyText);
		expect($_SERVER).toHaveProperty('REQUEST_URI', '/test.php?a=b');
		expect($_SERVER).toHaveProperty('REQUEST_METHOD', 'POST');
		expect($_SERVER).toHaveProperty(
			'HTTP_CONTENT_TYPE',
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
