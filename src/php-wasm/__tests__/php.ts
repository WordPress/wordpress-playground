import * as phpLoaderModule from '../../../build/php-7.0.node.js';
import { PHP, startPHP } from '../php';

const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

describe('PHP – boot', () => {
	it('should boot', async () => {
		const php = await startPHP(phpLoaderModule, 'NODE');
		expect(php).toBeTruthy();
	});
});

describe('PHP – filesystem', () => {
	let php;
	beforeEach(async () => {
		php = await startPHP(phpLoaderModule, 'NODE');
	});

	// Unit tests for the filesystem methods of the
	// PHP runtime.
	it('writeFile() should create a file when it does not exist', () => {
		php.writeFile('test.txt', 'Hello World!');
		expect(php.fileExists('test.txt')).toEqual(true);
	});

	it('writeFile() should overwrite a file when it exists', () => {
		php.writeFile('test.txt', 'Hello World!');
		php.writeFile('test.txt', 'New contents');
		expect(php.readFileAsText('test.txt')).toEqual('New contents');
	});

	it('readFileAsText() should read a file as text', () => {
		php.writeFile('test.txt', 'Hello World!');
		expect(php.readFileAsText('test.txt')).toEqual('Hello World!');
	});

	it('readFileAsBuffer() should read a file as buffer', () => {
		php.writeFile('test.txt', 'Hello World!');
		expect(php.readFileAsBuffer('test.txt')).toEqual(
			new TextEncoder().encode('Hello World!')
		);
	});

	it('unlink() should delete a file', () => {
		php.writeFile('test.txt', 'Hello World!');
		expect(php.fileExists('test.txt')).toEqual(true);
		php.unlink('test.txt');
		expect(php.fileExists('test.txt')).toEqual(false);
	});

	it('mkdirTree() should create a directory', () => {
		php.mkdirTree('test');
		expect(php.fileExists('test')).toEqual(true);
	});

	it('mkdirTree() should create all nested directories', () => {
		php.mkdirTree('test/nested/doubly/triply');
		expect(php.isDir('test/nested/doubly/triply')).toEqual(true);
	});

	it('isDir() should correctly distinguish between a file and a directory', () => {
		php.mkdirTree('test');
		expect(php.fileExists('test')).toEqual(true);
		expect(php.isDir('test')).toEqual(true);

		php.writeFile('test.txt', 'Hello World!');
		expect(php.fileExists('test.txt')).toEqual(true);
		expect(php.isDir('test.txt')).toEqual(false);
	});

	it('listFiles() should return a list of files in a directory', () => {
		php.mkdirTree('test');
		php.writeFile('test/test.txt', 'Hello World!');
		php.writeFile('test/test2.txt', 'Hello World!');
		expect(php.listFiles('test')).toEqual(['test.txt', 'test2.txt']);
	});
});

