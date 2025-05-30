import path from 'node:path';
import { runCLI } from '../run-cli';
import type { RunCLIServer } from '../run-cli';
import type { MockInstance } from 'vitest';
import { vi } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { exec } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { MinifiedWordPressVersionsList } from '@wp-playground/wordpress-builds';
describe('cli-run', () => {
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
		(await cliServer.requestHandler.getPrimaryPhp()).writeFile(
			'/wordpress/version.php',
			'<?php echo phpversion(); ?>'
		);
		const response = await cliServer.requestHandler.request({
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
		const php = await cliServer.requestHandler.getPrimaryPhp();
		php.writeFile(
			'/wordpress/version.php',
			`<?php
            require_once '/wordpress/wp-load.php';
            echo get_bloginfo("version");
            ?>`
		);
		const response = await cliServer.requestHandler.request({
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
		const response = await cliServer.requestHandler.request({
			url: '/',
			method: 'GET',
		});
		expect(response.httpStatusCode).toBe(200);
		expect(response.text).toContain('<title>My Blog Name</title>');
	});

	describe('auto-mount', () => {
		const getDirectoryChecksum = async (dir: string) => {
			const hash = createHash('sha256');
			for (const file of readdirSync(dir)) {
				hash.update(file);
			}
			return hash.digest('hex');
		};
		const getActiveTheme = async () => {
			const php = await cliServer.requestHandler.getPrimaryPhp();
			const response = await php.run({
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
				path.join(__dirname, 'mount-examples', 'plugin')
			);
			cliServer = await runCLI({
				command: 'server',
				autoMount: true,
			});
			const php = await cliServer.requestHandler.getPrimaryPhp();
			const phpResponse = await php.run({
				code: `<?php
					require_once '/wordpress/wp-load.php';
					require_once '/wordpress/wp-admin/includes/plugin.php';
					echo is_plugin_active('plugin/sample-plugin.php') ? '1' : '0';
				?>`,
			});
			expect(phpResponse.text).toBe('1');

			const response = await cliServer.requestHandler.request({
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
				path.join(__dirname, 'mount-examples', 'theme')
			);
			cliServer = await runCLI({
				command: 'server',
				autoMount: true,
			});

			expect(await getActiveTheme()).toBe('Yolo Theme');

			const response = await cliServer.requestHandler.request({
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
				path.join(__dirname, 'mount-examples', 'wp-content')
			);
			cliServer = await runCLI({
				command: 'server',
				autoMount: true,
			});
			const response = await cliServer.requestHandler.request({
				url: '/wp-login.php',
				method: 'GET',
			});
			expect(response.httpStatusCode).toBe(200);
		});

		test('should run a static html project using --auto-mount', async () => {
			vi.spyOn(process, 'cwd').mockReturnValue(
				path.join(__dirname, 'mount-examples', 'static-html')
			);
			cliServer = await runCLI({
				command: 'server',
				autoMount: true,
			});
			const response = await cliServer.requestHandler.request({
				url: '/',
				method: 'GET',
			});
			expect(response.httpStatusCode).toBe(200);
			expect(response.text).toContain('<title>Static HTML</title>');
		});

		test('should run a php project using --auto-mount', async () => {
			vi.spyOn(process, 'cwd').mockReturnValue(
				path.join(__dirname, 'mount-examples', 'php')
			);
			cliServer = await runCLI({
				command: 'server',
				autoMount: true,
			});
			const response = await cliServer.requestHandler.request({
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
				autoMount: true,
			});
			const response = await cliServer.requestHandler.request({
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
});
