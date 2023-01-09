import * as phpLoaderModule from '../../../build/php-5.6.node.js';
import { startPHP } from '../php';

const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

describe('PHP – boot', () => {
	it('should boot', async () => {
		const php = await startPHP(phpLoaderModule, 'NODE');
		expect(php.run('<?php echo "1";')).toEqual({
			stdout: new TextEncoder().encode('1'),
			stderr: [''],
			exitCode: 0,
		});
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
			stdout: new TextEncoder().encode('Hello world!'),
			stderr: [''],
			exitCode: 0,
		});
	});
	it('should output strings (2) ', async () => {
		expect(php.run('<?php echo "Hello world!\nI am PHP";')).toEqual({
			stdout: new TextEncoder().encode('Hello world!\nI am PHP'),
			stderr: [''],
			exitCode: 0,
		});
	});
	it('should output bytes ', async () => {
		const results = php.run(
			'<?php echo chr(1).chr(0).chr(1).chr(0).chr(2);'
		);
		expect(results).toEqual({
			stdout: new Uint8Array([1, 0, 1, 0, 2]),
			stderr: [''],
			exitCode: 0,
		});
	});
	it('should output strings when .run() is called twice', async () => {
		expect(php.run('<?php echo "Hello world!";')).toEqual({
			stdout: new TextEncoder().encode('Hello world!'),
			stderr: [''],
			exitCode: 0,
		});

		expect(php.run('<?php echo "Ehlo world!";')).toEqual({
			stdout: new TextEncoder().encode('Ehlo world!'),
			stderr: [''],
			exitCode: 0,
		});
	});
	it('should output data to stderr', async () => {
		const code = `<?php
		$stdErr = fopen('php://stderr', 'w');
		fwrite($stdErr, "Hello from stderr!");
		`;
		expect(php.run(code)).toEqual({
			stdout: new TextEncoder().encode(''),
			stderr: ['Hello from stderr!'],
			exitCode: 0,
		});
	});
	it('should output data to stderr in the shutdown handler', async () => {
		const code = `<?php
		$stdErr = fopen('php://stderr', 'w');
		$errors = [];
		register_shutdown_function(function() use($stdErr){
			fwrite($stdErr, "Hello from stderr!");
		});
		`;
		expect(php.run(code)).toEqual({
			stdout: new TextEncoder().encode(''),
			stderr: ['Hello from stderr!'],
			exitCode: 0,
		});
	});
});

describe('PHP Server – requests', () => {
	beforeAll(() => {
		// Shim the user agent for the server
		(global as any).navigator = { userAgent: '' };
	});

	let php, server;
	beforeEach(async () => {
		php = await startPHP(phpLoaderModule, 'NODE');
		php.mkdirTree('/tests');
	});

	it('should parse FILES arrays in a PHP way', async () => {
		const response = php.run(
			`<?php echo json_encode([
				'files' => $_FILES,
				'is_uploaded' => is_uploaded_file($_FILES['file_txt']['first']['tmp_name'])
			]);`,
			{
				method: 'POST',
				uploadedFiles: await php.uploadFiles({
					'file_txt[first]': new File(['Hello world'], 'file.txt'),
				}),
			}
		);
		const bodyText = new TextDecoder().decode(response.stdout);
		expect(JSON.parse(bodyText)).toEqual({
			files: {
				file_txt: {
					first: {
						name: 'file.txt',
						type: 'text/plain',
						tmp_name: expect.any(String),
						error: '0',
						size: '1',
					},
				},
			},
			is_uploaded: true,
		});
	});

	it('Should have access to raw POST data', async () => {
		const response = await php.run(
			`<?php
			$fp = fopen('php://input', 'r');
			echo fread($fp, 100);
			fclose($fp);
			`,
			{
				requestBody: '{"foo": "bar"}',
			}
		);
		const bodyText = new TextDecoder().decode(response.stdout);
		expect(bodyText).toEqual('{"foo": "bar"}');
	});
});

// Shim the browser's file class
class File {
	data;
	name;

	constructor(data, name) {
		this.data = data;
		this.name = name;
	}

	get size() {
		return this.data.length;
	}

	get type() {
		return 'text/plain';
	}

	arrayBuffer() {
		return new ArrayBuffer(toUint8Array(this.data));
	}
}

function toUint8Array(data) {
	if (typeof data === 'string') {
		return new TextEncoder().encode(data).buffer;
	} else if (data instanceof ArrayBuffer) {
		data = new Uint8Array(data);
	} else if (Array.isArray(data)) {
		if (data[0] instanceof Number) {
			return new Uint8Array(data);
		}
		return toUint8Array(data[0]);
	} else if (data instanceof Uint8Array) {
		return data.buffer;
	} else {
		throw new Error('Unsupported data type');
	}
}
