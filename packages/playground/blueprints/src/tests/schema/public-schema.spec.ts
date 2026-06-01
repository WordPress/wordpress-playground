import { describe, expect, it } from 'vitest';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import * as ts from 'typescript';
import schema from '../../../public/blueprint-schema.json';
import validateBlueprintDeclaration from '../../../public/blueprint-schema-validator';
import packageJson from '../../../package.json';
import { validateBlueprintV2 } from '../../lib/v2/compile';

const publicDir = resolve(
	dirname(fileURLToPath(import.meta.url)),
	'../../../public'
);

describe('public Blueprint schema', () => {
	it('publishes a combined v1/v2 BlueprintDeclaration schema', () => {
		expect(schema.$ref).toBe('#/definitions/BlueprintDeclaration');
		expect(schema.definitions).toHaveProperty('BlueprintV1Declaration');
		expect(schema.definitions).toHaveProperty('BlueprintV2Declaration');
		expect(schema.definitions.BlueprintDeclaration).toHaveProperty('oneOf');
	});

	it('validates v1 and v2 declarations', () => {
		expect(validateBlueprintDeclaration({})).toBe(true);
		expect(
			validateBlueprintDeclaration({
				version: 2,
				plugins: ['akismet'],
				content: [
					{
						type: 'wxr',
						source: {
							filename: 'content.xml',
							content: '<rss />',
						},
						authorsMode: 'map',
						authorsMap: {
							remote_author: 'admin',
						},
					},
				],
			})
		).toBe(true);
		expect(
			validateBlueprintDeclaration({
				version: 2,
				plugins: ['https://example.com/plugin.zip'],
				media: ['./assets/image.png'],
			})
		).toBe(true);
	});

	it('accepts public Blueprint v2 schema example shapes', () => {
		for (const blueprint of [
			{
				version: 2,
				activeTheme: {
					source: 'https://github.com/richtabor/kanso/archive/refs/heads/main.zip',
					targetDirectoryName: 'kanso',
					importStarterContent: true,
				},
			},
			{
				version: 2,
				themes: [
					'stylish-press-theme',
					'adventurer@4.6.0',
					{
						source: 'https://github.com/richtabor/kanso/archive/refs/heads/main.zip',
						targetDirectoryName: 'kanso',
					},
				],
			},
			{
				version: 2,
				plugins: [
					'jetpack',
					'akismet@6.4.3',
					'./query-monitor.php',
					'./code-block.zip',
					{
						source: 'https://github.com/woocommerce/woocommerce/archive/refs/heads/6.4.3.zip',
						active: false,
					},
				],
			},
			{
				version: 2,
				muPlugins: [
					{
						filename: 'addFilter-0.php',
						content:
							"<?php add_action( 'requests-requests.before_request', function( &$url ) { $url = 'https://playground.wordpress.net/cors-proxy.php?' . $url; } );",
					},
				],
			},
			{
				version: 2,
				content: [
					{
						type: 'wxr',
						source: 'https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/stylish-press/woo-products.wxr',
					},
					{
						type: 'wxr',
						source: 'https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/stylish-press/site-content.wxr',
						urlsMode: 'rewrite',
						staticAssets: 'hotlink',
						importUsers: false,
						importComments: false,
					},
				],
			},
		]) {
			expect(validateBlueprintV2(blueprint).valid).toBe(true);
			expect(validateBlueprintDeclaration(blueprint)).toBe(true);
		}
	});

	it('matches runtime validation for nested inline directory data references', () => {
		const blueprint = {
			version: 2,
			plugins: [
				{
					source: {
						directoryName: 'demo-plugin',
						files: {
							'demo-plugin.php': '<?php',
							assets: {
								files: {
									'readme.txt': 'Nested directory',
								},
							},
						},
					},
				},
			],
		};

		expect(validateBlueprintV2(blueprint).valid).toBe(true);
		expect(validateBlueprintDeclaration(blueprint)).toBe(true);
	});

	it('rejects declarations that mix v1-only and v2-only fields', () => {
		expect(
			validateBlueprintDeclaration({
				version: 2,
				steps: [],
			})
		).toBe(false);
	});

	it('matches runtime validation for v2 data references and path segments', () => {
		for (const blueprint of [
			{
				version: 2,
				media: ['not-a-url-or-path'],
			},
			{
				version: 2,
				media: ['./../secret.png'],
			},
			{
				version: 2,
				media: ['/../secret.png'],
			},
			{
				version: 2,
				media: ['./..\\secret.png'],
			},
			{
				version: 2,
				media: ['https://'],
			},
			{
				version: 2,
				media: [
					{
						source: {
							directoryName: 'media',
							files: {},
						},
					},
				],
			},
			{
				version: 2,
				additionalStepsAfterExecution: [
					{
						step: 'runPHP',
						code: {
							filename: '../escape.php',
							content: '<?php',
						},
					},
				],
			},
			{
				version: 2,
				plugins: [
					{
						source: {
							gitRepository: 'https://',
						},
					},
				],
			},
			{
				version: 2,
				plugins: [
					{
						source: 'akismet',
						targetDirectoryName: '../plugins',
					},
				],
			},
			{
				version: 2,
				plugins: [
					{
						source: 'akismet',
						targetDirectoryName: '',
					},
				],
			},
			{
				version: 2,
				plugins: [
					{
						source: 'akismet',
						targetDirectoryName: '.',
					},
				],
			},
			{
				version: 2,
				plugins: ['bad/slug'],
			},
			{
				version: 2,
				themes: ['bad/slug'],
			},
			{
				version: 2,
				blueprintMeta: {
					homepage: 'https://',
				},
			},
			{
				version: 2,
				content: [
					{
						type: 'wxr',
						source: {
							filename: 'content.xml',
							content: '<rss />',
						},
						urlsMap: {
							'https://': 'https://new.example',
						},
					},
				],
			},
			{
				version: 2,
				siteOptions: {
					siteUrl: 'https://example.com',
				},
			},
			{
				version: 2,
				fonts: {
					bad: 'https://example.com/font.txt',
				},
			},
			{
				version: 2,
				wordpressVersion: '6.7-beta',
			},
			{
				version: 2,
				wordpressVersion: '6.8-RC',
			},
			{
				version: 2,
				content: [
					{
						type: 'mysql-dump',
						source: {
							filename: 'dump.sql',
							content: 'SELECT 1;',
						},
						urlsMap: {
							'https://old.example': 'https://new.example',
						},
					},
				],
			},
			{
				version: 2,
				content: [
					{
						type: 'wxr',
						source: {
							filename: 'content.xml',
							content: '<rss />',
						},
						authorsMode: 'map',
					},
				],
			},
			{
				version: 2,
				content: [
					{
						type: 'posts',
						source: {
							title: 'Alias title',
							content: 'Alias content',
							meta: {
								seo_title: 'Alias',
							},
							extra: true,
						},
					},
				],
			},
			{
				version: 2,
				additionalStepsAfterExecution: [
					{
						step: 'mkdir',
						path: 'site:../escape',
					},
				],
			},
			{
				version: 2,
				additionalStepsAfterExecution: [
					{
						step: 'defineConstants',
						constants: {
							BAD: {
								nested: true,
							},
						},
					},
				],
			},
			{
				version: 2,
				additionalStepsAfterExecution: [
					{
						step: 'writeFiles',
						files: {
							'../escape.php': {
								filename: 'escape.php',
								content: '<?php',
							},
						},
					},
				],
			},
			{
				version: 2,
				additionalStepsAfterExecution: [
					{
						step: 'writeFiles',
						files: {
							'/wordpress/empty.php': {
								filename: '',
								content: '<?php',
							},
						},
					},
				],
			},
			{
				version: 2,
				additionalStepsAfterExecution: [
					{
						step: 'writeFiles',
						files: {
							'/wordpress/dot.php': {
								filename: '.',
								content: '<?php',
							},
						},
					},
				],
			},
			{
				version: 2,
				additionalStepsAfterExecution: [
					{
						step: 'writeFiles',
						files: {
							'/wordpress/wp-content/plugins/demo': {
								directoryName: 'demo',
								files: {
									'../escape.php': '<?php',
								},
							},
						},
					},
				],
			},
			{
				version: 2,
				plugins: [
					{
						source: {
							directoryName: 'demo',
							files: {
								'': '<?php',
							},
						},
					},
				],
			},
			{
				version: 2,
				plugins: [
					{
						source: {
							directoryName: 'demo',
							files: {
								'.': '<?php',
							},
						},
					},
				],
			},
			{
				version: 2,
				plugins: [
					{
						source: {
							directoryName: 'demo',
							files: {
								'nested/path.php': '<?php',
							},
						},
					},
				],
			},
			{
				version: 2,
				plugins: [
					{
						source: {
							directoryName: 'demo',
							files: {
								nested: {
									directoryName: 'ignored',
									files: {
										'index.php': '<?php',
									},
								},
							},
						},
					},
				],
			},
			{
				version: 2,
				phpVersion: {
					min: 'next',
				},
			},
			{
				version: 2,
				phpVersion: {
					recommended: 'next',
				},
			},
			{
				version: 2,
				wordpressVersion: {
					min: 'trunk',
				},
			},
			{
				version: 2,
				wordpressVersion: {
					min: 'nightly',
				},
			},
			{
				version: 2,
				wordpressVersion: {
					min: '6.3',
					recommended: 'beta',
				},
			},
		]) {
			expect(validateBlueprintV2(blueprint).valid).toBe(false);
			expect(validateBlueprintDeclaration(blueprint)).toBe(false);
		}
	});

	it('matches runtime validation for v2 version constraints', () => {
		const blueprint = {
			version: 2,
			wordpressVersion: {
				min: '6.3',
				max: '6.9',
				recommended: '6.8',
			},
			phpVersion: {
				min: '8.0',
				max: '8.4',
				recommended: '8.3',
			},
		};

		expect(validateBlueprintV2(blueprint).valid).toBe(true);
		expect(validateBlueprintDeclaration(blueprint)).toBe(true);
		expect(
			validateBlueprintV2({
				version: 2,
				wordpressVersion: {
					min: '6.3',
					max: '6.8',
					recommended: 'latest',
				},
			}).valid
		).toBe(true);
		expect(
			validateBlueprintDeclaration({
				version: 2,
				wordpressVersion: {
					min: '6.3',
					max: '6.8',
					recommended: 'latest',
				},
			})
		).toBe(true);
		expect(
			validateBlueprintDeclaration({
				version: 2,
				wordpressVersion: 'beta',
			})
		).toBe(true);
		expect(
			validateBlueprintDeclaration({
				version: 2,
				wordpressVersion: 'trunk',
			})
		).toBe(true);
		expect(
			validateBlueprintDeclaration({
				version: 2,
				wordpressVersion: 'nightly',
			})
		).toBe(true);
		expect(
			validateBlueprintDeclaration({
				version: 2,
				wordpressVersion: '6.8-RC1',
			})
		).toBe(true);
		expect(
			validateBlueprintDeclaration({
				version: 2,
				wordpressVersion: '6.7-beta2',
			})
		).toBe(true);
		expect(
			validateBlueprintDeclaration({
				version: 2,
				phpVersion: 'next',
			})
		).toBe(true);
		expect(
			validateBlueprintDeclaration({
				version: 2,
				wordpressVersion:
					'https://playground.test/plugin-proxy.php?artifact=wordpress-build-123',
			})
		).toBe(true);
	});

	it('exports documented public schema and validator files', () => {
		expect(packageJson.exports).toHaveProperty(
			'./public/blueprint-schema.json'
		);
		expect(packageJson.exports).toHaveProperty(
			'./public/blueprint-schema-validator.js'
		);
		expect(packageJson.exports).toHaveProperty(
			'./public/blueprint-v1-schema-validator.js'
		);
	});

	it('publishes valid TypeScript declarations for standalone validators', () => {
		const declarationPaths = [
			resolve(publicDir, 'blueprint-schema-validator.d.ts'),
			resolve(publicDir, 'blueprint-v1-schema-validator.d.ts'),
		];
		const program = ts.createProgram(declarationPaths, {
			noEmit: true,
			skipLibCheck: true,
			target: ts.ScriptTarget.ES2020,
			module: ts.ModuleKind.NodeNext,
			moduleResolution: ts.ModuleResolutionKind.NodeNext,
		});
		const diagnostics = ts
			.getPreEmitDiagnostics(program)
			.filter(
				(diagnostic) =>
					diagnostic.file &&
					declarationPaths.includes(diagnostic.file.fileName)
			)
			.map(formatTypeScriptDiagnostic);

		expect(diagnostics).toEqual([]);
	});
});

function formatTypeScriptDiagnostic(diagnostic: ts.Diagnostic) {
	const message = ts.flattenDiagnosticMessageText(
		diagnostic.messageText,
		'\n'
	);
	if (!diagnostic.file) {
		return message;
	}
	const position = diagnostic.file.getLineAndCharacterOfPosition(
		diagnostic.start ?? 0
	);
	return `${diagnostic.file.fileName}:${position.line + 1}:${
		position.character + 1
	} ${message}`;
}
