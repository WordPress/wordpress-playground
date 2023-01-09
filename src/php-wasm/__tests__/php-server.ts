import * as phpLoaderModule from '../../../build/php-5.6.node.js';
import { startPHP } from '../php';
import { PHPServer } from '../php-server';

const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

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
});
