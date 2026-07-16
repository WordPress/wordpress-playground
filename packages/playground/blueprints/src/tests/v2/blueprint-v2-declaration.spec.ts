import type { BlueprintV2Declaration } from '../../lib/v2/blueprint-v2-declaration';

describe('Blueprint v2 declaration types', () => {
	it('accepts a PHP-only WordPress version sentinel', () => {
		const blueprints = [
			{ version: 2, wordpressVersion: 'latest' },
			{ version: 2, wordpressVersion: 'none' },
		] satisfies BlueprintV2Declaration[];

		expect(blueprints).toHaveLength(2);
	});

	it('accepts site-creation baselines', () => {
		const blueprints = [
			{
				version: 2,
				contentBaseline: 'keep-all',
				usersBaseline: 'keep-all',
			},
			{
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
			},
			{
				version: 2,
				contentBaseline: 'posts',
			},
			{
				version: 2,
				contentBaseline: ['posts', 'pages', 'comments'],
			},
		] satisfies BlueprintV2Declaration[];

		expect(blueprints).toHaveLength(4);
	});

	it('accepts file data references for file-only fields', () => {
		const blueprint = {
			version: 2,
			content: [
				{
					type: 'mysql-dump',
					source: './dump.sql',
				},
				{
					type: 'posts',
					source: {
						filename: 'posts.json',
						content: '[]',
					},
				},
				{
					type: 'wxr',
					source: 'site:wp-content/plugins/woocommerce/sample-data/sample_products.xml',
				},
			],
			media: [
				'./image.jpg',
				{
					source: {
						filename: 'image.jpg',
						content: 'image',
					},
					title: 'Image',
				},
			],
			additionalStepsAfterExecution: [
				{
					step: 'enableMultisite',
				},
				{
					step: 'runPHP',
					code: {
						filename: 'script.php',
						content: '<?php echo "Hello";',
					},
				},
				{
					step: 'runSQL',
					source: './dump.sql',
				},
				{
					step: 'unzip',
					zipFile: './archive.zip',
					extractToPath: '/tmp/archive',
				},
			],
		} satisfies BlueprintV2Declaration;

		expect(blueprint.version).toBe(2);
	});

	it('accepts inline directories with nested child directories', () => {
		const blueprint = {
			version: 2,
			additionalStepsAfterExecution: [
				{
					step: 'writeFiles',
					files: {
						'/wordpress/wp-content/uploads': {
							directoryName: 'uploads',
							files: {
								'2026': {
									files: {
										'07': {
											files: {
												'image.txt': 'image',
											},
										},
									},
								},
							},
						},
					},
				},
			],
		} satisfies BlueprintV2Declaration;

		expect(blueprint.version).toBe(2);
	});

	it('accepts arbitrary WXR author-map usernames', () => {
		const blueprint = {
			version: 2,
			content: [
				{
					type: 'wxr',
					source: './content.wxr',
					authorsMode: 'map',
					authorsMap: {
						alice: 'admin',
						'bob@example.com': 'editor',
					},
				},
			],
		} satisfies BlueprintV2Declaration;

		expect(blueprint.version).toBe(2);
	});

	it('accepts WXR source lists', () => {
		const blueprint = {
			version: 2,
			content: [
				{
					type: 'wxr',
					source: [
						'./products.wxr',
						{
							filename: 'pages.wxr',
							content: '<rss version="2.0"></rss>',
						},
					],
				},
			],
		} satisfies BlueprintV2Declaration;

		expect(blueprint.version).toBe(2);
	});

	it('accepts Blueprint v2 runtime version labels', () => {
		const blueprints = [
			{
				version: 2,
				wordpressVersion: 'beta',
				phpVersion: 'next',
			},
			{
				version: 2,
				wordpressVersion: 'trunk',
			},
			{
				version: 2,
				wordpressVersion: 'nightly',
			},
		] satisfies BlueprintV2Declaration[];

		expect(blueprints).toHaveLength(3);
	});

	it('accepts Blueprint v2 version constraints', () => {
		const blueprint = {
			version: 2,
			wordpressVersion: {
				min: '6.8-rc1',
				max: '6.9',
				preferred: 'latest',
			},
			phpVersion: {
				min: '8.0',
				recommended: '8.3',
				max: '8.4',
			},
		} satisfies BlueprintV2Declaration;

		expect(blueprint.version).toBe(2);
	});

	it('accepts plugin install collision handling', () => {
		const blueprint = {
			version: 2,
			plugins: [
				{
					source: 'akismet',
					ifAlreadyInstalled: 'skip',
				},
				{
					source: 'jetpack',
					ifAlreadyInstalled: 'error',
				},
			],
		} satisfies BlueprintV2Declaration;

		expect(blueprint.version).toBe(2);
	});

	it('accepts theme install failure handling', () => {
		const blueprint = {
			version: 2,
			themes: [
				{
					source: 'twentytwentyfour',
					onError: 'skip-theme',
				},
			],
		} satisfies BlueprintV2Declaration;

		expect(blueprint.version).toBe(2);
	});

	it('accepts theme install collision handling', () => {
		const blueprint = {
			version: 2,
			activeTheme: {
				source: 'twentytwentyfour',
				ifAlreadyInstalled: 'skip',
			},
			themes: [
				{
					source: 'twentytwentythree',
					ifAlreadyInstalled: 'error',
				},
			],
		} satisfies BlueprintV2Declaration;

		expect(blueprint.version).toBe(2);
	});
});

