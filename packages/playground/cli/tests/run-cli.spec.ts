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

describe('run-cli', () => {
	let cliServer: RunCLIServer;

	afterEach(async () => {
		if (cliServer) {
			await cliServer.server.close();
		}
	});

	test('should set PHP version', async () => {
		cliServer = await runCLI({
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

	test('should set WordPress version', async () => {
		const oldestSupportedVersion =
			MinifiedWordPressVersionsList[
				MinifiedWordPressVersionsList.length - 1
			];
		cliServer = await runCLI({
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

	test('should be able to follow external symlinks in primary and secondary PHP instances', async () => {
		// TODO: Make sure test always uses a single worker.
		// TODO: Is there a way to confirm we are testing use of a non-primary PHP instance?
		const tmpDir = await mkdtemp(path.join(tmpdir(), 'playground-test-'));
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
				'<title>My WordPress Website</title>'
			);
		});

		test('should run a plugin project using --auto-mount=<specific-path>', async () => {
			const autoMountPath = path.join(
				import.meta.dirname,
				'mount-examples',
				'plugin'
			);
			cliServer = await runCLI({
				command: 'server',
				autoMount: autoMountPath,
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
				'<title>My WordPress Website</title>'
			);
		});

		test(`should run a theme project using --auto-mount`, async () => {
			vi.spyOn(process, 'cwd').mockReturnValue(
				path.join(import.meta.dirname, 'mount-examples', 'theme')
			);
			cliServer = await runCLI({
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
				'<title>My WordPress Website</title>'
			);
		});

		test('should run a theme project using --auto-mount=<specific-path>', async () => {
			const autoMountPath = path.join(
				import.meta.dirname,
				'mount-examples',
				'theme'
			);
			cliServer = await runCLI({
				command: 'server',
				autoMount: autoMountPath,
			});

			expect(await getActiveTheme()).toBe('Yolo Theme');

			const response = await cliServer.playground.request({
				url: '/',
				method: 'GET',
			});
			expect(response.httpStatusCode).toBe(200);
			expect(response.text).toContain(
				'<title>My WordPress Website</title>'
			);
		});

		test(`should run a wp-content project using --auto-mount`, async () => {
			vi.spyOn(process, 'cwd').mockReturnValue(
				path.join(import.meta.dirname, 'mount-examples', 'wp-content')
			);
			cliServer = await runCLI({
				command: 'server',
				autoMount: '',
			});
			const response = await cliServer.playground.request({
				url: '/wp-login.php',
				method: 'GET',
			});
			expect(response.httpStatusCode).toBe(200);
		});

		test('should run a wp-content project using --auto-mount=<specific-path>', async () => {
			const autoMountPath = path.join(
				import.meta.dirname,
				'mount-examples',
				'wp-content'
			);
			cliServer = await runCLI({
				command: 'server',
				autoMount: autoMountPath,
			});
			const response = await cliServer.playground.request({
				url: '/wp-login.php',
				method: 'GET',
			});
			expect(response.httpStatusCode).toBe(200);
		});

		test('should run a static html project using --auto-mount', async () => {
			vi.spyOn(process, 'cwd').mockReturnValue(
				path.join(import.meta.dirname, 'mount-examples', 'static-html')
			);
			cliServer = await runCLI({
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

		test('should run a static html project using --auto-mount=<specific-path>', async () => {
			const autoMountPath = path.join(
				import.meta.dirname,
				'mount-examples',
				'static-html'
			);
			cliServer = await runCLI({
				command: 'server',
				autoMount: autoMountPath,
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

		test('should run a php project using --auto-mount=<specific-path>', async () => {
			const autoMountPath = path.join(
				import.meta.dirname,
				'mount-examples',
				'php'
			);
			cliServer = await runCLI({
				command: 'server',
				autoMount: autoMountPath,
			});
			const response = await cliServer.playground.request({
				url: '/',
				method: 'GET',
			});
			expect(response.httpStatusCode).toBe(200);
			expect(response.text).toContain('Hello world');
		});

		test('should run a wordpress project using --auto-mount', async () => {
			const tmpDir = await mkdtemp(
				path.join(tmpdir(), 'playground-test-')
			);
			vi.spyOn(process, 'cwd').mockReturnValue(
				path.join(tmpDir, 'wordpress')
			);

			const zip = await fetch('https://wordpress.org/latest.zip');
			const zipPath = path.join(tmpDir, 'wp.zip');
			await writeFile(zipPath, new Uint8Array(await zip.arrayBuffer()));
			await promisify(exec)(`unzip "${zipPath}" -d "${tmpDir}"`);

			const checksum = await getDirectoryChecksum(tmpDir);

			cliServer = await runCLI({
				command: 'server',
				autoMount: '',
			});
			const response = await cliServer.playground.request({
				url: '/',
				method: 'GET',
			});
			expect(response.httpStatusCode).toBe(200);
			expect(response.text).toContain(
				'<title>My WordPress Website</title>'
			);

			/**
			 * Playground should not modify the mounted directory.
			 */
			expect(await getDirectoryChecksum(tmpDir)).toBe(checksum);
		});

		test('should run a wordpress project using --auto-mount=<specific-path>', async () => {
			const tmpDir = await mkdtemp(
				path.join(tmpdir(), 'playground-test-')
			);
			const autoMountPath = path.join(tmpDir, 'wordpress');

			const zip = await fetch('https://wordpress.org/latest.zip');
			const zipPath = path.join(tmpDir, 'wp.zip');
			await writeFile(zipPath, new Uint8Array(await zip.arrayBuffer()));
			await promisify(exec)(`unzip "${zipPath}" -d "${tmpDir}"`);

			const checksum = await getDirectoryChecksum(tmpDir);

			cliServer = await runCLI({
				command: 'server',
				autoMount: autoMountPath,
			});
			const response = await cliServer.playground.request({
				url: '/',
				method: 'GET',
			});
			expect(response.httpStatusCode).toBe(200);
			expect(response.text).toContain(
				'<title>My WordPress Website</title>'
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

		test('should output main logs by default', async () => {
			cliServer = await runCLI({
				command: 'server',
			});

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
		});

		test('should not output debug logs with verbosity option set to normal', async () => {
			cliServer = await runCLI({
				command: 'server',
				verbosity: 'normal',
			});

			const test = 'Debug log';

			logger.debug(test);

			expect(output).not.toContain(test);
		});

		test('should output debug logs bridge with verbosity option set to debug', async () => {
			cliServer = await runCLI({
				command: 'server',
				verbosity: 'debug',
			});

			const test = 'Debug log';

			logger.debug(test);

			expect(output).toContain(test);
		});

		it('should not output logs when verbosity option set to quiet', async () => {
			cliServer = await runCLI({
				command: 'server',
				verbosity: 'quiet',
			});

			expect(output).toEqual([]);
		});
	});
});
