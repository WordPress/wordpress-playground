import path from 'node:path';
import { runCLI } from '../src/run-cli';
import type { RunCLIServer } from '../src/run-cli';
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
			});
			await cliServer.playground.writeFile(
				'/wordpress/version.php',
				'<?php echo phpversion(); ?>'
			);
			const response = await cliServer.playground.request({
				url: '/version.php',
				method: 'GET',
			});
			expect(response.httpStatusCode).toBe(200);
			expect(response.text).toContain('8.0');
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
			const response = await cliServer.playground.request({
				url: '/site-url.php',
				method: 'GET',
			});
			expect(response.httpStatusCode).toBe(200);
			expect(response.text).toContain(customSiteUrl);
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
			const response = await cliServer.playground.request({
				url: '/site-url.php',
				method: 'GET',
			});
			expect(response.httpStatusCode).toBe(200);
			expect(response.text).toContain('http://127.0.0.1:9500');
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
			const response = await cliServer.playground.request({
				url: '/version.php',
				method: 'GET',
			});
			expect(response.httpStatusCode).toBe(200);
			expect(response.text).toContain(oldestSupportedVersion);
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
			const response = await cliServer.playground.request({
				url: '/',
				method: 'GET',
			});
			expect(response.httpStatusCode).toBe(200);
			expect(response.text).toContain('<title>My Blog Name</title>');
		});

		test('should be able to follow external symlinks in primary and secondary PHP instances', async ({
			skip,
		}) => {
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
					debug: true,
					command: 'server',
					followSymlinks: true,
					'mount-before-install': [
						{
							hostPath: symlinkPath,
							vfsPath: '/wordpress/wp-content/test-script',
						},
					],
				});
				expect(cliServer.workerThreadCount).toBe(1);
				// Make multiple simultaneous requests to force the use of a secondary PHP instance.
				// TODO: Find way to confirm this.
				const responses = await Promise.all([
					cliServer.playground.request({
						url: '/wp-content/test-script/sleep.php',
						method: 'GET',
					}),
					cliServer.playground.request({
						url: '/wp-content/test-script/sleep.php',
						method: 'GET',
					}),
					// Test a third request to hopefully test more than one secondary instance.
					cliServer.playground.request({
						url: '/wp-content/test-script/sleep.php',
						method: 'GET',
					}),
				]);
				responses.forEach((response) => {
					expect(response.httpStatusCode).toBe(200);
					expect(response.text).toContain('Slept');
				});
			} finally {
				if (existsSync(symlinkPath)) {
					unlinkSync(symlinkPath);
				}
			}
		});

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
				const response = await cliServer.playground.request({
					url: '/',
					method: 'GET',
				});
				expect(response.httpStatusCode).toBe(200);
				expect(response.text).toContain(
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
				const setupResponse = await cliServer.playground.request({
					url: '/',
					method: 'GET',
				});
				expect(setupResponse.httpStatusCode).toBe(200);
				expect(setupResponse.text).toContain(
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
				const redirectResponse = await cliServer.playground.request({
					url: '/',
					method: 'GET',
				});
				expect(redirectResponse.httpStatusCode).toBe(200);
				expect(redirectResponse.text).toContain(
					`<title>${expectedHomePageTitle}</title>`
				);
			});
		}

		// @TODO: Also test with Blueprints v2.
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

				const response = await cliServer.playground.request({
					url: '/',
					method: 'GET',
				});
				expect(response.httpStatusCode).toBe(200);
				expect(response.text).toContain(
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

				const response = await cliServer.playground.request({
					url: '/',
					method: 'GET',
				});
				expect(response.httpStatusCode).toBe(200);
				expect(response.text).toContain(
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
				const response = await cliServer.playground.request({
					url: '/wp-login.php',
					method: 'GET',
				});
				expect(response.httpStatusCode).toBe(200);
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
				const response = await cliServer.playground.request({
					url: '/',
					method: 'GET',
				});
				expect(response.httpStatusCode).toBe(200);
				expect(response.text).toContain('<title>Static HTML</title>');
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
				const response = await cliServer.playground.request({
					url: '/',
					method: 'GET',
				});
				expect(response.httpStatusCode).toBe(200);
				expect(response.text).toContain('Hello world');
			});

			test('should run a wordpress project using --auto-mount', async ({
				skip,
			}) => {
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
				const response = await cliServer.playground.request({
					url: '/',
					method: 'GET',
				});
				expect(response.httpStatusCode).toBe(200);
				expect(response.text).toContain(
					`<title>${expectedHomePageTitle}</title>`
				);

				/**
				 * Playground should not modify the mounted directory.
				 */
				expect(await getDirectoryChecksum(tmpDir)).toBe(checksum);
			});
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
								/^WordPress is running on http:\/\/127\.0\.0\.1:\d+$/
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
	60000
);
