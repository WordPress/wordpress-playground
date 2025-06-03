// import { getFileNotFoundActionForWordPress } from '@wp-playground/wordpress';
import { loadNodeRuntime } from '..';
import type { FileNotFoundGetActionCallback } from '@php-wasm/universal';
import {
	PHP,
	PHPRequestHandler,
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
	}
);
