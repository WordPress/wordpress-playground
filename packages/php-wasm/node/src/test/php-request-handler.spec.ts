import { RecommendedPHPVersion } from '@wp-playground/common';
import { NodePHP } from '..';
import { PHPRequestHandler, SupportedPHPVersions } from '@php-wasm/universal';
import { createSpawnHandler } from '@php-wasm/util';

describe.each(SupportedPHPVersions)(
	'[PHP %s] PHPRequestHandler – request',
	(phpVersion) => {
		let php: NodePHP;
		let handler: PHPRequestHandler<NodePHP>;
		beforeEach(async () => {
			handler = new PHPRequestHandler({
				documentRoot: '/',
				phpFactory: async () => NodePHP.load(phpVersion),
				maxPhpInstances: 1,
			});
			php = await handler.getPrimaryPhp();
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

		it('should execute a non-default PHP file in a directory', async () => {
			php.mkdirTree('/folder');
			php.writeFile(
				'/folder/some.php',
				`<?php echo 'Some PHP file in a folder.';`
			);
			const response = await handler.request({
				url: '/folder/some.php',
			});
			expect(response).toEqual({
				httpStatusCode: 200,
				headers: {
					'content-type': ['text/html; charset=UTF-8'],
					'x-powered-by': [expect.any(String)],
				},
				bytes: new TextEncoder().encode('Some PHP file in a folder.'),
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

		it('should yield x-file-type=static when a static file is not found and is listed as a remote asset', async () => {
			handler.addRemoteAssetPaths(['index.html']);
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

		it('should not yield x-file-type=static when a static file is not found and is not listed as a remote asset', async () => {
			const response = await handler.request({
				url: '/index.html',
			});
			expect(response).toEqual({
				httpStatusCode: 404,
				headers: {},
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

		it('should redirect to add trailing slash to existing dir', async () => {
			php.mkdirTree('/folder');
			const response = await handler.request({
				url: '/folder',
			});
			expect(response).toEqual({
				httpStatusCode: 301,
				headers: {
					Location: ['/folder/'],
				},
				bytes: expect.any(Uint8Array),
				errors: '',
				exitCode: 0,
			});
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

		it('should delegate request for non-existent PHP file to /index.php with query args', async () => {
			php.writeFile(
				'/index.php',
				`<?php echo "DEFAULT with key={$_GET['key']}";`
			);
			const response = await handler.request({
				url: '/non/existent/file.php?key=value',
			});
			expect(response.httpStatusCode).toEqual(200);
			expect(response.text).toEqual('DEFAULT with key=value');
		});

		it('should delegate request for non-existent non-PHP file to /index.php with query args', async () => {
			php.writeFile(
				'/index.php',
				`<?php echo "DEFAULT with key={$_GET['key']}";`
			);
			const response = await handler.request({
				url: '/non/existent/file?key=value',
			});
			expect(response.httpStatusCode).toEqual(200);
			expect(response.text).toEqual('DEFAULT with key=value');
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
	}
);

describe.each(SupportedPHPVersions)(
	'[PHP %s] PHPRequestHandler – PHP_SELF',
	(phpVersion) => {
		let handler: PHPRequestHandler<NodePHP>;
		beforeEach(async () => {
			handler = new PHPRequestHandler({
				phpFactory: () => NodePHP.load(phpVersion),
				documentRoot: '/var/www',
				maxPhpInstances: 1,
			});
			const php = await handler.getPrimaryPhp();
			php.mkdirTree('/var/www');
		});

		it.each([
			['/index.php', '/index.php'],
			['/index.php?foo=bar', '/index.php'],
			['/index.php?foo=bar&baz=qux', '/index.php'],
			['/', '/index.php'],
		])(
			'Should assign the correct PHP_SELF for %s',
			async (url: string, expected: string) => {
				const php = await handler.getPrimaryPhp();
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
			const php = await handler.getPrimaryPhp();
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

describe('PHPRequestHandler – Loopback call', () => {
	let handler: PHPRequestHandler<NodePHP>;

	it('Spawn: exec() can spawn another PHP before the previous run() concludes', async () => {
		async function createPHP() {
			const php = await NodePHP.load(RecommendedPHPVersion);
			php.setSpawnHandler(
				createSpawnHandler(async function (args, processApi, options) {
					if (args[0] !== 'php') {
						throw new Error(
							`Unexpected command: ${args.join(' ')}`
						);
					}
					const { php, reap } =
						await handler.processManager.acquirePHPInstance();
					const result = await php.run({
						scriptPath: args[1],
						env: options.env,
					});
					processApi.stdout(result.bytes);
					processApi.stderr(result.errors);
					processApi.exit(result.exitCode);
					reap();
				})
			);
			php.writeFile(
				'/first.php',
				`<?php echo 'Starting: '; echo exec("php /second.php", $output, $return_var); echo ' Done';`
			);
			php.writeFile('/second.php', `<?php echo 'Ran second.php!'; `);
			return php;
		}
		handler = new PHPRequestHandler({
			documentRoot: '/',
			phpFactory: createPHP,
			maxPhpInstances: 2,
		});
		const response = await handler.request({
			url: '/first.php',
		});
		expect(response.text).toEqual('Starting: Ran second.php! Done');
	});

	it('Loopback: handler.request() can be called before the previous call concludes', async () => {
		async function createPHP() {
			const php = await NodePHP.load(RecommendedPHPVersion);
			php.setSpawnHandler(
				createSpawnHandler(async function (args, processApi) {
					const result = await handler.request({
						url: '/second.php',
					});
					processApi.stdout(result.bytes);
					processApi.stderr(result.errors);
					processApi.exit(result.exitCode);
				})
			);
			php.writeFile(
				'/first.php',
				`<?php echo 'Starting: '; echo exec("php /second.php", $output, $return_var); echo ' Done';`
			);
			php.writeFile('/second.php', `<?php echo 'Ran second.php!'; `);
			return php;
		}
		handler = new PHPRequestHandler({
			documentRoot: '/',
			phpFactory: createPHP,
			maxPhpInstances: 2,
		});
		const response = await handler.request({
			url: '/first.php',
		});
		expect(response.text).toEqual('Starting: Ran second.php! Done');
	});
});
