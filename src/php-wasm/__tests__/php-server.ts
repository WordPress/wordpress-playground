import * as phpLoaderModule from '../../../build/php.node.js';
import { startPHP } from '../php';
import { PHPServer } from '../php-server';

const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

describe('PHP Server – boot', () => {
	beforeAll(() => {
		// Shim the user agent for the server
		(global as any).navigator = { userAgent: '' };
	});

	it('should boot', async () => {
		const php = await startPHP(phpLoaderModule, 'NODE');
		php.mkdirTree('/tests');
		const server = new PHPServer(php, {
			documentRoot: '/tests',
			absoluteUrl: 'http://localhost/',
			isStaticFilePath: (path) => path.startsWith('/uploads'),
		});

		server.php.writeFile(
			'/tests/upload.php',
			`<?php echo json_encode([
				'files' => $_FILES,
				'is_uploaded' => is_uploaded_file($_FILES['file_txt']['tmp_name'])
			]);`
		);
		const response = await server.request({
			path: `/upload.php`,
			method: 'POST',
			_POST: {},
			files: {
				file_txt: new File(['Hello world'], 'file.txt'),
			},
		});
		const bodyText = new TextDecoder().decode(response.body);
		expect(JSON.parse(bodyText)).toEqual({
			files: {
				file_txt: {
					name: 'file.txt',
					type: 'text/plain',
					tmp_name: expect.any(String),
					error: '0',
					size: '1',
				},
			},
			is_uploaded: true,
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
		server = new PHPServer(php, {
			documentRoot: '/tests',
			absoluteUrl: 'http://localhost/',
			isStaticFilePath: (path) => path.startsWith('/uploads'),
		});
	});

	it('should parse POST arrays in a PHP way', async () => {
		server.php.writeFile(
			'/tests/test.php',
			`<?php echo json_encode($_POST);`
		);
		const response = await server.request({
			path: `/test.php`,
			method: 'POST',
			_POST: {
				'array[key1][subkey1]': 'value1',
				'array[key1][subkey2]': 'value2',
				'array[key2][subkey1]': 'value3',
			},
		});
		const bodyText = new TextDecoder().decode(response.body);
		expect(JSON.parse(bodyText)).toEqual({
			array: {
				key1: {
					subkey1: 'value1',
					subkey2: 'value2',
				},
				key2: {
					subkey1: 'value3',
				},
			},
		});
	});

	it('should parse FILES arrays in a PHP way', async () => {
		server.php.writeFile(
			'/tests/upload.php',
			`<?php echo json_encode([
				'files' => $_FILES,
				'is_uploaded' => is_uploaded_file($_FILES['file_txt']['first']['tmp_name'])
			]);`
		);
		const response = await server.request({
			path: `/upload.php`,
			method: 'POST',
			_POST: {},
			files: {
				'file_txt[first]': new File(['Hello world'], 'file.txt'),
			},
		});
		const bodyText = new TextDecoder().decode(response.body);
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
		return dataToArrayBuffer(this.data);
	}
}

function dataToArrayBuffer(data) {
	if (typeof data === 'string') {
		return new TextEncoder().encode(data).buffer;
	} else if (data instanceof ArrayBuffer) {
		data = new Uint8Array(data);
	} else if (Array.isArray(data)) {
		if (data[0] instanceof Number) {
			return new Uint8Array(data);
		}
		return dataToArrayBuffer(data[0]);
	} else if (data instanceof Uint8Array) {
		return data.buffer;
	} else {
		throw new Error('Unsupported data type');
	}
}
