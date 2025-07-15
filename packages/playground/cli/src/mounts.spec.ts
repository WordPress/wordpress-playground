import path from 'node:path';
import type { MockInstance } from 'vitest';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { expandAutoMounts } from './mounts';
import type { RunCLIArgs } from './run-cli';

describe('expandAutoMounts', () => {
	afterEach(() => {
		if ((process.cwd as unknown as MockInstance).mockRestore) {
			(process.cwd as unknown as MockInstance).mockRestore();
		}
	});

	const createBasicArgs = (): RunCLIArgs => ({
		command: 'server',
		php: '8.0',
	});

	describe('plugin directory detection', () => {
		test('should mount plugin directory correctly', () => {
			vi.spyOn(process, 'cwd').mockReturnValue(
				path.join(__dirname, 'test/mount-examples/plugin')
			);

			const args = createBasicArgs();
			const result = expandAutoMounts(args);

			expect(result.mount).toEqual([
				{
					hostPath: path.join(
						__dirname,
						'test/mount-examples/plugin'
					),
					vfsPath: '/wordpress/wp-content/plugins/plugin',
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
			vi.spyOn(process, 'cwd').mockReturnValue(
				path.join(__dirname, 'test/mount-examples/not-plugin')
			);

			const args = createBasicArgs();
			const result = expandAutoMounts(args);

			// Should fall back to default behavior (mount as /wordpress)
			expect(result.mount).toEqual([
				{
					hostPath: path.join(
						__dirname,
						'test/mount-examples/not-plugin'
					),
					vfsPath: '/wordpress',
				},
			]);
			expect(result['additional-blueprint-steps']).toEqual([]);
		});
	});

	describe('theme directory detection', () => {
		test('should mount theme directory correctly', () => {
			vi.spyOn(process, 'cwd').mockReturnValue(
				path.join(__dirname, 'test/mount-examples/theme')
			);

			const args = createBasicArgs();
			const result = expandAutoMounts(args);

			expect(result.mount).toEqual([
				{
					hostPath: path.join(__dirname, 'test/mount-examples/theme'),
					vfsPath: '/wordpress/wp-content/themes/theme',
				},
			]);
			expect(result['additional-blueprint-steps']).toEqual([
				{
					step: 'activateTheme',
					themeDirectoryName: 'theme',
				},
			]);
		});

		test('should not mount non-theme directory as theme', () => {
			vi.spyOn(process, 'cwd').mockReturnValue(
				path.join(__dirname, 'test/mount-examples/not-theme')
			);

			const args = createBasicArgs();
			const result = expandAutoMounts(args);

			// Should fall back to default behavior (mount as /wordpress)
			expect(result.mount).toEqual([
				{
					hostPath: path.join(
						__dirname,
						'test/mount-examples/not-theme'
					),
					vfsPath: '/wordpress',
				},
			]);
			expect(result['additional-blueprint-steps']).toEqual([]);
		});
	});

	describe('wp-content directory detection', () => {
		test('should mount wp-content directory correctly', () => {
			vi.spyOn(process, 'cwd').mockReturnValue(
				path.join(__dirname, 'test/mount-examples/wp-content')
			);

			const args = createBasicArgs();
			const result = expandAutoMounts(args);

			expect(result.mount).toEqual([
				{
					hostPath: path.join(
						__dirname,
						'test/mount-examples/wp-content/plugins'
					),
					vfsPath: '/wordpress/wp-content/plugins',
				},
				{
					hostPath: path.join(
						__dirname,
						'test/mount-examples/wp-content/themes'
					),
					vfsPath: '/wordpress/wp-content/themes',
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
			vi.spyOn(process, 'cwd').mockReturnValue(
				path.join(
					__dirname,
					'test/mount-examples/wp-content-only-themes'
				)
			);

			const args = createBasicArgs();
			const result = expandAutoMounts(args);

			expect(result.mount).toEqual([
				{
					hostPath: path.join(
						__dirname,
						'test/mount-examples/wp-content-only-themes/themes'
					),
					vfsPath: '/wordpress/wp-content/themes',
				},
			]);
		});

		test('should mount wp-content directory with only mu-plugins', () => {
			vi.spyOn(process, 'cwd').mockReturnValue(
				path.join(
					__dirname,
					'test/mount-examples/wp-content-only-mu-plugins'
				)
			);

			const args = createBasicArgs();
			const result = expandAutoMounts(args);

			expect(result.mount).toEqual([
				{
					hostPath: path.join(
						__dirname,
						'test/mount-examples/wp-content-only-mu-plugins/mu-plugins'
					),
					vfsPath: '/wordpress/wp-content/mu-plugins',
				},
			]);
		});
	});

	describe('full WordPress installation detection', () => {
		test('should mount full WordPress installation correctly', () => {
			vi.spyOn(process, 'cwd').mockReturnValue(
				path.join(__dirname, 'test/mount-examples/wordpress')
			);

			const args = createBasicArgs();
			const result = expandAutoMounts(args);

			// Should mount individual files except wp-content
			expect(result['mount-before-install'] || []).toEqual(
				expect.arrayContaining([
					{
						hostPath: path.join(
							__dirname,
							'test/mount-examples/wordpress'
						),
						vfsPath: '/wordpress',
					},
				])
			);
			// @TODO: Uncomment when merging Blueprints v2 support
			// expect(result.mode).toBe('apply-to-existing-site');
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
	});

	describe('default behavior', () => {
		test('should mount static HTML directory as default', () => {
			vi.spyOn(process, 'cwd').mockReturnValue(
				path.join(__dirname, 'test/mount-examples/static-html')
			);

			const args = createBasicArgs();
			const result = expandAutoMounts(args);

			expect(result.mount).toEqual([
				{
					hostPath: path.join(
						__dirname,
						'test/mount-examples/static-html'
					),
					vfsPath: '/wordpress',
				},
			]);
			expect(result['additional-blueprint-steps']).toEqual([]);
			// @TODO: Uncomment when merging Blueprints v2 support
			// expect(result.mode).toBe('mount-only');
		});

		test('should mount PHP directory as default', () => {
			vi.spyOn(process, 'cwd').mockReturnValue(
				path.join(__dirname, 'test/mount-examples/php')
			);

			const args = createBasicArgs();
			const result = expandAutoMounts(args);

			expect(result.mount).toEqual([
				{
					hostPath: path.join(__dirname, 'test/mount-examples/php'),
					vfsPath: '/wordpress',
				},
			]);
			expect(result['additional-blueprint-steps']).toEqual([]);
			// @TODO: Uncomment when merging Blueprints v2 support
			// expect(result.mode).toBe('mount-only');
		});

		test('should mount empty directory as default', () => {
			vi.spyOn(process, 'cwd').mockReturnValue(
				path.join(__dirname, 'test/mount-examples/nothing')
			);

			const args = createBasicArgs();
			const result = expandAutoMounts(args);

			expect(result.mount).toEqual([
				{
					hostPath: path.join(
						__dirname,
						'test/mount-examples/nothing'
					),
					vfsPath: '/wordpress',
				},
			]);
			expect(result['additional-blueprint-steps']).toEqual([]);
			// @TODO: Uncomment when merging Blueprints v2 support
			// expect(result.mode).toBe('mount-only');
		});
	});

	describe('preserving existing arguments', () => {
		test('should preserve existing mounts', () => {
			vi.spyOn(process, 'cwd').mockReturnValue(
				path.join(__dirname, 'test/mount-examples/plugin')
			);

			const args: RunCLIArgs = {
				...createBasicArgs(),
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
					hostPath: path.join(
						__dirname,
						'test/mount-examples/plugin'
					),
					vfsPath: '/wordpress/wp-content/plugins/plugin',
				},
			]);
		});

		test('should preserve existing mountBeforeInstall', () => {
			vi.spyOn(process, 'cwd').mockReturnValue(
				path.join(__dirname, 'test/mount-examples/wordpress')
			);

			const args: RunCLIArgs = {
				...createBasicArgs(),
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
			// Should also contain the auto-detected mounts
			expect(
				(result['mount-before-install'] || []).length
			).toBeGreaterThan(1);
		});

		test('should preserve existing blueprint steps', () => {
			vi.spyOn(process, 'cwd').mockReturnValue(
				path.join(__dirname, 'test/mount-examples/plugin')
			);

			const args: RunCLIArgs = {
				...createBasicArgs(),
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
			vi.spyOn(process, 'cwd').mockReturnValue(
				path.join(__dirname, 'test/mount-examples/plugin')
			);

			const args: RunCLIArgs = {
				...createBasicArgs(),
				mount: undefined,
				'mount-before-install': undefined,
			};
			const result = expandAutoMounts(args);

			expect(result.mount).toEqual([
				{
					hostPath: path.join(
						__dirname,
						'test/mount-examples/plugin'
					),
					vfsPath: '/wordpress/wp-content/plugins/plugin',
				},
			]);
			expect(result['mount-before-install']).toEqual([]);
		});

		test('should handle undefined blueprint', () => {
			vi.spyOn(process, 'cwd').mockReturnValue(
				path.join(__dirname, 'test/mount-examples/plugin')
			);

			const args: RunCLIArgs = {
				...createBasicArgs(),
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

		test('should handle blueprint as string', () => {
			vi.spyOn(process, 'cwd').mockReturnValue(
				path.join(__dirname, 'test/mount-examples/plugin')
			);

			const args: RunCLIArgs = {
				...createBasicArgs(),
				blueprint: { plugins: ['gutenberg'] },
			};
			const result = expandAutoMounts(args);

			// Should preserve the string blueprint as is (steps are not added for string blueprints)
			expect(result.blueprint).toEqual({ plugins: ['gutenberg'] });
		});

		test('should return all other arguments unchanged', () => {
			vi.spyOn(process, 'cwd').mockReturnValue(
				path.join(__dirname, 'test/mount-examples/plugin')
			);

			const args: RunCLIArgs = {
				...createBasicArgs(),
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
