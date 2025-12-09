import { RecommendedPHPVersion } from '@wp-playground/common';
// eslint-disable-next-line @nx/enforce-module-boundaries -- ignore test-related interdependencies so we can test.
import { loadNodeRuntime } from '..';
import type {
	CookieStore,
	FileNotFoundGetActionCallback,
} from '@php-wasm/universal';
import {
	HttpCookieStore,
	PHP,
	PHPRequestHandler,
	PHPResponse,
	SupportedPHPVersions,
} from '@php-wasm/universal';
import { createSpawnHandler, joinPaths } from '@php-wasm/util';

/*
 * This is a copy-paste from "@wp-playground/wordpress" in the "boot.ts" file
 * to avoid adding a dependency on "@wp-playground/wordpress" and causing
 * circular dependency linter errors.
 *
 * TODO: Remove this when we enable ciruclar deps in test files; after the
 *       package dependency refactor PR is merged:
 *         https://github.com/Automattic/wordpress-playground-private/pull/148
 */
export function getFileNotFoundActionForWordPress(
	// eslint-disable-next-line @typescript-eslint/no-unused-vars -- maintain consistent FileNotFoundGetActionCallback signature
	relativeUri: string
) {
	// Delegate unresolved requests to WordPress. This makes WP magic possible,
	// like pretty permalinks and dynamically generated sitemaps.
	return {
		type: 'internal-redirect',
		uri: '/index.php',
	} as const;
}

interface ConfigForRequestTests {
	phpVersion: (typeof SupportedPHPVersions)[number];
	docRoot: string;
	absoluteUrl: string | undefined;
}

let configsForRequestTests: ConfigForRequestTests[] = SupportedPHPVersions.map(
	(phpVersion) => {
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
	}
).flat(2);

