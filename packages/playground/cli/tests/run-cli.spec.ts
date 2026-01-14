import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { runCLI, internalsKeyForTesting } from '../src/run-cli';
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
	rmSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { MinifiedWordPressVersionsList } from '@wp-playground/wordpress-builds';
import { type Log, logger } from '@php-wasm/logger';

const blueprintVersions = [
	{
		version: 1,
		expectedHomePageTitle: 'My WordPress Website',
		suiteCliArgs: {
			'experimental-trace': false,
		},
	},
	{
		version: 2,
		suiteCliArgs: {
			'experimental-blueprints-v2-runner': true,
			'experimental-trace': false,
		},
		expectedHomePageTitle: 'WordPress Site',
	},
];

describe.each(blueprintVersions)(
	'run-cli with Blueprints v$version',
	({ version, suiteCliArgs, expectedHomePageTitle }) => {
		// TODO: Find out why Blueprints v2 tests fail on Windows and fix them.
		const isBlueprintsV2OnWindows =
			os.platform() === 'win32' && version === 2;

		test.skipIf(isBlueprintsV2OnWindows)(
			'should set PHP version',
			async () => {
				await using cliServer = await runCLI({
					...suiteCliArgs,
					command: 'server',
					php: '8.0',
					// Let's skip the cost of WordPress setup because it is
					// irrelevant for this test.
					wordpressInstallMode: 'do-not-attempt-installing',
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
			}
		);

		test.skipIf(isBlueprintsV2OnWindows)(
			'should have Intl extension enabled by default',
			async () => {
				await using cliServer = await runCLI({
					...suiteCliArgs,
					command: 'server',
					php: '8.0',
					// Let's skip the cost of WordPress setup because it is
					// irrelevant for this test.
					wordpressInstallMode: 'do-not-attempt-installing',
					skipSqliteSetup: true,
					blueprint: undefined,
				});

				await cliServer.playground.writeFile(
					'/wordpress/intl.php',
					`<?php
					var_dump(extension_loaded('intl'));
					var_dump(class_exists('Collator'));`
				);
				const versionUrl = new URL('/intl.php', cliServer.serverUrl);
				const response = await fetch(versionUrl);
				expect(response.status).toBe(200);
				const text = await response.text();
				expect(text).toContain('bool(true)\nbool(true)\n');
			}
		);

		test.skipIf(isBlueprintsV2OnWindows)(
			'should use custom site-url when provided',
			async () => {
				const customSiteUrl = 'https://example.com';
				await using cliServer = await runCLI({
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
			}
		);

		test.skipIf(isBlueprintsV2OnWindows)(
			'should use default site-url when not provided',
			async () => {
				await using cliServer = await runCLI({
					...suiteCliArgs,
					port: 9500,
					command: 'server',
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
			}
		);

		test.skipIf(isBlueprintsV2OnWindows)(
			'should set WordPress version',
			async () => {
				const oldestSupportedVersion =
					MinifiedWordPressVersionsList[
						MinifiedWordPressVersionsList.length - 1
					];
				await using cliServer = await runCLI({
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
			}
		);

		test.skipIf(isBlueprintsV2OnWindows)(
			'should run blueprint',
			async () => {
				await using cliServer = await runCLI({
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
			}
		);

		test.skipIf(isBlueprintsV2OnWindows)(
			'should be able to follow external symlinks in primary and secondary PHP instances',
			async ({ skip }) => {
				if (os.platform() === 'win32') {
					// @TODO: Find out why this test fails on Windows and fix it.
					// Issue here: https://github.com/WordPress/wordpress-playground/issues/2936
					skip();
				}
				if (version === 2) {
					// @TODO: Fix this feature for Blueprints v2 (or fix the test if it is just a test issue)
					skip();
				}

				const testArgs: Partial<RunCLIArgs> =
					version === 2
						? { allow: 'follow-symlinks' }
						: { followSymlinks: true };

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
					symlinkSync(
						tmpDir,
						symlinkPath,
						// Use a junction on Windows to avoid elevated permissions requirement.
						os.platform() === 'win32' ? 'junction' : null
					);
					await using cliServer = await runCLI({
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
					expect(
						cliServer[internalsKeyForTesting].workerThreadCount
					).toBe(1);
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
			}
		);

		// TODO: Testing mounting NODEFS within a NODEFS mount

		if (version === 2) {
			// @TODO: Test modes
			test.skipIf(isBlueprintsV2OnWindows)(
				'should support --mode=create-new-site',
				async () => {
					const tmpDir = await mkdtemp(
						path.join(tmpdir(), 'playground-test-')
					);
					await using cliServer = await runCLI({
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
				}
			);

			test.skipIf(isBlueprintsV2OnWindows)(
				'should support --mode=apply-to-existing-site',
				async () => {
					const tmpDir = await mkdtemp(
						path.join(tmpdir(), 'playground-test-')
					);

					const port = 3019;
					let homeUrl: URL;

					{
						// Create a new site so we can load it as an existing site later.
						await using cliServer = await runCLI({
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
						homeUrl = new URL('/', cliServer.serverUrl);
						const setupResponse = await fetch(homeUrl);
						expect(setupResponse.status).toBe(200);
						const setupText = await setupResponse.text();
						expect(setupText).toContain(
							`<title>${expectedHomePageTitle}</title>`
						);
					}

					// eslint-disable-next-line
					await using cliServer = await runCLI({
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
				}
			);

			test.skipIf(isBlueprintsV2OnWindows)(
				'should put WordPress in the document root',
				async () => {
					const tmpDir = await mkdtemp(
						path.join(tmpdir(), 'playground-test-')
					);

					// Create a new site so we can load it as an existing site later.
					// eslint-disable-next-line
					await using cliServer = await runCLI({
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
					expect(lstatSync(wpContentDirPath)?.isDirectory()).toBe(
						true
					);
				},
				60000
			);
		}

		// TODO: Test resolving absolute symlinks within a mounted dir with and without follow-symlinks

		describe('auto-mount', () => {
			const getDirectoryChecksum = async (dir: string) => {
				const hash = createHash('sha256');
				for (const file of readdirSync(dir)) {
					hash.update(file);
				}
				return hash.digest('hex');
			};
			const getActiveTheme = async (cliServer: RunCLIServer) => {
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

			test.skipIf(isBlueprintsV2OnWindows)(
				`should run a plugin project using --auto-mount`,
				async () => {
					vi.spyOn(process, 'cwd').mockReturnValue(
						path.join(
							import.meta.dirname,
							'mount-examples',
							'plugin'
						)
					);
					await using cliServer = await runCLI({
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
				}
			);
			test.skipIf(isBlueprintsV2OnWindows)(
				`should run a theme project using --auto-mount`,
				async () => {
					vi.spyOn(process, 'cwd').mockReturnValue(
						path.join(
							import.meta.dirname,
							'mount-examples',
							'theme'
						)
					);
					await using cliServer = await runCLI({
						...suiteCliArgs,
						command: 'server',
						autoMount: '',
					});

					expect(await getActiveTheme(cliServer)).toBe('Yolo Theme');

					const homeUrl = new URL('/', cliServer.serverUrl);
					const response = await fetch(homeUrl);
					expect(response.status).toBe(200);
					const text = await response.text();
					expect(text).toContain(
						`<title>${expectedHomePageTitle}</title>`
					);
				}
			);

			test.skipIf(isBlueprintsV2OnWindows)(
				`should run a wp-content project using --auto-mount`,
				async ({ skip }) => {
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
					await using cliServer = await runCLI({
						...suiteCliArgs,
						command: 'server',
						autoMount: '',
					});
					const loginUrl = new URL(
						'/wp-login.php',
						cliServer.serverUrl
					);
					const response = await fetch(loginUrl);
					expect(response.status).toBe(200);
				}
			);

			test.skipIf(isBlueprintsV2OnWindows)(
				'should run a php project using --auto-mount',
				async () => {
					vi.spyOn(process, 'cwd').mockReturnValue(
						path.join(import.meta.dirname, 'mount-examples', 'php')
					);
					await using cliServer = await runCLI({
						...suiteCliArgs,
						command: 'server',
						autoMount: '',
					});
					const homeUrl = new URL('/', cliServer.serverUrl);
					const response = await fetch(homeUrl);
					expect(response.status).toBe(200);
					const text = await response.text();
					expect(text).toContain('Hello world');
				}
			);

			test.skipIf(isBlueprintsV2OnWindows)(
				'should run a wordpress project using --auto-mount',
				async ({ skip }) => {
					if (os.platform() === 'win32') {
						// @TODO: Find out why this test fails on Windows and fix it.
						skip();
					}
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

					await using cliServer = await runCLI({
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
			// Track cliServer at describe level for cleanup even if tests timeout
			let cliServer: RunCLIServer | undefined;

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

			afterEach(async () => {
				if (cliServer) {
					await cliServer[Symbol.asyncDispose]();
					cliServer = undefined;
				}
			});

			test.skipIf(isBlueprintsV2OnWindows)(
				'should output main logs by default',
				async ({ skip }) => {
					// Skip v2 early to avoid starting expensive WordPress download
					// @TODO: Fix this test for v2 in CI. It passes locally but not on GitHub.
					if (version === 2) {
						skip();
						return;
					}

					cliServer = await runCLI({
						...suiteCliArgs,
						command: 'server',
					});

					expect(output).toEqual(
						expect.arrayContaining([
							'Starting a PHP server...',
							'Starting up workers',
							expect.stringMatching(
								/^Resolved WordPress release URL: https:\/\/downloads\.w(ordpress)?\.org\/release\/wordpress-\d+\.\d+(?:\.\d+|-RC\d+|-beta\d+)?\.zip$/
							),
							'Fetching SQLite integration plugin...',
							'Booting WordPress...',
							'Booted!',
							'Running the Blueprint...',
							'Finished running the blueprint',
							'Preparing workers...',
							expect.stringMatching(
								/^WordPress is running on http:\/\/127\.0\.0\.1:\d+ with \d+ worker\(s\)$/
							),
						])
					);
				}
			);

			// Skip WordPress setup for verbosity tests - they only check logging behavior.
			// For v1, use wordpressInstallMode. For v2, explicitly set mode.
			const skipWordPressSetup =
				version === 2
					? { mode: 'mount-only' as const }
					: {
							wordpressInstallMode:
								'do-not-attempt-installing' as const,
							skipSqliteSetup: true,
							blueprint: undefined,
						};

			test('should not output debug logs with verbosity option set to normal', async () => {
				cliServer = await runCLI({
					...suiteCliArgs,
					...skipWordPressSetup,
					command: 'server',
					verbosity: 'normal',
				});

				const test = 'Debug log';

				logger.debug(test);

				expect(output).not.toContain(test);
			});

			test.skipIf(isBlueprintsV2OnWindows)(
				'should output debug logs bridge with verbosity option set to debug',
				async () => {
					cliServer = await runCLI({
						...suiteCliArgs,
						...skipWordPressSetup,
						command: 'server',
						verbosity: 'debug',
					});

					const test = 'Debug log';

					logger.debug(test);

					expect(output).toContain(test);
				}
			);

			test.skipIf(isBlueprintsV2OnWindows)(
				'should not output logs when verbosity option set to quiet',
				async () => {
					cliServer = await runCLI({
						...suiteCliArgs,
						...skipWordPressSetup,
						command: 'server',
						verbosity: 'quiet',
					});

					expect(output).toEqual([]);
				}
			);
		});
	},
	60_000 * 5
);

describe('start command', () => {
	test('should work with default options', async () => {
		// The start command internally runs as 'server' with auto-mount enabled
		await using cliServer = await runCLI({
			command: 'server',
			// Simulating what 'start' command does:
			// - enables auto-mount with current directory
			// - enables login by default
			// - enables intl
			login: true,
			intl: true,
			// Skip WordPress setup for speed since we're just testing the command structure
			wordpressInstallMode: 'do-not-attempt-installing',
			skipSqliteSetup: true,
			blueprint: undefined,
		});

		// Verify server started successfully
		expect(cliServer.serverUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
	});

	test('should persist site in home directory', async () => {
		const tmpDir = await mkdtemp(path.join(tmpdir(), 'playground-test-'));
		const homeDir = os.homedir();
		const currentSiteHash = createHash('sha256')
			.update(tmpDir)
			.digest('hex');
		const expectedSitePath = path.join(
			homeDir,
			'.wordpress-playground/sites',
			currentSiteHash
		);

		// Clean up if the site directory already exists
		if (existsSync(expectedSitePath)) {
			rmSync(expectedSitePath, { recursive: true, force: true });
		}

		vi.spyOn(process, 'cwd').mockReturnValue(tmpDir);

		await using cliServer = await runCLI({
			command: 'start',
			skipBrowser: true,
		});

		// Verify server started successfully
		expect(cliServer.serverUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);

		// Verify the site directory was created
		expect(existsSync(expectedSitePath)).toBe(true);
		expect(lstatSync(expectedSitePath).isDirectory()).toBe(true);

		// Verify WordPress files exist in the persisted directory
		const wpContentPath = path.join(expectedSitePath, 'wp-content');
		expect(existsSync(wpContentPath)).toBe(true);
		expect(lstatSync(wpContentPath).isDirectory()).toBe(true);

		// Clean up
		if ((process.cwd as unknown as MockInstance).mockRestore) {
			(process.cwd as unknown as MockInstance).mockRestore();
		}
	}, 120000);

	test('should reuse existing persisted site on subsequent runs', async () => {
		const tmpDir = await mkdtemp(path.join(tmpdir(), 'playground-test-'));
		const homeDir = os.homedir();
		const currentSiteHash = createHash('sha256')
			.update(tmpDir)
			.digest('hex');
		const expectedSitePath = path.join(
			homeDir,
			'.wordpress-playground/sites',
			currentSiteHash
		);

		// Clean up if the site directory already exists
		if (existsSync(expectedSitePath)) {
			rmSync(expectedSitePath, { recursive: true, force: true });
		}

		vi.spyOn(process, 'cwd').mockReturnValue(tmpDir);

		// First run - create the site
		{
			await using cliServer = await runCLI({
				command: 'start',
				skipBrowser: true,
			});

			// Add a marker file to verify the site is reused
			await cliServer.playground.writeFile(
				'/wordpress/marker.txt',
				'site-marker'
			);
		}

		// Second run - should reuse the same site
		{
			await using cliServer = await runCLI({
				command: 'start',
				skipBrowser: true,
			});

			// Verify the marker file exists
			const markerExists = await cliServer.playground.fileExists(
				'/wordpress/marker.txt'
			);
			expect(markerExists).toBe(true);

			if (markerExists) {
				const markerContent = await cliServer.playground.readFileAsText(
					'/wordpress/marker.txt'
				);
				expect(markerContent).toBe('site-marker');
			}
		}

		// Clean up
		if ((process.cwd as unknown as MockInstance).mockRestore) {
			(process.cwd as unknown as MockInstance).mockRestore();
		}
	}, 180000);

	test('should reset site when --reset is provided', async () => {
		const tmpDir = await mkdtemp(path.join(tmpdir(), 'playground-test-'));
		const homeDir = os.homedir();
		const currentSiteHash = createHash('sha256')
			.update(tmpDir)
			.digest('hex');
		const expectedSitePath = path.join(
			homeDir,
			'.wordpress-playground/sites',
			currentSiteHash
		);

		// Clean up if the site directory already exists
		if (existsSync(expectedSitePath)) {
			rmSync(expectedSitePath, { recursive: true, force: true });
		}

		vi.spyOn(process, 'cwd').mockReturnValue(tmpDir);

		// First run - create the site with a marker
		{
			await using cliServer = await runCLI({
				command: 'start',
				skipBrowser: true,
			});

			// Add a marker file
			await cliServer.playground.writeFile(
				'/wordpress/marker.txt',
				'should-be-deleted'
			);
		}

		// Second run with --reset - should delete the old site
		{
			await using cliServer = await runCLI({
				command: 'start',
				skipBrowser: true,
				reset: true,
			});

			// Verify the marker file does not exist
			const markerExists = await cliServer.playground.fileExists(
				'/wordpress/marker.txt'
			);
			expect(markerExists).toBe(false);
		}

		// Clean up
		if ((process.cwd as unknown as MockInstance).mockRestore) {
			(process.cwd as unknown as MockInstance).mockRestore();
		}
	}, 180000);

	test('should not persist when using explicit mount for /wordpress', async () => {
		const tmpDir = await mkdtemp(path.join(tmpdir(), 'playground-test-'));
		const wordpressDir = path.join(tmpDir, 'wordpress-custom');
		mkdirSync(wordpressDir, { recursive: true });

		// When we explicitly mount /wordpress, the site should be stored there,
		// not in ~/.wordpress-playground/sites/
		await using cliServer = await runCLI({
			command: 'start',
			skipBrowser: true,
			'mount-before-install': [
				{
					hostPath: wordpressDir,
					vfsPath: '/wordpress',
				},
			],
		});

		// Verify server started successfully
		expect(cliServer.serverUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);

		// Verify WordPress files are in the explicit mount location
		const wpContentPath = path.join(wordpressDir, 'wp-content');
		expect(existsSync(wpContentPath)).toBe(true);
		expect(lstatSync(wpContentPath).isDirectory()).toBe(true);
	}, 120000);
});

describe('other run-cli behaviors', () => {
	describe('auto-login', () => {
		test('should clear old auto-login cookie', async () => {
			await using cliServer = await runCLI({
				command: 'server',
				wordpressInstallMode: 'do-not-attempt-installing',
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
			await using cliServer = await runCLI({
				command: 'server',
				wordpressInstallMode: 'do-not-attempt-installing',
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
