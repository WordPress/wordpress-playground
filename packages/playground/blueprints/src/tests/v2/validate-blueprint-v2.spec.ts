import { InvalidBlueprintError } from '../../lib/invalid-blueprint-error';
import {
	assertValidBlueprintV2Declaration,
	validateBlueprintV2,
} from '../../lib/v2/validate-blueprint-v2';

describe('Blueprint v2 schema validation', () => {
	it('accepts a minimal declaration', () => {
		expect(validateBlueprintV2({ version: 2 })).toEqual({ valid: true });
	});

	it.each([
		{ permalink_structure: '/%postname%/' },
		{ permalink_structure: false },
	])('accepts supported permalink values', (siteOptions) => {
		expect(validateBlueprintV2({ version: 2, siteOptions })).toEqual({
			valid: true,
		});
	});

	it('accepts mixed file-backed and inline post sources', () => {
		expect(
			validateBlueprintV2({
				version: 2,
				content: [
					{
						type: 'posts',
						source: ['./post.html', { post_title: 'Inline post' }],
					},
				],
			})
		).toEqual({ valid: true });
	});

	it('preserves backslashes as valid POSIX path bytes', () => {
		expect(
			validateBlueprintV2({
				version: 2,
				muPlugins: [
					{ filename: 'plugin\\name.php', content: '<?php' },
					{
						directoryName: 'plugin\\directory',
						files: { 'file\\name.php': '<?php' },
					},
				],
			})
		).toEqual({ valid: true });
	});

	it('accepts WHATWG URLs with percent-encoded credentials', () => {
		expect(
			validateBlueprintV2({
				version: 2,
				blueprintMeta: {
					homepage:
						'https://user%40name:password@example.com/plugin.zip',
				},
			})
		).toEqual({ valid: true });
	});

	it.each(['https://?', 'https://#', 'https://[invalid]/x'])(
		'rejects malformed HTTP URL %s',
		(homepage) => {
			const result = validateBlueprintV2({
				version: 2,
				blueprintMeta: { homepage },
			});

			expect(result).toMatchObject({
				valid: false,
				errors: [
					expect.objectContaining({
						path: '/blueprintMeta/homepage',
					}),
				],
			});
		}
	);

	it.each([
		[
			'an unknown top-level property',
			{ version: 2, pluginz: [] },
			'/pluginz',
		],
		[
			'a non-array plugins value',
			{ version: 2, plugins: 'akismet' },
			'/plugins',
		],
		[
			'an unknown PHP constraint property',
			{ version: 2, phpVersion: { typo: '8.2' } },
			'/phpVersion/typo',
		],
		[
			'an empty application options object',
			{ version: 2, applicationOptions: {} },
			'/applicationOptions/wordpress-playground',
		],
		[
			'an unknown Playground application option',
			{
				version: 2,
				applicationOptions: {
					'wordpress-playground': { unknown: true },
				},
			},
			'/applicationOptions/wordpress-playground/unknown',
		],
		[
			'a trailing step missing a required property',
			{
				version: 2,
				additionalStepsAfterExecution: [{ step: 'mkdir' }],
			},
			'/additionalStepsAfterExecution/0/path',
		],
		[
			'the reserved siteUrl option',
			{ version: 2, siteOptions: { siteUrl: 'https://example.com' } },
			'/siteOptions/siteUrl',
		],
		[
			'an execution-context path with parent traversal',
			{ version: 2, wordpressVersion: '../wordpress.zip' },
			'/wordpressVersion',
		],
		[
			'an unknown content type',
			{
				version: 2,
				content: [{ type: 'unsupported-content' }],
			},
			'/content/0/type',
		],
		[
			'an invalid URL map key',
			{
				version: 2,
				content: [
					{
						type: 'posts',
						source: { post_title: 'Post' },
						urlsMap: { 'https://': 'https://example.com' },
					},
				],
			},
			'/content/0/urlsMap/https:~1~1',
		],
		[
			'an inline filename containing a path',
			{
				version: 2,
				muPlugins: [{ filename: '../secret.php', content: '<?php' }],
			},
			'/muPlugins/0/filename',
		],
		[
			'an inline directory name containing a path',
			{
				version: 2,
				muPlugins: [{ directoryName: '../plugins', files: {} }],
			},
			'/muPlugins/0/directoryName',
		],
		[
			'an inline file-map key containing a path',
			{
				version: 2,
				muPlugins: [
					{
						directoryName: 'plugins',
						files: { '../escape.php': '<?php' },
					},
				],
			},
			'/muPlugins/0/files/..~1escape.php',
		],
		[
			'a nested inline file-map key containing a path',
			{
				version: 2,
				muPlugins: [
					{
						directoryName: 'plugins',
						files: {
							nested: {
								files: { 'nested/plugin.php': '<?php' },
							},
						},
					},
				],
			},
			'/muPlugins/0/files/nested/files/nested~1plugin.php',
		],
		[
			'a plugin target directory containing a path',
			{
				version: 2,
				plugins: [
					{ source: 'akismet', targetDirectoryName: '../akismet' },
				],
			},
			'/plugins/0/targetDirectoryName',
		],
		[
			'a theme target directory containing a path',
			{
				version: 2,
				themes: [
					{
						source: 'twentytwentyfour',
						targetDirectoryName: '../theme',
					},
				],
			},
			'/themes/0/targetDirectoryName',
		],
		[
			'a git path containing parent traversal',
			{
				version: 2,
				plugins: [
					{
						gitRepository: 'https://example.com/plugin.git',
						pathInRepository: '../plugin',
					},
				],
			},
			'/plugins/0/pathInRepository',
		],
		[
			'an invalid post type key',
			{
				version: 2,
				postTypes: { 'Invalid Post Type': {} },
			},
			'/postTypes/Invalid Post Type',
		],
	])('rejects %s at its exact path', (_name, blueprint, expectedPath) => {
		const result = validateBlueprintV2(blueprint);

		expect(result.valid).toBe(false);
		if (result.valid) {
			throw new Error('Expected schema validation to fail.');
		}
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: expectedPath }),
			])
		);
	});

	it.each([
		[
			'a plugin object without a source',
			{ version: 2, plugins: [{}] },
			{
				path: '/plugins/0',
				message: 'must match one of the allowed forms',
			},
		],
		[
			'an incomplete inline file',
			{ version: 2, plugins: [{ filename: 'plugin.php' }] },
			{
				path: '/plugins/0',
				message: 'must match one of the allowed forms',
			},
		],
		[
			'an incomplete inline directory',
			{ version: 2, muPlugins: [{ directoryName: 'plugin' }] },
			{
				path: '/muPlugins/0',
				message: 'must match one of the allowed forms',
			},
		],
		[
			'a git reference with an unknown property',
			{
				version: 2,
				plugins: [
					{
						gitRepository: 'https://example.com/plugin.git',
						unknown: true,
					},
				],
			},
			{
				path: '/plugins/0',
				message: 'must match one of the allowed forms',
			},
		],
		[
			'a malformed plugin source',
			{ version: 2, plugins: [{ source: 123 }] },
			{
				path: '/plugins/0/source',
				message: 'must match one of the allowed forms',
			},
		],
		[
			'an invalid WordPress version',
			{ version: 2, wordpressVersion: 'not-a-version' },
			{
				path: '/wordpressVersion',
				message: 'must match one of the allowed forms',
			},
		],
		[
			'an unknown PHP constraint property',
			{ version: 2, phpVersion: { typo: '8.2' } },
			{
				path: '/phpVersion/typo',
				message: 'must NOT have additional properties',
			},
		],
	])(
		'reports one concise error for %s',
		(_name, blueprint, expectedError) => {
			expect(validateBlueprintV2(blueprint)).toEqual({
				valid: false,
				errors: [expectedError],
			});
		}
	);

	it('throws an error with structured validation failures', () => {
		expect(() =>
			assertValidBlueprintV2Declaration({ version: 2, pluginz: [] })
		).toThrow(
			expect.objectContaining({
				name: 'InvalidBlueprintError',
				validationErrors: [
					{
						path: '/pluginz',
						message: 'must NOT have additional properties',
					},
				],
			})
		);
	});

	it('formats the empty JSON Pointer as the document root', () => {
		const result = validateBlueprintV2(null);
		expect(result.valid).toBe(false);
		if (result.valid) {
			throw new Error('Expected schema validation to fail.');
		}
		expect(result.errors[0].path).toBe('');
		expect(() => assertValidBlueprintV2Declaration(null)).toThrow(
			'At the document root'
		);
	});

	it('uses the generic invalid Blueprint error class', () => {
		try {
			assertValidBlueprintV2Declaration({
				version: 2,
				plugins: 'akismet',
			});
		} catch (error) {
			expect(error).toBeInstanceOf(InvalidBlueprintError);
			return;
		}
		throw new Error('Expected schema validation to throw.');
	});
});