if ('PHP' in process.env) {
	configsForRequestTests = configsForRequestTests.filter(
		(config) => config.phpVersion === process.env['PHP']
	);
}

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

		afterEach(async () => {
			php.exit();
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
			console.log({ absoluteUrl, docRoot });
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

let phpVersions = SupportedPHPVersions;
if ('PHP' in process.env) {
	phpVersions = [process.env['PHP']] as any;
}
describe.each(phpVersions)(
	'[PHP %s] PHPRequestHandler – $_SERVER entries',
	(phpVersion) => {
		let handler: PHPRequestHandler;
		beforeEach(async () => {
			handler = new PHPRequestHandler({
				phpFactory: async () =>
					new PHP(await loadNodeRuntime(phpVersion)),
				documentRoot: '/var/www',
				maxPhpInstances: 1,
			});
			const php = await handler.getPrimaryPhp();
			php.mkdirTree('/var/www');
		});

		afterEach(async () => {
			(await handler.getPrimaryPhp()).exit();
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

		it('should assign the correct cwd', async () => {
			const php = await handler.getPrimaryPhp();
			php.writeFile('/var/www/index.php', `<?php echo getcwd();`);

			const response = await handler.request({
				url: '/index.php',
			});

			expect(response.text).toEqual('/var/www');
		});

		describe('PHP Dev Server scenario (with PATH_INFO)', () => {
			it('should set $_SERVER variables correctly for script with PATH_INFO', async () => {
				const php = await handler.getPrimaryPhp();
				php.mkdirTree('/var/www/subdir');
				php.writeFile(
					'/var/www/subdir/script.php',
					`<?php
						echo json_encode([
							'REQUEST_URI' => $_SERVER['REQUEST_URI'],
							'SCRIPT_NAME' => $_SERVER['SCRIPT_NAME'],
							'SCRIPT_FILENAME' => $_SERVER['SCRIPT_FILENAME'],
							'PATH_INFO' => $_SERVER['PATH_INFO'] ?? '(not set)',
							'PHP_SELF' => $_SERVER['PHP_SELF'],
						]);
					`
				);

				const response = await handler.request({
					url: '/subdir/script.php/b.php/c.php',
				});

				const result = response.json;
				expect(result['REQUEST_URI']).toEqual(
					'/subdir/script.php/b.php/c.php'
				);
				expect(result['SCRIPT_NAME']).toEqual('/subdir/script.php');
				expect(result['SCRIPT_FILENAME']).toEqual(
					'/var/www/subdir/script.php'
				);
				expect(result['PATH_INFO']).toEqual('/b.php/c.php');
				expect(result['PHP_SELF']).toEqual(
					'/subdir/script.php/b.php/c.php'
				);
			});
		});

		describe('Apache vanilla request scenario', () => {
			it('should set $_SERVER variables correctly for vanilla request with query string', async () => {
				const php = await handler.getPrimaryPhp();
				php.mkdirTree('/var/www/subdir');
				php.writeFile(
					'/var/www/subdir/script.php',
					`<?php
						echo json_encode([
							'REQUEST_URI' => $_SERVER['REQUEST_URI'],
							'SCRIPT_NAME' => $_SERVER['SCRIPT_NAME'],
							'SCRIPT_FILENAME' => $_SERVER['SCRIPT_FILENAME'],
							'PATH_INFO' => $_SERVER['PATH_INFO'] ?? '(not set)',
							'PHP_SELF' => $_SERVER['PHP_SELF'],
							'QUERY_STRING' => $_SERVER['QUERY_STRING'] ?? '',
							'REQUEST_METHOD' => $_SERVER['REQUEST_METHOD'],
							'DOCUMENT_ROOT' => $_SERVER['DOCUMENT_ROOT'],
							'GET_param' => $_GET['param'] ?? '(not set)',
						]);
					`
				);

				const response = await handler.request({
					url: '/subdir/script.php?param=value',
				});

				const result = response.json;
				expect(result['REQUEST_URI']).toEqual(
					'/subdir/script.php?param=value'
				);
				expect(result['SCRIPT_NAME']).toEqual('/subdir/script.php');
				expect(result['SCRIPT_FILENAME']).toEqual(
					'/var/www/subdir/script.php'
				);
				expect(result['PATH_INFO']).toEqual('');
				// This should actually be a missing key, not an empty string.
				// @TODO: Adjust this inconsistency.
				// expect(result['PATH_INFO']).toEqual('(not set)');
				expect(result['PHP_SELF']).toEqual('/subdir/script.php');
				expect(result['QUERY_STRING']).toEqual('param=value');
				expect(result['REQUEST_METHOD']).toEqual('GET');
				expect(result['DOCUMENT_ROOT']).toEqual('/var/www');
				expect(result['GET_param']).toEqual('value');
			});
		});

		describe('Apache rewriting rules scenario', () => {
			it('should set $_SERVER variables correctly when rewrite rules are applied', async () => {
				const handlerWithRewrite = new PHPRequestHandler({
					phpFactory: async () =>
						new PHP(await loadNodeRuntime(phpVersion)),
					documentRoot: '/var/www',
					maxPhpInstances: 1,
					rewriteRules: [
						{
							match: /^\/api\/v1\/user\/([0-9]+)$/,
							replacement:
								'/subdir/script.php?endpoint=user&id=$1',
						},
					],
				});
				const php = await handlerWithRewrite.getPrimaryPhp();
				php.mkdirTree('/var/www/subdir');
				php.writeFile(
					'/var/www/subdir/script.php',
					`<?php
						echo json_encode([
							'REQUEST_URI' => $_SERVER['REQUEST_URI'],
							'SCRIPT_NAME' => $_SERVER['SCRIPT_NAME'],
							'SCRIPT_FILENAME' => $_SERVER['SCRIPT_FILENAME'],
							'PATH_INFO' => $_SERVER['PATH_INFO'] ?? '(not set)',
							'PHP_SELF' => $_SERVER['PHP_SELF'],
							'QUERY_STRING' => $_SERVER['QUERY_STRING'] ?? '',
							'GET_endpoint' => $_GET['endpoint'] ?? '(not set)',
							'GET_id' => $_GET['id'] ?? '(not set)',
						]);
					`
				);

				const response = await handlerWithRewrite.request({
					url: '/api/v1/user/123',
				});

				const result = response.json;
				// REQUEST_URI should be the original URL (before rewriting) per Apache behavior
				expect(result['REQUEST_URI']).toEqual('/api/v1/user/123');
				// SCRIPT_NAME is the path to the script relative to document root
				expect(result['SCRIPT_NAME']).toEqual('/subdir/script.php');
				// SCRIPT_FILENAME is the absolute path to the script file
				expect(result['SCRIPT_FILENAME']).toEqual(
					'/var/www/subdir/script.php'
				);
				// PATH_INFO is not set for this type of rewrite
				expect(result['PATH_INFO']).toEqual('(not set)');
				// PHP_SELF should be the script path per Apache behavior
				expect(result['PHP_SELF']).toEqual('/subdir/script.php');
				// QUERY_STRING should contain the rewritten query parameters
				expect(result['QUERY_STRING']).toEqual('endpoint=user&id=123');
				// $_GET should have the parsed query parameters
				expect(result['GET_endpoint']).toEqual('user');
				expect(result['GET_id']).toEqual('123');

				php.exit();
			});

			it('should preserve original REQUEST_URI while rewriting to a different script', async () => {
				const handlerWithRewrite = new PHPRequestHandler({
					phpFactory: async () =>
						new PHP(await loadNodeRuntime(phpVersion)),
					documentRoot: '/var/www',
					maxPhpInstances: 1,
					rewriteRules: [
						{
							match: /^\/pretty\/url/,
							replacement: '/index.php?page=pretty',
						},
					],
				});
				const php = await handlerWithRewrite.getPrimaryPhp();
				php.writeFile(
					'/var/www/index.php',
					`<?php
						echo json_encode([
							'REQUEST_URI' => $_SERVER['REQUEST_URI'],
							'PHP_SELF' => $_SERVER['PHP_SELF'],
							'SCRIPT_NAME' => $_SERVER['SCRIPT_NAME'],
						]);
					`
				);

				const response = await handlerWithRewrite.request({
					url: '/pretty/url',
				});

				const result = response.json;
				// REQUEST_URI should be the original URL per Apache behavior
				expect(result['REQUEST_URI']).toEqual('/pretty/url');
				// PHP_SELF should be the script path per Apache behavior
				expect(result['PHP_SELF']).toEqual('/index.php');
				// SCRIPT_NAME is the script path
				expect(result['SCRIPT_NAME']).toEqual('/index.php');

				php.exit();
			});

			it('should preserve the original query params through URL rewriting', async () => {
				const handlerWithRewrite = new PHPRequestHandler({
					phpFactory: async () =>
						new PHP(await loadNodeRuntime(phpVersion)),
					documentRoot: '/var/www',
					maxPhpInstances: 1,
					rewriteRules: [
						{
							match: /^\/pretty\/url/,
							replacement: '/index.php?page=pretty',
						},
					],
				});
				const php = await handlerWithRewrite.getPrimaryPhp();
				php.writeFile(
					'/var/www/index.php',
					`<?php
						echo json_encode([
							'REQUEST_URI' => $_SERVER['REQUEST_URI'],
							'PHP_SELF' => $_SERVER['PHP_SELF'],
							'SCRIPT_NAME' => $_SERVER['SCRIPT_NAME'],
							'QUERY_STRING' => $_SERVER['QUERY_STRING'],
						]);
					`
				);

				const response = await handlerWithRewrite.request({
					url: '/pretty/url?foo=bar&page=different-value',
				});

				const result = response.json;
				// REQUEST_URI should be the original URL per Apache behavior
				expect(result['REQUEST_URI']).toEqual(
					'/pretty/url?foo=bar&page=different-value'
				);
				// QUERY_STRING should contain all the query parameters: original + rewritten
				expect(result['QUERY_STRING']).toEqual(
					'page=pretty&foo=bar&page=different-value'
				);
				// PHP_SELF should be the script path per Apache behavior
				expect(result['PHP_SELF']).toEqual('/index.php');
				// SCRIPT_NAME is the script path
				expect(result['SCRIPT_NAME']).toEqual('/index.php');

				php.exit();
			});
		});
	}
);

describe('PHPRequestHandler – Loopback call', () => {
	let handler: PHPRequestHandler;

	it('Spawn: exec() can spawn another PHP before the previous run() concludes', async () => {
		async function createPHP() {
			const php = new PHP(await loadNodeRuntime(RecommendedPHPVersion));
			php.setSpawnHandler(
				createSpawnHandler(async function (args, processApi, options) {
					if (args[0] !== 'php') {
						throw new Error(
							`Unexpected command: ${args.join(' ')}`
						);
					}
					const { php, reap } =
						await handler.instanceManager.acquirePHPInstance();
					const result = await php.run({
						scriptPath: args[1],
						env: options.env,
					});
					// @ts-ignore
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
			const php = new PHP(await loadNodeRuntime(RecommendedPHPVersion));
			php.setSpawnHandler(
				createSpawnHandler(async function (args, processApi) {
					const result = await handler.request({
						url: '/second.php',
					});
					// @ts-ignore
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

describe('PHPRequestHandler – Cookie store', () => {
	const prepareHandler = async (cookieStore?: CookieStore | false) => {
		const handler = new PHPRequestHandler({
			documentRoot: '/',
			phpFactory: async () =>
				new PHP(await loadNodeRuntime(RecommendedPHPVersion)),
			maxPhpInstances: 1,
			cookieStore,
		});
		const php = await handler.getPrimaryPhp();
		php.writeFile(
			'/set-cookie.php',
			`<?php setcookie("my-cookie", "where-is-my-cookie", time() + 3600, "/");`
		);
		php.writeFile('/get-cookie.php', `<?php echo json_encode($_COOKIE);`);
		return handler;
	};
	it('should persist cookies internally when not defining a strategy', async () => {
		const handler = await prepareHandler();

		// Cookies return in the response
		let response = await handler.request({
			url: '/set-cookie.php',
		});
		const cookies = response.headers['set-cookie'];
		expect(cookies).toHaveLength(1);
		expect(cookies[0]).toMatch(
			/my-cookie=where-is-my-cookie; expires=.*; Max-Age=3600; path=\//
		);

		// Cookies are persisted internally in the request handler.
		// Note that we are not passing cookies in the header of the response.
		response = await handler.request({
			url: '/get-cookie.php',
		});
		expect(response.text).toEqual(
			JSON.stringify({ 'my-cookie': 'where-is-my-cookie' })
		);
	});

	it('should persist cookies internally with the HttpCookieStore', async () => {
		const handler = await prepareHandler(new HttpCookieStore());

		// Cookies return in the response
		let response = await handler.request({
			url: '/set-cookie.php',
		});
		const cookies = response.headers['set-cookie'];
		expect(cookies).toHaveLength(1);
		expect(cookies[0]).toMatch(
			/my-cookie=where-is-my-cookie; expires=.*; Max-Age=3600; path=\//
		);

		// Cookies are persisted internally in the request handler.
		// Note that we are not passing cookies in the header of the response.
		response = await handler.request({
			url: '/get-cookie.php',
		});
		expect(response.text).toEqual(
			JSON.stringify({ 'my-cookie': 'where-is-my-cookie' })
		);
	});

	it('should not persist cookies internally when the cookie store is false', async () => {
		const handler = await prepareHandler(false);

		// Cookies return in the response
		let response = await handler.request({
			url: '/set-cookie.php',
		});
		const cookies = response.headers['set-cookie'];
		expect(cookies).toHaveLength(1);
		expect(cookies[0]).toMatch(
			/my-cookie=where-is-my-cookie; expires=.*; Max-Age=3600; path=\//
		);

		// No cookies are persisted internally.
		// Note that we are not passing cookies in the header of the response.
		response = await handler.request({
			url: '/get-cookie.php',
		});
		expect(response.text).toEqual(JSON.stringify([]));

		// Cookies are available in the PHP environment when passed in the
		// request.
		response = await handler.request({
			url: '/get-cookie.php',
			headers: { Cookie: 'my-cookie=where-is-my-cookie' },
		});
		expect(response.text).toEqual(
			JSON.stringify({ 'my-cookie': 'where-is-my-cookie' })
		);
	});
});
