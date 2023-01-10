import * as phpLoaderModule from '../../../build/php-5.6.node.js';
import { startPHP } from '../php';
import { File } from './utils';

const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

function runPHP(php, code) {
	php.initContext();
	php.run(code);
	php.destroyContext();
	return php.getOutput();
}

describe('PHP – boot', () => {
	it.only('should boot', async () => {
		const php = await startPHP(phpLoaderModule, 'NODE');
		const server = php.sapi();
		console.log(server);
		expect(server).toContain('REQUEST_METHOD');
		expect(server).toContain('POST');
		expect(server).toContain('[name] => picture_of_sunset.jp');
		console.log(php.sapi2());
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
		expect(runPHP(php, '<?php echo "Hello world!";')).toEqual({
			stdout: new TextEncoder().encode('Hello world!'),
			stderr: [''],
			exitCode: 0,
		});
	});
	it('should output strings (2) ', async () => {
		expect(runPHP(php, '<?php echo "Hello world!\nI am PHP";')).toEqual({
			stdout: new TextEncoder().encode('Hello world!\nI am PHP'),
			stderr: [''],
			exitCode: 0,
		});
	});
	it('should output bytes ', async () => {
		const results = runPHP(
			php,
			'<?php echo chr(1).chr(0).chr(1).chr(0).chr(2);'
		);
		expect(results).toEqual({
			stdout: new Uint8Array([1, 0, 1, 0, 2]),
			stderr: [''],
			exitCode: 0,
		});
	});
	it('should output strings when .run() is called twice', async () => {
		expect(runPHP(php, '<?php echo "Hello world!";')).toEqual({
			stdout: new TextEncoder().encode('Hello world!'),
			stderr: [''],
			exitCode: 0,
		});

		expect(runPHP(php, '<?php echo "Ehlo world!";')).toEqual({
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
		expect(runPHP(php, code)).toEqual({
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
		expect(runPHP(php, code)).toEqual({
			stdout: new TextEncoder().encode(''),
			stderr: ['Hello from stderr!'],
			exitCode: 0,
		});
	});
});

describe('PHP – initialization', () => {
	beforeAll(() => {
		// Shim the user agent for the server
		(global as any).navigator = { userAgent: '' };
	});

	let php;
	beforeEach(async () => {
		php = await startPHP(phpLoaderModule, 'NODE');
		php.mkdirTree('/tests');
	});

	it('Should have access to raw request data via the php://input stream', async () => {
		php.initContext('{"foo": "bar"}');
		await php.run(`<?php echo file_get_contents('php://input');`);
		php.destroyContext();
		const bodyText = new TextDecoder().decode(php.getOutput().stdout);
		expect(bodyText).toEqual('{"foo": "bar"}');
	});
});
