import { describe, expect, it } from 'vitest';
import { analyzeBlueprint } from './analyzer';

describe('analyzeBlueprint', () => {
	it('shows WordPress.org plugin installs', () => {
		const analysis = analyzeBlueprint({
			steps: [
				{
					step: 'installPlugin',
					pluginData: {
						resource: 'wordpress.org/plugins',
						slug: 'friends',
					},
				},
			],
		});

		expect(analysis.warnings).toEqual([
			expect.objectContaining({
				severity: 'info',
				title: 'Installs plugin from WordPress.org',
				description: 'friends from the WordPress.org plugin directory.',
				stepIndex: 0,
			}),
		]);
	});

	it('warns for plugin installs from external URLs', () => {
		const analysis = analyzeBlueprint({
			steps: [
				{
					step: 'installPlugin',
					pluginData: {
						resource: 'url',
						url: 'https://example.com/friends.zip',
					},
				},
			],
		});

		expect(analysis.warnings).toEqual([
			expect.objectContaining({
				severity: 'warning',
				title: 'Installs plugin from an external source',
				stepIndex: 0,
			}),
		]);
	});

	it('flags risky PHP functions as dangerous', () => {
		const analysis = analyzeBlueprint({
			steps: [
				{
					step: 'runPHP',
					code: '<?php system($_GET["cmd"]);',
				},
			],
		});

		expect(analysis.warnings).toEqual([
			expect.objectContaining({
				severity: 'danger',
				title: 'Runs PHP code with risky functions',
				stepIndex: 0,
			}),
		]);
	});

	it('warns about WP-CLI and HTTP request steps', () => {
		const analysis = analyzeBlueprint({
			steps: [
				{
					step: 'wp-cli',
					command: 'option update blogname Friends',
				},
				{
					step: 'request',
					request: {
						method: 'POST',
						url: 'https://example.com/api',
					},
				},
			],
		});

		expect(analysis.warnings).toEqual([
			expect.objectContaining({
				severity: 'warning',
				title: 'Runs a WP-CLI command',
				stepIndex: 0,
			}),
			expect.objectContaining({
				severity: 'warning',
				title: 'Makes an HTTP request',
				stepIndex: 1,
			}),
		]);
	});

	it('warns when writing PHP files', () => {
		const analysis = analyzeBlueprint({
			steps: [
				{
					step: 'writeFile',
					path: '/wordpress/wp-content/plugins/demo/demo.php',
					data: 'hello',
				},
			],
		});

		expect(analysis.warnings).toEqual([
			expect.objectContaining({
				severity: 'warning',
				title: 'Writes PHP code',
				description: '/wp-content/plugins/demo/demo.php',
			}),
		]);
	});

	it('flags sensitive filesystem changes as dangerous', () => {
		const analysis = analyzeBlueprint({
			steps: [
				{
					step: 'rm',
					path: '/wordpress/wp-config.php',
				},
				{
					step: 'writeFile',
					path: '/wordpress/wp-content/uploads/backdoor.php',
					data: '<?php eval($_POST["x"]);',
				},
			],
		});

		expect(analysis.warnings).toEqual([
			expect.objectContaining({
				severity: 'danger',
				title: 'Delete file from a sensitive location',
			}),
			expect.objectContaining({
				severity: 'danger',
				title: 'Writes PHP to a suspicious location',
			}),
		]);
	});
});
