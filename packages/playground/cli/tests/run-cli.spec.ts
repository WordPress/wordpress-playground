import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import {
	runCLI,
	parseOptionsAndRunCLI,
	internalsKeyForTesting,
} from '../src/run-cli';
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
import { PHPMYADMIN_INSTALL_PATH } from '@wp-playground/tools';
import { type Log, logger } from '@php-wasm/logger';

const blueprintVersions = [
	{
		version: 1,
		expectedHomePageTitle: 'My WordPress Website',
		suiteCliArgs: {
			'experimental-trace': false,
		},
	},
];

describe.each(blueprintVersions)(
	'run-cli with Blueprints v$version',
	({ version, suiteCliArgs, expectedHomePageTitle }) => {
		test('should set PHP version', async () => {
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
		});

		test('should have Intl extension enabled by default', async () => {
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
		});

		test('should define constants via --define flags', async () => {
			await using cliServer = await runCLI({
				...suiteCliArgs,
				command: 'server',
				php: '8.0',
				wordpressInstallMode: 'do-not-attempt-installing',
				skipSqliteSetup: true,
				blueprint: undefined,
				define: {
					MY_STRING_CONSTANT: 'test_value',
				},
				'define-bool': {
					MY_BOOL_CONSTANT: true,
					MY_FALSE_CONSTANT: false,
				},
				'define-number': {
					MY_NUMBER_CONSTANT: 42,
				},
			});

			await cliServer.playground.writeFile(
				'/wordpress/constants.php',
				`<?php
					echo "STRING: " . MY_STRING_CONSTANT . "\\n";
					echo "NUMBER: " . MY_NUMBER_CONSTANT . "\\n";
					echo "BOOL: " . (MY_BOOL_CONSTANT ? 'true' : 'false') . "\\n";
					echo "FALSE: " . (MY_FALSE_CONSTANT ? 'true' : 'false') . "\\n";
					`
			);
			const constantsUrl = new URL('/constants.php', cliServer.serverUrl);
			const response = await fetch(constantsUrl);
			expect(response.status).toBe(200);
			const text = await response.text();
			expect(text).toContain('STRING: test_value');
			expect(text).toContain('NUMBER: 42');
			expect(text).toContain('BOOL: true');
			expect(text).toContain('FALSE: false');
		});

		test('should use custom site-url when provided', async () => {
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
		});

		test('should use default site-url when not provided', async () => {
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
		});

		test('should set WordPress version', async () => {
			const { MinifiedWordPressVersionsList } =
				await import('@wp-playground/wordpress-builds');
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
		});

		test('should run blueprint', async () => {
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
		});

		test('should be able to follow external symlinks in primary and secondary PHP instances', async ({
			skip,
		}) => {
			if (os.platform() === 'win32') {
				// @TODO: Find out why this test fails on Windows and fix it.
				// Issue here: https://github.com/WordPress/wordpress-playground/issues/2936
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

		// This is a sort of smoke test to confirm Blueprint steps run.
		// TODO: Consider testing all resource types here.
		test('should run blueprint including git:resources', async () => {
			await using cliServer = await runCLI({
				...suiteCliArgs,
				command: 'server',
				blueprint: {
					steps: [
						{
							step: 'installPlugin',
							options: {
								activate: true,
								targetFolderName: 'blocky-formats',
							},
							pluginData: {
								resource: 'git:directory',
								url: 'https://github.com/dmsnell/blocky-formats.git',
								ref: 'HEAD',
								path: '/',
							},
						},
					],
				},
			});
			const response = await cliServer.playground.request({
				method: 'GET',
				url: '/',
			});
			expect(response.httpStatusCode).toEqual(200);
			expect(response.text).toContain('My WordPress Website');
		});

		// TODO: Testing mounting NODEFS within a NODEFS mount

		if (version === 2) {
			// @TODO: Test modes
			test('should support --mode=create-new-site', async () => {
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
			});

			test('should support --mode=apply-to-existing-site', async () => {
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
			});

			test('should put WordPress in the document root', async () => {
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
				expect(lstatSync(wpContentDirPath)?.isDirectory()).toBe(true);
			}, 60000);
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

			test(`should run a plugin project using --auto-mount`, async () => {
				vi.spyOn(process, 'cwd').mockReturnValue(
					path.join(import.meta.dirname, 'mount-examples', 'plugin')
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
			});
			test(`should run a theme project using --auto-mount`, async () => {
				vi.spyOn(process, 'cwd').mockReturnValue(
					path.join(import.meta.dirname, 'mount-examples', 'theme')
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
			});

			test(`should run a wp-content project using --auto-mount`, async () => {
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
				const loginUrl = new URL('/wp-login.php', cliServer.serverUrl);
				const response = await fetch(loginUrl);
				expect(response.status).toBe(200);
			});

			test('should run a php project using --auto-mount', async () => {
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
			});

			test('should run a wordpress project using --auto-mount', async ({
				skip,
			}) => {
				if (os.platform() === 'win32') {
					// @TODO: Find out why this test fails on Windows and fix it.
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
			});
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

			test('should start server successfully with default verbosity', async () => {
				cliServer = await runCLI({
					...suiteCliArgs,
					command: 'server',
				});

				// With the new CLIOutput system, most user-facing messages
				// go to stdout via CLIOutput rather than through the logger.
				// Logger is now primarily used for debug information.
				// Just verify the server started successfully.
				expect(cliServer).toBeDefined();
				expect(cliServer.serverUrl).toMatch(
					/^http:\/\/127\.0\.0\.1:\d+$/
				);
			});

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

			test('should output debug logs bridge with verbosity option set to debug', async () => {
				cliServer = await runCLI({
					...suiteCliArgs,
					...skipWordPressSetup,
					command: 'server',
					verbosity: 'debug',
				});

				const test = 'Debug log';

				logger.debug(test);

				expect(output).toContain(test);
			});

			test('should not output logs when verbosity option set to quiet', async () => {
				cliServer = await runCLI({
					...suiteCliArgs,
					...skipWordPressSetup,
					command: 'server',
					verbosity: 'quiet',
				});

				expect(output).toEqual([]);
			});
		});

		describe('pathAliases', () => {
			// Skip WordPress setup for pathAliases tests - they only need
			// the server running, not a full WordPress installation.
			const skipWordPressSetupForPathAliases =
				version === 2
					? { mode: 'mount-only' as const }
					: {
							wordpressInstallMode:
								'do-not-attempt-installing' as const,
							skipSqliteSetup: true,
							blueprint: undefined,
						};

			test('should serve static and PHP files from a path alias', async () => {
				await using cliServer = await runCLI({
					...suiteCliArgs,
					...skipWordPressSetupForPathAliases,
					command: 'server',
					pathAliases: [
						{
							urlPrefix: '/my-alias',
							fsPath: '/tools/my-alias',
						},
					],
				});

				// Create the aliased directory and populate it with test files
				await cliServer.playground.mkdir('/tools/my-alias');
				await cliServer.playground.writeFile(
					'/tools/my-alias/hello.txt',
					'Hello from alias!'
				);
				await cliServer.playground.writeFile(
					'/tools/my-alias/info.php',
					'<?php echo "PHP works in alias"; ?>'
				);

				// Verify static file is served from the alias
				const staticUrl = new URL(
					'/my-alias/hello.txt',
					cliServer.serverUrl
				);
				const staticResponse = await fetch(staticUrl);
				expect(staticResponse.status).toBe(200);
				expect(await staticResponse.text()).toContain(
					'Hello from alias!'
				);

				// Verify PHP file is executed and served from the alias
				const phpUrl = new URL(
					'/my-alias/info.php',
					cliServer.serverUrl
				);
				const phpResponse = await fetch(phpUrl);
				expect(phpResponse.status).toBe(200);
				expect(await phpResponse.text()).toContain(
					'PHP works in alias'
				);
			});
		});

		describe('phpMyAdmin', () => {
			test('should install phpMyAdmin when --phpmyadmin flag is set', async () => {
				await using cliServer = await runCLI({
					...suiteCliArgs,
					command: 'server',
					phpmyadmin: '/phpmyadmin',
				});

				// Verify phpMyAdmin directory was created
				const phpMyAdminExists = await cliServer.playground.isDir(
					PHPMYADMIN_INSTALL_PATH
				);
				expect(phpMyAdminExists).toBe(true);

				// Verify the custom DbiMysqli.php driver was installed
				const dbiMysqliExists = await cliServer.playground.fileExists(
					`${PHPMYADMIN_INSTALL_PATH}/libraries/classes/Dbal/DbiMysqli.php`
				);
				expect(dbiMysqliExists).toBe(true);

				// Verify config.inc.php was installed
				const configExists = await cliServer.playground.fileExists(
					`${PHPMYADMIN_INSTALL_PATH}/config.inc.php`
				);
				expect(configExists).toBe(true);

				// Verify phpMyAdmin is accessible via rewrite rule
				const phpMyAdminUrl = new URL(
					'/phpmyadmin/index.php',
					cliServer.serverUrl
				);
				const response = await fetch(phpMyAdminUrl);
				expect(response.status).toBe(200);
			}, 120000);

			test('should not install phpMyAdmin when flag is not set', async () => {
				await using cliServer = await runCLI({
					...suiteCliArgs,
					command: 'server',
				});

				// Verify phpMyAdmin directory was NOT created
				const phpMyAdminExists = await cliServer.playground.isDir(
					PHPMYADMIN_INSTALL_PATH
				);
				expect(phpMyAdminExists).toBe(false);
			}, 120000);

			test('should default to /phpmyadmin path when phpmyadmin is set to true', async () => {
				await using cliServer = await runCLI({
					...suiteCliArgs,
					command: 'server',
					phpmyadmin: true,
				});

				// When phpmyadmin is true (boolean), it should default to /phpmyadmin
				const phpMyAdminUrl = new URL(
					'/phpmyadmin/index.php',
					cliServer.serverUrl
				);
				const response = await fetch(phpMyAdminUrl);
				expect(response.status).toBe(200);
			}, 120000);

			test('should install phpMyAdmin at a custom path', async () => {
				await using cliServer = await runCLI({
					...suiteCliArgs,
					command: 'server',
					phpmyadmin: '/db-admin',
				});

				// Verify phpMyAdmin is accessible at the custom path
				const phpMyAdminUrl = new URL(
					'/db-admin/index.php',
					cliServer.serverUrl
				);
				const response = await fetch(phpMyAdminUrl);
				expect(response.status).toBe(200);
			}, 120000);
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

	describe('phpMyAdmin CLI argument validation', () => {
		test('should reject --phpmyadmin with --skip-sqlite-setup', async () => {
			// Suppress console.error during this test since yargs outputs to stderr
			const consoleSpy = vi
				.spyOn(console, 'error')
				.mockImplementation(() => {});
			const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
				throw new Error('process.exit called');
			});

			try {
				await expect(
					parseOptionsAndRunCLI([
						'server',
						'--phpmyadmin',
						'--skip-sqlite-setup',
					])
				).rejects.toThrow();
			} finally {
				consoleSpy.mockRestore();
				exitSpy.mockRestore();
			}
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
			cliServer.playground.requestStreamed = throwAnError;

			const response = await fetch(new URL('/', cliServer.serverUrl));
			expect(response.status).toBe(500);
		});
	});

	describe('streaming responses', () => {
		test('should handle streaming responses correctly', async () => {
			await using cliServer = await runCLI({
				command: 'server',
				wordpressInstallMode: 'do-not-attempt-installing',
				skipSqliteSetup: true,
				blueprint: undefined,
			});

			// Custom headers are returned in HTTP response
			await cliServer.playground.writeFile(
				'/wordpress/custom-headers.php',
				`<?php
					header('X-Custom-Header: test-value');
					header('X-Another: hello');
					echo 'done';
					`
			);
			const headersResponse = await fetch(
				new URL('/custom-headers.php', cliServer.serverUrl)
			);
			expect(headersResponse.status).toBe(200);
			expect(headersResponse.headers.get('x-custom-header')).toBe(
				'test-value'
			);
			expect(headersResponse.headers.get('x-another')).toBe('hello');
			expect(await headersResponse.text()).toBe('done');

			// Status codes are propagated from PHP
			await cliServer.playground.writeFile(
				'/wordpress/not-found.php',
				`<?php
					http_response_code(404);
					echo 'Not Found';
					`
			);
			const notFoundResponse = await fetch(
				new URL('/not-found.php', cliServer.serverUrl)
			);
			expect(notFoundResponse.status).toBe(404);

			// Large streaming output is returned completely
			await cliServer.playground.writeFile(
				'/wordpress/large-output.php',
				`<?php
					for ($i = 0; $i < 100; $i++) {
						echo "Line $i\\n";
					}
					`
			);
			const largeResponse = await fetch(
				new URL('/large-output.php', cliServer.serverUrl)
			);
			expect(largeResponse.status).toBe(200);
			const largeText = await largeResponse.text();
			expect(largeText).toContain('Line 0');
			expect(largeText).toContain('Line 99');
			expect(largeText.trim().split('\n')).toHaveLength(100);

			// PHP fatal error does not crash the server
			await cliServer.playground.writeFile(
				'/wordpress/fatal.php',
				`<?php
					undefined_function_that_does_not_exist();
					`
			);
			const fatalResponse = await fetch(
				new URL('/fatal.php', cliServer.serverUrl)
			);
			// In streaming mode, headers are sent before exit code
			// is known, so the status may be 200. The key assertion
			// is that the server does not crash.
			expect(fatalResponse.status).toBeLessThan(600);
		}, 60_000);

		test('should handle client disconnect during streaming', async () => {
			await using cliServer = await runCLI({
				command: 'server',
				wordpressInstallMode: 'do-not-attempt-installing',
				skipSqliteSetup: true,
				blueprint: undefined,
			});

			// PHP script that produces a large stream (enough to
			// read a chunk, but finite so the worker is freed)
			await cliServer.playground.writeFile(
				'/wordpress/large-stream.php',
				`<?php
					for ($i = 0; $i < 1000; $i++) {
						echo str_repeat("x", 1024) . "\\n";
						flush();
					}
				`
			);

			const controller = new AbortController();
			const response = await fetch(
				new URL('/large-stream.php', cliServer.serverUrl),
				{ signal: controller.signal }
			);

			// Read at least one chunk to confirm streaming started
			const reader = response.body!.getReader();
			const { done } = await reader.read();
			expect(done).toBe(false);

			// Abort mid-stream
			reader.cancel();
			controller.abort();

			// Wait for the PHP script to finish and free the worker
			await new Promise((r) => setTimeout(r, 2000));

			// Server should still be responsive
			await cliServer.playground.writeFile(
				'/wordpress/health.php',
				`<?php echo 'ok';`
			);
			const healthCheck = await fetch(
				new URL('/health.php', cliServer.serverUrl)
			);
			expect(healthCheck.status).toBe(200);
		}, 60_000);
	});

	describe('internal cookie store', () => {
		test('should persist cookies across requests when enabled', async () => {
			await using cliServer = await runCLI({
				command: 'server',
				internalCookieStore: true,
				wordpressInstallMode: 'do-not-attempt-installing',
				skipSqliteSetup: true,
				blueprint: undefined,
			});

			// Write a PHP script that sets a cookie
			await cliServer.playground.writeFile(
				'/wordpress/set-cookie.php',
				'<?php setcookie("test_cookie", "hello", 0, "/"); echo "cookie set"; ?>'
			);
			// Write a PHP script that reads and echoes the cookie
			await cliServer.playground.writeFile(
				'/wordpress/read-cookie.php',
				'<?php echo isset($_COOKIE["test_cookie"]) ? $_COOKIE["test_cookie"] : "no cookie"; ?>'
			);

			// First request: set the cookie
			const setUrl = new URL('/set-cookie.php', cliServer.serverUrl);
			const setResponse = await fetch(setUrl);
			expect(setResponse.status).toBe(200);
			expect(await setResponse.text()).toContain('cookie set');

			// Second request: the cookie should be sent by the internal store
			const readUrl = new URL('/read-cookie.php', cliServer.serverUrl);
			const readResponse = await fetch(readUrl);
			expect(readResponse.status).toBe(200);
			expect(await readResponse.text()).toContain('hello');
		});

		test('should strip Set-Cookie headers from responses when enabled', async () => {
			await using cliServer = await runCLI({
				command: 'server',
				internalCookieStore: true,
				wordpressInstallMode: 'do-not-attempt-installing',
				skipSqliteSetup: true,
				blueprint: undefined,
			});

			await cliServer.playground.writeFile(
				'/wordpress/set-cookie.php',
				'<?php setcookie("test_cookie", "hello", 0, "/"); echo "ok"; ?>'
			);

			const url = new URL('/set-cookie.php', cliServer.serverUrl);
			// Use http.get to inspect raw headers (fetch may hide some)
			const res = await new Promise<http.IncomingMessage>(
				(resolve, reject) => {
					const req = http.get(url, resolve);
					req.on('error', reject);
					req.end();
				}
			);
			// Set-Cookie should be stripped from the response
			expect(res.headers['set-cookie']).toBeUndefined();
		});

		test('should not use internal cookie store when disabled', async () => {
			await using cliServer = await runCLI({
				command: 'server',
				// internalCookieStore defaults to false
				wordpressInstallMode: 'do-not-attempt-installing',
				skipSqliteSetup: true,
				blueprint: undefined,
			});

			await cliServer.playground.writeFile(
				'/wordpress/set-cookie.php',
				'<?php setcookie("test_cookie", "hello", 0, "/"); echo "cookie set"; ?>'
			);
			await cliServer.playground.writeFile(
				'/wordpress/read-cookie.php',
				'<?php echo isset($_COOKIE["test_cookie"]) ? $_COOKIE["test_cookie"] : "no cookie"; ?>'
			);

			// First request: set the cookie
			const setUrl = new URL('/set-cookie.php', cliServer.serverUrl);
			const setResponse = await fetch(setUrl);
			expect(setResponse.status).toBe(200);

			// Second request: cookie should NOT be present (no browser to store it)
			const readUrl = new URL('/read-cookie.php', cliServer.serverUrl);
			const readResponse = await fetch(readUrl);
			expect(readResponse.status).toBe(200);
			expect(await readResponse.text()).toContain('no cookie');
		});

		test('should replace browser-sent cookies with stored cookies when enabled', async () => {
			await using cliServer = await runCLI({
				command: 'server',
				internalCookieStore: true,
				wordpressInstallMode: 'do-not-attempt-installing',
				skipSqliteSetup: true,
				blueprint: undefined,
			});

			await cliServer.playground.writeFile(
				'/wordpress/set-cookie.php',
				'<?php setcookie("internal", "from_store", 0, "/"); echo "ok"; ?>'
			);
			await cliServer.playground.writeFile(
				'/wordpress/read-cookies.php',
				'<?php echo "internal=" . ($_COOKIE["internal"] ?? "none") . ";browser=" . ($_COOKIE["browser"] ?? "none"); ?>'
			);

			// First: set a cookie via the internal store
			const setUrl = new URL('/set-cookie.php', cliServer.serverUrl);
			await fetch(setUrl);

			// Second: send a request with a browser cookie — it should be replaced
			const readUrl = new URL('/read-cookies.php', cliServer.serverUrl);
			const res = await new Promise<http.IncomingMessage>(
				(resolve, reject) => {
					const req = http.get(
						readUrl,
						{
							headers: {
								cookie: 'browser=from_browser',
							},
						},
						resolve
					);
					req.on('error', reject);
					req.end();
				}
			);

			const chunks: Uint8Array[] = [];
			for await (const chunk of res) {
				chunks.push(chunk);
			}
			const body = Buffer.concat(chunks).toString();
			// Internal store cookie should be present
			expect(body).toContain('internal=from_store');
			// Browser cookie should be replaced (not present)
			expect(body).toContain('browser=none');
		});
	});

	describe('signal handling', () => {
		test.each(['SIGINT', 'SIGTERM'] as const)(
			'should clean up and exit on %s',
			async (signal) => {
				const listenersBeforeRunCli = process.listeners(signal).slice();

				const exitSpy = vi.spyOn(process, 'exit').mockImplementation(
					// Stop the test from actually causing the process to exit.
					(() => {}) as any
				);

				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				await using cliResult = await parseOptionsAndRunCLI([
					'server',
					'--wordpress-install-mode=do-not-attempt-installing',
					'--skip-sqlite-setup',
					'--verbosity=quiet',
					'--port=0',
				]);
				const cliServer = cliResult[internalsKeyForTesting].cliServer;

				const asyncDisposeSpy = vi
					.spyOn(cliServer, Symbol.asyncDispose)
					.mockImplementation((() => {}) as any);

				try {
					// process.exit should not have been called during startup
					expect(exitSpy).not.toHaveBeenCalled();

					// Find the handler registered by parseOptionsAndRunCLI
					const newListenersAfterRunCli = process
						.listeners(signal)
						.filter((l) => !listenersBeforeRunCli.includes(l));
					expect(newListenersAfterRunCli).toHaveLength(1);

					// Invoke the handler and await its async cleanup
					await Promise.all(
						newListenersAfterRunCli
							.map((listener) => listener as () => Promise<void>)
							.map((listener) => listener())
					);

					expect(asyncDisposeSpy).toHaveBeenCalled();
					expect(exitSpy).toHaveBeenCalledWith(0);
				} finally {
					exitSpy.mockRestore();
					asyncDisposeSpy.mockRestore();
				}
			}
		);
	});
});
