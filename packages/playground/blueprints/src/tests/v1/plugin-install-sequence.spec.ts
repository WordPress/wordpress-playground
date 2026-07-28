import type { PHP, PHPRequestHandler } from '@php-wasm/universal';
import { logger } from '@php-wasm/logger';
import { loadNodeRuntime } from '@php-wasm/node';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { bootWordPressAndRequestHandler } from '@wp-playground/wordpress';
import {
	getSqliteDriverModule,
	getWordPressModule,
} from '@wp-playground/wordpress-builds';
import type { InstallPluginOptions, StepDefinition } from '../../lib/steps';
import {
	BlueprintStepExecutionError,
	compileBlueprintV1,
} from '../../lib/v1/compile';

describe('consecutive installPlugin steps', () => {
	let php: PHP;
	let handler: PHPRequestHandler;
	let wordPressZip: Awaited<ReturnType<typeof getWordPressModule>>;
	let sqliteIntegrationPluginZip: Awaited<
		ReturnType<typeof getSqliteDriverModule>
	>;

	beforeAll(async () => {
		[wordPressZip, sqliteIntegrationPluginZip] = await Promise.all([
			getWordPressModule(),
			getSqliteDriverModule(),
		]);
	});

	beforeEach(async () => {
		handler = await bootWordPressAndRequestHandler({
			createPhpRuntime: () => loadNodeRuntime(RecommendedPHPVersion),
			siteUrl: 'http://playground-domain/',
			wordPressZip,
			sqliteIntegrationPluginZip,
		});
		php = await handler.getPrimaryPhp();
	});

	afterEach(async () => {
		php.exit();
		await handler[Symbol.asyncDispose]();
	});

	it('activates a run in one WordPress boot and leaves opted-out plugins inactive', async () => {
		const bootCountPath = '/tmp/plugin-activation-boot-count';
		const muPluginsPath = '/wordpress/wp-content/mu-plugins';
		if (!(await php.fileExists(muPluginsPath))) {
			await php.mkdir(muPluginsPath);
		}
		await php.writeFile(
			`${muPluginsPath}/count-plugin-activation-boots.php`,
			`<?php
$path = ${JSON.stringify(bootCountPath)};
$count = file_exists($path) ? (int) file_get_contents($path) : 0;
file_put_contents($path, (string) ($count + 1));
`
		);

		await runBlueprint([
			pluginStep('first-plugin'),
			pluginStep('inactive-plugin', '', { activate: false }),
			pluginStep('second-plugin'),
		]);

		expect(await php.readFileAsText(bootCountPath)).toBe('1');
		const activePlugins = await readActivePlugins();
		expect(activePlugins).toEqual(
			expect.arrayContaining([
				'first-plugin/first-plugin.php',
				'second-plugin/second-plugin.php',
			])
		);
		expect(activePlugins).not.toContain(
			'inactive-plugin/inactive-plugin.php'
		);
	});

	it('keeps activating after a plugin prints during activation', async () => {
		const loggerWarnSpy = vi
			.spyOn(logger, 'warn')
			.mockImplementation(() => {});
		try {
			await runBlueprint([
				pluginStep(
					'noisy-plugin',
					`register_activation_hook(__FILE__, function() {
	echo 'Activation says hi';
});`
				),
				pluginStep(
					'follower-plugin',
					`register_activation_hook(__FILE__, function() {
	file_put_contents('/tmp/follower-plugin-activated', 'yes');
});`
				),
			]);

			expect(await readActivePlugins()).toEqual(
				expect.arrayContaining([
					'noisy-plugin/noisy-plugin.php',
					'follower-plugin/follower-plugin.php',
				])
			);
			expect(
				await php.readFileAsText('/tmp/follower-plugin-activated')
			).toBe('yes');
			expect(loggerWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining(
					'Plugin /wordpress/wp-content/plugins/noisy-plugin activation printed'
				)
			);
		} finally {
			loggerWarnSpy.mockRestore();
		}
	});

	it('resumes the run after a plugin redirects during activation', async () => {
		await runBlueprint([
			pluginStep(
				'redirecting-plugin',
				`add_action('activated_plugin', function($plugin) {
	if ($plugin === plugin_basename(__FILE__)) {
		wp_redirect(admin_url('plugins.php'));
		exit;
	}
});`
			),
			pluginStep(
				'after-redirect-plugin',
				`register_activation_hook(__FILE__, function() {
	file_put_contents('/tmp/after-redirect-plugin-activated', 'yes');
});`
			),
		]);

		expect(await readActivePlugins()).toEqual(
			expect.arrayContaining([
				'redirecting-plugin/redirecting-plugin.php',
				'after-redirect-plugin/after-redirect-plugin.php',
			])
		);
		expect(
			await php.readFileAsText('/tmp/after-redirect-plugin-activated')
		).toBe('yes');
	});

	it('keeps activationOptions scoped to each plugin and removes them afterwards', async () => {
		const activationHook = (optionName: string) =>
			`register_activation_hook(__FILE__, function() {
	update_option(
		${JSON.stringify(optionName)},
		get_option('blueprint_activation_' . plugin_basename(__FILE__))
	);
});`;

		await runBlueprint([
			pluginStep('first-options-plugin', activationHook('first-seen'), {
				activationOptions: { plugin: 'first' },
			}),
			pluginStep('second-options-plugin', activationHook('second-seen'), {
				activationOptions: { plugin: 'second' },
			}),
		]);

		const response = await php.run({
			code: `<?php
require '/wordpress/wp-load.php';
echo json_encode(array(
	'first' => get_option('first-seen'),
	'second' => get_option('second-seen'),
	'firstTemporary' => get_option(
		'blueprint_activation_first-options-plugin/first-options-plugin.php',
		'missing'
	),
	'secondTemporary' => get_option(
		'blueprint_activation_second-options-plugin/second-options-plugin.php',
		'missing'
	),
));
`,
		});

		expect(response.json).toEqual({
			first: { plugin: 'first' },
			second: { plugin: 'second' },
			firstTemporary: 'missing',
			secondTemporary: 'missing',
		});
	});

	it('reports the original step and leaves later plugins inactive after a failure', async () => {
		const onStepCompleted = vi.fn();
		const steps = [
			pluginStep('first-plugin'),
			pluginStep('unsupported-plugin', '', undefined, [
				' * Requires PHP: 99.0',
			]),
			pluginStep('later-plugin'),
		];
		const compiled = await compileBlueprintV1(
			{ steps },
			{ onStepCompleted }
		);

		let caught: unknown;
		try {
			await compiled.run(php);
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(BlueprintStepExecutionError);
		expect(caught).toMatchObject({
			stepNumber: 2,
			step: {
				step: 'installPlugin',
			},
		});
		expect((caught as Error).message).toContain(
			'/wordpress/wp-content/plugins/unsupported-plugin'
		);
		expect(
			onStepCompleted.mock.calls.map((call) => call[1].pluginData.name)
		).toEqual(['first-plugin']);
		const activePlugins = await readActivePlugins();
		expect(activePlugins).toContain('first-plugin/first-plugin.php');
		expect(activePlugins).not.toContain(
			'unsupported-plugin/unsupported-plugin.php'
		);
		expect(activePlugins).not.toContain('later-plugin/later-plugin.php');
	});

	it('continues after an interrupted activation configured to skip', async () => {
		const loggerWarnSpy = vi
			.spyOn(logger, 'warn')
			.mockImplementation(() => {});
		const onStepCompleted = vi.fn();
		try {
			const steps = [
				pluginStep(
					'interrupted-plugin',
					`register_activation_hook(__FILE__, function() {
	exit;
});`,
					{ onError: 'skip-plugin' }
				),
				pluginStep('later-plugin'),
			];
			const compiled = await compileBlueprintV1(
				{ steps },
				{ onStepCompleted }
			);

			await expect(compiled.run(php)).resolves.toBeUndefined();

			const activePlugins = await readActivePlugins();
			expect(activePlugins).not.toContain(
				'interrupted-plugin/interrupted-plugin.php'
			);
			expect(activePlugins).toContain('later-plugin/later-plugin.php');
			expect(onStepCompleted).toHaveBeenCalledTimes(2);
			expect(loggerWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining(
					'Skipping interrupted-plugin after failure'
				)
			);
		} finally {
			loggerWarnSpy.mockRestore();
		}
	});

	async function runBlueprint(steps: StepDefinition[]) {
		const compiled = await compileBlueprintV1({ steps });
		await compiled.run(php);
	}

	async function readActivePlugins(): Promise<string[]> {
		const response = await php.run({
			code: `<?php
require '/wordpress/wp-load.php';
echo json_encode(get_option('active_plugins', array()));
`,
		});
		return response.json;
	}
});

function pluginStep(
	name: string,
	body = '',
	options?: InstallPluginOptions,
	extraHeaders: string[] = []
): StepDefinition {
	return {
		step: 'installPlugin',
		pluginData: {
			resource: 'literal:directory',
			name,
			files: {
				[`${name}.php`]: `<?php
/**
 * Plugin Name: ${name}
${extraHeaders.join('\n')}
 */
${body}
`,
			},
		},
		...(options ? { options } : {}),
	};
}
