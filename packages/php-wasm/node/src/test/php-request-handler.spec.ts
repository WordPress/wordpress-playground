import { NodePHP, getPHPLoaderModule } from '..';
import {
	loadPHPRuntime,
	PHPRequestHandler,
	SupportedPHPVersions,
} from '@php-wasm/universal';

describe.each(SupportedPHPVersions)(
	'[PHP %s] PHPRequestHandler – request',
	(phpVersion) => {
		let php: NodePHP;
		let handler: PHPRequestHandler;
		beforeEach(async () => {
			const phpLoaderModule = await getPHPLoaderModule(phpVersion);
			const runtimeId = await loadPHPRuntime(phpLoaderModule);
			php = new NodePHP(runtimeId);
			handler = new PHPRequestHandler(php, {
				documentRoot: '/',
			});
		});

		it('should execute a PHP file', async () => {
			php.writeFile('/index.php', `<?php echo 'Hello World';`);
			const response = await handler.request({
				url: '/index.php',
			});
			expect(response).toEqual({
				httpStatusCode: 200,
				headers: {
					'content-type': ['text/html; charset=UTF-8'],
					'x-powered-by': [expect.any(String)],
				},
				bytes: new TextEncoder().encode('Hello World'),
				errors: '',
				exitCode: 0,
			});
		});

		it('should serve a static file', async () => {
			php.writeFile('/index.html', `Hello World`);
			const response = await handler.request({
				url: '/index.html',
			});
			expect(response).toEqual({
				httpStatusCode: 200,
				headers: {
					'content-type': ['text/html'],

					'accept-ranges': ['bytes'],
					'cache-control': ['public, max-age=0'],
					'content-length': ['11'],
				},
				bytes: new TextEncoder().encode('Hello World'),
				errors: '',
				exitCode: 0,
			});
		});

		it('should serve a static file with urlencoded entities in the path', async () => {
			php.writeFile(
				'/Screenshot 2024-04-05 at 7.13.36 AM.html',
				`Hello World`
			);
			const response = await handler.request({
				url: '/Screenshot 2024-04-05 at 7.13.36%E2%80%AFAM.html',
			});
			expect(response).toEqual({
				httpStatusCode: 200,
				headers: {
					'content-type': ['text/html'],

					'accept-ranges': ['bytes'],
					'cache-control': ['public, max-age=0'],
					'content-length': ['11'],
				},
				bytes: new TextEncoder().encode('Hello World'),
				errors: '',
				exitCode: 0,
			});
		});

		it('should serve a PHP file with urlencoded entities in the path', async () => {
			php.writeFile(
				'/Screenshot 2024-04-05 at 7.13.36 AM.php',
				`Hello World`
			);
			const response = await handler.request({
				url: '/Screenshot 2024-04-05 at 7.13.36%E2%80%AFAM.php',
			});
			expect(response).toEqual({
				httpStatusCode: 200,
				headers: {
					'content-type': ['text/html; charset=UTF-8'],
					'x-powered-by': [expect.any(String)],
				},
				bytes: new TextEncoder().encode('Hello World'),
				errors: '',
				exitCode: 0,
			});
		});

		it('should yield x-file-type=static when a static file is not found', async () => {
			const response = await handler.request({
				url: '/index.html',
			});
			expect(response).toEqual({
				httpStatusCode: 404,
				headers: {
					'x-file-type': ['static'],
				},
				bytes: expect.any(Uint8Array),
				errors: '',
				exitCode: 0,
			});
		});

		it('should not yield x-file-type=static when a PHP file is not found', async () => {
			const response = await handler.request({
				url: '/index.php',
			});
			expect(response).toEqual({
				httpStatusCode: 404,
				headers: {},
				bytes: expect.any(Uint8Array),
				errors: '',
				exitCode: 0,
			});
		});

		it('should only handle a single PHP request at a time', async () => {
			php.writeFile(
				'/index.php',
				`<?php
			// A unique function name to force a fatal error
			// if this file gets loaded twice during the same
			// request
			function a_function() {}
			// Use an async operation so that the second
			// request is dispatched before the first one
			// finishes
			@stream_socket_client('http://localhost:1235');
			echo 'Hello World';
		`
			);
			const response1 = handler.request({
				url: '/index.php',
			});
			expect(handler.isRequestRunning).toBe(true);
			// No stdout should be written yet
			expect(php.fileExists('/tmp/stdout')).toBe(false);
			const response2 = handler.request({
				url: '/index.php',
			});
			const [response1Result, response2Result] = await Promise.all([
				response1,
				response2,
			]);
			expect(response1Result).toEqual({
				httpStatusCode: 200,
				headers: {
					'content-type': ['text/html; charset=UTF-8'],
					'x-powered-by': [expect.any(String)],
				},
				bytes: new TextEncoder().encode('Hello World'),
				errors: '',
				exitCode: 0,
			});
			expect(response2Result).toEqual({
				httpStatusCode: 200,
				headers: {
					'content-type': ['text/html; charset=UTF-8'],
					'x-powered-by': [expect.any(String)],
				},
				bytes: new TextEncoder().encode('Hello World'),
				errors: '',
				exitCode: 0,
			});
		});

		it('should return httpStatus 500 if exit code is not 0', async () => {
			php.writeFile(
				'/index.php',
				`<?php
				 echo 'Hello World';
				`
			);
			const response1Result = await handler.request({
				url: '/index.php',
			});
			php.writeFile(
				'/index.php',
				`<?php
				echo 'Hello World' // note there is no closing semicolon
				`
			);
			const response2Result = await handler.request({
				url: '/index.php',
			});
			php.writeFile(
				'/index.php',
				`<?php
				 echo 'Hello World!';
				`
			);
			const response3Result = await handler.request({
				url: '/index.php',
			});
			expect(response1Result).toEqual({
				httpStatusCode: 200,
				headers: {
					'content-type': ['text/html; charset=UTF-8'],
					'x-powered-by': [expect.any(String)],
				},
				bytes: new TextEncoder().encode('Hello World'),
				errors: '',
				exitCode: 0,
			});
			expect(response2Result).toEqual({
				httpStatusCode: 500,
				headers: {
					'content-type': ['text/html; charset=UTF-8'],
					'x-powered-by': [expect.any(String)],
				},
				bytes: expect.any(Uint8Array),
				errors: expect.any(String),
				exitCode: 255,
			});
			expect(response3Result).toEqual({
				httpStatusCode: 200,
				headers: {
					'content-type': ['text/html; charset=UTF-8'],
					'x-powered-by': [expect.any(String)],
				},
				bytes: new TextEncoder().encode('Hello World!'),
				errors: '',
				exitCode: 0,
			});
		});

		it('Should accept `body` as a JavaScript object', async () => {
			/**
			 * Tests against calling phpwasm_init_uploaded_files_hash() when
			 * the Content-type header is set to multipart/form-data. See the
			 * phpwasm_init_uploaded_files_hash() docstring for more info.
			 */
			php.writeFile(
				'/index.php',
				`<?php
				echo json_encode($_POST);`
			);
			const response = await handler.request({
				url: '/index.php',
				method: 'POST',
				body: {
					key: 'value',
				},
			});
			expect(response.text).toEqual(JSON.stringify({ key: 'value' }));
		});

		it('Should not crash on move_uploaded_file', async () => {
			/**
			 * Tests against calling phpwasm_init_uploaded_files_hash() when
			 * the Content-type header is set to multipart/form-data. See the
			 * phpwasm_init_uploaded_files_hash() docstring for more info.
			 */
			php.writeFile(
				'/index.php',
				`<?php
				move_uploaded_file($_FILES["myFile"]["tmp_name"], '/tmp/moved.txt');
				echo json_encode(file_exists('/tmp/moved.txt'));`
			);
			const response = await handler.request({
				url: '/index.php',
				method: 'POST',
				body: {
					myFile: new File(['bar'], 'bar.txt'),
				},
			});
			expect(response.text).toEqual('true');
		});

		/**
		 * @see https://github.com/WordPress/wordpress-playground/issues/1120
		 */
		it('Should not propagate the # part of the URL to PHP', async () => {
			php.writeFile('/index.php', `<?php echo $_SERVER['REQUEST_URI'];`);
			const response = await handler.request({
				url: '/index.php#foo',
			});
			expect(response.text).toEqual('/index.php');
		});

		it('Should allow mixing data and files when `body` is a JavaScript object', async () => {
			php.writeFile(
				'/index.php',
				`<?php
				move_uploaded_file($_FILES["myFile"]["tmp_name"], '/tmp/moved.txt');
				echo json_encode(array_merge(
					$_POST,
					array('file_exists' => file_exists('/tmp/moved.txt'))
				));`
			);
			const response = await handler.request({
				url: '/index.php',
				method: 'POST',
				body: {
					key: 'value',
					myFile: new File(['bar'], 'bar.txt'),
				},
			});
			expect(response.text).toEqual(
				JSON.stringify({ key: 'value', file_exists: true })
			);
		});

		it('Should handle an empty file object and post data', async () => {
			await php.writeFile(
				'/index.php',
				`<?php
				echo json_encode($_POST);`
			);
			const response = await handler.request({
				url: '/index.php',
				method: 'POST',
				body: 'foo=bar',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
			});
			expect(response.json).toEqual({ foo: 'bar' });
		});

		it('should return error 502 when a PHP-sourced request is received before the previous request is handled', async () => {
			php.writeFile('/index.php', `<?php echo "Hello";`);

			const response1 = handler.request({
				url: '/index.php',
				headers: {
					'x-request-issuer': 'php',
				},
			});
			const response2 = handler.request({
				url: '/index.php',
				headers: {
					'x-request-issuer': 'php',
				},
			});
			expect((await response1).httpStatusCode).toEqual(200);
			expect((await response2).httpStatusCode).toEqual(502);
		});

		it('should return 200 and pass query strings when a valid request is made to a PHP file', async () => {
			php.writeFile('/test.php', `<?php echo $_GET['key'];`);
			const response = await handler.request({
				url: '/test.php?key=value',
			});
			expect(response.httpStatusCode).toEqual(200);
			expect(response.text).toEqual('value');
		});

		it('should return 200 status and pass query strings when a valid request is made to a WordPress permalink', async () => {
			php.writeFile('/index.php', `<?php echo $_GET['key'];`);
			const response = await handler.request({
				url: '/category/uncategorized/?key=value',
			});
			expect(response.httpStatusCode).toEqual(200);
			expect(response.text).toEqual('value');
		});

		it('should return 200 and pass query strings when a valid request is made to a folder', async () => {
			php.mkdirTree('/folder');
			php.writeFile('/folder/index.php', `<?php echo $_GET['key'];`);
			const response = await handler.request({
				url: '/folder/?key=value',
			});
			expect(response.httpStatusCode).toEqual(200);
			expect(response.text).toEqual('value');
		});
	}
);

