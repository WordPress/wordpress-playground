import { InvalidBlueprintError } from '../../lib/invalid-blueprint-error';
import {
	assertValidBlueprintV2Declaration,
	validateBlueprintV2,
} from '../../lib/v2/validate-blueprint-v2';

describe('Blueprint v2 schema validation', () => {
	it('accepts a minimal declaration', () => {
		expect(validateBlueprintV2({ version: 2 })).toEqual({ valid: true });
	});

	it('accepts wordpressVersion "none"', () => {
		expect(
			validateBlueprintV2({ version: 2, wordpressVersion: 'none' })
		).toEqual({
			valid: true,
		});
	});

	it('accepts supported Playground PHP extensions', () => {
		expect(
			validateBlueprintV2({
				version: 2,
				applicationOptions: {
					'wordpress-playground': {
						loadPhpExtensions: ['intl'],
					},
				},
			})
		).toEqual({ valid: true });
	});

	it.each([
		'keep-all',
		'empty',
		'posts',
		'pages',
		['posts'],
		['pages'],
		['posts', 'pages'],
		['posts', 'pages', 'comments'],
	])('accepts the content baseline %j', (contentBaseline) => {
		expect(
			validateBlueprintV2({
				version: 2,
				contentBaseline,
			})
		).toEqual({ valid: true });
	});

	it('accepts the keep-all user baseline', () => {
		expect(
			validateBlueprintV2({ version: 2, usersBaseline: 'keep-all' })
		).toEqual({ valid: true });
	});

	it('accepts an empty user baseline with a replacement administrator', () => {
		expect(
			validateBlueprintV2({
				version: 2,
				contentBaseline: 'empty',
				usersBaseline: 'empty',
				users: [
					{
						username: 'new-admin',
						email: 'new-admin@example.com',
						role: 'administrator',
						meta: {},
					},
				],
			})
		).toEqual({ valid: true });
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

	it('accepts target-site file sources and multisite initialization', () => {
		expect(
			validateBlueprintV2({
				version: 2,
				content: [
					{
						type: 'wxr',
						source: 'site:wp-content/plugins/woocommerce/sample-data/sample_products.xml',
					},
				],
				additionalStepsAfterExecution: [{ step: 'enableMultisite' }],
			})
		).toEqual({ valid: true });
	});

	it('accepts ordered content resets', () => {
		expect(
			validateBlueprintV2({
				version: 2,
				additionalStepsAfterExecution: [
					{
						step: 'resetData',
						contentTypes: ['pages', 'comments'],
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
			'an unsupported Playground PHP extension',
			{
				version: 2,
				applicationOptions: {
					'wordpress-playground': {
						loadPhpExtensions: ['xdebug'],
					},
				},
			},
			'/applicationOptions/wordpress-playground/loadPhpExtensions/0',
		],
		[
			'an unsupported WordPress version sentinel',
			{ version: 2, wordpressVersion: 'node' },
			'/wordpressVersion',
		],
		[
			'a WordPress content baseline without WordPress',
			{
				version: 2,
				wordpressVersion: 'none',
				contentBaseline: 'keep-all',
			},
			'/contentBaseline',
		],
		[
			'the replaced content-baseline sentinel',
			{
				version: 2,
				contentBaseline: 'default',
			},
			'/contentBaseline',
		],
		[
			'the replaced user-baseline sentinel',
			{
				version: 2,
				usersBaseline: 'default',
			},
			'/usersBaseline',
		],
		[
			'comments without scalar parent content',
			{
				version: 2,
				contentBaseline: 'comments',
			},
			'/contentBaseline',
		],
		[
			'an empty content-baseline list',
			{
				version: 2,
				contentBaseline: [],
			},
			'/contentBaseline',
		],
		[
			'an unsupported content-baseline type',
			{
				version: 2,
				contentBaseline: ['users'],
			},
			'/contentBaseline/0',
		],
		[
			'comments without their parent content',
			{
				version: 2,
				contentBaseline: ['comments'],
			},
			'/contentBaseline/0',
		],
		[
			'comments without baseline pages',
			{
				version: 2,
				contentBaseline: ['posts', 'comments'],
			},
			'/contentBaseline/0',
		],
		[
			'comments without baseline posts',
			{
				version: 2,
				contentBaseline: ['pages', 'comments'],
			},
			'/contentBaseline/0',
		],
		[
			'duplicate content-baseline types',
			{
				version: 2,
				contentBaseline: ['posts', 'posts'],
			},
			'/contentBaseline',
		],
		[
			'the replaced afterSiteCreation property',
			{
				version: 2,
				afterSiteCreation: { preserveContent: 'all' },
			},
			'/afterSiteCreation',
		],
		[
			'an empty user baseline without an empty content baseline',
			{
				version: 2,
				usersBaseline: 'empty',
				users: [
					{
						username: 'new-admin',
						email: 'new-admin@example.com',
						role: 'administrator',
						meta: {},
					},
				],
			},
			'/contentBaseline',
		],
		[
			'an empty user baseline without declared users',
			{
				version: 2,
				contentBaseline: 'empty',
				usersBaseline: 'empty',
			},
			'/users',
		],
		[
			'an empty user baseline without a replacement administrator',
			{
				version: 2,
				contentBaseline: 'empty',
				usersBaseline: 'empty',
				users: [
					{
						username: 'editor',
						email: 'editor@example.com',
						role: 'editor',
						meta: {},
					},
				],
			},
			'/users/0/role',
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
			'an empty target-site file path',
			{
				version: 2,
				content: [{ type: 'wxr', source: 'site:' }],
			},
			'/content/0/source',
		],
		[
			'a target-site file path naming the WordPress root',
			{
				version: 2,
				content: [{ type: 'wxr', source: 'site:/' }],
			},
			'/content/0/source',
		],
		[
			'a target-site file path escaping the WordPress root',
			{
				version: 2,
				content: [{ type: 'wxr', source: 'site:../secret.xml' }],
			},
			'/content/0/source',
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
