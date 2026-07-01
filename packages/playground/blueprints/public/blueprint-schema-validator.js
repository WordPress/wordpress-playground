'use strict';
export const validate = validate10;
export default validate10;
const schema11 = {
	$schema: 'http://json-schema.org/schema',
	$ref: '#/definitions/BlueprintV1Declaration',
	definitions: {
		BlueprintV1Declaration: {
			type: 'object',
			properties: {
				landingPage: {
					type: 'string',
					description:
						'The URL to navigate to after the blueprint has been run.',
				},
				description: {
					type: 'string',
					description:
						"Optional description. It doesn't do anything but is exposed as a courtesy to developers who may want to document which blueprint file does what.",
					deprecated: 'Use meta.description instead.',
				},
				meta: {
					type: 'object',
					properties: {
						title: {
							type: 'string',
							description:
								'A clear and concise name for your Blueprint.',
						},
						description: {
							type: 'string',
							description:
								'A brief explanation of what your Blueprint offers.',
						},
						author: {
							type: 'string',
							description:
								'A GitHub username of the author of this Blueprint.',
						},
						categories: {
							type: 'array',
							items: { type: 'string' },
							description:
								'Relevant categories to help users find your Blueprint in the future Blueprints section on WordPress.org.',
						},
					},
					required: ['title', 'author'],
					additionalProperties: false,
					description:
						'Optional metadata. Used by the Blueprints gallery at https://github.com/WordPress/blueprints',
				},
				preferredVersions: {
					type: 'object',
					properties: {
						php: {
							anyOf: [
								{ $ref: '#/definitions/BlueprintPHPVersion' },
								{ type: 'string', const: 'latest' },
							],
							description:
								'The preferred PHP version to use. If not specified, the latest supported version will be used.\n\nNote: PHP 7.2 and 7.3 are deprecated and will be automatically upgraded to 7.4.',
						},
						wp: {
							anyOf: [
								{ type: 'string' },
								{ type: 'string', const: 'latest' },
								{ type: 'boolean', const: false },
							],
							description:
								'The preferred WordPress version to use, or `false` to boot a PHP-only Playground without downloading or installing WordPress. If not specified, the latest supported version will be used.\n\nWhen set to `false`, WordPress-specific Blueprint fields (`plugins`, `siteOptions`, `login`, and WordPress-only steps) are rejected at compile time.',
						},
					},
					required: ['php', 'wp'],
					additionalProperties: false,
					description:
						'The preferred PHP and WordPress versions to use.',
				},
				features: {
					type: 'object',
					properties: {
						intl: {
							type: 'boolean',
							description:
								'Should boot with support for Intl dynamic extension',
						},
						networking: {
							type: 'boolean',
							description:
								'Should boot with support for network request via wp_safe_remote_get?',
						},
					},
					additionalProperties: false,
				},
				extraLibraries: {
					type: 'array',
					items: { $ref: '#/definitions/ExtraLibrary' },
					description:
						'Extra libraries to preload into the Playground instance.',
				},
				constants: {
					$ref: '#/definitions/PHPConstants',
					description: 'PHP Constants to define on every request',
				},
				plugins: {
					type: 'array',
					items: {
						anyOf: [
							{ type: 'string' },
							{ $ref: '#/definitions/FileReference' },
						],
					},
					description: 'WordPress plugins to install and activate',
				},
				siteOptions: {
					type: 'object',
					additionalProperties: { type: 'string' },
					properties: {
						blogname: {
							type: 'string',
							description: 'The site title',
						},
					},
					description: 'WordPress site options to define',
				},
				login: {
					anyOf: [
						{ type: 'boolean' },
						{
							type: 'object',
							properties: {
								username: { type: 'string' },
								password: { type: 'string' },
							},
							required: ['username', 'password'],
							additionalProperties: false,
						},
					],
					description:
						'User to log in as. If true, logs the user in as admin/password.',
				},
				phpExtensionBundles: {
					deprecated:
						'No longer used. Feel free to remove it from your Blueprint.',
				},
				steps: {
					type: 'array',
					items: {
						anyOf: [
							{ $ref: '#/definitions/StepDefinition' },
							{ type: 'string' },
							{ not: {} },
							{ type: 'boolean', const: false },
							{ type: 'null' },
						],
					},
					description:
						'The steps to run after every other operation in this Blueprint was executed.',
				},
				$schema: { type: 'string' },
			},
			additionalProperties: false,
			description:
				'The Blueprint declaration, typically stored in a blueprint.json file.',
		},
		BlueprintPHPVersion: {
			anyOf: [
				{ $ref: '#/definitions/AllPHPVersion' },
				{ type: 'string', const: '7.2' },
				{ type: 'string', const: '7.3' },
			],
			description:
				'PHP versions accepted in Blueprint schema. Includes deprecated versions (7.2, 7.3) which are automatically upgraded to 7.4 during compilation.',
		},
		AllPHPVersion: {
			anyOf: [
				{ $ref: '#/definitions/PHPNextVersion' },
				{ $ref: '#/definitions/SupportedPHPVersion' },
				{ $ref: '#/definitions/LegacyPHPVersion' },
			],
		},
		PHPNextVersion: { type: 'string', const: 'next' },
		SupportedPHPVersion: {
			type: 'string',
			enum: ['8.5', '8.4', '8.3', '8.2', '8.1', '8.0', '7.4'],
		},
		LegacyPHPVersion: { type: 'string', enum: ['5.2'] },
		ExtraLibrary: { type: 'string', const: 'wp-cli' },
		PHPConstants: {
			type: 'object',
			additionalProperties: { type: ['string', 'boolean', 'number'] },
		},
		FileReference: {
			anyOf: [
				{ $ref: '#/definitions/VFSReference' },
				{ $ref: '#/definitions/LiteralReference' },
				{ $ref: '#/definitions/CoreThemeReference' },
				{ $ref: '#/definitions/CorePluginReference' },
				{ $ref: '#/definitions/UrlReference' },
				{ $ref: '#/definitions/BundledReference' },
				{ $ref: '#/definitions/ZipWrapperReference' },
			],
		},
		VFSReference: {
			type: 'object',
			properties: {
				resource: {
					type: 'string',
					const: 'vfs',
					description:
						'Identifies the file resource as Virtual File System (VFS)',
				},
				path: {
					type: 'string',
					description: 'The path to the file in the VFS',
				},
			},
			required: ['resource', 'path'],
			additionalProperties: false,
		},
		LiteralReference: {
			type: 'object',
			properties: {
				resource: {
					type: 'string',
					const: 'literal',
					description:
						'Identifies the file resource as a literal file',
				},
				name: { type: 'string', description: 'The name of the file' },
				contents: {
					anyOf: [
						{ type: 'string' },
						{
							type: 'object',
							properties: {
								BYTES_PER_ELEMENT: { type: 'number' },
								buffer: {
									type: 'object',
									properties: {
										byteLength: { type: 'number' },
									},
									required: ['byteLength'],
									additionalProperties: false,
								},
								byteLength: { type: 'number' },
								byteOffset: { type: 'number' },
								length: { type: 'number' },
							},
							required: [
								'BYTES_PER_ELEMENT',
								'buffer',
								'byteLength',
								'byteOffset',
								'length',
							],
							additionalProperties: { type: 'number' },
						},
					],
					description: 'The contents of the file',
				},
			},
			required: ['resource', 'name', 'contents'],
			additionalProperties: false,
		},
		CoreThemeReference: {
			type: 'object',
			properties: {
				resource: {
					type: 'string',
					const: 'wordpress.org/themes',
					description:
						'Identifies the file resource as a WordPress Core theme',
				},
				slug: {
					type: 'string',
					description: 'The slug of the WordPress Core theme',
				},
			},
			required: ['resource', 'slug'],
			additionalProperties: false,
		},
		CorePluginReference: {
			type: 'object',
			properties: {
				resource: {
					type: 'string',
					const: 'wordpress.org/plugins',
					description:
						'Identifies the file resource as a WordPress Core plugin',
				},
				slug: {
					type: 'string',
					description: 'The slug of the WordPress Core plugin',
				},
			},
			required: ['resource', 'slug'],
			additionalProperties: false,
		},
		UrlReference: {
			type: 'object',
			properties: {
				resource: {
					type: 'string',
					const: 'url',
					description: 'Identifies the file resource as a URL',
				},
				url: { type: 'string', description: 'The URL of the file' },
				caption: {
					type: 'string',
					description:
						'Optional caption for displaying a progress message',
				},
			},
			required: ['resource', 'url'],
			additionalProperties: false,
		},
		BundledReference: {
			type: 'object',
			properties: {
				resource: {
					type: 'string',
					const: 'bundled',
					description:
						'Identifies the file resource as a Blueprint file',
				},
				path: {
					type: 'string',
					description: 'The path to the file in the Blueprint',
				},
			},
			required: ['resource', 'path'],
			additionalProperties: false,
		},
		ZipWrapperReference: {
			type: 'object',
			properties: {
				resource: {
					type: 'string',
					const: 'zip',
					description: 'Identifies the resource as a ZIP wrapper',
				},
				inner: {
					anyOf: [
						{ $ref: '#/definitions/FileReference' },
						{ $ref: '#/definitions/DirectoryReference' },
					],
					description: 'The inner resource to wrap in a ZIP file',
				},
				name: {
					type: 'string',
					description:
						'Optional filename for the ZIP (defaults to inner resource name + .zip)',
				},
			},
			required: ['resource', 'inner'],
			additionalProperties: false,
		},
		DirectoryReference: {
			anyOf: [
				{ $ref: '#/definitions/GitDirectoryReference' },
				{ $ref: '#/definitions/DirectoryLiteralReference' },
			],
		},
		GitDirectoryReference: {
			type: 'object',
			properties: {
				resource: {
					type: 'string',
					const: 'git:directory',
					description:
						'Identifies the file resource as a git directory',
				},
				url: {
					type: 'string',
					description: 'The URL of the git repository',
				},
				ref: {
					type: 'string',
					description:
						'The ref (branch, tag, or commit) of the git repository',
				},
				refType: {
					$ref: '#/definitions/GitDirectoryRefType',
					description:
						'Explicit hint about the ref type (branch, tag, commit, refname)',
				},
				path: {
					type: 'string',
					description:
						'The path to the directory in the git repository. Defaults to the repo root.',
				},
				'.git': {
					type: 'boolean',
					description:
						'When true, include a `.git` directory with Git metadata (experimental).',
				},
			},
			required: ['resource', 'url', 'ref'],
			additionalProperties: false,
		},
		GitDirectoryRefType: {
			type: 'string',
			enum: ['branch', 'tag', 'commit', 'refname'],
		},
		DirectoryLiteralReference: {
			type: 'object',
			additionalProperties: false,
			properties: {
				resource: {
					type: 'string',
					const: 'literal:directory',
					description:
						'Identifies the file resource as a git directory',
				},
				files: { $ref: '#/definitions/FileTree' },
				name: { type: 'string' },
			},
			required: ['files', 'name', 'resource'],
		},
		FileTree: {
			type: 'object',
			additionalProperties: {
				anyOf: [
					{ $ref: '#/definitions/FileTree' },
					{ type: ['object', 'string'] },
				],
			},
			properties: {},
		},
		StepDefinition: {
			type: 'object',
			discriminator: { propertyName: 'step' },
			required: ['step'],
			oneOf: [
				{
					type: 'object',
					additionalProperties: false,
					properties: {
						progress: {
							type: 'object',
							properties: {
								weight: { type: 'number' },
								caption: { type: 'string' },
							},
							additionalProperties: false,
						},
						step: { type: 'string', const: 'activatePlugin' },
						pluginPath: {
							type: 'string',
							description:
								'Path to the plugin directory as absolute path (/wordpress/wp-content/plugins/plugin-name); or the plugin entry file relative to the plugins directory (plugin-name/plugin-name.php).',
						},
						pluginName: {
							type: 'string',
							description:
								'Optional. Plugin name to display in the progress bar.',
						},
					},
					required: ['pluginPath', 'step'],
				},
				{
					type: 'object',
					additionalProperties: false,
					properties: {
						progress: {
							type: 'object',
							properties: {
								weight: { type: 'number' },
								caption: { type: 'string' },
							},
							additionalProperties: false,
						},
						step: { type: 'string', const: 'activateTheme' },
						themeFolderName: {
							type: 'string',
							description:
								'The name of the theme folder inside wp-content/themes/',
						},
					},
					required: ['step', 'themeFolderName'],
				},
				{
					type: 'object',
					additionalProperties: false,
					properties: {
						progress: {
							type: 'object',
							properties: {
								weight: { type: 'number' },
								caption: { type: 'string' },
							},
							additionalProperties: false,
						},
						step: { type: 'string', const: 'cp' },
						fromPath: {
							type: 'string',
							description: 'Source path',
						},
						toPath: { type: 'string', description: 'Target path' },
					},
					required: ['fromPath', 'step', 'toPath'],
				},
				{
					type: 'object',
					additionalProperties: false,
					properties: {
						progress: {
							type: 'object',
							properties: {
								weight: { type: 'number' },
								caption: { type: 'string' },
							},
							additionalProperties: false,
						},
						step: { type: 'string', const: 'defineWpConfigConsts' },
						consts: {
							type: 'object',
							additionalProperties: {},
							description: 'The constants to define',
						},
						method: {
							type: 'string',
							enum: ['rewrite-wp-config', 'define-before-run'],
							description:
								"The method of defining the constants in wp-config.php. Possible values are:\n\n- rewrite-wp-config: Default. Rewrites the wp-config.php file to                      explicitly call define() with the requested                      name and value. This method alters the file                      on the disk, but it doesn't conflict with                      existing define() calls in wp-config.php.\n\n- define-before-run: Defines the constant before running the requested                      script. It doesn't alter any files on the disk, but                      constants defined this way may conflict with existing                      define() calls in wp-config.php.",
						},
						virtualize: {
							type: 'boolean',
							deprecated:
								'This option is noop and will be removed in a future version.\nThis option is only kept in here to avoid breaking Blueprint schema validation\nfor existing apps using this option.',
						},
					},
					required: ['consts', 'step'],
				},
				{
					type: 'object',
					additionalProperties: false,
					properties: {
						progress: {
							type: 'object',
							properties: {
								weight: { type: 'number' },
								caption: { type: 'string' },
							},
							additionalProperties: false,
						},
						step: { type: 'string', const: 'defineSiteUrl' },
						siteUrl: { type: 'string', description: 'The URL' },
					},
					required: ['siteUrl', 'step'],
				},
				{
					type: 'object',
					additionalProperties: false,
					properties: {
						progress: {
							type: 'object',
							properties: {
								weight: { type: 'number' },
								caption: { type: 'string' },
							},
							additionalProperties: false,
						},
						step: { type: 'string', const: 'enableMultisite' },
						wpCliPath: {
							type: 'string',
							description: 'wp-cli.phar path',
						},
					},
					required: ['step'],
				},
				{
					type: 'object',
					additionalProperties: false,
					properties: {
						progress: {
							type: 'object',
							properties: {
								weight: { type: 'number' },
								caption: { type: 'string' },
							},
							additionalProperties: false,
						},
						step: { type: 'string', const: 'importWxr' },
						file: {
							$ref: '#/definitions/FileReference',
							description: 'The file to import',
						},
						importer: {
							type: 'string',
							enum: ['data-liberation', 'default'],
							description:
								'The importer to use. Possible values:\n\n- `default`: The importer from https://github.com/humanmade/WordPress-Importer\n- `data-liberation`: The experimental Data Liberation WXR importer developed at                      https://github.com/WordPress/wordpress-playground/issues/1894\n\nThis option is deprecated. The syntax will not be removed, but once the Data Liberation importer matures, it will become the only supported importer and the `importer` option will be ignored.',
							deprecated: true,
						},
					},
					required: ['file', 'step'],
				},
				{
					type: 'object',
					additionalProperties: false,
					properties: {
						progress: {
							type: 'object',
							properties: {
								weight: { type: 'number' },
								caption: { type: 'string' },
							},
							additionalProperties: false,
						},
						step: {
							type: 'string',
							const: 'importThemeStarterContent',
							description: 'The step identifier.',
						},
						themeSlug: {
							type: 'string',
							description:
								'The name of the theme to import content from.',
						},
					},
					required: ['step'],
				},
				{
					type: 'object',
					additionalProperties: false,
					properties: {
						progress: {
							type: 'object',
							properties: {
								weight: { type: 'number' },
								caption: { type: 'string' },
							},
							additionalProperties: false,
						},
						step: { type: 'string', const: 'importWordPressFiles' },
						wordPressFilesZip: {
							$ref: '#/definitions/FileReference',
							description:
								'The zip file containing the top-level WordPress files and directories.',
						},
						pathInZip: {
							type: 'string',
							description:
								'The path inside the zip file where the WordPress files are.',
						},
					},
					required: ['step', 'wordPressFilesZip'],
				},
				{
					type: 'object',
					additionalProperties: false,
					properties: {
						progress: {
							type: 'object',
							properties: {
								weight: { type: 'number' },
								caption: { type: 'string' },
							},
							additionalProperties: false,
						},
						ifAlreadyInstalled: {
							type: 'string',
							enum: ['overwrite', 'skip', 'error'],
							description:
								'What to do if the asset already exists.',
						},
						step: {
							type: 'string',
							const: 'installPlugin',
							description: 'The step identifier.',
						},
						pluginData: {
							anyOf: [
								{ $ref: '#/definitions/FileReference' },
								{ $ref: '#/definitions/DirectoryReference' },
							],
							description:
								'The plugin files to install. It can be a plugin zip file, a single PHP file, or a directory containing all the plugin files at its root.',
						},
						pluginZipFile: {
							$ref: '#/definitions/FileReference',
							deprecated: ". Use 'pluginData' instead.",
						},
						options: {
							$ref: '#/definitions/InstallPluginOptions',
							description: 'Optional installation options.',
						},
					},
					required: ['pluginData', 'step'],
				},
				{
					type: 'object',
					additionalProperties: false,
					properties: {
						progress: {
							type: 'object',
							properties: {
								weight: { type: 'number' },
								caption: { type: 'string' },
							},
							additionalProperties: false,
						},
						ifAlreadyInstalled: {
							type: 'string',
							enum: ['overwrite', 'skip', 'error'],
							description:
								'What to do if the asset already exists.',
						},
						step: {
							type: 'string',
							const: 'installTheme',
							description: 'The step identifier.',
						},
						themeData: {
							anyOf: [
								{ $ref: '#/definitions/FileReference' },
								{ $ref: '#/definitions/DirectoryReference' },
							],
							description:
								'The theme files to install. It can be either a theme zip file, or a directory containing all the theme files at its root.',
						},
						themeZipFile: {
							$ref: '#/definitions/FileReference',
							deprecated: ". Use 'themeData' instead.",
						},
						options: {
							$ref: '#/definitions/InstallThemeOptions',
							description: 'Optional installation options.',
						},
					},
					required: ['step', 'themeData'],
				},
				{
					type: 'object',
					additionalProperties: false,
					properties: {
						progress: {
							type: 'object',
							properties: {
								weight: { type: 'number' },
								caption: { type: 'string' },
							},
							additionalProperties: false,
						},
						step: { type: 'string', const: 'login' },
						username: {
							type: 'string',
							description:
								"The user to log in as. Defaults to 'admin'.",
						},
						password: {
							type: 'string',
							deprecated:
								'The password field is deprecated and will be removed in a future version.\nOnly the username field is required for user authentication.',
						},
					},
					required: ['step'],
				},
				{
					type: 'object',
					additionalProperties: false,
					properties: {
						progress: {
							type: 'object',
							properties: {
								weight: { type: 'number' },
								caption: { type: 'string' },
							},
							additionalProperties: false,
						},
						step: { type: 'string', const: 'mkdir' },
						path: {
							type: 'string',
							description:
								'The path of the directory you want to create',
						},
					},
					required: ['path', 'step'],
				},
				{
					type: 'object',
					additionalProperties: false,
					properties: {
						progress: {
							type: 'object',
							properties: {
								weight: { type: 'number' },
								caption: { type: 'string' },
							},
							additionalProperties: false,
						},
						step: { type: 'string', const: 'mv' },
						fromPath: {
							type: 'string',
							description: 'Source path',
						},
						toPath: { type: 'string', description: 'Target path' },
					},
					required: ['fromPath', 'step', 'toPath'],
				},
				{
					type: 'object',
					additionalProperties: false,
					properties: {
						progress: {
							type: 'object',
							properties: {
								weight: { type: 'number' },
								caption: { type: 'string' },
							},
							additionalProperties: false,
						},
						step: { type: 'string', const: 'resetData' },
					},
					required: ['step'],
				},
				{
					type: 'object',
					additionalProperties: false,
					properties: {
						progress: {
							type: 'object',
							properties: {
								weight: { type: 'number' },
								caption: { type: 'string' },
							},
							additionalProperties: false,
						},
						step: { type: 'string', const: 'request' },
						request: {
							$ref: '#/definitions/PHPRequest',
							description:
								'Request details (See /wordpress-playground/api/universal/interface/PHPRequest)',
						},
					},
					required: ['request', 'step'],
				},
				{
					type: 'object',
					additionalProperties: false,
					properties: {
						progress: {
							type: 'object',
							properties: {
								weight: { type: 'number' },
								caption: { type: 'string' },
							},
							additionalProperties: false,
						},
						step: { type: 'string', const: 'rm' },
						path: {
							type: 'string',
							description: 'The path to remove',
						},
					},
					required: ['path', 'step'],
				},
				{
					type: 'object',
					additionalProperties: false,
					properties: {
						progress: {
							type: 'object',
							properties: {
								weight: { type: 'number' },
								caption: { type: 'string' },
							},
							additionalProperties: false,
						},
						step: { type: 'string', const: 'rmdir' },
						path: {
							type: 'string',
							description: 'The path to remove',
						},
					},
					required: ['path', 'step'],
				},
				{
					type: 'object',
					additionalProperties: false,
					properties: {
						progress: {
							type: 'object',
							properties: {
								weight: { type: 'number' },
								caption: { type: 'string' },
							},
							additionalProperties: false,
						},
						step: {
							type: 'string',
							const: 'runPHP',
							description: 'The step identifier.',
						},
						code: {
							anyOf: [
								{ type: 'string' },
								{
									type: 'object',
									properties: {
										filename: {
											type: 'string',
											description:
												'This property is ignored during Blueprint v1 execution but exists so the same runPHP step structure can be used for Blueprints v1 and v2.',
										},
										content: { type: 'string' },
									},
									required: ['filename', 'content'],
									additionalProperties: false,
								},
							],
							description: 'The PHP code to run.',
						},
					},
					required: ['code', 'step'],
				},
				{
					type: 'object',
					additionalProperties: false,
					properties: {
						progress: {
							type: 'object',
							properties: {
								weight: { type: 'number' },
								caption: { type: 'string' },
							},
							additionalProperties: false,
						},
						step: { type: 'string', const: 'runPHPWithOptions' },
						options: {
							$ref: '#/definitions/PHPRunOptions',
							description:
								'Run options (See /wordpress-playground/api/universal/interface/PHPRunOptions/))',
						},
					},
					required: ['options', 'step'],
				},
				{
					type: 'object',
					additionalProperties: false,
					properties: {
						progress: {
							type: 'object',
							properties: {
								weight: { type: 'number' },
								caption: { type: 'string' },
							},
							additionalProperties: false,
						},
						step: {
							type: 'string',
							const: 'runWpInstallationWizard',
						},
						options: {
							$ref: '#/definitions/WordPressInstallationOptions',
						},
					},
					required: ['options', 'step'],
				},
				{
					type: 'object',
					additionalProperties: false,
					properties: {
						progress: {
							type: 'object',
							properties: {
								weight: { type: 'number' },
								caption: { type: 'string' },
							},
							additionalProperties: false,
						},
						step: {
							type: 'string',
							const: 'runSql',
							description: 'The step identifier.',
						},
						sql: {
							$ref: '#/definitions/FileReference',
							description:
								'The SQL to run. Each non-empty line must contain a valid SQL query.',
						},
					},
					required: ['sql', 'step'],
				},
				{
					type: 'object',
					additionalProperties: false,
					properties: {
						progress: {
							type: 'object',
							properties: {
								weight: { type: 'number' },
								caption: { type: 'string' },
							},
							additionalProperties: false,
						},
						step: {
							type: 'string',
							const: 'setSiteOptions',
							description:
								'The name of the step. Must be "setSiteOptions".',
						},
						options: {
							type: 'object',
							additionalProperties: {},
							description: 'The options to set on the site.',
						},
					},
					required: ['options', 'step'],
				},
				{
					type: 'object',
					additionalProperties: false,
					properties: {
						progress: {
							type: 'object',
							properties: {
								weight: { type: 'number' },
								caption: { type: 'string' },
							},
							additionalProperties: false,
						},
						step: { type: 'string', const: 'unzip' },
						zipFile: {
							$ref: '#/definitions/FileReference',
							description: 'The zip file to extract',
						},
						zipPath: {
							type: 'string',
							description: 'The path of the zip file to extract',
							deprecated: 'Use zipFile instead.',
						},
						extractToPath: {
							type: 'string',
							description: 'The path to extract the zip file to',
						},
					},
					required: ['extractToPath', 'step'],
				},
				{
					type: 'object',
					additionalProperties: false,
					properties: {
						progress: {
							type: 'object',
							properties: {
								weight: { type: 'number' },
								caption: { type: 'string' },
							},
							additionalProperties: false,
						},
						step: { type: 'string', const: 'updateUserMeta' },
						meta: {
							type: 'object',
							additionalProperties: {},
							description:
								'An object of user meta values to set, e.g. { "first_name": "John" }',
						},
						userId: { type: 'number', description: 'User ID' },
					},
					required: ['meta', 'step', 'userId'],
				},
				{
					type: 'object',
					additionalProperties: false,
					properties: {
						progress: {
							type: 'object',
							properties: {
								weight: { type: 'number' },
								caption: { type: 'string' },
							},
							additionalProperties: false,
						},
						step: { type: 'string', const: 'writeFile' },
						path: {
							type: 'string',
							description: 'The path of the file to write to',
						},
						data: {
							anyOf: [
								{ $ref: '#/definitions/FileReference' },
								{ type: 'string' },
								{
									type: 'object',
									properties: {
										BYTES_PER_ELEMENT: { type: 'number' },
										buffer: {
											type: 'object',
											properties: {
												byteLength: { type: 'number' },
											},
											required: ['byteLength'],
											additionalProperties: false,
										},
										byteLength: { type: 'number' },
										byteOffset: { type: 'number' },
										length: { type: 'number' },
									},
									required: [
										'BYTES_PER_ELEMENT',
										'buffer',
										'byteLength',
										'byteOffset',
										'length',
									],
									additionalProperties: { type: 'number' },
								},
							],
							description: 'The data to write',
						},
					},
					required: ['data', 'path', 'step'],
				},
				{
					type: 'object',
					additionalProperties: false,
					properties: {
						progress: {
							type: 'object',
							properties: {
								weight: { type: 'number' },
								caption: { type: 'string' },
							},
							additionalProperties: false,
						},
						step: { type: 'string', const: 'writeFiles' },
						writeToPath: {
							type: 'string',
							description: 'The path of the file to write to',
						},
						filesTree: {
							$ref: '#/definitions/DirectoryReference',
							description:
								"The 'filesTree' defines the directory structure, supporting 'literal:directory' or 'git:directory' types. The 'name' represents the root directory, while 'files' is an object where keys are file paths, and values contain either file content as a string or nested objects for subdirectories.",
						},
					},
					required: ['filesTree', 'step', 'writeToPath'],
				},
				{
					type: 'object',
					additionalProperties: false,
					properties: {
						progress: {
							type: 'object',
							properties: {
								weight: { type: 'number' },
								caption: { type: 'string' },
							},
							additionalProperties: false,
						},
						step: {
							type: 'string',
							const: 'wp-cli',
							description: 'The step identifier.',
						},
						command: {
							anyOf: [
								{ type: 'string' },
								{ type: 'array', items: { type: 'string' } },
							],
							description: 'The WP CLI command to run.',
						},
						wpCliPath: {
							type: 'string',
							description: 'wp-cli.phar path',
						},
					},
					required: ['command', 'step'],
				},
				{
					type: 'object',
					additionalProperties: false,
					properties: {
						progress: {
							type: 'object',
							properties: {
								weight: { type: 'number' },
								caption: { type: 'string' },
							},
							additionalProperties: false,
						},
						step: { type: 'string', const: 'setSiteLanguage' },
						language: {
							type: 'string',
							description: "The language to set, e.g. 'en_US'",
						},
					},
					required: ['language', 'step'],
				},
			],
		},
		InstallPluginOptions: {
			type: 'object',
			properties: {
				activate: {
					type: 'boolean',
					description:
						'Whether to activate the plugin after installing it.',
				},
				activationOptions: {
					type: 'object',
					additionalProperties: {},
					description:
						'Parameters to expose to the plugin during its activation hook.',
				},
				onError: {
					type: 'string',
					enum: ['skip-plugin', 'throw'],
					description:
						'Whether installation/activation failures should abort the Blueprint.',
				},
				targetFolderName: {
					type: 'string',
					description:
						'The name of the folder to install the plugin to. Defaults to guessing from pluginData',
				},
				humanReadableName: {
					type: 'string',
					description:
						'Human-readable plugin name for progress captions and skip warnings.',
				},
			},
			additionalProperties: false,
		},
		InstallThemeOptions: {
			type: 'object',
			properties: {
				activate: {
					type: 'boolean',
					description:
						'Whether to activate the theme after installing it.',
				},
				importStarterContent: {
					type: 'boolean',
					description:
						"Whether to import the theme's starter content after installing it.",
				},
				targetFolderName: {
					type: 'string',
					description:
						'The name of the folder to install the theme to. Defaults to guessing from themeData',
				},
			},
			additionalProperties: false,
		},
		PHPRequest: {
			type: 'object',
			properties: {
				method: {
					$ref: '#/definitions/HTTPMethod',
					description: 'Request method. Default: `GET`.',
				},
				url: {
					type: 'string',
					description: 'Request path or absolute URL.',
				},
				headers: {
					$ref: '#/definitions/PHPRequestHeaders',
					description: 'Request headers.',
				},
				body: {
					anyOf: [
						{ type: 'string' },
						{
							type: 'object',
							properties: {
								BYTES_PER_ELEMENT: { type: 'number' },
								buffer: {
									type: 'object',
									properties: {
										byteLength: { type: 'number' },
									},
									required: ['byteLength'],
									additionalProperties: false,
								},
								byteLength: { type: 'number' },
								byteOffset: { type: 'number' },
								length: { type: 'number' },
							},
							required: [
								'BYTES_PER_ELEMENT',
								'buffer',
								'byteLength',
								'byteOffset',
								'length',
							],
							additionalProperties: { type: 'number' },
						},
						{
							type: 'object',
							additionalProperties: {
								anyOf: [
									{ type: 'string' },
									{
										type: 'object',
										properties: {
											BYTES_PER_ELEMENT: {
												type: 'number',
											},
											buffer: {
												type: 'object',
												properties: {
													byteLength: {
														type: 'number',
													},
												},
												required: ['byteLength'],
												additionalProperties: false,
											},
											byteLength: { type: 'number' },
											byteOffset: { type: 'number' },
											length: { type: 'number' },
										},
										required: [
											'BYTES_PER_ELEMENT',
											'buffer',
											'byteLength',
											'byteOffset',
											'length',
										],
										additionalProperties: {
											type: 'number',
										},
									},
									{
										type: 'object',
										properties: {
											size: { type: 'number' },
											type: { type: 'string' },
											lastModified: { type: 'number' },
											name: { type: 'string' },
											webkitRelativePath: {
												type: 'string',
											},
										},
										required: [
											'lastModified',
											'name',
											'size',
											'type',
											'webkitRelativePath',
										],
										additionalProperties: false,
									},
								],
							},
						},
					],
					description:
						'Request body. If an object is given, the request will be encoded as multipart and sent with a `multipart/form-data` header.',
				},
			},
			required: ['url'],
			additionalProperties: false,
		},
		HTTPMethod: {
			type: 'string',
			enum: ['GET', 'POST', 'HEAD', 'OPTIONS', 'PATCH', 'PUT', 'DELETE'],
		},
		PHPRequestHeaders: {
			type: 'object',
			additionalProperties: { type: 'string' },
		},
		PHPRunOptions: {
			type: 'object',
			properties: {
				relativeUri: {
					type: 'string',
					description:
						'Request path following the domain:port part – after any URL rewriting rules (e.g. apache .htaccess) have been applied.',
				},
				scriptPath: {
					type: 'string',
					description: 'Path of the .php file to execute.',
				},
				protocol: { type: 'string', description: 'Request protocol.' },
				method: {
					$ref: '#/definitions/HTTPMethod',
					description: 'Request method. Default: `GET`.',
				},
				headers: {
					$ref: '#/definitions/PHPRequestHeaders',
					description: 'Request headers.',
				},
				body: {
					anyOf: [
						{ type: 'string' },
						{
							type: 'object',
							properties: {
								BYTES_PER_ELEMENT: { type: 'number' },
								buffer: {
									type: 'object',
									properties: {
										byteLength: { type: 'number' },
									},
									required: ['byteLength'],
									additionalProperties: false,
								},
								byteLength: { type: 'number' },
								byteOffset: { type: 'number' },
								length: { type: 'number' },
							},
							required: [
								'BYTES_PER_ELEMENT',
								'buffer',
								'byteLength',
								'byteOffset',
								'length',
							],
							additionalProperties: { type: 'number' },
						},
					],
					description: 'Request body.',
				},
				env: {
					type: 'object',
					additionalProperties: { type: 'string' },
					description: 'Environment variables to set for this run.',
				},
				$_SERVER: {
					type: 'object',
					additionalProperties: { type: 'string' },
					description: '$_SERVER entries to set for this run.',
				},
				code: {
					type: 'string',
					description:
						'The code snippet to eval instead of a php file.',
				},
			},
			additionalProperties: false,
		},
		WordPressInstallationOptions: {
			type: 'object',
			properties: {
				adminUsername: { type: 'string' },
				adminPassword: { type: 'string' },
			},
			additionalProperties: false,
		},
	},
};
const schema12 = {
	type: 'object',
	properties: {
		landingPage: {
			type: 'string',
			description:
				'The URL to navigate to after the blueprint has been run.',
		},
		description: {
			type: 'string',
			description:
				"Optional description. It doesn't do anything but is exposed as a courtesy to developers who may want to document which blueprint file does what.",
			deprecated: 'Use meta.description instead.',
		},
		meta: {
			type: 'object',
			properties: {
				title: {
					type: 'string',
					description: 'A clear and concise name for your Blueprint.',
				},
				description: {
					type: 'string',
					description:
						'A brief explanation of what your Blueprint offers.',
				},
				author: {
					type: 'string',
					description:
						'A GitHub username of the author of this Blueprint.',
				},
				categories: {
					type: 'array',
					items: { type: 'string' },
					description:
						'Relevant categories to help users find your Blueprint in the future Blueprints section on WordPress.org.',
				},
			},
			required: ['title', 'author'],
			additionalProperties: false,
			description:
				'Optional metadata. Used by the Blueprints gallery at https://github.com/WordPress/blueprints',
		},
		preferredVersions: {
			type: 'object',
			properties: {
				php: {
					anyOf: [
						{ $ref: '#/definitions/BlueprintPHPVersion' },
						{ type: 'string', const: 'latest' },
					],
					description:
						'The preferred PHP version to use. If not specified, the latest supported version will be used.\n\nNote: PHP 7.2 and 7.3 are deprecated and will be automatically upgraded to 7.4.',
				},
				wp: {
					anyOf: [
						{ type: 'string' },
						{ type: 'string', const: 'latest' },
						{ type: 'boolean', const: false },
					],
					description:
						'The preferred WordPress version to use, or `false` to boot a PHP-only Playground without downloading or installing WordPress. If not specified, the latest supported version will be used.\n\nWhen set to `false`, WordPress-specific Blueprint fields (`plugins`, `siteOptions`, `login`, and WordPress-only steps) are rejected at compile time.',
				},
			},
			required: ['php', 'wp'],
			additionalProperties: false,
			description: 'The preferred PHP and WordPress versions to use.',
		},
		features: {
			type: 'object',
			properties: {
				intl: {
					type: 'boolean',
					description:
						'Should boot with support for Intl dynamic extension',
				},
				networking: {
					type: 'boolean',
					description:
						'Should boot with support for network request via wp_safe_remote_get?',
				},
			},
			additionalProperties: false,
		},
		extraLibraries: {
			type: 'array',
			items: { $ref: '#/definitions/ExtraLibrary' },
			description:
				'Extra libraries to preload into the Playground instance.',
		},
		constants: {
			$ref: '#/definitions/PHPConstants',
			description: 'PHP Constants to define on every request',
		},
		plugins: {
			type: 'array',
			items: {
				anyOf: [
					{ type: 'string' },
					{ $ref: '#/definitions/FileReference' },
				],
			},
			description: 'WordPress plugins to install and activate',
		},
		siteOptions: {
			type: 'object',
			additionalProperties: { type: 'string' },
			properties: {
				blogname: { type: 'string', description: 'The site title' },
			},
			description: 'WordPress site options to define',
		},
		login: {
			anyOf: [
				{ type: 'boolean' },
				{
					type: 'object',
					properties: {
						username: { type: 'string' },
						password: { type: 'string' },
					},
					required: ['username', 'password'],
					additionalProperties: false,
				},
			],
			description:
				'User to log in as. If true, logs the user in as admin/password.',
		},
		phpExtensionBundles: {
			deprecated:
				'No longer used. Feel free to remove it from your Blueprint.',
		},
		steps: {
			type: 'array',
			items: {
				anyOf: [
					{ $ref: '#/definitions/StepDefinition' },
					{ type: 'string' },
					{ not: {} },
					{ type: 'boolean', const: false },
					{ type: 'null' },
				],
			},
			description:
				'The steps to run after every other operation in this Blueprint was executed.',
		},
		$schema: { type: 'string' },
	},
	additionalProperties: false,
	description:
		'The Blueprint declaration, typically stored in a blueprint.json file.',
};
const schema18 = { type: 'string', const: 'wp-cli' };
const schema19 = {
	type: 'object',
	additionalProperties: { type: ['string', 'boolean', 'number'] },
};
const func2 = Object.prototype.hasOwnProperty;
const schema13 = {
	anyOf: [
		{ $ref: '#/definitions/AllPHPVersion' },
		{ type: 'string', const: '7.2' },
		{ type: 'string', const: '7.3' },
	],
	description:
		'PHP versions accepted in Blueprint schema. Includes deprecated versions (7.2, 7.3) which are automatically upgraded to 7.4 during compilation.',
};
const schema14 = {
	anyOf: [
		{ $ref: '#/definitions/PHPNextVersion' },
		{ $ref: '#/definitions/SupportedPHPVersion' },
		{ $ref: '#/definitions/LegacyPHPVersion' },
	],
};
const schema15 = { type: 'string', const: 'next' };
const schema16 = {
	type: 'string',
	enum: ['8.5', '8.4', '8.3', '8.2', '8.1', '8.0', '7.4'],
};
const schema17 = { type: 'string', enum: ['5.2'] };
function validate13(
	data,
	{ instancePath = '', parentData, parentDataProperty, rootData = data } = {}
) {
	let vErrors = null;
	let errors = 0;
	const _errs0 = errors;
	let valid0 = false;
	const _errs1 = errors;
	if (typeof data !== 'string') {
		const err0 = {
			instancePath,
			schemaPath: '#/definitions/PHPNextVersion/type',
			keyword: 'type',
			params: { type: 'string' },
			message: 'must be string',
		};
		if (vErrors === null) {
			vErrors = [err0];
		} else {
			vErrors.push(err0);
		}
		errors++;
	}
	if ('next' !== data) {
		const err1 = {
			instancePath,
			schemaPath: '#/definitions/PHPNextVersion/const',
			keyword: 'const',
			params: { allowedValue: 'next' },
			message: 'must be equal to constant',
		};
		if (vErrors === null) {
			vErrors = [err1];
		} else {
			vErrors.push(err1);
		}
		errors++;
	}
	var _valid0 = _errs1 === errors;
	valid0 = valid0 || _valid0;
	if (!valid0) {
		const _errs4 = errors;
		if (typeof data !== 'string') {
			const err2 = {
				instancePath,
				schemaPath: '#/definitions/SupportedPHPVersion/type',
				keyword: 'type',
				params: { type: 'string' },
				message: 'must be string',
			};
			if (vErrors === null) {
				vErrors = [err2];
			} else {
				vErrors.push(err2);
			}
			errors++;
		}
		if (
			!(
				data === '8.5' ||
				data === '8.4' ||
				data === '8.3' ||
				data === '8.2' ||
				data === '8.1' ||
				data === '8.0' ||
				data === '7.4'
			)
		) {
			const err3 = {
				instancePath,
				schemaPath: '#/definitions/SupportedPHPVersion/enum',
				keyword: 'enum',
				params: { allowedValues: schema16.enum },
				message: 'must be equal to one of the allowed values',
			};
			if (vErrors === null) {
				vErrors = [err3];
			} else {
				vErrors.push(err3);
			}
			errors++;
		}
		var _valid0 = _errs4 === errors;
		valid0 = valid0 || _valid0;
		if (!valid0) {
			const _errs7 = errors;
			if (typeof data !== 'string') {
				const err4 = {
					instancePath,
					schemaPath: '#/definitions/LegacyPHPVersion/type',
					keyword: 'type',
					params: { type: 'string' },
					message: 'must be string',
				};
				if (vErrors === null) {
					vErrors = [err4];
				} else {
					vErrors.push(err4);
				}
				errors++;
			}
			if (!(data === '5.2')) {
				const err5 = {
					instancePath,
					schemaPath: '#/definitions/LegacyPHPVersion/enum',
					keyword: 'enum',
					params: { allowedValues: schema17.enum },
					message: 'must be equal to one of the allowed values',
				};
				if (vErrors === null) {
					vErrors = [err5];
				} else {
					vErrors.push(err5);
				}
				errors++;
			}
			var _valid0 = _errs7 === errors;
			valid0 = valid0 || _valid0;
		}
	}
	if (!valid0) {
		const err6 = {
			instancePath,
			schemaPath: '#/anyOf',
			keyword: 'anyOf',
			params: {},
			message: 'must match a schema in anyOf',
		};
		if (vErrors === null) {
			vErrors = [err6];
		} else {
			vErrors.push(err6);
		}
		errors++;
		validate13.errors = vErrors;
		return false;
	} else {
		errors = _errs0;
		if (vErrors !== null) {
			if (_errs0) {
				vErrors.length = _errs0;
			} else {
				vErrors = null;
			}
		}
	}
	validate13.errors = vErrors;
	return errors === 0;
}
function validate12(
	data,
	{ instancePath = '', parentData, parentDataProperty, rootData = data } = {}
) {
	let vErrors = null;
	let errors = 0;
	const _errs0 = errors;
	let valid0 = false;
	const _errs1 = errors;
	if (
		!validate13(data, {
			instancePath,
			parentData,
			parentDataProperty,
			rootData,
		})
	) {
		vErrors =
			vErrors === null
				? validate13.errors
				: vErrors.concat(validate13.errors);
		errors = vErrors.length;
	}
	var _valid0 = _errs1 === errors;
	valid0 = valid0 || _valid0;
	if (!valid0) {
		const _errs2 = errors;
		if (typeof data !== 'string') {
			const err0 = {
				instancePath,
				schemaPath: '#/anyOf/1/type',
				keyword: 'type',
				params: { type: 'string' },
				message: 'must be string',
			};
			if (vErrors === null) {
				vErrors = [err0];
			} else {
				vErrors.push(err0);
			}
			errors++;
		}
		if ('7.2' !== data) {
			const err1 = {
				instancePath,
				schemaPath: '#/anyOf/1/const',
				keyword: 'const',
				params: { allowedValue: '7.2' },
				message: 'must be equal to constant',
			};
			if (vErrors === null) {
				vErrors = [err1];
			} else {
				vErrors.push(err1);
			}
			errors++;
		}
		var _valid0 = _errs2 === errors;
		valid0 = valid0 || _valid0;
		if (!valid0) {
			const _errs4 = errors;
			if (typeof data !== 'string') {
				const err2 = {
					instancePath,
					schemaPath: '#/anyOf/2/type',
					keyword: 'type',
					params: { type: 'string' },
					message: 'must be string',
				};
				if (vErrors === null) {
					vErrors = [err2];
				} else {
					vErrors.push(err2);
				}
				errors++;
			}
			if ('7.3' !== data) {
				const err3 = {
					instancePath,
					schemaPath: '#/anyOf/2/const',
					keyword: 'const',
					params: { allowedValue: '7.3' },
					message: 'must be equal to constant',
				};
				if (vErrors === null) {
					vErrors = [err3];
				} else {
					vErrors.push(err3);
				}
				errors++;
			}
			var _valid0 = _errs4 === errors;
			valid0 = valid0 || _valid0;
		}
	}
	if (!valid0) {
		const err4 = {
			instancePath,
			schemaPath: '#/anyOf',
			keyword: 'anyOf',
			params: {},
			message: 'must match a schema in anyOf',
		};
		if (vErrors === null) {
			vErrors = [err4];
		} else {
			vErrors.push(err4);
		}
		errors++;
		validate12.errors = vErrors;
		return false;
	} else {
		errors = _errs0;
		if (vErrors !== null) {
			if (_errs0) {
				vErrors.length = _errs0;
			} else {
				vErrors = null;
			}
		}
	}
	validate12.errors = vErrors;
	return errors === 0;
}
const schema20 = {
	anyOf: [
		{ $ref: '#/definitions/VFSReference' },
		{ $ref: '#/definitions/LiteralReference' },
		{ $ref: '#/definitions/CoreThemeReference' },
		{ $ref: '#/definitions/CorePluginReference' },
		{ $ref: '#/definitions/UrlReference' },
		{ $ref: '#/definitions/BundledReference' },
		{ $ref: '#/definitions/ZipWrapperReference' },
	],
};
const schema21 = {
	type: 'object',
	properties: {
		resource: {
			type: 'string',
			const: 'vfs',
			description:
				'Identifies the file resource as Virtual File System (VFS)',
		},
		path: {
			type: 'string',
			description: 'The path to the file in the VFS',
		},
	},
	required: ['resource', 'path'],
	additionalProperties: false,
};
const schema22 = {
	type: 'object',
	properties: {
		resource: {
			type: 'string',
			const: 'literal',
			description: 'Identifies the file resource as a literal file',
		},
		name: { type: 'string', description: 'The name of the file' },
		contents: {
			anyOf: [
				{ type: 'string' },
				{
					type: 'object',
					properties: {
						BYTES_PER_ELEMENT: { type: 'number' },
						buffer: {
							type: 'object',
							properties: { byteLength: { type: 'number' } },
							required: ['byteLength'],
							additionalProperties: false,
						},
						byteLength: { type: 'number' },
						byteOffset: { type: 'number' },
						length: { type: 'number' },
					},
					required: [
						'BYTES_PER_ELEMENT',
						'buffer',
						'byteLength',
						'byteOffset',
						'length',
					],
					additionalProperties: { type: 'number' },
				},
			],
			description: 'The contents of the file',
		},
	},
	required: ['resource', 'name', 'contents'],
	additionalProperties: false,
};
const schema23 = {
	type: 'object',
	properties: {
		resource: {
			type: 'string',
			const: 'wordpress.org/themes',
			description:
				'Identifies the file resource as a WordPress Core theme',
		},
		slug: {
			type: 'string',
			description: 'The slug of the WordPress Core theme',
		},
	},
	required: ['resource', 'slug'],
	additionalProperties: false,
};
const schema24 = {
	type: 'object',
	properties: {
		resource: {
			type: 'string',
			const: 'wordpress.org/plugins',
			description:
				'Identifies the file resource as a WordPress Core plugin',
		},
		slug: {
			type: 'string',
			description: 'The slug of the WordPress Core plugin',
		},
	},
	required: ['resource', 'slug'],
	additionalProperties: false,
};
const schema25 = {
	type: 'object',
	properties: {
		resource: {
			type: 'string',
			const: 'url',
			description: 'Identifies the file resource as a URL',
		},
		url: { type: 'string', description: 'The URL of the file' },
		caption: {
			type: 'string',
			description: 'Optional caption for displaying a progress message',
		},
	},
	required: ['resource', 'url'],
	additionalProperties: false,
};
const schema26 = {
	type: 'object',
	properties: {
		resource: {
			type: 'string',
			const: 'bundled',
			description: 'Identifies the file resource as a Blueprint file',
		},
		path: {
			type: 'string',
			description: 'The path to the file in the Blueprint',
		},
	},
	required: ['resource', 'path'],
	additionalProperties: false,
};
const schema27 = {
	type: 'object',
	properties: {
		resource: {
			type: 'string',
			const: 'zip',
			description: 'Identifies the resource as a ZIP wrapper',
		},
		inner: {
			anyOf: [
				{ $ref: '#/definitions/FileReference' },
				{ $ref: '#/definitions/DirectoryReference' },
			],
			description: 'The inner resource to wrap in a ZIP file',
		},
		name: {
			type: 'string',
			description:
				'Optional filename for the ZIP (defaults to inner resource name + .zip)',
		},
	},
	required: ['resource', 'inner'],
	additionalProperties: false,
};
const wrapper0 = { validate: validate16 };
const schema28 = {
	anyOf: [
		{ $ref: '#/definitions/GitDirectoryReference' },
		{ $ref: '#/definitions/DirectoryLiteralReference' },
	],
};
const schema29 = {
	type: 'object',
	properties: {
		resource: {
			type: 'string',
			const: 'git:directory',
			description: 'Identifies the file resource as a git directory',
		},
		url: { type: 'string', description: 'The URL of the git repository' },
		ref: {
			type: 'string',
			description:
				'The ref (branch, tag, or commit) of the git repository',
		},
		refType: {
			$ref: '#/definitions/GitDirectoryRefType',
			description:
				'Explicit hint about the ref type (branch, tag, commit, refname)',
		},
		path: {
			type: 'string',
			description:
				'The path to the directory in the git repository. Defaults to the repo root.',
		},
		'.git': {
			type: 'boolean',
			description:
				'When true, include a `.git` directory with Git metadata (experimental).',
		},
	},
	required: ['resource', 'url', 'ref'],
	additionalProperties: false,
};
const schema30 = {
	type: 'string',
	enum: ['branch', 'tag', 'commit', 'refname'],
};
function validate19(
	data,
	{ instancePath = '', parentData, parentDataProperty, rootData = data } = {}
) {
	let vErrors = null;
	let errors = 0;
	if (errors === 0) {
		if (data && typeof data == 'object' && !Array.isArray(data)) {
			let missing0;
			if (
				(data.resource === undefined && (missing0 = 'resource')) ||
				(data.url === undefined && (missing0 = 'url')) ||
				(data.ref === undefined && (missing0 = 'ref'))
			) {
				validate19.errors = [
					{
						instancePath,
						schemaPath: '#/required',
						keyword: 'required',
						params: { missingProperty: missing0 },
						message:
							"must have required property '" + missing0 + "'",
					},
				];
				return false;
			} else {
				const _errs1 = errors;
				for (const key0 in data) {
					if (
						!(
							key0 === 'resource' ||
							key0 === 'url' ||
							key0 === 'ref' ||
							key0 === 'refType' ||
							key0 === 'path' ||
							key0 === '.git'
						)
					) {
						validate19.errors = [
							{
								instancePath,
								schemaPath: '#/additionalProperties',
								keyword: 'additionalProperties',
								params: { additionalProperty: key0 },
								message: 'must NOT have additional properties',
							},
						];
						return false;
						break;
					}
				}
				if (_errs1 === errors) {
					if (data.resource !== undefined) {
						let data0 = data.resource;
						const _errs2 = errors;
						if (typeof data0 !== 'string') {
							validate19.errors = [
								{
									instancePath: instancePath + '/resource',
									schemaPath: '#/properties/resource/type',
									keyword: 'type',
									params: { type: 'string' },
									message: 'must be string',
								},
							];
							return false;
						}
						if ('git:directory' !== data0) {
							validate19.errors = [
								{
									instancePath: instancePath + '/resource',
									schemaPath: '#/properties/resource/const',
									keyword: 'const',
									params: { allowedValue: 'git:directory' },
									message: 'must be equal to constant',
								},
							];
							return false;
						}
						var valid0 = _errs2 === errors;
					} else {
						var valid0 = true;
					}
					if (valid0) {
						if (data.url !== undefined) {
							const _errs4 = errors;
							if (typeof data.url !== 'string') {
								validate19.errors = [
									{
										instancePath: instancePath + '/url',
										schemaPath: '#/properties/url/type',
										keyword: 'type',
										params: { type: 'string' },
										message: 'must be string',
									},
								];
								return false;
							}
							var valid0 = _errs4 === errors;
						} else {
							var valid0 = true;
						}
						if (valid0) {
							if (data.ref !== undefined) {
								const _errs6 = errors;
								if (typeof data.ref !== 'string') {
									validate19.errors = [
										{
											instancePath: instancePath + '/ref',
											schemaPath: '#/properties/ref/type',
											keyword: 'type',
											params: { type: 'string' },
											message: 'must be string',
										},
									];
									return false;
								}
								var valid0 = _errs6 === errors;
							} else {
								var valid0 = true;
							}
							if (valid0) {
								if (data.refType !== undefined) {
									let data3 = data.refType;
									const _errs8 = errors;
									if (typeof data3 !== 'string') {
										validate19.errors = [
											{
												instancePath:
													instancePath + '/refType',
												schemaPath:
													'#/definitions/GitDirectoryRefType/type',
												keyword: 'type',
												params: { type: 'string' },
												message: 'must be string',
											},
										];
										return false;
									}
									if (
										!(
											data3 === 'branch' ||
											data3 === 'tag' ||
											data3 === 'commit' ||
											data3 === 'refname'
										)
									) {
										validate19.errors = [
											{
												instancePath:
													instancePath + '/refType',
												schemaPath:
													'#/definitions/GitDirectoryRefType/enum',
												keyword: 'enum',
												params: {
													allowedValues:
														schema30.enum,
												},
												message:
													'must be equal to one of the allowed values',
											},
										];
										return false;
									}
									var valid0 = _errs8 === errors;
								} else {
									var valid0 = true;
								}
								if (valid0) {
									if (data.path !== undefined) {
										const _errs11 = errors;
										if (typeof data.path !== 'string') {
											validate19.errors = [
												{
													instancePath:
														instancePath + '/path',
													schemaPath:
														'#/properties/path/type',
													keyword: 'type',
													params: { type: 'string' },
													message: 'must be string',
												},
											];
											return false;
										}
										var valid0 = _errs11 === errors;
									} else {
										var valid0 = true;
									}
									if (valid0) {
										if (data['.git'] !== undefined) {
											const _errs13 = errors;
											if (
												typeof data['.git'] !==
												'boolean'
											) {
												validate19.errors = [
													{
														instancePath:
															instancePath +
															'/.git',
														schemaPath:
															'#/properties/.git/type',
														keyword: 'type',
														params: {
															type: 'boolean',
														},
														message:
															'must be boolean',
													},
												];
												return false;
											}
											var valid0 = _errs13 === errors;
										} else {
											var valid0 = true;
										}
									}
								}
							}
						}
					}
				}
			}
		} else {
			validate19.errors = [
				{
					instancePath,
					schemaPath: '#/type',
					keyword: 'type',
					params: { type: 'object' },
					message: 'must be object',
				},
			];
			return false;
		}
	}
	validate19.errors = vErrors;
	return errors === 0;
}
const schema31 = {
	type: 'object',
	additionalProperties: false,
	properties: {
		resource: {
			type: 'string',
			const: 'literal:directory',
			description: 'Identifies the file resource as a git directory',
		},
		files: { $ref: '#/definitions/FileTree' },
		name: { type: 'string' },
	},
	required: ['files', 'name', 'resource'],
};
const schema32 = {
	type: 'object',
	additionalProperties: {
		anyOf: [
			{ $ref: '#/definitions/FileTree' },
			{ type: ['object', 'string'] },
		],
	},
	properties: {},
};
const wrapper1 = { validate: validate22 };
function validate22(
	data,
	{ instancePath = '', parentData, parentDataProperty, rootData = data } = {}
) {
	let vErrors = null;
	let errors = 0;
	if (errors === 0) {
		if (data && typeof data == 'object' && !Array.isArray(data)) {
			for (const key0 in data) {
				let data0 = data[key0];
				const _errs2 = errors;
				const _errs3 = errors;
				let valid1 = false;
				const _errs4 = errors;
				if (
					!wrapper1.validate(data0, {
						instancePath:
							instancePath +
							'/' +
							key0.replace(/~/g, '~0').replace(/\//g, '~1'),
						parentData: data,
						parentDataProperty: key0,
						rootData,
					})
				) {
					vErrors =
						vErrors === null
							? wrapper1.validate.errors
							: vErrors.concat(wrapper1.validate.errors);
					errors = vErrors.length;
				}
				var _valid0 = _errs4 === errors;
				valid1 = valid1 || _valid0;
				if (!valid1) {
					const _errs5 = errors;
					if (
						!(
							data0 &&
							typeof data0 == 'object' &&
							!Array.isArray(data0)
						) &&
						typeof data0 !== 'string'
					) {
						const err0 = {
							instancePath:
								instancePath +
								'/' +
								key0.replace(/~/g, '~0').replace(/\//g, '~1'),
							schemaPath: '#/additionalProperties/anyOf/1/type',
							keyword: 'type',
							params: {
								type: schema32.additionalProperties.anyOf[1]
									.type,
							},
							message: 'must be object,string',
						};
						if (vErrors === null) {
							vErrors = [err0];
						} else {
							vErrors.push(err0);
						}
						errors++;
					}
					var _valid0 = _errs5 === errors;
					valid1 = valid1 || _valid0;
				}
				if (!valid1) {
					const err1 = {
						instancePath:
							instancePath +
							'/' +
							key0.replace(/~/g, '~0').replace(/\//g, '~1'),
						schemaPath: '#/additionalProperties/anyOf',
						keyword: 'anyOf',
						params: {},
						message: 'must match a schema in anyOf',
					};
					if (vErrors === null) {
						vErrors = [err1];
					} else {
						vErrors.push(err1);
					}
					errors++;
					validate22.errors = vErrors;
					return false;
				} else {
					errors = _errs3;
					if (vErrors !== null) {
						if (_errs3) {
							vErrors.length = _errs3;
						} else {
							vErrors = null;
						}
					}
				}
				var valid0 = _errs2 === errors;
				if (!valid0) {
					break;
				}
			}
		} else {
			validate22.errors = [
				{
					instancePath,
					schemaPath: '#/type',
					keyword: 'type',
					params: { type: 'object' },
					message: 'must be object',
				},
			];
			return false;
		}
	}
	validate22.errors = vErrors;
	return errors === 0;
}
function validate21(
	data,
	{ instancePath = '', parentData, parentDataProperty, rootData = data } = {}
) {
	let vErrors = null;
	let errors = 0;
	if (errors === 0) {
		if (data && typeof data == 'object' && !Array.isArray(data)) {
			let missing0;
			if (
				(data.files === undefined && (missing0 = 'files')) ||
				(data.name === undefined && (missing0 = 'name')) ||
				(data.resource === undefined && (missing0 = 'resource'))
			) {
				validate21.errors = [
					{
						instancePath,
						schemaPath: '#/required',
						keyword: 'required',
						params: { missingProperty: missing0 },
						message:
							"must have required property '" + missing0 + "'",
					},
				];
				return false;
			} else {
				const _errs1 = errors;
				for (const key0 in data) {
					if (
						!(
							key0 === 'resource' ||
							key0 === 'files' ||
							key0 === 'name'
						)
					) {
						validate21.errors = [
							{
								instancePath,
								schemaPath: '#/additionalProperties',
								keyword: 'additionalProperties',
								params: { additionalProperty: key0 },
								message: 'must NOT have additional properties',
							},
						];
						return false;
						break;
					}
				}
				if (_errs1 === errors) {
					if (data.resource !== undefined) {
						let data0 = data.resource;
						const _errs2 = errors;
						if (typeof data0 !== 'string') {
							validate21.errors = [
								{
									instancePath: instancePath + '/resource',
									schemaPath: '#/properties/resource/type',
									keyword: 'type',
									params: { type: 'string' },
									message: 'must be string',
								},
							];
							return false;
						}
						if ('literal:directory' !== data0) {
							validate21.errors = [
								{
									instancePath: instancePath + '/resource',
									schemaPath: '#/properties/resource/const',
									keyword: 'const',
									params: {
										allowedValue: 'literal:directory',
									},
									message: 'must be equal to constant',
								},
							];
							return false;
						}
						var valid0 = _errs2 === errors;
					} else {
						var valid0 = true;
					}
					if (valid0) {
						if (data.files !== undefined) {
							const _errs4 = errors;
							if (
								!validate22(data.files, {
									instancePath: instancePath + '/files',
									parentData: data,
									parentDataProperty: 'files',
									rootData,
								})
							) {
								vErrors =
									vErrors === null
										? validate22.errors
										: vErrors.concat(validate22.errors);
								errors = vErrors.length;
							}
							var valid0 = _errs4 === errors;
						} else {
							var valid0 = true;
						}
						if (valid0) {
							if (data.name !== undefined) {
								const _errs5 = errors;
								if (typeof data.name !== 'string') {
									validate21.errors = [
										{
											instancePath:
												instancePath + '/name',
											schemaPath:
												'#/properties/name/type',
											keyword: 'type',
											params: { type: 'string' },
											message: 'must be string',
										},
									];
									return false;
								}
								var valid0 = _errs5 === errors;
							} else {
								var valid0 = true;
							}
						}
					}
				}
			}
		} else {
			validate21.errors = [
				{
					instancePath,
					schemaPath: '#/type',
					keyword: 'type',
					params: { type: 'object' },
					message: 'must be object',
				},
			];
			return false;
		}
	}
	validate21.errors = vErrors;
	return errors === 0;
}
function validate18(
	data,
	{ instancePath = '', parentData, parentDataProperty, rootData = data } = {}
) {
	let vErrors = null;
	let errors = 0;
	const _errs0 = errors;
	let valid0 = false;
	const _errs1 = errors;
	if (
		!validate19(data, {
			instancePath,
			parentData,
			parentDataProperty,
			rootData,
		})
	) {
		vErrors =
			vErrors === null
				? validate19.errors
				: vErrors.concat(validate19.errors);
		errors = vErrors.length;
	}
	var _valid0 = _errs1 === errors;
	valid0 = valid0 || _valid0;
	if (!valid0) {
		const _errs2 = errors;
		if (
			!validate21(data, {
				instancePath,
				parentData,
				parentDataProperty,
				rootData,
			})
		) {
			vErrors =
				vErrors === null
					? validate21.errors
					: vErrors.concat(validate21.errors);
			errors = vErrors.length;
		}
		var _valid0 = _errs2 === errors;
		valid0 = valid0 || _valid0;
	}
	if (!valid0) {
		const err0 = {
			instancePath,
			schemaPath: '#/anyOf',
			keyword: 'anyOf',
			params: {},
			message: 'must match a schema in anyOf',
		};
		if (vErrors === null) {
			vErrors = [err0];
		} else {
			vErrors.push(err0);
		}
		errors++;
		validate18.errors = vErrors;
		return false;
	} else {
		errors = _errs0;
		if (vErrors !== null) {
			if (_errs0) {
				vErrors.length = _errs0;
			} else {
				vErrors = null;
			}
		}
	}
	validate18.errors = vErrors;
	return errors === 0;
}
function validate17(
	data,
	{ instancePath = '', parentData, parentDataProperty, rootData = data } = {}
) {
	let vErrors = null;
	let errors = 0;
	if (errors === 0) {
		if (data && typeof data == 'object' && !Array.isArray(data)) {
			let missing0;
			if (
				(data.resource === undefined && (missing0 = 'resource')) ||
				(data.inner === undefined && (missing0 = 'inner'))
			) {
				validate17.errors = [
					{
						instancePath,
						schemaPath: '#/required',
						keyword: 'required',
						params: { missingProperty: missing0 },
						message:
							"must have required property '" + missing0 + "'",
					},
				];
				return false;
			} else {
				const _errs1 = errors;
				for (const key0 in data) {
					if (
						!(
							key0 === 'resource' ||
							key0 === 'inner' ||
							key0 === 'name'
						)
					) {
						validate17.errors = [
							{
								instancePath,
								schemaPath: '#/additionalProperties',
								keyword: 'additionalProperties',
								params: { additionalProperty: key0 },
								message: 'must NOT have additional properties',
							},
						];
						return false;
						break;
					}
				}
				if (_errs1 === errors) {
					if (data.resource !== undefined) {
						let data0 = data.resource;
						const _errs2 = errors;
						if (typeof data0 !== 'string') {
							validate17.errors = [
								{
									instancePath: instancePath + '/resource',
									schemaPath: '#/properties/resource/type',
									keyword: 'type',
									params: { type: 'string' },
									message: 'must be string',
								},
							];
							return false;
						}
						if ('zip' !== data0) {
							validate17.errors = [
								{
									instancePath: instancePath + '/resource',
									schemaPath: '#/properties/resource/const',
									keyword: 'const',
									params: { allowedValue: 'zip' },
									message: 'must be equal to constant',
								},
							];
							return false;
						}
						var valid0 = _errs2 === errors;
					} else {
						var valid0 = true;
					}
					if (valid0) {
						if (data.inner !== undefined) {
							let data1 = data.inner;
							const _errs4 = errors;
							const _errs5 = errors;
							let valid1 = false;
							const _errs6 = errors;
							if (
								!wrapper0.validate(data1, {
									instancePath: instancePath + '/inner',
									parentData: data,
									parentDataProperty: 'inner',
									rootData,
								})
							) {
								vErrors =
									vErrors === null
										? wrapper0.validate.errors
										: vErrors.concat(
												wrapper0.validate.errors
											);
								errors = vErrors.length;
							}
							var _valid0 = _errs6 === errors;
							valid1 = valid1 || _valid0;
							if (!valid1) {
								const _errs7 = errors;
								if (
									!validate18(data1, {
										instancePath: instancePath + '/inner',
										parentData: data,
										parentDataProperty: 'inner',
										rootData,
									})
								) {
									vErrors =
										vErrors === null
											? validate18.errors
											: vErrors.concat(validate18.errors);
									errors = vErrors.length;
								}
								var _valid0 = _errs7 === errors;
								valid1 = valid1 || _valid0;
							}
							if (!valid1) {
								const err0 = {
									instancePath: instancePath + '/inner',
									schemaPath: '#/properties/inner/anyOf',
									keyword: 'anyOf',
									params: {},
									message: 'must match a schema in anyOf',
								};
								if (vErrors === null) {
									vErrors = [err0];
								} else {
									vErrors.push(err0);
								}
								errors++;
								validate17.errors = vErrors;
								return false;
							} else {
								errors = _errs5;
								if (vErrors !== null) {
									if (_errs5) {
										vErrors.length = _errs5;
									} else {
										vErrors = null;
									}
								}
							}
							var valid0 = _errs4 === errors;
						} else {
							var valid0 = true;
						}
						if (valid0) {
							if (data.name !== undefined) {
								const _errs8 = errors;
								if (typeof data.name !== 'string') {
									validate17.errors = [
										{
											instancePath:
												instancePath + '/name',
											schemaPath:
												'#/properties/name/type',
											keyword: 'type',
											params: { type: 'string' },
											message: 'must be string',
										},
									];
									return false;
								}
								var valid0 = _errs8 === errors;
							} else {
								var valid0 = true;
							}
						}
					}
				}
			}
		} else {
			validate17.errors = [
				{
					instancePath,
					schemaPath: '#/type',
					keyword: 'type',
					params: { type: 'object' },
					message: 'must be object',
				},
			];
			return false;
		}
	}
	validate17.errors = vErrors;
	return errors === 0;
}
function validate16(
	data,
	{ instancePath = '', parentData, parentDataProperty, rootData = data } = {}
) {
	let vErrors = null;
	let errors = 0;
	const _errs0 = errors;
	let valid0 = false;
	const _errs1 = errors;
	const _errs2 = errors;
	if (errors === _errs2) {
		if (data && typeof data == 'object' && !Array.isArray(data)) {
			let missing0;
			if (
				(data.resource === undefined && (missing0 = 'resource')) ||
				(data.path === undefined && (missing0 = 'path'))
			) {
				const err0 = {
					instancePath,
					schemaPath: '#/definitions/VFSReference/required',
					keyword: 'required',
					params: { missingProperty: missing0 },
					message: "must have required property '" + missing0 + "'",
				};
				if (vErrors === null) {
					vErrors = [err0];
				} else {
					vErrors.push(err0);
				}
				errors++;
			} else {
				const _errs4 = errors;
				for (const key0 in data) {
					if (!(key0 === 'resource' || key0 === 'path')) {
						const err1 = {
							instancePath,
							schemaPath:
								'#/definitions/VFSReference/additionalProperties',
							keyword: 'additionalProperties',
							params: { additionalProperty: key0 },
							message: 'must NOT have additional properties',
						};
						if (vErrors === null) {
							vErrors = [err1];
						} else {
							vErrors.push(err1);
						}
						errors++;
						break;
					}
				}
				if (_errs4 === errors) {
					if (data.resource !== undefined) {
						let data0 = data.resource;
						const _errs5 = errors;
						if (typeof data0 !== 'string') {
							const err2 = {
								instancePath: instancePath + '/resource',
								schemaPath:
									'#/definitions/VFSReference/properties/resource/type',
								keyword: 'type',
								params: { type: 'string' },
								message: 'must be string',
							};
							if (vErrors === null) {
								vErrors = [err2];
							} else {
								vErrors.push(err2);
							}
							errors++;
						}
						if ('vfs' !== data0) {
							const err3 = {
								instancePath: instancePath + '/resource',
								schemaPath:
									'#/definitions/VFSReference/properties/resource/const',
								keyword: 'const',
								params: { allowedValue: 'vfs' },
								message: 'must be equal to constant',
							};
							if (vErrors === null) {
								vErrors = [err3];
							} else {
								vErrors.push(err3);
							}
							errors++;
						}
						var valid2 = _errs5 === errors;
					} else {
						var valid2 = true;
					}
					if (valid2) {
						if (data.path !== undefined) {
							const _errs7 = errors;
							if (typeof data.path !== 'string') {
								const err4 = {
									instancePath: instancePath + '/path',
									schemaPath:
										'#/definitions/VFSReference/properties/path/type',
									keyword: 'type',
									params: { type: 'string' },
									message: 'must be string',
								};
								if (vErrors === null) {
									vErrors = [err4];
								} else {
									vErrors.push(err4);
								}
								errors++;
							}
							var valid2 = _errs7 === errors;
						} else {
							var valid2 = true;
						}
					}
				}
			}
		} else {
			const err5 = {
				instancePath,
				schemaPath: '#/definitions/VFSReference/type',
				keyword: 'type',
				params: { type: 'object' },
				message: 'must be object',
			};
			if (vErrors === null) {
				vErrors = [err5];
			} else {
				vErrors.push(err5);
			}
			errors++;
		}
	}
	var _valid0 = _errs1 === errors;
	valid0 = valid0 || _valid0;
	if (!valid0) {
		const _errs9 = errors;
		const _errs10 = errors;
		if (errors === _errs10) {
			if (data && typeof data == 'object' && !Array.isArray(data)) {
				let missing1;
				if (
					(data.resource === undefined && (missing1 = 'resource')) ||
					(data.name === undefined && (missing1 = 'name')) ||
					(data.contents === undefined && (missing1 = 'contents'))
				) {
					const err6 = {
						instancePath,
						schemaPath: '#/definitions/LiteralReference/required',
						keyword: 'required',
						params: { missingProperty: missing1 },
						message:
							"must have required property '" + missing1 + "'",
					};
					if (vErrors === null) {
						vErrors = [err6];
					} else {
						vErrors.push(err6);
					}
					errors++;
				} else {
					const _errs12 = errors;
					for (const key1 in data) {
						if (
							!(
								key1 === 'resource' ||
								key1 === 'name' ||
								key1 === 'contents'
							)
						) {
							const err7 = {
								instancePath,
								schemaPath:
									'#/definitions/LiteralReference/additionalProperties',
								keyword: 'additionalProperties',
								params: { additionalProperty: key1 },
								message: 'must NOT have additional properties',
							};
							if (vErrors === null) {
								vErrors = [err7];
							} else {
								vErrors.push(err7);
							}
							errors++;
							break;
						}
					}
					if (_errs12 === errors) {
						if (data.resource !== undefined) {
							let data2 = data.resource;
							const _errs13 = errors;
							if (typeof data2 !== 'string') {
								const err8 = {
									instancePath: instancePath + '/resource',
									schemaPath:
										'#/definitions/LiteralReference/properties/resource/type',
									keyword: 'type',
									params: { type: 'string' },
									message: 'must be string',
								};
								if (vErrors === null) {
									vErrors = [err8];
								} else {
									vErrors.push(err8);
								}
								errors++;
							}
							if ('literal' !== data2) {
								const err9 = {
									instancePath: instancePath + '/resource',
									schemaPath:
										'#/definitions/LiteralReference/properties/resource/const',
									keyword: 'const',
									params: { allowedValue: 'literal' },
									message: 'must be equal to constant',
								};
								if (vErrors === null) {
									vErrors = [err9];
								} else {
									vErrors.push(err9);
								}
								errors++;
							}
							var valid4 = _errs13 === errors;
						} else {
							var valid4 = true;
						}
						if (valid4) {
							if (data.name !== undefined) {
								const _errs15 = errors;
								if (typeof data.name !== 'string') {
									const err10 = {
										instancePath: instancePath + '/name',
										schemaPath:
											'#/definitions/LiteralReference/properties/name/type',
										keyword: 'type',
										params: { type: 'string' },
										message: 'must be string',
									};
									if (vErrors === null) {
										vErrors = [err10];
									} else {
										vErrors.push(err10);
									}
									errors++;
								}
								var valid4 = _errs15 === errors;
							} else {
								var valid4 = true;
							}
							if (valid4) {
								if (data.contents !== undefined) {
									let data4 = data.contents;
									const _errs17 = errors;
									const _errs18 = errors;
									let valid5 = false;
									const _errs19 = errors;
									if (typeof data4 !== 'string') {
										const err11 = {
											instancePath:
												instancePath + '/contents',
											schemaPath:
												'#/definitions/LiteralReference/properties/contents/anyOf/0/type',
											keyword: 'type',
											params: { type: 'string' },
											message: 'must be string',
										};
										if (vErrors === null) {
											vErrors = [err11];
										} else {
											vErrors.push(err11);
										}
										errors++;
									}
									var _valid1 = _errs19 === errors;
									valid5 = valid5 || _valid1;
									if (!valid5) {
										const _errs21 = errors;
										if (errors === _errs21) {
											if (
												data4 &&
												typeof data4 == 'object' &&
												!Array.isArray(data4)
											) {
												let missing2;
												if (
													(data4.BYTES_PER_ELEMENT ===
														undefined &&
														(missing2 =
															'BYTES_PER_ELEMENT')) ||
													(data4.buffer ===
														undefined &&
														(missing2 =
															'buffer')) ||
													(data4.byteLength ===
														undefined &&
														(missing2 =
															'byteLength')) ||
													(data4.byteOffset ===
														undefined &&
														(missing2 =
															'byteOffset')) ||
													(data4.length ===
														undefined &&
														(missing2 = 'length'))
												) {
													const err12 = {
														instancePath:
															instancePath +
															'/contents',
														schemaPath:
															'#/definitions/LiteralReference/properties/contents/anyOf/1/required',
														keyword: 'required',
														params: {
															missingProperty:
																missing2,
														},
														message:
															"must have required property '" +
															missing2 +
															"'",
													};
													if (vErrors === null) {
														vErrors = [err12];
													} else {
														vErrors.push(err12);
													}
													errors++;
												} else {
													const _errs23 = errors;
													for (const key2 in data4) {
														if (
															!(
																key2 ===
																	'BYTES_PER_ELEMENT' ||
																key2 ===
																	'buffer' ||
																key2 ===
																	'byteLength' ||
																key2 ===
																	'byteOffset' ||
																key2 ===
																	'length'
															)
														) {
															let data5 =
																data4[key2];
															const _errs24 =
																errors;
															if (
																!(
																	typeof data5 ==
																		'number' &&
																	isFinite(
																		data5
																	)
																)
															) {
																const err13 = {
																	instancePath:
																		instancePath +
																		'/contents/' +
																		key2
																			.replace(
																				/~/g,
																				'~0'
																			)
																			.replace(
																				/\//g,
																				'~1'
																			),
																	schemaPath:
																		'#/definitions/LiteralReference/properties/contents/anyOf/1/additionalProperties/type',
																	keyword:
																		'type',
																	params: {
																		type: 'number',
																	},
																	message:
																		'must be number',
																};
																if (
																	vErrors ===
																	null
																) {
																	vErrors = [
																		err13,
																	];
																} else {
																	vErrors.push(
																		err13
																	);
																}
																errors++;
															}
															var valid6 =
																_errs24 ===
																errors;
															if (!valid6) {
																break;
															}
														}
													}
													if (_errs23 === errors) {
														if (
															data4.BYTES_PER_ELEMENT !==
															undefined
														) {
															let data6 =
																data4.BYTES_PER_ELEMENT;
															const _errs26 =
																errors;
															if (
																!(
																	typeof data6 ==
																		'number' &&
																	isFinite(
																		data6
																	)
																)
															) {
																const err14 = {
																	instancePath:
																		instancePath +
																		'/contents/BYTES_PER_ELEMENT',
																	schemaPath:
																		'#/definitions/LiteralReference/properties/contents/anyOf/1/properties/BYTES_PER_ELEMENT/type',
																	keyword:
																		'type',
																	params: {
																		type: 'number',
																	},
																	message:
																		'must be number',
																};
																if (
																	vErrors ===
																	null
																) {
																	vErrors = [
																		err14,
																	];
																} else {
																	vErrors.push(
																		err14
																	);
																}
																errors++;
															}
															var valid7 =
																_errs26 ===
																errors;
														} else {
															var valid7 = true;
														}
														if (valid7) {
															if (
																data4.buffer !==
																undefined
															) {
																let data7 =
																	data4.buffer;
																const _errs28 =
																	errors;
																if (
																	errors ===
																	_errs28
																) {
																	if (
																		data7 &&
																		typeof data7 ==
																			'object' &&
																		!Array.isArray(
																			data7
																		)
																	) {
																		let missing3;
																		if (
																			data7.byteLength ===
																				undefined &&
																			(missing3 =
																				'byteLength')
																		) {
																			const err15 =
																				{
																					instancePath:
																						instancePath +
																						'/contents/buffer',
																					schemaPath:
																						'#/definitions/LiteralReference/properties/contents/anyOf/1/properties/buffer/required',
																					keyword:
																						'required',
																					params: {
																						missingProperty:
																							missing3,
																					},
																					message:
																						"must have required property '" +
																						missing3 +
																						"'",
																				};
																			if (
																				vErrors ===
																				null
																			) {
																				vErrors =
																					[
																						err15,
																					];
																			} else {
																				vErrors.push(
																					err15
																				);
																			}
																			errors++;
																		} else {
																			const _errs30 =
																				errors;
																			for (const key3 in data7) {
																				if (
																					!(
																						key3 ===
																						'byteLength'
																					)
																				) {
																					const err16 =
																						{
																							instancePath:
																								instancePath +
																								'/contents/buffer',
																							schemaPath:
																								'#/definitions/LiteralReference/properties/contents/anyOf/1/properties/buffer/additionalProperties',
																							keyword:
																								'additionalProperties',
																							params: {
																								additionalProperty:
																									key3,
																							},
																							message:
																								'must NOT have additional properties',
																						};
																					if (
																						vErrors ===
																						null
																					) {
																						vErrors =
																							[
																								err16,
																							];
																					} else {
																						vErrors.push(
																							err16
																						);
																					}
																					errors++;
																					break;
																				}
																			}
																			if (
																				_errs30 ===
																				errors
																			) {
																				if (
																					data7.byteLength !==
																					undefined
																				) {
																					let data8 =
																						data7.byteLength;
																					if (
																						!(
																							typeof data8 ==
																								'number' &&
																							isFinite(
																								data8
																							)
																						)
																					) {
																						const err17 =
																							{
																								instancePath:
																									instancePath +
																									'/contents/buffer/byteLength',
																								schemaPath:
																									'#/definitions/LiteralReference/properties/contents/anyOf/1/properties/buffer/properties/byteLength/type',
																								keyword:
																									'type',
																								params: {
																									type: 'number',
																								},
																								message:
																									'must be number',
																							};
																						if (
																							vErrors ===
																							null
																						) {
																							vErrors =
																								[
																									err17,
																								];
																						} else {
																							vErrors.push(
																								err17
																							);
																						}
																						errors++;
																					}
																				}
																			}
																		}
																	} else {
																		const err18 =
																			{
																				instancePath:
																					instancePath +
																					'/contents/buffer',
																				schemaPath:
																					'#/definitions/LiteralReference/properties/contents/anyOf/1/properties/buffer/type',
																				keyword:
																					'type',
																				params: {
																					type: 'object',
																				},
																				message:
																					'must be object',
																			};
																		if (
																			vErrors ===
																			null
																		) {
																			vErrors =
																				[
																					err18,
																				];
																		} else {
																			vErrors.push(
																				err18
																			);
																		}
																		errors++;
																	}
																}
																var valid7 =
																	_errs28 ===
																	errors;
															} else {
																var valid7 = true;
															}
															if (valid7) {
																if (
																	data4.byteLength !==
																	undefined
																) {
																	let data9 =
																		data4.byteLength;
																	const _errs33 =
																		errors;
																	if (
																		!(
																			typeof data9 ==
																				'number' &&
																			isFinite(
																				data9
																			)
																		)
																	) {
																		const err19 =
																			{
																				instancePath:
																					instancePath +
																					'/contents/byteLength',
																				schemaPath:
																					'#/definitions/LiteralReference/properties/contents/anyOf/1/properties/byteLength/type',
																				keyword:
																					'type',
																				params: {
																					type: 'number',
																				},
																				message:
																					'must be number',
																			};
																		if (
																			vErrors ===
																			null
																		) {
																			vErrors =
																				[
																					err19,
																				];
																		} else {
																			vErrors.push(
																				err19
																			);
																		}
																		errors++;
																	}
																	var valid7 =
																		_errs33 ===
																		errors;
																} else {
																	var valid7 = true;
																}
																if (valid7) {
																	if (
																		data4.byteOffset !==
																		undefined
																	) {
																		let data10 =
																			data4.byteOffset;
																		const _errs35 =
																			errors;
																		if (
																			!(
																				typeof data10 ==
																					'number' &&
																				isFinite(
																					data10
																				)
																			)
																		) {
																			const err20 =
																				{
																					instancePath:
																						instancePath +
																						'/contents/byteOffset',
																					schemaPath:
																						'#/definitions/LiteralReference/properties/contents/anyOf/1/properties/byteOffset/type',
																					keyword:
																						'type',
																					params: {
																						type: 'number',
																					},
																					message:
																						'must be number',
																				};
																			if (
																				vErrors ===
																				null
																			) {
																				vErrors =
																					[
																						err20,
																					];
																			} else {
																				vErrors.push(
																					err20
																				);
																			}
																			errors++;
																		}
																		var valid7 =
																			_errs35 ===
																			errors;
																	} else {
																		var valid7 = true;
																	}
																	if (
																		valid7
																	) {
																		if (
																			data4.length !==
																			undefined
																		) {
																			let data11 =
																				data4.length;
																			const _errs37 =
																				errors;
																			if (
																				!(
																					typeof data11 ==
																						'number' &&
																					isFinite(
																						data11
																					)
																				)
																			) {
																				const err21 =
																					{
																						instancePath:
																							instancePath +
																							'/contents/length',
																						schemaPath:
																							'#/definitions/LiteralReference/properties/contents/anyOf/1/properties/length/type',
																						keyword:
																							'type',
																						params: {
																							type: 'number',
																						},
																						message:
																							'must be number',
																					};
																				if (
																					vErrors ===
																					null
																				) {
																					vErrors =
																						[
																							err21,
																						];
																				} else {
																					vErrors.push(
																						err21
																					);
																				}
																				errors++;
																			}
																			var valid7 =
																				_errs37 ===
																				errors;
																		} else {
																			var valid7 = true;
																		}
																	}
																}
															}
														}
													}
												}
											} else {
												const err22 = {
													instancePath:
														instancePath +
														'/contents',
													schemaPath:
														'#/definitions/LiteralReference/properties/contents/anyOf/1/type',
													keyword: 'type',
													params: { type: 'object' },
													message: 'must be object',
												};
												if (vErrors === null) {
													vErrors = [err22];
												} else {
													vErrors.push(err22);
												}
												errors++;
											}
										}
										var _valid1 = _errs21 === errors;
										valid5 = valid5 || _valid1;
									}
									if (!valid5) {
										const err23 = {
											instancePath:
												instancePath + '/contents',
											schemaPath:
												'#/definitions/LiteralReference/properties/contents/anyOf',
											keyword: 'anyOf',
											params: {},
											message:
												'must match a schema in anyOf',
										};
										if (vErrors === null) {
											vErrors = [err23];
										} else {
											vErrors.push(err23);
										}
										errors++;
									} else {
										errors = _errs18;
										if (vErrors !== null) {
											if (_errs18) {
												vErrors.length = _errs18;
											} else {
												vErrors = null;
											}
										}
									}
									var valid4 = _errs17 === errors;
								} else {
									var valid4 = true;
								}
							}
						}
					}
				}
			} else {
				const err24 = {
					instancePath,
					schemaPath: '#/definitions/LiteralReference/type',
					keyword: 'type',
					params: { type: 'object' },
					message: 'must be object',
				};
				if (vErrors === null) {
					vErrors = [err24];
				} else {
					vErrors.push(err24);
				}
				errors++;
			}
		}
		var _valid0 = _errs9 === errors;
		valid0 = valid0 || _valid0;
		if (!valid0) {
			const _errs39 = errors;
			const _errs40 = errors;
			if (errors === _errs40) {
				if (data && typeof data == 'object' && !Array.isArray(data)) {
					let missing4;
					if (
						(data.resource === undefined &&
							(missing4 = 'resource')) ||
						(data.slug === undefined && (missing4 = 'slug'))
					) {
						const err25 = {
							instancePath,
							schemaPath:
								'#/definitions/CoreThemeReference/required',
							keyword: 'required',
							params: { missingProperty: missing4 },
							message:
								"must have required property '" +
								missing4 +
								"'",
						};
						if (vErrors === null) {
							vErrors = [err25];
						} else {
							vErrors.push(err25);
						}
						errors++;
					} else {
						const _errs42 = errors;
						for (const key4 in data) {
							if (!(key4 === 'resource' || key4 === 'slug')) {
								const err26 = {
									instancePath,
									schemaPath:
										'#/definitions/CoreThemeReference/additionalProperties',
									keyword: 'additionalProperties',
									params: { additionalProperty: key4 },
									message:
										'must NOT have additional properties',
								};
								if (vErrors === null) {
									vErrors = [err26];
								} else {
									vErrors.push(err26);
								}
								errors++;
								break;
							}
						}
						if (_errs42 === errors) {
							if (data.resource !== undefined) {
								let data12 = data.resource;
								const _errs43 = errors;
								if (typeof data12 !== 'string') {
									const err27 = {
										instancePath:
											instancePath + '/resource',
										schemaPath:
											'#/definitions/CoreThemeReference/properties/resource/type',
										keyword: 'type',
										params: { type: 'string' },
										message: 'must be string',
									};
									if (vErrors === null) {
										vErrors = [err27];
									} else {
										vErrors.push(err27);
									}
									errors++;
								}
								if ('wordpress.org/themes' !== data12) {
									const err28 = {
										instancePath:
											instancePath + '/resource',
										schemaPath:
											'#/definitions/CoreThemeReference/properties/resource/const',
										keyword: 'const',
										params: {
											allowedValue:
												'wordpress.org/themes',
										},
										message: 'must be equal to constant',
									};
									if (vErrors === null) {
										vErrors = [err28];
									} else {
										vErrors.push(err28);
									}
									errors++;
								}
								var valid10 = _errs43 === errors;
							} else {
								var valid10 = true;
							}
							if (valid10) {
								if (data.slug !== undefined) {
									const _errs45 = errors;
									if (typeof data.slug !== 'string') {
										const err29 = {
											instancePath:
												instancePath + '/slug',
											schemaPath:
												'#/definitions/CoreThemeReference/properties/slug/type',
											keyword: 'type',
											params: { type: 'string' },
											message: 'must be string',
										};
										if (vErrors === null) {
											vErrors = [err29];
										} else {
											vErrors.push(err29);
										}
										errors++;
									}
									var valid10 = _errs45 === errors;
								} else {
									var valid10 = true;
								}
							}
						}
					}
				} else {
					const err30 = {
						instancePath,
						schemaPath: '#/definitions/CoreThemeReference/type',
						keyword: 'type',
						params: { type: 'object' },
						message: 'must be object',
					};
					if (vErrors === null) {
						vErrors = [err30];
					} else {
						vErrors.push(err30);
					}
					errors++;
				}
			}
			var _valid0 = _errs39 === errors;
			valid0 = valid0 || _valid0;
			if (!valid0) {
				const _errs47 = errors;
				const _errs48 = errors;
				if (errors === _errs48) {
					if (
						data &&
						typeof data == 'object' &&
						!Array.isArray(data)
					) {
						let missing5;
						if (
							(data.resource === undefined &&
								(missing5 = 'resource')) ||
							(data.slug === undefined && (missing5 = 'slug'))
						) {
							const err31 = {
								instancePath,
								schemaPath:
									'#/definitions/CorePluginReference/required',
								keyword: 'required',
								params: { missingProperty: missing5 },
								message:
									"must have required property '" +
									missing5 +
									"'",
							};
							if (vErrors === null) {
								vErrors = [err31];
							} else {
								vErrors.push(err31);
							}
							errors++;
						} else {
							const _errs50 = errors;
							for (const key5 in data) {
								if (!(key5 === 'resource' || key5 === 'slug')) {
									const err32 = {
										instancePath,
										schemaPath:
											'#/definitions/CorePluginReference/additionalProperties',
										keyword: 'additionalProperties',
										params: { additionalProperty: key5 },
										message:
											'must NOT have additional properties',
									};
									if (vErrors === null) {
										vErrors = [err32];
									} else {
										vErrors.push(err32);
									}
									errors++;
									break;
								}
							}
							if (_errs50 === errors) {
								if (data.resource !== undefined) {
									let data14 = data.resource;
									const _errs51 = errors;
									if (typeof data14 !== 'string') {
										const err33 = {
											instancePath:
												instancePath + '/resource',
											schemaPath:
												'#/definitions/CorePluginReference/properties/resource/type',
											keyword: 'type',
											params: { type: 'string' },
											message: 'must be string',
										};
										if (vErrors === null) {
											vErrors = [err33];
										} else {
											vErrors.push(err33);
										}
										errors++;
									}
									if ('wordpress.org/plugins' !== data14) {
										const err34 = {
											instancePath:
												instancePath + '/resource',
											schemaPath:
												'#/definitions/CorePluginReference/properties/resource/const',
											keyword: 'const',
											params: {
												allowedValue:
													'wordpress.org/plugins',
											},
											message:
												'must be equal to constant',
										};
										if (vErrors === null) {
											vErrors = [err34];
										} else {
											vErrors.push(err34);
										}
										errors++;
									}
									var valid12 = _errs51 === errors;
								} else {
									var valid12 = true;
								}
								if (valid12) {
									if (data.slug !== undefined) {
										const _errs53 = errors;
										if (typeof data.slug !== 'string') {
											const err35 = {
												instancePath:
													instancePath + '/slug',
												schemaPath:
													'#/definitions/CorePluginReference/properties/slug/type',
												keyword: 'type',
												params: { type: 'string' },
												message: 'must be string',
											};
											if (vErrors === null) {
												vErrors = [err35];
											} else {
												vErrors.push(err35);
											}
											errors++;
										}
										var valid12 = _errs53 === errors;
									} else {
										var valid12 = true;
									}
								}
							}
						}
					} else {
						const err36 = {
							instancePath,
							schemaPath:
								'#/definitions/CorePluginReference/type',
							keyword: 'type',
							params: { type: 'object' },
							message: 'must be object',
						};
						if (vErrors === null) {
							vErrors = [err36];
						} else {
							vErrors.push(err36);
						}
						errors++;
					}
				}
				var _valid0 = _errs47 === errors;
				valid0 = valid0 || _valid0;
				if (!valid0) {
					const _errs55 = errors;
					const _errs56 = errors;
					if (errors === _errs56) {
						if (
							data &&
							typeof data == 'object' &&
							!Array.isArray(data)
						) {
							let missing6;
							if (
								(data.resource === undefined &&
									(missing6 = 'resource')) ||
								(data.url === undefined && (missing6 = 'url'))
							) {
								const err37 = {
									instancePath,
									schemaPath:
										'#/definitions/UrlReference/required',
									keyword: 'required',
									params: { missingProperty: missing6 },
									message:
										"must have required property '" +
										missing6 +
										"'",
								};
								if (vErrors === null) {
									vErrors = [err37];
								} else {
									vErrors.push(err37);
								}
								errors++;
							} else {
								const _errs58 = errors;
								for (const key6 in data) {
									if (
										!(
											key6 === 'resource' ||
											key6 === 'url' ||
											key6 === 'caption'
										)
									) {
										const err38 = {
											instancePath,
											schemaPath:
												'#/definitions/UrlReference/additionalProperties',
											keyword: 'additionalProperties',
											params: {
												additionalProperty: key6,
											},
											message:
												'must NOT have additional properties',
										};
										if (vErrors === null) {
											vErrors = [err38];
										} else {
											vErrors.push(err38);
										}
										errors++;
										break;
									}
								}
								if (_errs58 === errors) {
									if (data.resource !== undefined) {
										let data16 = data.resource;
										const _errs59 = errors;
										if (typeof data16 !== 'string') {
											const err39 = {
												instancePath:
													instancePath + '/resource',
												schemaPath:
													'#/definitions/UrlReference/properties/resource/type',
												keyword: 'type',
												params: { type: 'string' },
												message: 'must be string',
											};
											if (vErrors === null) {
												vErrors = [err39];
											} else {
												vErrors.push(err39);
											}
											errors++;
										}
										if ('url' !== data16) {
											const err40 = {
												instancePath:
													instancePath + '/resource',
												schemaPath:
													'#/definitions/UrlReference/properties/resource/const',
												keyword: 'const',
												params: { allowedValue: 'url' },
												message:
													'must be equal to constant',
											};
											if (vErrors === null) {
												vErrors = [err40];
											} else {
												vErrors.push(err40);
											}
											errors++;
										}
										var valid14 = _errs59 === errors;
									} else {
										var valid14 = true;
									}
									if (valid14) {
										if (data.url !== undefined) {
											const _errs61 = errors;
											if (typeof data.url !== 'string') {
												const err41 = {
													instancePath:
														instancePath + '/url',
													schemaPath:
														'#/definitions/UrlReference/properties/url/type',
													keyword: 'type',
													params: { type: 'string' },
													message: 'must be string',
												};
												if (vErrors === null) {
													vErrors = [err41];
												} else {
													vErrors.push(err41);
												}
												errors++;
											}
											var valid14 = _errs61 === errors;
										} else {
											var valid14 = true;
										}
										if (valid14) {
											if (data.caption !== undefined) {
												const _errs63 = errors;
												if (
													typeof data.caption !==
													'string'
												) {
													const err42 = {
														instancePath:
															instancePath +
															'/caption',
														schemaPath:
															'#/definitions/UrlReference/properties/caption/type',
														keyword: 'type',
														params: {
															type: 'string',
														},
														message:
															'must be string',
													};
													if (vErrors === null) {
														vErrors = [err42];
													} else {
														vErrors.push(err42);
													}
													errors++;
												}
												var valid14 =
													_errs63 === errors;
											} else {
												var valid14 = true;
											}
										}
									}
								}
							}
						} else {
							const err43 = {
								instancePath,
								schemaPath: '#/definitions/UrlReference/type',
								keyword: 'type',
								params: { type: 'object' },
								message: 'must be object',
							};
							if (vErrors === null) {
								vErrors = [err43];
							} else {
								vErrors.push(err43);
							}
							errors++;
						}
					}
					var _valid0 = _errs55 === errors;
					valid0 = valid0 || _valid0;
					if (!valid0) {
						const _errs65 = errors;
						const _errs66 = errors;
						if (errors === _errs66) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing7;
								if (
									(data.resource === undefined &&
										(missing7 = 'resource')) ||
									(data.path === undefined &&
										(missing7 = 'path'))
								) {
									const err44 = {
										instancePath,
										schemaPath:
											'#/definitions/BundledReference/required',
										keyword: 'required',
										params: { missingProperty: missing7 },
										message:
											"must have required property '" +
											missing7 +
											"'",
									};
									if (vErrors === null) {
										vErrors = [err44];
									} else {
										vErrors.push(err44);
									}
									errors++;
								} else {
									const _errs68 = errors;
									for (const key7 in data) {
										if (
											!(
												key7 === 'resource' ||
												key7 === 'path'
											)
										) {
											const err45 = {
												instancePath,
												schemaPath:
													'#/definitions/BundledReference/additionalProperties',
												keyword: 'additionalProperties',
												params: {
													additionalProperty: key7,
												},
												message:
													'must NOT have additional properties',
											};
											if (vErrors === null) {
												vErrors = [err45];
											} else {
												vErrors.push(err45);
											}
											errors++;
											break;
										}
									}
									if (_errs68 === errors) {
										if (data.resource !== undefined) {
											let data19 = data.resource;
											const _errs69 = errors;
											if (typeof data19 !== 'string') {
												const err46 = {
													instancePath:
														instancePath +
														'/resource',
													schemaPath:
														'#/definitions/BundledReference/properties/resource/type',
													keyword: 'type',
													params: { type: 'string' },
													message: 'must be string',
												};
												if (vErrors === null) {
													vErrors = [err46];
												} else {
													vErrors.push(err46);
												}
												errors++;
											}
											if ('bundled' !== data19) {
												const err47 = {
													instancePath:
														instancePath +
														'/resource',
													schemaPath:
														'#/definitions/BundledReference/properties/resource/const',
													keyword: 'const',
													params: {
														allowedValue: 'bundled',
													},
													message:
														'must be equal to constant',
												};
												if (vErrors === null) {
													vErrors = [err47];
												} else {
													vErrors.push(err47);
												}
												errors++;
											}
											var valid16 = _errs69 === errors;
										} else {
											var valid16 = true;
										}
										if (valid16) {
											if (data.path !== undefined) {
												const _errs71 = errors;
												if (
													typeof data.path !==
													'string'
												) {
													const err48 = {
														instancePath:
															instancePath +
															'/path',
														schemaPath:
															'#/definitions/BundledReference/properties/path/type',
														keyword: 'type',
														params: {
															type: 'string',
														},
														message:
															'must be string',
													};
													if (vErrors === null) {
														vErrors = [err48];
													} else {
														vErrors.push(err48);
													}
													errors++;
												}
												var valid16 =
													_errs71 === errors;
											} else {
												var valid16 = true;
											}
										}
									}
								}
							} else {
								const err49 = {
									instancePath,
									schemaPath:
										'#/definitions/BundledReference/type',
									keyword: 'type',
									params: { type: 'object' },
									message: 'must be object',
								};
								if (vErrors === null) {
									vErrors = [err49];
								} else {
									vErrors.push(err49);
								}
								errors++;
							}
						}
						var _valid0 = _errs65 === errors;
						valid0 = valid0 || _valid0;
						if (!valid0) {
							const _errs73 = errors;
							if (
								!validate17(data, {
									instancePath,
									parentData,
									parentDataProperty,
									rootData,
								})
							) {
								vErrors =
									vErrors === null
										? validate17.errors
										: vErrors.concat(validate17.errors);
								errors = vErrors.length;
							}
							var _valid0 = _errs73 === errors;
							valid0 = valid0 || _valid0;
						}
					}
				}
			}
		}
	}
	if (!valid0) {
		const err50 = {
			instancePath,
			schemaPath: '#/anyOf',
			keyword: 'anyOf',
			params: {},
			message: 'must match a schema in anyOf',
		};
		if (vErrors === null) {
			vErrors = [err50];
		} else {
			vErrors.push(err50);
		}
		errors++;
		validate16.errors = vErrors;
		return false;
	} else {
		errors = _errs0;
		if (vErrors !== null) {
			if (_errs0) {
				vErrors.length = _errs0;
			} else {
				vErrors = null;
			}
		}
	}
	validate16.errors = vErrors;
	return errors === 0;
}
const schema33 = {
	type: 'object',
	discriminator: { propertyName: 'step' },
	required: ['step'],
	oneOf: [
		{
			type: 'object',
			additionalProperties: false,
			properties: {
				progress: {
					type: 'object',
					properties: {
						weight: { type: 'number' },
						caption: { type: 'string' },
					},
					additionalProperties: false,
				},
				step: { type: 'string', const: 'activatePlugin' },
				pluginPath: {
					type: 'string',
					description:
						'Path to the plugin directory as absolute path (/wordpress/wp-content/plugins/plugin-name); or the plugin entry file relative to the plugins directory (plugin-name/plugin-name.php).',
				},
				pluginName: {
					type: 'string',
					description:
						'Optional. Plugin name to display in the progress bar.',
				},
			},
			required: ['pluginPath', 'step'],
		},
		{
			type: 'object',
			additionalProperties: false,
			properties: {
				progress: {
					type: 'object',
					properties: {
						weight: { type: 'number' },
						caption: { type: 'string' },
					},
					additionalProperties: false,
				},
				step: { type: 'string', const: 'activateTheme' },
				themeFolderName: {
					type: 'string',
					description:
						'The name of the theme folder inside wp-content/themes/',
				},
			},
			required: ['step', 'themeFolderName'],
		},
		{
			type: 'object',
			additionalProperties: false,
			properties: {
				progress: {
					type: 'object',
					properties: {
						weight: { type: 'number' },
						caption: { type: 'string' },
					},
					additionalProperties: false,
				},
				step: { type: 'string', const: 'cp' },
				fromPath: { type: 'string', description: 'Source path' },
				toPath: { type: 'string', description: 'Target path' },
			},
			required: ['fromPath', 'step', 'toPath'],
		},
		{
			type: 'object',
			additionalProperties: false,
			properties: {
				progress: {
					type: 'object',
					properties: {
						weight: { type: 'number' },
						caption: { type: 'string' },
					},
					additionalProperties: false,
				},
				step: { type: 'string', const: 'defineWpConfigConsts' },
				consts: {
					type: 'object',
					additionalProperties: {},
					description: 'The constants to define',
				},
				method: {
					type: 'string',
					enum: ['rewrite-wp-config', 'define-before-run'],
					description:
						"The method of defining the constants in wp-config.php. Possible values are:\n\n- rewrite-wp-config: Default. Rewrites the wp-config.php file to                      explicitly call define() with the requested                      name and value. This method alters the file                      on the disk, but it doesn't conflict with                      existing define() calls in wp-config.php.\n\n- define-before-run: Defines the constant before running the requested                      script. It doesn't alter any files on the disk, but                      constants defined this way may conflict with existing                      define() calls in wp-config.php.",
				},
				virtualize: {
					type: 'boolean',
					deprecated:
						'This option is noop and will be removed in a future version.\nThis option is only kept in here to avoid breaking Blueprint schema validation\nfor existing apps using this option.',
				},
			},
			required: ['consts', 'step'],
		},
		{
			type: 'object',
			additionalProperties: false,
			properties: {
				progress: {
					type: 'object',
					properties: {
						weight: { type: 'number' },
						caption: { type: 'string' },
					},
					additionalProperties: false,
				},
				step: { type: 'string', const: 'defineSiteUrl' },
				siteUrl: { type: 'string', description: 'The URL' },
			},
			required: ['siteUrl', 'step'],
		},
		{
			type: 'object',
			additionalProperties: false,
			properties: {
				progress: {
					type: 'object',
					properties: {
						weight: { type: 'number' },
						caption: { type: 'string' },
					},
					additionalProperties: false,
				},
				step: { type: 'string', const: 'enableMultisite' },
				wpCliPath: { type: 'string', description: 'wp-cli.phar path' },
			},
			required: ['step'],
		},
		{
			type: 'object',
			additionalProperties: false,
			properties: {
				progress: {
					type: 'object',
					properties: {
						weight: { type: 'number' },
						caption: { type: 'string' },
					},
					additionalProperties: false,
				},
				step: { type: 'string', const: 'importWxr' },
				file: {
					$ref: '#/definitions/FileReference',
					description: 'The file to import',
				},
				importer: {
					type: 'string',
					enum: ['data-liberation', 'default'],
					description:
						'The importer to use. Possible values:\n\n- `default`: The importer from https://github.com/humanmade/WordPress-Importer\n- `data-liberation`: The experimental Data Liberation WXR importer developed at                      https://github.com/WordPress/wordpress-playground/issues/1894\n\nThis option is deprecated. The syntax will not be removed, but once the Data Liberation importer matures, it will become the only supported importer and the `importer` option will be ignored.',
					deprecated: true,
				},
			},
			required: ['file', 'step'],
		},
		{
			type: 'object',
			additionalProperties: false,
			properties: {
				progress: {
					type: 'object',
					properties: {
						weight: { type: 'number' },
						caption: { type: 'string' },
					},
					additionalProperties: false,
				},
				step: {
					type: 'string',
					const: 'importThemeStarterContent',
					description: 'The step identifier.',
				},
				themeSlug: {
					type: 'string',
					description:
						'The name of the theme to import content from.',
				},
			},
			required: ['step'],
		},
		{
			type: 'object',
			additionalProperties: false,
			properties: {
				progress: {
					type: 'object',
					properties: {
						weight: { type: 'number' },
						caption: { type: 'string' },
					},
					additionalProperties: false,
				},
				step: { type: 'string', const: 'importWordPressFiles' },
				wordPressFilesZip: {
					$ref: '#/definitions/FileReference',
					description:
						'The zip file containing the top-level WordPress files and directories.',
				},
				pathInZip: {
					type: 'string',
					description:
						'The path inside the zip file where the WordPress files are.',
				},
			},
			required: ['step', 'wordPressFilesZip'],
		},
		{
			type: 'object',
			additionalProperties: false,
			properties: {
				progress: {
					type: 'object',
					properties: {
						weight: { type: 'number' },
						caption: { type: 'string' },
					},
					additionalProperties: false,
				},
				ifAlreadyInstalled: {
					type: 'string',
					enum: ['overwrite', 'skip', 'error'],
					description: 'What to do if the asset already exists.',
				},
				step: {
					type: 'string',
					const: 'installPlugin',
					description: 'The step identifier.',
				},
				pluginData: {
					anyOf: [
						{ $ref: '#/definitions/FileReference' },
						{ $ref: '#/definitions/DirectoryReference' },
					],
					description:
						'The plugin files to install. It can be a plugin zip file, a single PHP file, or a directory containing all the plugin files at its root.',
				},
				pluginZipFile: {
					$ref: '#/definitions/FileReference',
					deprecated: ". Use 'pluginData' instead.",
				},
				options: {
					$ref: '#/definitions/InstallPluginOptions',
					description: 'Optional installation options.',
				},
			},
			required: ['pluginData', 'step'],
		},
		{
			type: 'object',
			additionalProperties: false,
			properties: {
				progress: {
					type: 'object',
					properties: {
						weight: { type: 'number' },
						caption: { type: 'string' },
					},
					additionalProperties: false,
				},
				ifAlreadyInstalled: {
					type: 'string',
					enum: ['overwrite', 'skip', 'error'],
					description: 'What to do if the asset already exists.',
				},
				step: {
					type: 'string',
					const: 'installTheme',
					description: 'The step identifier.',
				},
				themeData: {
					anyOf: [
						{ $ref: '#/definitions/FileReference' },
						{ $ref: '#/definitions/DirectoryReference' },
					],
					description:
						'The theme files to install. It can be either a theme zip file, or a directory containing all the theme files at its root.',
				},
				themeZipFile: {
					$ref: '#/definitions/FileReference',
					deprecated: ". Use 'themeData' instead.",
				},
				options: {
					$ref: '#/definitions/InstallThemeOptions',
					description: 'Optional installation options.',
				},
			},
			required: ['step', 'themeData'],
		},
		{
			type: 'object',
			additionalProperties: false,
			properties: {
				progress: {
					type: 'object',
					properties: {
						weight: { type: 'number' },
						caption: { type: 'string' },
					},
					additionalProperties: false,
				},
				step: { type: 'string', const: 'login' },
				username: {
					type: 'string',
					description: "The user to log in as. Defaults to 'admin'.",
				},
				password: {
					type: 'string',
					deprecated:
						'The password field is deprecated and will be removed in a future version.\nOnly the username field is required for user authentication.',
				},
			},
			required: ['step'],
		},
		{
			type: 'object',
			additionalProperties: false,
			properties: {
				progress: {
					type: 'object',
					properties: {
						weight: { type: 'number' },
						caption: { type: 'string' },
					},
					additionalProperties: false,
				},
				step: { type: 'string', const: 'mkdir' },
				path: {
					type: 'string',
					description: 'The path of the directory you want to create',
				},
			},
			required: ['path', 'step'],
		},
		{
			type: 'object',
			additionalProperties: false,
			properties: {
				progress: {
					type: 'object',
					properties: {
						weight: { type: 'number' },
						caption: { type: 'string' },
					},
					additionalProperties: false,
				},
				step: { type: 'string', const: 'mv' },
				fromPath: { type: 'string', description: 'Source path' },
				toPath: { type: 'string', description: 'Target path' },
			},
			required: ['fromPath', 'step', 'toPath'],
		},
		{
			type: 'object',
			additionalProperties: false,
			properties: {
				progress: {
					type: 'object',
					properties: {
						weight: { type: 'number' },
						caption: { type: 'string' },
					},
					additionalProperties: false,
				},
				step: { type: 'string', const: 'resetData' },
			},
			required: ['step'],
		},
		{
			type: 'object',
			additionalProperties: false,
			properties: {
				progress: {
					type: 'object',
					properties: {
						weight: { type: 'number' },
						caption: { type: 'string' },
					},
					additionalProperties: false,
				},
				step: { type: 'string', const: 'request' },
				request: {
					$ref: '#/definitions/PHPRequest',
					description:
						'Request details (See /wordpress-playground/api/universal/interface/PHPRequest)',
				},
			},
			required: ['request', 'step'],
		},
		{
			type: 'object',
			additionalProperties: false,
			properties: {
				progress: {
					type: 'object',
					properties: {
						weight: { type: 'number' },
						caption: { type: 'string' },
					},
					additionalProperties: false,
				},
				step: { type: 'string', const: 'rm' },
				path: { type: 'string', description: 'The path to remove' },
			},
			required: ['path', 'step'],
		},
		{
			type: 'object',
			additionalProperties: false,
			properties: {
				progress: {
					type: 'object',
					properties: {
						weight: { type: 'number' },
						caption: { type: 'string' },
					},
					additionalProperties: false,
				},
				step: { type: 'string', const: 'rmdir' },
				path: { type: 'string', description: 'The path to remove' },
			},
			required: ['path', 'step'],
		},
		{
			type: 'object',
			additionalProperties: false,
			properties: {
				progress: {
					type: 'object',
					properties: {
						weight: { type: 'number' },
						caption: { type: 'string' },
					},
					additionalProperties: false,
				},
				step: {
					type: 'string',
					const: 'runPHP',
					description: 'The step identifier.',
				},
				code: {
					anyOf: [
						{ type: 'string' },
						{
							type: 'object',
							properties: {
								filename: {
									type: 'string',
									description:
										'This property is ignored during Blueprint v1 execution but exists so the same runPHP step structure can be used for Blueprints v1 and v2.',
								},
								content: { type: 'string' },
							},
							required: ['filename', 'content'],
							additionalProperties: false,
						},
					],
					description: 'The PHP code to run.',
				},
			},
			required: ['code', 'step'],
		},
		{
			type: 'object',
			additionalProperties: false,
			properties: {
				progress: {
					type: 'object',
					properties: {
						weight: { type: 'number' },
						caption: { type: 'string' },
					},
					additionalProperties: false,
				},
				step: { type: 'string', const: 'runPHPWithOptions' },
				options: {
					$ref: '#/definitions/PHPRunOptions',
					description:
						'Run options (See /wordpress-playground/api/universal/interface/PHPRunOptions/))',
				},
			},
			required: ['options', 'step'],
		},
		{
			type: 'object',
			additionalProperties: false,
			properties: {
				progress: {
					type: 'object',
					properties: {
						weight: { type: 'number' },
						caption: { type: 'string' },
					},
					additionalProperties: false,
				},
				step: { type: 'string', const: 'runWpInstallationWizard' },
				options: { $ref: '#/definitions/WordPressInstallationOptions' },
			},
			required: ['options', 'step'],
		},
		{
			type: 'object',
			additionalProperties: false,
			properties: {
				progress: {
					type: 'object',
					properties: {
						weight: { type: 'number' },
						caption: { type: 'string' },
					},
					additionalProperties: false,
				},
				step: {
					type: 'string',
					const: 'runSql',
					description: 'The step identifier.',
				},
				sql: {
					$ref: '#/definitions/FileReference',
					description:
						'The SQL to run. Each non-empty line must contain a valid SQL query.',
				},
			},
			required: ['sql', 'step'],
		},
		{
			type: 'object',
			additionalProperties: false,
			properties: {
				progress: {
					type: 'object',
					properties: {
						weight: { type: 'number' },
						caption: { type: 'string' },
					},
					additionalProperties: false,
				},
				step: {
					type: 'string',
					const: 'setSiteOptions',
					description:
						'The name of the step. Must be "setSiteOptions".',
				},
				options: {
					type: 'object',
					additionalProperties: {},
					description: 'The options to set on the site.',
				},
			},
			required: ['options', 'step'],
		},
		{
			type: 'object',
			additionalProperties: false,
			properties: {
				progress: {
					type: 'object',
					properties: {
						weight: { type: 'number' },
						caption: { type: 'string' },
					},
					additionalProperties: false,
				},
				step: { type: 'string', const: 'unzip' },
				zipFile: {
					$ref: '#/definitions/FileReference',
					description: 'The zip file to extract',
				},
				zipPath: {
					type: 'string',
					description: 'The path of the zip file to extract',
					deprecated: 'Use zipFile instead.',
				},
				extractToPath: {
					type: 'string',
					description: 'The path to extract the zip file to',
				},
			},
			required: ['extractToPath', 'step'],
		},
		{
			type: 'object',
			additionalProperties: false,
			properties: {
				progress: {
					type: 'object',
					properties: {
						weight: { type: 'number' },
						caption: { type: 'string' },
					},
					additionalProperties: false,
				},
				step: { type: 'string', const: 'updateUserMeta' },
				meta: {
					type: 'object',
					additionalProperties: {},
					description:
						'An object of user meta values to set, e.g. { "first_name": "John" }',
				},
				userId: { type: 'number', description: 'User ID' },
			},
			required: ['meta', 'step', 'userId'],
		},
		{
			type: 'object',
			additionalProperties: false,
			properties: {
				progress: {
					type: 'object',
					properties: {
						weight: { type: 'number' },
						caption: { type: 'string' },
					},
					additionalProperties: false,
				},
				step: { type: 'string', const: 'writeFile' },
				path: {
					type: 'string',
					description: 'The path of the file to write to',
				},
				data: {
					anyOf: [
						{ $ref: '#/definitions/FileReference' },
						{ type: 'string' },
						{
							type: 'object',
							properties: {
								BYTES_PER_ELEMENT: { type: 'number' },
								buffer: {
									type: 'object',
									properties: {
										byteLength: { type: 'number' },
									},
									required: ['byteLength'],
									additionalProperties: false,
								},
								byteLength: { type: 'number' },
								byteOffset: { type: 'number' },
								length: { type: 'number' },
							},
							required: [
								'BYTES_PER_ELEMENT',
								'buffer',
								'byteLength',
								'byteOffset',
								'length',
							],
							additionalProperties: { type: 'number' },
						},
					],
					description: 'The data to write',
				},
			},
			required: ['data', 'path', 'step'],
		},
		{
			type: 'object',
			additionalProperties: false,
			properties: {
				progress: {
					type: 'object',
					properties: {
						weight: { type: 'number' },
						caption: { type: 'string' },
					},
					additionalProperties: false,
				},
				step: { type: 'string', const: 'writeFiles' },
				writeToPath: {
					type: 'string',
					description: 'The path of the file to write to',
				},
				filesTree: {
					$ref: '#/definitions/DirectoryReference',
					description:
						"The 'filesTree' defines the directory structure, supporting 'literal:directory' or 'git:directory' types. The 'name' represents the root directory, while 'files' is an object where keys are file paths, and values contain either file content as a string or nested objects for subdirectories.",
				},
			},
			required: ['filesTree', 'step', 'writeToPath'],
		},
		{
			type: 'object',
			additionalProperties: false,
			properties: {
				progress: {
					type: 'object',
					properties: {
						weight: { type: 'number' },
						caption: { type: 'string' },
					},
					additionalProperties: false,
				},
				step: {
					type: 'string',
					const: 'wp-cli',
					description: 'The step identifier.',
				},
				command: {
					anyOf: [
						{ type: 'string' },
						{ type: 'array', items: { type: 'string' } },
					],
					description: 'The WP CLI command to run.',
				},
				wpCliPath: { type: 'string', description: 'wp-cli.phar path' },
			},
			required: ['command', 'step'],
		},
		{
			type: 'object',
			additionalProperties: false,
			properties: {
				progress: {
					type: 'object',
					properties: {
						weight: { type: 'number' },
						caption: { type: 'string' },
					},
					additionalProperties: false,
				},
				step: { type: 'string', const: 'setSiteLanguage' },
				language: {
					type: 'string',
					description: "The language to set, e.g. 'en_US'",
				},
			},
			required: ['language', 'step'],
		},
	],
};
const schema34 = {
	type: 'object',
	properties: {
		activate: {
			type: 'boolean',
			description: 'Whether to activate the plugin after installing it.',
		},
		activationOptions: {
			type: 'object',
			additionalProperties: {},
			description:
				'Parameters to expose to the plugin during its activation hook.',
		},
		onError: {
			type: 'string',
			enum: ['skip-plugin', 'throw'],
			description:
				'Whether installation/activation failures should abort the Blueprint.',
		},
		targetFolderName: {
			type: 'string',
			description:
				'The name of the folder to install the plugin to. Defaults to guessing from pluginData',
		},
		humanReadableName: {
			type: 'string',
			description:
				'Human-readable plugin name for progress captions and skip warnings.',
		},
	},
	additionalProperties: false,
};
const schema35 = {
	type: 'object',
	properties: {
		activate: {
			type: 'boolean',
			description: 'Whether to activate the theme after installing it.',
		},
		importStarterContent: {
			type: 'boolean',
			description:
				"Whether to import the theme's starter content after installing it.",
		},
		targetFolderName: {
			type: 'string',
			description:
				'The name of the folder to install the theme to. Defaults to guessing from themeData',
		},
	},
	additionalProperties: false,
};
const schema42 = {
	type: 'object',
	properties: {
		adminUsername: { type: 'string' },
		adminPassword: { type: 'string' },
	},
	additionalProperties: false,
};
const schema36 = {
	type: 'object',
	properties: {
		method: {
			$ref: '#/definitions/HTTPMethod',
			description: 'Request method. Default: `GET`.',
		},
		url: { type: 'string', description: 'Request path or absolute URL.' },
		headers: {
			$ref: '#/definitions/PHPRequestHeaders',
			description: 'Request headers.',
		},
		body: {
			anyOf: [
				{ type: 'string' },
				{
					type: 'object',
					properties: {
						BYTES_PER_ELEMENT: { type: 'number' },
						buffer: {
							type: 'object',
							properties: { byteLength: { type: 'number' } },
							required: ['byteLength'],
							additionalProperties: false,
						},
						byteLength: { type: 'number' },
						byteOffset: { type: 'number' },
						length: { type: 'number' },
					},
					required: [
						'BYTES_PER_ELEMENT',
						'buffer',
						'byteLength',
						'byteOffset',
						'length',
					],
					additionalProperties: { type: 'number' },
				},
				{
					type: 'object',
					additionalProperties: {
						anyOf: [
							{ type: 'string' },
							{
								type: 'object',
								properties: {
									BYTES_PER_ELEMENT: { type: 'number' },
									buffer: {
										type: 'object',
										properties: {
											byteLength: { type: 'number' },
										},
										required: ['byteLength'],
										additionalProperties: false,
									},
									byteLength: { type: 'number' },
									byteOffset: { type: 'number' },
									length: { type: 'number' },
								},
								required: [
									'BYTES_PER_ELEMENT',
									'buffer',
									'byteLength',
									'byteOffset',
									'length',
								],
								additionalProperties: { type: 'number' },
							},
							{
								type: 'object',
								properties: {
									size: { type: 'number' },
									type: { type: 'string' },
									lastModified: { type: 'number' },
									name: { type: 'string' },
									webkitRelativePath: { type: 'string' },
								},
								required: [
									'lastModified',
									'name',
									'size',
									'type',
									'webkitRelativePath',
								],
								additionalProperties: false,
							},
						],
					},
				},
			],
			description:
				'Request body. If an object is given, the request will be encoded as multipart and sent with a `multipart/form-data` header.',
		},
	},
	required: ['url'],
	additionalProperties: false,
};
const schema37 = {
	type: 'string',
	enum: ['GET', 'POST', 'HEAD', 'OPTIONS', 'PATCH', 'PUT', 'DELETE'],
};
const schema38 = { type: 'object', additionalProperties: { type: 'string' } };
function validate37(
	data,
	{ instancePath = '', parentData, parentDataProperty, rootData = data } = {}
) {
	let vErrors = null;
	let errors = 0;
	if (errors === 0) {
		if (data && typeof data == 'object' && !Array.isArray(data)) {
			let missing0;
			if (data.url === undefined && (missing0 = 'url')) {
				validate37.errors = [
					{
						instancePath,
						schemaPath: '#/required',
						keyword: 'required',
						params: { missingProperty: missing0 },
						message:
							"must have required property '" + missing0 + "'",
					},
				];
				return false;
			} else {
				const _errs1 = errors;
				for (const key0 in data) {
					if (
						!(
							key0 === 'method' ||
							key0 === 'url' ||
							key0 === 'headers' ||
							key0 === 'body'
						)
					) {
						validate37.errors = [
							{
								instancePath,
								schemaPath: '#/additionalProperties',
								keyword: 'additionalProperties',
								params: { additionalProperty: key0 },
								message: 'must NOT have additional properties',
							},
						];
						return false;
						break;
					}
				}
				if (_errs1 === errors) {
					if (data.method !== undefined) {
						let data0 = data.method;
						const _errs2 = errors;
						if (typeof data0 !== 'string') {
							validate37.errors = [
								{
									instancePath: instancePath + '/method',
									schemaPath: '#/definitions/HTTPMethod/type',
									keyword: 'type',
									params: { type: 'string' },
									message: 'must be string',
								},
							];
							return false;
						}
						if (
							!(
								data0 === 'GET' ||
								data0 === 'POST' ||
								data0 === 'HEAD' ||
								data0 === 'OPTIONS' ||
								data0 === 'PATCH' ||
								data0 === 'PUT' ||
								data0 === 'DELETE'
							)
						) {
							validate37.errors = [
								{
									instancePath: instancePath + '/method',
									schemaPath: '#/definitions/HTTPMethod/enum',
									keyword: 'enum',
									params: { allowedValues: schema37.enum },
									message:
										'must be equal to one of the allowed values',
								},
							];
							return false;
						}
						var valid0 = _errs2 === errors;
					} else {
						var valid0 = true;
					}
					if (valid0) {
						if (data.url !== undefined) {
							const _errs5 = errors;
							if (typeof data.url !== 'string') {
								validate37.errors = [
									{
										instancePath: instancePath + '/url',
										schemaPath: '#/properties/url/type',
										keyword: 'type',
										params: { type: 'string' },
										message: 'must be string',
									},
								];
								return false;
							}
							var valid0 = _errs5 === errors;
						} else {
							var valid0 = true;
						}
						if (valid0) {
							if (data.headers !== undefined) {
								let data2 = data.headers;
								const _errs7 = errors;
								const _errs8 = errors;
								if (errors === _errs8) {
									if (
										data2 &&
										typeof data2 == 'object' &&
										!Array.isArray(data2)
									) {
										for (const key1 in data2) {
											const _errs11 = errors;
											if (
												typeof data2[key1] !== 'string'
											) {
												validate37.errors = [
													{
														instancePath:
															instancePath +
															'/headers/' +
															key1
																.replace(
																	/~/g,
																	'~0'
																)
																.replace(
																	/\//g,
																	'~1'
																),
														schemaPath:
															'#/definitions/PHPRequestHeaders/additionalProperties/type',
														keyword: 'type',
														params: {
															type: 'string',
														},
														message:
															'must be string',
													},
												];
												return false;
											}
											var valid3 = _errs11 === errors;
											if (!valid3) {
												break;
											}
										}
									} else {
										validate37.errors = [
											{
												instancePath:
													instancePath + '/headers',
												schemaPath:
													'#/definitions/PHPRequestHeaders/type',
												keyword: 'type',
												params: { type: 'object' },
												message: 'must be object',
											},
										];
										return false;
									}
								}
								var valid0 = _errs7 === errors;
							} else {
								var valid0 = true;
							}
							if (valid0) {
								if (data.body !== undefined) {
									let data4 = data.body;
									const _errs13 = errors;
									const _errs14 = errors;
									let valid4 = false;
									const _errs15 = errors;
									if (typeof data4 !== 'string') {
										const err0 = {
											instancePath:
												instancePath + '/body',
											schemaPath:
												'#/properties/body/anyOf/0/type',
											keyword: 'type',
											params: { type: 'string' },
											message: 'must be string',
										};
										if (vErrors === null) {
											vErrors = [err0];
										} else {
											vErrors.push(err0);
										}
										errors++;
									}
									var _valid0 = _errs15 === errors;
									valid4 = valid4 || _valid0;
									if (!valid4) {
										const _errs17 = errors;
										if (errors === _errs17) {
											if (
												data4 &&
												typeof data4 == 'object' &&
												!Array.isArray(data4)
											) {
												let missing1;
												if (
													(data4.BYTES_PER_ELEMENT ===
														undefined &&
														(missing1 =
															'BYTES_PER_ELEMENT')) ||
													(data4.buffer ===
														undefined &&
														(missing1 =
															'buffer')) ||
													(data4.byteLength ===
														undefined &&
														(missing1 =
															'byteLength')) ||
													(data4.byteOffset ===
														undefined &&
														(missing1 =
															'byteOffset')) ||
													(data4.length ===
														undefined &&
														(missing1 = 'length'))
												) {
													const err1 = {
														instancePath:
															instancePath +
															'/body',
														schemaPath:
															'#/properties/body/anyOf/1/required',
														keyword: 'required',
														params: {
															missingProperty:
																missing1,
														},
														message:
															"must have required property '" +
															missing1 +
															"'",
													};
													if (vErrors === null) {
														vErrors = [err1];
													} else {
														vErrors.push(err1);
													}
													errors++;
												} else {
													const _errs19 = errors;
													for (const key2 in data4) {
														if (
															!(
																key2 ===
																	'BYTES_PER_ELEMENT' ||
																key2 ===
																	'buffer' ||
																key2 ===
																	'byteLength' ||
																key2 ===
																	'byteOffset' ||
																key2 ===
																	'length'
															)
														) {
															let data5 =
																data4[key2];
															const _errs20 =
																errors;
															if (
																!(
																	typeof data5 ==
																		'number' &&
																	isFinite(
																		data5
																	)
																)
															) {
																const err2 = {
																	instancePath:
																		instancePath +
																		'/body/' +
																		key2
																			.replace(
																				/~/g,
																				'~0'
																			)
																			.replace(
																				/\//g,
																				'~1'
																			),
																	schemaPath:
																		'#/properties/body/anyOf/1/additionalProperties/type',
																	keyword:
																		'type',
																	params: {
																		type: 'number',
																	},
																	message:
																		'must be number',
																};
																if (
																	vErrors ===
																	null
																) {
																	vErrors = [
																		err2,
																	];
																} else {
																	vErrors.push(
																		err2
																	);
																}
																errors++;
															}
															var valid5 =
																_errs20 ===
																errors;
															if (!valid5) {
																break;
															}
														}
													}
													if (_errs19 === errors) {
														if (
															data4.BYTES_PER_ELEMENT !==
															undefined
														) {
															let data6 =
																data4.BYTES_PER_ELEMENT;
															const _errs22 =
																errors;
															if (
																!(
																	typeof data6 ==
																		'number' &&
																	isFinite(
																		data6
																	)
																)
															) {
																const err3 = {
																	instancePath:
																		instancePath +
																		'/body/BYTES_PER_ELEMENT',
																	schemaPath:
																		'#/properties/body/anyOf/1/properties/BYTES_PER_ELEMENT/type',
																	keyword:
																		'type',
																	params: {
																		type: 'number',
																	},
																	message:
																		'must be number',
																};
																if (
																	vErrors ===
																	null
																) {
																	vErrors = [
																		err3,
																	];
																} else {
																	vErrors.push(
																		err3
																	);
																}
																errors++;
															}
															var valid6 =
																_errs22 ===
																errors;
														} else {
															var valid6 = true;
														}
														if (valid6) {
															if (
																data4.buffer !==
																undefined
															) {
																let data7 =
																	data4.buffer;
																const _errs24 =
																	errors;
																if (
																	errors ===
																	_errs24
																) {
																	if (
																		data7 &&
																		typeof data7 ==
																			'object' &&
																		!Array.isArray(
																			data7
																		)
																	) {
																		let missing2;
																		if (
																			data7.byteLength ===
																				undefined &&
																			(missing2 =
																				'byteLength')
																		) {
																			const err4 =
																				{
																					instancePath:
																						instancePath +
																						'/body/buffer',
																					schemaPath:
																						'#/properties/body/anyOf/1/properties/buffer/required',
																					keyword:
																						'required',
																					params: {
																						missingProperty:
																							missing2,
																					},
																					message:
																						"must have required property '" +
																						missing2 +
																						"'",
																				};
																			if (
																				vErrors ===
																				null
																			) {
																				vErrors =
																					[
																						err4,
																					];
																			} else {
																				vErrors.push(
																					err4
																				);
																			}
																			errors++;
																		} else {
																			const _errs26 =
																				errors;
																			for (const key3 in data7) {
																				if (
																					!(
																						key3 ===
																						'byteLength'
																					)
																				) {
																					const err5 =
																						{
																							instancePath:
																								instancePath +
																								'/body/buffer',
																							schemaPath:
																								'#/properties/body/anyOf/1/properties/buffer/additionalProperties',
																							keyword:
																								'additionalProperties',
																							params: {
																								additionalProperty:
																									key3,
																							},
																							message:
																								'must NOT have additional properties',
																						};
																					if (
																						vErrors ===
																						null
																					) {
																						vErrors =
																							[
																								err5,
																							];
																					} else {
																						vErrors.push(
																							err5
																						);
																					}
																					errors++;
																					break;
																				}
																			}
																			if (
																				_errs26 ===
																				errors
																			) {
																				if (
																					data7.byteLength !==
																					undefined
																				) {
																					let data8 =
																						data7.byteLength;
																					if (
																						!(
																							typeof data8 ==
																								'number' &&
																							isFinite(
																								data8
																							)
																						)
																					) {
																						const err6 =
																							{
																								instancePath:
																									instancePath +
																									'/body/buffer/byteLength',
																								schemaPath:
																									'#/properties/body/anyOf/1/properties/buffer/properties/byteLength/type',
																								keyword:
																									'type',
																								params: {
																									type: 'number',
																								},
																								message:
																									'must be number',
																							};
																						if (
																							vErrors ===
																							null
																						) {
																							vErrors =
																								[
																									err6,
																								];
																						} else {
																							vErrors.push(
																								err6
																							);
																						}
																						errors++;
																					}
																				}
																			}
																		}
																	} else {
																		const err7 =
																			{
																				instancePath:
																					instancePath +
																					'/body/buffer',
																				schemaPath:
																					'#/properties/body/anyOf/1/properties/buffer/type',
																				keyword:
																					'type',
																				params: {
																					type: 'object',
																				},
																				message:
																					'must be object',
																			};
																		if (
																			vErrors ===
																			null
																		) {
																			vErrors =
																				[
																					err7,
																				];
																		} else {
																			vErrors.push(
																				err7
																			);
																		}
																		errors++;
																	}
																}
																var valid6 =
																	_errs24 ===
																	errors;
															} else {
																var valid6 = true;
															}
															if (valid6) {
																if (
																	data4.byteLength !==
																	undefined
																) {
																	let data9 =
																		data4.byteLength;
																	const _errs29 =
																		errors;
																	if (
																		!(
																			typeof data9 ==
																				'number' &&
																			isFinite(
																				data9
																			)
																		)
																	) {
																		const err8 =
																			{
																				instancePath:
																					instancePath +
																					'/body/byteLength',
																				schemaPath:
																					'#/properties/body/anyOf/1/properties/byteLength/type',
																				keyword:
																					'type',
																				params: {
																					type: 'number',
																				},
																				message:
																					'must be number',
																			};
																		if (
																			vErrors ===
																			null
																		) {
																			vErrors =
																				[
																					err8,
																				];
																		} else {
																			vErrors.push(
																				err8
																			);
																		}
																		errors++;
																	}
																	var valid6 =
																		_errs29 ===
																		errors;
																} else {
																	var valid6 = true;
																}
																if (valid6) {
																	if (
																		data4.byteOffset !==
																		undefined
																	) {
																		let data10 =
																			data4.byteOffset;
																		const _errs31 =
																			errors;
																		if (
																			!(
																				typeof data10 ==
																					'number' &&
																				isFinite(
																					data10
																				)
																			)
																		) {
																			const err9 =
																				{
																					instancePath:
																						instancePath +
																						'/body/byteOffset',
																					schemaPath:
																						'#/properties/body/anyOf/1/properties/byteOffset/type',
																					keyword:
																						'type',
																					params: {
																						type: 'number',
																					},
																					message:
																						'must be number',
																				};
																			if (
																				vErrors ===
																				null
																			) {
																				vErrors =
																					[
																						err9,
																					];
																			} else {
																				vErrors.push(
																					err9
																				);
																			}
																			errors++;
																		}
																		var valid6 =
																			_errs31 ===
																			errors;
																	} else {
																		var valid6 = true;
																	}
																	if (
																		valid6
																	) {
																		if (
																			data4.length !==
																			undefined
																		) {
																			let data11 =
																				data4.length;
																			const _errs33 =
																				errors;
																			if (
																				!(
																					typeof data11 ==
																						'number' &&
																					isFinite(
																						data11
																					)
																				)
																			) {
																				const err10 =
																					{
																						instancePath:
																							instancePath +
																							'/body/length',
																						schemaPath:
																							'#/properties/body/anyOf/1/properties/length/type',
																						keyword:
																							'type',
																						params: {
																							type: 'number',
																						},
																						message:
																							'must be number',
																					};
																				if (
																					vErrors ===
																					null
																				) {
																					vErrors =
																						[
																							err10,
																						];
																				} else {
																					vErrors.push(
																						err10
																					);
																				}
																				errors++;
																			}
																			var valid6 =
																				_errs33 ===
																				errors;
																		} else {
																			var valid6 = true;
																		}
																	}
																}
															}
														}
													}
												}
											} else {
												const err11 = {
													instancePath:
														instancePath + '/body',
													schemaPath:
														'#/properties/body/anyOf/1/type',
													keyword: 'type',
													params: { type: 'object' },
													message: 'must be object',
												};
												if (vErrors === null) {
													vErrors = [err11];
												} else {
													vErrors.push(err11);
												}
												errors++;
											}
										}
										var _valid0 = _errs17 === errors;
										valid4 = valid4 || _valid0;
										if (!valid4) {
											const _errs35 = errors;
											if (errors === _errs35) {
												if (
													data4 &&
													typeof data4 == 'object' &&
													!Array.isArray(data4)
												) {
													for (const key4 in data4) {
														let data12 =
															data4[key4];
														const _errs38 = errors;
														const _errs39 = errors;
														let valid9 = false;
														const _errs40 = errors;
														if (
															typeof data12 !==
															'string'
														) {
															const err12 = {
																instancePath:
																	instancePath +
																	'/body/' +
																	key4
																		.replace(
																			/~/g,
																			'~0'
																		)
																		.replace(
																			/\//g,
																			'~1'
																		),
																schemaPath:
																	'#/properties/body/anyOf/2/additionalProperties/anyOf/0/type',
																keyword: 'type',
																params: {
																	type: 'string',
																},
																message:
																	'must be string',
															};
															if (
																vErrors === null
															) {
																vErrors = [
																	err12,
																];
															} else {
																vErrors.push(
																	err12
																);
															}
															errors++;
														}
														var _valid1 =
															_errs40 === errors;
														valid9 =
															valid9 || _valid1;
														if (!valid9) {
															const _errs42 =
																errors;
															if (
																errors ===
																_errs42
															) {
																if (
																	data12 &&
																	typeof data12 ==
																		'object' &&
																	!Array.isArray(
																		data12
																	)
																) {
																	let missing3;
																	if (
																		(data12.BYTES_PER_ELEMENT ===
																			undefined &&
																			(missing3 =
																				'BYTES_PER_ELEMENT')) ||
																		(data12.buffer ===
																			undefined &&
																			(missing3 =
																				'buffer')) ||
																		(data12.byteLength ===
																			undefined &&
																			(missing3 =
																				'byteLength')) ||
																		(data12.byteOffset ===
																			undefined &&
																			(missing3 =
																				'byteOffset')) ||
																		(data12.length ===
																			undefined &&
																			(missing3 =
																				'length'))
																	) {
																		const err13 =
																			{
																				instancePath:
																					instancePath +
																					'/body/' +
																					key4
																						.replace(
																							/~/g,
																							'~0'
																						)
																						.replace(
																							/\//g,
																							'~1'
																						),
																				schemaPath:
																					'#/properties/body/anyOf/2/additionalProperties/anyOf/1/required',
																				keyword:
																					'required',
																				params: {
																					missingProperty:
																						missing3,
																				},
																				message:
																					"must have required property '" +
																					missing3 +
																					"'",
																			};
																		if (
																			vErrors ===
																			null
																		) {
																			vErrors =
																				[
																					err13,
																				];
																		} else {
																			vErrors.push(
																				err13
																			);
																		}
																		errors++;
																	} else {
																		const _errs44 =
																			errors;
																		for (const key5 in data12) {
																			if (
																				!(
																					key5 ===
																						'BYTES_PER_ELEMENT' ||
																					key5 ===
																						'buffer' ||
																					key5 ===
																						'byteLength' ||
																					key5 ===
																						'byteOffset' ||
																					key5 ===
																						'length'
																				)
																			) {
																				let data13 =
																					data12[
																						key5
																					];
																				const _errs45 =
																					errors;
																				if (
																					!(
																						typeof data13 ==
																							'number' &&
																						isFinite(
																							data13
																						)
																					)
																				) {
																					const err14 =
																						{
																							instancePath:
																								instancePath +
																								'/body/' +
																								key4
																									.replace(
																										/~/g,
																										'~0'
																									)
																									.replace(
																										/\//g,
																										'~1'
																									) +
																								'/' +
																								key5
																									.replace(
																										/~/g,
																										'~0'
																									)
																									.replace(
																										/\//g,
																										'~1'
																									),
																							schemaPath:
																								'#/properties/body/anyOf/2/additionalProperties/anyOf/1/additionalProperties/type',
																							keyword:
																								'type',
																							params: {
																								type: 'number',
																							},
																							message:
																								'must be number',
																						};
																					if (
																						vErrors ===
																						null
																					) {
																						vErrors =
																							[
																								err14,
																							];
																					} else {
																						vErrors.push(
																							err14
																						);
																					}
																					errors++;
																				}
																				var valid10 =
																					_errs45 ===
																					errors;
																				if (
																					!valid10
																				) {
																					break;
																				}
																			}
																		}
																		if (
																			_errs44 ===
																			errors
																		) {
																			if (
																				data12.BYTES_PER_ELEMENT !==
																				undefined
																			) {
																				let data14 =
																					data12.BYTES_PER_ELEMENT;
																				const _errs47 =
																					errors;
																				if (
																					!(
																						typeof data14 ==
																							'number' &&
																						isFinite(
																							data14
																						)
																					)
																				) {
																					const err15 =
																						{
																							instancePath:
																								instancePath +
																								'/body/' +
																								key4
																									.replace(
																										/~/g,
																										'~0'
																									)
																									.replace(
																										/\//g,
																										'~1'
																									) +
																								'/BYTES_PER_ELEMENT',
																							schemaPath:
																								'#/properties/body/anyOf/2/additionalProperties/anyOf/1/properties/BYTES_PER_ELEMENT/type',
																							keyword:
																								'type',
																							params: {
																								type: 'number',
																							},
																							message:
																								'must be number',
																						};
																					if (
																						vErrors ===
																						null
																					) {
																						vErrors =
																							[
																								err15,
																							];
																					} else {
																						vErrors.push(
																							err15
																						);
																					}
																					errors++;
																				}
																				var valid11 =
																					_errs47 ===
																					errors;
																			} else {
																				var valid11 = true;
																			}
																			if (
																				valid11
																			) {
																				if (
																					data12.buffer !==
																					undefined
																				) {
																					let data15 =
																						data12.buffer;
																					const _errs49 =
																						errors;
																					if (
																						errors ===
																						_errs49
																					) {
																						if (
																							data15 &&
																							typeof data15 ==
																								'object' &&
																							!Array.isArray(
																								data15
																							)
																						) {
																							let missing4;
																							if (
																								data15.byteLength ===
																									undefined &&
																								(missing4 =
																									'byteLength')
																							) {
																								const err16 =
																									{
																										instancePath:
																											instancePath +
																											'/body/' +
																											key4
																												.replace(
																													/~/g,
																													'~0'
																												)
																												.replace(
																													/\//g,
																													'~1'
																												) +
																											'/buffer',
																										schemaPath:
																											'#/properties/body/anyOf/2/additionalProperties/anyOf/1/properties/buffer/required',
																										keyword:
																											'required',
																										params: {
																											missingProperty:
																												missing4,
																										},
																										message:
																											"must have required property '" +
																											missing4 +
																											"'",
																									};
																								if (
																									vErrors ===
																									null
																								) {
																									vErrors =
																										[
																											err16,
																										];
																								} else {
																									vErrors.push(
																										err16
																									);
																								}
																								errors++;
																							} else {
																								const _errs51 =
																									errors;
																								for (const key6 in data15) {
																									if (
																										!(
																											key6 ===
																											'byteLength'
																										)
																									) {
																										const err17 =
																											{
																												instancePath:
																													instancePath +
																													'/body/' +
																													key4
																														.replace(
																															/~/g,
																															'~0'
																														)
																														.replace(
																															/\//g,
																															'~1'
																														) +
																													'/buffer',
																												schemaPath:
																													'#/properties/body/anyOf/2/additionalProperties/anyOf/1/properties/buffer/additionalProperties',
																												keyword:
																													'additionalProperties',
																												params: {
																													additionalProperty:
																														key6,
																												},
																												message:
																													'must NOT have additional properties',
																											};
																										if (
																											vErrors ===
																											null
																										) {
																											vErrors =
																												[
																													err17,
																												];
																										} else {
																											vErrors.push(
																												err17
																											);
																										}
																										errors++;
																										break;
																									}
																								}
																								if (
																									_errs51 ===
																									errors
																								) {
																									if (
																										data15.byteLength !==
																										undefined
																									) {
																										let data16 =
																											data15.byteLength;
																										if (
																											!(
																												typeof data16 ==
																													'number' &&
																												isFinite(
																													data16
																												)
																											)
																										) {
																											const err18 =
																												{
																													instancePath:
																														instancePath +
																														'/body/' +
																														key4
																															.replace(
																																/~/g,
																																'~0'
																															)
																															.replace(
																																/\//g,
																																'~1'
																															) +
																														'/buffer/byteLength',
																													schemaPath:
																														'#/properties/body/anyOf/2/additionalProperties/anyOf/1/properties/buffer/properties/byteLength/type',
																													keyword:
																														'type',
																													params: {
																														type: 'number',
																													},
																													message:
																														'must be number',
																												};
																											if (
																												vErrors ===
																												null
																											) {
																												vErrors =
																													[
																														err18,
																													];
																											} else {
																												vErrors.push(
																													err18
																												);
																											}
																											errors++;
																										}
																									}
																								}
																							}
																						} else {
																							const err19 =
																								{
																									instancePath:
																										instancePath +
																										'/body/' +
																										key4
																											.replace(
																												/~/g,
																												'~0'
																											)
																											.replace(
																												/\//g,
																												'~1'
																											) +
																										'/buffer',
																									schemaPath:
																										'#/properties/body/anyOf/2/additionalProperties/anyOf/1/properties/buffer/type',
																									keyword:
																										'type',
																									params: {
																										type: 'object',
																									},
																									message:
																										'must be object',
																								};
																							if (
																								vErrors ===
																								null
																							) {
																								vErrors =
																									[
																										err19,
																									];
																							} else {
																								vErrors.push(
																									err19
																								);
																							}
																							errors++;
																						}
																					}
																					var valid11 =
																						_errs49 ===
																						errors;
																				} else {
																					var valid11 = true;
																				}
																				if (
																					valid11
																				) {
																					if (
																						data12.byteLength !==
																						undefined
																					) {
																						let data17 =
																							data12.byteLength;
																						const _errs54 =
																							errors;
																						if (
																							!(
																								typeof data17 ==
																									'number' &&
																								isFinite(
																									data17
																								)
																							)
																						) {
																							const err20 =
																								{
																									instancePath:
																										instancePath +
																										'/body/' +
																										key4
																											.replace(
																												/~/g,
																												'~0'
																											)
																											.replace(
																												/\//g,
																												'~1'
																											) +
																										'/byteLength',
																									schemaPath:
																										'#/properties/body/anyOf/2/additionalProperties/anyOf/1/properties/byteLength/type',
																									keyword:
																										'type',
																									params: {
																										type: 'number',
																									},
																									message:
																										'must be number',
																								};
																							if (
																								vErrors ===
																								null
																							) {
																								vErrors =
																									[
																										err20,
																									];
																							} else {
																								vErrors.push(
																									err20
																								);
																							}
																							errors++;
																						}
																						var valid11 =
																							_errs54 ===
																							errors;
																					} else {
																						var valid11 = true;
																					}
																					if (
																						valid11
																					) {
																						if (
																							data12.byteOffset !==
																							undefined
																						) {
																							let data18 =
																								data12.byteOffset;
																							const _errs56 =
																								errors;
																							if (
																								!(
																									typeof data18 ==
																										'number' &&
																									isFinite(
																										data18
																									)
																								)
																							) {
																								const err21 =
																									{
																										instancePath:
																											instancePath +
																											'/body/' +
																											key4
																												.replace(
																													/~/g,
																													'~0'
																												)
																												.replace(
																													/\//g,
																													'~1'
																												) +
																											'/byteOffset',
																										schemaPath:
																											'#/properties/body/anyOf/2/additionalProperties/anyOf/1/properties/byteOffset/type',
																										keyword:
																											'type',
																										params: {
																											type: 'number',
																										},
																										message:
																											'must be number',
																									};
																								if (
																									vErrors ===
																									null
																								) {
																									vErrors =
																										[
																											err21,
																										];
																								} else {
																									vErrors.push(
																										err21
																									);
																								}
																								errors++;
																							}
																							var valid11 =
																								_errs56 ===
																								errors;
																						} else {
																							var valid11 = true;
																						}
																						if (
																							valid11
																						) {
																							if (
																								data12.length !==
																								undefined
																							) {
																								let data19 =
																									data12.length;
																								const _errs58 =
																									errors;
																								if (
																									!(
																										typeof data19 ==
																											'number' &&
																										isFinite(
																											data19
																										)
																									)
																								) {
																									const err22 =
																										{
																											instancePath:
																												instancePath +
																												'/body/' +
																												key4
																													.replace(
																														/~/g,
																														'~0'
																													)
																													.replace(
																														/\//g,
																														'~1'
																													) +
																												'/length',
																											schemaPath:
																												'#/properties/body/anyOf/2/additionalProperties/anyOf/1/properties/length/type',
																											keyword:
																												'type',
																											params: {
																												type: 'number',
																											},
																											message:
																												'must be number',
																										};
																									if (
																										vErrors ===
																										null
																									) {
																										vErrors =
																											[
																												err22,
																											];
																									} else {
																										vErrors.push(
																											err22
																										);
																									}
																									errors++;
																								}
																								var valid11 =
																									_errs58 ===
																									errors;
																							} else {
																								var valid11 = true;
																							}
																						}
																					}
																				}
																			}
																		}
																	}
																} else {
																	const err23 =
																		{
																			instancePath:
																				instancePath +
																				'/body/' +
																				key4
																					.replace(
																						/~/g,
																						'~0'
																					)
																					.replace(
																						/\//g,
																						'~1'
																					),
																			schemaPath:
																				'#/properties/body/anyOf/2/additionalProperties/anyOf/1/type',
																			keyword:
																				'type',
																			params: {
																				type: 'object',
																			},
																			message:
																				'must be object',
																		};
																	if (
																		vErrors ===
																		null
																	) {
																		vErrors =
																			[
																				err23,
																			];
																	} else {
																		vErrors.push(
																			err23
																		);
																	}
																	errors++;
																}
															}
															var _valid1 =
																_errs42 ===
																errors;
															valid9 =
																valid9 ||
																_valid1;
															if (!valid9) {
																const _errs60 =
																	errors;
																if (
																	errors ===
																	_errs60
																) {
																	if (
																		data12 &&
																		typeof data12 ==
																			'object' &&
																		!Array.isArray(
																			data12
																		)
																	) {
																		let missing5;
																		if (
																			(data12.lastModified ===
																				undefined &&
																				(missing5 =
																					'lastModified')) ||
																			(data12.name ===
																				undefined &&
																				(missing5 =
																					'name')) ||
																			(data12.size ===
																				undefined &&
																				(missing5 =
																					'size')) ||
																			(data12.type ===
																				undefined &&
																				(missing5 =
																					'type')) ||
																			(data12.webkitRelativePath ===
																				undefined &&
																				(missing5 =
																					'webkitRelativePath'))
																		) {
																			const err24 =
																				{
																					instancePath:
																						instancePath +
																						'/body/' +
																						key4
																							.replace(
																								/~/g,
																								'~0'
																							)
																							.replace(
																								/\//g,
																								'~1'
																							),
																					schemaPath:
																						'#/properties/body/anyOf/2/additionalProperties/anyOf/2/required',
																					keyword:
																						'required',
																					params: {
																						missingProperty:
																							missing5,
																					},
																					message:
																						"must have required property '" +
																						missing5 +
																						"'",
																				};
																			if (
																				vErrors ===
																				null
																			) {
																				vErrors =
																					[
																						err24,
																					];
																			} else {
																				vErrors.push(
																					err24
																				);
																			}
																			errors++;
																		} else {
																			const _errs62 =
																				errors;
																			for (const key7 in data12) {
																				if (
																					!(
																						key7 ===
																							'size' ||
																						key7 ===
																							'type' ||
																						key7 ===
																							'lastModified' ||
																						key7 ===
																							'name' ||
																						key7 ===
																							'webkitRelativePath'
																					)
																				) {
																					const err25 =
																						{
																							instancePath:
																								instancePath +
																								'/body/' +
																								key4
																									.replace(
																										/~/g,
																										'~0'
																									)
																									.replace(
																										/\//g,
																										'~1'
																									),
																							schemaPath:
																								'#/properties/body/anyOf/2/additionalProperties/anyOf/2/additionalProperties',
																							keyword:
																								'additionalProperties',
																							params: {
																								additionalProperty:
																									key7,
																							},
																							message:
																								'must NOT have additional properties',
																						};
																					if (
																						vErrors ===
																						null
																					) {
																						vErrors =
																							[
																								err25,
																							];
																					} else {
																						vErrors.push(
																							err25
																						);
																					}
																					errors++;
																					break;
																				}
																			}
																			if (
																				_errs62 ===
																				errors
																			) {
																				if (
																					data12.size !==
																					undefined
																				) {
																					let data20 =
																						data12.size;
																					const _errs63 =
																						errors;
																					if (
																						!(
																							typeof data20 ==
																								'number' &&
																							isFinite(
																								data20
																							)
																						)
																					) {
																						const err26 =
																							{
																								instancePath:
																									instancePath +
																									'/body/' +
																									key4
																										.replace(
																											/~/g,
																											'~0'
																										)
																										.replace(
																											/\//g,
																											'~1'
																										) +
																									'/size',
																								schemaPath:
																									'#/properties/body/anyOf/2/additionalProperties/anyOf/2/properties/size/type',
																								keyword:
																									'type',
																								params: {
																									type: 'number',
																								},
																								message:
																									'must be number',
																							};
																						if (
																							vErrors ===
																							null
																						) {
																							vErrors =
																								[
																									err26,
																								];
																						} else {
																							vErrors.push(
																								err26
																							);
																						}
																						errors++;
																					}
																					var valid13 =
																						_errs63 ===
																						errors;
																				} else {
																					var valid13 = true;
																				}
																				if (
																					valid13
																				) {
																					if (
																						data12.type !==
																						undefined
																					) {
																						const _errs65 =
																							errors;
																						if (
																							typeof data12.type !==
																							'string'
																						) {
																							const err27 =
																								{
																									instancePath:
																										instancePath +
																										'/body/' +
																										key4
																											.replace(
																												/~/g,
																												'~0'
																											)
																											.replace(
																												/\//g,
																												'~1'
																											) +
																										'/type',
																									schemaPath:
																										'#/properties/body/anyOf/2/additionalProperties/anyOf/2/properties/type/type',
																									keyword:
																										'type',
																									params: {
																										type: 'string',
																									},
																									message:
																										'must be string',
																								};
																							if (
																								vErrors ===
																								null
																							) {
																								vErrors =
																									[
																										err27,
																									];
																							} else {
																								vErrors.push(
																									err27
																								);
																							}
																							errors++;
																						}
																						var valid13 =
																							_errs65 ===
																							errors;
																					} else {
																						var valid13 = true;
																					}
																					if (
																						valid13
																					) {
																						if (
																							data12.lastModified !==
																							undefined
																						) {
																							let data22 =
																								data12.lastModified;
																							const _errs67 =
																								errors;
																							if (
																								!(
																									typeof data22 ==
																										'number' &&
																									isFinite(
																										data22
																									)
																								)
																							) {
																								const err28 =
																									{
																										instancePath:
																											instancePath +
																											'/body/' +
																											key4
																												.replace(
																													/~/g,
																													'~0'
																												)
																												.replace(
																													/\//g,
																													'~1'
																												) +
																											'/lastModified',
																										schemaPath:
																											'#/properties/body/anyOf/2/additionalProperties/anyOf/2/properties/lastModified/type',
																										keyword:
																											'type',
																										params: {
																											type: 'number',
																										},
																										message:
																											'must be number',
																									};
																								if (
																									vErrors ===
																									null
																								) {
																									vErrors =
																										[
																											err28,
																										];
																								} else {
																									vErrors.push(
																										err28
																									);
																								}
																								errors++;
																							}
																							var valid13 =
																								_errs67 ===
																								errors;
																						} else {
																							var valid13 = true;
																						}
																						if (
																							valid13
																						) {
																							if (
																								data12.name !==
																								undefined
																							) {
																								const _errs69 =
																									errors;
																								if (
																									typeof data12.name !==
																									'string'
																								) {
																									const err29 =
																										{
																											instancePath:
																												instancePath +
																												'/body/' +
																												key4
																													.replace(
																														/~/g,
																														'~0'
																													)
																													.replace(
																														/\//g,
																														'~1'
																													) +
																												'/name',
																											schemaPath:
																												'#/properties/body/anyOf/2/additionalProperties/anyOf/2/properties/name/type',
																											keyword:
																												'type',
																											params: {
																												type: 'string',
																											},
																											message:
																												'must be string',
																										};
																									if (
																										vErrors ===
																										null
																									) {
																										vErrors =
																											[
																												err29,
																											];
																									} else {
																										vErrors.push(
																											err29
																										);
																									}
																									errors++;
																								}
																								var valid13 =
																									_errs69 ===
																									errors;
																							} else {
																								var valid13 = true;
																							}
																							if (
																								valid13
																							) {
																								if (
																									data12.webkitRelativePath !==
																									undefined
																								) {
																									const _errs71 =
																										errors;
																									if (
																										typeof data12.webkitRelativePath !==
																										'string'
																									) {
																										const err30 =
																											{
																												instancePath:
																													instancePath +
																													'/body/' +
																													key4
																														.replace(
																															/~/g,
																															'~0'
																														)
																														.replace(
																															/\//g,
																															'~1'
																														) +
																													'/webkitRelativePath',
																												schemaPath:
																													'#/properties/body/anyOf/2/additionalProperties/anyOf/2/properties/webkitRelativePath/type',
																												keyword:
																													'type',
																												params: {
																													type: 'string',
																												},
																												message:
																													'must be string',
																											};
																										if (
																											vErrors ===
																											null
																										) {
																											vErrors =
																												[
																													err30,
																												];
																										} else {
																											vErrors.push(
																												err30
																											);
																										}
																										errors++;
																									}
																									var valid13 =
																										_errs71 ===
																										errors;
																								} else {
																									var valid13 = true;
																								}
																							}
																						}
																					}
																				}
																			}
																		}
																	} else {
																		const err31 =
																			{
																				instancePath:
																					instancePath +
																					'/body/' +
																					key4
																						.replace(
																							/~/g,
																							'~0'
																						)
																						.replace(
																							/\//g,
																							'~1'
																						),
																				schemaPath:
																					'#/properties/body/anyOf/2/additionalProperties/anyOf/2/type',
																				keyword:
																					'type',
																				params: {
																					type: 'object',
																				},
																				message:
																					'must be object',
																			};
																		if (
																			vErrors ===
																			null
																		) {
																			vErrors =
																				[
																					err31,
																				];
																		} else {
																			vErrors.push(
																				err31
																			);
																		}
																		errors++;
																	}
																}
																var _valid1 =
																	_errs60 ===
																	errors;
																valid9 =
																	valid9 ||
																	_valid1;
															}
														}
														if (!valid9) {
															const err32 = {
																instancePath:
																	instancePath +
																	'/body/' +
																	key4
																		.replace(
																			/~/g,
																			'~0'
																		)
																		.replace(
																			/\//g,
																			'~1'
																		),
																schemaPath:
																	'#/properties/body/anyOf/2/additionalProperties/anyOf',
																keyword:
																	'anyOf',
																params: {},
																message:
																	'must match a schema in anyOf',
															};
															if (
																vErrors === null
															) {
																vErrors = [
																	err32,
																];
															} else {
																vErrors.push(
																	err32
																);
															}
															errors++;
														} else {
															errors = _errs39;
															if (
																vErrors !== null
															) {
																if (_errs39) {
																	vErrors.length =
																		_errs39;
																} else {
																	vErrors =
																		null;
																}
															}
														}
														var valid8 =
															_errs38 === errors;
														if (!valid8) {
															break;
														}
													}
												} else {
													const err33 = {
														instancePath:
															instancePath +
															'/body',
														schemaPath:
															'#/properties/body/anyOf/2/type',
														keyword: 'type',
														params: {
															type: 'object',
														},
														message:
															'must be object',
													};
													if (vErrors === null) {
														vErrors = [err33];
													} else {
														vErrors.push(err33);
													}
													errors++;
												}
											}
											var _valid0 = _errs35 === errors;
											valid4 = valid4 || _valid0;
										}
									}
									if (!valid4) {
										const err34 = {
											instancePath:
												instancePath + '/body',
											schemaPath:
												'#/properties/body/anyOf',
											keyword: 'anyOf',
											params: {},
											message:
												'must match a schema in anyOf',
										};
										if (vErrors === null) {
											vErrors = [err34];
										} else {
											vErrors.push(err34);
										}
										errors++;
										validate37.errors = vErrors;
										return false;
									} else {
										errors = _errs14;
										if (vErrors !== null) {
											if (_errs14) {
												vErrors.length = _errs14;
											} else {
												vErrors = null;
											}
										}
									}
									var valid0 = _errs13 === errors;
								} else {
									var valid0 = true;
								}
							}
						}
					}
				}
			}
		} else {
			validate37.errors = [
				{
					instancePath,
					schemaPath: '#/type',
					keyword: 'type',
					params: { type: 'object' },
					message: 'must be object',
				},
			];
			return false;
		}
	}
	validate37.errors = vErrors;
	return errors === 0;
}
const schema39 = {
	type: 'object',
	properties: {
		relativeUri: {
			type: 'string',
			description:
				'Request path following the domain:port part – after any URL rewriting rules (e.g. apache .htaccess) have been applied.',
		},
		scriptPath: {
			type: 'string',
			description: 'Path of the .php file to execute.',
		},
		protocol: { type: 'string', description: 'Request protocol.' },
		method: {
			$ref: '#/definitions/HTTPMethod',
			description: 'Request method. Default: `GET`.',
		},
		headers: {
			$ref: '#/definitions/PHPRequestHeaders',
			description: 'Request headers.',
		},
		body: {
			anyOf: [
				{ type: 'string' },
				{
					type: 'object',
					properties: {
						BYTES_PER_ELEMENT: { type: 'number' },
						buffer: {
							type: 'object',
							properties: { byteLength: { type: 'number' } },
							required: ['byteLength'],
							additionalProperties: false,
						},
						byteLength: { type: 'number' },
						byteOffset: { type: 'number' },
						length: { type: 'number' },
					},
					required: [
						'BYTES_PER_ELEMENT',
						'buffer',
						'byteLength',
						'byteOffset',
						'length',
					],
					additionalProperties: { type: 'number' },
				},
			],
			description: 'Request body.',
		},
		env: {
			type: 'object',
			additionalProperties: { type: 'string' },
			description: 'Environment variables to set for this run.',
		},
		$_SERVER: {
			type: 'object',
			additionalProperties: { type: 'string' },
			description: '$_SERVER entries to set for this run.',
		},
		code: {
			type: 'string',
			description: 'The code snippet to eval instead of a php file.',
		},
	},
	additionalProperties: false,
};
function validate39(
	data,
	{ instancePath = '', parentData, parentDataProperty, rootData = data } = {}
) {
	let vErrors = null;
	let errors = 0;
	if (errors === 0) {
		if (data && typeof data == 'object' && !Array.isArray(data)) {
			const _errs1 = errors;
			for (const key0 in data) {
				if (!func2.call(schema39.properties, key0)) {
					validate39.errors = [
						{
							instancePath,
							schemaPath: '#/additionalProperties',
							keyword: 'additionalProperties',
							params: { additionalProperty: key0 },
							message: 'must NOT have additional properties',
						},
					];
					return false;
					break;
				}
			}
			if (_errs1 === errors) {
				if (data.relativeUri !== undefined) {
					const _errs2 = errors;
					if (typeof data.relativeUri !== 'string') {
						validate39.errors = [
							{
								instancePath: instancePath + '/relativeUri',
								schemaPath: '#/properties/relativeUri/type',
								keyword: 'type',
								params: { type: 'string' },
								message: 'must be string',
							},
						];
						return false;
					}
					var valid0 = _errs2 === errors;
				} else {
					var valid0 = true;
				}
				if (valid0) {
					if (data.scriptPath !== undefined) {
						const _errs4 = errors;
						if (typeof data.scriptPath !== 'string') {
							validate39.errors = [
								{
									instancePath: instancePath + '/scriptPath',
									schemaPath: '#/properties/scriptPath/type',
									keyword: 'type',
									params: { type: 'string' },
									message: 'must be string',
								},
							];
							return false;
						}
						var valid0 = _errs4 === errors;
					} else {
						var valid0 = true;
					}
					if (valid0) {
						if (data.protocol !== undefined) {
							const _errs6 = errors;
							if (typeof data.protocol !== 'string') {
								validate39.errors = [
									{
										instancePath:
											instancePath + '/protocol',
										schemaPath:
											'#/properties/protocol/type',
										keyword: 'type',
										params: { type: 'string' },
										message: 'must be string',
									},
								];
								return false;
							}
							var valid0 = _errs6 === errors;
						} else {
							var valid0 = true;
						}
						if (valid0) {
							if (data.method !== undefined) {
								let data3 = data.method;
								const _errs8 = errors;
								if (typeof data3 !== 'string') {
									validate39.errors = [
										{
											instancePath:
												instancePath + '/method',
											schemaPath:
												'#/definitions/HTTPMethod/type',
											keyword: 'type',
											params: { type: 'string' },
											message: 'must be string',
										},
									];
									return false;
								}
								if (
									!(
										data3 === 'GET' ||
										data3 === 'POST' ||
										data3 === 'HEAD' ||
										data3 === 'OPTIONS' ||
										data3 === 'PATCH' ||
										data3 === 'PUT' ||
										data3 === 'DELETE'
									)
								) {
									validate39.errors = [
										{
											instancePath:
												instancePath + '/method',
											schemaPath:
												'#/definitions/HTTPMethod/enum',
											keyword: 'enum',
											params: {
												allowedValues: schema37.enum,
											},
											message:
												'must be equal to one of the allowed values',
										},
									];
									return false;
								}
								var valid0 = _errs8 === errors;
							} else {
								var valid0 = true;
							}
							if (valid0) {
								if (data.headers !== undefined) {
									let data4 = data.headers;
									const _errs11 = errors;
									const _errs12 = errors;
									if (errors === _errs12) {
										if (
											data4 &&
											typeof data4 == 'object' &&
											!Array.isArray(data4)
										) {
											for (const key1 in data4) {
												const _errs15 = errors;
												if (
													typeof data4[key1] !==
													'string'
												) {
													validate39.errors = [
														{
															instancePath:
																instancePath +
																'/headers/' +
																key1
																	.replace(
																		/~/g,
																		'~0'
																	)
																	.replace(
																		/\//g,
																		'~1'
																	),
															schemaPath:
																'#/definitions/PHPRequestHeaders/additionalProperties/type',
															keyword: 'type',
															params: {
																type: 'string',
															},
															message:
																'must be string',
														},
													];
													return false;
												}
												var valid3 = _errs15 === errors;
												if (!valid3) {
													break;
												}
											}
										} else {
											validate39.errors = [
												{
													instancePath:
														instancePath +
														'/headers',
													schemaPath:
														'#/definitions/PHPRequestHeaders/type',
													keyword: 'type',
													params: { type: 'object' },
													message: 'must be object',
												},
											];
											return false;
										}
									}
									var valid0 = _errs11 === errors;
								} else {
									var valid0 = true;
								}
								if (valid0) {
									if (data.body !== undefined) {
										let data6 = data.body;
										const _errs17 = errors;
										const _errs18 = errors;
										let valid4 = false;
										const _errs19 = errors;
										if (typeof data6 !== 'string') {
											const err0 = {
												instancePath:
													instancePath + '/body',
												schemaPath:
													'#/properties/body/anyOf/0/type',
												keyword: 'type',
												params: { type: 'string' },
												message: 'must be string',
											};
											if (vErrors === null) {
												vErrors = [err0];
											} else {
												vErrors.push(err0);
											}
											errors++;
										}
										var _valid0 = _errs19 === errors;
										valid4 = valid4 || _valid0;
										if (!valid4) {
											const _errs21 = errors;
											if (errors === _errs21) {
												if (
													data6 &&
													typeof data6 == 'object' &&
													!Array.isArray(data6)
												) {
													let missing0;
													if (
														(data6.BYTES_PER_ELEMENT ===
															undefined &&
															(missing0 =
																'BYTES_PER_ELEMENT')) ||
														(data6.buffer ===
															undefined &&
															(missing0 =
																'buffer')) ||
														(data6.byteLength ===
															undefined &&
															(missing0 =
																'byteLength')) ||
														(data6.byteOffset ===
															undefined &&
															(missing0 =
																'byteOffset')) ||
														(data6.length ===
															undefined &&
															(missing0 =
																'length'))
													) {
														const err1 = {
															instancePath:
																instancePath +
																'/body',
															schemaPath:
																'#/properties/body/anyOf/1/required',
															keyword: 'required',
															params: {
																missingProperty:
																	missing0,
															},
															message:
																"must have required property '" +
																missing0 +
																"'",
														};
														if (vErrors === null) {
															vErrors = [err1];
														} else {
															vErrors.push(err1);
														}
														errors++;
													} else {
														const _errs23 = errors;
														for (const key2 in data6) {
															if (
																!(
																	key2 ===
																		'BYTES_PER_ELEMENT' ||
																	key2 ===
																		'buffer' ||
																	key2 ===
																		'byteLength' ||
																	key2 ===
																		'byteOffset' ||
																	key2 ===
																		'length'
																)
															) {
																let data7 =
																	data6[key2];
																const _errs24 =
																	errors;
																if (
																	!(
																		typeof data7 ==
																			'number' &&
																		isFinite(
																			data7
																		)
																	)
																) {
																	const err2 =
																		{
																			instancePath:
																				instancePath +
																				'/body/' +
																				key2
																					.replace(
																						/~/g,
																						'~0'
																					)
																					.replace(
																						/\//g,
																						'~1'
																					),
																			schemaPath:
																				'#/properties/body/anyOf/1/additionalProperties/type',
																			keyword:
																				'type',
																			params: {
																				type: 'number',
																			},
																			message:
																				'must be number',
																		};
																	if (
																		vErrors ===
																		null
																	) {
																		vErrors =
																			[
																				err2,
																			];
																	} else {
																		vErrors.push(
																			err2
																		);
																	}
																	errors++;
																}
																var valid5 =
																	_errs24 ===
																	errors;
																if (!valid5) {
																	break;
																}
															}
														}
														if (
															_errs23 === errors
														) {
															if (
																data6.BYTES_PER_ELEMENT !==
																undefined
															) {
																let data8 =
																	data6.BYTES_PER_ELEMENT;
																const _errs26 =
																	errors;
																if (
																	!(
																		typeof data8 ==
																			'number' &&
																		isFinite(
																			data8
																		)
																	)
																) {
																	const err3 =
																		{
																			instancePath:
																				instancePath +
																				'/body/BYTES_PER_ELEMENT',
																			schemaPath:
																				'#/properties/body/anyOf/1/properties/BYTES_PER_ELEMENT/type',
																			keyword:
																				'type',
																			params: {
																				type: 'number',
																			},
																			message:
																				'must be number',
																		};
																	if (
																		vErrors ===
																		null
																	) {
																		vErrors =
																			[
																				err3,
																			];
																	} else {
																		vErrors.push(
																			err3
																		);
																	}
																	errors++;
																}
																var valid6 =
																	_errs26 ===
																	errors;
															} else {
																var valid6 = true;
															}
															if (valid6) {
																if (
																	data6.buffer !==
																	undefined
																) {
																	let data9 =
																		data6.buffer;
																	const _errs28 =
																		errors;
																	if (
																		errors ===
																		_errs28
																	) {
																		if (
																			data9 &&
																			typeof data9 ==
																				'object' &&
																			!Array.isArray(
																				data9
																			)
																		) {
																			let missing1;
																			if (
																				data9.byteLength ===
																					undefined &&
																				(missing1 =
																					'byteLength')
																			) {
																				const err4 =
																					{
																						instancePath:
																							instancePath +
																							'/body/buffer',
																						schemaPath:
																							'#/properties/body/anyOf/1/properties/buffer/required',
																						keyword:
																							'required',
																						params: {
																							missingProperty:
																								missing1,
																						},
																						message:
																							"must have required property '" +
																							missing1 +
																							"'",
																					};
																				if (
																					vErrors ===
																					null
																				) {
																					vErrors =
																						[
																							err4,
																						];
																				} else {
																					vErrors.push(
																						err4
																					);
																				}
																				errors++;
																			} else {
																				const _errs30 =
																					errors;
																				for (const key3 in data9) {
																					if (
																						!(
																							key3 ===
																							'byteLength'
																						)
																					) {
																						const err5 =
																							{
																								instancePath:
																									instancePath +
																									'/body/buffer',
																								schemaPath:
																									'#/properties/body/anyOf/1/properties/buffer/additionalProperties',
																								keyword:
																									'additionalProperties',
																								params: {
																									additionalProperty:
																										key3,
																								},
																								message:
																									'must NOT have additional properties',
																							};
																						if (
																							vErrors ===
																							null
																						) {
																							vErrors =
																								[
																									err5,
																								];
																						} else {
																							vErrors.push(
																								err5
																							);
																						}
																						errors++;
																						break;
																					}
																				}
																				if (
																					_errs30 ===
																					errors
																				) {
																					if (
																						data9.byteLength !==
																						undefined
																					) {
																						let data10 =
																							data9.byteLength;
																						if (
																							!(
																								typeof data10 ==
																									'number' &&
																								isFinite(
																									data10
																								)
																							)
																						) {
																							const err6 =
																								{
																									instancePath:
																										instancePath +
																										'/body/buffer/byteLength',
																									schemaPath:
																										'#/properties/body/anyOf/1/properties/buffer/properties/byteLength/type',
																									keyword:
																										'type',
																									params: {
																										type: 'number',
																									},
																									message:
																										'must be number',
																								};
																							if (
																								vErrors ===
																								null
																							) {
																								vErrors =
																									[
																										err6,
																									];
																							} else {
																								vErrors.push(
																									err6
																								);
																							}
																							errors++;
																						}
																					}
																				}
																			}
																		} else {
																			const err7 =
																				{
																					instancePath:
																						instancePath +
																						'/body/buffer',
																					schemaPath:
																						'#/properties/body/anyOf/1/properties/buffer/type',
																					keyword:
																						'type',
																					params: {
																						type: 'object',
																					},
																					message:
																						'must be object',
																				};
																			if (
																				vErrors ===
																				null
																			) {
																				vErrors =
																					[
																						err7,
																					];
																			} else {
																				vErrors.push(
																					err7
																				);
																			}
																			errors++;
																		}
																	}
																	var valid6 =
																		_errs28 ===
																		errors;
																} else {
																	var valid6 = true;
																}
																if (valid6) {
																	if (
																		data6.byteLength !==
																		undefined
																	) {
																		let data11 =
																			data6.byteLength;
																		const _errs33 =
																			errors;
																		if (
																			!(
																				typeof data11 ==
																					'number' &&
																				isFinite(
																					data11
																				)
																			)
																		) {
																			const err8 =
																				{
																					instancePath:
																						instancePath +
																						'/body/byteLength',
																					schemaPath:
																						'#/properties/body/anyOf/1/properties/byteLength/type',
																					keyword:
																						'type',
																					params: {
																						type: 'number',
																					},
																					message:
																						'must be number',
																				};
																			if (
																				vErrors ===
																				null
																			) {
																				vErrors =
																					[
																						err8,
																					];
																			} else {
																				vErrors.push(
																					err8
																				);
																			}
																			errors++;
																		}
																		var valid6 =
																			_errs33 ===
																			errors;
																	} else {
																		var valid6 = true;
																	}
																	if (
																		valid6
																	) {
																		if (
																			data6.byteOffset !==
																			undefined
																		) {
																			let data12 =
																				data6.byteOffset;
																			const _errs35 =
																				errors;
																			if (
																				!(
																					typeof data12 ==
																						'number' &&
																					isFinite(
																						data12
																					)
																				)
																			) {
																				const err9 =
																					{
																						instancePath:
																							instancePath +
																							'/body/byteOffset',
																						schemaPath:
																							'#/properties/body/anyOf/1/properties/byteOffset/type',
																						keyword:
																							'type',
																						params: {
																							type: 'number',
																						},
																						message:
																							'must be number',
																					};
																				if (
																					vErrors ===
																					null
																				) {
																					vErrors =
																						[
																							err9,
																						];
																				} else {
																					vErrors.push(
																						err9
																					);
																				}
																				errors++;
																			}
																			var valid6 =
																				_errs35 ===
																				errors;
																		} else {
																			var valid6 = true;
																		}
																		if (
																			valid6
																		) {
																			if (
																				data6.length !==
																				undefined
																			) {
																				let data13 =
																					data6.length;
																				const _errs37 =
																					errors;
																				if (
																					!(
																						typeof data13 ==
																							'number' &&
																						isFinite(
																							data13
																						)
																					)
																				) {
																					const err10 =
																						{
																							instancePath:
																								instancePath +
																								'/body/length',
																							schemaPath:
																								'#/properties/body/anyOf/1/properties/length/type',
																							keyword:
																								'type',
																							params: {
																								type: 'number',
																							},
																							message:
																								'must be number',
																						};
																					if (
																						vErrors ===
																						null
																					) {
																						vErrors =
																							[
																								err10,
																							];
																					} else {
																						vErrors.push(
																							err10
																						);
																					}
																					errors++;
																				}
																				var valid6 =
																					_errs37 ===
																					errors;
																			} else {
																				var valid6 = true;
																			}
																		}
																	}
																}
															}
														}
													}
												} else {
													const err11 = {
														instancePath:
															instancePath +
															'/body',
														schemaPath:
															'#/properties/body/anyOf/1/type',
														keyword: 'type',
														params: {
															type: 'object',
														},
														message:
															'must be object',
													};
													if (vErrors === null) {
														vErrors = [err11];
													} else {
														vErrors.push(err11);
													}
													errors++;
												}
											}
											var _valid0 = _errs21 === errors;
											valid4 = valid4 || _valid0;
										}
										if (!valid4) {
											const err12 = {
												instancePath:
													instancePath + '/body',
												schemaPath:
													'#/properties/body/anyOf',
												keyword: 'anyOf',
												params: {},
												message:
													'must match a schema in anyOf',
											};
											if (vErrors === null) {
												vErrors = [err12];
											} else {
												vErrors.push(err12);
											}
											errors++;
											validate39.errors = vErrors;
											return false;
										} else {
											errors = _errs18;
											if (vErrors !== null) {
												if (_errs18) {
													vErrors.length = _errs18;
												} else {
													vErrors = null;
												}
											}
										}
										var valid0 = _errs17 === errors;
									} else {
										var valid0 = true;
									}
									if (valid0) {
										if (data.env !== undefined) {
											let data14 = data.env;
											const _errs39 = errors;
											if (errors === _errs39) {
												if (
													data14 &&
													typeof data14 == 'object' &&
													!Array.isArray(data14)
												) {
													for (const key4 in data14) {
														const _errs42 = errors;
														if (
															typeof data14[
																key4
															] !== 'string'
														) {
															validate39.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/env/' +
																			key4
																				.replace(
																					/~/g,
																					'~0'
																				)
																				.replace(
																					/\//g,
																					'~1'
																				),
																		schemaPath:
																			'#/properties/env/additionalProperties/type',
																		keyword:
																			'type',
																		params: {
																			type: 'string',
																		},
																		message:
																			'must be string',
																	},
																];
															return false;
														}
														var valid8 =
															_errs42 === errors;
														if (!valid8) {
															break;
														}
													}
												} else {
													validate39.errors = [
														{
															instancePath:
																instancePath +
																'/env',
															schemaPath:
																'#/properties/env/type',
															keyword: 'type',
															params: {
																type: 'object',
															},
															message:
																'must be object',
														},
													];
													return false;
												}
											}
											var valid0 = _errs39 === errors;
										} else {
											var valid0 = true;
										}
										if (valid0) {
											if (data.$_SERVER !== undefined) {
												let data16 = data.$_SERVER;
												const _errs44 = errors;
												if (errors === _errs44) {
													if (
														data16 &&
														typeof data16 ==
															'object' &&
														!Array.isArray(data16)
													) {
														for (const key5 in data16) {
															const _errs47 =
																errors;
															if (
																typeof data16[
																	key5
																] !== 'string'
															) {
																validate39.errors =
																	[
																		{
																			instancePath:
																				instancePath +
																				'/$_SERVER/' +
																				key5
																					.replace(
																						/~/g,
																						'~0'
																					)
																					.replace(
																						/\//g,
																						'~1'
																					),
																			schemaPath:
																				'#/properties/%24_SERVER/additionalProperties/type',
																			keyword:
																				'type',
																			params: {
																				type: 'string',
																			},
																			message:
																				'must be string',
																		},
																	];
																return false;
															}
															var valid9 =
																_errs47 ===
																errors;
															if (!valid9) {
																break;
															}
														}
													} else {
														validate39.errors = [
															{
																instancePath:
																	instancePath +
																	'/$_SERVER',
																schemaPath:
																	'#/properties/%24_SERVER/type',
																keyword: 'type',
																params: {
																	type: 'object',
																},
																message:
																	'must be object',
															},
														];
														return false;
													}
												}
												var valid0 = _errs44 === errors;
											} else {
												var valid0 = true;
											}
											if (valid0) {
												if (data.code !== undefined) {
													const _errs49 = errors;
													if (
														typeof data.code !==
														'string'
													) {
														validate39.errors = [
															{
																instancePath:
																	instancePath +
																	'/code',
																schemaPath:
																	'#/properties/code/type',
																keyword: 'type',
																params: {
																	type: 'string',
																},
																message:
																	'must be string',
															},
														];
														return false;
													}
													var valid0 =
														_errs49 === errors;
												} else {
													var valid0 = true;
												}
											}
										}
									}
								}
							}
						}
					}
				}
			}
		} else {
			validate39.errors = [
				{
					instancePath,
					schemaPath: '#/type',
					keyword: 'type',
					params: { type: 'object' },
					message: 'must be object',
				},
			];
			return false;
		}
	}
	validate39.errors = vErrors;
	return errors === 0;
}
function validate28(
	data,
	{ instancePath = '', parentData, parentDataProperty, rootData = data } = {}
) {
	let vErrors = null;
	let errors = 0;
	if (errors === 0) {
		if (data && typeof data == 'object' && !Array.isArray(data)) {
			let missing0;
			if (data.step === undefined && (missing0 = 'step')) {
				validate28.errors = [
					{
						instancePath,
						schemaPath: '#/required',
						keyword: 'required',
						params: { missingProperty: missing0 },
						message:
							"must have required property '" + missing0 + "'",
					},
				];
				return false;
			} else {
				const tag0 = data.step;
				if (typeof tag0 == 'string') {
					if (tag0 === 'activatePlugin') {
						const _errs2 = errors;
						if (errors === _errs2) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing1;
								if (
									(data.pluginPath === undefined &&
										(missing1 = 'pluginPath')) ||
									(data.step === undefined &&
										(missing1 = 'step'))
								) {
									validate28.errors = [
										{
											instancePath,
											schemaPath: '#/oneOf/0/required',
											keyword: 'required',
											params: {
												missingProperty: missing1,
											},
											message:
												"must have required property '" +
												missing1 +
												"'",
										},
									];
									return false;
								} else {
									const _errs4 = errors;
									for (const key0 in data) {
										if (
											!(
												key0 === 'progress' ||
												key0 === 'step' ||
												key0 === 'pluginPath' ||
												key0 === 'pluginName'
											)
										) {
											validate28.errors = [
												{
													instancePath,
													schemaPath:
														'#/oneOf/0/additionalProperties',
													keyword:
														'additionalProperties',
													params: {
														additionalProperty:
															key0,
													},
													message:
														'must NOT have additional properties',
												},
											];
											return false;
											break;
										}
									}
									if (_errs4 === errors) {
										if (data.progress !== undefined) {
											let data0 = data.progress;
											const _errs5 = errors;
											if (errors === _errs5) {
												if (
													data0 &&
													typeof data0 == 'object' &&
													!Array.isArray(data0)
												) {
													const _errs7 = errors;
													for (const key1 in data0) {
														if (
															!(
																key1 ===
																	'weight' ||
																key1 ===
																	'caption'
															)
														) {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/progress',
																		schemaPath:
																			'#/oneOf/0/properties/progress/additionalProperties',
																		keyword:
																			'additionalProperties',
																		params: {
																			additionalProperty:
																				key1,
																		},
																		message:
																			'must NOT have additional properties',
																	},
																];
															return false;
															break;
														}
													}
													if (_errs7 === errors) {
														if (
															data0.weight !==
															undefined
														) {
															let data1 =
																data0.weight;
															const _errs8 =
																errors;
															if (
																!(
																	typeof data1 ==
																		'number' &&
																	isFinite(
																		data1
																	)
																)
															) {
																validate28.errors =
																	[
																		{
																			instancePath:
																				instancePath +
																				'/progress/weight',
																			schemaPath:
																				'#/oneOf/0/properties/progress/properties/weight/type',
																			keyword:
																				'type',
																			params: {
																				type: 'number',
																			},
																			message:
																				'must be number',
																		},
																	];
																return false;
															}
															var valid3 =
																_errs8 ===
																errors;
														} else {
															var valid3 = true;
														}
														if (valid3) {
															if (
																data0.caption !==
																undefined
															) {
																const _errs10 =
																	errors;
																if (
																	typeof data0.caption !==
																	'string'
																) {
																	validate28.errors =
																		[
																			{
																				instancePath:
																					instancePath +
																					'/progress/caption',
																				schemaPath:
																					'#/oneOf/0/properties/progress/properties/caption/type',
																				keyword:
																					'type',
																				params: {
																					type: 'string',
																				},
																				message:
																					'must be string',
																			},
																		];
																	return false;
																}
																var valid3 =
																	_errs10 ===
																	errors;
															} else {
																var valid3 = true;
															}
														}
													}
												} else {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/progress',
															schemaPath:
																'#/oneOf/0/properties/progress/type',
															keyword: 'type',
															params: {
																type: 'object',
															},
															message:
																'must be object',
														},
													];
													return false;
												}
											}
											var valid2 = _errs5 === errors;
										} else {
											var valid2 = true;
										}
										if (valid2) {
											if (data.step !== undefined) {
												let data3 = data.step;
												const _errs12 = errors;
												if (typeof data3 !== 'string') {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/0/properties/step/type',
															keyword: 'type',
															params: {
																type: 'string',
															},
															message:
																'must be string',
														},
													];
													return false;
												}
												if (
													'activatePlugin' !== data3
												) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/0/properties/step/const',
															keyword: 'const',
															params: {
																allowedValue:
																	'activatePlugin',
															},
															message:
																'must be equal to constant',
														},
													];
													return false;
												}
												var valid2 = _errs12 === errors;
											} else {
												var valid2 = true;
											}
											if (valid2) {
												if (
													data.pluginPath !==
													undefined
												) {
													const _errs14 = errors;
													if (
														typeof data.pluginPath !==
														'string'
													) {
														validate28.errors = [
															{
																instancePath:
																	instancePath +
																	'/pluginPath',
																schemaPath:
																	'#/oneOf/0/properties/pluginPath/type',
																keyword: 'type',
																params: {
																	type: 'string',
																},
																message:
																	'must be string',
															},
														];
														return false;
													}
													var valid2 =
														_errs14 === errors;
												} else {
													var valid2 = true;
												}
												if (valid2) {
													if (
														data.pluginName !==
														undefined
													) {
														const _errs16 = errors;
														if (
															typeof data.pluginName !==
															'string'
														) {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/pluginName',
																		schemaPath:
																			'#/oneOf/0/properties/pluginName/type',
																		keyword:
																			'type',
																		params: {
																			type: 'string',
																		},
																		message:
																			'must be string',
																	},
																];
															return false;
														}
														var valid2 =
															_errs16 === errors;
													} else {
														var valid2 = true;
													}
												}
											}
										}
									}
								}
							} else {
								validate28.errors = [
									{
										instancePath,
										schemaPath: '#/oneOf/0/type',
										keyword: 'type',
										params: { type: 'object' },
										message: 'must be object',
									},
								];
								return false;
							}
						}
					} else if (tag0 === 'activateTheme') {
						const _errs18 = errors;
						if (errors === _errs18) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing2;
								if (
									(data.step === undefined &&
										(missing2 = 'step')) ||
									(data.themeFolderName === undefined &&
										(missing2 = 'themeFolderName'))
								) {
									validate28.errors = [
										{
											instancePath,
											schemaPath: '#/oneOf/1/required',
											keyword: 'required',
											params: {
												missingProperty: missing2,
											},
											message:
												"must have required property '" +
												missing2 +
												"'",
										},
									];
									return false;
								} else {
									const _errs20 = errors;
									for (const key2 in data) {
										if (
											!(
												key2 === 'progress' ||
												key2 === 'step' ||
												key2 === 'themeFolderName'
											)
										) {
											validate28.errors = [
												{
													instancePath,
													schemaPath:
														'#/oneOf/1/additionalProperties',
													keyword:
														'additionalProperties',
													params: {
														additionalProperty:
															key2,
													},
													message:
														'must NOT have additional properties',
												},
											];
											return false;
											break;
										}
									}
									if (_errs20 === errors) {
										if (data.progress !== undefined) {
											let data6 = data.progress;
											const _errs21 = errors;
											if (errors === _errs21) {
												if (
													data6 &&
													typeof data6 == 'object' &&
													!Array.isArray(data6)
												) {
													const _errs23 = errors;
													for (const key3 in data6) {
														if (
															!(
																key3 ===
																	'weight' ||
																key3 ===
																	'caption'
															)
														) {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/progress',
																		schemaPath:
																			'#/oneOf/1/properties/progress/additionalProperties',
																		keyword:
																			'additionalProperties',
																		params: {
																			additionalProperty:
																				key3,
																		},
																		message:
																			'must NOT have additional properties',
																	},
																];
															return false;
															break;
														}
													}
													if (_errs23 === errors) {
														if (
															data6.weight !==
															undefined
														) {
															let data7 =
																data6.weight;
															const _errs24 =
																errors;
															if (
																!(
																	typeof data7 ==
																		'number' &&
																	isFinite(
																		data7
																	)
																)
															) {
																validate28.errors =
																	[
																		{
																			instancePath:
																				instancePath +
																				'/progress/weight',
																			schemaPath:
																				'#/oneOf/1/properties/progress/properties/weight/type',
																			keyword:
																				'type',
																			params: {
																				type: 'number',
																			},
																			message:
																				'must be number',
																		},
																	];
																return false;
															}
															var valid6 =
																_errs24 ===
																errors;
														} else {
															var valid6 = true;
														}
														if (valid6) {
															if (
																data6.caption !==
																undefined
															) {
																const _errs26 =
																	errors;
																if (
																	typeof data6.caption !==
																	'string'
																) {
																	validate28.errors =
																		[
																			{
																				instancePath:
																					instancePath +
																					'/progress/caption',
																				schemaPath:
																					'#/oneOf/1/properties/progress/properties/caption/type',
																				keyword:
																					'type',
																				params: {
																					type: 'string',
																				},
																				message:
																					'must be string',
																			},
																		];
																	return false;
																}
																var valid6 =
																	_errs26 ===
																	errors;
															} else {
																var valid6 = true;
															}
														}
													}
												} else {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/progress',
															schemaPath:
																'#/oneOf/1/properties/progress/type',
															keyword: 'type',
															params: {
																type: 'object',
															},
															message:
																'must be object',
														},
													];
													return false;
												}
											}
											var valid5 = _errs21 === errors;
										} else {
											var valid5 = true;
										}
										if (valid5) {
											if (data.step !== undefined) {
												let data9 = data.step;
												const _errs28 = errors;
												if (typeof data9 !== 'string') {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/1/properties/step/type',
															keyword: 'type',
															params: {
																type: 'string',
															},
															message:
																'must be string',
														},
													];
													return false;
												}
												if ('activateTheme' !== data9) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/1/properties/step/const',
															keyword: 'const',
															params: {
																allowedValue:
																	'activateTheme',
															},
															message:
																'must be equal to constant',
														},
													];
													return false;
												}
												var valid5 = _errs28 === errors;
											} else {
												var valid5 = true;
											}
											if (valid5) {
												if (
													data.themeFolderName !==
													undefined
												) {
													const _errs30 = errors;
													if (
														typeof data.themeFolderName !==
														'string'
													) {
														validate28.errors = [
															{
																instancePath:
																	instancePath +
																	'/themeFolderName',
																schemaPath:
																	'#/oneOf/1/properties/themeFolderName/type',
																keyword: 'type',
																params: {
																	type: 'string',
																},
																message:
																	'must be string',
															},
														];
														return false;
													}
													var valid5 =
														_errs30 === errors;
												} else {
													var valid5 = true;
												}
											}
										}
									}
								}
							} else {
								validate28.errors = [
									{
										instancePath,
										schemaPath: '#/oneOf/1/type',
										keyword: 'type',
										params: { type: 'object' },
										message: 'must be object',
									},
								];
								return false;
							}
						}
					} else if (tag0 === 'cp') {
						const _errs32 = errors;
						if (errors === _errs32) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing3;
								if (
									(data.fromPath === undefined &&
										(missing3 = 'fromPath')) ||
									(data.step === undefined &&
										(missing3 = 'step')) ||
									(data.toPath === undefined &&
										(missing3 = 'toPath'))
								) {
									validate28.errors = [
										{
											instancePath,
											schemaPath: '#/oneOf/2/required',
											keyword: 'required',
											params: {
												missingProperty: missing3,
											},
											message:
												"must have required property '" +
												missing3 +
												"'",
										},
									];
									return false;
								} else {
									const _errs34 = errors;
									for (const key4 in data) {
										if (
											!(
												key4 === 'progress' ||
												key4 === 'step' ||
												key4 === 'fromPath' ||
												key4 === 'toPath'
											)
										) {
											validate28.errors = [
												{
													instancePath,
													schemaPath:
														'#/oneOf/2/additionalProperties',
													keyword:
														'additionalProperties',
													params: {
														additionalProperty:
															key4,
													},
													message:
														'must NOT have additional properties',
												},
											];
											return false;
											break;
										}
									}
									if (_errs34 === errors) {
										if (data.progress !== undefined) {
											let data11 = data.progress;
											const _errs35 = errors;
											if (errors === _errs35) {
												if (
													data11 &&
													typeof data11 == 'object' &&
													!Array.isArray(data11)
												) {
													const _errs37 = errors;
													for (const key5 in data11) {
														if (
															!(
																key5 ===
																	'weight' ||
																key5 ===
																	'caption'
															)
														) {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/progress',
																		schemaPath:
																			'#/oneOf/2/properties/progress/additionalProperties',
																		keyword:
																			'additionalProperties',
																		params: {
																			additionalProperty:
																				key5,
																		},
																		message:
																			'must NOT have additional properties',
																	},
																];
															return false;
															break;
														}
													}
													if (_errs37 === errors) {
														if (
															data11.weight !==
															undefined
														) {
															let data12 =
																data11.weight;
															const _errs38 =
																errors;
															if (
																!(
																	typeof data12 ==
																		'number' &&
																	isFinite(
																		data12
																	)
																)
															) {
																validate28.errors =
																	[
																		{
																			instancePath:
																				instancePath +
																				'/progress/weight',
																			schemaPath:
																				'#/oneOf/2/properties/progress/properties/weight/type',
																			keyword:
																				'type',
																			params: {
																				type: 'number',
																			},
																			message:
																				'must be number',
																		},
																	];
																return false;
															}
															var valid9 =
																_errs38 ===
																errors;
														} else {
															var valid9 = true;
														}
														if (valid9) {
															if (
																data11.caption !==
																undefined
															) {
																const _errs40 =
																	errors;
																if (
																	typeof data11.caption !==
																	'string'
																) {
																	validate28.errors =
																		[
																			{
																				instancePath:
																					instancePath +
																					'/progress/caption',
																				schemaPath:
																					'#/oneOf/2/properties/progress/properties/caption/type',
																				keyword:
																					'type',
																				params: {
																					type: 'string',
																				},
																				message:
																					'must be string',
																			},
																		];
																	return false;
																}
																var valid9 =
																	_errs40 ===
																	errors;
															} else {
																var valid9 = true;
															}
														}
													}
												} else {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/progress',
															schemaPath:
																'#/oneOf/2/properties/progress/type',
															keyword: 'type',
															params: {
																type: 'object',
															},
															message:
																'must be object',
														},
													];
													return false;
												}
											}
											var valid8 = _errs35 === errors;
										} else {
											var valid8 = true;
										}
										if (valid8) {
											if (data.step !== undefined) {
												let data14 = data.step;
												const _errs42 = errors;
												if (
													typeof data14 !== 'string'
												) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/2/properties/step/type',
															keyword: 'type',
															params: {
																type: 'string',
															},
															message:
																'must be string',
														},
													];
													return false;
												}
												if ('cp' !== data14) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/2/properties/step/const',
															keyword: 'const',
															params: {
																allowedValue:
																	'cp',
															},
															message:
																'must be equal to constant',
														},
													];
													return false;
												}
												var valid8 = _errs42 === errors;
											} else {
												var valid8 = true;
											}
											if (valid8) {
												if (
													data.fromPath !== undefined
												) {
													const _errs44 = errors;
													if (
														typeof data.fromPath !==
														'string'
													) {
														validate28.errors = [
															{
																instancePath:
																	instancePath +
																	'/fromPath',
																schemaPath:
																	'#/oneOf/2/properties/fromPath/type',
																keyword: 'type',
																params: {
																	type: 'string',
																},
																message:
																	'must be string',
															},
														];
														return false;
													}
													var valid8 =
														_errs44 === errors;
												} else {
													var valid8 = true;
												}
												if (valid8) {
													if (
														data.toPath !==
														undefined
													) {
														const _errs46 = errors;
														if (
															typeof data.toPath !==
															'string'
														) {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/toPath',
																		schemaPath:
																			'#/oneOf/2/properties/toPath/type',
																		keyword:
																			'type',
																		params: {
																			type: 'string',
																		},
																		message:
																			'must be string',
																	},
																];
															return false;
														}
														var valid8 =
															_errs46 === errors;
													} else {
														var valid8 = true;
													}
												}
											}
										}
									}
								}
							} else {
								validate28.errors = [
									{
										instancePath,
										schemaPath: '#/oneOf/2/type',
										keyword: 'type',
										params: { type: 'object' },
										message: 'must be object',
									},
								];
								return false;
							}
						}
					} else if (tag0 === 'defineWpConfigConsts') {
						const _errs48 = errors;
						if (errors === _errs48) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing4;
								if (
									(data.consts === undefined &&
										(missing4 = 'consts')) ||
									(data.step === undefined &&
										(missing4 = 'step'))
								) {
									validate28.errors = [
										{
											instancePath,
											schemaPath: '#/oneOf/3/required',
											keyword: 'required',
											params: {
												missingProperty: missing4,
											},
											message:
												"must have required property '" +
												missing4 +
												"'",
										},
									];
									return false;
								} else {
									const _errs50 = errors;
									for (const key6 in data) {
										if (
											!(
												key6 === 'progress' ||
												key6 === 'step' ||
												key6 === 'consts' ||
												key6 === 'method' ||
												key6 === 'virtualize'
											)
										) {
											validate28.errors = [
												{
													instancePath,
													schemaPath:
														'#/oneOf/3/additionalProperties',
													keyword:
														'additionalProperties',
													params: {
														additionalProperty:
															key6,
													},
													message:
														'must NOT have additional properties',
												},
											];
											return false;
											break;
										}
									}
									if (_errs50 === errors) {
										if (data.progress !== undefined) {
											let data17 = data.progress;
											const _errs51 = errors;
											if (errors === _errs51) {
												if (
													data17 &&
													typeof data17 == 'object' &&
													!Array.isArray(data17)
												) {
													const _errs53 = errors;
													for (const key7 in data17) {
														if (
															!(
																key7 ===
																	'weight' ||
																key7 ===
																	'caption'
															)
														) {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/progress',
																		schemaPath:
																			'#/oneOf/3/properties/progress/additionalProperties',
																		keyword:
																			'additionalProperties',
																		params: {
																			additionalProperty:
																				key7,
																		},
																		message:
																			'must NOT have additional properties',
																	},
																];
															return false;
															break;
														}
													}
													if (_errs53 === errors) {
														if (
															data17.weight !==
															undefined
														) {
															let data18 =
																data17.weight;
															const _errs54 =
																errors;
															if (
																!(
																	typeof data18 ==
																		'number' &&
																	isFinite(
																		data18
																	)
																)
															) {
																validate28.errors =
																	[
																		{
																			instancePath:
																				instancePath +
																				'/progress/weight',
																			schemaPath:
																				'#/oneOf/3/properties/progress/properties/weight/type',
																			keyword:
																				'type',
																			params: {
																				type: 'number',
																			},
																			message:
																				'must be number',
																		},
																	];
																return false;
															}
															var valid12 =
																_errs54 ===
																errors;
														} else {
															var valid12 = true;
														}
														if (valid12) {
															if (
																data17.caption !==
																undefined
															) {
																const _errs56 =
																	errors;
																if (
																	typeof data17.caption !==
																	'string'
																) {
																	validate28.errors =
																		[
																			{
																				instancePath:
																					instancePath +
																					'/progress/caption',
																				schemaPath:
																					'#/oneOf/3/properties/progress/properties/caption/type',
																				keyword:
																					'type',
																				params: {
																					type: 'string',
																				},
																				message:
																					'must be string',
																			},
																		];
																	return false;
																}
																var valid12 =
																	_errs56 ===
																	errors;
															} else {
																var valid12 = true;
															}
														}
													}
												} else {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/progress',
															schemaPath:
																'#/oneOf/3/properties/progress/type',
															keyword: 'type',
															params: {
																type: 'object',
															},
															message:
																'must be object',
														},
													];
													return false;
												}
											}
											var valid11 = _errs51 === errors;
										} else {
											var valid11 = true;
										}
										if (valid11) {
											if (data.step !== undefined) {
												let data20 = data.step;
												const _errs58 = errors;
												if (
													typeof data20 !== 'string'
												) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/3/properties/step/type',
															keyword: 'type',
															params: {
																type: 'string',
															},
															message:
																'must be string',
														},
													];
													return false;
												}
												if (
													'defineWpConfigConsts' !==
													data20
												) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/3/properties/step/const',
															keyword: 'const',
															params: {
																allowedValue:
																	'defineWpConfigConsts',
															},
															message:
																'must be equal to constant',
														},
													];
													return false;
												}
												var valid11 =
													_errs58 === errors;
											} else {
												var valid11 = true;
											}
											if (valid11) {
												if (data.consts !== undefined) {
													let data21 = data.consts;
													const _errs60 = errors;
													if (errors === _errs60) {
														if (
															data21 &&
															typeof data21 ==
																'object' &&
															!Array.isArray(
																data21
															)
														) {
															for (const key8 in data21) {
																const _errs63 =
																	errors;
																var valid13 =
																	_errs63 ===
																	errors;
																if (!valid13) {
																	break;
																}
															}
														} else {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/consts',
																		schemaPath:
																			'#/oneOf/3/properties/consts/type',
																		keyword:
																			'type',
																		params: {
																			type: 'object',
																		},
																		message:
																			'must be object',
																	},
																];
															return false;
														}
													}
													var valid11 =
														_errs60 === errors;
												} else {
													var valid11 = true;
												}
												if (valid11) {
													if (
														data.method !==
														undefined
													) {
														let data23 =
															data.method;
														const _errs64 = errors;
														if (
															typeof data23 !==
															'string'
														) {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/method',
																		schemaPath:
																			'#/oneOf/3/properties/method/type',
																		keyword:
																			'type',
																		params: {
																			type: 'string',
																		},
																		message:
																			'must be string',
																	},
																];
															return false;
														}
														if (
															!(
																data23 ===
																	'rewrite-wp-config' ||
																data23 ===
																	'define-before-run'
															)
														) {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/method',
																		schemaPath:
																			'#/oneOf/3/properties/method/enum',
																		keyword:
																			'enum',
																		params: {
																			allowedValues:
																				schema33
																					.oneOf[3]
																					.properties
																					.method
																					.enum,
																		},
																		message:
																			'must be equal to one of the allowed values',
																	},
																];
															return false;
														}
														var valid11 =
															_errs64 === errors;
													} else {
														var valid11 = true;
													}
													if (valid11) {
														if (
															data.virtualize !==
															undefined
														) {
															const _errs66 =
																errors;
															if (
																typeof data.virtualize !==
																'boolean'
															) {
																validate28.errors =
																	[
																		{
																			instancePath:
																				instancePath +
																				'/virtualize',
																			schemaPath:
																				'#/oneOf/3/properties/virtualize/type',
																			keyword:
																				'type',
																			params: {
																				type: 'boolean',
																			},
																			message:
																				'must be boolean',
																		},
																	];
																return false;
															}
															var valid11 =
																_errs66 ===
																errors;
														} else {
															var valid11 = true;
														}
													}
												}
											}
										}
									}
								}
							} else {
								validate28.errors = [
									{
										instancePath,
										schemaPath: '#/oneOf/3/type',
										keyword: 'type',
										params: { type: 'object' },
										message: 'must be object',
									},
								];
								return false;
							}
						}
					} else if (tag0 === 'defineSiteUrl') {
						const _errs68 = errors;
						if (errors === _errs68) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing5;
								if (
									(data.siteUrl === undefined &&
										(missing5 = 'siteUrl')) ||
									(data.step === undefined &&
										(missing5 = 'step'))
								) {
									validate28.errors = [
										{
											instancePath,
											schemaPath: '#/oneOf/4/required',
											keyword: 'required',
											params: {
												missingProperty: missing5,
											},
											message:
												"must have required property '" +
												missing5 +
												"'",
										},
									];
									return false;
								} else {
									const _errs70 = errors;
									for (const key9 in data) {
										if (
											!(
												key9 === 'progress' ||
												key9 === 'step' ||
												key9 === 'siteUrl'
											)
										) {
											validate28.errors = [
												{
													instancePath,
													schemaPath:
														'#/oneOf/4/additionalProperties',
													keyword:
														'additionalProperties',
													params: {
														additionalProperty:
															key9,
													},
													message:
														'must NOT have additional properties',
												},
											];
											return false;
											break;
										}
									}
									if (_errs70 === errors) {
										if (data.progress !== undefined) {
											let data25 = data.progress;
											const _errs71 = errors;
											if (errors === _errs71) {
												if (
													data25 &&
													typeof data25 == 'object' &&
													!Array.isArray(data25)
												) {
													const _errs73 = errors;
													for (const key10 in data25) {
														if (
															!(
																key10 ===
																	'weight' ||
																key10 ===
																	'caption'
															)
														) {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/progress',
																		schemaPath:
																			'#/oneOf/4/properties/progress/additionalProperties',
																		keyword:
																			'additionalProperties',
																		params: {
																			additionalProperty:
																				key10,
																		},
																		message:
																			'must NOT have additional properties',
																	},
																];
															return false;
															break;
														}
													}
													if (_errs73 === errors) {
														if (
															data25.weight !==
															undefined
														) {
															let data26 =
																data25.weight;
															const _errs74 =
																errors;
															if (
																!(
																	typeof data26 ==
																		'number' &&
																	isFinite(
																		data26
																	)
																)
															) {
																validate28.errors =
																	[
																		{
																			instancePath:
																				instancePath +
																				'/progress/weight',
																			schemaPath:
																				'#/oneOf/4/properties/progress/properties/weight/type',
																			keyword:
																				'type',
																			params: {
																				type: 'number',
																			},
																			message:
																				'must be number',
																		},
																	];
																return false;
															}
															var valid16 =
																_errs74 ===
																errors;
														} else {
															var valid16 = true;
														}
														if (valid16) {
															if (
																data25.caption !==
																undefined
															) {
																const _errs76 =
																	errors;
																if (
																	typeof data25.caption !==
																	'string'
																) {
																	validate28.errors =
																		[
																			{
																				instancePath:
																					instancePath +
																					'/progress/caption',
																				schemaPath:
																					'#/oneOf/4/properties/progress/properties/caption/type',
																				keyword:
																					'type',
																				params: {
																					type: 'string',
																				},
																				message:
																					'must be string',
																			},
																		];
																	return false;
																}
																var valid16 =
																	_errs76 ===
																	errors;
															} else {
																var valid16 = true;
															}
														}
													}
												} else {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/progress',
															schemaPath:
																'#/oneOf/4/properties/progress/type',
															keyword: 'type',
															params: {
																type: 'object',
															},
															message:
																'must be object',
														},
													];
													return false;
												}
											}
											var valid15 = _errs71 === errors;
										} else {
											var valid15 = true;
										}
										if (valid15) {
											if (data.step !== undefined) {
												let data28 = data.step;
												const _errs78 = errors;
												if (
													typeof data28 !== 'string'
												) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/4/properties/step/type',
															keyword: 'type',
															params: {
																type: 'string',
															},
															message:
																'must be string',
														},
													];
													return false;
												}
												if (
													'defineSiteUrl' !== data28
												) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/4/properties/step/const',
															keyword: 'const',
															params: {
																allowedValue:
																	'defineSiteUrl',
															},
															message:
																'must be equal to constant',
														},
													];
													return false;
												}
												var valid15 =
													_errs78 === errors;
											} else {
												var valid15 = true;
											}
											if (valid15) {
												if (
													data.siteUrl !== undefined
												) {
													const _errs80 = errors;
													if (
														typeof data.siteUrl !==
														'string'
													) {
														validate28.errors = [
															{
																instancePath:
																	instancePath +
																	'/siteUrl',
																schemaPath:
																	'#/oneOf/4/properties/siteUrl/type',
																keyword: 'type',
																params: {
																	type: 'string',
																},
																message:
																	'must be string',
															},
														];
														return false;
													}
													var valid15 =
														_errs80 === errors;
												} else {
													var valid15 = true;
												}
											}
										}
									}
								}
							} else {
								validate28.errors = [
									{
										instancePath,
										schemaPath: '#/oneOf/4/type',
										keyword: 'type',
										params: { type: 'object' },
										message: 'must be object',
									},
								];
								return false;
							}
						}
					} else if (tag0 === 'enableMultisite') {
						const _errs82 = errors;
						if (errors === _errs82) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing6;
								if (
									data.step === undefined &&
									(missing6 = 'step')
								) {
									validate28.errors = [
										{
											instancePath,
											schemaPath: '#/oneOf/5/required',
											keyword: 'required',
											params: {
												missingProperty: missing6,
											},
											message:
												"must have required property '" +
												missing6 +
												"'",
										},
									];
									return false;
								} else {
									const _errs84 = errors;
									for (const key11 in data) {
										if (
											!(
												key11 === 'progress' ||
												key11 === 'step' ||
												key11 === 'wpCliPath'
											)
										) {
											validate28.errors = [
												{
													instancePath,
													schemaPath:
														'#/oneOf/5/additionalProperties',
													keyword:
														'additionalProperties',
													params: {
														additionalProperty:
															key11,
													},
													message:
														'must NOT have additional properties',
												},
											];
											return false;
											break;
										}
									}
									if (_errs84 === errors) {
										if (data.progress !== undefined) {
											let data30 = data.progress;
											const _errs85 = errors;
											if (errors === _errs85) {
												if (
													data30 &&
													typeof data30 == 'object' &&
													!Array.isArray(data30)
												) {
													const _errs87 = errors;
													for (const key12 in data30) {
														if (
															!(
																key12 ===
																	'weight' ||
																key12 ===
																	'caption'
															)
														) {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/progress',
																		schemaPath:
																			'#/oneOf/5/properties/progress/additionalProperties',
																		keyword:
																			'additionalProperties',
																		params: {
																			additionalProperty:
																				key12,
																		},
																		message:
																			'must NOT have additional properties',
																	},
																];
															return false;
															break;
														}
													}
													if (_errs87 === errors) {
														if (
															data30.weight !==
															undefined
														) {
															let data31 =
																data30.weight;
															const _errs88 =
																errors;
															if (
																!(
																	typeof data31 ==
																		'number' &&
																	isFinite(
																		data31
																	)
																)
															) {
																validate28.errors =
																	[
																		{
																			instancePath:
																				instancePath +
																				'/progress/weight',
																			schemaPath:
																				'#/oneOf/5/properties/progress/properties/weight/type',
																			keyword:
																				'type',
																			params: {
																				type: 'number',
																			},
																			message:
																				'must be number',
																		},
																	];
																return false;
															}
															var valid19 =
																_errs88 ===
																errors;
														} else {
															var valid19 = true;
														}
														if (valid19) {
															if (
																data30.caption !==
																undefined
															) {
																const _errs90 =
																	errors;
																if (
																	typeof data30.caption !==
																	'string'
																) {
																	validate28.errors =
																		[
																			{
																				instancePath:
																					instancePath +
																					'/progress/caption',
																				schemaPath:
																					'#/oneOf/5/properties/progress/properties/caption/type',
																				keyword:
																					'type',
																				params: {
																					type: 'string',
																				},
																				message:
																					'must be string',
																			},
																		];
																	return false;
																}
																var valid19 =
																	_errs90 ===
																	errors;
															} else {
																var valid19 = true;
															}
														}
													}
												} else {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/progress',
															schemaPath:
																'#/oneOf/5/properties/progress/type',
															keyword: 'type',
															params: {
																type: 'object',
															},
															message:
																'must be object',
														},
													];
													return false;
												}
											}
											var valid18 = _errs85 === errors;
										} else {
											var valid18 = true;
										}
										if (valid18) {
											if (data.step !== undefined) {
												let data33 = data.step;
												const _errs92 = errors;
												if (
													typeof data33 !== 'string'
												) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/5/properties/step/type',
															keyword: 'type',
															params: {
																type: 'string',
															},
															message:
																'must be string',
														},
													];
													return false;
												}
												if (
													'enableMultisite' !== data33
												) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/5/properties/step/const',
															keyword: 'const',
															params: {
																allowedValue:
																	'enableMultisite',
															},
															message:
																'must be equal to constant',
														},
													];
													return false;
												}
												var valid18 =
													_errs92 === errors;
											} else {
												var valid18 = true;
											}
											if (valid18) {
												if (
													data.wpCliPath !== undefined
												) {
													const _errs94 = errors;
													if (
														typeof data.wpCliPath !==
														'string'
													) {
														validate28.errors = [
															{
																instancePath:
																	instancePath +
																	'/wpCliPath',
																schemaPath:
																	'#/oneOf/5/properties/wpCliPath/type',
																keyword: 'type',
																params: {
																	type: 'string',
																},
																message:
																	'must be string',
															},
														];
														return false;
													}
													var valid18 =
														_errs94 === errors;
												} else {
													var valid18 = true;
												}
											}
										}
									}
								}
							} else {
								validate28.errors = [
									{
										instancePath,
										schemaPath: '#/oneOf/5/type',
										keyword: 'type',
										params: { type: 'object' },
										message: 'must be object',
									},
								];
								return false;
							}
						}
					} else if (tag0 === 'importWxr') {
						const _errs96 = errors;
						if (errors === _errs96) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing7;
								if (
									(data.file === undefined &&
										(missing7 = 'file')) ||
									(data.step === undefined &&
										(missing7 = 'step'))
								) {
									validate28.errors = [
										{
											instancePath,
											schemaPath: '#/oneOf/6/required',
											keyword: 'required',
											params: {
												missingProperty: missing7,
											},
											message:
												"must have required property '" +
												missing7 +
												"'",
										},
									];
									return false;
								} else {
									const _errs98 = errors;
									for (const key13 in data) {
										if (
											!(
												key13 === 'progress' ||
												key13 === 'step' ||
												key13 === 'file' ||
												key13 === 'importer'
											)
										) {
											validate28.errors = [
												{
													instancePath,
													schemaPath:
														'#/oneOf/6/additionalProperties',
													keyword:
														'additionalProperties',
													params: {
														additionalProperty:
															key13,
													},
													message:
														'must NOT have additional properties',
												},
											];
											return false;
											break;
										}
									}
									if (_errs98 === errors) {
										if (data.progress !== undefined) {
											let data35 = data.progress;
											const _errs99 = errors;
											if (errors === _errs99) {
												if (
													data35 &&
													typeof data35 == 'object' &&
													!Array.isArray(data35)
												) {
													const _errs101 = errors;
													for (const key14 in data35) {
														if (
															!(
																key14 ===
																	'weight' ||
																key14 ===
																	'caption'
															)
														) {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/progress',
																		schemaPath:
																			'#/oneOf/6/properties/progress/additionalProperties',
																		keyword:
																			'additionalProperties',
																		params: {
																			additionalProperty:
																				key14,
																		},
																		message:
																			'must NOT have additional properties',
																	},
																];
															return false;
															break;
														}
													}
													if (_errs101 === errors) {
														if (
															data35.weight !==
															undefined
														) {
															let data36 =
																data35.weight;
															const _errs102 =
																errors;
															if (
																!(
																	typeof data36 ==
																		'number' &&
																	isFinite(
																		data36
																	)
																)
															) {
																validate28.errors =
																	[
																		{
																			instancePath:
																				instancePath +
																				'/progress/weight',
																			schemaPath:
																				'#/oneOf/6/properties/progress/properties/weight/type',
																			keyword:
																				'type',
																			params: {
																				type: 'number',
																			},
																			message:
																				'must be number',
																		},
																	];
																return false;
															}
															var valid22 =
																_errs102 ===
																errors;
														} else {
															var valid22 = true;
														}
														if (valid22) {
															if (
																data35.caption !==
																undefined
															) {
																const _errs104 =
																	errors;
																if (
																	typeof data35.caption !==
																	'string'
																) {
																	validate28.errors =
																		[
																			{
																				instancePath:
																					instancePath +
																					'/progress/caption',
																				schemaPath:
																					'#/oneOf/6/properties/progress/properties/caption/type',
																				keyword:
																					'type',
																				params: {
																					type: 'string',
																				},
																				message:
																					'must be string',
																			},
																		];
																	return false;
																}
																var valid22 =
																	_errs104 ===
																	errors;
															} else {
																var valid22 = true;
															}
														}
													}
												} else {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/progress',
															schemaPath:
																'#/oneOf/6/properties/progress/type',
															keyword: 'type',
															params: {
																type: 'object',
															},
															message:
																'must be object',
														},
													];
													return false;
												}
											}
											var valid21 = _errs99 === errors;
										} else {
											var valid21 = true;
										}
										if (valid21) {
											if (data.step !== undefined) {
												let data38 = data.step;
												const _errs106 = errors;
												if (
													typeof data38 !== 'string'
												) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/6/properties/step/type',
															keyword: 'type',
															params: {
																type: 'string',
															},
															message:
																'must be string',
														},
													];
													return false;
												}
												if ('importWxr' !== data38) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/6/properties/step/const',
															keyword: 'const',
															params: {
																allowedValue:
																	'importWxr',
															},
															message:
																'must be equal to constant',
														},
													];
													return false;
												}
												var valid21 =
													_errs106 === errors;
											} else {
												var valid21 = true;
											}
											if (valid21) {
												if (data.file !== undefined) {
													const _errs108 = errors;
													if (
														!validate16(data.file, {
															instancePath:
																instancePath +
																'/file',
															parentData: data,
															parentDataProperty:
																'file',
															rootData,
														})
													) {
														vErrors =
															vErrors === null
																? validate16.errors
																: vErrors.concat(
																		validate16.errors
																	);
														errors = vErrors.length;
													}
													var valid21 =
														_errs108 === errors;
												} else {
													var valid21 = true;
												}
												if (valid21) {
													if (
														data.importer !==
														undefined
													) {
														let data40 =
															data.importer;
														const _errs109 = errors;
														if (
															typeof data40 !==
															'string'
														) {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/importer',
																		schemaPath:
																			'#/oneOf/6/properties/importer/type',
																		keyword:
																			'type',
																		params: {
																			type: 'string',
																		},
																		message:
																			'must be string',
																	},
																];
															return false;
														}
														if (
															!(
																data40 ===
																	'data-liberation' ||
																data40 ===
																	'default'
															)
														) {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/importer',
																		schemaPath:
																			'#/oneOf/6/properties/importer/enum',
																		keyword:
																			'enum',
																		params: {
																			allowedValues:
																				schema33
																					.oneOf[6]
																					.properties
																					.importer
																					.enum,
																		},
																		message:
																			'must be equal to one of the allowed values',
																	},
																];
															return false;
														}
														var valid21 =
															_errs109 === errors;
													} else {
														var valid21 = true;
													}
												}
											}
										}
									}
								}
							} else {
								validate28.errors = [
									{
										instancePath,
										schemaPath: '#/oneOf/6/type',
										keyword: 'type',
										params: { type: 'object' },
										message: 'must be object',
									},
								];
								return false;
							}
						}
					} else if (tag0 === 'importThemeStarterContent') {
						const _errs111 = errors;
						if (errors === _errs111) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing8;
								if (
									data.step === undefined &&
									(missing8 = 'step')
								) {
									validate28.errors = [
										{
											instancePath,
											schemaPath: '#/oneOf/7/required',
											keyword: 'required',
											params: {
												missingProperty: missing8,
											},
											message:
												"must have required property '" +
												missing8 +
												"'",
										},
									];
									return false;
								} else {
									const _errs113 = errors;
									for (const key15 in data) {
										if (
											!(
												key15 === 'progress' ||
												key15 === 'step' ||
												key15 === 'themeSlug'
											)
										) {
											validate28.errors = [
												{
													instancePath,
													schemaPath:
														'#/oneOf/7/additionalProperties',
													keyword:
														'additionalProperties',
													params: {
														additionalProperty:
															key15,
													},
													message:
														'must NOT have additional properties',
												},
											];
											return false;
											break;
										}
									}
									if (_errs113 === errors) {
										if (data.progress !== undefined) {
											let data41 = data.progress;
											const _errs114 = errors;
											if (errors === _errs114) {
												if (
													data41 &&
													typeof data41 == 'object' &&
													!Array.isArray(data41)
												) {
													const _errs116 = errors;
													for (const key16 in data41) {
														if (
															!(
																key16 ===
																	'weight' ||
																key16 ===
																	'caption'
															)
														) {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/progress',
																		schemaPath:
																			'#/oneOf/7/properties/progress/additionalProperties',
																		keyword:
																			'additionalProperties',
																		params: {
																			additionalProperty:
																				key16,
																		},
																		message:
																			'must NOT have additional properties',
																	},
																];
															return false;
															break;
														}
													}
													if (_errs116 === errors) {
														if (
															data41.weight !==
															undefined
														) {
															let data42 =
																data41.weight;
															const _errs117 =
																errors;
															if (
																!(
																	typeof data42 ==
																		'number' &&
																	isFinite(
																		data42
																	)
																)
															) {
																validate28.errors =
																	[
																		{
																			instancePath:
																				instancePath +
																				'/progress/weight',
																			schemaPath:
																				'#/oneOf/7/properties/progress/properties/weight/type',
																			keyword:
																				'type',
																			params: {
																				type: 'number',
																			},
																			message:
																				'must be number',
																		},
																	];
																return false;
															}
															var valid25 =
																_errs117 ===
																errors;
														} else {
															var valid25 = true;
														}
														if (valid25) {
															if (
																data41.caption !==
																undefined
															) {
																const _errs119 =
																	errors;
																if (
																	typeof data41.caption !==
																	'string'
																) {
																	validate28.errors =
																		[
																			{
																				instancePath:
																					instancePath +
																					'/progress/caption',
																				schemaPath:
																					'#/oneOf/7/properties/progress/properties/caption/type',
																				keyword:
																					'type',
																				params: {
																					type: 'string',
																				},
																				message:
																					'must be string',
																			},
																		];
																	return false;
																}
																var valid25 =
																	_errs119 ===
																	errors;
															} else {
																var valid25 = true;
															}
														}
													}
												} else {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/progress',
															schemaPath:
																'#/oneOf/7/properties/progress/type',
															keyword: 'type',
															params: {
																type: 'object',
															},
															message:
																'must be object',
														},
													];
													return false;
												}
											}
											var valid24 = _errs114 === errors;
										} else {
											var valid24 = true;
										}
										if (valid24) {
											if (data.step !== undefined) {
												let data44 = data.step;
												const _errs121 = errors;
												if (
													typeof data44 !== 'string'
												) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/7/properties/step/type',
															keyword: 'type',
															params: {
																type: 'string',
															},
															message:
																'must be string',
														},
													];
													return false;
												}
												if (
													'importThemeStarterContent' !==
													data44
												) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/7/properties/step/const',
															keyword: 'const',
															params: {
																allowedValue:
																	'importThemeStarterContent',
															},
															message:
																'must be equal to constant',
														},
													];
													return false;
												}
												var valid24 =
													_errs121 === errors;
											} else {
												var valid24 = true;
											}
											if (valid24) {
												if (
													data.themeSlug !== undefined
												) {
													const _errs123 = errors;
													if (
														typeof data.themeSlug !==
														'string'
													) {
														validate28.errors = [
															{
																instancePath:
																	instancePath +
																	'/themeSlug',
																schemaPath:
																	'#/oneOf/7/properties/themeSlug/type',
																keyword: 'type',
																params: {
																	type: 'string',
																},
																message:
																	'must be string',
															},
														];
														return false;
													}
													var valid24 =
														_errs123 === errors;
												} else {
													var valid24 = true;
												}
											}
										}
									}
								}
							} else {
								validate28.errors = [
									{
										instancePath,
										schemaPath: '#/oneOf/7/type',
										keyword: 'type',
										params: { type: 'object' },
										message: 'must be object',
									},
								];
								return false;
							}
						}
					} else if (tag0 === 'importWordPressFiles') {
						const _errs125 = errors;
						if (errors === _errs125) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing9;
								if (
									(data.step === undefined &&
										(missing9 = 'step')) ||
									(data.wordPressFilesZip === undefined &&
										(missing9 = 'wordPressFilesZip'))
								) {
									validate28.errors = [
										{
											instancePath,
											schemaPath: '#/oneOf/8/required',
											keyword: 'required',
											params: {
												missingProperty: missing9,
											},
											message:
												"must have required property '" +
												missing9 +
												"'",
										},
									];
									return false;
								} else {
									const _errs127 = errors;
									for (const key17 in data) {
										if (
											!(
												key17 === 'progress' ||
												key17 === 'step' ||
												key17 === 'wordPressFilesZip' ||
												key17 === 'pathInZip'
											)
										) {
											validate28.errors = [
												{
													instancePath,
													schemaPath:
														'#/oneOf/8/additionalProperties',
													keyword:
														'additionalProperties',
													params: {
														additionalProperty:
															key17,
													},
													message:
														'must NOT have additional properties',
												},
											];
											return false;
											break;
										}
									}
									if (_errs127 === errors) {
										if (data.progress !== undefined) {
											let data46 = data.progress;
											const _errs128 = errors;
											if (errors === _errs128) {
												if (
													data46 &&
													typeof data46 == 'object' &&
													!Array.isArray(data46)
												) {
													const _errs130 = errors;
													for (const key18 in data46) {
														if (
															!(
																key18 ===
																	'weight' ||
																key18 ===
																	'caption'
															)
														) {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/progress',
																		schemaPath:
																			'#/oneOf/8/properties/progress/additionalProperties',
																		keyword:
																			'additionalProperties',
																		params: {
																			additionalProperty:
																				key18,
																		},
																		message:
																			'must NOT have additional properties',
																	},
																];
															return false;
															break;
														}
													}
													if (_errs130 === errors) {
														if (
															data46.weight !==
															undefined
														) {
															let data47 =
																data46.weight;
															const _errs131 =
																errors;
															if (
																!(
																	typeof data47 ==
																		'number' &&
																	isFinite(
																		data47
																	)
																)
															) {
																validate28.errors =
																	[
																		{
																			instancePath:
																				instancePath +
																				'/progress/weight',
																			schemaPath:
																				'#/oneOf/8/properties/progress/properties/weight/type',
																			keyword:
																				'type',
																			params: {
																				type: 'number',
																			},
																			message:
																				'must be number',
																		},
																	];
																return false;
															}
															var valid28 =
																_errs131 ===
																errors;
														} else {
															var valid28 = true;
														}
														if (valid28) {
															if (
																data46.caption !==
																undefined
															) {
																const _errs133 =
																	errors;
																if (
																	typeof data46.caption !==
																	'string'
																) {
																	validate28.errors =
																		[
																			{
																				instancePath:
																					instancePath +
																					'/progress/caption',
																				schemaPath:
																					'#/oneOf/8/properties/progress/properties/caption/type',
																				keyword:
																					'type',
																				params: {
																					type: 'string',
																				},
																				message:
																					'must be string',
																			},
																		];
																	return false;
																}
																var valid28 =
																	_errs133 ===
																	errors;
															} else {
																var valid28 = true;
															}
														}
													}
												} else {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/progress',
															schemaPath:
																'#/oneOf/8/properties/progress/type',
															keyword: 'type',
															params: {
																type: 'object',
															},
															message:
																'must be object',
														},
													];
													return false;
												}
											}
											var valid27 = _errs128 === errors;
										} else {
											var valid27 = true;
										}
										if (valid27) {
											if (data.step !== undefined) {
												let data49 = data.step;
												const _errs135 = errors;
												if (
													typeof data49 !== 'string'
												) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/8/properties/step/type',
															keyword: 'type',
															params: {
																type: 'string',
															},
															message:
																'must be string',
														},
													];
													return false;
												}
												if (
													'importWordPressFiles' !==
													data49
												) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/8/properties/step/const',
															keyword: 'const',
															params: {
																allowedValue:
																	'importWordPressFiles',
															},
															message:
																'must be equal to constant',
														},
													];
													return false;
												}
												var valid27 =
													_errs135 === errors;
											} else {
												var valid27 = true;
											}
											if (valid27) {
												if (
													data.wordPressFilesZip !==
													undefined
												) {
													const _errs137 = errors;
													if (
														!validate16(
															data.wordPressFilesZip,
															{
																instancePath:
																	instancePath +
																	'/wordPressFilesZip',
																parentData:
																	data,
																parentDataProperty:
																	'wordPressFilesZip',
																rootData,
															}
														)
													) {
														vErrors =
															vErrors === null
																? validate16.errors
																: vErrors.concat(
																		validate16.errors
																	);
														errors = vErrors.length;
													}
													var valid27 =
														_errs137 === errors;
												} else {
													var valid27 = true;
												}
												if (valid27) {
													if (
														data.pathInZip !==
														undefined
													) {
														const _errs138 = errors;
														if (
															typeof data.pathInZip !==
															'string'
														) {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/pathInZip',
																		schemaPath:
																			'#/oneOf/8/properties/pathInZip/type',
																		keyword:
																			'type',
																		params: {
																			type: 'string',
																		},
																		message:
																			'must be string',
																	},
																];
															return false;
														}
														var valid27 =
															_errs138 === errors;
													} else {
														var valid27 = true;
													}
												}
											}
										}
									}
								}
							} else {
								validate28.errors = [
									{
										instancePath,
										schemaPath: '#/oneOf/8/type',
										keyword: 'type',
										params: { type: 'object' },
										message: 'must be object',
									},
								];
								return false;
							}
						}
					} else if (tag0 === 'installPlugin') {
						const _errs140 = errors;
						if (errors === _errs140) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing10;
								if (
									(data.pluginData === undefined &&
										(missing10 = 'pluginData')) ||
									(data.step === undefined &&
										(missing10 = 'step'))
								) {
									validate28.errors = [
										{
											instancePath,
											schemaPath: '#/oneOf/9/required',
											keyword: 'required',
											params: {
												missingProperty: missing10,
											},
											message:
												"must have required property '" +
												missing10 +
												"'",
										},
									];
									return false;
								} else {
									const _errs142 = errors;
									for (const key19 in data) {
										if (
											!(
												key19 === 'progress' ||
												key19 ===
													'ifAlreadyInstalled' ||
												key19 === 'step' ||
												key19 === 'pluginData' ||
												key19 === 'pluginZipFile' ||
												key19 === 'options'
											)
										) {
											validate28.errors = [
												{
													instancePath,
													schemaPath:
														'#/oneOf/9/additionalProperties',
													keyword:
														'additionalProperties',
													params: {
														additionalProperty:
															key19,
													},
													message:
														'must NOT have additional properties',
												},
											];
											return false;
											break;
										}
									}
									if (_errs142 === errors) {
										if (data.progress !== undefined) {
											let data52 = data.progress;
											const _errs143 = errors;
											if (errors === _errs143) {
												if (
													data52 &&
													typeof data52 == 'object' &&
													!Array.isArray(data52)
												) {
													const _errs145 = errors;
													for (const key20 in data52) {
														if (
															!(
																key20 ===
																	'weight' ||
																key20 ===
																	'caption'
															)
														) {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/progress',
																		schemaPath:
																			'#/oneOf/9/properties/progress/additionalProperties',
																		keyword:
																			'additionalProperties',
																		params: {
																			additionalProperty:
																				key20,
																		},
																		message:
																			'must NOT have additional properties',
																	},
																];
															return false;
															break;
														}
													}
													if (_errs145 === errors) {
														if (
															data52.weight !==
															undefined
														) {
															let data53 =
																data52.weight;
															const _errs146 =
																errors;
															if (
																!(
																	typeof data53 ==
																		'number' &&
																	isFinite(
																		data53
																	)
																)
															) {
																validate28.errors =
																	[
																		{
																			instancePath:
																				instancePath +
																				'/progress/weight',
																			schemaPath:
																				'#/oneOf/9/properties/progress/properties/weight/type',
																			keyword:
																				'type',
																			params: {
																				type: 'number',
																			},
																			message:
																				'must be number',
																		},
																	];
																return false;
															}
															var valid31 =
																_errs146 ===
																errors;
														} else {
															var valid31 = true;
														}
														if (valid31) {
															if (
																data52.caption !==
																undefined
															) {
																const _errs148 =
																	errors;
																if (
																	typeof data52.caption !==
																	'string'
																) {
																	validate28.errors =
																		[
																			{
																				instancePath:
																					instancePath +
																					'/progress/caption',
																				schemaPath:
																					'#/oneOf/9/properties/progress/properties/caption/type',
																				keyword:
																					'type',
																				params: {
																					type: 'string',
																				},
																				message:
																					'must be string',
																			},
																		];
																	return false;
																}
																var valid31 =
																	_errs148 ===
																	errors;
															} else {
																var valid31 = true;
															}
														}
													}
												} else {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/progress',
															schemaPath:
																'#/oneOf/9/properties/progress/type',
															keyword: 'type',
															params: {
																type: 'object',
															},
															message:
																'must be object',
														},
													];
													return false;
												}
											}
											var valid30 = _errs143 === errors;
										} else {
											var valid30 = true;
										}
										if (valid30) {
											if (
												data.ifAlreadyInstalled !==
												undefined
											) {
												let data55 =
													data.ifAlreadyInstalled;
												const _errs150 = errors;
												if (
													typeof data55 !== 'string'
												) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/ifAlreadyInstalled',
															schemaPath:
																'#/oneOf/9/properties/ifAlreadyInstalled/type',
															keyword: 'type',
															params: {
																type: 'string',
															},
															message:
																'must be string',
														},
													];
													return false;
												}
												if (
													!(
														data55 ===
															'overwrite' ||
														data55 === 'skip' ||
														data55 === 'error'
													)
												) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/ifAlreadyInstalled',
															schemaPath:
																'#/oneOf/9/properties/ifAlreadyInstalled/enum',
															keyword: 'enum',
															params: {
																allowedValues:
																	schema33
																		.oneOf[9]
																		.properties
																		.ifAlreadyInstalled
																		.enum,
															},
															message:
																'must be equal to one of the allowed values',
														},
													];
													return false;
												}
												var valid30 =
													_errs150 === errors;
											} else {
												var valid30 = true;
											}
											if (valid30) {
												if (data.step !== undefined) {
													let data56 = data.step;
													const _errs152 = errors;
													if (
														typeof data56 !==
														'string'
													) {
														validate28.errors = [
															{
																instancePath:
																	instancePath +
																	'/step',
																schemaPath:
																	'#/oneOf/9/properties/step/type',
																keyword: 'type',
																params: {
																	type: 'string',
																},
																message:
																	'must be string',
															},
														];
														return false;
													}
													if (
														'installPlugin' !==
														data56
													) {
														validate28.errors = [
															{
																instancePath:
																	instancePath +
																	'/step',
																schemaPath:
																	'#/oneOf/9/properties/step/const',
																keyword:
																	'const',
																params: {
																	allowedValue:
																		'installPlugin',
																},
																message:
																	'must be equal to constant',
															},
														];
														return false;
													}
													var valid30 =
														_errs152 === errors;
												} else {
													var valid30 = true;
												}
												if (valid30) {
													if (
														data.pluginData !==
														undefined
													) {
														let data57 =
															data.pluginData;
														const _errs154 = errors;
														const _errs155 = errors;
														let valid32 = false;
														const _errs156 = errors;
														if (
															!validate16(
																data57,
																{
																	instancePath:
																		instancePath +
																		'/pluginData',
																	parentData:
																		data,
																	parentDataProperty:
																		'pluginData',
																	rootData,
																}
															)
														) {
															vErrors =
																vErrors === null
																	? validate16.errors
																	: vErrors.concat(
																			validate16.errors
																		);
															errors =
																vErrors.length;
														}
														var _valid0 =
															_errs156 === errors;
														valid32 =
															valid32 || _valid0;
														if (!valid32) {
															const _errs157 =
																errors;
															if (
																!validate18(
																	data57,
																	{
																		instancePath:
																			instancePath +
																			'/pluginData',
																		parentData:
																			data,
																		parentDataProperty:
																			'pluginData',
																		rootData,
																	}
																)
															) {
																vErrors =
																	vErrors ===
																	null
																		? validate18.errors
																		: vErrors.concat(
																				validate18.errors
																			);
																errors =
																	vErrors.length;
															}
															var _valid0 =
																_errs157 ===
																errors;
															valid32 =
																valid32 ||
																_valid0;
														}
														if (!valid32) {
															const err0 = {
																instancePath:
																	instancePath +
																	'/pluginData',
																schemaPath:
																	'#/oneOf/9/properties/pluginData/anyOf',
																keyword:
																	'anyOf',
																params: {},
																message:
																	'must match a schema in anyOf',
															};
															if (
																vErrors === null
															) {
																vErrors = [
																	err0,
																];
															} else {
																vErrors.push(
																	err0
																);
															}
															errors++;
															validate28.errors =
																vErrors;
															return false;
														} else {
															errors = _errs155;
															if (
																vErrors !== null
															) {
																if (_errs155) {
																	vErrors.length =
																		_errs155;
																} else {
																	vErrors =
																		null;
																}
															}
														}
														var valid30 =
															_errs154 === errors;
													} else {
														var valid30 = true;
													}
													if (valid30) {
														if (
															data.pluginZipFile !==
															undefined
														) {
															const _errs158 =
																errors;
															if (
																!validate16(
																	data.pluginZipFile,
																	{
																		instancePath:
																			instancePath +
																			'/pluginZipFile',
																		parentData:
																			data,
																		parentDataProperty:
																			'pluginZipFile',
																		rootData,
																	}
																)
															) {
																vErrors =
																	vErrors ===
																	null
																		? validate16.errors
																		: vErrors.concat(
																				validate16.errors
																			);
																errors =
																	vErrors.length;
															}
															var valid30 =
																_errs158 ===
																errors;
														} else {
															var valid30 = true;
														}
														if (valid30) {
															if (
																data.options !==
																undefined
															) {
																let data59 =
																	data.options;
																const _errs159 =
																	errors;
																const _errs160 =
																	errors;
																if (
																	errors ===
																	_errs160
																) {
																	if (
																		data59 &&
																		typeof data59 ==
																			'object' &&
																		!Array.isArray(
																			data59
																		)
																	) {
																		const _errs162 =
																			errors;
																		for (const key21 in data59) {
																			if (
																				!(
																					key21 ===
																						'activate' ||
																					key21 ===
																						'activationOptions' ||
																					key21 ===
																						'onError' ||
																					key21 ===
																						'targetFolderName' ||
																					key21 ===
																						'humanReadableName'
																				)
																			) {
																				validate28.errors =
																					[
																						{
																							instancePath:
																								instancePath +
																								'/options',
																							schemaPath:
																								'#/definitions/InstallPluginOptions/additionalProperties',
																							keyword:
																								'additionalProperties',
																							params: {
																								additionalProperty:
																									key21,
																							},
																							message:
																								'must NOT have additional properties',
																						},
																					];
																				return false;
																				break;
																			}
																		}
																		if (
																			_errs162 ===
																			errors
																		) {
																			if (
																				data59.activate !==
																				undefined
																			) {
																				const _errs163 =
																					errors;
																				if (
																					typeof data59.activate !==
																					'boolean'
																				) {
																					validate28.errors =
																						[
																							{
																								instancePath:
																									instancePath +
																									'/options/activate',
																								schemaPath:
																									'#/definitions/InstallPluginOptions/properties/activate/type',
																								keyword:
																									'type',
																								params: {
																									type: 'boolean',
																								},
																								message:
																									'must be boolean',
																							},
																						];
																					return false;
																				}
																				var valid34 =
																					_errs163 ===
																					errors;
																			} else {
																				var valid34 = true;
																			}
																			if (
																				valid34
																			) {
																				if (
																					data59.activationOptions !==
																					undefined
																				) {
																					let data61 =
																						data59.activationOptions;
																					const _errs165 =
																						errors;
																					if (
																						errors ===
																						_errs165
																					) {
																						if (
																							data61 &&
																							typeof data61 ==
																								'object' &&
																							!Array.isArray(
																								data61
																							)
																						) {
																							for (const key22 in data61) {
																								const _errs168 =
																									errors;
																								var valid35 =
																									_errs168 ===
																									errors;
																								if (
																									!valid35
																								) {
																									break;
																								}
																							}
																						} else {
																							validate28.errors =
																								[
																									{
																										instancePath:
																											instancePath +
																											'/options/activationOptions',
																										schemaPath:
																											'#/definitions/InstallPluginOptions/properties/activationOptions/type',
																										keyword:
																											'type',
																										params: {
																											type: 'object',
																										},
																										message:
																											'must be object',
																									},
																								];
																							return false;
																						}
																					}
																					var valid34 =
																						_errs165 ===
																						errors;
																				} else {
																					var valid34 = true;
																				}
																				if (
																					valid34
																				) {
																					if (
																						data59.onError !==
																						undefined
																					) {
																						let data63 =
																							data59.onError;
																						const _errs169 =
																							errors;
																						if (
																							typeof data63 !==
																							'string'
																						) {
																							validate28.errors =
																								[
																									{
																										instancePath:
																											instancePath +
																											'/options/onError',
																										schemaPath:
																											'#/definitions/InstallPluginOptions/properties/onError/type',
																										keyword:
																											'type',
																										params: {
																											type: 'string',
																										},
																										message:
																											'must be string',
																									},
																								];
																							return false;
																						}
																						if (
																							!(
																								data63 ===
																									'skip-plugin' ||
																								data63 ===
																									'throw'
																							)
																						) {
																							validate28.errors =
																								[
																									{
																										instancePath:
																											instancePath +
																											'/options/onError',
																										schemaPath:
																											'#/definitions/InstallPluginOptions/properties/onError/enum',
																										keyword:
																											'enum',
																										params: {
																											allowedValues:
																												schema34
																													.properties
																													.onError
																													.enum,
																										},
																										message:
																											'must be equal to one of the allowed values',
																									},
																								];
																							return false;
																						}
																						var valid34 =
																							_errs169 ===
																							errors;
																					} else {
																						var valid34 = true;
																					}
																					if (
																						valid34
																					) {
																						if (
																							data59.targetFolderName !==
																							undefined
																						) {
																							const _errs171 =
																								errors;
																							if (
																								typeof data59.targetFolderName !==
																								'string'
																							) {
																								validate28.errors =
																									[
																										{
																											instancePath:
																												instancePath +
																												'/options/targetFolderName',
																											schemaPath:
																												'#/definitions/InstallPluginOptions/properties/targetFolderName/type',
																											keyword:
																												'type',
																											params: {
																												type: 'string',
																											},
																											message:
																												'must be string',
																										},
																									];
																								return false;
																							}
																							var valid34 =
																								_errs171 ===
																								errors;
																						} else {
																							var valid34 = true;
																						}
																						if (
																							valid34
																						) {
																							if (
																								data59.humanReadableName !==
																								undefined
																							) {
																								const _errs173 =
																									errors;
																								if (
																									typeof data59.humanReadableName !==
																									'string'
																								) {
																									validate28.errors =
																										[
																											{
																												instancePath:
																													instancePath +
																													'/options/humanReadableName',
																												schemaPath:
																													'#/definitions/InstallPluginOptions/properties/humanReadableName/type',
																												keyword:
																													'type',
																												params: {
																													type: 'string',
																												},
																												message:
																													'must be string',
																											},
																										];
																									return false;
																								}
																								var valid34 =
																									_errs173 ===
																									errors;
																							} else {
																								var valid34 = true;
																							}
																						}
																					}
																				}
																			}
																		}
																	} else {
																		validate28.errors =
																			[
																				{
																					instancePath:
																						instancePath +
																						'/options',
																					schemaPath:
																						'#/definitions/InstallPluginOptions/type',
																					keyword:
																						'type',
																					params: {
																						type: 'object',
																					},
																					message:
																						'must be object',
																				},
																			];
																		return false;
																	}
																}
																var valid30 =
																	_errs159 ===
																	errors;
															} else {
																var valid30 = true;
															}
														}
													}
												}
											}
										}
									}
								}
							} else {
								validate28.errors = [
									{
										instancePath,
										schemaPath: '#/oneOf/9/type',
										keyword: 'type',
										params: { type: 'object' },
										message: 'must be object',
									},
								];
								return false;
							}
						}
					} else if (tag0 === 'installTheme') {
						const _errs175 = errors;
						if (errors === _errs175) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing11;
								if (
									(data.step === undefined &&
										(missing11 = 'step')) ||
									(data.themeData === undefined &&
										(missing11 = 'themeData'))
								) {
									validate28.errors = [
										{
											instancePath,
											schemaPath: '#/oneOf/10/required',
											keyword: 'required',
											params: {
												missingProperty: missing11,
											},
											message:
												"must have required property '" +
												missing11 +
												"'",
										},
									];
									return false;
								} else {
									const _errs177 = errors;
									for (const key23 in data) {
										if (
											!(
												key23 === 'progress' ||
												key23 ===
													'ifAlreadyInstalled' ||
												key23 === 'step' ||
												key23 === 'themeData' ||
												key23 === 'themeZipFile' ||
												key23 === 'options'
											)
										) {
											validate28.errors = [
												{
													instancePath,
													schemaPath:
														'#/oneOf/10/additionalProperties',
													keyword:
														'additionalProperties',
													params: {
														additionalProperty:
															key23,
													},
													message:
														'must NOT have additional properties',
												},
											];
											return false;
											break;
										}
									}
									if (_errs177 === errors) {
										if (data.progress !== undefined) {
											let data66 = data.progress;
											const _errs178 = errors;
											if (errors === _errs178) {
												if (
													data66 &&
													typeof data66 == 'object' &&
													!Array.isArray(data66)
												) {
													const _errs180 = errors;
													for (const key24 in data66) {
														if (
															!(
																key24 ===
																	'weight' ||
																key24 ===
																	'caption'
															)
														) {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/progress',
																		schemaPath:
																			'#/oneOf/10/properties/progress/additionalProperties',
																		keyword:
																			'additionalProperties',
																		params: {
																			additionalProperty:
																				key24,
																		},
																		message:
																			'must NOT have additional properties',
																	},
																];
															return false;
															break;
														}
													}
													if (_errs180 === errors) {
														if (
															data66.weight !==
															undefined
														) {
															let data67 =
																data66.weight;
															const _errs181 =
																errors;
															if (
																!(
																	typeof data67 ==
																		'number' &&
																	isFinite(
																		data67
																	)
																)
															) {
																validate28.errors =
																	[
																		{
																			instancePath:
																				instancePath +
																				'/progress/weight',
																			schemaPath:
																				'#/oneOf/10/properties/progress/properties/weight/type',
																			keyword:
																				'type',
																			params: {
																				type: 'number',
																			},
																			message:
																				'must be number',
																		},
																	];
																return false;
															}
															var valid38 =
																_errs181 ===
																errors;
														} else {
															var valid38 = true;
														}
														if (valid38) {
															if (
																data66.caption !==
																undefined
															) {
																const _errs183 =
																	errors;
																if (
																	typeof data66.caption !==
																	'string'
																) {
																	validate28.errors =
																		[
																			{
																				instancePath:
																					instancePath +
																					'/progress/caption',
																				schemaPath:
																					'#/oneOf/10/properties/progress/properties/caption/type',
																				keyword:
																					'type',
																				params: {
																					type: 'string',
																				},
																				message:
																					'must be string',
																			},
																		];
																	return false;
																}
																var valid38 =
																	_errs183 ===
																	errors;
															} else {
																var valid38 = true;
															}
														}
													}
												} else {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/progress',
															schemaPath:
																'#/oneOf/10/properties/progress/type',
															keyword: 'type',
															params: {
																type: 'object',
															},
															message:
																'must be object',
														},
													];
													return false;
												}
											}
											var valid37 = _errs178 === errors;
										} else {
											var valid37 = true;
										}
										if (valid37) {
											if (
												data.ifAlreadyInstalled !==
												undefined
											) {
												let data69 =
													data.ifAlreadyInstalled;
												const _errs185 = errors;
												if (
													typeof data69 !== 'string'
												) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/ifAlreadyInstalled',
															schemaPath:
																'#/oneOf/10/properties/ifAlreadyInstalled/type',
															keyword: 'type',
															params: {
																type: 'string',
															},
															message:
																'must be string',
														},
													];
													return false;
												}
												if (
													!(
														data69 ===
															'overwrite' ||
														data69 === 'skip' ||
														data69 === 'error'
													)
												) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/ifAlreadyInstalled',
															schemaPath:
																'#/oneOf/10/properties/ifAlreadyInstalled/enum',
															keyword: 'enum',
															params: {
																allowedValues:
																	schema33
																		.oneOf[10]
																		.properties
																		.ifAlreadyInstalled
																		.enum,
															},
															message:
																'must be equal to one of the allowed values',
														},
													];
													return false;
												}
												var valid37 =
													_errs185 === errors;
											} else {
												var valid37 = true;
											}
											if (valid37) {
												if (data.step !== undefined) {
													let data70 = data.step;
													const _errs187 = errors;
													if (
														typeof data70 !==
														'string'
													) {
														validate28.errors = [
															{
																instancePath:
																	instancePath +
																	'/step',
																schemaPath:
																	'#/oneOf/10/properties/step/type',
																keyword: 'type',
																params: {
																	type: 'string',
																},
																message:
																	'must be string',
															},
														];
														return false;
													}
													if (
														'installTheme' !==
														data70
													) {
														validate28.errors = [
															{
																instancePath:
																	instancePath +
																	'/step',
																schemaPath:
																	'#/oneOf/10/properties/step/const',
																keyword:
																	'const',
																params: {
																	allowedValue:
																		'installTheme',
																},
																message:
																	'must be equal to constant',
															},
														];
														return false;
													}
													var valid37 =
														_errs187 === errors;
												} else {
													var valid37 = true;
												}
												if (valid37) {
													if (
														data.themeData !==
														undefined
													) {
														let data71 =
															data.themeData;
														const _errs189 = errors;
														const _errs190 = errors;
														let valid39 = false;
														const _errs191 = errors;
														if (
															!validate16(
																data71,
																{
																	instancePath:
																		instancePath +
																		'/themeData',
																	parentData:
																		data,
																	parentDataProperty:
																		'themeData',
																	rootData,
																}
															)
														) {
															vErrors =
																vErrors === null
																	? validate16.errors
																	: vErrors.concat(
																			validate16.errors
																		);
															errors =
																vErrors.length;
														}
														var _valid1 =
															_errs191 === errors;
														valid39 =
															valid39 || _valid1;
														if (!valid39) {
															const _errs192 =
																errors;
															if (
																!validate18(
																	data71,
																	{
																		instancePath:
																			instancePath +
																			'/themeData',
																		parentData:
																			data,
																		parentDataProperty:
																			'themeData',
																		rootData,
																	}
																)
															) {
																vErrors =
																	vErrors ===
																	null
																		? validate18.errors
																		: vErrors.concat(
																				validate18.errors
																			);
																errors =
																	vErrors.length;
															}
															var _valid1 =
																_errs192 ===
																errors;
															valid39 =
																valid39 ||
																_valid1;
														}
														if (!valid39) {
															const err1 = {
																instancePath:
																	instancePath +
																	'/themeData',
																schemaPath:
																	'#/oneOf/10/properties/themeData/anyOf',
																keyword:
																	'anyOf',
																params: {},
																message:
																	'must match a schema in anyOf',
															};
															if (
																vErrors === null
															) {
																vErrors = [
																	err1,
																];
															} else {
																vErrors.push(
																	err1
																);
															}
															errors++;
															validate28.errors =
																vErrors;
															return false;
														} else {
															errors = _errs190;
															if (
																vErrors !== null
															) {
																if (_errs190) {
																	vErrors.length =
																		_errs190;
																} else {
																	vErrors =
																		null;
																}
															}
														}
														var valid37 =
															_errs189 === errors;
													} else {
														var valid37 = true;
													}
													if (valid37) {
														if (
															data.themeZipFile !==
															undefined
														) {
															const _errs193 =
																errors;
															if (
																!validate16(
																	data.themeZipFile,
																	{
																		instancePath:
																			instancePath +
																			'/themeZipFile',
																		parentData:
																			data,
																		parentDataProperty:
																			'themeZipFile',
																		rootData,
																	}
																)
															) {
																vErrors =
																	vErrors ===
																	null
																		? validate16.errors
																		: vErrors.concat(
																				validate16.errors
																			);
																errors =
																	vErrors.length;
															}
															var valid37 =
																_errs193 ===
																errors;
														} else {
															var valid37 = true;
														}
														if (valid37) {
															if (
																data.options !==
																undefined
															) {
																let data73 =
																	data.options;
																const _errs194 =
																	errors;
																const _errs195 =
																	errors;
																if (
																	errors ===
																	_errs195
																) {
																	if (
																		data73 &&
																		typeof data73 ==
																			'object' &&
																		!Array.isArray(
																			data73
																		)
																	) {
																		const _errs197 =
																			errors;
																		for (const key25 in data73) {
																			if (
																				!(
																					key25 ===
																						'activate' ||
																					key25 ===
																						'importStarterContent' ||
																					key25 ===
																						'targetFolderName'
																				)
																			) {
																				validate28.errors =
																					[
																						{
																							instancePath:
																								instancePath +
																								'/options',
																							schemaPath:
																								'#/definitions/InstallThemeOptions/additionalProperties',
																							keyword:
																								'additionalProperties',
																							params: {
																								additionalProperty:
																									key25,
																							},
																							message:
																								'must NOT have additional properties',
																						},
																					];
																				return false;
																				break;
																			}
																		}
																		if (
																			_errs197 ===
																			errors
																		) {
																			if (
																				data73.activate !==
																				undefined
																			) {
																				const _errs198 =
																					errors;
																				if (
																					typeof data73.activate !==
																					'boolean'
																				) {
																					validate28.errors =
																						[
																							{
																								instancePath:
																									instancePath +
																									'/options/activate',
																								schemaPath:
																									'#/definitions/InstallThemeOptions/properties/activate/type',
																								keyword:
																									'type',
																								params: {
																									type: 'boolean',
																								},
																								message:
																									'must be boolean',
																							},
																						];
																					return false;
																				}
																				var valid41 =
																					_errs198 ===
																					errors;
																			} else {
																				var valid41 = true;
																			}
																			if (
																				valid41
																			) {
																				if (
																					data73.importStarterContent !==
																					undefined
																				) {
																					const _errs200 =
																						errors;
																					if (
																						typeof data73.importStarterContent !==
																						'boolean'
																					) {
																						validate28.errors =
																							[
																								{
																									instancePath:
																										instancePath +
																										'/options/importStarterContent',
																									schemaPath:
																										'#/definitions/InstallThemeOptions/properties/importStarterContent/type',
																									keyword:
																										'type',
																									params: {
																										type: 'boolean',
																									},
																									message:
																										'must be boolean',
																								},
																							];
																						return false;
																					}
																					var valid41 =
																						_errs200 ===
																						errors;
																				} else {
																					var valid41 = true;
																				}
																				if (
																					valid41
																				) {
																					if (
																						data73.targetFolderName !==
																						undefined
																					) {
																						const _errs202 =
																							errors;
																						if (
																							typeof data73.targetFolderName !==
																							'string'
																						) {
																							validate28.errors =
																								[
																									{
																										instancePath:
																											instancePath +
																											'/options/targetFolderName',
																										schemaPath:
																											'#/definitions/InstallThemeOptions/properties/targetFolderName/type',
																										keyword:
																											'type',
																										params: {
																											type: 'string',
																										},
																										message:
																											'must be string',
																									},
																								];
																							return false;
																						}
																						var valid41 =
																							_errs202 ===
																							errors;
																					} else {
																						var valid41 = true;
																					}
																				}
																			}
																		}
																	} else {
																		validate28.errors =
																			[
																				{
																					instancePath:
																						instancePath +
																						'/options',
																					schemaPath:
																						'#/definitions/InstallThemeOptions/type',
																					keyword:
																						'type',
																					params: {
																						type: 'object',
																					},
																					message:
																						'must be object',
																				},
																			];
																		return false;
																	}
																}
																var valid37 =
																	_errs194 ===
																	errors;
															} else {
																var valid37 = true;
															}
														}
													}
												}
											}
										}
									}
								}
							} else {
								validate28.errors = [
									{
										instancePath,
										schemaPath: '#/oneOf/10/type',
										keyword: 'type',
										params: { type: 'object' },
										message: 'must be object',
									},
								];
								return false;
							}
						}
					} else if (tag0 === 'login') {
						const _errs204 = errors;
						if (errors === _errs204) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing12;
								if (
									data.step === undefined &&
									(missing12 = 'step')
								) {
									validate28.errors = [
										{
											instancePath,
											schemaPath: '#/oneOf/11/required',
											keyword: 'required',
											params: {
												missingProperty: missing12,
											},
											message:
												"must have required property '" +
												missing12 +
												"'",
										},
									];
									return false;
								} else {
									const _errs206 = errors;
									for (const key26 in data) {
										if (
											!(
												key26 === 'progress' ||
												key26 === 'step' ||
												key26 === 'username' ||
												key26 === 'password'
											)
										) {
											validate28.errors = [
												{
													instancePath,
													schemaPath:
														'#/oneOf/11/additionalProperties',
													keyword:
														'additionalProperties',
													params: {
														additionalProperty:
															key26,
													},
													message:
														'must NOT have additional properties',
												},
											];
											return false;
											break;
										}
									}
									if (_errs206 === errors) {
										if (data.progress !== undefined) {
											let data77 = data.progress;
											const _errs207 = errors;
											if (errors === _errs207) {
												if (
													data77 &&
													typeof data77 == 'object' &&
													!Array.isArray(data77)
												) {
													const _errs209 = errors;
													for (const key27 in data77) {
														if (
															!(
																key27 ===
																	'weight' ||
																key27 ===
																	'caption'
															)
														) {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/progress',
																		schemaPath:
																			'#/oneOf/11/properties/progress/additionalProperties',
																		keyword:
																			'additionalProperties',
																		params: {
																			additionalProperty:
																				key27,
																		},
																		message:
																			'must NOT have additional properties',
																	},
																];
															return false;
															break;
														}
													}
													if (_errs209 === errors) {
														if (
															data77.weight !==
															undefined
														) {
															let data78 =
																data77.weight;
															const _errs210 =
																errors;
															if (
																!(
																	typeof data78 ==
																		'number' &&
																	isFinite(
																		data78
																	)
																)
															) {
																validate28.errors =
																	[
																		{
																			instancePath:
																				instancePath +
																				'/progress/weight',
																			schemaPath:
																				'#/oneOf/11/properties/progress/properties/weight/type',
																			keyword:
																				'type',
																			params: {
																				type: 'number',
																			},
																			message:
																				'must be number',
																		},
																	];
																return false;
															}
															var valid44 =
																_errs210 ===
																errors;
														} else {
															var valid44 = true;
														}
														if (valid44) {
															if (
																data77.caption !==
																undefined
															) {
																const _errs212 =
																	errors;
																if (
																	typeof data77.caption !==
																	'string'
																) {
																	validate28.errors =
																		[
																			{
																				instancePath:
																					instancePath +
																					'/progress/caption',
																				schemaPath:
																					'#/oneOf/11/properties/progress/properties/caption/type',
																				keyword:
																					'type',
																				params: {
																					type: 'string',
																				},
																				message:
																					'must be string',
																			},
																		];
																	return false;
																}
																var valid44 =
																	_errs212 ===
																	errors;
															} else {
																var valid44 = true;
															}
														}
													}
												} else {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/progress',
															schemaPath:
																'#/oneOf/11/properties/progress/type',
															keyword: 'type',
															params: {
																type: 'object',
															},
															message:
																'must be object',
														},
													];
													return false;
												}
											}
											var valid43 = _errs207 === errors;
										} else {
											var valid43 = true;
										}
										if (valid43) {
											if (data.step !== undefined) {
												let data80 = data.step;
												const _errs214 = errors;
												if (
													typeof data80 !== 'string'
												) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/11/properties/step/type',
															keyword: 'type',
															params: {
																type: 'string',
															},
															message:
																'must be string',
														},
													];
													return false;
												}
												if ('login' !== data80) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/11/properties/step/const',
															keyword: 'const',
															params: {
																allowedValue:
																	'login',
															},
															message:
																'must be equal to constant',
														},
													];
													return false;
												}
												var valid43 =
													_errs214 === errors;
											} else {
												var valid43 = true;
											}
											if (valid43) {
												if (
													data.username !== undefined
												) {
													const _errs216 = errors;
													if (
														typeof data.username !==
														'string'
													) {
														validate28.errors = [
															{
																instancePath:
																	instancePath +
																	'/username',
																schemaPath:
																	'#/oneOf/11/properties/username/type',
																keyword: 'type',
																params: {
																	type: 'string',
																},
																message:
																	'must be string',
															},
														];
														return false;
													}
													var valid43 =
														_errs216 === errors;
												} else {
													var valid43 = true;
												}
												if (valid43) {
													if (
														data.password !==
														undefined
													) {
														const _errs218 = errors;
														if (
															typeof data.password !==
															'string'
														) {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/password',
																		schemaPath:
																			'#/oneOf/11/properties/password/type',
																		keyword:
																			'type',
																		params: {
																			type: 'string',
																		},
																		message:
																			'must be string',
																	},
																];
															return false;
														}
														var valid43 =
															_errs218 === errors;
													} else {
														var valid43 = true;
													}
												}
											}
										}
									}
								}
							} else {
								validate28.errors = [
									{
										instancePath,
										schemaPath: '#/oneOf/11/type',
										keyword: 'type',
										params: { type: 'object' },
										message: 'must be object',
									},
								];
								return false;
							}
						}
					} else if (tag0 === 'mkdir') {
						const _errs220 = errors;
						if (errors === _errs220) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing13;
								if (
									(data.path === undefined &&
										(missing13 = 'path')) ||
									(data.step === undefined &&
										(missing13 = 'step'))
								) {
									validate28.errors = [
										{
											instancePath,
											schemaPath: '#/oneOf/12/required',
											keyword: 'required',
											params: {
												missingProperty: missing13,
											},
											message:
												"must have required property '" +
												missing13 +
												"'",
										},
									];
									return false;
								} else {
									const _errs222 = errors;
									for (const key28 in data) {
										if (
											!(
												key28 === 'progress' ||
												key28 === 'step' ||
												key28 === 'path'
											)
										) {
											validate28.errors = [
												{
													instancePath,
													schemaPath:
														'#/oneOf/12/additionalProperties',
													keyword:
														'additionalProperties',
													params: {
														additionalProperty:
															key28,
													},
													message:
														'must NOT have additional properties',
												},
											];
											return false;
											break;
										}
									}
									if (_errs222 === errors) {
										if (data.progress !== undefined) {
											let data83 = data.progress;
											const _errs223 = errors;
											if (errors === _errs223) {
												if (
													data83 &&
													typeof data83 == 'object' &&
													!Array.isArray(data83)
												) {
													const _errs225 = errors;
													for (const key29 in data83) {
														if (
															!(
																key29 ===
																	'weight' ||
																key29 ===
																	'caption'
															)
														) {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/progress',
																		schemaPath:
																			'#/oneOf/12/properties/progress/additionalProperties',
																		keyword:
																			'additionalProperties',
																		params: {
																			additionalProperty:
																				key29,
																		},
																		message:
																			'must NOT have additional properties',
																	},
																];
															return false;
															break;
														}
													}
													if (_errs225 === errors) {
														if (
															data83.weight !==
															undefined
														) {
															let data84 =
																data83.weight;
															const _errs226 =
																errors;
															if (
																!(
																	typeof data84 ==
																		'number' &&
																	isFinite(
																		data84
																	)
																)
															) {
																validate28.errors =
																	[
																		{
																			instancePath:
																				instancePath +
																				'/progress/weight',
																			schemaPath:
																				'#/oneOf/12/properties/progress/properties/weight/type',
																			keyword:
																				'type',
																			params: {
																				type: 'number',
																			},
																			message:
																				'must be number',
																		},
																	];
																return false;
															}
															var valid47 =
																_errs226 ===
																errors;
														} else {
															var valid47 = true;
														}
														if (valid47) {
															if (
																data83.caption !==
																undefined
															) {
																const _errs228 =
																	errors;
																if (
																	typeof data83.caption !==
																	'string'
																) {
																	validate28.errors =
																		[
																			{
																				instancePath:
																					instancePath +
																					'/progress/caption',
																				schemaPath:
																					'#/oneOf/12/properties/progress/properties/caption/type',
																				keyword:
																					'type',
																				params: {
																					type: 'string',
																				},
																				message:
																					'must be string',
																			},
																		];
																	return false;
																}
																var valid47 =
																	_errs228 ===
																	errors;
															} else {
																var valid47 = true;
															}
														}
													}
												} else {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/progress',
															schemaPath:
																'#/oneOf/12/properties/progress/type',
															keyword: 'type',
															params: {
																type: 'object',
															},
															message:
																'must be object',
														},
													];
													return false;
												}
											}
											var valid46 = _errs223 === errors;
										} else {
											var valid46 = true;
										}
										if (valid46) {
											if (data.step !== undefined) {
												let data86 = data.step;
												const _errs230 = errors;
												if (
													typeof data86 !== 'string'
												) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/12/properties/step/type',
															keyword: 'type',
															params: {
																type: 'string',
															},
															message:
																'must be string',
														},
													];
													return false;
												}
												if ('mkdir' !== data86) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/12/properties/step/const',
															keyword: 'const',
															params: {
																allowedValue:
																	'mkdir',
															},
															message:
																'must be equal to constant',
														},
													];
													return false;
												}
												var valid46 =
													_errs230 === errors;
											} else {
												var valid46 = true;
											}
											if (valid46) {
												if (data.path !== undefined) {
													const _errs232 = errors;
													if (
														typeof data.path !==
														'string'
													) {
														validate28.errors = [
															{
																instancePath:
																	instancePath +
																	'/path',
																schemaPath:
																	'#/oneOf/12/properties/path/type',
																keyword: 'type',
																params: {
																	type: 'string',
																},
																message:
																	'must be string',
															},
														];
														return false;
													}
													var valid46 =
														_errs232 === errors;
												} else {
													var valid46 = true;
												}
											}
										}
									}
								}
							} else {
								validate28.errors = [
									{
										instancePath,
										schemaPath: '#/oneOf/12/type',
										keyword: 'type',
										params: { type: 'object' },
										message: 'must be object',
									},
								];
								return false;
							}
						}
					} else if (tag0 === 'mv') {
						const _errs234 = errors;
						if (errors === _errs234) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing14;
								if (
									(data.fromPath === undefined &&
										(missing14 = 'fromPath')) ||
									(data.step === undefined &&
										(missing14 = 'step')) ||
									(data.toPath === undefined &&
										(missing14 = 'toPath'))
								) {
									validate28.errors = [
										{
											instancePath,
											schemaPath: '#/oneOf/13/required',
											keyword: 'required',
											params: {
												missingProperty: missing14,
											},
											message:
												"must have required property '" +
												missing14 +
												"'",
										},
									];
									return false;
								} else {
									const _errs236 = errors;
									for (const key30 in data) {
										if (
											!(
												key30 === 'progress' ||
												key30 === 'step' ||
												key30 === 'fromPath' ||
												key30 === 'toPath'
											)
										) {
											validate28.errors = [
												{
													instancePath,
													schemaPath:
														'#/oneOf/13/additionalProperties',
													keyword:
														'additionalProperties',
													params: {
														additionalProperty:
															key30,
													},
													message:
														'must NOT have additional properties',
												},
											];
											return false;
											break;
										}
									}
									if (_errs236 === errors) {
										if (data.progress !== undefined) {
											let data88 = data.progress;
											const _errs237 = errors;
											if (errors === _errs237) {
												if (
													data88 &&
													typeof data88 == 'object' &&
													!Array.isArray(data88)
												) {
													const _errs239 = errors;
													for (const key31 in data88) {
														if (
															!(
																key31 ===
																	'weight' ||
																key31 ===
																	'caption'
															)
														) {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/progress',
																		schemaPath:
																			'#/oneOf/13/properties/progress/additionalProperties',
																		keyword:
																			'additionalProperties',
																		params: {
																			additionalProperty:
																				key31,
																		},
																		message:
																			'must NOT have additional properties',
																	},
																];
															return false;
															break;
														}
													}
													if (_errs239 === errors) {
														if (
															data88.weight !==
															undefined
														) {
															let data89 =
																data88.weight;
															const _errs240 =
																errors;
															if (
																!(
																	typeof data89 ==
																		'number' &&
																	isFinite(
																		data89
																	)
																)
															) {
																validate28.errors =
																	[
																		{
																			instancePath:
																				instancePath +
																				'/progress/weight',
																			schemaPath:
																				'#/oneOf/13/properties/progress/properties/weight/type',
																			keyword:
																				'type',
																			params: {
																				type: 'number',
																			},
																			message:
																				'must be number',
																		},
																	];
																return false;
															}
															var valid50 =
																_errs240 ===
																errors;
														} else {
															var valid50 = true;
														}
														if (valid50) {
															if (
																data88.caption !==
																undefined
															) {
																const _errs242 =
																	errors;
																if (
																	typeof data88.caption !==
																	'string'
																) {
																	validate28.errors =
																		[
																			{
																				instancePath:
																					instancePath +
																					'/progress/caption',
																				schemaPath:
																					'#/oneOf/13/properties/progress/properties/caption/type',
																				keyword:
																					'type',
																				params: {
																					type: 'string',
																				},
																				message:
																					'must be string',
																			},
																		];
																	return false;
																}
																var valid50 =
																	_errs242 ===
																	errors;
															} else {
																var valid50 = true;
															}
														}
													}
												} else {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/progress',
															schemaPath:
																'#/oneOf/13/properties/progress/type',
															keyword: 'type',
															params: {
																type: 'object',
															},
															message:
																'must be object',
														},
													];
													return false;
												}
											}
											var valid49 = _errs237 === errors;
										} else {
											var valid49 = true;
										}
										if (valid49) {
											if (data.step !== undefined) {
												let data91 = data.step;
												const _errs244 = errors;
												if (
													typeof data91 !== 'string'
												) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/13/properties/step/type',
															keyword: 'type',
															params: {
																type: 'string',
															},
															message:
																'must be string',
														},
													];
													return false;
												}
												if ('mv' !== data91) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/13/properties/step/const',
															keyword: 'const',
															params: {
																allowedValue:
																	'mv',
															},
															message:
																'must be equal to constant',
														},
													];
													return false;
												}
												var valid49 =
													_errs244 === errors;
											} else {
												var valid49 = true;
											}
											if (valid49) {
												if (
													data.fromPath !== undefined
												) {
													const _errs246 = errors;
													if (
														typeof data.fromPath !==
														'string'
													) {
														validate28.errors = [
															{
																instancePath:
																	instancePath +
																	'/fromPath',
																schemaPath:
																	'#/oneOf/13/properties/fromPath/type',
																keyword: 'type',
																params: {
																	type: 'string',
																},
																message:
																	'must be string',
															},
														];
														return false;
													}
													var valid49 =
														_errs246 === errors;
												} else {
													var valid49 = true;
												}
												if (valid49) {
													if (
														data.toPath !==
														undefined
													) {
														const _errs248 = errors;
														if (
															typeof data.toPath !==
															'string'
														) {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/toPath',
																		schemaPath:
																			'#/oneOf/13/properties/toPath/type',
																		keyword:
																			'type',
																		params: {
																			type: 'string',
																		},
																		message:
																			'must be string',
																	},
																];
															return false;
														}
														var valid49 =
															_errs248 === errors;
													} else {
														var valid49 = true;
													}
												}
											}
										}
									}
								}
							} else {
								validate28.errors = [
									{
										instancePath,
										schemaPath: '#/oneOf/13/type',
										keyword: 'type',
										params: { type: 'object' },
										message: 'must be object',
									},
								];
								return false;
							}
						}
					} else if (tag0 === 'resetData') {
						const _errs250 = errors;
						if (errors === _errs250) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing15;
								if (
									data.step === undefined &&
									(missing15 = 'step')
								) {
									validate28.errors = [
										{
											instancePath,
											schemaPath: '#/oneOf/14/required',
											keyword: 'required',
											params: {
												missingProperty: missing15,
											},
											message:
												"must have required property '" +
												missing15 +
												"'",
										},
									];
									return false;
								} else {
									const _errs252 = errors;
									for (const key32 in data) {
										if (
											!(
												key32 === 'progress' ||
												key32 === 'step'
											)
										) {
											validate28.errors = [
												{
													instancePath,
													schemaPath:
														'#/oneOf/14/additionalProperties',
													keyword:
														'additionalProperties',
													params: {
														additionalProperty:
															key32,
													},
													message:
														'must NOT have additional properties',
												},
											];
											return false;
											break;
										}
									}
									if (_errs252 === errors) {
										if (data.progress !== undefined) {
											let data94 = data.progress;
											const _errs253 = errors;
											if (errors === _errs253) {
												if (
													data94 &&
													typeof data94 == 'object' &&
													!Array.isArray(data94)
												) {
													const _errs255 = errors;
													for (const key33 in data94) {
														if (
															!(
																key33 ===
																	'weight' ||
																key33 ===
																	'caption'
															)
														) {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/progress',
																		schemaPath:
																			'#/oneOf/14/properties/progress/additionalProperties',
																		keyword:
																			'additionalProperties',
																		params: {
																			additionalProperty:
																				key33,
																		},
																		message:
																			'must NOT have additional properties',
																	},
																];
															return false;
															break;
														}
													}
													if (_errs255 === errors) {
														if (
															data94.weight !==
															undefined
														) {
															let data95 =
																data94.weight;
															const _errs256 =
																errors;
															if (
																!(
																	typeof data95 ==
																		'number' &&
																	isFinite(
																		data95
																	)
																)
															) {
																validate28.errors =
																	[
																		{
																			instancePath:
																				instancePath +
																				'/progress/weight',
																			schemaPath:
																				'#/oneOf/14/properties/progress/properties/weight/type',
																			keyword:
																				'type',
																			params: {
																				type: 'number',
																			},
																			message:
																				'must be number',
																		},
																	];
																return false;
															}
															var valid53 =
																_errs256 ===
																errors;
														} else {
															var valid53 = true;
														}
														if (valid53) {
															if (
																data94.caption !==
																undefined
															) {
																const _errs258 =
																	errors;
																if (
																	typeof data94.caption !==
																	'string'
																) {
																	validate28.errors =
																		[
																			{
																				instancePath:
																					instancePath +
																					'/progress/caption',
																				schemaPath:
																					'#/oneOf/14/properties/progress/properties/caption/type',
																				keyword:
																					'type',
																				params: {
																					type: 'string',
																				},
																				message:
																					'must be string',
																			},
																		];
																	return false;
																}
																var valid53 =
																	_errs258 ===
																	errors;
															} else {
																var valid53 = true;
															}
														}
													}
												} else {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/progress',
															schemaPath:
																'#/oneOf/14/properties/progress/type',
															keyword: 'type',
															params: {
																type: 'object',
															},
															message:
																'must be object',
														},
													];
													return false;
												}
											}
											var valid52 = _errs253 === errors;
										} else {
											var valid52 = true;
										}
										if (valid52) {
											if (data.step !== undefined) {
												let data97 = data.step;
												const _errs260 = errors;
												if (
													typeof data97 !== 'string'
												) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/14/properties/step/type',
															keyword: 'type',
															params: {
																type: 'string',
															},
															message:
																'must be string',
														},
													];
													return false;
												}
												if ('resetData' !== data97) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/14/properties/step/const',
															keyword: 'const',
															params: {
																allowedValue:
																	'resetData',
															},
															message:
																'must be equal to constant',
														},
													];
													return false;
												}
												var valid52 =
													_errs260 === errors;
											} else {
												var valid52 = true;
											}
										}
									}
								}
							} else {
								validate28.errors = [
									{
										instancePath,
										schemaPath: '#/oneOf/14/type',
										keyword: 'type',
										params: { type: 'object' },
										message: 'must be object',
									},
								];
								return false;
							}
						}
					} else if (tag0 === 'request') {
						const _errs262 = errors;
						if (errors === _errs262) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing16;
								if (
									(data.request === undefined &&
										(missing16 = 'request')) ||
									(data.step === undefined &&
										(missing16 = 'step'))
								) {
									validate28.errors = [
										{
											instancePath,
											schemaPath: '#/oneOf/15/required',
											keyword: 'required',
											params: {
												missingProperty: missing16,
											},
											message:
												"must have required property '" +
												missing16 +
												"'",
										},
									];
									return false;
								} else {
									const _errs264 = errors;
									for (const key34 in data) {
										if (
											!(
												key34 === 'progress' ||
												key34 === 'step' ||
												key34 === 'request'
											)
										) {
											validate28.errors = [
												{
													instancePath,
													schemaPath:
														'#/oneOf/15/additionalProperties',
													keyword:
														'additionalProperties',
													params: {
														additionalProperty:
															key34,
													},
													message:
														'must NOT have additional properties',
												},
											];
											return false;
											break;
										}
									}
									if (_errs264 === errors) {
										if (data.progress !== undefined) {
											let data98 = data.progress;
											const _errs265 = errors;
											if (errors === _errs265) {
												if (
													data98 &&
													typeof data98 == 'object' &&
													!Array.isArray(data98)
												) {
													const _errs267 = errors;
													for (const key35 in data98) {
														if (
															!(
																key35 ===
																	'weight' ||
																key35 ===
																	'caption'
															)
														) {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/progress',
																		schemaPath:
																			'#/oneOf/15/properties/progress/additionalProperties',
																		keyword:
																			'additionalProperties',
																		params: {
																			additionalProperty:
																				key35,
																		},
																		message:
																			'must NOT have additional properties',
																	},
																];
															return false;
															break;
														}
													}
													if (_errs267 === errors) {
														if (
															data98.weight !==
															undefined
														) {
															let data99 =
																data98.weight;
															const _errs268 =
																errors;
															if (
																!(
																	typeof data99 ==
																		'number' &&
																	isFinite(
																		data99
																	)
																)
															) {
																validate28.errors =
																	[
																		{
																			instancePath:
																				instancePath +
																				'/progress/weight',
																			schemaPath:
																				'#/oneOf/15/properties/progress/properties/weight/type',
																			keyword:
																				'type',
																			params: {
																				type: 'number',
																			},
																			message:
																				'must be number',
																		},
																	];
																return false;
															}
															var valid56 =
																_errs268 ===
																errors;
														} else {
															var valid56 = true;
														}
														if (valid56) {
															if (
																data98.caption !==
																undefined
															) {
																const _errs270 =
																	errors;
																if (
																	typeof data98.caption !==
																	'string'
																) {
																	validate28.errors =
																		[
																			{
																				instancePath:
																					instancePath +
																					'/progress/caption',
																				schemaPath:
																					'#/oneOf/15/properties/progress/properties/caption/type',
																				keyword:
																					'type',
																				params: {
																					type: 'string',
																				},
																				message:
																					'must be string',
																			},
																		];
																	return false;
																}
																var valid56 =
																	_errs270 ===
																	errors;
															} else {
																var valid56 = true;
															}
														}
													}
												} else {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/progress',
															schemaPath:
																'#/oneOf/15/properties/progress/type',
															keyword: 'type',
															params: {
																type: 'object',
															},
															message:
																'must be object',
														},
													];
													return false;
												}
											}
											var valid55 = _errs265 === errors;
										} else {
											var valid55 = true;
										}
										if (valid55) {
											if (data.step !== undefined) {
												let data101 = data.step;
												const _errs272 = errors;
												if (
													typeof data101 !== 'string'
												) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/15/properties/step/type',
															keyword: 'type',
															params: {
																type: 'string',
															},
															message:
																'must be string',
														},
													];
													return false;
												}
												if ('request' !== data101) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/15/properties/step/const',
															keyword: 'const',
															params: {
																allowedValue:
																	'request',
															},
															message:
																'must be equal to constant',
														},
													];
													return false;
												}
												var valid55 =
													_errs272 === errors;
											} else {
												var valid55 = true;
											}
											if (valid55) {
												if (
													data.request !== undefined
												) {
													const _errs274 = errors;
													if (
														!validate37(
															data.request,
															{
																instancePath:
																	instancePath +
																	'/request',
																parentData:
																	data,
																parentDataProperty:
																	'request',
																rootData,
															}
														)
													) {
														vErrors =
															vErrors === null
																? validate37.errors
																: vErrors.concat(
																		validate37.errors
																	);
														errors = vErrors.length;
													}
													var valid55 =
														_errs274 === errors;
												} else {
													var valid55 = true;
												}
											}
										}
									}
								}
							} else {
								validate28.errors = [
									{
										instancePath,
										schemaPath: '#/oneOf/15/type',
										keyword: 'type',
										params: { type: 'object' },
										message: 'must be object',
									},
								];
								return false;
							}
						}
					} else if (tag0 === 'rm') {
						const _errs275 = errors;
						if (errors === _errs275) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing17;
								if (
									(data.path === undefined &&
										(missing17 = 'path')) ||
									(data.step === undefined &&
										(missing17 = 'step'))
								) {
									validate28.errors = [
										{
											instancePath,
											schemaPath: '#/oneOf/16/required',
											keyword: 'required',
											params: {
												missingProperty: missing17,
											},
											message:
												"must have required property '" +
												missing17 +
												"'",
										},
									];
									return false;
								} else {
									const _errs277 = errors;
									for (const key36 in data) {
										if (
											!(
												key36 === 'progress' ||
												key36 === 'step' ||
												key36 === 'path'
											)
										) {
											validate28.errors = [
												{
													instancePath,
													schemaPath:
														'#/oneOf/16/additionalProperties',
													keyword:
														'additionalProperties',
													params: {
														additionalProperty:
															key36,
													},
													message:
														'must NOT have additional properties',
												},
											];
											return false;
											break;
										}
									}
									if (_errs277 === errors) {
										if (data.progress !== undefined) {
											let data103 = data.progress;
											const _errs278 = errors;
											if (errors === _errs278) {
												if (
													data103 &&
													typeof data103 ==
														'object' &&
													!Array.isArray(data103)
												) {
													const _errs280 = errors;
													for (const key37 in data103) {
														if (
															!(
																key37 ===
																	'weight' ||
																key37 ===
																	'caption'
															)
														) {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/progress',
																		schemaPath:
																			'#/oneOf/16/properties/progress/additionalProperties',
																		keyword:
																			'additionalProperties',
																		params: {
																			additionalProperty:
																				key37,
																		},
																		message:
																			'must NOT have additional properties',
																	},
																];
															return false;
															break;
														}
													}
													if (_errs280 === errors) {
														if (
															data103.weight !==
															undefined
														) {
															let data104 =
																data103.weight;
															const _errs281 =
																errors;
															if (
																!(
																	typeof data104 ==
																		'number' &&
																	isFinite(
																		data104
																	)
																)
															) {
																validate28.errors =
																	[
																		{
																			instancePath:
																				instancePath +
																				'/progress/weight',
																			schemaPath:
																				'#/oneOf/16/properties/progress/properties/weight/type',
																			keyword:
																				'type',
																			params: {
																				type: 'number',
																			},
																			message:
																				'must be number',
																		},
																	];
																return false;
															}
															var valid59 =
																_errs281 ===
																errors;
														} else {
															var valid59 = true;
														}
														if (valid59) {
															if (
																data103.caption !==
																undefined
															) {
																const _errs283 =
																	errors;
																if (
																	typeof data103.caption !==
																	'string'
																) {
																	validate28.errors =
																		[
																			{
																				instancePath:
																					instancePath +
																					'/progress/caption',
																				schemaPath:
																					'#/oneOf/16/properties/progress/properties/caption/type',
																				keyword:
																					'type',
																				params: {
																					type: 'string',
																				},
																				message:
																					'must be string',
																			},
																		];
																	return false;
																}
																var valid59 =
																	_errs283 ===
																	errors;
															} else {
																var valid59 = true;
															}
														}
													}
												} else {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/progress',
															schemaPath:
																'#/oneOf/16/properties/progress/type',
															keyword: 'type',
															params: {
																type: 'object',
															},
															message:
																'must be object',
														},
													];
													return false;
												}
											}
											var valid58 = _errs278 === errors;
										} else {
											var valid58 = true;
										}
										if (valid58) {
											if (data.step !== undefined) {
												let data106 = data.step;
												const _errs285 = errors;
												if (
													typeof data106 !== 'string'
												) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/16/properties/step/type',
															keyword: 'type',
															params: {
																type: 'string',
															},
															message:
																'must be string',
														},
													];
													return false;
												}
												if ('rm' !== data106) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/16/properties/step/const',
															keyword: 'const',
															params: {
																allowedValue:
																	'rm',
															},
															message:
																'must be equal to constant',
														},
													];
													return false;
												}
												var valid58 =
													_errs285 === errors;
											} else {
												var valid58 = true;
											}
											if (valid58) {
												if (data.path !== undefined) {
													const _errs287 = errors;
													if (
														typeof data.path !==
														'string'
													) {
														validate28.errors = [
															{
																instancePath:
																	instancePath +
																	'/path',
																schemaPath:
																	'#/oneOf/16/properties/path/type',
																keyword: 'type',
																params: {
																	type: 'string',
																},
																message:
																	'must be string',
															},
														];
														return false;
													}
													var valid58 =
														_errs287 === errors;
												} else {
													var valid58 = true;
												}
											}
										}
									}
								}
							} else {
								validate28.errors = [
									{
										instancePath,
										schemaPath: '#/oneOf/16/type',
										keyword: 'type',
										params: { type: 'object' },
										message: 'must be object',
									},
								];
								return false;
							}
						}
					} else if (tag0 === 'rmdir') {
						const _errs289 = errors;
						if (errors === _errs289) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing18;
								if (
									(data.path === undefined &&
										(missing18 = 'path')) ||
									(data.step === undefined &&
										(missing18 = 'step'))
								) {
									validate28.errors = [
										{
											instancePath,
											schemaPath: '#/oneOf/17/required',
											keyword: 'required',
											params: {
												missingProperty: missing18,
											},
											message:
												"must have required property '" +
												missing18 +
												"'",
										},
									];
									return false;
								} else {
									const _errs291 = errors;
									for (const key38 in data) {
										if (
											!(
												key38 === 'progress' ||
												key38 === 'step' ||
												key38 === 'path'
											)
										) {
											validate28.errors = [
												{
													instancePath,
													schemaPath:
														'#/oneOf/17/additionalProperties',
													keyword:
														'additionalProperties',
													params: {
														additionalProperty:
															key38,
													},
													message:
														'must NOT have additional properties',
												},
											];
											return false;
											break;
										}
									}
									if (_errs291 === errors) {
										if (data.progress !== undefined) {
											let data108 = data.progress;
											const _errs292 = errors;
											if (errors === _errs292) {
												if (
													data108 &&
													typeof data108 ==
														'object' &&
													!Array.isArray(data108)
												) {
													const _errs294 = errors;
													for (const key39 in data108) {
														if (
															!(
																key39 ===
																	'weight' ||
																key39 ===
																	'caption'
															)
														) {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/progress',
																		schemaPath:
																			'#/oneOf/17/properties/progress/additionalProperties',
																		keyword:
																			'additionalProperties',
																		params: {
																			additionalProperty:
																				key39,
																		},
																		message:
																			'must NOT have additional properties',
																	},
																];
															return false;
															break;
														}
													}
													if (_errs294 === errors) {
														if (
															data108.weight !==
															undefined
														) {
															let data109 =
																data108.weight;
															const _errs295 =
																errors;
															if (
																!(
																	typeof data109 ==
																		'number' &&
																	isFinite(
																		data109
																	)
																)
															) {
																validate28.errors =
																	[
																		{
																			instancePath:
																				instancePath +
																				'/progress/weight',
																			schemaPath:
																				'#/oneOf/17/properties/progress/properties/weight/type',
																			keyword:
																				'type',
																			params: {
																				type: 'number',
																			},
																			message:
																				'must be number',
																		},
																	];
																return false;
															}
															var valid62 =
																_errs295 ===
																errors;
														} else {
															var valid62 = true;
														}
														if (valid62) {
															if (
																data108.caption !==
																undefined
															) {
																const _errs297 =
																	errors;
																if (
																	typeof data108.caption !==
																	'string'
																) {
																	validate28.errors =
																		[
																			{
																				instancePath:
																					instancePath +
																					'/progress/caption',
																				schemaPath:
																					'#/oneOf/17/properties/progress/properties/caption/type',
																				keyword:
																					'type',
																				params: {
																					type: 'string',
																				},
																				message:
																					'must be string',
																			},
																		];
																	return false;
																}
																var valid62 =
																	_errs297 ===
																	errors;
															} else {
																var valid62 = true;
															}
														}
													}
												} else {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/progress',
															schemaPath:
																'#/oneOf/17/properties/progress/type',
															keyword: 'type',
															params: {
																type: 'object',
															},
															message:
																'must be object',
														},
													];
													return false;
												}
											}
											var valid61 = _errs292 === errors;
										} else {
											var valid61 = true;
										}
										if (valid61) {
											if (data.step !== undefined) {
												let data111 = data.step;
												const _errs299 = errors;
												if (
													typeof data111 !== 'string'
												) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/17/properties/step/type',
															keyword: 'type',
															params: {
																type: 'string',
															},
															message:
																'must be string',
														},
													];
													return false;
												}
												if ('rmdir' !== data111) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/17/properties/step/const',
															keyword: 'const',
															params: {
																allowedValue:
																	'rmdir',
															},
															message:
																'must be equal to constant',
														},
													];
													return false;
												}
												var valid61 =
													_errs299 === errors;
											} else {
												var valid61 = true;
											}
											if (valid61) {
												if (data.path !== undefined) {
													const _errs301 = errors;
													if (
														typeof data.path !==
														'string'
													) {
														validate28.errors = [
															{
																instancePath:
																	instancePath +
																	'/path',
																schemaPath:
																	'#/oneOf/17/properties/path/type',
																keyword: 'type',
																params: {
																	type: 'string',
																},
																message:
																	'must be string',
															},
														];
														return false;
													}
													var valid61 =
														_errs301 === errors;
												} else {
													var valid61 = true;
												}
											}
										}
									}
								}
							} else {
								validate28.errors = [
									{
										instancePath,
										schemaPath: '#/oneOf/17/type',
										keyword: 'type',
										params: { type: 'object' },
										message: 'must be object',
									},
								];
								return false;
							}
						}
					} else if (tag0 === 'runPHP') {
						const _errs303 = errors;
						if (errors === _errs303) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing19;
								if (
									(data.code === undefined &&
										(missing19 = 'code')) ||
									(data.step === undefined &&
										(missing19 = 'step'))
								) {
									validate28.errors = [
										{
											instancePath,
											schemaPath: '#/oneOf/18/required',
											keyword: 'required',
											params: {
												missingProperty: missing19,
											},
											message:
												"must have required property '" +
												missing19 +
												"'",
										},
									];
									return false;
								} else {
									const _errs305 = errors;
									for (const key40 in data) {
										if (
											!(
												key40 === 'progress' ||
												key40 === 'step' ||
												key40 === 'code'
											)
										) {
											validate28.errors = [
												{
													instancePath,
													schemaPath:
														'#/oneOf/18/additionalProperties',
													keyword:
														'additionalProperties',
													params: {
														additionalProperty:
															key40,
													},
													message:
														'must NOT have additional properties',
												},
											];
											return false;
											break;
										}
									}
									if (_errs305 === errors) {
										if (data.progress !== undefined) {
											let data113 = data.progress;
											const _errs306 = errors;
											if (errors === _errs306) {
												if (
													data113 &&
													typeof data113 ==
														'object' &&
													!Array.isArray(data113)
												) {
													const _errs308 = errors;
													for (const key41 in data113) {
														if (
															!(
																key41 ===
																	'weight' ||
																key41 ===
																	'caption'
															)
														) {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/progress',
																		schemaPath:
																			'#/oneOf/18/properties/progress/additionalProperties',
																		keyword:
																			'additionalProperties',
																		params: {
																			additionalProperty:
																				key41,
																		},
																		message:
																			'must NOT have additional properties',
																	},
																];
															return false;
															break;
														}
													}
													if (_errs308 === errors) {
														if (
															data113.weight !==
															undefined
														) {
															let data114 =
																data113.weight;
															const _errs309 =
																errors;
															if (
																!(
																	typeof data114 ==
																		'number' &&
																	isFinite(
																		data114
																	)
																)
															) {
																validate28.errors =
																	[
																		{
																			instancePath:
																				instancePath +
																				'/progress/weight',
																			schemaPath:
																				'#/oneOf/18/properties/progress/properties/weight/type',
																			keyword:
																				'type',
																			params: {
																				type: 'number',
																			},
																			message:
																				'must be number',
																		},
																	];
																return false;
															}
															var valid65 =
																_errs309 ===
																errors;
														} else {
															var valid65 = true;
														}
														if (valid65) {
															if (
																data113.caption !==
																undefined
															) {
																const _errs311 =
																	errors;
																if (
																	typeof data113.caption !==
																	'string'
																) {
																	validate28.errors =
																		[
																			{
																				instancePath:
																					instancePath +
																					'/progress/caption',
																				schemaPath:
																					'#/oneOf/18/properties/progress/properties/caption/type',
																				keyword:
																					'type',
																				params: {
																					type: 'string',
																				},
																				message:
																					'must be string',
																			},
																		];
																	return false;
																}
																var valid65 =
																	_errs311 ===
																	errors;
															} else {
																var valid65 = true;
															}
														}
													}
												} else {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/progress',
															schemaPath:
																'#/oneOf/18/properties/progress/type',
															keyword: 'type',
															params: {
																type: 'object',
															},
															message:
																'must be object',
														},
													];
													return false;
												}
											}
											var valid64 = _errs306 === errors;
										} else {
											var valid64 = true;
										}
										if (valid64) {
											if (data.step !== undefined) {
												let data116 = data.step;
												const _errs313 = errors;
												if (
													typeof data116 !== 'string'
												) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/18/properties/step/type',
															keyword: 'type',
															params: {
																type: 'string',
															},
															message:
																'must be string',
														},
													];
													return false;
												}
												if ('runPHP' !== data116) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/18/properties/step/const',
															keyword: 'const',
															params: {
																allowedValue:
																	'runPHP',
															},
															message:
																'must be equal to constant',
														},
													];
													return false;
												}
												var valid64 =
													_errs313 === errors;
											} else {
												var valid64 = true;
											}
											if (valid64) {
												if (data.code !== undefined) {
													let data117 = data.code;
													const _errs315 = errors;
													const _errs316 = errors;
													let valid66 = false;
													const _errs317 = errors;
													if (
														typeof data117 !==
														'string'
													) {
														const err2 = {
															instancePath:
																instancePath +
																'/code',
															schemaPath:
																'#/oneOf/18/properties/code/anyOf/0/type',
															keyword: 'type',
															params: {
																type: 'string',
															},
															message:
																'must be string',
														};
														if (vErrors === null) {
															vErrors = [err2];
														} else {
															vErrors.push(err2);
														}
														errors++;
													}
													var _valid2 =
														_errs317 === errors;
													valid66 =
														valid66 || _valid2;
													if (!valid66) {
														const _errs319 = errors;
														if (
															errors === _errs319
														) {
															if (
																data117 &&
																typeof data117 ==
																	'object' &&
																!Array.isArray(
																	data117
																)
															) {
																let missing20;
																if (
																	(data117.filename ===
																		undefined &&
																		(missing20 =
																			'filename')) ||
																	(data117.content ===
																		undefined &&
																		(missing20 =
																			'content'))
																) {
																	const err3 =
																		{
																			instancePath:
																				instancePath +
																				'/code',
																			schemaPath:
																				'#/oneOf/18/properties/code/anyOf/1/required',
																			keyword:
																				'required',
																			params: {
																				missingProperty:
																					missing20,
																			},
																			message:
																				"must have required property '" +
																				missing20 +
																				"'",
																		};
																	if (
																		vErrors ===
																		null
																	) {
																		vErrors =
																			[
																				err3,
																			];
																	} else {
																		vErrors.push(
																			err3
																		);
																	}
																	errors++;
																} else {
																	const _errs321 =
																		errors;
																	for (const key42 in data117) {
																		if (
																			!(
																				key42 ===
																					'filename' ||
																				key42 ===
																					'content'
																			)
																		) {
																			const err4 =
																				{
																					instancePath:
																						instancePath +
																						'/code',
																					schemaPath:
																						'#/oneOf/18/properties/code/anyOf/1/additionalProperties',
																					keyword:
																						'additionalProperties',
																					params: {
																						additionalProperty:
																							key42,
																					},
																					message:
																						'must NOT have additional properties',
																				};
																			if (
																				vErrors ===
																				null
																			) {
																				vErrors =
																					[
																						err4,
																					];
																			} else {
																				vErrors.push(
																					err4
																				);
																			}
																			errors++;
																			break;
																		}
																	}
																	if (
																		_errs321 ===
																		errors
																	) {
																		if (
																			data117.filename !==
																			undefined
																		) {
																			const _errs322 =
																				errors;
																			if (
																				typeof data117.filename !==
																				'string'
																			) {
																				const err5 =
																					{
																						instancePath:
																							instancePath +
																							'/code/filename',
																						schemaPath:
																							'#/oneOf/18/properties/code/anyOf/1/properties/filename/type',
																						keyword:
																							'type',
																						params: {
																							type: 'string',
																						},
																						message:
																							'must be string',
																					};
																				if (
																					vErrors ===
																					null
																				) {
																					vErrors =
																						[
																							err5,
																						];
																				} else {
																					vErrors.push(
																						err5
																					);
																				}
																				errors++;
																			}
																			var valid67 =
																				_errs322 ===
																				errors;
																		} else {
																			var valid67 = true;
																		}
																		if (
																			valid67
																		) {
																			if (
																				data117.content !==
																				undefined
																			) {
																				const _errs324 =
																					errors;
																				if (
																					typeof data117.content !==
																					'string'
																				) {
																					const err6 =
																						{
																							instancePath:
																								instancePath +
																								'/code/content',
																							schemaPath:
																								'#/oneOf/18/properties/code/anyOf/1/properties/content/type',
																							keyword:
																								'type',
																							params: {
																								type: 'string',
																							},
																							message:
																								'must be string',
																						};
																					if (
																						vErrors ===
																						null
																					) {
																						vErrors =
																							[
																								err6,
																							];
																					} else {
																						vErrors.push(
																							err6
																						);
																					}
																					errors++;
																				}
																				var valid67 =
																					_errs324 ===
																					errors;
																			} else {
																				var valid67 = true;
																			}
																		}
																	}
																}
															} else {
																const err7 = {
																	instancePath:
																		instancePath +
																		'/code',
																	schemaPath:
																		'#/oneOf/18/properties/code/anyOf/1/type',
																	keyword:
																		'type',
																	params: {
																		type: 'object',
																	},
																	message:
																		'must be object',
																};
																if (
																	vErrors ===
																	null
																) {
																	vErrors = [
																		err7,
																	];
																} else {
																	vErrors.push(
																		err7
																	);
																}
																errors++;
															}
														}
														var _valid2 =
															_errs319 === errors;
														valid66 =
															valid66 || _valid2;
													}
													if (!valid66) {
														const err8 = {
															instancePath:
																instancePath +
																'/code',
															schemaPath:
																'#/oneOf/18/properties/code/anyOf',
															keyword: 'anyOf',
															params: {},
															message:
																'must match a schema in anyOf',
														};
														if (vErrors === null) {
															vErrors = [err8];
														} else {
															vErrors.push(err8);
														}
														errors++;
														validate28.errors =
															vErrors;
														return false;
													} else {
														errors = _errs316;
														if (vErrors !== null) {
															if (_errs316) {
																vErrors.length =
																	_errs316;
															} else {
																vErrors = null;
															}
														}
													}
													var valid64 =
														_errs315 === errors;
												} else {
													var valid64 = true;
												}
											}
										}
									}
								}
							} else {
								validate28.errors = [
									{
										instancePath,
										schemaPath: '#/oneOf/18/type',
										keyword: 'type',
										params: { type: 'object' },
										message: 'must be object',
									},
								];
								return false;
							}
						}
					} else if (tag0 === 'runPHPWithOptions') {
						const _errs326 = errors;
						if (errors === _errs326) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing21;
								if (
									(data.options === undefined &&
										(missing21 = 'options')) ||
									(data.step === undefined &&
										(missing21 = 'step'))
								) {
									validate28.errors = [
										{
											instancePath,
											schemaPath: '#/oneOf/19/required',
											keyword: 'required',
											params: {
												missingProperty: missing21,
											},
											message:
												"must have required property '" +
												missing21 +
												"'",
										},
									];
									return false;
								} else {
									const _errs328 = errors;
									for (const key43 in data) {
										if (
											!(
												key43 === 'progress' ||
												key43 === 'step' ||
												key43 === 'options'
											)
										) {
											validate28.errors = [
												{
													instancePath,
													schemaPath:
														'#/oneOf/19/additionalProperties',
													keyword:
														'additionalProperties',
													params: {
														additionalProperty:
															key43,
													},
													message:
														'must NOT have additional properties',
												},
											];
											return false;
											break;
										}
									}
									if (_errs328 === errors) {
										if (data.progress !== undefined) {
											let data120 = data.progress;
											const _errs329 = errors;
											if (errors === _errs329) {
												if (
													data120 &&
													typeof data120 ==
														'object' &&
													!Array.isArray(data120)
												) {
													const _errs331 = errors;
													for (const key44 in data120) {
														if (
															!(
																key44 ===
																	'weight' ||
																key44 ===
																	'caption'
															)
														) {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/progress',
																		schemaPath:
																			'#/oneOf/19/properties/progress/additionalProperties',
																		keyword:
																			'additionalProperties',
																		params: {
																			additionalProperty:
																				key44,
																		},
																		message:
																			'must NOT have additional properties',
																	},
																];
															return false;
															break;
														}
													}
													if (_errs331 === errors) {
														if (
															data120.weight !==
															undefined
														) {
															let data121 =
																data120.weight;
															const _errs332 =
																errors;
															if (
																!(
																	typeof data121 ==
																		'number' &&
																	isFinite(
																		data121
																	)
																)
															) {
																validate28.errors =
																	[
																		{
																			instancePath:
																				instancePath +
																				'/progress/weight',
																			schemaPath:
																				'#/oneOf/19/properties/progress/properties/weight/type',
																			keyword:
																				'type',
																			params: {
																				type: 'number',
																			},
																			message:
																				'must be number',
																		},
																	];
																return false;
															}
															var valid70 =
																_errs332 ===
																errors;
														} else {
															var valid70 = true;
														}
														if (valid70) {
															if (
																data120.caption !==
																undefined
															) {
																const _errs334 =
																	errors;
																if (
																	typeof data120.caption !==
																	'string'
																) {
																	validate28.errors =
																		[
																			{
																				instancePath:
																					instancePath +
																					'/progress/caption',
																				schemaPath:
																					'#/oneOf/19/properties/progress/properties/caption/type',
																				keyword:
																					'type',
																				params: {
																					type: 'string',
																				},
																				message:
																					'must be string',
																			},
																		];
																	return false;
																}
																var valid70 =
																	_errs334 ===
																	errors;
															} else {
																var valid70 = true;
															}
														}
													}
												} else {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/progress',
															schemaPath:
																'#/oneOf/19/properties/progress/type',
															keyword: 'type',
															params: {
																type: 'object',
															},
															message:
																'must be object',
														},
													];
													return false;
												}
											}
											var valid69 = _errs329 === errors;
										} else {
											var valid69 = true;
										}
										if (valid69) {
											if (data.step !== undefined) {
												let data123 = data.step;
												const _errs336 = errors;
												if (
													typeof data123 !== 'string'
												) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/19/properties/step/type',
															keyword: 'type',
															params: {
																type: 'string',
															},
															message:
																'must be string',
														},
													];
													return false;
												}
												if (
													'runPHPWithOptions' !==
													data123
												) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/19/properties/step/const',
															keyword: 'const',
															params: {
																allowedValue:
																	'runPHPWithOptions',
															},
															message:
																'must be equal to constant',
														},
													];
													return false;
												}
												var valid69 =
													_errs336 === errors;
											} else {
												var valid69 = true;
											}
											if (valid69) {
												if (
													data.options !== undefined
												) {
													const _errs338 = errors;
													if (
														!validate39(
															data.options,
															{
																instancePath:
																	instancePath +
																	'/options',
																parentData:
																	data,
																parentDataProperty:
																	'options',
																rootData,
															}
														)
													) {
														vErrors =
															vErrors === null
																? validate39.errors
																: vErrors.concat(
																		validate39.errors
																	);
														errors = vErrors.length;
													}
													var valid69 =
														_errs338 === errors;
												} else {
													var valid69 = true;
												}
											}
										}
									}
								}
							} else {
								validate28.errors = [
									{
										instancePath,
										schemaPath: '#/oneOf/19/type',
										keyword: 'type',
										params: { type: 'object' },
										message: 'must be object',
									},
								];
								return false;
							}
						}
					} else if (tag0 === 'runWpInstallationWizard') {
						const _errs339 = errors;
						if (errors === _errs339) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing22;
								if (
									(data.options === undefined &&
										(missing22 = 'options')) ||
									(data.step === undefined &&
										(missing22 = 'step'))
								) {
									validate28.errors = [
										{
											instancePath,
											schemaPath: '#/oneOf/20/required',
											keyword: 'required',
											params: {
												missingProperty: missing22,
											},
											message:
												"must have required property '" +
												missing22 +
												"'",
										},
									];
									return false;
								} else {
									const _errs341 = errors;
									for (const key45 in data) {
										if (
											!(
												key45 === 'progress' ||
												key45 === 'step' ||
												key45 === 'options'
											)
										) {
											validate28.errors = [
												{
													instancePath,
													schemaPath:
														'#/oneOf/20/additionalProperties',
													keyword:
														'additionalProperties',
													params: {
														additionalProperty:
															key45,
													},
													message:
														'must NOT have additional properties',
												},
											];
											return false;
											break;
										}
									}
									if (_errs341 === errors) {
										if (data.progress !== undefined) {
											let data125 = data.progress;
											const _errs342 = errors;
											if (errors === _errs342) {
												if (
													data125 &&
													typeof data125 ==
														'object' &&
													!Array.isArray(data125)
												) {
													const _errs344 = errors;
													for (const key46 in data125) {
														if (
															!(
																key46 ===
																	'weight' ||
																key46 ===
																	'caption'
															)
														) {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/progress',
																		schemaPath:
																			'#/oneOf/20/properties/progress/additionalProperties',
																		keyword:
																			'additionalProperties',
																		params: {
																			additionalProperty:
																				key46,
																		},
																		message:
																			'must NOT have additional properties',
																	},
																];
															return false;
															break;
														}
													}
													if (_errs344 === errors) {
														if (
															data125.weight !==
															undefined
														) {
															let data126 =
																data125.weight;
															const _errs345 =
																errors;
															if (
																!(
																	typeof data126 ==
																		'number' &&
																	isFinite(
																		data126
																	)
																)
															) {
																validate28.errors =
																	[
																		{
																			instancePath:
																				instancePath +
																				'/progress/weight',
																			schemaPath:
																				'#/oneOf/20/properties/progress/properties/weight/type',
																			keyword:
																				'type',
																			params: {
																				type: 'number',
																			},
																			message:
																				'must be number',
																		},
																	];
																return false;
															}
															var valid73 =
																_errs345 ===
																errors;
														} else {
															var valid73 = true;
														}
														if (valid73) {
															if (
																data125.caption !==
																undefined
															) {
																const _errs347 =
																	errors;
																if (
																	typeof data125.caption !==
																	'string'
																) {
																	validate28.errors =
																		[
																			{
																				instancePath:
																					instancePath +
																					'/progress/caption',
																				schemaPath:
																					'#/oneOf/20/properties/progress/properties/caption/type',
																				keyword:
																					'type',
																				params: {
																					type: 'string',
																				},
																				message:
																					'must be string',
																			},
																		];
																	return false;
																}
																var valid73 =
																	_errs347 ===
																	errors;
															} else {
																var valid73 = true;
															}
														}
													}
												} else {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/progress',
															schemaPath:
																'#/oneOf/20/properties/progress/type',
															keyword: 'type',
															params: {
																type: 'object',
															},
															message:
																'must be object',
														},
													];
													return false;
												}
											}
											var valid72 = _errs342 === errors;
										} else {
											var valid72 = true;
										}
										if (valid72) {
											if (data.step !== undefined) {
												let data128 = data.step;
												const _errs349 = errors;
												if (
													typeof data128 !== 'string'
												) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/20/properties/step/type',
															keyword: 'type',
															params: {
																type: 'string',
															},
															message:
																'must be string',
														},
													];
													return false;
												}
												if (
													'runWpInstallationWizard' !==
													data128
												) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/20/properties/step/const',
															keyword: 'const',
															params: {
																allowedValue:
																	'runWpInstallationWizard',
															},
															message:
																'must be equal to constant',
														},
													];
													return false;
												}
												var valid72 =
													_errs349 === errors;
											} else {
												var valid72 = true;
											}
											if (valid72) {
												if (
													data.options !== undefined
												) {
													let data129 = data.options;
													const _errs351 = errors;
													const _errs352 = errors;
													if (errors === _errs352) {
														if (
															data129 &&
															typeof data129 ==
																'object' &&
															!Array.isArray(
																data129
															)
														) {
															const _errs354 =
																errors;
															for (const key47 in data129) {
																if (
																	!(
																		key47 ===
																			'adminUsername' ||
																		key47 ===
																			'adminPassword'
																	)
																) {
																	validate28.errors =
																		[
																			{
																				instancePath:
																					instancePath +
																					'/options',
																				schemaPath:
																					'#/definitions/WordPressInstallationOptions/additionalProperties',
																				keyword:
																					'additionalProperties',
																				params: {
																					additionalProperty:
																						key47,
																				},
																				message:
																					'must NOT have additional properties',
																			},
																		];
																	return false;
																	break;
																}
															}
															if (
																_errs354 ===
																errors
															) {
																if (
																	data129.adminUsername !==
																	undefined
																) {
																	const _errs355 =
																		errors;
																	if (
																		typeof data129.adminUsername !==
																		'string'
																	) {
																		validate28.errors =
																			[
																				{
																					instancePath:
																						instancePath +
																						'/options/adminUsername',
																					schemaPath:
																						'#/definitions/WordPressInstallationOptions/properties/adminUsername/type',
																					keyword:
																						'type',
																					params: {
																						type: 'string',
																					},
																					message:
																						'must be string',
																				},
																			];
																		return false;
																	}
																	var valid75 =
																		_errs355 ===
																		errors;
																} else {
																	var valid75 = true;
																}
																if (valid75) {
																	if (
																		data129.adminPassword !==
																		undefined
																	) {
																		const _errs357 =
																			errors;
																		if (
																			typeof data129.adminPassword !==
																			'string'
																		) {
																			validate28.errors =
																				[
																					{
																						instancePath:
																							instancePath +
																							'/options/adminPassword',
																						schemaPath:
																							'#/definitions/WordPressInstallationOptions/properties/adminPassword/type',
																						keyword:
																							'type',
																						params: {
																							type: 'string',
																						},
																						message:
																							'must be string',
																					},
																				];
																			return false;
																		}
																		var valid75 =
																			_errs357 ===
																			errors;
																	} else {
																		var valid75 = true;
																	}
																}
															}
														} else {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/options',
																		schemaPath:
																			'#/definitions/WordPressInstallationOptions/type',
																		keyword:
																			'type',
																		params: {
																			type: 'object',
																		},
																		message:
																			'must be object',
																	},
																];
															return false;
														}
													}
													var valid72 =
														_errs351 === errors;
												} else {
													var valid72 = true;
												}
											}
										}
									}
								}
							} else {
								validate28.errors = [
									{
										instancePath,
										schemaPath: '#/oneOf/20/type',
										keyword: 'type',
										params: { type: 'object' },
										message: 'must be object',
									},
								];
								return false;
							}
						}
					} else if (tag0 === 'runSql') {
						const _errs359 = errors;
						if (errors === _errs359) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing23;
								if (
									(data.sql === undefined &&
										(missing23 = 'sql')) ||
									(data.step === undefined &&
										(missing23 = 'step'))
								) {
									validate28.errors = [
										{
											instancePath,
											schemaPath: '#/oneOf/21/required',
											keyword: 'required',
											params: {
												missingProperty: missing23,
											},
											message:
												"must have required property '" +
												missing23 +
												"'",
										},
									];
									return false;
								} else {
									const _errs361 = errors;
									for (const key48 in data) {
										if (
											!(
												key48 === 'progress' ||
												key48 === 'step' ||
												key48 === 'sql'
											)
										) {
											validate28.errors = [
												{
													instancePath,
													schemaPath:
														'#/oneOf/21/additionalProperties',
													keyword:
														'additionalProperties',
													params: {
														additionalProperty:
															key48,
													},
													message:
														'must NOT have additional properties',
												},
											];
											return false;
											break;
										}
									}
									if (_errs361 === errors) {
										if (data.progress !== undefined) {
											let data132 = data.progress;
											const _errs362 = errors;
											if (errors === _errs362) {
												if (
													data132 &&
													typeof data132 ==
														'object' &&
													!Array.isArray(data132)
												) {
													const _errs364 = errors;
													for (const key49 in data132) {
														if (
															!(
																key49 ===
																	'weight' ||
																key49 ===
																	'caption'
															)
														) {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/progress',
																		schemaPath:
																			'#/oneOf/21/properties/progress/additionalProperties',
																		keyword:
																			'additionalProperties',
																		params: {
																			additionalProperty:
																				key49,
																		},
																		message:
																			'must NOT have additional properties',
																	},
																];
															return false;
															break;
														}
													}
													if (_errs364 === errors) {
														if (
															data132.weight !==
															undefined
														) {
															let data133 =
																data132.weight;
															const _errs365 =
																errors;
															if (
																!(
																	typeof data133 ==
																		'number' &&
																	isFinite(
																		data133
																	)
																)
															) {
																validate28.errors =
																	[
																		{
																			instancePath:
																				instancePath +
																				'/progress/weight',
																			schemaPath:
																				'#/oneOf/21/properties/progress/properties/weight/type',
																			keyword:
																				'type',
																			params: {
																				type: 'number',
																			},
																			message:
																				'must be number',
																		},
																	];
																return false;
															}
															var valid78 =
																_errs365 ===
																errors;
														} else {
															var valid78 = true;
														}
														if (valid78) {
															if (
																data132.caption !==
																undefined
															) {
																const _errs367 =
																	errors;
																if (
																	typeof data132.caption !==
																	'string'
																) {
																	validate28.errors =
																		[
																			{
																				instancePath:
																					instancePath +
																					'/progress/caption',
																				schemaPath:
																					'#/oneOf/21/properties/progress/properties/caption/type',
																				keyword:
																					'type',
																				params: {
																					type: 'string',
																				},
																				message:
																					'must be string',
																			},
																		];
																	return false;
																}
																var valid78 =
																	_errs367 ===
																	errors;
															} else {
																var valid78 = true;
															}
														}
													}
												} else {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/progress',
															schemaPath:
																'#/oneOf/21/properties/progress/type',
															keyword: 'type',
															params: {
																type: 'object',
															},
															message:
																'must be object',
														},
													];
													return false;
												}
											}
											var valid77 = _errs362 === errors;
										} else {
											var valid77 = true;
										}
										if (valid77) {
											if (data.step !== undefined) {
												let data135 = data.step;
												const _errs369 = errors;
												if (
													typeof data135 !== 'string'
												) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/21/properties/step/type',
															keyword: 'type',
															params: {
																type: 'string',
															},
															message:
																'must be string',
														},
													];
													return false;
												}
												if ('runSql' !== data135) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/21/properties/step/const',
															keyword: 'const',
															params: {
																allowedValue:
																	'runSql',
															},
															message:
																'must be equal to constant',
														},
													];
													return false;
												}
												var valid77 =
													_errs369 === errors;
											} else {
												var valid77 = true;
											}
											if (valid77) {
												if (data.sql !== undefined) {
													const _errs371 = errors;
													if (
														!validate16(data.sql, {
															instancePath:
																instancePath +
																'/sql',
															parentData: data,
															parentDataProperty:
																'sql',
															rootData,
														})
													) {
														vErrors =
															vErrors === null
																? validate16.errors
																: vErrors.concat(
																		validate16.errors
																	);
														errors = vErrors.length;
													}
													var valid77 =
														_errs371 === errors;
												} else {
													var valid77 = true;
												}
											}
										}
									}
								}
							} else {
								validate28.errors = [
									{
										instancePath,
										schemaPath: '#/oneOf/21/type',
										keyword: 'type',
										params: { type: 'object' },
										message: 'must be object',
									},
								];
								return false;
							}
						}
					} else if (tag0 === 'setSiteOptions') {
						const _errs372 = errors;
						if (errors === _errs372) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing24;
								if (
									(data.options === undefined &&
										(missing24 = 'options')) ||
									(data.step === undefined &&
										(missing24 = 'step'))
								) {
									validate28.errors = [
										{
											instancePath,
											schemaPath: '#/oneOf/22/required',
											keyword: 'required',
											params: {
												missingProperty: missing24,
											},
											message:
												"must have required property '" +
												missing24 +
												"'",
										},
									];
									return false;
								} else {
									const _errs374 = errors;
									for (const key50 in data) {
										if (
											!(
												key50 === 'progress' ||
												key50 === 'step' ||
												key50 === 'options'
											)
										) {
											validate28.errors = [
												{
													instancePath,
													schemaPath:
														'#/oneOf/22/additionalProperties',
													keyword:
														'additionalProperties',
													params: {
														additionalProperty:
															key50,
													},
													message:
														'must NOT have additional properties',
												},
											];
											return false;
											break;
										}
									}
									if (_errs374 === errors) {
										if (data.progress !== undefined) {
											let data137 = data.progress;
											const _errs375 = errors;
											if (errors === _errs375) {
												if (
													data137 &&
													typeof data137 ==
														'object' &&
													!Array.isArray(data137)
												) {
													const _errs377 = errors;
													for (const key51 in data137) {
														if (
															!(
																key51 ===
																	'weight' ||
																key51 ===
																	'caption'
															)
														) {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/progress',
																		schemaPath:
																			'#/oneOf/22/properties/progress/additionalProperties',
																		keyword:
																			'additionalProperties',
																		params: {
																			additionalProperty:
																				key51,
																		},
																		message:
																			'must NOT have additional properties',
																	},
																];
															return false;
															break;
														}
													}
													if (_errs377 === errors) {
														if (
															data137.weight !==
															undefined
														) {
															let data138 =
																data137.weight;
															const _errs378 =
																errors;
															if (
																!(
																	typeof data138 ==
																		'number' &&
																	isFinite(
																		data138
																	)
																)
															) {
																validate28.errors =
																	[
																		{
																			instancePath:
																				instancePath +
																				'/progress/weight',
																			schemaPath:
																				'#/oneOf/22/properties/progress/properties/weight/type',
																			keyword:
																				'type',
																			params: {
																				type: 'number',
																			},
																			message:
																				'must be number',
																		},
																	];
																return false;
															}
															var valid81 =
																_errs378 ===
																errors;
														} else {
															var valid81 = true;
														}
														if (valid81) {
															if (
																data137.caption !==
																undefined
															) {
																const _errs380 =
																	errors;
																if (
																	typeof data137.caption !==
																	'string'
																) {
																	validate28.errors =
																		[
																			{
																				instancePath:
																					instancePath +
																					'/progress/caption',
																				schemaPath:
																					'#/oneOf/22/properties/progress/properties/caption/type',
																				keyword:
																					'type',
																				params: {
																					type: 'string',
																				},
																				message:
																					'must be string',
																			},
																		];
																	return false;
																}
																var valid81 =
																	_errs380 ===
																	errors;
															} else {
																var valid81 = true;
															}
														}
													}
												} else {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/progress',
															schemaPath:
																'#/oneOf/22/properties/progress/type',
															keyword: 'type',
															params: {
																type: 'object',
															},
															message:
																'must be object',
														},
													];
													return false;
												}
											}
											var valid80 = _errs375 === errors;
										} else {
											var valid80 = true;
										}
										if (valid80) {
											if (data.step !== undefined) {
												let data140 = data.step;
												const _errs382 = errors;
												if (
													typeof data140 !== 'string'
												) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/22/properties/step/type',
															keyword: 'type',
															params: {
																type: 'string',
															},
															message:
																'must be string',
														},
													];
													return false;
												}
												if (
													'setSiteOptions' !== data140
												) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/22/properties/step/const',
															keyword: 'const',
															params: {
																allowedValue:
																	'setSiteOptions',
															},
															message:
																'must be equal to constant',
														},
													];
													return false;
												}
												var valid80 =
													_errs382 === errors;
											} else {
												var valid80 = true;
											}
											if (valid80) {
												if (
													data.options !== undefined
												) {
													let data141 = data.options;
													const _errs384 = errors;
													if (errors === _errs384) {
														if (
															data141 &&
															typeof data141 ==
																'object' &&
															!Array.isArray(
																data141
															)
														) {
															for (const key52 in data141) {
																const _errs387 =
																	errors;
																var valid82 =
																	_errs387 ===
																	errors;
																if (!valid82) {
																	break;
																}
															}
														} else {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/options',
																		schemaPath:
																			'#/oneOf/22/properties/options/type',
																		keyword:
																			'type',
																		params: {
																			type: 'object',
																		},
																		message:
																			'must be object',
																	},
																];
															return false;
														}
													}
													var valid80 =
														_errs384 === errors;
												} else {
													var valid80 = true;
												}
											}
										}
									}
								}
							} else {
								validate28.errors = [
									{
										instancePath,
										schemaPath: '#/oneOf/22/type',
										keyword: 'type',
										params: { type: 'object' },
										message: 'must be object',
									},
								];
								return false;
							}
						}
					} else if (tag0 === 'unzip') {
						const _errs388 = errors;
						if (errors === _errs388) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing25;
								if (
									(data.extractToPath === undefined &&
										(missing25 = 'extractToPath')) ||
									(data.step === undefined &&
										(missing25 = 'step'))
								) {
									validate28.errors = [
										{
											instancePath,
											schemaPath: '#/oneOf/23/required',
											keyword: 'required',
											params: {
												missingProperty: missing25,
											},
											message:
												"must have required property '" +
												missing25 +
												"'",
										},
									];
									return false;
								} else {
									const _errs390 = errors;
									for (const key53 in data) {
										if (
											!(
												key53 === 'progress' ||
												key53 === 'step' ||
												key53 === 'zipFile' ||
												key53 === 'zipPath' ||
												key53 === 'extractToPath'
											)
										) {
											validate28.errors = [
												{
													instancePath,
													schemaPath:
														'#/oneOf/23/additionalProperties',
													keyword:
														'additionalProperties',
													params: {
														additionalProperty:
															key53,
													},
													message:
														'must NOT have additional properties',
												},
											];
											return false;
											break;
										}
									}
									if (_errs390 === errors) {
										if (data.progress !== undefined) {
											let data143 = data.progress;
											const _errs391 = errors;
											if (errors === _errs391) {
												if (
													data143 &&
													typeof data143 ==
														'object' &&
													!Array.isArray(data143)
												) {
													const _errs393 = errors;
													for (const key54 in data143) {
														if (
															!(
																key54 ===
																	'weight' ||
																key54 ===
																	'caption'
															)
														) {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/progress',
																		schemaPath:
																			'#/oneOf/23/properties/progress/additionalProperties',
																		keyword:
																			'additionalProperties',
																		params: {
																			additionalProperty:
																				key54,
																		},
																		message:
																			'must NOT have additional properties',
																	},
																];
															return false;
															break;
														}
													}
													if (_errs393 === errors) {
														if (
															data143.weight !==
															undefined
														) {
															let data144 =
																data143.weight;
															const _errs394 =
																errors;
															if (
																!(
																	typeof data144 ==
																		'number' &&
																	isFinite(
																		data144
																	)
																)
															) {
																validate28.errors =
																	[
																		{
																			instancePath:
																				instancePath +
																				'/progress/weight',
																			schemaPath:
																				'#/oneOf/23/properties/progress/properties/weight/type',
																			keyword:
																				'type',
																			params: {
																				type: 'number',
																			},
																			message:
																				'must be number',
																		},
																	];
																return false;
															}
															var valid85 =
																_errs394 ===
																errors;
														} else {
															var valid85 = true;
														}
														if (valid85) {
															if (
																data143.caption !==
																undefined
															) {
																const _errs396 =
																	errors;
																if (
																	typeof data143.caption !==
																	'string'
																) {
																	validate28.errors =
																		[
																			{
																				instancePath:
																					instancePath +
																					'/progress/caption',
																				schemaPath:
																					'#/oneOf/23/properties/progress/properties/caption/type',
																				keyword:
																					'type',
																				params: {
																					type: 'string',
																				},
																				message:
																					'must be string',
																			},
																		];
																	return false;
																}
																var valid85 =
																	_errs396 ===
																	errors;
															} else {
																var valid85 = true;
															}
														}
													}
												} else {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/progress',
															schemaPath:
																'#/oneOf/23/properties/progress/type',
															keyword: 'type',
															params: {
																type: 'object',
															},
															message:
																'must be object',
														},
													];
													return false;
												}
											}
											var valid84 = _errs391 === errors;
										} else {
											var valid84 = true;
										}
										if (valid84) {
											if (data.step !== undefined) {
												let data146 = data.step;
												const _errs398 = errors;
												if (
													typeof data146 !== 'string'
												) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/23/properties/step/type',
															keyword: 'type',
															params: {
																type: 'string',
															},
															message:
																'must be string',
														},
													];
													return false;
												}
												if ('unzip' !== data146) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/23/properties/step/const',
															keyword: 'const',
															params: {
																allowedValue:
																	'unzip',
															},
															message:
																'must be equal to constant',
														},
													];
													return false;
												}
												var valid84 =
													_errs398 === errors;
											} else {
												var valid84 = true;
											}
											if (valid84) {
												if (
													data.zipFile !== undefined
												) {
													const _errs400 = errors;
													if (
														!validate16(
															data.zipFile,
															{
																instancePath:
																	instancePath +
																	'/zipFile',
																parentData:
																	data,
																parentDataProperty:
																	'zipFile',
																rootData,
															}
														)
													) {
														vErrors =
															vErrors === null
																? validate16.errors
																: vErrors.concat(
																		validate16.errors
																	);
														errors = vErrors.length;
													}
													var valid84 =
														_errs400 === errors;
												} else {
													var valid84 = true;
												}
												if (valid84) {
													if (
														data.zipPath !==
														undefined
													) {
														const _errs401 = errors;
														if (
															typeof data.zipPath !==
															'string'
														) {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/zipPath',
																		schemaPath:
																			'#/oneOf/23/properties/zipPath/type',
																		keyword:
																			'type',
																		params: {
																			type: 'string',
																		},
																		message:
																			'must be string',
																	},
																];
															return false;
														}
														var valid84 =
															_errs401 === errors;
													} else {
														var valid84 = true;
													}
													if (valid84) {
														if (
															data.extractToPath !==
															undefined
														) {
															const _errs403 =
																errors;
															if (
																typeof data.extractToPath !==
																'string'
															) {
																validate28.errors =
																	[
																		{
																			instancePath:
																				instancePath +
																				'/extractToPath',
																			schemaPath:
																				'#/oneOf/23/properties/extractToPath/type',
																			keyword:
																				'type',
																			params: {
																				type: 'string',
																			},
																			message:
																				'must be string',
																		},
																	];
																return false;
															}
															var valid84 =
																_errs403 ===
																errors;
														} else {
															var valid84 = true;
														}
													}
												}
											}
										}
									}
								}
							} else {
								validate28.errors = [
									{
										instancePath,
										schemaPath: '#/oneOf/23/type',
										keyword: 'type',
										params: { type: 'object' },
										message: 'must be object',
									},
								];
								return false;
							}
						}
					} else if (tag0 === 'updateUserMeta') {
						const _errs405 = errors;
						if (errors === _errs405) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing26;
								if (
									(data.meta === undefined &&
										(missing26 = 'meta')) ||
									(data.step === undefined &&
										(missing26 = 'step')) ||
									(data.userId === undefined &&
										(missing26 = 'userId'))
								) {
									validate28.errors = [
										{
											instancePath,
											schemaPath: '#/oneOf/24/required',
											keyword: 'required',
											params: {
												missingProperty: missing26,
											},
											message:
												"must have required property '" +
												missing26 +
												"'",
										},
									];
									return false;
								} else {
									const _errs407 = errors;
									for (const key55 in data) {
										if (
											!(
												key55 === 'progress' ||
												key55 === 'step' ||
												key55 === 'meta' ||
												key55 === 'userId'
											)
										) {
											validate28.errors = [
												{
													instancePath,
													schemaPath:
														'#/oneOf/24/additionalProperties',
													keyword:
														'additionalProperties',
													params: {
														additionalProperty:
															key55,
													},
													message:
														'must NOT have additional properties',
												},
											];
											return false;
											break;
										}
									}
									if (_errs407 === errors) {
										if (data.progress !== undefined) {
											let data150 = data.progress;
											const _errs408 = errors;
											if (errors === _errs408) {
												if (
													data150 &&
													typeof data150 ==
														'object' &&
													!Array.isArray(data150)
												) {
													const _errs410 = errors;
													for (const key56 in data150) {
														if (
															!(
																key56 ===
																	'weight' ||
																key56 ===
																	'caption'
															)
														) {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/progress',
																		schemaPath:
																			'#/oneOf/24/properties/progress/additionalProperties',
																		keyword:
																			'additionalProperties',
																		params: {
																			additionalProperty:
																				key56,
																		},
																		message:
																			'must NOT have additional properties',
																	},
																];
															return false;
															break;
														}
													}
													if (_errs410 === errors) {
														if (
															data150.weight !==
															undefined
														) {
															let data151 =
																data150.weight;
															const _errs411 =
																errors;
															if (
																!(
																	typeof data151 ==
																		'number' &&
																	isFinite(
																		data151
																	)
																)
															) {
																validate28.errors =
																	[
																		{
																			instancePath:
																				instancePath +
																				'/progress/weight',
																			schemaPath:
																				'#/oneOf/24/properties/progress/properties/weight/type',
																			keyword:
																				'type',
																			params: {
																				type: 'number',
																			},
																			message:
																				'must be number',
																		},
																	];
																return false;
															}
															var valid88 =
																_errs411 ===
																errors;
														} else {
															var valid88 = true;
														}
														if (valid88) {
															if (
																data150.caption !==
																undefined
															) {
																const _errs413 =
																	errors;
																if (
																	typeof data150.caption !==
																	'string'
																) {
																	validate28.errors =
																		[
																			{
																				instancePath:
																					instancePath +
																					'/progress/caption',
																				schemaPath:
																					'#/oneOf/24/properties/progress/properties/caption/type',
																				keyword:
																					'type',
																				params: {
																					type: 'string',
																				},
																				message:
																					'must be string',
																			},
																		];
																	return false;
																}
																var valid88 =
																	_errs413 ===
																	errors;
															} else {
																var valid88 = true;
															}
														}
													}
												} else {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/progress',
															schemaPath:
																'#/oneOf/24/properties/progress/type',
															keyword: 'type',
															params: {
																type: 'object',
															},
															message:
																'must be object',
														},
													];
													return false;
												}
											}
											var valid87 = _errs408 === errors;
										} else {
											var valid87 = true;
										}
										if (valid87) {
											if (data.step !== undefined) {
												let data153 = data.step;
												const _errs415 = errors;
												if (
													typeof data153 !== 'string'
												) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/24/properties/step/type',
															keyword: 'type',
															params: {
																type: 'string',
															},
															message:
																'must be string',
														},
													];
													return false;
												}
												if (
													'updateUserMeta' !== data153
												) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/24/properties/step/const',
															keyword: 'const',
															params: {
																allowedValue:
																	'updateUserMeta',
															},
															message:
																'must be equal to constant',
														},
													];
													return false;
												}
												var valid87 =
													_errs415 === errors;
											} else {
												var valid87 = true;
											}
											if (valid87) {
												if (data.meta !== undefined) {
													let data154 = data.meta;
													const _errs417 = errors;
													if (errors === _errs417) {
														if (
															data154 &&
															typeof data154 ==
																'object' &&
															!Array.isArray(
																data154
															)
														) {
															for (const key57 in data154) {
																const _errs420 =
																	errors;
																var valid89 =
																	_errs420 ===
																	errors;
																if (!valid89) {
																	break;
																}
															}
														} else {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/meta',
																		schemaPath:
																			'#/oneOf/24/properties/meta/type',
																		keyword:
																			'type',
																		params: {
																			type: 'object',
																		},
																		message:
																			'must be object',
																	},
																];
															return false;
														}
													}
													var valid87 =
														_errs417 === errors;
												} else {
													var valid87 = true;
												}
												if (valid87) {
													if (
														data.userId !==
														undefined
													) {
														let data156 =
															data.userId;
														const _errs421 = errors;
														if (
															!(
																typeof data156 ==
																	'number' &&
																isFinite(
																	data156
																)
															)
														) {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/userId',
																		schemaPath:
																			'#/oneOf/24/properties/userId/type',
																		keyword:
																			'type',
																		params: {
																			type: 'number',
																		},
																		message:
																			'must be number',
																	},
																];
															return false;
														}
														var valid87 =
															_errs421 === errors;
													} else {
														var valid87 = true;
													}
												}
											}
										}
									}
								}
							} else {
								validate28.errors = [
									{
										instancePath,
										schemaPath: '#/oneOf/24/type',
										keyword: 'type',
										params: { type: 'object' },
										message: 'must be object',
									},
								];
								return false;
							}
						}
					} else if (tag0 === 'writeFile') {
						const _errs423 = errors;
						if (errors === _errs423) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing27;
								if (
									(data.data === undefined &&
										(missing27 = 'data')) ||
									(data.path === undefined &&
										(missing27 = 'path')) ||
									(data.step === undefined &&
										(missing27 = 'step'))
								) {
									validate28.errors = [
										{
											instancePath,
											schemaPath: '#/oneOf/25/required',
											keyword: 'required',
											params: {
												missingProperty: missing27,
											},
											message:
												"must have required property '" +
												missing27 +
												"'",
										},
									];
									return false;
								} else {
									const _errs425 = errors;
									for (const key58 in data) {
										if (
											!(
												key58 === 'progress' ||
												key58 === 'step' ||
												key58 === 'path' ||
												key58 === 'data'
											)
										) {
											validate28.errors = [
												{
													instancePath,
													schemaPath:
														'#/oneOf/25/additionalProperties',
													keyword:
														'additionalProperties',
													params: {
														additionalProperty:
															key58,
													},
													message:
														'must NOT have additional properties',
												},
											];
											return false;
											break;
										}
									}
									if (_errs425 === errors) {
										if (data.progress !== undefined) {
											let data157 = data.progress;
											const _errs426 = errors;
											if (errors === _errs426) {
												if (
													data157 &&
													typeof data157 ==
														'object' &&
													!Array.isArray(data157)
												) {
													const _errs428 = errors;
													for (const key59 in data157) {
														if (
															!(
																key59 ===
																	'weight' ||
																key59 ===
																	'caption'
															)
														) {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/progress',
																		schemaPath:
																			'#/oneOf/25/properties/progress/additionalProperties',
																		keyword:
																			'additionalProperties',
																		params: {
																			additionalProperty:
																				key59,
																		},
																		message:
																			'must NOT have additional properties',
																	},
																];
															return false;
															break;
														}
													}
													if (_errs428 === errors) {
														if (
															data157.weight !==
															undefined
														) {
															let data158 =
																data157.weight;
															const _errs429 =
																errors;
															if (
																!(
																	typeof data158 ==
																		'number' &&
																	isFinite(
																		data158
																	)
																)
															) {
																validate28.errors =
																	[
																		{
																			instancePath:
																				instancePath +
																				'/progress/weight',
																			schemaPath:
																				'#/oneOf/25/properties/progress/properties/weight/type',
																			keyword:
																				'type',
																			params: {
																				type: 'number',
																			},
																			message:
																				'must be number',
																		},
																	];
																return false;
															}
															var valid92 =
																_errs429 ===
																errors;
														} else {
															var valid92 = true;
														}
														if (valid92) {
															if (
																data157.caption !==
																undefined
															) {
																const _errs431 =
																	errors;
																if (
																	typeof data157.caption !==
																	'string'
																) {
																	validate28.errors =
																		[
																			{
																				instancePath:
																					instancePath +
																					'/progress/caption',
																				schemaPath:
																					'#/oneOf/25/properties/progress/properties/caption/type',
																				keyword:
																					'type',
																				params: {
																					type: 'string',
																				},
																				message:
																					'must be string',
																			},
																		];
																	return false;
																}
																var valid92 =
																	_errs431 ===
																	errors;
															} else {
																var valid92 = true;
															}
														}
													}
												} else {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/progress',
															schemaPath:
																'#/oneOf/25/properties/progress/type',
															keyword: 'type',
															params: {
																type: 'object',
															},
															message:
																'must be object',
														},
													];
													return false;
												}
											}
											var valid91 = _errs426 === errors;
										} else {
											var valid91 = true;
										}
										if (valid91) {
											if (data.step !== undefined) {
												let data160 = data.step;
												const _errs433 = errors;
												if (
													typeof data160 !== 'string'
												) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/25/properties/step/type',
															keyword: 'type',
															params: {
																type: 'string',
															},
															message:
																'must be string',
														},
													];
													return false;
												}
												if ('writeFile' !== data160) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/25/properties/step/const',
															keyword: 'const',
															params: {
																allowedValue:
																	'writeFile',
															},
															message:
																'must be equal to constant',
														},
													];
													return false;
												}
												var valid91 =
													_errs433 === errors;
											} else {
												var valid91 = true;
											}
											if (valid91) {
												if (data.path !== undefined) {
													const _errs435 = errors;
													if (
														typeof data.path !==
														'string'
													) {
														validate28.errors = [
															{
																instancePath:
																	instancePath +
																	'/path',
																schemaPath:
																	'#/oneOf/25/properties/path/type',
																keyword: 'type',
																params: {
																	type: 'string',
																},
																message:
																	'must be string',
															},
														];
														return false;
													}
													var valid91 =
														_errs435 === errors;
												} else {
													var valid91 = true;
												}
												if (valid91) {
													if (
														data.data !== undefined
													) {
														let data162 = data.data;
														const _errs437 = errors;
														const _errs438 = errors;
														let valid93 = false;
														const _errs439 = errors;
														if (
															!validate16(
																data162,
																{
																	instancePath:
																		instancePath +
																		'/data',
																	parentData:
																		data,
																	parentDataProperty:
																		'data',
																	rootData,
																}
															)
														) {
															vErrors =
																vErrors === null
																	? validate16.errors
																	: vErrors.concat(
																			validate16.errors
																		);
															errors =
																vErrors.length;
														}
														var _valid3 =
															_errs439 === errors;
														valid93 =
															valid93 || _valid3;
														if (!valid93) {
															const _errs440 =
																errors;
															if (
																typeof data162 !==
																'string'
															) {
																const err9 = {
																	instancePath:
																		instancePath +
																		'/data',
																	schemaPath:
																		'#/oneOf/25/properties/data/anyOf/1/type',
																	keyword:
																		'type',
																	params: {
																		type: 'string',
																	},
																	message:
																		'must be string',
																};
																if (
																	vErrors ===
																	null
																) {
																	vErrors = [
																		err9,
																	];
																} else {
																	vErrors.push(
																		err9
																	);
																}
																errors++;
															}
															var _valid3 =
																_errs440 ===
																errors;
															valid93 =
																valid93 ||
																_valid3;
															if (!valid93) {
																const _errs442 =
																	errors;
																if (
																	errors ===
																	_errs442
																) {
																	if (
																		data162 &&
																		typeof data162 ==
																			'object' &&
																		!Array.isArray(
																			data162
																		)
																	) {
																		let missing28;
																		if (
																			(data162.BYTES_PER_ELEMENT ===
																				undefined &&
																				(missing28 =
																					'BYTES_PER_ELEMENT')) ||
																			(data162.buffer ===
																				undefined &&
																				(missing28 =
																					'buffer')) ||
																			(data162.byteLength ===
																				undefined &&
																				(missing28 =
																					'byteLength')) ||
																			(data162.byteOffset ===
																				undefined &&
																				(missing28 =
																					'byteOffset')) ||
																			(data162.length ===
																				undefined &&
																				(missing28 =
																					'length'))
																		) {
																			const err10 =
																				{
																					instancePath:
																						instancePath +
																						'/data',
																					schemaPath:
																						'#/oneOf/25/properties/data/anyOf/2/required',
																					keyword:
																						'required',
																					params: {
																						missingProperty:
																							missing28,
																					},
																					message:
																						"must have required property '" +
																						missing28 +
																						"'",
																				};
																			if (
																				vErrors ===
																				null
																			) {
																				vErrors =
																					[
																						err10,
																					];
																			} else {
																				vErrors.push(
																					err10
																				);
																			}
																			errors++;
																		} else {
																			const _errs444 =
																				errors;
																			for (const key60 in data162) {
																				if (
																					!(
																						key60 ===
																							'BYTES_PER_ELEMENT' ||
																						key60 ===
																							'buffer' ||
																						key60 ===
																							'byteLength' ||
																						key60 ===
																							'byteOffset' ||
																						key60 ===
																							'length'
																					)
																				) {
																					let data163 =
																						data162[
																							key60
																						];
																					const _errs445 =
																						errors;
																					if (
																						!(
																							typeof data163 ==
																								'number' &&
																							isFinite(
																								data163
																							)
																						)
																					) {
																						const err11 =
																							{
																								instancePath:
																									instancePath +
																									'/data/' +
																									key60
																										.replace(
																											/~/g,
																											'~0'
																										)
																										.replace(
																											/\//g,
																											'~1'
																										),
																								schemaPath:
																									'#/oneOf/25/properties/data/anyOf/2/additionalProperties/type',
																								keyword:
																									'type',
																								params: {
																									type: 'number',
																								},
																								message:
																									'must be number',
																							};
																						if (
																							vErrors ===
																							null
																						) {
																							vErrors =
																								[
																									err11,
																								];
																						} else {
																							vErrors.push(
																								err11
																							);
																						}
																						errors++;
																					}
																					var valid94 =
																						_errs445 ===
																						errors;
																					if (
																						!valid94
																					) {
																						break;
																					}
																				}
																			}
																			if (
																				_errs444 ===
																				errors
																			) {
																				if (
																					data162.BYTES_PER_ELEMENT !==
																					undefined
																				) {
																					let data164 =
																						data162.BYTES_PER_ELEMENT;
																					const _errs447 =
																						errors;
																					if (
																						!(
																							typeof data164 ==
																								'number' &&
																							isFinite(
																								data164
																							)
																						)
																					) {
																						const err12 =
																							{
																								instancePath:
																									instancePath +
																									'/data/BYTES_PER_ELEMENT',
																								schemaPath:
																									'#/oneOf/25/properties/data/anyOf/2/properties/BYTES_PER_ELEMENT/type',
																								keyword:
																									'type',
																								params: {
																									type: 'number',
																								},
																								message:
																									'must be number',
																							};
																						if (
																							vErrors ===
																							null
																						) {
																							vErrors =
																								[
																									err12,
																								];
																						} else {
																							vErrors.push(
																								err12
																							);
																						}
																						errors++;
																					}
																					var valid95 =
																						_errs447 ===
																						errors;
																				} else {
																					var valid95 = true;
																				}
																				if (
																					valid95
																				) {
																					if (
																						data162.buffer !==
																						undefined
																					) {
																						let data165 =
																							data162.buffer;
																						const _errs449 =
																							errors;
																						if (
																							errors ===
																							_errs449
																						) {
																							if (
																								data165 &&
																								typeof data165 ==
																									'object' &&
																								!Array.isArray(
																									data165
																								)
																							) {
																								let missing29;
																								if (
																									data165.byteLength ===
																										undefined &&
																									(missing29 =
																										'byteLength')
																								) {
																									const err13 =
																										{
																											instancePath:
																												instancePath +
																												'/data/buffer',
																											schemaPath:
																												'#/oneOf/25/properties/data/anyOf/2/properties/buffer/required',
																											keyword:
																												'required',
																											params: {
																												missingProperty:
																													missing29,
																											},
																											message:
																												"must have required property '" +
																												missing29 +
																												"'",
																										};
																									if (
																										vErrors ===
																										null
																									) {
																										vErrors =
																											[
																												err13,
																											];
																									} else {
																										vErrors.push(
																											err13
																										);
																									}
																									errors++;
																								} else {
																									const _errs451 =
																										errors;
																									for (const key61 in data165) {
																										if (
																											!(
																												key61 ===
																												'byteLength'
																											)
																										) {
																											const err14 =
																												{
																													instancePath:
																														instancePath +
																														'/data/buffer',
																													schemaPath:
																														'#/oneOf/25/properties/data/anyOf/2/properties/buffer/additionalProperties',
																													keyword:
																														'additionalProperties',
																													params: {
																														additionalProperty:
																															key61,
																													},
																													message:
																														'must NOT have additional properties',
																												};
																											if (
																												vErrors ===
																												null
																											) {
																												vErrors =
																													[
																														err14,
																													];
																											} else {
																												vErrors.push(
																													err14
																												);
																											}
																											errors++;
																											break;
																										}
																									}
																									if (
																										_errs451 ===
																										errors
																									) {
																										if (
																											data165.byteLength !==
																											undefined
																										) {
																											let data166 =
																												data165.byteLength;
																											if (
																												!(
																													typeof data166 ==
																														'number' &&
																													isFinite(
																														data166
																													)
																												)
																											) {
																												const err15 =
																													{
																														instancePath:
																															instancePath +
																															'/data/buffer/byteLength',
																														schemaPath:
																															'#/oneOf/25/properties/data/anyOf/2/properties/buffer/properties/byteLength/type',
																														keyword:
																															'type',
																														params: {
																															type: 'number',
																														},
																														message:
																															'must be number',
																													};
																												if (
																													vErrors ===
																													null
																												) {
																													vErrors =
																														[
																															err15,
																														];
																												} else {
																													vErrors.push(
																														err15
																													);
																												}
																												errors++;
																											}
																										}
																									}
																								}
																							} else {
																								const err16 =
																									{
																										instancePath:
																											instancePath +
																											'/data/buffer',
																										schemaPath:
																											'#/oneOf/25/properties/data/anyOf/2/properties/buffer/type',
																										keyword:
																											'type',
																										params: {
																											type: 'object',
																										},
																										message:
																											'must be object',
																									};
																								if (
																									vErrors ===
																									null
																								) {
																									vErrors =
																										[
																											err16,
																										];
																								} else {
																									vErrors.push(
																										err16
																									);
																								}
																								errors++;
																							}
																						}
																						var valid95 =
																							_errs449 ===
																							errors;
																					} else {
																						var valid95 = true;
																					}
																					if (
																						valid95
																					) {
																						if (
																							data162.byteLength !==
																							undefined
																						) {
																							let data167 =
																								data162.byteLength;
																							const _errs454 =
																								errors;
																							if (
																								!(
																									typeof data167 ==
																										'number' &&
																									isFinite(
																										data167
																									)
																								)
																							) {
																								const err17 =
																									{
																										instancePath:
																											instancePath +
																											'/data/byteLength',
																										schemaPath:
																											'#/oneOf/25/properties/data/anyOf/2/properties/byteLength/type',
																										keyword:
																											'type',
																										params: {
																											type: 'number',
																										},
																										message:
																											'must be number',
																									};
																								if (
																									vErrors ===
																									null
																								) {
																									vErrors =
																										[
																											err17,
																										];
																								} else {
																									vErrors.push(
																										err17
																									);
																								}
																								errors++;
																							}
																							var valid95 =
																								_errs454 ===
																								errors;
																						} else {
																							var valid95 = true;
																						}
																						if (
																							valid95
																						) {
																							if (
																								data162.byteOffset !==
																								undefined
																							) {
																								let data168 =
																									data162.byteOffset;
																								const _errs456 =
																									errors;
																								if (
																									!(
																										typeof data168 ==
																											'number' &&
																										isFinite(
																											data168
																										)
																									)
																								) {
																									const err18 =
																										{
																											instancePath:
																												instancePath +
																												'/data/byteOffset',
																											schemaPath:
																												'#/oneOf/25/properties/data/anyOf/2/properties/byteOffset/type',
																											keyword:
																												'type',
																											params: {
																												type: 'number',
																											},
																											message:
																												'must be number',
																										};
																									if (
																										vErrors ===
																										null
																									) {
																										vErrors =
																											[
																												err18,
																											];
																									} else {
																										vErrors.push(
																											err18
																										);
																									}
																									errors++;
																								}
																								var valid95 =
																									_errs456 ===
																									errors;
																							} else {
																								var valid95 = true;
																							}
																							if (
																								valid95
																							) {
																								if (
																									data162.length !==
																									undefined
																								) {
																									let data169 =
																										data162.length;
																									const _errs458 =
																										errors;
																									if (
																										!(
																											typeof data169 ==
																												'number' &&
																											isFinite(
																												data169
																											)
																										)
																									) {
																										const err19 =
																											{
																												instancePath:
																													instancePath +
																													'/data/length',
																												schemaPath:
																													'#/oneOf/25/properties/data/anyOf/2/properties/length/type',
																												keyword:
																													'type',
																												params: {
																													type: 'number',
																												},
																												message:
																													'must be number',
																											};
																										if (
																											vErrors ===
																											null
																										) {
																											vErrors =
																												[
																													err19,
																												];
																										} else {
																											vErrors.push(
																												err19
																											);
																										}
																										errors++;
																									}
																									var valid95 =
																										_errs458 ===
																										errors;
																								} else {
																									var valid95 = true;
																								}
																							}
																						}
																					}
																				}
																			}
																		}
																	} else {
																		const err20 =
																			{
																				instancePath:
																					instancePath +
																					'/data',
																				schemaPath:
																					'#/oneOf/25/properties/data/anyOf/2/type',
																				keyword:
																					'type',
																				params: {
																					type: 'object',
																				},
																				message:
																					'must be object',
																			};
																		if (
																			vErrors ===
																			null
																		) {
																			vErrors =
																				[
																					err20,
																				];
																		} else {
																			vErrors.push(
																				err20
																			);
																		}
																		errors++;
																	}
																}
																var _valid3 =
																	_errs442 ===
																	errors;
																valid93 =
																	valid93 ||
																	_valid3;
															}
														}
														if (!valid93) {
															const err21 = {
																instancePath:
																	instancePath +
																	'/data',
																schemaPath:
																	'#/oneOf/25/properties/data/anyOf',
																keyword:
																	'anyOf',
																params: {},
																message:
																	'must match a schema in anyOf',
															};
															if (
																vErrors === null
															) {
																vErrors = [
																	err21,
																];
															} else {
																vErrors.push(
																	err21
																);
															}
															errors++;
															validate28.errors =
																vErrors;
															return false;
														} else {
															errors = _errs438;
															if (
																vErrors !== null
															) {
																if (_errs438) {
																	vErrors.length =
																		_errs438;
																} else {
																	vErrors =
																		null;
																}
															}
														}
														var valid91 =
															_errs437 === errors;
													} else {
														var valid91 = true;
													}
												}
											}
										}
									}
								}
							} else {
								validate28.errors = [
									{
										instancePath,
										schemaPath: '#/oneOf/25/type',
										keyword: 'type',
										params: { type: 'object' },
										message: 'must be object',
									},
								];
								return false;
							}
						}
					} else if (tag0 === 'writeFiles') {
						const _errs460 = errors;
						if (errors === _errs460) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing30;
								if (
									(data.filesTree === undefined &&
										(missing30 = 'filesTree')) ||
									(data.step === undefined &&
										(missing30 = 'step')) ||
									(data.writeToPath === undefined &&
										(missing30 = 'writeToPath'))
								) {
									validate28.errors = [
										{
											instancePath,
											schemaPath: '#/oneOf/26/required',
											keyword: 'required',
											params: {
												missingProperty: missing30,
											},
											message:
												"must have required property '" +
												missing30 +
												"'",
										},
									];
									return false;
								} else {
									const _errs462 = errors;
									for (const key62 in data) {
										if (
											!(
												key62 === 'progress' ||
												key62 === 'step' ||
												key62 === 'writeToPath' ||
												key62 === 'filesTree'
											)
										) {
											validate28.errors = [
												{
													instancePath,
													schemaPath:
														'#/oneOf/26/additionalProperties',
													keyword:
														'additionalProperties',
													params: {
														additionalProperty:
															key62,
													},
													message:
														'must NOT have additional properties',
												},
											];
											return false;
											break;
										}
									}
									if (_errs462 === errors) {
										if (data.progress !== undefined) {
											let data170 = data.progress;
											const _errs463 = errors;
											if (errors === _errs463) {
												if (
													data170 &&
													typeof data170 ==
														'object' &&
													!Array.isArray(data170)
												) {
													const _errs465 = errors;
													for (const key63 in data170) {
														if (
															!(
																key63 ===
																	'weight' ||
																key63 ===
																	'caption'
															)
														) {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/progress',
																		schemaPath:
																			'#/oneOf/26/properties/progress/additionalProperties',
																		keyword:
																			'additionalProperties',
																		params: {
																			additionalProperty:
																				key63,
																		},
																		message:
																			'must NOT have additional properties',
																	},
																];
															return false;
															break;
														}
													}
													if (_errs465 === errors) {
														if (
															data170.weight !==
															undefined
														) {
															let data171 =
																data170.weight;
															const _errs466 =
																errors;
															if (
																!(
																	typeof data171 ==
																		'number' &&
																	isFinite(
																		data171
																	)
																)
															) {
																validate28.errors =
																	[
																		{
																			instancePath:
																				instancePath +
																				'/progress/weight',
																			schemaPath:
																				'#/oneOf/26/properties/progress/properties/weight/type',
																			keyword:
																				'type',
																			params: {
																				type: 'number',
																			},
																			message:
																				'must be number',
																		},
																	];
																return false;
															}
															var valid99 =
																_errs466 ===
																errors;
														} else {
															var valid99 = true;
														}
														if (valid99) {
															if (
																data170.caption !==
																undefined
															) {
																const _errs468 =
																	errors;
																if (
																	typeof data170.caption !==
																	'string'
																) {
																	validate28.errors =
																		[
																			{
																				instancePath:
																					instancePath +
																					'/progress/caption',
																				schemaPath:
																					'#/oneOf/26/properties/progress/properties/caption/type',
																				keyword:
																					'type',
																				params: {
																					type: 'string',
																				},
																				message:
																					'must be string',
																			},
																		];
																	return false;
																}
																var valid99 =
																	_errs468 ===
																	errors;
															} else {
																var valid99 = true;
															}
														}
													}
												} else {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/progress',
															schemaPath:
																'#/oneOf/26/properties/progress/type',
															keyword: 'type',
															params: {
																type: 'object',
															},
															message:
																'must be object',
														},
													];
													return false;
												}
											}
											var valid98 = _errs463 === errors;
										} else {
											var valid98 = true;
										}
										if (valid98) {
											if (data.step !== undefined) {
												let data173 = data.step;
												const _errs470 = errors;
												if (
													typeof data173 !== 'string'
												) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/26/properties/step/type',
															keyword: 'type',
															params: {
																type: 'string',
															},
															message:
																'must be string',
														},
													];
													return false;
												}
												if ('writeFiles' !== data173) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/26/properties/step/const',
															keyword: 'const',
															params: {
																allowedValue:
																	'writeFiles',
															},
															message:
																'must be equal to constant',
														},
													];
													return false;
												}
												var valid98 =
													_errs470 === errors;
											} else {
												var valid98 = true;
											}
											if (valid98) {
												if (
													data.writeToPath !==
													undefined
												) {
													const _errs472 = errors;
													if (
														typeof data.writeToPath !==
														'string'
													) {
														validate28.errors = [
															{
																instancePath:
																	instancePath +
																	'/writeToPath',
																schemaPath:
																	'#/oneOf/26/properties/writeToPath/type',
																keyword: 'type',
																params: {
																	type: 'string',
																},
																message:
																	'must be string',
															},
														];
														return false;
													}
													var valid98 =
														_errs472 === errors;
												} else {
													var valid98 = true;
												}
												if (valid98) {
													if (
														data.filesTree !==
														undefined
													) {
														const _errs474 = errors;
														if (
															!validate18(
																data.filesTree,
																{
																	instancePath:
																		instancePath +
																		'/filesTree',
																	parentData:
																		data,
																	parentDataProperty:
																		'filesTree',
																	rootData,
																}
															)
														) {
															vErrors =
																vErrors === null
																	? validate18.errors
																	: vErrors.concat(
																			validate18.errors
																		);
															errors =
																vErrors.length;
														}
														var valid98 =
															_errs474 === errors;
													} else {
														var valid98 = true;
													}
												}
											}
										}
									}
								}
							} else {
								validate28.errors = [
									{
										instancePath,
										schemaPath: '#/oneOf/26/type',
										keyword: 'type',
										params: { type: 'object' },
										message: 'must be object',
									},
								];
								return false;
							}
						}
					} else if (tag0 === 'wp-cli') {
						const _errs475 = errors;
						if (errors === _errs475) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing31;
								if (
									(data.command === undefined &&
										(missing31 = 'command')) ||
									(data.step === undefined &&
										(missing31 = 'step'))
								) {
									validate28.errors = [
										{
											instancePath,
											schemaPath: '#/oneOf/27/required',
											keyword: 'required',
											params: {
												missingProperty: missing31,
											},
											message:
												"must have required property '" +
												missing31 +
												"'",
										},
									];
									return false;
								} else {
									const _errs477 = errors;
									for (const key64 in data) {
										if (
											!(
												key64 === 'progress' ||
												key64 === 'step' ||
												key64 === 'command' ||
												key64 === 'wpCliPath'
											)
										) {
											validate28.errors = [
												{
													instancePath,
													schemaPath:
														'#/oneOf/27/additionalProperties',
													keyword:
														'additionalProperties',
													params: {
														additionalProperty:
															key64,
													},
													message:
														'must NOT have additional properties',
												},
											];
											return false;
											break;
										}
									}
									if (_errs477 === errors) {
										if (data.progress !== undefined) {
											let data176 = data.progress;
											const _errs478 = errors;
											if (errors === _errs478) {
												if (
													data176 &&
													typeof data176 ==
														'object' &&
													!Array.isArray(data176)
												) {
													const _errs480 = errors;
													for (const key65 in data176) {
														if (
															!(
																key65 ===
																	'weight' ||
																key65 ===
																	'caption'
															)
														) {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/progress',
																		schemaPath:
																			'#/oneOf/27/properties/progress/additionalProperties',
																		keyword:
																			'additionalProperties',
																		params: {
																			additionalProperty:
																				key65,
																		},
																		message:
																			'must NOT have additional properties',
																	},
																];
															return false;
															break;
														}
													}
													if (_errs480 === errors) {
														if (
															data176.weight !==
															undefined
														) {
															let data177 =
																data176.weight;
															const _errs481 =
																errors;
															if (
																!(
																	typeof data177 ==
																		'number' &&
																	isFinite(
																		data177
																	)
																)
															) {
																validate28.errors =
																	[
																		{
																			instancePath:
																				instancePath +
																				'/progress/weight',
																			schemaPath:
																				'#/oneOf/27/properties/progress/properties/weight/type',
																			keyword:
																				'type',
																			params: {
																				type: 'number',
																			},
																			message:
																				'must be number',
																		},
																	];
																return false;
															}
															var valid102 =
																_errs481 ===
																errors;
														} else {
															var valid102 = true;
														}
														if (valid102) {
															if (
																data176.caption !==
																undefined
															) {
																const _errs483 =
																	errors;
																if (
																	typeof data176.caption !==
																	'string'
																) {
																	validate28.errors =
																		[
																			{
																				instancePath:
																					instancePath +
																					'/progress/caption',
																				schemaPath:
																					'#/oneOf/27/properties/progress/properties/caption/type',
																				keyword:
																					'type',
																				params: {
																					type: 'string',
																				},
																				message:
																					'must be string',
																			},
																		];
																	return false;
																}
																var valid102 =
																	_errs483 ===
																	errors;
															} else {
																var valid102 = true;
															}
														}
													}
												} else {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/progress',
															schemaPath:
																'#/oneOf/27/properties/progress/type',
															keyword: 'type',
															params: {
																type: 'object',
															},
															message:
																'must be object',
														},
													];
													return false;
												}
											}
											var valid101 = _errs478 === errors;
										} else {
											var valid101 = true;
										}
										if (valid101) {
											if (data.step !== undefined) {
												let data179 = data.step;
												const _errs485 = errors;
												if (
													typeof data179 !== 'string'
												) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/27/properties/step/type',
															keyword: 'type',
															params: {
																type: 'string',
															},
															message:
																'must be string',
														},
													];
													return false;
												}
												if ('wp-cli' !== data179) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/27/properties/step/const',
															keyword: 'const',
															params: {
																allowedValue:
																	'wp-cli',
															},
															message:
																'must be equal to constant',
														},
													];
													return false;
												}
												var valid101 =
													_errs485 === errors;
											} else {
												var valid101 = true;
											}
											if (valid101) {
												if (
													data.command !== undefined
												) {
													let data180 = data.command;
													const _errs487 = errors;
													const _errs488 = errors;
													let valid103 = false;
													const _errs489 = errors;
													if (
														typeof data180 !==
														'string'
													) {
														const err22 = {
															instancePath:
																instancePath +
																'/command',
															schemaPath:
																'#/oneOf/27/properties/command/anyOf/0/type',
															keyword: 'type',
															params: {
																type: 'string',
															},
															message:
																'must be string',
														};
														if (vErrors === null) {
															vErrors = [err22];
														} else {
															vErrors.push(err22);
														}
														errors++;
													}
													var _valid4 =
														_errs489 === errors;
													valid103 =
														valid103 || _valid4;
													if (!valid103) {
														const _errs491 = errors;
														if (
															errors === _errs491
														) {
															if (
																Array.isArray(
																	data180
																)
															) {
																var valid104 = true;
																const len0 =
																	data180.length;
																for (
																	let i0 = 0;
																	i0 < len0;
																	i0++
																) {
																	const _errs493 =
																		errors;
																	if (
																		typeof data180[
																			i0
																		] !==
																		'string'
																	) {
																		const err23 =
																			{
																				instancePath:
																					instancePath +
																					'/command/' +
																					i0,
																				schemaPath:
																					'#/oneOf/27/properties/command/anyOf/1/items/type',
																				keyword:
																					'type',
																				params: {
																					type: 'string',
																				},
																				message:
																					'must be string',
																			};
																		if (
																			vErrors ===
																			null
																		) {
																			vErrors =
																				[
																					err23,
																				];
																		} else {
																			vErrors.push(
																				err23
																			);
																		}
																		errors++;
																	}
																	var valid104 =
																		_errs493 ===
																		errors;
																	if (
																		!valid104
																	) {
																		break;
																	}
																}
															} else {
																const err24 = {
																	instancePath:
																		instancePath +
																		'/command',
																	schemaPath:
																		'#/oneOf/27/properties/command/anyOf/1/type',
																	keyword:
																		'type',
																	params: {
																		type: 'array',
																	},
																	message:
																		'must be array',
																};
																if (
																	vErrors ===
																	null
																) {
																	vErrors = [
																		err24,
																	];
																} else {
																	vErrors.push(
																		err24
																	);
																}
																errors++;
															}
														}
														var _valid4 =
															_errs491 === errors;
														valid103 =
															valid103 || _valid4;
													}
													if (!valid103) {
														const err25 = {
															instancePath:
																instancePath +
																'/command',
															schemaPath:
																'#/oneOf/27/properties/command/anyOf',
															keyword: 'anyOf',
															params: {},
															message:
																'must match a schema in anyOf',
														};
														if (vErrors === null) {
															vErrors = [err25];
														} else {
															vErrors.push(err25);
														}
														errors++;
														validate28.errors =
															vErrors;
														return false;
													} else {
														errors = _errs488;
														if (vErrors !== null) {
															if (_errs488) {
																vErrors.length =
																	_errs488;
															} else {
																vErrors = null;
															}
														}
													}
													var valid101 =
														_errs487 === errors;
												} else {
													var valid101 = true;
												}
												if (valid101) {
													if (
														data.wpCliPath !==
														undefined
													) {
														const _errs495 = errors;
														if (
															typeof data.wpCliPath !==
															'string'
														) {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/wpCliPath',
																		schemaPath:
																			'#/oneOf/27/properties/wpCliPath/type',
																		keyword:
																			'type',
																		params: {
																			type: 'string',
																		},
																		message:
																			'must be string',
																	},
																];
															return false;
														}
														var valid101 =
															_errs495 === errors;
													} else {
														var valid101 = true;
													}
												}
											}
										}
									}
								}
							} else {
								validate28.errors = [
									{
										instancePath,
										schemaPath: '#/oneOf/27/type',
										keyword: 'type',
										params: { type: 'object' },
										message: 'must be object',
									},
								];
								return false;
							}
						}
					} else if (tag0 === 'setSiteLanguage') {
						const _errs497 = errors;
						if (errors === _errs497) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing32;
								if (
									(data.language === undefined &&
										(missing32 = 'language')) ||
									(data.step === undefined &&
										(missing32 = 'step'))
								) {
									validate28.errors = [
										{
											instancePath,
											schemaPath: '#/oneOf/28/required',
											keyword: 'required',
											params: {
												missingProperty: missing32,
											},
											message:
												"must have required property '" +
												missing32 +
												"'",
										},
									];
									return false;
								} else {
									const _errs499 = errors;
									for (const key66 in data) {
										if (
											!(
												key66 === 'progress' ||
												key66 === 'step' ||
												key66 === 'language'
											)
										) {
											validate28.errors = [
												{
													instancePath,
													schemaPath:
														'#/oneOf/28/additionalProperties',
													keyword:
														'additionalProperties',
													params: {
														additionalProperty:
															key66,
													},
													message:
														'must NOT have additional properties',
												},
											];
											return false;
											break;
										}
									}
									if (_errs499 === errors) {
										if (data.progress !== undefined) {
											let data183 = data.progress;
											const _errs500 = errors;
											if (errors === _errs500) {
												if (
													data183 &&
													typeof data183 ==
														'object' &&
													!Array.isArray(data183)
												) {
													const _errs502 = errors;
													for (const key67 in data183) {
														if (
															!(
																key67 ===
																	'weight' ||
																key67 ===
																	'caption'
															)
														) {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/progress',
																		schemaPath:
																			'#/oneOf/28/properties/progress/additionalProperties',
																		keyword:
																			'additionalProperties',
																		params: {
																			additionalProperty:
																				key67,
																		},
																		message:
																			'must NOT have additional properties',
																	},
																];
															return false;
															break;
														}
													}
													if (_errs502 === errors) {
														if (
															data183.weight !==
															undefined
														) {
															let data184 =
																data183.weight;
															const _errs503 =
																errors;
															if (
																!(
																	typeof data184 ==
																		'number' &&
																	isFinite(
																		data184
																	)
																)
															) {
																validate28.errors =
																	[
																		{
																			instancePath:
																				instancePath +
																				'/progress/weight',
																			schemaPath:
																				'#/oneOf/28/properties/progress/properties/weight/type',
																			keyword:
																				'type',
																			params: {
																				type: 'number',
																			},
																			message:
																				'must be number',
																		},
																	];
																return false;
															}
															var valid107 =
																_errs503 ===
																errors;
														} else {
															var valid107 = true;
														}
														if (valid107) {
															if (
																data183.caption !==
																undefined
															) {
																const _errs505 =
																	errors;
																if (
																	typeof data183.caption !==
																	'string'
																) {
																	validate28.errors =
																		[
																			{
																				instancePath:
																					instancePath +
																					'/progress/caption',
																				schemaPath:
																					'#/oneOf/28/properties/progress/properties/caption/type',
																				keyword:
																					'type',
																				params: {
																					type: 'string',
																				},
																				message:
																					'must be string',
																			},
																		];
																	return false;
																}
																var valid107 =
																	_errs505 ===
																	errors;
															} else {
																var valid107 = true;
															}
														}
													}
												} else {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/progress',
															schemaPath:
																'#/oneOf/28/properties/progress/type',
															keyword: 'type',
															params: {
																type: 'object',
															},
															message:
																'must be object',
														},
													];
													return false;
												}
											}
											var valid106 = _errs500 === errors;
										} else {
											var valid106 = true;
										}
										if (valid106) {
											if (data.step !== undefined) {
												let data186 = data.step;
												const _errs507 = errors;
												if (
													typeof data186 !== 'string'
												) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/28/properties/step/type',
															keyword: 'type',
															params: {
																type: 'string',
															},
															message:
																'must be string',
														},
													];
													return false;
												}
												if (
													'setSiteLanguage' !==
													data186
												) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/28/properties/step/const',
															keyword: 'const',
															params: {
																allowedValue:
																	'setSiteLanguage',
															},
															message:
																'must be equal to constant',
														},
													];
													return false;
												}
												var valid106 =
													_errs507 === errors;
											} else {
												var valid106 = true;
											}
											if (valid106) {
												if (
													data.language !== undefined
												) {
													const _errs509 = errors;
													if (
														typeof data.language !==
														'string'
													) {
														validate28.errors = [
															{
																instancePath:
																	instancePath +
																	'/language',
																schemaPath:
																	'#/oneOf/28/properties/language/type',
																keyword: 'type',
																params: {
																	type: 'string',
																},
																message:
																	'must be string',
															},
														];
														return false;
													}
													var valid106 =
														_errs509 === errors;
												} else {
													var valid106 = true;
												}
											}
										}
									}
								}
							} else {
								validate28.errors = [
									{
										instancePath,
										schemaPath: '#/oneOf/28/type',
										keyword: 'type',
										params: { type: 'object' },
										message: 'must be object',
									},
								];
								return false;
							}
						}
					} else {
						validate28.errors = [
							{
								instancePath,
								schemaPath: '#/discriminator',
								keyword: 'discriminator',
								params: {
									error: 'mapping',
									tag: 'step',
									tagValue: tag0,
								},
								message: 'value of tag "step" must be in oneOf',
							},
						];
						return false;
					}
				} else {
					validate28.errors = [
						{
							instancePath,
							schemaPath: '#/discriminator',
							keyword: 'discriminator',
							params: {
								error: 'tag',
								tag: 'step',
								tagValue: tag0,
							},
							message: 'tag "step" must be string',
						},
					];
					return false;
				}
			}
		} else {
			validate28.errors = [
				{
					instancePath,
					schemaPath: '#/type',
					keyword: 'type',
					params: { type: 'object' },
					message: 'must be object',
				},
			];
			return false;
		}
	}
	validate28.errors = vErrors;
	return errors === 0;
}
function validate11(
	data,
	{ instancePath = '', parentData, parentDataProperty, rootData = data } = {}
) {
	let vErrors = null;
	let errors = 0;
	if (errors === 0) {
		if (data && typeof data == 'object' && !Array.isArray(data)) {
			const _errs1 = errors;
			for (const key0 in data) {
				if (!func2.call(schema12.properties, key0)) {
					validate11.errors = [
						{
							instancePath,
							schemaPath: '#/additionalProperties',
							keyword: 'additionalProperties',
							params: { additionalProperty: key0 },
							message: 'must NOT have additional properties',
						},
					];
					return false;
					break;
				}
			}
			if (_errs1 === errors) {
				if (data.landingPage !== undefined) {
					const _errs2 = errors;
					if (typeof data.landingPage !== 'string') {
						validate11.errors = [
							{
								instancePath: instancePath + '/landingPage',
								schemaPath: '#/properties/landingPage/type',
								keyword: 'type',
								params: { type: 'string' },
								message: 'must be string',
							},
						];
						return false;
					}
					var valid0 = _errs2 === errors;
				} else {
					var valid0 = true;
				}
				if (valid0) {
					if (data.description !== undefined) {
						const _errs4 = errors;
						if (typeof data.description !== 'string') {
							validate11.errors = [
								{
									instancePath: instancePath + '/description',
									schemaPath: '#/properties/description/type',
									keyword: 'type',
									params: { type: 'string' },
									message: 'must be string',
								},
							];
							return false;
						}
						var valid0 = _errs4 === errors;
					} else {
						var valid0 = true;
					}
					if (valid0) {
						if (data.meta !== undefined) {
							let data2 = data.meta;
							const _errs6 = errors;
							if (errors === _errs6) {
								if (
									data2 &&
									typeof data2 == 'object' &&
									!Array.isArray(data2)
								) {
									let missing0;
									if (
										(data2.title === undefined &&
											(missing0 = 'title')) ||
										(data2.author === undefined &&
											(missing0 = 'author'))
									) {
										validate11.errors = [
											{
												instancePath:
													instancePath + '/meta',
												schemaPath:
													'#/properties/meta/required',
												keyword: 'required',
												params: {
													missingProperty: missing0,
												},
												message:
													"must have required property '" +
													missing0 +
													"'",
											},
										];
										return false;
									} else {
										const _errs8 = errors;
										for (const key1 in data2) {
											if (
												!(
													key1 === 'title' ||
													key1 === 'description' ||
													key1 === 'author' ||
													key1 === 'categories'
												)
											) {
												validate11.errors = [
													{
														instancePath:
															instancePath +
															'/meta',
														schemaPath:
															'#/properties/meta/additionalProperties',
														keyword:
															'additionalProperties',
														params: {
															additionalProperty:
																key1,
														},
														message:
															'must NOT have additional properties',
													},
												];
												return false;
												break;
											}
										}
										if (_errs8 === errors) {
											if (data2.title !== undefined) {
												const _errs9 = errors;
												if (
													typeof data2.title !==
													'string'
												) {
													validate11.errors = [
														{
															instancePath:
																instancePath +
																'/meta/title',
															schemaPath:
																'#/properties/meta/properties/title/type',
															keyword: 'type',
															params: {
																type: 'string',
															},
															message:
																'must be string',
														},
													];
													return false;
												}
												var valid1 = _errs9 === errors;
											} else {
												var valid1 = true;
											}
											if (valid1) {
												if (
													data2.description !==
													undefined
												) {
													const _errs11 = errors;
													if (
														typeof data2.description !==
														'string'
													) {
														validate11.errors = [
															{
																instancePath:
																	instancePath +
																	'/meta/description',
																schemaPath:
																	'#/properties/meta/properties/description/type',
																keyword: 'type',
																params: {
																	type: 'string',
																},
																message:
																	'must be string',
															},
														];
														return false;
													}
													var valid1 =
														_errs11 === errors;
												} else {
													var valid1 = true;
												}
												if (valid1) {
													if (
														data2.author !==
														undefined
													) {
														const _errs13 = errors;
														if (
															typeof data2.author !==
															'string'
														) {
															validate11.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/meta/author',
																		schemaPath:
																			'#/properties/meta/properties/author/type',
																		keyword:
																			'type',
																		params: {
																			type: 'string',
																		},
																		message:
																			'must be string',
																	},
																];
															return false;
														}
														var valid1 =
															_errs13 === errors;
													} else {
														var valid1 = true;
													}
													if (valid1) {
														if (
															data2.categories !==
															undefined
														) {
															let data6 =
																data2.categories;
															const _errs15 =
																errors;
															if (
																errors ===
																_errs15
															) {
																if (
																	Array.isArray(
																		data6
																	)
																) {
																	var valid2 = true;
																	const len0 =
																		data6.length;
																	for (
																		let i0 = 0;
																		i0 <
																		len0;
																		i0++
																	) {
																		const _errs17 =
																			errors;
																		if (
																			typeof data6[
																				i0
																			] !==
																			'string'
																		) {
																			validate11.errors =
																				[
																					{
																						instancePath:
																							instancePath +
																							'/meta/categories/' +
																							i0,
																						schemaPath:
																							'#/properties/meta/properties/categories/items/type',
																						keyword:
																							'type',
																						params: {
																							type: 'string',
																						},
																						message:
																							'must be string',
																					},
																				];
																			return false;
																		}
																		var valid2 =
																			_errs17 ===
																			errors;
																		if (
																			!valid2
																		) {
																			break;
																		}
																	}
																} else {
																	validate11.errors =
																		[
																			{
																				instancePath:
																					instancePath +
																					'/meta/categories',
																				schemaPath:
																					'#/properties/meta/properties/categories/type',
																				keyword:
																					'type',
																				params: {
																					type: 'array',
																				},
																				message:
																					'must be array',
																			},
																		];
																	return false;
																}
															}
															var valid1 =
																_errs15 ===
																errors;
														} else {
															var valid1 = true;
														}
													}
												}
											}
										}
									}
								} else {
									validate11.errors = [
										{
											instancePath:
												instancePath + '/meta',
											schemaPath:
												'#/properties/meta/type',
											keyword: 'type',
											params: { type: 'object' },
											message: 'must be object',
										},
									];
									return false;
								}
							}
							var valid0 = _errs6 === errors;
						} else {
							var valid0 = true;
						}
						if (valid0) {
							if (data.preferredVersions !== undefined) {
								let data8 = data.preferredVersions;
								const _errs19 = errors;
								if (errors === _errs19) {
									if (
										data8 &&
										typeof data8 == 'object' &&
										!Array.isArray(data8)
									) {
										let missing1;
										if (
											(data8.php === undefined &&
												(missing1 = 'php')) ||
											(data8.wp === undefined &&
												(missing1 = 'wp'))
										) {
											validate11.errors = [
												{
													instancePath:
														instancePath +
														'/preferredVersions',
													schemaPath:
														'#/properties/preferredVersions/required',
													keyword: 'required',
													params: {
														missingProperty:
															missing1,
													},
													message:
														"must have required property '" +
														missing1 +
														"'",
												},
											];
											return false;
										} else {
											const _errs21 = errors;
											for (const key2 in data8) {
												if (
													!(
														key2 === 'php' ||
														key2 === 'wp'
													)
												) {
													validate11.errors = [
														{
															instancePath:
																instancePath +
																'/preferredVersions',
															schemaPath:
																'#/properties/preferredVersions/additionalProperties',
															keyword:
																'additionalProperties',
															params: {
																additionalProperty:
																	key2,
															},
															message:
																'must NOT have additional properties',
														},
													];
													return false;
													break;
												}
											}
											if (_errs21 === errors) {
												if (data8.php !== undefined) {
													let data9 = data8.php;
													const _errs22 = errors;
													const _errs23 = errors;
													let valid4 = false;
													const _errs24 = errors;
													if (
														!validate12(data9, {
															instancePath:
																instancePath +
																'/preferredVersions/php',
															parentData: data8,
															parentDataProperty:
																'php',
															rootData,
														})
													) {
														vErrors =
															vErrors === null
																? validate12.errors
																: vErrors.concat(
																		validate12.errors
																	);
														errors = vErrors.length;
													}
													var _valid0 =
														_errs24 === errors;
													valid4 = valid4 || _valid0;
													if (!valid4) {
														const _errs25 = errors;
														if (
															typeof data9 !==
															'string'
														) {
															const err0 = {
																instancePath:
																	instancePath +
																	'/preferredVersions/php',
																schemaPath:
																	'#/properties/preferredVersions/properties/php/anyOf/1/type',
																keyword: 'type',
																params: {
																	type: 'string',
																},
																message:
																	'must be string',
															};
															if (
																vErrors === null
															) {
																vErrors = [
																	err0,
																];
															} else {
																vErrors.push(
																	err0
																);
															}
															errors++;
														}
														if (
															'latest' !== data9
														) {
															const err1 = {
																instancePath:
																	instancePath +
																	'/preferredVersions/php',
																schemaPath:
																	'#/properties/preferredVersions/properties/php/anyOf/1/const',
																keyword:
																	'const',
																params: {
																	allowedValue:
																		'latest',
																},
																message:
																	'must be equal to constant',
															};
															if (
																vErrors === null
															) {
																vErrors = [
																	err1,
																];
															} else {
																vErrors.push(
																	err1
																);
															}
															errors++;
														}
														var _valid0 =
															_errs25 === errors;
														valid4 =
															valid4 || _valid0;
													}
													if (!valid4) {
														const err2 = {
															instancePath:
																instancePath +
																'/preferredVersions/php',
															schemaPath:
																'#/properties/preferredVersions/properties/php/anyOf',
															keyword: 'anyOf',
															params: {},
															message:
																'must match a schema in anyOf',
														};
														if (vErrors === null) {
															vErrors = [err2];
														} else {
															vErrors.push(err2);
														}
														errors++;
														validate11.errors =
															vErrors;
														return false;
													} else {
														errors = _errs23;
														if (vErrors !== null) {
															if (_errs23) {
																vErrors.length =
																	_errs23;
															} else {
																vErrors = null;
															}
														}
													}
													var valid3 =
														_errs22 === errors;
												} else {
													var valid3 = true;
												}
												if (valid3) {
													if (
														data8.wp !== undefined
													) {
														let data10 = data8.wp;
														const _errs27 = errors;
														const _errs28 = errors;
														let valid5 = false;
														const _errs29 = errors;
														if (
															typeof data10 !==
															'string'
														) {
															const err3 = {
																instancePath:
																	instancePath +
																	'/preferredVersions/wp',
																schemaPath:
																	'#/properties/preferredVersions/properties/wp/anyOf/0/type',
																keyword: 'type',
																params: {
																	type: 'string',
																},
																message:
																	'must be string',
															};
															if (
																vErrors === null
															) {
																vErrors = [
																	err3,
																];
															} else {
																vErrors.push(
																	err3
																);
															}
															errors++;
														}
														var _valid1 =
															_errs29 === errors;
														valid5 =
															valid5 || _valid1;
														if (!valid5) {
															const _errs31 =
																errors;
															if (
																typeof data10 !==
																'string'
															) {
																const err4 = {
																	instancePath:
																		instancePath +
																		'/preferredVersions/wp',
																	schemaPath:
																		'#/properties/preferredVersions/properties/wp/anyOf/1/type',
																	keyword:
																		'type',
																	params: {
																		type: 'string',
																	},
																	message:
																		'must be string',
																};
																if (
																	vErrors ===
																	null
																) {
																	vErrors = [
																		err4,
																	];
																} else {
																	vErrors.push(
																		err4
																	);
																}
																errors++;
															}
															if (
																'latest' !==
																data10
															) {
																const err5 = {
																	instancePath:
																		instancePath +
																		'/preferredVersions/wp',
																	schemaPath:
																		'#/properties/preferredVersions/properties/wp/anyOf/1/const',
																	keyword:
																		'const',
																	params: {
																		allowedValue:
																			'latest',
																	},
																	message:
																		'must be equal to constant',
																};
																if (
																	vErrors ===
																	null
																) {
																	vErrors = [
																		err5,
																	];
																} else {
																	vErrors.push(
																		err5
																	);
																}
																errors++;
															}
															var _valid1 =
																_errs31 ===
																errors;
															valid5 =
																valid5 ||
																_valid1;
															if (!valid5) {
																const _errs33 =
																	errors;
																if (
																	typeof data10 !==
																	'boolean'
																) {
																	const err6 =
																		{
																			instancePath:
																				instancePath +
																				'/preferredVersions/wp',
																			schemaPath:
																				'#/properties/preferredVersions/properties/wp/anyOf/2/type',
																			keyword:
																				'type',
																			params: {
																				type: 'boolean',
																			},
																			message:
																				'must be boolean',
																		};
																	if (
																		vErrors ===
																		null
																	) {
																		vErrors =
																			[
																				err6,
																			];
																	} else {
																		vErrors.push(
																			err6
																		);
																	}
																	errors++;
																}
																if (
																	false !==
																	data10
																) {
																	const err7 =
																		{
																			instancePath:
																				instancePath +
																				'/preferredVersions/wp',
																			schemaPath:
																				'#/properties/preferredVersions/properties/wp/anyOf/2/const',
																			keyword:
																				'const',
																			params: {
																				allowedValue: false,
																			},
																			message:
																				'must be equal to constant',
																		};
																	if (
																		vErrors ===
																		null
																	) {
																		vErrors =
																			[
																				err7,
																			];
																	} else {
																		vErrors.push(
																			err7
																		);
																	}
																	errors++;
																}
																var _valid1 =
																	_errs33 ===
																	errors;
																valid5 =
																	valid5 ||
																	_valid1;
															}
														}
														if (!valid5) {
															const err8 = {
																instancePath:
																	instancePath +
																	'/preferredVersions/wp',
																schemaPath:
																	'#/properties/preferredVersions/properties/wp/anyOf',
																keyword:
																	'anyOf',
																params: {},
																message:
																	'must match a schema in anyOf',
															};
															if (
																vErrors === null
															) {
																vErrors = [
																	err8,
																];
															} else {
																vErrors.push(
																	err8
																);
															}
															errors++;
															validate11.errors =
																vErrors;
															return false;
														} else {
															errors = _errs28;
															if (
																vErrors !== null
															) {
																if (_errs28) {
																	vErrors.length =
																		_errs28;
																} else {
																	vErrors =
																		null;
																}
															}
														}
														var valid3 =
															_errs27 === errors;
													} else {
														var valid3 = true;
													}
												}
											}
										}
									} else {
										validate11.errors = [
											{
												instancePath:
													instancePath +
													'/preferredVersions',
												schemaPath:
													'#/properties/preferredVersions/type',
												keyword: 'type',
												params: { type: 'object' },
												message: 'must be object',
											},
										];
										return false;
									}
								}
								var valid0 = _errs19 === errors;
							} else {
								var valid0 = true;
							}
							if (valid0) {
								if (data.features !== undefined) {
									let data11 = data.features;
									const _errs35 = errors;
									if (errors === _errs35) {
										if (
											data11 &&
											typeof data11 == 'object' &&
											!Array.isArray(data11)
										) {
											const _errs37 = errors;
											for (const key3 in data11) {
												if (
													!(
														key3 === 'intl' ||
														key3 === 'networking'
													)
												) {
													validate11.errors = [
														{
															instancePath:
																instancePath +
																'/features',
															schemaPath:
																'#/properties/features/additionalProperties',
															keyword:
																'additionalProperties',
															params: {
																additionalProperty:
																	key3,
															},
															message:
																'must NOT have additional properties',
														},
													];
													return false;
													break;
												}
											}
											if (_errs37 === errors) {
												if (data11.intl !== undefined) {
													const _errs38 = errors;
													if (
														typeof data11.intl !==
														'boolean'
													) {
														validate11.errors = [
															{
																instancePath:
																	instancePath +
																	'/features/intl',
																schemaPath:
																	'#/properties/features/properties/intl/type',
																keyword: 'type',
																params: {
																	type: 'boolean',
																},
																message:
																	'must be boolean',
															},
														];
														return false;
													}
													var valid6 =
														_errs38 === errors;
												} else {
													var valid6 = true;
												}
												if (valid6) {
													if (
														data11.networking !==
														undefined
													) {
														const _errs40 = errors;
														if (
															typeof data11.networking !==
															'boolean'
														) {
															validate11.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/features/networking',
																		schemaPath:
																			'#/properties/features/properties/networking/type',
																		keyword:
																			'type',
																		params: {
																			type: 'boolean',
																		},
																		message:
																			'must be boolean',
																	},
																];
															return false;
														}
														var valid6 =
															_errs40 === errors;
													} else {
														var valid6 = true;
													}
												}
											}
										} else {
											validate11.errors = [
												{
													instancePath:
														instancePath +
														'/features',
													schemaPath:
														'#/properties/features/type',
													keyword: 'type',
													params: { type: 'object' },
													message: 'must be object',
												},
											];
											return false;
										}
									}
									var valid0 = _errs35 === errors;
								} else {
									var valid0 = true;
								}
								if (valid0) {
									if (data.extraLibraries !== undefined) {
										let data14 = data.extraLibraries;
										const _errs42 = errors;
										if (errors === _errs42) {
											if (Array.isArray(data14)) {
												var valid7 = true;
												const len1 = data14.length;
												for (
													let i1 = 0;
													i1 < len1;
													i1++
												) {
													let data15 = data14[i1];
													const _errs44 = errors;
													if (
														typeof data15 !==
														'string'
													) {
														validate11.errors = [
															{
																instancePath:
																	instancePath +
																	'/extraLibraries/' +
																	i1,
																schemaPath:
																	'#/definitions/ExtraLibrary/type',
																keyword: 'type',
																params: {
																	type: 'string',
																},
																message:
																	'must be string',
															},
														];
														return false;
													}
													if ('wp-cli' !== data15) {
														validate11.errors = [
															{
																instancePath:
																	instancePath +
																	'/extraLibraries/' +
																	i1,
																schemaPath:
																	'#/definitions/ExtraLibrary/const',
																keyword:
																	'const',
																params: {
																	allowedValue:
																		'wp-cli',
																},
																message:
																	'must be equal to constant',
															},
														];
														return false;
													}
													var valid7 =
														_errs44 === errors;
													if (!valid7) {
														break;
													}
												}
											} else {
												validate11.errors = [
													{
														instancePath:
															instancePath +
															'/extraLibraries',
														schemaPath:
															'#/properties/extraLibraries/type',
														keyword: 'type',
														params: {
															type: 'array',
														},
														message:
															'must be array',
													},
												];
												return false;
											}
										}
										var valid0 = _errs42 === errors;
									} else {
										var valid0 = true;
									}
									if (valid0) {
										if (data.constants !== undefined) {
											let data16 = data.constants;
											const _errs47 = errors;
											const _errs48 = errors;
											if (errors === _errs48) {
												if (
													data16 &&
													typeof data16 == 'object' &&
													!Array.isArray(data16)
												) {
													for (const key4 in data16) {
														let data17 =
															data16[key4];
														const _errs51 = errors;
														if (
															typeof data17 !==
																'string' &&
															typeof data17 !==
																'boolean' &&
															!(
																typeof data17 ==
																	'number' &&
																isFinite(data17)
															)
														) {
															validate11.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/constants/' +
																			key4
																				.replace(
																					/~/g,
																					'~0'
																				)
																				.replace(
																					/\//g,
																					'~1'
																				),
																		schemaPath:
																			'#/definitions/PHPConstants/additionalProperties/type',
																		keyword:
																			'type',
																		params: {
																			type: schema19
																				.additionalProperties
																				.type,
																		},
																		message:
																			'must be string,boolean,number',
																	},
																];
															return false;
														}
														var valid10 =
															_errs51 === errors;
														if (!valid10) {
															break;
														}
													}
												} else {
													validate11.errors = [
														{
															instancePath:
																instancePath +
																'/constants',
															schemaPath:
																'#/definitions/PHPConstants/type',
															keyword: 'type',
															params: {
																type: 'object',
															},
															message:
																'must be object',
														},
													];
													return false;
												}
											}
											var valid0 = _errs47 === errors;
										} else {
											var valid0 = true;
										}
										if (valid0) {
											if (data.plugins !== undefined) {
												let data18 = data.plugins;
												const _errs53 = errors;
												if (errors === _errs53) {
													if (Array.isArray(data18)) {
														var valid11 = true;
														const len2 =
															data18.length;
														for (
															let i2 = 0;
															i2 < len2;
															i2++
														) {
															let data19 =
																data18[i2];
															const _errs55 =
																errors;
															const _errs56 =
																errors;
															let valid12 = false;
															const _errs57 =
																errors;
															if (
																typeof data19 !==
																'string'
															) {
																const err9 = {
																	instancePath:
																		instancePath +
																		'/plugins/' +
																		i2,
																	schemaPath:
																		'#/properties/plugins/items/anyOf/0/type',
																	keyword:
																		'type',
																	params: {
																		type: 'string',
																	},
																	message:
																		'must be string',
																};
																if (
																	vErrors ===
																	null
																) {
																	vErrors = [
																		err9,
																	];
																} else {
																	vErrors.push(
																		err9
																	);
																}
																errors++;
															}
															var _valid2 =
																_errs57 ===
																errors;
															valid12 =
																valid12 ||
																_valid2;
															if (!valid12) {
																const _errs59 =
																	errors;
																if (
																	!validate16(
																		data19,
																		{
																			instancePath:
																				instancePath +
																				'/plugins/' +
																				i2,
																			parentData:
																				data18,
																			parentDataProperty:
																				i2,
																			rootData,
																		}
																	)
																) {
																	vErrors =
																		vErrors ===
																		null
																			? validate16.errors
																			: vErrors.concat(
																					validate16.errors
																				);
																	errors =
																		vErrors.length;
																}
																var _valid2 =
																	_errs59 ===
																	errors;
																valid12 =
																	valid12 ||
																	_valid2;
															}
															if (!valid12) {
																const err10 = {
																	instancePath:
																		instancePath +
																		'/plugins/' +
																		i2,
																	schemaPath:
																		'#/properties/plugins/items/anyOf',
																	keyword:
																		'anyOf',
																	params: {},
																	message:
																		'must match a schema in anyOf',
																};
																if (
																	vErrors ===
																	null
																) {
																	vErrors = [
																		err10,
																	];
																} else {
																	vErrors.push(
																		err10
																	);
																}
																errors++;
																validate11.errors =
																	vErrors;
																return false;
															} else {
																errors =
																	_errs56;
																if (
																	vErrors !==
																	null
																) {
																	if (
																		_errs56
																	) {
																		vErrors.length =
																			_errs56;
																	} else {
																		vErrors =
																			null;
																	}
																}
															}
															var valid11 =
																_errs55 ===
																errors;
															if (!valid11) {
																break;
															}
														}
													} else {
														validate11.errors = [
															{
																instancePath:
																	instancePath +
																	'/plugins',
																schemaPath:
																	'#/properties/plugins/type',
																keyword: 'type',
																params: {
																	type: 'array',
																},
																message:
																	'must be array',
															},
														];
														return false;
													}
												}
												var valid0 = _errs53 === errors;
											} else {
												var valid0 = true;
											}
											if (valid0) {
												if (
													data.siteOptions !==
													undefined
												) {
													let data20 =
														data.siteOptions;
													const _errs60 = errors;
													if (errors === _errs60) {
														if (
															data20 &&
															typeof data20 ==
																'object' &&
															!Array.isArray(
																data20
															)
														) {
															const _errs62 =
																errors;
															for (const key5 in data20) {
																if (
																	!(
																		key5 ===
																		'blogname'
																	)
																) {
																	const _errs63 =
																		errors;
																	if (
																		typeof data20[
																			key5
																		] !==
																		'string'
																	) {
																		validate11.errors =
																			[
																				{
																					instancePath:
																						instancePath +
																						'/siteOptions/' +
																						key5
																							.replace(
																								/~/g,
																								'~0'
																							)
																							.replace(
																								/\//g,
																								'~1'
																							),
																					schemaPath:
																						'#/properties/siteOptions/additionalProperties/type',
																					keyword:
																						'type',
																					params: {
																						type: 'string',
																					},
																					message:
																						'must be string',
																				},
																			];
																		return false;
																	}
																	var valid13 =
																		_errs63 ===
																		errors;
																	if (
																		!valid13
																	) {
																		break;
																	}
																}
															}
															if (
																_errs62 ===
																errors
															) {
																if (
																	data20.blogname !==
																	undefined
																) {
																	if (
																		typeof data20.blogname !==
																		'string'
																	) {
																		validate11.errors =
																			[
																				{
																					instancePath:
																						instancePath +
																						'/siteOptions/blogname',
																					schemaPath:
																						'#/properties/siteOptions/properties/blogname/type',
																					keyword:
																						'type',
																					params: {
																						type: 'string',
																					},
																					message:
																						'must be string',
																				},
																			];
																		return false;
																	}
																}
															}
														} else {
															validate11.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/siteOptions',
																		schemaPath:
																			'#/properties/siteOptions/type',
																		keyword:
																			'type',
																		params: {
																			type: 'object',
																		},
																		message:
																			'must be object',
																	},
																];
															return false;
														}
													}
													var valid0 =
														_errs60 === errors;
												} else {
													var valid0 = true;
												}
												if (valid0) {
													if (
														data.login !== undefined
													) {
														let data23 = data.login;
														const _errs67 = errors;
														const _errs68 = errors;
														let valid15 = false;
														const _errs69 = errors;
														if (
															typeof data23 !==
															'boolean'
														) {
															const err11 = {
																instancePath:
																	instancePath +
																	'/login',
																schemaPath:
																	'#/properties/login/anyOf/0/type',
																keyword: 'type',
																params: {
																	type: 'boolean',
																},
																message:
																	'must be boolean',
															};
															if (
																vErrors === null
															) {
																vErrors = [
																	err11,
																];
															} else {
																vErrors.push(
																	err11
																);
															}
															errors++;
														}
														var _valid3 =
															_errs69 === errors;
														valid15 =
															valid15 || _valid3;
														if (!valid15) {
															const _errs71 =
																errors;
															if (
																errors ===
																_errs71
															) {
																if (
																	data23 &&
																	typeof data23 ==
																		'object' &&
																	!Array.isArray(
																		data23
																	)
																) {
																	let missing2;
																	if (
																		(data23.username ===
																			undefined &&
																			(missing2 =
																				'username')) ||
																		(data23.password ===
																			undefined &&
																			(missing2 =
																				'password'))
																	) {
																		const err12 =
																			{
																				instancePath:
																					instancePath +
																					'/login',
																				schemaPath:
																					'#/properties/login/anyOf/1/required',
																				keyword:
																					'required',
																				params: {
																					missingProperty:
																						missing2,
																				},
																				message:
																					"must have required property '" +
																					missing2 +
																					"'",
																			};
																		if (
																			vErrors ===
																			null
																		) {
																			vErrors =
																				[
																					err12,
																				];
																		} else {
																			vErrors.push(
																				err12
																			);
																		}
																		errors++;
																	} else {
																		const _errs73 =
																			errors;
																		for (const key6 in data23) {
																			if (
																				!(
																					key6 ===
																						'username' ||
																					key6 ===
																						'password'
																				)
																			) {
																				const err13 =
																					{
																						instancePath:
																							instancePath +
																							'/login',
																						schemaPath:
																							'#/properties/login/anyOf/1/additionalProperties',
																						keyword:
																							'additionalProperties',
																						params: {
																							additionalProperty:
																								key6,
																						},
																						message:
																							'must NOT have additional properties',
																					};
																				if (
																					vErrors ===
																					null
																				) {
																					vErrors =
																						[
																							err13,
																						];
																				} else {
																					vErrors.push(
																						err13
																					);
																				}
																				errors++;
																				break;
																			}
																		}
																		if (
																			_errs73 ===
																			errors
																		) {
																			if (
																				data23.username !==
																				undefined
																			) {
																				const _errs74 =
																					errors;
																				if (
																					typeof data23.username !==
																					'string'
																				) {
																					const err14 =
																						{
																							instancePath:
																								instancePath +
																								'/login/username',
																							schemaPath:
																								'#/properties/login/anyOf/1/properties/username/type',
																							keyword:
																								'type',
																							params: {
																								type: 'string',
																							},
																							message:
																								'must be string',
																						};
																					if (
																						vErrors ===
																						null
																					) {
																						vErrors =
																							[
																								err14,
																							];
																					} else {
																						vErrors.push(
																							err14
																						);
																					}
																					errors++;
																				}
																				var valid16 =
																					_errs74 ===
																					errors;
																			} else {
																				var valid16 = true;
																			}
																			if (
																				valid16
																			) {
																				if (
																					data23.password !==
																					undefined
																				) {
																					const _errs76 =
																						errors;
																					if (
																						typeof data23.password !==
																						'string'
																					) {
																						const err15 =
																							{
																								instancePath:
																									instancePath +
																									'/login/password',
																								schemaPath:
																									'#/properties/login/anyOf/1/properties/password/type',
																								keyword:
																									'type',
																								params: {
																									type: 'string',
																								},
																								message:
																									'must be string',
																							};
																						if (
																							vErrors ===
																							null
																						) {
																							vErrors =
																								[
																									err15,
																								];
																						} else {
																							vErrors.push(
																								err15
																							);
																						}
																						errors++;
																					}
																					var valid16 =
																						_errs76 ===
																						errors;
																				} else {
																					var valid16 = true;
																				}
																			}
																		}
																	}
																} else {
																	const err16 =
																		{
																			instancePath:
																				instancePath +
																				'/login',
																			schemaPath:
																				'#/properties/login/anyOf/1/type',
																			keyword:
																				'type',
																			params: {
																				type: 'object',
																			},
																			message:
																				'must be object',
																		};
																	if (
																		vErrors ===
																		null
																	) {
																		vErrors =
																			[
																				err16,
																			];
																	} else {
																		vErrors.push(
																			err16
																		);
																	}
																	errors++;
																}
															}
															var _valid3 =
																_errs71 ===
																errors;
															valid15 =
																valid15 ||
																_valid3;
														}
														if (!valid15) {
															const err17 = {
																instancePath:
																	instancePath +
																	'/login',
																schemaPath:
																	'#/properties/login/anyOf',
																keyword:
																	'anyOf',
																params: {},
																message:
																	'must match a schema in anyOf',
															};
															if (
																vErrors === null
															) {
																vErrors = [
																	err17,
																];
															} else {
																vErrors.push(
																	err17
																);
															}
															errors++;
															validate11.errors =
																vErrors;
															return false;
														} else {
															errors = _errs68;
															if (
																vErrors !== null
															) {
																if (_errs68) {
																	vErrors.length =
																		_errs68;
																} else {
																	vErrors =
																		null;
																}
															}
														}
														var valid0 =
															_errs67 === errors;
													} else {
														var valid0 = true;
													}
													if (valid0) {
														if (
															data.steps !==
															undefined
														) {
															let data26 =
																data.steps;
															const _errs78 =
																errors;
															if (
																errors ===
																_errs78
															) {
																if (
																	Array.isArray(
																		data26
																	)
																) {
																	var valid17 = true;
																	const len3 =
																		data26.length;
																	for (
																		let i3 = 0;
																		i3 <
																		len3;
																		i3++
																	) {
																		let data27 =
																			data26[
																				i3
																			];
																		const _errs80 =
																			errors;
																		const _errs81 =
																			errors;
																		let valid18 = false;
																		const _errs82 =
																			errors;
																		if (
																			!validate28(
																				data27,
																				{
																					instancePath:
																						instancePath +
																						'/steps/' +
																						i3,
																					parentData:
																						data26,
																					parentDataProperty:
																						i3,
																					rootData,
																				}
																			)
																		) {
																			vErrors =
																				vErrors ===
																				null
																					? validate28.errors
																					: vErrors.concat(
																							validate28.errors
																						);
																			errors =
																				vErrors.length;
																		}
																		var _valid4 =
																			_errs82 ===
																			errors;
																		valid18 =
																			valid18 ||
																			_valid4;
																		if (
																			!valid18
																		) {
																			const _errs83 =
																				errors;
																			if (
																				typeof data27 !==
																				'string'
																			) {
																				const err18 =
																					{
																						instancePath:
																							instancePath +
																							'/steps/' +
																							i3,
																						schemaPath:
																							'#/properties/steps/items/anyOf/1/type',
																						keyword:
																							'type',
																						params: {
																							type: 'string',
																						},
																						message:
																							'must be string',
																					};
																				if (
																					vErrors ===
																					null
																				) {
																					vErrors =
																						[
																							err18,
																						];
																				} else {
																					vErrors.push(
																						err18
																					);
																				}
																				errors++;
																			}
																			var _valid4 =
																				_errs83 ===
																				errors;
																			valid18 =
																				valid18 ||
																				_valid4;
																			if (
																				!valid18
																			) {
																				const _errs85 =
																					errors;
																				const err19 =
																					{
																						instancePath:
																							instancePath +
																							'/steps/' +
																							i3,
																						schemaPath:
																							'#/properties/steps/items/anyOf/2/not',
																						keyword:
																							'not',
																						params: {},
																						message:
																							'must NOT be valid',
																					};
																				if (
																					vErrors ===
																					null
																				) {
																					vErrors =
																						[
																							err19,
																						];
																				} else {
																					vErrors.push(
																						err19
																					);
																				}
																				errors++;
																				var _valid4 =
																					_errs85 ===
																					errors;
																				valid18 =
																					valid18 ||
																					_valid4;
																				if (
																					!valid18
																				) {
																					const _errs87 =
																						errors;
																					if (
																						typeof data27 !==
																						'boolean'
																					) {
																						const err20 =
																							{
																								instancePath:
																									instancePath +
																									'/steps/' +
																									i3,
																								schemaPath:
																									'#/properties/steps/items/anyOf/3/type',
																								keyword:
																									'type',
																								params: {
																									type: 'boolean',
																								},
																								message:
																									'must be boolean',
																							};
																						if (
																							vErrors ===
																							null
																						) {
																							vErrors =
																								[
																									err20,
																								];
																						} else {
																							vErrors.push(
																								err20
																							);
																						}
																						errors++;
																					}
																					if (
																						false !==
																						data27
																					) {
																						const err21 =
																							{
																								instancePath:
																									instancePath +
																									'/steps/' +
																									i3,
																								schemaPath:
																									'#/properties/steps/items/anyOf/3/const',
																								keyword:
																									'const',
																								params: {
																									allowedValue: false,
																								},
																								message:
																									'must be equal to constant',
																							};
																						if (
																							vErrors ===
																							null
																						) {
																							vErrors =
																								[
																									err21,
																								];
																						} else {
																							vErrors.push(
																								err21
																							);
																						}
																						errors++;
																					}
																					var _valid4 =
																						_errs87 ===
																						errors;
																					valid18 =
																						valid18 ||
																						_valid4;
																					if (
																						!valid18
																					) {
																						const _errs89 =
																							errors;
																						if (
																							data27 !==
																							null
																						) {
																							const err22 =
																								{
																									instancePath:
																										instancePath +
																										'/steps/' +
																										i3,
																									schemaPath:
																										'#/properties/steps/items/anyOf/4/type',
																									keyword:
																										'type',
																									params: {
																										type: 'null',
																									},
																									message:
																										'must be null',
																								};
																							if (
																								vErrors ===
																								null
																							) {
																								vErrors =
																									[
																										err22,
																									];
																							} else {
																								vErrors.push(
																									err22
																								);
																							}
																							errors++;
																						}
																						var _valid4 =
																							_errs89 ===
																							errors;
																						valid18 =
																							valid18 ||
																							_valid4;
																					}
																				}
																			}
																		}
																		if (
																			!valid18
																		) {
																			const err23 =
																				{
																					instancePath:
																						instancePath +
																						'/steps/' +
																						i3,
																					schemaPath:
																						'#/properties/steps/items/anyOf',
																					keyword:
																						'anyOf',
																					params: {},
																					message:
																						'must match a schema in anyOf',
																				};
																			if (
																				vErrors ===
																				null
																			) {
																				vErrors =
																					[
																						err23,
																					];
																			} else {
																				vErrors.push(
																					err23
																				);
																			}
																			errors++;
																			validate11.errors =
																				vErrors;
																			return false;
																		} else {
																			errors =
																				_errs81;
																			if (
																				vErrors !==
																				null
																			) {
																				if (
																					_errs81
																				) {
																					vErrors.length =
																						_errs81;
																				} else {
																					vErrors =
																						null;
																				}
																			}
																		}
																		var valid17 =
																			_errs80 ===
																			errors;
																		if (
																			!valid17
																		) {
																			break;
																		}
																	}
																} else {
																	validate11.errors =
																		[
																			{
																				instancePath:
																					instancePath +
																					'/steps',
																				schemaPath:
																					'#/properties/steps/type',
																				keyword:
																					'type',
																				params: {
																					type: 'array',
																				},
																				message:
																					'must be array',
																			},
																		];
																	return false;
																}
															}
															var valid0 =
																_errs78 ===
																errors;
														} else {
															var valid0 = true;
														}
														if (valid0) {
															if (
																data.$schema !==
																undefined
															) {
																const _errs91 =
																	errors;
																if (
																	typeof data.$schema !==
																	'string'
																) {
																	validate11.errors =
																		[
																			{
																				instancePath:
																					instancePath +
																					'/$schema',
																				schemaPath:
																					'#/properties/%24schema/type',
																				keyword:
																					'type',
																				params: {
																					type: 'string',
																				},
																				message:
																					'must be string',
																			},
																		];
																	return false;
																}
																var valid0 =
																	_errs91 ===
																	errors;
															} else {
																var valid0 = true;
															}
														}
													}
												}
											}
										}
									}
								}
							}
						}
					}
				}
			}
		} else {
			validate11.errors = [
				{
					instancePath,
					schemaPath: '#/type',
					keyword: 'type',
					params: { type: 'object' },
					message: 'must be object',
				},
			];
			return false;
		}
	}
	validate11.errors = vErrors;
	return errors === 0;
}
function validate10(
	data,
	{ instancePath = '', parentData, parentDataProperty, rootData = data } = {}
) {
	let vErrors = null;
	let errors = 0;
	if (
		!validate11(data, {
			instancePath,
			parentData,
			parentDataProperty,
			rootData,
		})
	) {
		vErrors =
			vErrors === null
				? validate11.errors
				: vErrors.concat(validate11.errors);
		errors = vErrors.length;
	}
	validate10.errors = vErrors;
	return errors === 0;
}
