import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { runCLI } from '../src/run-cli';
import type { RunCLIArgs, RunCLIServer } from '../src/run-cli';
import type { MockInstance } from 'vitest';
import { vi } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { exec } from 'node:child_process';
import {
	mkdirSync,
	readdirSync,
	writeFileSync,
	symlinkSync,
	unlinkSync,
	existsSync,
	lstatSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { MinifiedWordPressVersionsList } from '@wp-playground/wordpress-builds';
import { type Log, logger } from '@php-wasm/logger';

const blueprintVersions = [
	{
		version: 1,
		suiteCliArgs: {},
		expectedHomePageTitle: 'My WordPress Website',
	},
	{
		version: 2,
		suiteCliArgs: {
			'experimental-blueprints-v2-runner': true,
		},
		expectedHomePageTitle: 'WordPress Site',
	},
];

describe.each(blueprintVersions)(
	'run-cli with Blueprints v$version',
	({ version, suiteCliArgs, expectedHomePageTitle }) => {
		let cliServer: RunCLIServer;

		afterEach(async () => {
			if (cliServer) {
				try {
					await cliServer[Symbol.asyncDispose]();
				} catch {
					// Ignore any dispose-related errors
				}
			}
		});

		test('should set PHP version', async () => {
			cliServer = await runCLI({
				...suiteCliArgs,
				command: 'server',
				php: '8.0',
				// Let's skip the cost of WordPress setup because it is
				// irrelevant for this test.
				skipWordPressSetup: true,
				skipSqliteSetup: true,
				blueprint: undefined,
			});
			await cliServer.playground.writeFile(
				'/wordpress/version.php',
				'<?php echo phpversion(); ?>'
			);
			const versionUrl = new URL('/version.php', cliServer.serverUrl);
			const response = await fetch(versionUrl);
			expect(response.status).toBe(200);
			const text = await response.text();
			expect(text).toContain('8.0');
		});

		test('should use custom site-url when provided', async () => {
			const customSiteUrl = 'https://example.com';
			cliServer = await runCLI({
				...suiteCliArgs,
				command: 'server',
				'site-url': customSiteUrl,
			});
			await cliServer.playground.writeFile(
				'/wordpress/site-url.php',
				'<?php require_once "/wordpress/wp-load.php"; echo get_option("siteurl"); ?>'
			);
			const siteUrlTestUrl = new URL(
				'/site-url.php',
				cliServer.serverUrl
			);
			const response = await fetch(siteUrlTestUrl);
			expect(response.status).toBe(200);
			const text = await response.text();
			expect(text).toContain(customSiteUrl);
		});

		test('should use default site-url when not provided', async () => {
			cliServer = await runCLI({
				...suiteCliArgs,
				command: 'server',
				port: 9500,
			});
			await cliServer.playground.writeFile(
				'/wordpress/site-url.php',
				'<?php require_once "/wordpress/wp-load.php"; echo get_option("siteurl"); ?>'
			);
			const siteUrlTestUrl = new URL(
				'/site-url.php',
				cliServer.serverUrl
			);
			const response = await fetch(siteUrlTestUrl);
			expect(response.status).toBe(200);
			const text = await response.text();
			expect(text).toContain('http://127.0.0.1:9500');
		});

		test('should set WordPress version', async () => {
			const oldestSupportedVersion =
				MinifiedWordPressVersionsList[
					MinifiedWordPressVersionsList.length - 1
				];
			cliServer = await runCLI({
				...suiteCliArgs,
				command: 'server',
				wp: oldestSupportedVersion,
			});
			await cliServer.playground.writeFile(
				'/wordpress/version.php',
				`<?php
            require_once '/wordpress/wp-load.php';
            echo get_bloginfo("version");
            ?>`
			);
			const versionUrl = new URL('/version.php', cliServer.serverUrl);
			const response = await fetch(versionUrl);
			expect(response.status).toBe(200);
			const text = await response.text();
			expect(text).toContain(oldestSupportedVersion);
		});

		test('should run blueprint', async () => {
			cliServer = await runCLI({
				...suiteCliArgs,
				command: 'server',
				blueprint: {
					steps: [
						{
							step: 'setSiteOptions',
							options: {
								blogname: 'My Blog Name',
							},
						},
					],
				},
			});
			const homeUrl = new URL('/', cliServer.serverUrl);
			const response = await fetch(homeUrl);
			expect(response.status).toBe(200);
			const text = await response.text();
			expect(text).toContain('<title>My Blog Name</title>');
		});

		test('should be able to follow external symlinks in primary and secondary PHP instances', async ({
			skip,
		}) => {
			const testArgs: Partial<RunCLIArgs> =
				version === 2
					? { allow: 'follow-symlinks' }
					: { followSymlinks: true };

			if (version === 2) {
				// @TODO: Fix this feature for Blueprints v2 (or fix the test if it is just a test issue)
				skip();
			}

			// TODO: Make sure test always uses a single worker.
			// TODO: Is there a way to confirm we are testing use of a non-primary PHP instance?
			const tmpDir = await mkdtemp(
				path.join(tmpdir(), 'playground-test-')
			);
			writeFileSync(
				path.join(tmpDir, 'sleep.php'),
				'<?php sleep(1); echo "Slept"; '
			);
			const symlinkPath = path.join(
				import.meta.dirname,
				'mount-examples',
				'symlinking',
				'symlinked-script'
			);

			mkdirSync(path.dirname(symlinkPath), { recursive: true });

			try {
				if (existsSync(symlinkPath)) {
					unlinkSync(symlinkPath);
				}
				// TODO: Confirm that symlink target is outside of current working dir tree.
				symlinkSync(tmpDir, symlinkPath);
				cliServer = await runCLI({
					...suiteCliArgs,
					...testArgs,
					debug: true,
					command: 'server',
					'mount-before-install': [
						{
							hostPath: symlinkPath,
							vfsPath: '/wordpress/wp-content/test-script',
						},
					],
				});
				expect(cliServer.workerThreadCount).toBe(1);
				// Make multiple simultaneous requests to force the use of a secondary PHP instance.
				// TODO: Find way to confirm this. Maybe a custom response header that announces the worker.
				const sleepUrl = new URL(
					'/wp-content/test-script/sleep.php',
					cliServer.serverUrl
				);
				const responses = await Promise.all([
					fetch(sleepUrl),
					fetch(sleepUrl),
					// Test a third request to hopefully test more than one secondary instance.
					fetch(sleepUrl),
				]);
				for (const response of responses) {
					expect(response.status).toBe(200);
					const text = await response.text();
					expect(text).toContain('Slept');
				}
			} finally {
				if (existsSync(symlinkPath)) {
					unlinkSync(symlinkPath);
				}
			}
		});

		// TODO: Testing mounting NODEFS within a NODEFS mount

		if (version === 2) {
			// @TODO: Test modes
			test('should support --mode=create-new-site', async () => {
				const tmpDir = await mkdtemp(
					path.join(tmpdir(), 'playground-test-')
				);
				cliServer = await runCLI({
					...suiteCliArgs,
					command: 'server',
					'experimental-blueprints-v2-runner': true,
					mode: 'create-new-site',
					'mount-before-install': [
						{
							hostPath: tmpDir,
							vfsPath: '/wordpress',
						},
					],
				});
				const homeUrl = new URL('/', cliServer.serverUrl);
				const response = await fetch(homeUrl);
				expect(response.status).toBe(200);
				const text = await response.text();
				expect(text).toContain(
					`<title>${expectedHomePageTitle}</title>`
				);
			});

			test('should support --mode=apply-to-existing-site', async () => {
				const tmpDir = await mkdtemp(
					path.join(tmpdir(), 'playground-test-')
				);

				const port = 3019;

				// Create a new site so we can load it as an existing site later.
				cliServer = await runCLI({
					...suiteCliArgs,
					port,
					command: 'server',
					'experimental-blueprints-v2-runner': true,
					mode: 'create-new-site',
					'mount-before-install': [
						{
							hostPath: tmpDir,
							vfsPath: '/wordpress',
						},
					],
				});
				// Confirm the new site looks intact with its WP installed.
				const homeUrl = new URL('/', cliServer.serverUrl);
				const setupResponse = await fetch(homeUrl);
				expect(setupResponse.status).toBe(200);
				const setupText = await setupResponse.text();
				expect(setupText).toContain(
					`<title>${expectedHomePageTitle}</title>`
				);
				await cliServer.server.close();

				cliServer = await runCLI({
					...suiteCliArgs,
					port,
					command: 'server',
					'experimental-blueprints-v2-runner': true,
					mode: 'apply-to-existing-site',
					'mount-before-install': [
						{
							hostPath: tmpDir,
							vfsPath: '/wordpress',
						},
					],
				});
				const redirectResponse = await fetch(homeUrl);
				expect(redirectResponse.status).toBe(200);
				const redirectText = await redirectResponse.text();
				expect(redirectText).toContain(
					`<title>${expectedHomePageTitle}</title>`
				);
			});

			test('should put WordPress in the document root', async () => {
				const tmpDir = await mkdtemp(
					path.join(tmpdir(), 'playground-test-')
				);

				// Create a new site so we can load it as an existing site later.
				cliServer = await runCLI({
					...suiteCliArgs,
					'site-url': 'http://playground-domain/',
					'db-engine': 'sqlite',
					command: 'server',
					mode: 'create-new-site',
					'mount-before-install': [
						{
							hostPath: tmpDir,
							vfsPath: '/wordpress',
						},
					],
				});
				const wpContentDirPath = path.join(tmpDir, 'wp-content');
				expect(await lstatSync(wpContentDirPath)?.isDirectory()).toBe(
					true
				);
			}, 60000);
		}

		// TODO: Test resolving absolute symlinks within a mounted dir with and without follow-symlinks
		// TODO: Test resolving relative symlinks within a mounted dir with and without follow-symlinks

		describe('auto-mount', () => {
			const getDirectoryChecksum = async (dir: string) => {
				const hash = createHash('sha256');
				for (const file of readdirSync(dir)) {
					hash.update(file);
				}
				return hash.digest('hex');
			};
			const getActiveTheme = async () => {
				const response = await cliServer.playground.run({
					code: `<?php
					require_once '/wordpress/wp-load.php';
					$theme = wp_get_theme();
					echo $theme->get('Name');
				?>`,
				});
				return response.text;
			};
			afterEach(() => {
				if ((process.cwd as unknown as MockInstance).mockRestore) {
					(process.cwd as unknown as MockInstance).mockRestore();
				}
			});

			test(`should run a plugin project using --auto-mount`, async () => {
				vi.spyOn(process, 'cwd').mockReturnValue(
					path.join(import.meta.dirname, 'mount-examples', 'plugin')
				);
				cliServer = await runCLI({
					...suiteCliArgs,
					command: 'server',
					autoMount: '',
				});
				const phpResponse = await cliServer.playground.run({
					code: `<?php
					require_once '/wordpress/wp-load.php';
					require_once '/wordpress/wp-admin/includes/plugin.php';
					echo is_plugin_active('plugin/sample-plugin.php') ? '1' : '0';
				?>`,
				});
				expect(phpResponse.text).toBe('1');

				const homeUrl = new URL('/', cliServer.serverUrl);
				const response = await fetch(homeUrl);
				expect(response.status).toBe(200);
				const text = await response.text();
				expect(text).toContain(
					`<title>${expectedHomePageTitle}</title>`
				);
			});
			test(`should run a theme project using --auto-mount`, async () => {
				vi.spyOn(process, 'cwd').mockReturnValue(
					path.join(import.meta.dirname, 'mount-examples', 'theme')
				);
				cliServer = await runCLI({
					...suiteCliArgs,
					command: 'server',
					autoMount: '',
				});

				expect(await getActiveTheme()).toBe('Yolo Theme');

				const homeUrl = new URL('/', cliServer.serverUrl);
				const response = await fetch(homeUrl);
				expect(response.status).toBe(200);
				const text = await response.text();
				expect(text).toContain(
					`<title>${expectedHomePageTitle}</title>`
				);
			});

			test(`should run a wp-content project using --auto-mount`, async ({
				skip,
			}) => {
				if (version === 2) {
					// @TODO: Fix this feature for Blueprints v2 (or fix the test if it is just a test issue)
					skip();
				}

				vi.spyOn(process, 'cwd').mockReturnValue(
					path.join(
						import.meta.dirname,
						'mount-examples',
						'wp-content'
					)
				);
				cliServer = await runCLI({
					...suiteCliArgs,
					command: 'server',
					autoMount: '',
				});
				const loginUrl = new URL('/wp-login.php', cliServer.serverUrl);
				const response = await fetch(loginUrl);
				expect(response.status).toBe(200);
			});

			test('should run a static html project using --auto-mount', async () => {
				vi.spyOn(process, 'cwd').mockReturnValue(
					path.join(
						import.meta.dirname,
						'mount-examples',
						'static-html'
					)
				);
				cliServer = await runCLI({
					...suiteCliArgs,
					command: 'server',
					autoMount: '',
				});
				const homeUrl = new URL('/', cliServer.serverUrl);
				const response = await fetch(homeUrl);
				expect(response.status).toBe(200);
				const text = await response.text();
				expect(text).toContain('<title>Static HTML</title>');
			});

			test('should run a php project using --auto-mount', async () => {
				vi.spyOn(process, 'cwd').mockReturnValue(
					path.join(import.meta.dirname, 'mount-examples', 'php')
				);
				cliServer = await runCLI({
					...suiteCliArgs,
					command: 'server',
					autoMount: '',
				});
				const homeUrl = new URL('/', cliServer.serverUrl);
				const response = await fetch(homeUrl);
				expect(response.status).toBe(200);
				const text = await response.text();
				expect(text).toContain('Hello world');
			});

			// NOTE: We have had trouble running the full test set on Windows
			// due to Out of Memory errors. Until we debug and fix this,
			// Let's pick this as the single test to run for Blueprints v1 and v2 on Windows
			// because it integrates a good number of Playground CLI features.
			(os.platform() === 'win32' ? test.only : test)(
				'should run a wordpress project using --auto-mount',
				async ({ skip }) => {
					if (version === 2) {
						// @TODO: Fix this test for Blueprints v2.
						// It makes a valid complaint that the unzipped WP is not yet installed.
						skip();
					}

					const tmpDir = await mkdtemp(
						path.join(tmpdir(), 'playground-test-')
					);
					vi.spyOn(process, 'cwd').mockReturnValue(
						path.join(tmpDir, 'wordpress')
					);

					const zip = await fetch('https://wordpress.org/latest.zip');
					const zipPath = path.join(tmpDir, 'wp.zip');
					await writeFile(
						zipPath,
						new Uint8Array(await zip.arrayBuffer())
					);
					await promisify(exec)(`unzip "${zipPath}" -d "${tmpDir}"`);

					const checksum = await getDirectoryChecksum(tmpDir);

					cliServer = await runCLI({
						...suiteCliArgs,
						command: 'server',
						autoMount: '',
					});
					const homeUrl = new URL('/', cliServer.serverUrl);
					const response = await fetch(homeUrl);
					expect(response.status).toBe(200);
					const text = await response.text();
					expect(text).toContain(
						`<title>${expectedHomePageTitle}</title>`
					);

					/**
					 * Playground should not modify the mounted directory.
					 */
					expect(await getDirectoryChecksum(tmpDir)).toBe(checksum);
				}
			);
		});

		describe('verbosity', () => {
			let output: string[];

			function logToVariable(log: Log, arg?: string) {
				output.push(`${log.message}${arg ? arg : ''}`);
			}

			beforeAll(() => {
				// @ts-ignore
				logger.handlers = [logToVariable];
			});

			beforeEach(() => {
				output = [];
			});

			test('should output main logs by default', async ({ skip }) => {
				cliServer = await runCLI({
					...suiteCliArgs,
					command: 'server',
				});

				if (version === 1) {
					expect(output).toEqual(
						expect.arrayContaining([
							'Starting a PHP server...',
							'Setting up WordPress undefined',
							expect.stringMatching(
								/^Resolved WordPress release URL: https:\/\/downloads\.w\.org\/release\/wordpress-\d+\.\d+\.\d+\.zip$/
							),
							'Fetching SQLite integration plugin...',
							'Booting WordPress...',
							'Booted!',
							'Running the Blueprint...',
							'Finished running the blueprint',
							expect.stringMatching(
								/^WordPress is running on http:\/\/127\.0\.0\.1:\d+ with \d+ worker\(s\)$/
							),
						])
					);
				} else {
					// @TODO: Fix this test in CI. It passes locally but not on GitHub.
					skip();
					expect(output).toEqual(
						expect.arrayContaining([
							'Starting a PHP server...',
							'Setting up WordPress undefined',
							'Booted!',
							expect.stringMatching(
								/^WordPress is running on http:\/\/127\.0\.0\.1:\d+$/
							),
						])
					);
				}
			});

			test('should not output debug logs with verbosity option set to normal', async () => {
				cliServer = await runCLI({
					...suiteCliArgs,
					command: 'server',
					verbosity: 'normal',
				});

				const test = 'Debug log';

				logger.debug(test);

				expect(output).not.toContain(test);
			});

			test('should output debug logs bridge with verbosity option set to debug', async () => {
				cliServer = await runCLI({
					...suiteCliArgs,
					command: 'server',
					verbosity: 'debug',
				});

				const test = 'Debug log';

				logger.debug(test);

				expect(output).toContain(test);
			});

			it('should not output logs when verbosity option set to quiet', async () => {
				cliServer = await runCLI({
					...suiteCliArgs,
					command: 'server',
					verbosity: 'quiet',
				});

				expect(output).toEqual([]);
			});
		});
	},
	60_000 * 5
);

describe('other run-cli behaviors', () => {
	let cliServer: RunCLIServer;

	afterEach(async () => {
		if (cliServer) {
			try {
				await cliServer[Symbol.asyncDispose]();
			} catch {
				// Ignore any dispose-related errors
			}
		}
	});

	describe('auto-login', () => {
		test('should clear old auto-login cookie', async () => {
			cliServer = await runCLI({
				command: 'server',
				skipWordPressSetup: true,
				skipSqliteSetup: true,
				blueprint: undefined,
			});
			cliServer.playground.writeFile('/wordpress/dummy.txt', '');
			const dummyUrl = new URL('/dummy.txt', cliServer.serverUrl);
			const res = await new Promise<http.IncomingMessage>(
				(resolve, reject) => {
					// We use http.get() instead of fetch() because fetch() will not
					// expose the contents of redirection responses.
					const req = http.get(
						dummyUrl,
						{
							headers: {
								cookie: 'playground_auto_login_already_happened=1',
							},
						},
						resolve
					);
					req.on('error', reject);
					req.end();
				}
			);
			expect(res.statusCode).toBe(302);
			expect(res.headers['set-cookie']).toContain(
				'playground_auto_login_already_happened=1; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/'
			);
		});
	});

	describe('error handling', () => {
		test('should return 500 when the request handler throws an error', async () => {
			cliServer = await runCLI({
				command: 'server',
				skipWordPressSetup: true,
				blueprint: undefined,
			});

			const throwAnError = (() => {
				throw new Error('test error');
			}) as any;
			cliServer.playground.request = throwAnError;

			const response = await fetch(new URL('/', cliServer.serverUrl));
			expect(response.status).toBe(500);
		});
	});
});