describe.each(SupportedPHPVersions)(
	'[PHP %s] PHPRequestHandler – PHP_SELF',
	(phpVersion) => {
		let php: NodePHP;
		let handler: PHPRequestHandler;
		beforeEach(async () => {
			const phpLoaderModule = await getPHPLoaderModule(phpVersion);
			const runtimeId = await loadPHPRuntime(phpLoaderModule);
			php = new NodePHP(runtimeId);
			php.mkdirTree('/var/www');
			handler = new PHPRequestHandler(php, {
				documentRoot: '/var/www',
			});
		});

		it.each([
			['/index.php', '/index.php'],
			['/index.php?foo=bar', '/index.php'],
			['/index.php?foo=bar&baz=qux', '/index.php'],
			['/', '/index.php'],
		])(
			'Should assign the correct PHP_SELF for %s',
			async (url: string, expected: string) => {
				php.writeFile(
					'/var/www/index.php',
					`<?php echo $_SERVER['PHP_SELF'];`
				);
				const response = await handler.request({
					url,
				});
				expect(response.text).toEqual(expected);
			}
		);

		it('should assign the correct PHP_SELF (file in subdirectory, query string present)', async () => {
			php.mkdirTree('/var/www/subdir');
			php.writeFile(
				'/var/www/subdir/index.php',
				`<?php echo $_SERVER['PHP_SELF'];`
			);
			const response = await handler.request({
				url: '/subdir/?foo=bar',
			});
			expect(response.text).toEqual('/subdir/index.php');
		});
	}
);