describe('PHP – stdio', () => {
	let php;
	beforeEach(async () => {
		php = await startPHP(phpLoaderModule, 'NODE');
	});

	it('should output strings (1)', async () => {
		expect(php.run('<?php echo "Hello world!";')).toEqual({
			headers: expect.any(Object),
			httpStatusCode: 200,
			body: new TextEncoder().encode('Hello world!'),
			errors: '',
			exitCode: 0,
		});
	});
	it('should output strings (2) ', async () => {
		expect(php.run('<?php echo "Hello world!\nI am PHP";')).toEqual({
			headers: expect.any(Object),
			httpStatusCode: 200,
			body: new TextEncoder().encode('Hello world!\nI am PHP'),
			errors: '',
			exitCode: 0,
		});
	});
	it('should output bytes ', async () => {
		const results = php.run(
			'<?php echo chr(1).chr(0).chr(1).chr(0).chr(2);'
		);
		expect(results).toEqual({
			headers: expect.any(Object),
			httpStatusCode: 200,
			body: new Uint8Array([1, 0, 1, 0, 2]),
			errors: '',
			exitCode: 0,
		});
	});
	it('should output strings when .run() is called twice', async () => {
		expect(php.run('<?php echo "Hello world!";')).toEqual({
			headers: expect.any(Object),
			httpStatusCode: 200,
			body: new TextEncoder().encode('Hello world!'),
			errors: '',
			exitCode: 0,
		});

		expect(php.run('<?php echo "Ehlo world!";')).toEqual({
			headers: expect.any(Object),
			httpStatusCode: 200,
			body: new TextEncoder().encode('Ehlo world!'),
			errors: '',
			exitCode: 0,
		});
	});
	it('should capture error data from stderr', async () => {
		const code = `<?php
		$stdErr = fopen('php://stderr', 'w');
		fwrite($stdErr, "Hello from stderr!");
		`;
		expect(php.run(code)).toEqual({
			headers: expect.any(Object),
			httpStatusCode: 200,
			body: new TextEncoder().encode(''),
			errors: 'Hello from stderr!',
			exitCode: 0,
		});
	});
});

describe('PHP – processing request information', () => {
	beforeAll(() => {
		// Shim the user agent for the server
		(global as any).navigator = { userAgent: '' };
	});

	let php: PHP;
	beforeEach(async () => {
		php = await startPHP(phpLoaderModule, 'NODE');
	});

	it('Should have access to raw request data via the php://input stream', async () => {
		const response = await php.run(
			`<?php echo file_get_contents('php://input');`,
			{
				method: 'POST',
				body: '{"foo": "bar"}',
			}
		);
		const bodyText = new TextDecoder().decode(response.body);
		expect(bodyText).toEqual('{"foo": "bar"}');
	});

	it('Should expose urlencoded POST data in $_POST', async () => {
		const response = await php.run(`<?php echo json_encode($_POST);`, {
			method: 'POST',
			body: 'foo=bar',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
		});
		const bodyText = new TextDecoder().decode(response.body);
		expect(bodyText).toEqual('{"foo":"bar"}');
	});

	it('Should expose urlencoded POST arrays in $_POST', async () => {
		const response = await php.run(`<?php echo json_encode($_POST);`, {
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

	it('Should expose multipart POST data in $_POST', async () => {
		const response = await php.run(`<?php echo json_encode($_POST);`, {
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

	it('Should expose multipart POST files in $_FILES', async () => {
		const response = await php.run(
			`<?php echo json_encode(array(
			"files" => $_FILES,
			"is_uploaded" => is_uploaded_file($_FILES["myFile"]["tmp_name"])
		));`,
			{
				method: 'POST',
				body: `--boundary
Content-Disposition: form-data; name="myFile"; filename="text.txt"
Content-Type: text/plain

bar
--boundary--`,
				headers: {
					'Content-Type': 'multipart/form-data; boundary=boundary',
				},
			}
		);
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

	it('Should expose uploaded files in $_FILES', async () => {
		const response = await php.run(
			`<?php echo json_encode(array(
			"files" => $_FILES,
			"is_uploaded" => is_uploaded_file($_FILES["myFile"]["tmp_name"])
		));`,
			{
				method: 'POST',
				files: [
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
			}
		);
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

	it('Should expose both the multipart/form-data request body AND uploaded files in $_FILES', async () => {
		const response = await php.run(
			`<?php echo json_encode(array(
			"files" => $_FILES,
			"is_uploaded1" => is_uploaded_file($_FILES["myFile1"]["tmp_name"]),
			"is_uploaded2" => is_uploaded_file($_FILES["myFile2"]["tmp_name"])
		));`,
			{
				relativeUri: '/',
				method: 'POST',
				body: `--boundary
Content-Disposition: form-data; name="myFile1"; filename="from_body.txt"
Content-Type: text/plain

bar1
--boundary--`,
				files: [
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
			}
		);
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
});
