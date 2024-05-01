import { NodePHP } from '@php-wasm/node';
import {
	compileBlueprint,
	runBlueprintSteps,
	validateBlueprint,
} from './compile';
import { defineWpConfigConsts } from './steps/define-wp-config-consts';
import { RecommendedPHPVersion } from '@wp-playground/wordpress';
import { PHPRequestHandler } from '@php-wasm/universal';

describe('Blueprints', () => {
	let php: NodePHP;
	let requestHandler: PHPRequestHandler<NodePHP>;
	beforeEach(async () => {
		requestHandler = new PHPRequestHandler({
			phpFactory: () => NodePHP.load(RecommendedPHPVersion),
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
							instancePath: '',
							keyword: 'additionalProperties',
							params: {
								additionalProperty: 'invalidProperty',
							},
							message: 'must NOT have additional properties',
							schemaPath: expect.any(String),
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
							instancePath: '/steps',
							keyword: 'type',
							params: {
								type: 'array',
							},
							message: 'must be array',
							schemaPath: expect.any(String),
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
							instancePath: '/steps/0',
							keyword: 'required',
							params: {
								missingProperty: 'themeZipFile',
							},
							message:
								"must have required property 'themeZipFile'",
							schemaPath: expect.any(String),
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
							instancePath: '/steps/0',
							keyword: 'type',
							params: {
								type: 'object',
							},
							message: 'must be object',
							schemaPath: expect.any(String),
						},
					],
				});
			});
		});
	});
});
