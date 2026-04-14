import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { expandAutoMounts } from '../src/mounts';
import type { RunCLIArgs } from '../src';

describe('expandAutoMounts', () => {
	const createBasicArgs = (autoMountPath: string): RunCLIArgs => ({
		command: 'server',
		php: '8.0',
		autoMount: autoMountPath,
	});

	describe('plugin directory detection', () => {
		test('should mount plugin directory correctly', () => {
			const pluginPath = path.join(__dirname, 'mount-examples/plugin');
			const args = createBasicArgs(pluginPath);
			const result = expandAutoMounts(args);

			expect(result.mount).toEqual([
				{
					hostPath: pluginPath,
					vfsPath: '/wordpress/wp-content/plugins/plugin',
					autoMounted: true,
				},
			]);
			expect(result['additional-blueprint-steps']).toEqual([
				{
					step: 'activatePlugin',
					pluginPath: '/wordpress/wp-content/plugins/plugin',
				},
			]);
		});

		test('should not mount non-plugin directory as plugin', () => {
			const notPluginPath = path.join(
				__dirname,
				'mount-examples/not-plugin'
			);
			const args = createBasicArgs(notPluginPath);
			const result = expandAutoMounts(args);

			expect(result.mount).toEqual([]);
			expect(result['additional-blueprint-steps']).toEqual([]);
		});
	});

	describe('theme directory detection', () => {
		test('should mount theme directory correctly', () => {
			const themePath = path.join(__dirname, 'mount-examples/theme');
			const args = createBasicArgs(themePath);
			const result = expandAutoMounts(args);

			expect(result.mount).toEqual([
				{
					hostPath: themePath,
					vfsPath: '/wordpress/wp-content/themes/theme',
					autoMounted: true,
				},
			]);
			expect(result['additional-blueprint-steps']).toEqual([
				{
					step: 'activateTheme',
					themeFolderName: 'theme',
				},
			]);
		});

		test('should use themeDirectoryName for v2 runner', () => {
			const themePath = path.join(__dirname, 'mount-examples/theme');
			const args: RunCLIArgs = {
				...createBasicArgs(themePath),
				'experimental-blueprints-v2-runner': true,
			};
			const result = expandAutoMounts(args);

			expect(result['additional-blueprint-steps']).toEqual([
				{
					step: 'activateTheme',
					themeDirectoryName: 'theme',
				},
			]);
		});

		test('should not mount non-theme directory as theme', () => {
			const notThemePath = path.join(
				__dirname,
				'mount-examples/not-theme'
			);
			const args = createBasicArgs(notThemePath);
			const result = expandAutoMounts(args);

			expect(result.mount).toEqual([]);
			expect(result['additional-blueprint-steps']).toEqual([]);
		});
	});

	describe('wp-content directory detection', () => {
		test('should mount wp-content directory correctly', () => {
			const wpContentPath = path.join(
				__dirname,
				'mount-examples/wp-content'
			);
			const args = createBasicArgs(wpContentPath);
			const result = expandAutoMounts(args);

			expect(result.mount).toEqual([
				{
					hostPath: path.join(
						__dirname,
						'mount-examples/wp-content/plugins'
					),
					vfsPath: '/wordpress/wp-content/plugins',
					autoMounted: true,
				},
				{
					hostPath: path.join(
						__dirname,
						'mount-examples/wp-content/themes'
					),
					vfsPath: '/wordpress/wp-content/themes',
					autoMounted: true,
				},
			]);
			const steps = result['additional-blueprint-steps'];
			expect(steps).toHaveLength(1);
			expect(steps![0]).toEqual({
				step: 'runPHP',
				code: {
					filename: 'activate-theme.php',
					content: expect.stringContaining('wp_get_theme'),
				},
			});
		});

		test('should mount wp-content directory with only themes', () => {
			const themesOnlyPath = path.join(
				__dirname,
				'mount-examples/wp-content-only-themes'
			);
			const args = createBasicArgs(themesOnlyPath);
			const result = expandAutoMounts(args);

			expect(result.mount).toEqual([
				{
					hostPath: path.join(
						__dirname,
						'mount-examples/wp-content-only-themes/themes'
					),
					vfsPath: '/wordpress/wp-content/themes',
					autoMounted: true,
				},
			]);
		});

		test('should mount wp-content directory with only mu-plugins', () => {
			const muPluginsPath = path.join(
				__dirname,
				'mount-examples/wp-content-only-mu-plugins'
			);
			const args = createBasicArgs(muPluginsPath);
			const result = expandAutoMounts(args);

			expect(result.mount).toEqual([
				{
					hostPath: path.join(
						__dirname,
						'mount-examples/wp-content-only-mu-plugins/mu-plugins'
					),
					vfsPath: '/wordpress/wp-content/mu-plugins',
					autoMounted: true,
				},
			]);
		});
	});

	describe('full WordPress installation detection', () => {
		test('should mount full WordPress installation correctly', () => {
			const wpPath = path.join(__dirname, 'mount-examples/wordpress');
			const args = createBasicArgs(wpPath);
			const result = expandAutoMounts(args);

			expect(result['mount-before-install'] || []).toEqual(
				expect.arrayContaining([
					{
						hostPath: wpPath,
						vfsPath: '/wordpress',
						autoMounted: true,
					},
				])
			);
			expect(result.mode).toBe('apply-to-existing-site');
			expect(result.wordpressInstallMode).toBe(
				'install-from-existing-files-if-needed'
			);
			const steps = result['additional-blueprint-steps'];
			expect(steps).toHaveLength(1);
			expect(steps![0]).toEqual({
				step: 'runPHP',
				code: {
					filename: 'activate-theme.php',
					content: expect.stringContaining('wp_get_theme'),
				},
			});
		});

		test('should not override existing wordpressInstallMode', () => {
			const wpPath = path.join(__dirname, 'mount-examples/wordpress');
			const args: RunCLIArgs = {
				...createBasicArgs(wpPath),
				wordpressInstallMode: 'do-not-attempt-installing',
			};
			const result = expandAutoMounts(args);

			expect(result.wordpressInstallMode).toBe(
				'do-not-attempt-installing'
			);
		});
	});

	describe('unrecognized directories', () => {
		test('should not mount static HTML directory', () => {
			const htmlPath = path.join(__dirname, 'mount-examples/static-html');
			const args = createBasicArgs(htmlPath);
			const result = expandAutoMounts(args);

			expect(result.mount).toEqual([]);
			expect(result['additional-blueprint-steps']).toEqual([]);
		});

		test('should not mount PHP directory', () => {
			const phpPath = path.join(__dirname, 'mount-examples/php');
			const args = createBasicArgs(phpPath);
			const result = expandAutoMounts(args);

			expect(result.mount).toEqual([]);
			expect(result['additional-blueprint-steps']).toEqual([]);
		});

		test('should not mount empty directory', () => {
			const nothingPath = path.join(__dirname, 'mount-examples/nothing');
			const args = createBasicArgs(nothingPath);
			const result = expandAutoMounts(args);

			expect(result.mount).toEqual([]);
			expect(result['additional-blueprint-steps']).toEqual([]);
		});
	});

	describe('preserving existing arguments', () => {
		test('should preserve existing mounts', () => {
			const pluginPath = path.join(__dirname, 'mount-examples/plugin');
			const args: RunCLIArgs = {
				...createBasicArgs(pluginPath),
				mount: [
					{
						hostPath: '/existing/mount',
						vfsPath: '/existing/vfs',
					},
				],
			};
			const result = expandAutoMounts(args);

			expect(result.mount).toEqual([
				{
					hostPath: '/existing/mount',
					vfsPath: '/existing/vfs',
				},
				{
					hostPath: pluginPath,
					vfsPath: '/wordpress/wp-content/plugins/plugin',
					autoMounted: true,
				},
			]);
		});

		test('should preserve existing mountBeforeInstall', () => {
			const wpPath = path.join(__dirname, 'mount-examples/wordpress');
			const args: RunCLIArgs = {
				...createBasicArgs(wpPath),
				'mount-before-install': [
					{
						hostPath: '/existing/before-mount',
						vfsPath: '/existing/before-vfs',
					},
				],
			};
			const result = expandAutoMounts(args);

			expect(result['mount-before-install'] || []).toEqual(
				expect.arrayContaining([
					{
						hostPath: '/existing/before-mount',
						vfsPath: '/existing/before-vfs',
					},
				])
			);
			expect(
				(result['mount-before-install'] || []).length
			).toBeGreaterThan(1);
		});

		test('should preserve existing blueprint steps', () => {
			const pluginPath = path.join(__dirname, 'mount-examples/plugin');
			const args: RunCLIArgs = {
				...createBasicArgs(pluginPath),
				'additional-blueprint-steps': [
					{
						step: 'setSiteOptions',
						options: { blogname: 'Test Blog' },
					},
				],
			};
			const result = expandAutoMounts(args);

			expect(result['additional-blueprint-steps']).toEqual([
				{
					step: 'setSiteOptions',
					options: { blogname: 'Test Blog' },
				},
				{
					step: 'activatePlugin',
					pluginPath: '/wordpress/wp-content/plugins/plugin',
				},
			]);
		});
	});

	describe('edge cases', () => {
		test('should handle undefined mount arrays', () => {
			const pluginPath = path.join(__dirname, 'mount-examples/plugin');
			const args: RunCLIArgs = {
				...createBasicArgs(pluginPath),
				mount: undefined,
				'mount-before-install': undefined,
			};
			const result = expandAutoMounts(args);

			expect(result.mount).toEqual([
				{
					hostPath: pluginPath,
					vfsPath: '/wordpress/wp-content/plugins/plugin',
					autoMounted: true,
				},
			]);
			expect(result['mount-before-install']).toEqual([]);
		});

		test('should handle undefined blueprint', () => {
			const pluginPath = path.join(__dirname, 'mount-examples/plugin');
			const args: RunCLIArgs = {
				...createBasicArgs(pluginPath),
				blueprint: undefined,
			};
			const result = expandAutoMounts(args);

			expect(result['additional-blueprint-steps']).toEqual([
				{
					step: 'activatePlugin',
					pluginPath: '/wordpress/wp-content/plugins/plugin',
				},
			]);
		});

		test('should handle blueprint as object', () => {
			const pluginPath = path.join(__dirname, 'mount-examples/plugin');
			const args: RunCLIArgs = {
				...createBasicArgs(pluginPath),
				blueprint: { plugins: ['gutenberg'] },
			};
			const result = expandAutoMounts(args);

			expect(result.blueprint).toEqual({ plugins: ['gutenberg'] });
		});

		test('should return all other arguments unchanged', () => {
			const pluginPath = path.join(__dirname, 'mount-examples/plugin');
			const args: RunCLIArgs = {
				...createBasicArgs(pluginPath),
				php: '8.1',
				port: 3000,
				quiet: true,
				debug: true,
				login: true,
				wp: '6.0',
				outfile: 'custom.zip',
			};
			const result = expandAutoMounts(args);

			expect(result.php).toBe('8.1');
			expect(result.port).toBe(3000);
			expect(result.quiet).toBe(true);
			expect(result.debug).toBe(true);
			expect(result.login).toBe(true);
			expect(result.wp).toBe('6.0');
			expect(result.outfile).toBe('custom.zip');
		});
	});
});
