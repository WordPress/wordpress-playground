import * as phpLoaderModule from '../../../build/php.node.js';
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

describe('PHP ', () => {
	let php;
	beforeAll(async () => {
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
