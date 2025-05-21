// eslint-disable-next-line @nx/enforce-module-boundaries -- ignore test-related interdependencies so we can test.
import { getFileNotFoundActionForWordPress } from '@wp-playground/wordpress';
import { loadNodeRuntime } from '..';
import {
	FileNotFoundGetActionCallback,
	PHP,
	PHPRequestHandler,
	PHPResponse,
	SupportedPHPVersions,
} from '@php-wasm/universal';
import { joinPaths } from '@php-wasm/util';

interface ConfigForRequestTests {
	phpVersion: (typeof SupportedPHPVersions)[number];
	docRoot: string;
	absoluteUrl: string | undefined;
}

const configsForRequestTests: ConfigForRequestTests[] =
	SupportedPHPVersions.map((phpVersion) => {
		const documentRoots = [
			'/',
			// TODO: Re-enable when we can avoid GH workflow cancelation.
			// Disable for now because the GH CI unit test workflow is getting
			// auto-canceled when this is enabled
			//'/wordpress',
		];
		return documentRoots.map((docRoot) => {
			const absoluteUrls = [
				undefined,
				// TODO: Re-enable when we can avoid GH workflow cancelation.
				// Disable for now because the GH CI unit test workflow is
				// getting auto-canceled when this is enabled.
				//'http://localhost:4321/nested/playground/',
			];
			return absoluteUrls.map((absoluteUrl) => ({
				phpVersion,
				docRoot,
				absoluteUrl,
			}));
		});
	}).flat(2);

