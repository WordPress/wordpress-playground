import { PHP } from '@php-wasm/universal';
import {
	compileBlueprint,
	runBlueprintSteps,
	validateBlueprint,
} from './compile';
import { defineWpConfigConsts } from './steps/define-wp-config-consts';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { PHPRequestHandler } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

describe('Blueprints', () => {
	let php: PHP;
	let requestHandler: PHPRequestHandler;
	beforeEach(async () => {
		requestHandler = new PHPRequestHandler({
			phpFactory: async () =>
				new PHP(await loadNodeRuntime(RecommendedPHPVersion)),
			documentRoot: '/',
		});
		php = await requestHandler.getPrimaryPhp();
	});

	it('should run a basic blueprint', async () => {
		await runBlueprintSteps(
			compileBlueprint({
				steps: [
					{
						step: 'writeFile',
						path: '/index.php',
						data: `<?php echo 'Hello World';`,
					},
				],
			}),
			php
		);
		expect(php.fileExists('/index.php')).toBe(true);
		expect(php.readFileAsText('/index.php')).toBe(
			`<?php echo 'Hello World';`
		);
	});

	it('should define the consts in a json and auto load the defined constants', async () => {
		// Define the constants to be tested
		const consts = {
			TEST_CONST: 'test_value',
			SITE_URL: 'http://test.url',
			WP_AUTO_UPDATE_CORE: false,
		};

		php.writeFile('/wp-config.php', '<?php ');

		// Call the function with the constants and the playground client
		// Step1: define the constants
		await defineWpConfigConsts(php, {
			consts,
		});

		// Assert execution of echo statements
		php.writeFile(
			'/index.php',
			'<?php require "/wp-config.php"; echo TEST_CONST;'
		);
		let result = await requestHandler.request({ url: '/index.php' });
		expect(result.text).toBe('test_value');

		php.writeFile(
			'/index.php',
			'<?php require "/wp-config.php"; echo SITE_URL;'
		);
		result = await requestHandler.request({ url: '/index.php' });
		expect(result.text).toBe('http://test.url');

		php.writeFile(
			'/index.php',
			'<?php require "/wp-config.php"; var_dump(WP_AUTO_UPDATE_CORE);'
		);
		result = await requestHandler.request({ url: '/index.php' });
		expect(result.text.trim()).toBe('bool(false)');
	});

	describe('Validation', () => {
		const validBlueprints = [
			{},
			{
				steps: [],
			},
		];
		it.each(validBlueprints)(
			'valid Blueprint should pass validation',
			(blueprint) => {
				expect(validateBlueprint(blueprint)).toEqual({
					valid: true,
				});
			}
		);

		describe('Invalid Blueprints should not pass validation', () => {
			test('extra properties', () => {
				const invalidBlueprint = {
					invalidProperty: 'foo',
				};
				expect(validateBlueprint(invalidBlueprint)).toEqual({
					valid: false,
					errors: [
						{
							instancePath: [],
							keyword: 'additionalProperties',
							params: {
								type: 'object',
							},
							message:
								'is not allowed to have the additional property "invalidProperty"',
						},
					],
				});
			});
			test('invalid properties', () => {
				const invalidBlueprint = {
					steps: 1,
				};
				expect(validateBlueprint(invalidBlueprint)).toEqual({
					valid: false,
					errors: [
						{
							instancePath: ['steps'],
							keyword: 'type',
							params: {
								type: 'array',
							},
							message: 'is not of a type(s) array',
						},
					],
				});
			});
			test('invalid steps definition', () => {
				const invalidBlueprint = {
					steps: [
						{
							step: 'installTheme',
							// A common type:
							pluginsZipFile: {
								resource: 'wordpress.org/themes',
								slug: 'twentytwenty',
							},
						},
					],
				};
				expect(validateBlueprint(invalidBlueprint)).toEqual({
					valid: false,
					errors: [
						{
							instancePath: ['steps', 0],
							keyword: 'anyOf',
							params: {
								type: {
									anyOf: [
										{
											$ref: '#/definitions/StepDefinition',
										},
										{
											type: 'string',
										},
										{
											not: {},
										},
										{
											const: false,
											type: 'boolean',
										},
										{
											type: 'null',
										},
									],
								},
							},
							message:
								'is not any of <#/definitions/StepDefinition>,[subschema 1],[subschema 2],[subschema 3],[subschema 4]',
						},
					],
				});
			});
			test('invalid step type', () => {
				const invalidBlueprint = {
					steps: [14],
				};
				expect(validateBlueprint(invalidBlueprint)).toEqual({
					valid: false,
					errors: [
						{
							instancePath: ['steps', 0],
							keyword: 'anyOf',
							params: {
								type: {
									anyOf: [
										{
											$ref: '#/definitions/StepDefinition',
										},
										{
											type: 'string',
										},
										{
											not: {},
										},
										{
											const: false,
											type: 'boolean',
										},
										{
											type: 'null',
										},
									],
								},
							},
							message:
								'is not any of <#/definitions/StepDefinition>,[subschema 1],[subschema 2],[subschema 3],[subschema 4]',
						},
					],
				});
			});
		});
	});
});