const blueprintWithDirectoryAsRunPHPCode = {
	version: 2,
	additionalStepsAfterExecution: [
		{
			step: 'runPHP',
			code: {
				// @ts-expect-error runPHP code must resolve to a single file.
				directoryName: 'scripts',
				files: {
					'index.php': '<?php echo "Hello";',
				},
			},
		},
	],
} satisfies BlueprintV2Declaration;

const blueprintWithDirectoryAsMediaSource = {
	version: 2,
	media: [
		{
			source: {
				// @ts-expect-error media source must resolve to a single file.
				directoryName: 'images',
				files: {
					'image.jpg': 'image',
				},
			},
		},
	],
} satisfies BlueprintV2Declaration;

const blueprintWithNestedDirectoryName = {
	version: 2,
	additionalStepsAfterExecution: [
		{
			step: 'writeFiles',
			files: {
				'/wordpress/wp-content/uploads': {
					directoryName: 'uploads',
					files: {
						'2026': {
							// @ts-expect-error nested directory names come from the parent key.
							directoryName: '2026',
							files: {
								'image.txt': 'image',
							},
						},
					},
				},
			},
		},
	],
} satisfies BlueprintV2Declaration;

const blueprintWithInvalidPluginCollisionHandling = {
	version: 2,
	plugins: [
		{
			source: 'akismet',
			// @ts-expect-error Plugin collision handling must be a known policy.
			ifAlreadyInstalled: 'replace',
		},
	],
} satisfies BlueprintV2Declaration;

const blueprintWithInvalidThemeInstallFailureHandling = {
	version: 2,
	themes: [
		{
			source: 'twentytwentyfour',
			// @ts-expect-error Theme install failure handling must be theme-specific.
			onError: 'skip-plugin',
		},
	],
} satisfies BlueprintV2Declaration;

const blueprintWithInvalidThemeCollisionHandling = {
	version: 2,
	themes: [
		{
			source: 'twentytwentyfour',
			// @ts-expect-error Theme collision handling must be a known policy.
			ifAlreadyInstalled: 'replace',
		},
	],
} satisfies BlueprintV2Declaration;

const blueprintWithMissingWxrAuthorsMap = {
	version: 2,
	content: [
		// @ts-expect-error WXR author mapping must declare the author map.
		{
			type: 'wxr',
			source: './content.wxr',
			authorsMode: 'map',
		},
	],
} satisfies BlueprintV2Declaration;

const blueprintWithNonComparableWordPressVersionMinimum = {
	version: 2,
	wordpressVersion: {
		// @ts-expect-error Version constraint minimums must be comparable versions.
		min: 'latest',
	},
} satisfies BlueprintV2Declaration;

const blueprintWithExtraWordPressVersionComponent = {
	version: 2,
	wordpressVersion: {
		// @ts-expect-error Version constraints must have two or three components.
		min: '6.8.1.2',
	},
} satisfies BlueprintV2Declaration;

const blueprintWithUnsupportedWordPressVersionRecommendation = {
	version: 2,
	wordpressVersion: {
		min: '6.8',
		// @ts-expect-error WordPress version constraints use preferred, not recommended.
		recommended: '6.8.1',
	},
} satisfies BlueprintV2Declaration;

const blueprintWithNonComparablePHPVersionRecommendation = {
	version: 2,
	phpVersion: {
		// @ts-expect-error Runtime labels are only valid as top-level PHP versions.
		recommended: 'next',
	},
} satisfies BlueprintV2Declaration;

const blueprintWithUrlMappingForMysqlDump = {
	version: 2,
	content: [
		{
			type: 'mysql-dump',
			source: './dump.sql',
			// @ts-expect-error URL mapping does not apply to SQL dump imports.
			urlsMode: 'rewrite',
		},
	],
} satisfies BlueprintV2Declaration;

const blueprintWithEmptyContentBaselineList = {
	version: 2,
	// @ts-expect-error Use "empty" instead of an empty baseline list.
	contentBaseline: [],
} satisfies BlueprintV2Declaration;

const blueprintWithUnsupportedContentBaselineType = {
	version: 2,
	// @ts-expect-error Users are not a content type.
	contentBaseline: ['users'],
} satisfies BlueprintV2Declaration;

const blueprintWithUnsupportedWordPressVersion = {
	version: 2,
	// @ts-expect-error Only supported WordPress version values are accepted.
	wordpressVersion: 'node',
} satisfies BlueprintV2Declaration;

void blueprintWithDirectoryAsRunPHPCode;
void blueprintWithDirectoryAsMediaSource;
void blueprintWithNestedDirectoryName;
void blueprintWithInvalidPluginCollisionHandling;
void blueprintWithInvalidThemeInstallFailureHandling;
void blueprintWithInvalidThemeCollisionHandling;
void blueprintWithMissingWxrAuthorsMap;
void blueprintWithNonComparableWordPressVersionMinimum;
void blueprintWithExtraWordPressVersionComponent;
void blueprintWithUnsupportedWordPressVersionRecommendation;
void blueprintWithNonComparablePHPVersionRecommendation;
void blueprintWithUrlMappingForMysqlDump;
void blueprintWithEmptyContentBaselineList;
void blueprintWithUnsupportedContentBaselineType;
void blueprintWithUnsupportedWordPressVersion;