describe.each(configsForRequestTests)(
	'[PHP $phpVersion, DocRoot $docRoot, AbsUrl $absoluteUrl] PHPRequestHandler – request',
	({ phpVersion, docRoot, absoluteUrl }) => {
		let php: PHP;
		let handler: PHPRequestHandler;
		let getFileNotFoundActionForTest: FileNotFoundGetActionCallback =
			() => ({
				type: '404',
			});
		beforeEach(async () => {
			handler = new PHPRequestHandler({
				documentRoot: docRoot,
				absoluteUrl,
				phpFactory: async () =>
					new PHP(await loadNodeRuntime(phpVersion)),
				maxPhpInstances: 1,
				getFileNotFoundAction: (relativePath: string) => {
					return getFileNotFoundActionForTest(relativePath);
				},
			});
			php = await handler.getPrimaryPhp();
			php.mkdir(docRoot);
		});

		it('should execute a PHP file', async () => {
			php.writeFile(
				joinPaths(docRoot, 'index.php'),
				`<?php echo 'Hello World';`
			);
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
			php.mkdirTree(joinPaths(docRoot, 'folder'));
			php.writeFile(
				joinPaths(docRoot, 'folder/some.php'),
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
			php.writeFile(joinPaths(docRoot, 'index.html'), `Hello World`);
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
				joinPaths(docRoot, 'Screenshot 2024-04-05 at 7.13.36 AM.html'),
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
				joinPaths(docRoot, 'Screenshot 2024-04-05 at 7.13.36 AM.php'),
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

		const fileNotFoundFallbackTestUris = [
			'/index.php',
			'/other.php',
			'/index.html',
			'/testing.html',
			'/',
			'/subdir',
		];
		fileNotFoundFallbackTestUris.forEach((nonExistentFileUri) => {
			it(`should relay a fallback response for non-existent file: '${nonExistentFileUri}'`, async () => {
				getFileNotFoundActionForTest = (uri: string) => {
					if (uri === nonExistentFileUri) {
						return {
							type: 'response',
							response: new PHPResponse(
								404,
								{ 'x-backfill-from': ['remote-host'] },
								new TextEncoder().encode('404 File not found')
							),
						};
					} else {
						return { type: '404' };
					}
				};
				const response = await handler.request({
					url: nonExistentFileUri,
				});
				expect(response).toEqual({
					httpStatusCode: 404,
					headers: {
						'x-backfill-from': ['remote-host'],
					},
					bytes: expect.any(Uint8Array),
					errors: '',
					exitCode: 0,
				});
			});
			it(`should support internal redirection to a PHP file as a fallback for non-existent file: '${nonExistentFileUri}'`, async () => {
				const primaryPhp = await handler.getPrimaryPhp();
				const scriptPath = joinPaths(docRoot, 'fallback.php');
				primaryPhp.writeFile(
					scriptPath,
					`<?php
						echo "expected fallback to PHP content:";
						echo "{$_SERVER['REQUEST_URI']}:";
						// TODO: Confirm how SCRIPT_NAME should behave and test that
						//echo "{$_SERVER['SCRIPT_NAME']}:";
						echo "{$_SERVER['SCRIPT_FILENAME']}";
						`
				);

				getFileNotFoundActionForTest = (uri: string) => {
					if (uri === nonExistentFileUri) {
						return {
							type: 'internal-redirect',
							uri: '/fallback.php',
						};
					} else {
						return { type: '404' };
					}
				};
				const response = await handler.request({
					url: nonExistentFileUri,
				});

				const expectedRequestUri =
					absoluteUrl === undefined
						? nonExistentFileUri
						: joinPaths(
								new URL(absoluteUrl as string).pathname,
								nonExistentFileUri
						  );
				expect(response).toEqual({
					httpStatusCode: 200,
					headers: expect.any(Object),
					bytes: new TextEncoder().encode(
						'expected fallback to PHP content:' +
							`${expectedRequestUri}:` +
							`${scriptPath}`
					),
					errors: '',
					exitCode: 0,
				});
			});
			it(`should support internal redirection to a static file as a fallback for non-existent file: '${nonExistentFileUri}'`, async () => {
				const primaryPhp = await handler.getPrimaryPhp();
				primaryPhp.writeFile(
					joinPaths(docRoot, 'fallback.txt'),
					'expected fallback to static content'
				);

				getFileNotFoundActionForTest = (uri: string) => {
					if (uri === nonExistentFileUri) {
						return {
							type: 'internal-redirect',
							uri: '/fallback.txt',
						};
					} else {
						return { type: '404' };
					}
				};
				const response = await handler.request({
					url: nonExistentFileUri,
				});
				expect(response).toEqual({
					httpStatusCode: 200,
					headers: expect.any(Object),
					bytes: new TextEncoder().encode(
						'expected fallback to static content'
					),
					errors: '',
					exitCode: 0,
				});
			});
			it(`should support responding with a plain 404 for non-existent file: '${nonExistentFileUri}'`, async () => {
				getFileNotFoundActionForTest = () => ({ type: '404' });
				const response = await handler.request({
					url: nonExistentFileUri,
				});
				expect(response).toEqual({
					httpStatusCode: 404,
					headers: expect.any(Object),
					bytes: expect.any(Uint8Array),
					errors: '',
					exitCode: 0,
				});
			});
		});

		it('should redirect to add trailing slash to existing dir', async () => {
			php.mkdirTree(joinPaths(docRoot, 'folder'));
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
			php.mkdirTree(joinPaths(docRoot, 'folder'));
			php.writeFile(
				joinPaths(docRoot, 'folder/index.php'),
				`<?php echo $_GET['key'];`
			);
			const response = await handler.request({
				url: '/folder/?key=value',
			});
			expect(response.httpStatusCode).toEqual(200);
			expect(response.text).toEqual('value');
		});

		it('should default a folder request to index.html if it exists and index.php does not', async () => {
			php.mkdirTree(joinPaths(docRoot, 'folder'));
			php.writeFile(
				joinPaths(docRoot, 'folder/index.html'),
				`INDEX DOT HTML`
			);
			const response = await handler.request({
				url: '/folder/?key=value',
			});
			expect(response.httpStatusCode).toEqual(200);
			expect(response.text).toEqual('INDEX DOT HTML');
		});

		it('should default a folder request to index.php when when both index.php and index.html exist', async () => {
			php.mkdirTree(joinPaths(docRoot, 'folder'));
			php.writeFile(
				joinPaths(docRoot, 'folder/index.php'),
				`INDEX DOT PHP`
			);
			php.writeFile(
				joinPaths(docRoot, 'folder/index.html'),
				`INDEX DOT HTML`
			);
			const response = await handler.request({
				url: '/folder/?key=value',
			});
			expect(response.httpStatusCode).toEqual(200);
			expect(response.text).toEqual('INDEX DOT PHP');
		});

		it('should return httpStatus 500 if exit code is not 0', async () => {
			php.writeFile(
				joinPaths(docRoot, 'index.php'),
				`<?php
				 echo 'Hello World';
				`
			);
			const response1Result = await handler.request({
				url: '/index.php',
			});
			php.writeFile(
				joinPaths(docRoot, 'index.php'),
				`<?php
				echo 'Hello World' // note there is no closing semicolon
				`
			);
			const response2Result = await handler.request({
				url: '/index.php',
			});
			php.writeFile(
				joinPaths(docRoot, 'index.php'),
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
				joinPaths(docRoot, 'index.php'),
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
				joinPaths(docRoot, 'index.php'),
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
			php.writeFile(
				joinPaths(docRoot, 'index.php'),
				`<?php echo $_SERVER['REQUEST_URI'];`
			);
			const response = await handler.request({
				url: '/index.php#foo',
			});
			const pathPrefix =
				absoluteUrl === undefined ? '/' : new URL(absoluteUrl).pathname;
			expect(response.text).toEqual(joinPaths(pathPrefix, 'index.php'));
		});

		it('Should allow mixing data and files when `body` is a JavaScript object', async () => {
			php.writeFile(
				joinPaths(docRoot, 'index.php'),
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
				joinPaths(docRoot, 'index.php'),
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
			php.writeFile(
				joinPaths(docRoot, 'test.php'),
				`<?php echo $_GET['key'];`
			);
			const response = await handler.request({
				url: '/test.php?key=value',
			});
			expect(response.httpStatusCode).toEqual(200);
			expect(response.text).toEqual('value');
		});

		it('should serve a symlinked file', async () => {
			php.writeFile(
				joinPaths(docRoot, 'target.php'),
				`<?php echo 'foo';`
			);
			php.symlink('target.php', joinPaths(docRoot, 'test.php'));

			const response = await handler.request({
				url: '/test.php',
			});

			expect(response.httpStatusCode).toEqual(200);
			expect(response.text).toEqual('foo');
		});

		it('should serve a symlinked directory', async () => {
			php.mkdir(joinPaths(docRoot, 'target'));
			php.writeFile(
				joinPaths(docRoot, 'target', 'index.php'),
				`<?php echo 'foo';`
			);
			php.symlink(
				joinPaths(docRoot, 'target'),
				joinPaths(docRoot, 'test')
			);

			const response = await handler.request({
				url: '/test/',
			});

			expect(response.httpStatusCode).toEqual(200);
			expect(response.text).toEqual('foo');
		});

		it('should return 301 when requesting a symlinked directory without a trailing slash', async () => {
			php.mkdir(joinPaths(docRoot, 'target'));
			php.writeFile(
				joinPaths(docRoot, 'target', 'index.php'),
				`<?php echo 'foo';`
			);
			php.symlink(
				joinPaths(docRoot, 'target'),
				joinPaths(docRoot, 'test')
			);

			const response = await handler.request({
				url: '/test',
			});

			expect(response.httpStatusCode).toEqual(301);
		});

		it('should serve symlink to symlinked file', async () => {
			php.writeFile(
				joinPaths(docRoot, 'target.php'),
				`<?php echo 'foo';`
			);
			php.symlink('target.php', joinPaths(docRoot, 'symlink.php'));
			php.symlink('symlink.php', joinPaths(docRoot, 'test.php'));

			const response = await handler.request({
				url: '/test.php',
			});

			expect(response.httpStatusCode).toEqual(200);
			expect(response.text).toEqual('foo');
		});

		describe('WordPress requests', () => {
			beforeEach(() => {
				getFileNotFoundActionForTest =
					getFileNotFoundActionForWordPress;
			});
			it('should delegate request for non-existent PHP file to /index.php with query args', async () => {
				php.writeFile(
					joinPaths(docRoot, 'index.php'),
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
					joinPaths(docRoot, 'index.php'),
					`<?php echo "DEFAULT with key={$_GET['key']}";`
				);
				const response = await handler.request({
					url: '/non/existent/file?key=value',
				});
				expect(response.httpStatusCode).toEqual(200);
				expect(response.text).toEqual('DEFAULT with key=value');
			});

			it('should return 200 status and pass query strings when a valid request is made to a WordPress permalink', async () => {
				php.writeFile(
					joinPaths(docRoot, 'index.php'),
					`<?php echo $_GET['key'];`
				);
				const response = await handler.request({
					url: '/category/uncategorized/?key=value',
				});
				expect(response.httpStatusCode).toEqual(200);
				expect(response.text).toEqual('value');
			});
		});
	}
);
