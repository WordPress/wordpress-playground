'use strict';
export const validate = validate10;
export default validate10;
const schema11 = {
	$schema: 'http://json-schema.org/schema',
	$ref: '#/definitions/Blueprint',
	definitions: {
		Blueprint: {
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
								{ $ref: '#/definitions/SupportedPHPVersion' },
								{ type: 'string', const: 'latest' },
							],
							description:
								'The preferred PHP version to use. If not specified, the latest supported version will be used',
						},
						wp: {
							type: 'string',
							description:
								'The preferred WordPress version to use. If not specified, the latest supported version will be used',
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
					type: 'object',
					additionalProperties: { type: 'string' },
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
					type: 'array',
					items: {
						$ref: '#/definitions/SupportedPHPExtensionBundle',
					},
					description: 'The PHP extensions to use.',
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
		},
		SupportedPHPVersion: {
			type: 'string',
			enum: [
				'8.3',
				'8.2',
				'8.1',
				'8.0',
				'7.4',
				'7.3',
				'7.2',
				'7.1',
				'7.0',
			],
		},
		ExtraLibrary: { type: 'string', const: 'wp-cli' },
		FileReference: {
			anyOf: [
				{ $ref: '#/definitions/VFSReference' },
				{ $ref: '#/definitions/LiteralReference' },
				{ $ref: '#/definitions/CoreThemeReference' },
				{ $ref: '#/definitions/CorePluginReference' },
				{ $ref: '#/definitions/UrlReference' },
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
		SupportedPHPExtensionBundle: {
			type: 'string',
			enum: ['kitchen-sink', 'light'],
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
						pluginDirectory: {
							$ref: '#/definitions/DirectoryReference',
							description:
								'The directory containing the plugin files. The plugin file structure must start at the root without nesting.\n\nGood structure:\n\n\t    /index.php\n\nBad structure:\n\n\t    /plugin/index.php',
						},
						pluginZipFile: {
							$ref: '#/definitions/FileReference',
							description: 'The plugin zip file to install.',
						},
						options: {
							$ref: '#/definitions/InstallPluginOptions',
							description: 'Optional installation options.',
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
						themeZipFile: {
							$ref: '#/definitions/FileReference',
							description: 'The theme zip file to install.',
						},
						options: {
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
							},
							additionalProperties: false,
							description: 'Optional installation options.',
						},
					},
					required: ['step', 'themeZipFile'],
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
							description:
								"The password to log in with. Defaults to 'password'.",
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
							type: 'string',
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
		DirectoryReference: { $ref: '#/definitions/GitDirectoryReference' },
		GitDirectoryReference: {
			type: 'object',
			properties: {
				resource: {
					type: 'string',
					const: 'git-directory',
					description:
						'Identifies the file resource as a git directory',
				},
				url: {
					type: 'string',
					description: 'The URL of the git repository',
				},
				ref: {
					type: 'string',
					description: 'The branch of the git repository',
				},
				path: {
					type: 'string',
					description:
						'The path to the directory in the git repository',
				},
			},
			required: ['resource', 'url', 'ref', 'path'],
			additionalProperties: false,
		},
		InstallPluginOptions: {
			type: 'object',
			properties: {
				activate: {
					type: 'boolean',
					description:
						'Whether to activate the plugin after installing it.',
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
					description: 'Request path following the domain:port part.',
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
						{ $ref: '#/definitions/SupportedPHPVersion' },
						{ type: 'string', const: 'latest' },
					],
					description:
						'The preferred PHP version to use. If not specified, the latest supported version will be used',
				},
				wp: {
					type: 'string',
					description:
						'The preferred WordPress version to use. If not specified, the latest supported version will be used',
				},
			},
			required: ['php', 'wp'],
			additionalProperties: false,
			description: 'The preferred PHP and WordPress versions to use.',
		},
		features: {
			type: 'object',
			properties: {
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
			type: 'object',
			additionalProperties: { type: 'string' },
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
			type: 'array',
			items: { $ref: '#/definitions/SupportedPHPExtensionBundle' },
			description: 'The PHP extensions to use.',
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
};
const schema13 = {
	type: 'string',
	enum: ['8.3', '8.2', '8.1', '8.0', '7.4', '7.3', '7.2', '7.1', '7.0'],
};
const schema14 = { type: 'string', const: 'wp-cli' };
const schema21 = { type: 'string', enum: ['kitchen-sink', 'light'] };
const func2 = Object.prototype.hasOwnProperty;
const schema15 = {
	anyOf: [
		{ $ref: '#/definitions/VFSReference' },
		{ $ref: '#/definitions/LiteralReference' },
		{ $ref: '#/definitions/CoreThemeReference' },
		{ $ref: '#/definitions/CorePluginReference' },
		{ $ref: '#/definitions/UrlReference' },
	],
};
const schema16 = {
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
const schema17 = {
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
const schema18 = {
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
const schema19 = {
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
const schema20 = {
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
function validate12(
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
				}
			}
		}
	}
	if (!valid0) {
		const err44 = {
			instancePath,
			schemaPath: '#/anyOf',
			keyword: 'anyOf',
			params: {},
			message: 'must match a schema in anyOf',
		};
		if (vErrors === null) {
			vErrors = [err44];
		} else {
			vErrors.push(err44);
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
const schema22 = {
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
				pluginDirectory: {
					$ref: '#/definitions/DirectoryReference',
					description:
						'The directory containing the plugin files. The plugin file structure must start at the root without nesting.\n\nGood structure:\n\n\t    /index.php\n\nBad structure:\n\n\t    /plugin/index.php',
				},
				pluginZipFile: {
					$ref: '#/definitions/FileReference',
					description: 'The plugin zip file to install.',
				},
				options: {
					$ref: '#/definitions/InstallPluginOptions',
					description: 'Optional installation options.',
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
				themeZipFile: {
					$ref: '#/definitions/FileReference',
					description: 'The theme zip file to install.',
				},
				options: {
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
					},
					additionalProperties: false,
					description: 'Optional installation options.',
				},
			},
			required: ['step', 'themeZipFile'],
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
					description:
						"The password to log in with. Defaults to 'password'.",
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
				code: { type: 'string', description: 'The PHP code to run.' },
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
const schema23 = {
	type: 'object',
	properties: {
		resource: {
			type: 'string',
			const: 'git-directory',
			description: 'Identifies the file resource as a git directory',
		},
		url: { type: 'string', description: 'The URL of the git repository' },
		ref: {
			type: 'string',
			description: 'The branch of the git repository',
		},
		path: {
			type: 'string',
			description: 'The path to the directory in the git repository',
		},
	},
	required: ['resource', 'url', 'ref', 'path'],
	additionalProperties: false,
};
const schema24 = {
	type: 'object',
	properties: {
		activate: {
			type: 'boolean',
			description: 'Whether to activate the plugin after installing it.',
		},
	},
	additionalProperties: false,
};
const schema31 = {
	type: 'object',
	properties: {
		adminUsername: { type: 'string' },
		adminPassword: { type: 'string' },
	},
	additionalProperties: false,
};
const schema25 = {
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
const schema26 = {
	type: 'string',
	enum: ['GET', 'POST', 'HEAD', 'OPTIONS', 'PATCH', 'PUT', 'DELETE'],
};
const schema27 = { type: 'object', additionalProperties: { type: 'string' } };
function validate19(
	data,
	{ instancePath = '', parentData, parentDataProperty, rootData = data } = {}
) {
	let vErrors = null;
	let errors = 0;
	if (errors === 0) {
		if (data && typeof data == 'object' && !Array.isArray(data)) {
			let missing0;
			if (data.url === undefined && (missing0 = 'url')) {
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
							key0 === 'method' ||
							key0 === 'url' ||
							key0 === 'headers' ||
							key0 === 'body'
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
					if (data.method !== undefined) {
						let data0 = data.method;
						const _errs2 = errors;
						if (typeof data0 !== 'string') {
							validate19.errors = [
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
							validate19.errors = [
								{
									instancePath: instancePath + '/method',
									schemaPath: '#/definitions/HTTPMethod/enum',
									keyword: 'enum',
									params: { allowedValues: schema26.enum },
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
												validate19.errors = [
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
										validate19.errors = [
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
										validate19.errors = vErrors;
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
const schema28 = {
	type: 'object',
	properties: {
		relativeUri: {
			type: 'string',
			description: 'Request path following the domain:port part.',
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
function validate21(
	data,
	{ instancePath = '', parentData, parentDataProperty, rootData = data } = {}
) {
	let vErrors = null;
	let errors = 0;
	if (errors === 0) {
		if (data && typeof data == 'object' && !Array.isArray(data)) {
			const _errs1 = errors;
			for (const key0 in data) {
				if (!func2.call(schema28.properties, key0)) {
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
				if (data.relativeUri !== undefined) {
					const _errs2 = errors;
					if (typeof data.relativeUri !== 'string') {
						validate21.errors = [
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
							validate21.errors = [
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
								validate21.errors = [
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
									validate21.errors = [
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
									validate21.errors = [
										{
											instancePath:
												instancePath + '/method',
											schemaPath:
												'#/definitions/HTTPMethod/enum',
											keyword: 'enum',
											params: {
												allowedValues: schema26.enum,
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
													validate21.errors = [
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
											validate21.errors = [
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
											validate21.errors = vErrors;
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
															validate21.errors =
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
													validate21.errors = [
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
																validate21.errors =
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
														validate21.errors = [
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
														validate21.errors = [
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
function validate14(
	data,
	{ instancePath = '', parentData, parentDataProperty, rootData = data } = {}
) {
	let vErrors = null;
	let errors = 0;
	if (errors === 0) {
		if (data && typeof data == 'object' && !Array.isArray(data)) {
			let missing0;
			if (data.step === undefined && (missing0 = 'step')) {
				validate14.errors = [
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
									validate14.errors = [
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
											validate14.errors = [
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
															validate14.errors =
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
																validate14.errors =
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
																	validate14.errors =
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
													validate14.errors = [
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
													validate14.errors = [
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
													validate14.errors = [
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
														validate14.errors = [
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
															validate14.errors =
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
								validate14.errors = [
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
									validate14.errors = [
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
											validate14.errors = [
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
															validate14.errors =
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
																validate14.errors =
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
																	validate14.errors =
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
													validate14.errors = [
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
													validate14.errors = [
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
													validate14.errors = [
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
														validate14.errors = [
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
								validate14.errors = [
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
									validate14.errors = [
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
											validate14.errors = [
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
															validate14.errors =
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
																validate14.errors =
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
																	validate14.errors =
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
													validate14.errors = [
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
													validate14.errors = [
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
													validate14.errors = [
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
														validate14.errors = [
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
															validate14.errors =
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
								validate14.errors = [
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
									validate14.errors = [
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
											validate14.errors = [
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
															validate14.errors =
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
																validate14.errors =
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
																	validate14.errors =
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
													validate14.errors = [
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
													validate14.errors = [
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
													validate14.errors = [
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
															validate14.errors =
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
															validate14.errors =
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
															validate14.errors =
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
																				schema22
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
																validate14.errors =
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
								validate14.errors = [
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
									validate14.errors = [
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
											validate14.errors = [
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
															validate14.errors =
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
																validate14.errors =
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
																	validate14.errors =
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
													validate14.errors = [
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
													validate14.errors = [
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
													validate14.errors = [
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
														validate14.errors = [
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
								validate14.errors = [
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
									validate14.errors = [
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
												key11 === 'step'
											)
										) {
											validate14.errors = [
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
															validate14.errors =
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
																validate14.errors =
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
																	validate14.errors =
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
													validate14.errors = [
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
													validate14.errors = [
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
													validate14.errors = [
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
										}
									}
								}
							} else {
								validate14.errors = [
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
						const _errs94 = errors;
						if (errors === _errs94) {
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
									validate14.errors = [
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
									const _errs96 = errors;
									for (const key13 in data) {
										if (
											!(
												key13 === 'progress' ||
												key13 === 'step' ||
												key13 === 'file'
											)
										) {
											validate14.errors = [
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
									if (_errs96 === errors) {
										if (data.progress !== undefined) {
											let data34 = data.progress;
											const _errs97 = errors;
											if (errors === _errs97) {
												if (
													data34 &&
													typeof data34 == 'object' &&
													!Array.isArray(data34)
												) {
													const _errs99 = errors;
													for (const key14 in data34) {
														if (
															!(
																key14 ===
																	'weight' ||
																key14 ===
																	'caption'
															)
														) {
															validate14.errors =
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
													if (_errs99 === errors) {
														if (
															data34.weight !==
															undefined
														) {
															let data35 =
																data34.weight;
															const _errs100 =
																errors;
															if (
																!(
																	typeof data35 ==
																		'number' &&
																	isFinite(
																		data35
																	)
																)
															) {
																validate14.errors =
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
																_errs100 ===
																errors;
														} else {
															var valid22 = true;
														}
														if (valid22) {
															if (
																data34.caption !==
																undefined
															) {
																const _errs102 =
																	errors;
																if (
																	typeof data34.caption !==
																	'string'
																) {
																	validate14.errors =
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
																	_errs102 ===
																	errors;
															} else {
																var valid22 = true;
															}
														}
													}
												} else {
													validate14.errors = [
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
											var valid21 = _errs97 === errors;
										} else {
											var valid21 = true;
										}
										if (valid21) {
											if (data.step !== undefined) {
												let data37 = data.step;
												const _errs104 = errors;
												if (
													typeof data37 !== 'string'
												) {
													validate14.errors = [
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
												if ('importWxr' !== data37) {
													validate14.errors = [
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
													_errs104 === errors;
											} else {
												var valid21 = true;
											}
											if (valid21) {
												if (data.file !== undefined) {
													const _errs106 = errors;
													if (
														!validate12(data.file, {
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
																? validate12.errors
																: vErrors.concat(
																		validate12.errors
																  );
														errors = vErrors.length;
													}
													var valid21 =
														_errs106 === errors;
												} else {
													var valid21 = true;
												}
											}
										}
									}
								}
							} else {
								validate14.errors = [
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
						const _errs107 = errors;
						if (errors === _errs107) {
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
									validate14.errors = [
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
									const _errs109 = errors;
									for (const key15 in data) {
										if (
											!(
												key15 === 'progress' ||
												key15 === 'step' ||
												key15 === 'themeSlug'
											)
										) {
											validate14.errors = [
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
									if (_errs109 === errors) {
										if (data.progress !== undefined) {
											let data39 = data.progress;
											const _errs110 = errors;
											if (errors === _errs110) {
												if (
													data39 &&
													typeof data39 == 'object' &&
													!Array.isArray(data39)
												) {
													const _errs112 = errors;
													for (const key16 in data39) {
														if (
															!(
																key16 ===
																	'weight' ||
																key16 ===
																	'caption'
															)
														) {
															validate14.errors =
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
													if (_errs112 === errors) {
														if (
															data39.weight !==
															undefined
														) {
															let data40 =
																data39.weight;
															const _errs113 =
																errors;
															if (
																!(
																	typeof data40 ==
																		'number' &&
																	isFinite(
																		data40
																	)
																)
															) {
																validate14.errors =
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
																_errs113 ===
																errors;
														} else {
															var valid25 = true;
														}
														if (valid25) {
															if (
																data39.caption !==
																undefined
															) {
																const _errs115 =
																	errors;
																if (
																	typeof data39.caption !==
																	'string'
																) {
																	validate14.errors =
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
																	_errs115 ===
																	errors;
															} else {
																var valid25 = true;
															}
														}
													}
												} else {
													validate14.errors = [
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
											var valid24 = _errs110 === errors;
										} else {
											var valid24 = true;
										}
										if (valid24) {
											if (data.step !== undefined) {
												let data42 = data.step;
												const _errs117 = errors;
												if (
													typeof data42 !== 'string'
												) {
													validate14.errors = [
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
													data42
												) {
													validate14.errors = [
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
													_errs117 === errors;
											} else {
												var valid24 = true;
											}
											if (valid24) {
												if (
													data.themeSlug !== undefined
												) {
													const _errs119 = errors;
													if (
														typeof data.themeSlug !==
														'string'
													) {
														validate14.errors = [
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
														_errs119 === errors;
												} else {
													var valid24 = true;
												}
											}
										}
									}
								}
							} else {
								validate14.errors = [
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
						const _errs121 = errors;
						if (errors === _errs121) {
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
									validate14.errors = [
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
									const _errs123 = errors;
									for (const key17 in data) {
										if (
											!(
												key17 === 'progress' ||
												key17 === 'step' ||
												key17 === 'wordPressFilesZip' ||
												key17 === 'pathInZip'
											)
										) {
											validate14.errors = [
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
									if (_errs123 === errors) {
										if (data.progress !== undefined) {
											let data44 = data.progress;
											const _errs124 = errors;
											if (errors === _errs124) {
												if (
													data44 &&
													typeof data44 == 'object' &&
													!Array.isArray(data44)
												) {
													const _errs126 = errors;
													for (const key18 in data44) {
														if (
															!(
																key18 ===
																	'weight' ||
																key18 ===
																	'caption'
															)
														) {
															validate14.errors =
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
													if (_errs126 === errors) {
														if (
															data44.weight !==
															undefined
														) {
															let data45 =
																data44.weight;
															const _errs127 =
																errors;
															if (
																!(
																	typeof data45 ==
																		'number' &&
																	isFinite(
																		data45
																	)
																)
															) {
																validate14.errors =
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
																_errs127 ===
																errors;
														} else {
															var valid28 = true;
														}
														if (valid28) {
															if (
																data44.caption !==
																undefined
															) {
																const _errs129 =
																	errors;
																if (
																	typeof data44.caption !==
																	'string'
																) {
																	validate14.errors =
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
																	_errs129 ===
																	errors;
															} else {
																var valid28 = true;
															}
														}
													}
												} else {
													validate14.errors = [
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
											var valid27 = _errs124 === errors;
										} else {
											var valid27 = true;
										}
										if (valid27) {
											if (data.step !== undefined) {
												let data47 = data.step;
												const _errs131 = errors;
												if (
													typeof data47 !== 'string'
												) {
													validate14.errors = [
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
													data47
												) {
													validate14.errors = [
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
													_errs131 === errors;
											} else {
												var valid27 = true;
											}
											if (valid27) {
												if (
													data.wordPressFilesZip !==
													undefined
												) {
													const _errs133 = errors;
													if (
														!validate12(
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
																? validate12.errors
																: vErrors.concat(
																		validate12.errors
																  );
														errors = vErrors.length;
													}
													var valid27 =
														_errs133 === errors;
												} else {
													var valid27 = true;
												}
												if (valid27) {
													if (
														data.pathInZip !==
														undefined
													) {
														const _errs134 = errors;
														if (
															typeof data.pathInZip !==
															'string'
														) {
															validate14.errors =
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
															_errs134 === errors;
													} else {
														var valid27 = true;
													}
												}
											}
										}
									}
								}
							} else {
								validate14.errors = [
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
						const _errs136 = errors;
						if (errors === _errs136) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing10;
								if (
									data.step === undefined &&
									(missing10 = 'step')
								) {
									validate14.errors = [
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
									const _errs138 = errors;
									for (const key19 in data) {
										if (
											!(
												key19 === 'progress' ||
												key19 ===
													'ifAlreadyInstalled' ||
												key19 === 'step' ||
												key19 === 'pluginDirectory' ||
												key19 === 'pluginZipFile' ||
												key19 === 'options'
											)
										) {
											validate14.errors = [
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
									if (_errs138 === errors) {
										if (data.progress !== undefined) {
											let data50 = data.progress;
											const _errs139 = errors;
											if (errors === _errs139) {
												if (
													data50 &&
													typeof data50 == 'object' &&
													!Array.isArray(data50)
												) {
													const _errs141 = errors;
													for (const key20 in data50) {
														if (
															!(
																key20 ===
																	'weight' ||
																key20 ===
																	'caption'
															)
														) {
															validate14.errors =
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
													if (_errs141 === errors) {
														if (
															data50.weight !==
															undefined
														) {
															let data51 =
																data50.weight;
															const _errs142 =
																errors;
															if (
																!(
																	typeof data51 ==
																		'number' &&
																	isFinite(
																		data51
																	)
																)
															) {
																validate14.errors =
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
																_errs142 ===
																errors;
														} else {
															var valid31 = true;
														}
														if (valid31) {
															if (
																data50.caption !==
																undefined
															) {
																const _errs144 =
																	errors;
																if (
																	typeof data50.caption !==
																	'string'
																) {
																	validate14.errors =
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
																	_errs144 ===
																	errors;
															} else {
																var valid31 = true;
															}
														}
													}
												} else {
													validate14.errors = [
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
											var valid30 = _errs139 === errors;
										} else {
											var valid30 = true;
										}
										if (valid30) {
											if (
												data.ifAlreadyInstalled !==
												undefined
											) {
												let data53 =
													data.ifAlreadyInstalled;
												const _errs146 = errors;
												if (
													typeof data53 !== 'string'
												) {
													validate14.errors = [
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
														data53 ===
															'overwrite' ||
														data53 === 'skip' ||
														data53 === 'error'
													)
												) {
													validate14.errors = [
														{
															instancePath:
																instancePath +
																'/ifAlreadyInstalled',
															schemaPath:
																'#/oneOf/9/properties/ifAlreadyInstalled/enum',
															keyword: 'enum',
															params: {
																allowedValues:
																	schema22
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
													_errs146 === errors;
											} else {
												var valid30 = true;
											}
											if (valid30) {
												if (data.step !== undefined) {
													let data54 = data.step;
													const _errs148 = errors;
													if (
														typeof data54 !==
														'string'
													) {
														validate14.errors = [
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
														data54
													) {
														validate14.errors = [
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
														_errs148 === errors;
												} else {
													var valid30 = true;
												}
												if (valid30) {
													if (
														data.pluginDirectory !==
														undefined
													) {
														let data55 =
															data.pluginDirectory;
														const _errs150 = errors;
														const _errs151 = errors;
														if (
															errors === _errs151
														) {
															if (
																data55 &&
																typeof data55 ==
																	'object' &&
																!Array.isArray(
																	data55
																)
															) {
																let missing11;
																if (
																	(data55.resource ===
																		undefined &&
																		(missing11 =
																			'resource')) ||
																	(data55.url ===
																		undefined &&
																		(missing11 =
																			'url')) ||
																	(data55.ref ===
																		undefined &&
																		(missing11 =
																			'ref')) ||
																	(data55.path ===
																		undefined &&
																		(missing11 =
																			'path'))
																) {
																	validate14.errors =
																		[
																			{
																				instancePath:
																					instancePath +
																					'/pluginDirectory',
																				schemaPath:
																					'#/definitions/DirectoryReference/required',
																				keyword:
																					'required',
																				params: {
																					missingProperty:
																						missing11,
																				},
																				message:
																					"must have required property '" +
																					missing11 +
																					"'",
																			},
																		];
																	return false;
																} else {
																	const _errs153 =
																		errors;
																	for (const key21 in data55) {
																		if (
																			!(
																				key21 ===
																					'resource' ||
																				key21 ===
																					'url' ||
																				key21 ===
																					'ref' ||
																				key21 ===
																					'path'
																			)
																		) {
																			validate14.errors =
																				[
																					{
																						instancePath:
																							instancePath +
																							'/pluginDirectory',
																						schemaPath:
																							'#/definitions/DirectoryReference/additionalProperties',
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
																		_errs153 ===
																		errors
																	) {
																		if (
																			data55.resource !==
																			undefined
																		) {
																			let data56 =
																				data55.resource;
																			const _errs154 =
																				errors;
																			if (
																				typeof data56 !==
																				'string'
																			) {
																				validate14.errors =
																					[
																						{
																							instancePath:
																								instancePath +
																								'/pluginDirectory/resource',
																							schemaPath:
																								'#/definitions/DirectoryReference/properties/resource/type',
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
																				'git-directory' !==
																				data56
																			) {
																				validate14.errors =
																					[
																						{
																							instancePath:
																								instancePath +
																								'/pluginDirectory/resource',
																							schemaPath:
																								'#/definitions/DirectoryReference/properties/resource/const',
																							keyword:
																								'const',
																							params: {
																								allowedValue:
																									'git-directory',
																							},
																							message:
																								'must be equal to constant',
																						},
																					];
																				return false;
																			}
																			var valid33 =
																				_errs154 ===
																				errors;
																		} else {
																			var valid33 = true;
																		}
																		if (
																			valid33
																		) {
																			if (
																				data55.url !==
																				undefined
																			) {
																				const _errs156 =
																					errors;
																				if (
																					typeof data55.url !==
																					'string'
																				) {
																					validate14.errors =
																						[
																							{
																								instancePath:
																									instancePath +
																									'/pluginDirectory/url',
																								schemaPath:
																									'#/definitions/DirectoryReference/properties/url/type',
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
																				var valid33 =
																					_errs156 ===
																					errors;
																			} else {
																				var valid33 = true;
																			}
																			if (
																				valid33
																			) {
																				if (
																					data55.ref !==
																					undefined
																				) {
																					const _errs158 =
																						errors;
																					if (
																						typeof data55.ref !==
																						'string'
																					) {
																						validate14.errors =
																							[
																								{
																									instancePath:
																										instancePath +
																										'/pluginDirectory/ref',
																									schemaPath:
																										'#/definitions/DirectoryReference/properties/ref/type',
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
																					var valid33 =
																						_errs158 ===
																						errors;
																				} else {
																					var valid33 = true;
																				}
																				if (
																					valid33
																				) {
																					if (
																						data55.path !==
																						undefined
																					) {
																						const _errs160 =
																							errors;
																						if (
																							typeof data55.path !==
																							'string'
																						) {
																							validate14.errors =
																								[
																									{
																										instancePath:
																											instancePath +
																											'/pluginDirectory/path',
																										schemaPath:
																											'#/definitions/DirectoryReference/properties/path/type',
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
																						var valid33 =
																							_errs160 ===
																							errors;
																					} else {
																						var valid33 = true;
																					}
																				}
																			}
																		}
																	}
																}
															} else {
																validate14.errors =
																	[
																		{
																			instancePath:
																				instancePath +
																				'/pluginDirectory',
																			schemaPath:
																				'#/definitions/DirectoryReference/type',
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
															_errs150 === errors;
													} else {
														var valid30 = true;
													}
													if (valid30) {
														if (
															data.pluginZipFile !==
															undefined
														) {
															const _errs162 =
																errors;
															if (
																!validate12(
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
																		? validate12.errors
																		: vErrors.concat(
																				validate12.errors
																		  );
																errors =
																	vErrors.length;
															}
															var valid30 =
																_errs162 ===
																errors;
														} else {
															var valid30 = true;
														}
														if (valid30) {
															if (
																data.options !==
																undefined
															) {
																let data61 =
																	data.options;
																const _errs163 =
																	errors;
																const _errs164 =
																	errors;
																if (
																	errors ===
																	_errs164
																) {
																	if (
																		data61 &&
																		typeof data61 ==
																			'object' &&
																		!Array.isArray(
																			data61
																		)
																	) {
																		const _errs166 =
																			errors;
																		for (const key22 in data61) {
																			if (
																				!(
																					key22 ===
																					'activate'
																				)
																			) {
																				validate14.errors =
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
																									key22,
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
																			_errs166 ===
																			errors
																		) {
																			if (
																				data61.activate !==
																				undefined
																			) {
																				if (
																					typeof data61.activate !==
																					'boolean'
																				) {
																					validate14.errors =
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
																			}
																		}
																	} else {
																		validate14.errors =
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
																	_errs163 ===
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
								validate14.errors = [
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
						const _errs169 = errors;
						if (errors === _errs169) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing12;
								if (
									(data.step === undefined &&
										(missing12 = 'step')) ||
									(data.themeZipFile === undefined &&
										(missing12 = 'themeZipFile'))
								) {
									validate14.errors = [
										{
											instancePath,
											schemaPath: '#/oneOf/10/required',
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
									const _errs171 = errors;
									for (const key23 in data) {
										if (
											!(
												key23 === 'progress' ||
												key23 ===
													'ifAlreadyInstalled' ||
												key23 === 'step' ||
												key23 === 'themeZipFile' ||
												key23 === 'options'
											)
										) {
											validate14.errors = [
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
									if (_errs171 === errors) {
										if (data.progress !== undefined) {
											let data63 = data.progress;
											const _errs172 = errors;
											if (errors === _errs172) {
												if (
													data63 &&
													typeof data63 == 'object' &&
													!Array.isArray(data63)
												) {
													const _errs174 = errors;
													for (const key24 in data63) {
														if (
															!(
																key24 ===
																	'weight' ||
																key24 ===
																	'caption'
															)
														) {
															validate14.errors =
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
													if (_errs174 === errors) {
														if (
															data63.weight !==
															undefined
														) {
															let data64 =
																data63.weight;
															const _errs175 =
																errors;
															if (
																!(
																	typeof data64 ==
																		'number' &&
																	isFinite(
																		data64
																	)
																)
															) {
																validate14.errors =
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
																_errs175 ===
																errors;
														} else {
															var valid38 = true;
														}
														if (valid38) {
															if (
																data63.caption !==
																undefined
															) {
																const _errs177 =
																	errors;
																if (
																	typeof data63.caption !==
																	'string'
																) {
																	validate14.errors =
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
																	_errs177 ===
																	errors;
															} else {
																var valid38 = true;
															}
														}
													}
												} else {
													validate14.errors = [
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
											var valid37 = _errs172 === errors;
										} else {
											var valid37 = true;
										}
										if (valid37) {
											if (
												data.ifAlreadyInstalled !==
												undefined
											) {
												let data66 =
													data.ifAlreadyInstalled;
												const _errs179 = errors;
												if (
													typeof data66 !== 'string'
												) {
													validate14.errors = [
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
														data66 ===
															'overwrite' ||
														data66 === 'skip' ||
														data66 === 'error'
													)
												) {
													validate14.errors = [
														{
															instancePath:
																instancePath +
																'/ifAlreadyInstalled',
															schemaPath:
																'#/oneOf/10/properties/ifAlreadyInstalled/enum',
															keyword: 'enum',
															params: {
																allowedValues:
																	schema22
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
													_errs179 === errors;
											} else {
												var valid37 = true;
											}
											if (valid37) {
												if (data.step !== undefined) {
													let data67 = data.step;
													const _errs181 = errors;
													if (
														typeof data67 !==
														'string'
													) {
														validate14.errors = [
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
														data67
													) {
														validate14.errors = [
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
														_errs181 === errors;
												} else {
													var valid37 = true;
												}
												if (valid37) {
													if (
														data.themeZipFile !==
														undefined
													) {
														const _errs183 = errors;
														if (
															!validate12(
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
																vErrors === null
																	? validate12.errors
																	: vErrors.concat(
																			validate12.errors
																	  );
															errors =
																vErrors.length;
														}
														var valid37 =
															_errs183 === errors;
													} else {
														var valid37 = true;
													}
													if (valid37) {
														if (
															data.options !==
															undefined
														) {
															let data69 =
																data.options;
															const _errs184 =
																errors;
															if (
																errors ===
																_errs184
															) {
																if (
																	data69 &&
																	typeof data69 ==
																		'object' &&
																	!Array.isArray(
																		data69
																	)
																) {
																	const _errs186 =
																		errors;
																	for (const key25 in data69) {
																		if (
																			!(
																				key25 ===
																					'activate' ||
																				key25 ===
																					'importStarterContent'
																			)
																		) {
																			validate14.errors =
																				[
																					{
																						instancePath:
																							instancePath +
																							'/options',
																						schemaPath:
																							'#/oneOf/10/properties/options/additionalProperties',
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
																		_errs186 ===
																		errors
																	) {
																		if (
																			data69.activate !==
																			undefined
																		) {
																			const _errs187 =
																				errors;
																			if (
																				typeof data69.activate !==
																				'boolean'
																			) {
																				validate14.errors =
																					[
																						{
																							instancePath:
																								instancePath +
																								'/options/activate',
																							schemaPath:
																								'#/oneOf/10/properties/options/properties/activate/type',
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
																			var valid39 =
																				_errs187 ===
																				errors;
																		} else {
																			var valid39 = true;
																		}
																		if (
																			valid39
																		) {
																			if (
																				data69.importStarterContent !==
																				undefined
																			) {
																				const _errs189 =
																					errors;
																				if (
																					typeof data69.importStarterContent !==
																					'boolean'
																				) {
																					validate14.errors =
																						[
																							{
																								instancePath:
																									instancePath +
																									'/options/importStarterContent',
																								schemaPath:
																									'#/oneOf/10/properties/options/properties/importStarterContent/type',
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
																				var valid39 =
																					_errs189 ===
																					errors;
																			} else {
																				var valid39 = true;
																			}
																		}
																	}
																} else {
																	validate14.errors =
																		[
																			{
																				instancePath:
																					instancePath +
																					'/options',
																				schemaPath:
																					'#/oneOf/10/properties/options/type',
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
																_errs184 ===
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
							} else {
								validate14.errors = [
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
						const _errs191 = errors;
						if (errors === _errs191) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing13;
								if (
									data.step === undefined &&
									(missing13 = 'step')
								) {
									validate14.errors = [
										{
											instancePath,
											schemaPath: '#/oneOf/11/required',
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
									const _errs193 = errors;
									for (const key26 in data) {
										if (
											!(
												key26 === 'progress' ||
												key26 === 'step' ||
												key26 === 'username' ||
												key26 === 'password'
											)
										) {
											validate14.errors = [
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
									if (_errs193 === errors) {
										if (data.progress !== undefined) {
											let data72 = data.progress;
											const _errs194 = errors;
											if (errors === _errs194) {
												if (
													data72 &&
													typeof data72 == 'object' &&
													!Array.isArray(data72)
												) {
													const _errs196 = errors;
													for (const key27 in data72) {
														if (
															!(
																key27 ===
																	'weight' ||
																key27 ===
																	'caption'
															)
														) {
															validate14.errors =
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
													if (_errs196 === errors) {
														if (
															data72.weight !==
															undefined
														) {
															let data73 =
																data72.weight;
															const _errs197 =
																errors;
															if (
																!(
																	typeof data73 ==
																		'number' &&
																	isFinite(
																		data73
																	)
																)
															) {
																validate14.errors =
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
															var valid42 =
																_errs197 ===
																errors;
														} else {
															var valid42 = true;
														}
														if (valid42) {
															if (
																data72.caption !==
																undefined
															) {
																const _errs199 =
																	errors;
																if (
																	typeof data72.caption !==
																	'string'
																) {
																	validate14.errors =
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
																var valid42 =
																	_errs199 ===
																	errors;
															} else {
																var valid42 = true;
															}
														}
													}
												} else {
													validate14.errors = [
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
											var valid41 = _errs194 === errors;
										} else {
											var valid41 = true;
										}
										if (valid41) {
											if (data.step !== undefined) {
												let data75 = data.step;
												const _errs201 = errors;
												if (
													typeof data75 !== 'string'
												) {
													validate14.errors = [
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
												if ('login' !== data75) {
													validate14.errors = [
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
												var valid41 =
													_errs201 === errors;
											} else {
												var valid41 = true;
											}
											if (valid41) {
												if (
													data.username !== undefined
												) {
													const _errs203 = errors;
													if (
														typeof data.username !==
														'string'
													) {
														validate14.errors = [
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
													var valid41 =
														_errs203 === errors;
												} else {
													var valid41 = true;
												}
												if (valid41) {
													if (
														data.password !==
														undefined
													) {
														const _errs205 = errors;
														if (
															typeof data.password !==
															'string'
														) {
															validate14.errors =
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
														var valid41 =
															_errs205 === errors;
													} else {
														var valid41 = true;
													}
												}
											}
										}
									}
								}
							} else {
								validate14.errors = [
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
						const _errs207 = errors;
						if (errors === _errs207) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing14;
								if (
									(data.path === undefined &&
										(missing14 = 'path')) ||
									(data.step === undefined &&
										(missing14 = 'step'))
								) {
									validate14.errors = [
										{
											instancePath,
											schemaPath: '#/oneOf/12/required',
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
									const _errs209 = errors;
									for (const key28 in data) {
										if (
											!(
												key28 === 'progress' ||
												key28 === 'step' ||
												key28 === 'path'
											)
										) {
											validate14.errors = [
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
									if (_errs209 === errors) {
										if (data.progress !== undefined) {
											let data78 = data.progress;
											const _errs210 = errors;
											if (errors === _errs210) {
												if (
													data78 &&
													typeof data78 == 'object' &&
													!Array.isArray(data78)
												) {
													const _errs212 = errors;
													for (const key29 in data78) {
														if (
															!(
																key29 ===
																	'weight' ||
																key29 ===
																	'caption'
															)
														) {
															validate14.errors =
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
													if (_errs212 === errors) {
														if (
															data78.weight !==
															undefined
														) {
															let data79 =
																data78.weight;
															const _errs213 =
																errors;
															if (
																!(
																	typeof data79 ==
																		'number' &&
																	isFinite(
																		data79
																	)
																)
															) {
																validate14.errors =
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
															var valid45 =
																_errs213 ===
																errors;
														} else {
															var valid45 = true;
														}
														if (valid45) {
															if (
																data78.caption !==
																undefined
															) {
																const _errs215 =
																	errors;
																if (
																	typeof data78.caption !==
																	'string'
																) {
																	validate14.errors =
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
																var valid45 =
																	_errs215 ===
																	errors;
															} else {
																var valid45 = true;
															}
														}
													}
												} else {
													validate14.errors = [
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
											var valid44 = _errs210 === errors;
										} else {
											var valid44 = true;
										}
										if (valid44) {
											if (data.step !== undefined) {
												let data81 = data.step;
												const _errs217 = errors;
												if (
													typeof data81 !== 'string'
												) {
													validate14.errors = [
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
												if ('mkdir' !== data81) {
													validate14.errors = [
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
												var valid44 =
													_errs217 === errors;
											} else {
												var valid44 = true;
											}
											if (valid44) {
												if (data.path !== undefined) {
													const _errs219 = errors;
													if (
														typeof data.path !==
														'string'
													) {
														validate14.errors = [
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
													var valid44 =
														_errs219 === errors;
												} else {
													var valid44 = true;
												}
											}
										}
									}
								}
							} else {
								validate14.errors = [
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
						const _errs221 = errors;
						if (errors === _errs221) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing15;
								if (
									(data.fromPath === undefined &&
										(missing15 = 'fromPath')) ||
									(data.step === undefined &&
										(missing15 = 'step')) ||
									(data.toPath === undefined &&
										(missing15 = 'toPath'))
								) {
									validate14.errors = [
										{
											instancePath,
											schemaPath: '#/oneOf/13/required',
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
									const _errs223 = errors;
									for (const key30 in data) {
										if (
											!(
												key30 === 'progress' ||
												key30 === 'step' ||
												key30 === 'fromPath' ||
												key30 === 'toPath'
											)
										) {
											validate14.errors = [
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
									if (_errs223 === errors) {
										if (data.progress !== undefined) {
											let data83 = data.progress;
											const _errs224 = errors;
											if (errors === _errs224) {
												if (
													data83 &&
													typeof data83 == 'object' &&
													!Array.isArray(data83)
												) {
													const _errs226 = errors;
													for (const key31 in data83) {
														if (
															!(
																key31 ===
																	'weight' ||
																key31 ===
																	'caption'
															)
														) {
															validate14.errors =
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
													if (_errs226 === errors) {
														if (
															data83.weight !==
															undefined
														) {
															let data84 =
																data83.weight;
															const _errs227 =
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
																validate14.errors =
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
															var valid48 =
																_errs227 ===
																errors;
														} else {
															var valid48 = true;
														}
														if (valid48) {
															if (
																data83.caption !==
																undefined
															) {
																const _errs229 =
																	errors;
																if (
																	typeof data83.caption !==
																	'string'
																) {
																	validate14.errors =
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
																var valid48 =
																	_errs229 ===
																	errors;
															} else {
																var valid48 = true;
															}
														}
													}
												} else {
													validate14.errors = [
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
											var valid47 = _errs224 === errors;
										} else {
											var valid47 = true;
										}
										if (valid47) {
											if (data.step !== undefined) {
												let data86 = data.step;
												const _errs231 = errors;
												if (
													typeof data86 !== 'string'
												) {
													validate14.errors = [
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
												if ('mv' !== data86) {
													validate14.errors = [
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
												var valid47 =
													_errs231 === errors;
											} else {
												var valid47 = true;
											}
											if (valid47) {
												if (
													data.fromPath !== undefined
												) {
													const _errs233 = errors;
													if (
														typeof data.fromPath !==
														'string'
													) {
														validate14.errors = [
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
													var valid47 =
														_errs233 === errors;
												} else {
													var valid47 = true;
												}
												if (valid47) {
													if (
														data.toPath !==
														undefined
													) {
														const _errs235 = errors;
														if (
															typeof data.toPath !==
															'string'
														) {
															validate14.errors =
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
														var valid47 =
															_errs235 === errors;
													} else {
														var valid47 = true;
													}
												}
											}
										}
									}
								}
							} else {
								validate14.errors = [
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
						const _errs237 = errors;
						if (errors === _errs237) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing16;
								if (
									data.step === undefined &&
									(missing16 = 'step')
								) {
									validate14.errors = [
										{
											instancePath,
											schemaPath: '#/oneOf/14/required',
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
									const _errs239 = errors;
									for (const key32 in data) {
										if (
											!(
												key32 === 'progress' ||
												key32 === 'step'
											)
										) {
											validate14.errors = [
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
									if (_errs239 === errors) {
										if (data.progress !== undefined) {
											let data89 = data.progress;
											const _errs240 = errors;
											if (errors === _errs240) {
												if (
													data89 &&
													typeof data89 == 'object' &&
													!Array.isArray(data89)
												) {
													const _errs242 = errors;
													for (const key33 in data89) {
														if (
															!(
																key33 ===
																	'weight' ||
																key33 ===
																	'caption'
															)
														) {
															validate14.errors =
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
													if (_errs242 === errors) {
														if (
															data89.weight !==
															undefined
														) {
															let data90 =
																data89.weight;
															const _errs243 =
																errors;
															if (
																!(
																	typeof data90 ==
																		'number' &&
																	isFinite(
																		data90
																	)
																)
															) {
																validate14.errors =
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
															var valid51 =
																_errs243 ===
																errors;
														} else {
															var valid51 = true;
														}
														if (valid51) {
															if (
																data89.caption !==
																undefined
															) {
																const _errs245 =
																	errors;
																if (
																	typeof data89.caption !==
																	'string'
																) {
																	validate14.errors =
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
																var valid51 =
																	_errs245 ===
																	errors;
															} else {
																var valid51 = true;
															}
														}
													}
												} else {
													validate14.errors = [
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
											var valid50 = _errs240 === errors;
										} else {
											var valid50 = true;
										}
										if (valid50) {
											if (data.step !== undefined) {
												let data92 = data.step;
												const _errs247 = errors;
												if (
													typeof data92 !== 'string'
												) {
													validate14.errors = [
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
												if ('resetData' !== data92) {
													validate14.errors = [
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
												var valid50 =
													_errs247 === errors;
											} else {
												var valid50 = true;
											}
										}
									}
								}
							} else {
								validate14.errors = [
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
						const _errs249 = errors;
						if (errors === _errs249) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing17;
								if (
									(data.request === undefined &&
										(missing17 = 'request')) ||
									(data.step === undefined &&
										(missing17 = 'step'))
								) {
									validate14.errors = [
										{
											instancePath,
											schemaPath: '#/oneOf/15/required',
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
									const _errs251 = errors;
									for (const key34 in data) {
										if (
											!(
												key34 === 'progress' ||
												key34 === 'step' ||
												key34 === 'request'
											)
										) {
											validate14.errors = [
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
									if (_errs251 === errors) {
										if (data.progress !== undefined) {
											let data93 = data.progress;
											const _errs252 = errors;
											if (errors === _errs252) {
												if (
													data93 &&
													typeof data93 == 'object' &&
													!Array.isArray(data93)
												) {
													const _errs254 = errors;
													for (const key35 in data93) {
														if (
															!(
																key35 ===
																	'weight' ||
																key35 ===
																	'caption'
															)
														) {
															validate14.errors =
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
													if (_errs254 === errors) {
														if (
															data93.weight !==
															undefined
														) {
															let data94 =
																data93.weight;
															const _errs255 =
																errors;
															if (
																!(
																	typeof data94 ==
																		'number' &&
																	isFinite(
																		data94
																	)
																)
															) {
																validate14.errors =
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
															var valid54 =
																_errs255 ===
																errors;
														} else {
															var valid54 = true;
														}
														if (valid54) {
															if (
																data93.caption !==
																undefined
															) {
																const _errs257 =
																	errors;
																if (
																	typeof data93.caption !==
																	'string'
																) {
																	validate14.errors =
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
																var valid54 =
																	_errs257 ===
																	errors;
															} else {
																var valid54 = true;
															}
														}
													}
												} else {
													validate14.errors = [
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
											var valid53 = _errs252 === errors;
										} else {
											var valid53 = true;
										}
										if (valid53) {
											if (data.step !== undefined) {
												let data96 = data.step;
												const _errs259 = errors;
												if (
													typeof data96 !== 'string'
												) {
													validate14.errors = [
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
												if ('request' !== data96) {
													validate14.errors = [
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
												var valid53 =
													_errs259 === errors;
											} else {
												var valid53 = true;
											}
											if (valid53) {
												if (
													data.request !== undefined
												) {
													const _errs261 = errors;
													if (
														!validate19(
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
																? validate19.errors
																: vErrors.concat(
																		validate19.errors
																  );
														errors = vErrors.length;
													}
													var valid53 =
														_errs261 === errors;
												} else {
													var valid53 = true;
												}
											}
										}
									}
								}
							} else {
								validate14.errors = [
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
						const _errs262 = errors;
						if (errors === _errs262) {
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
									validate14.errors = [
										{
											instancePath,
											schemaPath: '#/oneOf/16/required',
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
									const _errs264 = errors;
									for (const key36 in data) {
										if (
											!(
												key36 === 'progress' ||
												key36 === 'step' ||
												key36 === 'path'
											)
										) {
											validate14.errors = [
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
													for (const key37 in data98) {
														if (
															!(
																key37 ===
																	'weight' ||
																key37 ===
																	'caption'
															)
														) {
															validate14.errors =
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
																validate14.errors =
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
															var valid57 =
																_errs268 ===
																errors;
														} else {
															var valid57 = true;
														}
														if (valid57) {
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
																	validate14.errors =
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
																var valid57 =
																	_errs270 ===
																	errors;
															} else {
																var valid57 = true;
															}
														}
													}
												} else {
													validate14.errors = [
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
											var valid56 = _errs265 === errors;
										} else {
											var valid56 = true;
										}
										if (valid56) {
											if (data.step !== undefined) {
												let data101 = data.step;
												const _errs272 = errors;
												if (
													typeof data101 !== 'string'
												) {
													validate14.errors = [
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
												if ('rm' !== data101) {
													validate14.errors = [
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
												var valid56 =
													_errs272 === errors;
											} else {
												var valid56 = true;
											}
											if (valid56) {
												if (data.path !== undefined) {
													const _errs274 = errors;
													if (
														typeof data.path !==
														'string'
													) {
														validate14.errors = [
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
													var valid56 =
														_errs274 === errors;
												} else {
													var valid56 = true;
												}
											}
										}
									}
								}
							} else {
								validate14.errors = [
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
						const _errs276 = errors;
						if (errors === _errs276) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing19;
								if (
									(data.path === undefined &&
										(missing19 = 'path')) ||
									(data.step === undefined &&
										(missing19 = 'step'))
								) {
									validate14.errors = [
										{
											instancePath,
											schemaPath: '#/oneOf/17/required',
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
									const _errs278 = errors;
									for (const key38 in data) {
										if (
											!(
												key38 === 'progress' ||
												key38 === 'step' ||
												key38 === 'path'
											)
										) {
											validate14.errors = [
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
									if (_errs278 === errors) {
										if (data.progress !== undefined) {
											let data103 = data.progress;
											const _errs279 = errors;
											if (errors === _errs279) {
												if (
													data103 &&
													typeof data103 ==
														'object' &&
													!Array.isArray(data103)
												) {
													const _errs281 = errors;
													for (const key39 in data103) {
														if (
															!(
																key39 ===
																	'weight' ||
																key39 ===
																	'caption'
															)
														) {
															validate14.errors =
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
													if (_errs281 === errors) {
														if (
															data103.weight !==
															undefined
														) {
															let data104 =
																data103.weight;
															const _errs282 =
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
																validate14.errors =
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
															var valid60 =
																_errs282 ===
																errors;
														} else {
															var valid60 = true;
														}
														if (valid60) {
															if (
																data103.caption !==
																undefined
															) {
																const _errs284 =
																	errors;
																if (
																	typeof data103.caption !==
																	'string'
																) {
																	validate14.errors =
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
																var valid60 =
																	_errs284 ===
																	errors;
															} else {
																var valid60 = true;
															}
														}
													}
												} else {
													validate14.errors = [
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
											var valid59 = _errs279 === errors;
										} else {
											var valid59 = true;
										}
										if (valid59) {
											if (data.step !== undefined) {
												let data106 = data.step;
												const _errs286 = errors;
												if (
													typeof data106 !== 'string'
												) {
													validate14.errors = [
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
												if ('rmdir' !== data106) {
													validate14.errors = [
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
												var valid59 =
													_errs286 === errors;
											} else {
												var valid59 = true;
											}
											if (valid59) {
												if (data.path !== undefined) {
													const _errs288 = errors;
													if (
														typeof data.path !==
														'string'
													) {
														validate14.errors = [
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
													var valid59 =
														_errs288 === errors;
												} else {
													var valid59 = true;
												}
											}
										}
									}
								}
							} else {
								validate14.errors = [
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
						const _errs290 = errors;
						if (errors === _errs290) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing20;
								if (
									(data.code === undefined &&
										(missing20 = 'code')) ||
									(data.step === undefined &&
										(missing20 = 'step'))
								) {
									validate14.errors = [
										{
											instancePath,
											schemaPath: '#/oneOf/18/required',
											keyword: 'required',
											params: {
												missingProperty: missing20,
											},
											message:
												"must have required property '" +
												missing20 +
												"'",
										},
									];
									return false;
								} else {
									const _errs292 = errors;
									for (const key40 in data) {
										if (
											!(
												key40 === 'progress' ||
												key40 === 'step' ||
												key40 === 'code'
											)
										) {
											validate14.errors = [
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
									if (_errs292 === errors) {
										if (data.progress !== undefined) {
											let data108 = data.progress;
											const _errs293 = errors;
											if (errors === _errs293) {
												if (
													data108 &&
													typeof data108 ==
														'object' &&
													!Array.isArray(data108)
												) {
													const _errs295 = errors;
													for (const key41 in data108) {
														if (
															!(
																key41 ===
																	'weight' ||
																key41 ===
																	'caption'
															)
														) {
															validate14.errors =
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
													if (_errs295 === errors) {
														if (
															data108.weight !==
															undefined
														) {
															let data109 =
																data108.weight;
															const _errs296 =
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
																validate14.errors =
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
															var valid63 =
																_errs296 ===
																errors;
														} else {
															var valid63 = true;
														}
														if (valid63) {
															if (
																data108.caption !==
																undefined
															) {
																const _errs298 =
																	errors;
																if (
																	typeof data108.caption !==
																	'string'
																) {
																	validate14.errors =
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
																var valid63 =
																	_errs298 ===
																	errors;
															} else {
																var valid63 = true;
															}
														}
													}
												} else {
													validate14.errors = [
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
											var valid62 = _errs293 === errors;
										} else {
											var valid62 = true;
										}
										if (valid62) {
											if (data.step !== undefined) {
												let data111 = data.step;
												const _errs300 = errors;
												if (
													typeof data111 !== 'string'
												) {
													validate14.errors = [
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
												if ('runPHP' !== data111) {
													validate14.errors = [
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
												var valid62 =
													_errs300 === errors;
											} else {
												var valid62 = true;
											}
											if (valid62) {
												if (data.code !== undefined) {
													const _errs302 = errors;
													if (
														typeof data.code !==
														'string'
													) {
														validate14.errors = [
															{
																instancePath:
																	instancePath +
																	'/code',
																schemaPath:
																	'#/oneOf/18/properties/code/type',
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
													var valid62 =
														_errs302 === errors;
												} else {
													var valid62 = true;
												}
											}
										}
									}
								}
							} else {
								validate14.errors = [
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
						const _errs304 = errors;
						if (errors === _errs304) {
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
									validate14.errors = [
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
									const _errs306 = errors;
									for (const key42 in data) {
										if (
											!(
												key42 === 'progress' ||
												key42 === 'step' ||
												key42 === 'options'
											)
										) {
											validate14.errors = [
												{
													instancePath,
													schemaPath:
														'#/oneOf/19/additionalProperties',
													keyword:
														'additionalProperties',
													params: {
														additionalProperty:
															key42,
													},
													message:
														'must NOT have additional properties',
												},
											];
											return false;
											break;
										}
									}
									if (_errs306 === errors) {
										if (data.progress !== undefined) {
											let data113 = data.progress;
											const _errs307 = errors;
											if (errors === _errs307) {
												if (
													data113 &&
													typeof data113 ==
														'object' &&
													!Array.isArray(data113)
												) {
													const _errs309 = errors;
													for (const key43 in data113) {
														if (
															!(
																key43 ===
																	'weight' ||
																key43 ===
																	'caption'
															)
														) {
															validate14.errors =
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
													if (_errs309 === errors) {
														if (
															data113.weight !==
															undefined
														) {
															let data114 =
																data113.weight;
															const _errs310 =
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
																validate14.errors =
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
															var valid66 =
																_errs310 ===
																errors;
														} else {
															var valid66 = true;
														}
														if (valid66) {
															if (
																data113.caption !==
																undefined
															) {
																const _errs312 =
																	errors;
																if (
																	typeof data113.caption !==
																	'string'
																) {
																	validate14.errors =
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
																var valid66 =
																	_errs312 ===
																	errors;
															} else {
																var valid66 = true;
															}
														}
													}
												} else {
													validate14.errors = [
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
											var valid65 = _errs307 === errors;
										} else {
											var valid65 = true;
										}
										if (valid65) {
											if (data.step !== undefined) {
												let data116 = data.step;
												const _errs314 = errors;
												if (
													typeof data116 !== 'string'
												) {
													validate14.errors = [
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
													data116
												) {
													validate14.errors = [
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
												var valid65 =
													_errs314 === errors;
											} else {
												var valid65 = true;
											}
											if (valid65) {
												if (
													data.options !== undefined
												) {
													const _errs316 = errors;
													if (
														!validate21(
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
																? validate21.errors
																: vErrors.concat(
																		validate21.errors
																  );
														errors = vErrors.length;
													}
													var valid65 =
														_errs316 === errors;
												} else {
													var valid65 = true;
												}
											}
										}
									}
								}
							} else {
								validate14.errors = [
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
						const _errs317 = errors;
						if (errors === _errs317) {
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
									validate14.errors = [
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
									const _errs319 = errors;
									for (const key44 in data) {
										if (
											!(
												key44 === 'progress' ||
												key44 === 'step' ||
												key44 === 'options'
											)
										) {
											validate14.errors = [
												{
													instancePath,
													schemaPath:
														'#/oneOf/20/additionalProperties',
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
									if (_errs319 === errors) {
										if (data.progress !== undefined) {
											let data118 = data.progress;
											const _errs320 = errors;
											if (errors === _errs320) {
												if (
													data118 &&
													typeof data118 ==
														'object' &&
													!Array.isArray(data118)
												) {
													const _errs322 = errors;
													for (const key45 in data118) {
														if (
															!(
																key45 ===
																	'weight' ||
																key45 ===
																	'caption'
															)
														) {
															validate14.errors =
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
													if (_errs322 === errors) {
														if (
															data118.weight !==
															undefined
														) {
															let data119 =
																data118.weight;
															const _errs323 =
																errors;
															if (
																!(
																	typeof data119 ==
																		'number' &&
																	isFinite(
																		data119
																	)
																)
															) {
																validate14.errors =
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
															var valid69 =
																_errs323 ===
																errors;
														} else {
															var valid69 = true;
														}
														if (valid69) {
															if (
																data118.caption !==
																undefined
															) {
																const _errs325 =
																	errors;
																if (
																	typeof data118.caption !==
																	'string'
																) {
																	validate14.errors =
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
																var valid69 =
																	_errs325 ===
																	errors;
															} else {
																var valid69 = true;
															}
														}
													}
												} else {
													validate14.errors = [
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
											var valid68 = _errs320 === errors;
										} else {
											var valid68 = true;
										}
										if (valid68) {
											if (data.step !== undefined) {
												let data121 = data.step;
												const _errs327 = errors;
												if (
													typeof data121 !== 'string'
												) {
													validate14.errors = [
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
													data121
												) {
													validate14.errors = [
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
												var valid68 =
													_errs327 === errors;
											} else {
												var valid68 = true;
											}
											if (valid68) {
												if (
													data.options !== undefined
												) {
													let data122 = data.options;
													const _errs329 = errors;
													const _errs330 = errors;
													if (errors === _errs330) {
														if (
															data122 &&
															typeof data122 ==
																'object' &&
															!Array.isArray(
																data122
															)
														) {
															const _errs332 =
																errors;
															for (const key46 in data122) {
																if (
																	!(
																		key46 ===
																			'adminUsername' ||
																		key46 ===
																			'adminPassword'
																	)
																) {
																	validate14.errors =
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
															if (
																_errs332 ===
																errors
															) {
																if (
																	data122.adminUsername !==
																	undefined
																) {
																	const _errs333 =
																		errors;
																	if (
																		typeof data122.adminUsername !==
																		'string'
																	) {
																		validate14.errors =
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
																	var valid71 =
																		_errs333 ===
																		errors;
																} else {
																	var valid71 = true;
																}
																if (valid71) {
																	if (
																		data122.adminPassword !==
																		undefined
																	) {
																		const _errs335 =
																			errors;
																		if (
																			typeof data122.adminPassword !==
																			'string'
																		) {
																			validate14.errors =
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
																		var valid71 =
																			_errs335 ===
																			errors;
																	} else {
																		var valid71 = true;
																	}
																}
															}
														} else {
															validate14.errors =
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
													var valid68 =
														_errs329 === errors;
												} else {
													var valid68 = true;
												}
											}
										}
									}
								}
							} else {
								validate14.errors = [
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
						const _errs337 = errors;
						if (errors === _errs337) {
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
									validate14.errors = [
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
									const _errs339 = errors;
									for (const key47 in data) {
										if (
											!(
												key47 === 'progress' ||
												key47 === 'step' ||
												key47 === 'sql'
											)
										) {
											validate14.errors = [
												{
													instancePath,
													schemaPath:
														'#/oneOf/21/additionalProperties',
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
									if (_errs339 === errors) {
										if (data.progress !== undefined) {
											let data125 = data.progress;
											const _errs340 = errors;
											if (errors === _errs340) {
												if (
													data125 &&
													typeof data125 ==
														'object' &&
													!Array.isArray(data125)
												) {
													const _errs342 = errors;
													for (const key48 in data125) {
														if (
															!(
																key48 ===
																	'weight' ||
																key48 ===
																	'caption'
															)
														) {
															validate14.errors =
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
													if (_errs342 === errors) {
														if (
															data125.weight !==
															undefined
														) {
															let data126 =
																data125.weight;
															const _errs343 =
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
																validate14.errors =
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
															var valid74 =
																_errs343 ===
																errors;
														} else {
															var valid74 = true;
														}
														if (valid74) {
															if (
																data125.caption !==
																undefined
															) {
																const _errs345 =
																	errors;
																if (
																	typeof data125.caption !==
																	'string'
																) {
																	validate14.errors =
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
																var valid74 =
																	_errs345 ===
																	errors;
															} else {
																var valid74 = true;
															}
														}
													}
												} else {
													validate14.errors = [
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
											var valid73 = _errs340 === errors;
										} else {
											var valid73 = true;
										}
										if (valid73) {
											if (data.step !== undefined) {
												let data128 = data.step;
												const _errs347 = errors;
												if (
													typeof data128 !== 'string'
												) {
													validate14.errors = [
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
												if ('runSql' !== data128) {
													validate14.errors = [
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
												var valid73 =
													_errs347 === errors;
											} else {
												var valid73 = true;
											}
											if (valid73) {
												if (data.sql !== undefined) {
													const _errs349 = errors;
													if (
														!validate12(data.sql, {
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
																? validate12.errors
																: vErrors.concat(
																		validate12.errors
																  );
														errors = vErrors.length;
													}
													var valid73 =
														_errs349 === errors;
												} else {
													var valid73 = true;
												}
											}
										}
									}
								}
							} else {
								validate14.errors = [
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
						const _errs350 = errors;
						if (errors === _errs350) {
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
									validate14.errors = [
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
									const _errs352 = errors;
									for (const key49 in data) {
										if (
											!(
												key49 === 'progress' ||
												key49 === 'step' ||
												key49 === 'options'
											)
										) {
											validate14.errors = [
												{
													instancePath,
													schemaPath:
														'#/oneOf/22/additionalProperties',
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
									if (_errs352 === errors) {
										if (data.progress !== undefined) {
											let data130 = data.progress;
											const _errs353 = errors;
											if (errors === _errs353) {
												if (
													data130 &&
													typeof data130 ==
														'object' &&
													!Array.isArray(data130)
												) {
													const _errs355 = errors;
													for (const key50 in data130) {
														if (
															!(
																key50 ===
																	'weight' ||
																key50 ===
																	'caption'
															)
														) {
															validate14.errors =
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
													if (_errs355 === errors) {
														if (
															data130.weight !==
															undefined
														) {
															let data131 =
																data130.weight;
															const _errs356 =
																errors;
															if (
																!(
																	typeof data131 ==
																		'number' &&
																	isFinite(
																		data131
																	)
																)
															) {
																validate14.errors =
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
															var valid77 =
																_errs356 ===
																errors;
														} else {
															var valid77 = true;
														}
														if (valid77) {
															if (
																data130.caption !==
																undefined
															) {
																const _errs358 =
																	errors;
																if (
																	typeof data130.caption !==
																	'string'
																) {
																	validate14.errors =
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
																var valid77 =
																	_errs358 ===
																	errors;
															} else {
																var valid77 = true;
															}
														}
													}
												} else {
													validate14.errors = [
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
											var valid76 = _errs353 === errors;
										} else {
											var valid76 = true;
										}
										if (valid76) {
											if (data.step !== undefined) {
												let data133 = data.step;
												const _errs360 = errors;
												if (
													typeof data133 !== 'string'
												) {
													validate14.errors = [
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
													'setSiteOptions' !== data133
												) {
													validate14.errors = [
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
												var valid76 =
													_errs360 === errors;
											} else {
												var valid76 = true;
											}
											if (valid76) {
												if (
													data.options !== undefined
												) {
													let data134 = data.options;
													const _errs362 = errors;
													if (errors === _errs362) {
														if (
															data134 &&
															typeof data134 ==
																'object' &&
															!Array.isArray(
																data134
															)
														) {
															for (const key51 in data134) {
																const _errs365 =
																	errors;
																var valid78 =
																	_errs365 ===
																	errors;
																if (!valid78) {
																	break;
																}
															}
														} else {
															validate14.errors =
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
													var valid76 =
														_errs362 === errors;
												} else {
													var valid76 = true;
												}
											}
										}
									}
								}
							} else {
								validate14.errors = [
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
						const _errs366 = errors;
						if (errors === _errs366) {
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
									validate14.errors = [
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
									const _errs368 = errors;
									for (const key52 in data) {
										if (
											!(
												key52 === 'progress' ||
												key52 === 'step' ||
												key52 === 'zipFile' ||
												key52 === 'zipPath' ||
												key52 === 'extractToPath'
											)
										) {
											validate14.errors = [
												{
													instancePath,
													schemaPath:
														'#/oneOf/23/additionalProperties',
													keyword:
														'additionalProperties',
													params: {
														additionalProperty:
															key52,
													},
													message:
														'must NOT have additional properties',
												},
											];
											return false;
											break;
										}
									}
									if (_errs368 === errors) {
										if (data.progress !== undefined) {
											let data136 = data.progress;
											const _errs369 = errors;
											if (errors === _errs369) {
												if (
													data136 &&
													typeof data136 ==
														'object' &&
													!Array.isArray(data136)
												) {
													const _errs371 = errors;
													for (const key53 in data136) {
														if (
															!(
																key53 ===
																	'weight' ||
																key53 ===
																	'caption'
															)
														) {
															validate14.errors =
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
													if (_errs371 === errors) {
														if (
															data136.weight !==
															undefined
														) {
															let data137 =
																data136.weight;
															const _errs372 =
																errors;
															if (
																!(
																	typeof data137 ==
																		'number' &&
																	isFinite(
																		data137
																	)
																)
															) {
																validate14.errors =
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
															var valid81 =
																_errs372 ===
																errors;
														} else {
															var valid81 = true;
														}
														if (valid81) {
															if (
																data136.caption !==
																undefined
															) {
																const _errs374 =
																	errors;
																if (
																	typeof data136.caption !==
																	'string'
																) {
																	validate14.errors =
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
																var valid81 =
																	_errs374 ===
																	errors;
															} else {
																var valid81 = true;
															}
														}
													}
												} else {
													validate14.errors = [
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
											var valid80 = _errs369 === errors;
										} else {
											var valid80 = true;
										}
										if (valid80) {
											if (data.step !== undefined) {
												let data139 = data.step;
												const _errs376 = errors;
												if (
													typeof data139 !== 'string'
												) {
													validate14.errors = [
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
												if ('unzip' !== data139) {
													validate14.errors = [
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
												var valid80 =
													_errs376 === errors;
											} else {
												var valid80 = true;
											}
											if (valid80) {
												if (
													data.zipFile !== undefined
												) {
													const _errs378 = errors;
													if (
														!validate12(
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
																? validate12.errors
																: vErrors.concat(
																		validate12.errors
																  );
														errors = vErrors.length;
													}
													var valid80 =
														_errs378 === errors;
												} else {
													var valid80 = true;
												}
												if (valid80) {
													if (
														data.zipPath !==
														undefined
													) {
														const _errs379 = errors;
														if (
															typeof data.zipPath !==
															'string'
														) {
															validate14.errors =
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
														var valid80 =
															_errs379 === errors;
													} else {
														var valid80 = true;
													}
													if (valid80) {
														if (
															data.extractToPath !==
															undefined
														) {
															const _errs381 =
																errors;
															if (
																typeof data.extractToPath !==
																'string'
															) {
																validate14.errors =
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
															var valid80 =
																_errs381 ===
																errors;
														} else {
															var valid80 = true;
														}
													}
												}
											}
										}
									}
								}
							} else {
								validate14.errors = [
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
						const _errs383 = errors;
						if (errors === _errs383) {
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
									validate14.errors = [
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
									const _errs385 = errors;
									for (const key54 in data) {
										if (
											!(
												key54 === 'progress' ||
												key54 === 'step' ||
												key54 === 'meta' ||
												key54 === 'userId'
											)
										) {
											validate14.errors = [
												{
													instancePath,
													schemaPath:
														'#/oneOf/24/additionalProperties',
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
									if (_errs385 === errors) {
										if (data.progress !== undefined) {
											let data143 = data.progress;
											const _errs386 = errors;
											if (errors === _errs386) {
												if (
													data143 &&
													typeof data143 ==
														'object' &&
													!Array.isArray(data143)
												) {
													const _errs388 = errors;
													for (const key55 in data143) {
														if (
															!(
																key55 ===
																	'weight' ||
																key55 ===
																	'caption'
															)
														) {
															validate14.errors =
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
													if (_errs388 === errors) {
														if (
															data143.weight !==
															undefined
														) {
															let data144 =
																data143.weight;
															const _errs389 =
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
																validate14.errors =
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
															var valid84 =
																_errs389 ===
																errors;
														} else {
															var valid84 = true;
														}
														if (valid84) {
															if (
																data143.caption !==
																undefined
															) {
																const _errs391 =
																	errors;
																if (
																	typeof data143.caption !==
																	'string'
																) {
																	validate14.errors =
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
																var valid84 =
																	_errs391 ===
																	errors;
															} else {
																var valid84 = true;
															}
														}
													}
												} else {
													validate14.errors = [
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
											var valid83 = _errs386 === errors;
										} else {
											var valid83 = true;
										}
										if (valid83) {
											if (data.step !== undefined) {
												let data146 = data.step;
												const _errs393 = errors;
												if (
													typeof data146 !== 'string'
												) {
													validate14.errors = [
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
													'updateUserMeta' !== data146
												) {
													validate14.errors = [
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
												var valid83 =
													_errs393 === errors;
											} else {
												var valid83 = true;
											}
											if (valid83) {
												if (data.meta !== undefined) {
													let data147 = data.meta;
													const _errs395 = errors;
													if (errors === _errs395) {
														if (
															data147 &&
															typeof data147 ==
																'object' &&
															!Array.isArray(
																data147
															)
														) {
															for (const key56 in data147) {
																const _errs398 =
																	errors;
																var valid85 =
																	_errs398 ===
																	errors;
																if (!valid85) {
																	break;
																}
															}
														} else {
															validate14.errors =
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
													var valid83 =
														_errs395 === errors;
												} else {
													var valid83 = true;
												}
												if (valid83) {
													if (
														data.userId !==
														undefined
													) {
														let data149 =
															data.userId;
														const _errs399 = errors;
														if (
															!(
																typeof data149 ==
																	'number' &&
																isFinite(
																	data149
																)
															)
														) {
															validate14.errors =
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
														var valid83 =
															_errs399 === errors;
													} else {
														var valid83 = true;
													}
												}
											}
										}
									}
								}
							} else {
								validate14.errors = [
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
						const _errs401 = errors;
						if (errors === _errs401) {
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
									validate14.errors = [
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
									const _errs403 = errors;
									for (const key57 in data) {
										if (
											!(
												key57 === 'progress' ||
												key57 === 'step' ||
												key57 === 'path' ||
												key57 === 'data'
											)
										) {
											validate14.errors = [
												{
													instancePath,
													schemaPath:
														'#/oneOf/25/additionalProperties',
													keyword:
														'additionalProperties',
													params: {
														additionalProperty:
															key57,
													},
													message:
														'must NOT have additional properties',
												},
											];
											return false;
											break;
										}
									}
									if (_errs403 === errors) {
										if (data.progress !== undefined) {
											let data150 = data.progress;
											const _errs404 = errors;
											if (errors === _errs404) {
												if (
													data150 &&
													typeof data150 ==
														'object' &&
													!Array.isArray(data150)
												) {
													const _errs406 = errors;
													for (const key58 in data150) {
														if (
															!(
																key58 ===
																	'weight' ||
																key58 ===
																	'caption'
															)
														) {
															validate14.errors =
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
													if (_errs406 === errors) {
														if (
															data150.weight !==
															undefined
														) {
															let data151 =
																data150.weight;
															const _errs407 =
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
																validate14.errors =
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
															var valid88 =
																_errs407 ===
																errors;
														} else {
															var valid88 = true;
														}
														if (valid88) {
															if (
																data150.caption !==
																undefined
															) {
																const _errs409 =
																	errors;
																if (
																	typeof data150.caption !==
																	'string'
																) {
																	validate14.errors =
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
																var valid88 =
																	_errs409 ===
																	errors;
															} else {
																var valid88 = true;
															}
														}
													}
												} else {
													validate14.errors = [
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
											var valid87 = _errs404 === errors;
										} else {
											var valid87 = true;
										}
										if (valid87) {
											if (data.step !== undefined) {
												let data153 = data.step;
												const _errs411 = errors;
												if (
													typeof data153 !== 'string'
												) {
													validate14.errors = [
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
												if ('writeFile' !== data153) {
													validate14.errors = [
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
												var valid87 =
													_errs411 === errors;
											} else {
												var valid87 = true;
											}
											if (valid87) {
												if (data.path !== undefined) {
													const _errs413 = errors;
													if (
														typeof data.path !==
														'string'
													) {
														validate14.errors = [
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
													var valid87 =
														_errs413 === errors;
												} else {
													var valid87 = true;
												}
												if (valid87) {
													if (
														data.data !== undefined
													) {
														let data155 = data.data;
														const _errs415 = errors;
														const _errs416 = errors;
														let valid89 = false;
														const _errs417 = errors;
														if (
															!validate12(
																data155,
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
																	? validate12.errors
																	: vErrors.concat(
																			validate12.errors
																	  );
															errors =
																vErrors.length;
														}
														var _valid0 =
															_errs417 === errors;
														valid89 =
															valid89 || _valid0;
														if (!valid89) {
															const _errs418 =
																errors;
															if (
																typeof data155 !==
																'string'
															) {
																const err0 = {
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
																		err0,
																	];
																} else {
																	vErrors.push(
																		err0
																	);
																}
																errors++;
															}
															var _valid0 =
																_errs418 ===
																errors;
															valid89 =
																valid89 ||
																_valid0;
															if (!valid89) {
																const _errs420 =
																	errors;
																if (
																	errors ===
																	_errs420
																) {
																	if (
																		data155 &&
																		typeof data155 ==
																			'object' &&
																		!Array.isArray(
																			data155
																		)
																	) {
																		let missing28;
																		if (
																			(data155.BYTES_PER_ELEMENT ===
																				undefined &&
																				(missing28 =
																					'BYTES_PER_ELEMENT')) ||
																			(data155.buffer ===
																				undefined &&
																				(missing28 =
																					'buffer')) ||
																			(data155.byteLength ===
																				undefined &&
																				(missing28 =
																					'byteLength')) ||
																			(data155.byteOffset ===
																				undefined &&
																				(missing28 =
																					'byteOffset')) ||
																			(data155.length ===
																				undefined &&
																				(missing28 =
																					'length'))
																		) {
																			const err1 =
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
																						err1,
																					];
																			} else {
																				vErrors.push(
																					err1
																				);
																			}
																			errors++;
																		} else {
																			const _errs422 =
																				errors;
																			for (const key59 in data155) {
																				if (
																					!(
																						key59 ===
																							'BYTES_PER_ELEMENT' ||
																						key59 ===
																							'buffer' ||
																						key59 ===
																							'byteLength' ||
																						key59 ===
																							'byteOffset' ||
																						key59 ===
																							'length'
																					)
																				) {
																					let data156 =
																						data155[
																							key59
																						];
																					const _errs423 =
																						errors;
																					if (
																						!(
																							typeof data156 ==
																								'number' &&
																							isFinite(
																								data156
																							)
																						)
																					) {
																						const err2 =
																							{
																								instancePath:
																									instancePath +
																									'/data/' +
																									key59
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
																									err2,
																								];
																						} else {
																							vErrors.push(
																								err2
																							);
																						}
																						errors++;
																					}
																					var valid90 =
																						_errs423 ===
																						errors;
																					if (
																						!valid90
																					) {
																						break;
																					}
																				}
																			}
																			if (
																				_errs422 ===
																				errors
																			) {
																				if (
																					data155.BYTES_PER_ELEMENT !==
																					undefined
																				) {
																					let data157 =
																						data155.BYTES_PER_ELEMENT;
																					const _errs425 =
																						errors;
																					if (
																						!(
																							typeof data157 ==
																								'number' &&
																							isFinite(
																								data157
																							)
																						)
																					) {
																						const err3 =
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
																									err3,
																								];
																						} else {
																							vErrors.push(
																								err3
																							);
																						}
																						errors++;
																					}
																					var valid91 =
																						_errs425 ===
																						errors;
																				} else {
																					var valid91 = true;
																				}
																				if (
																					valid91
																				) {
																					if (
																						data155.buffer !==
																						undefined
																					) {
																						let data158 =
																							data155.buffer;
																						const _errs427 =
																							errors;
																						if (
																							errors ===
																							_errs427
																						) {
																							if (
																								data158 &&
																								typeof data158 ==
																									'object' &&
																								!Array.isArray(
																									data158
																								)
																							) {
																								let missing29;
																								if (
																									data158.byteLength ===
																										undefined &&
																									(missing29 =
																										'byteLength')
																								) {
																									const err4 =
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
																												err4,
																											];
																									} else {
																										vErrors.push(
																											err4
																										);
																									}
																									errors++;
																								} else {
																									const _errs429 =
																										errors;
																									for (const key60 in data158) {
																										if (
																											!(
																												key60 ===
																												'byteLength'
																											)
																										) {
																											const err5 =
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
																															key60,
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
																										_errs429 ===
																										errors
																									) {
																										if (
																											data158.byteLength !==
																											undefined
																										) {
																											let data159 =
																												data158.byteLength;
																											if (
																												!(
																													typeof data159 ==
																														'number' &&
																													isFinite(
																														data159
																													)
																												)
																											) {
																												const err6 =
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
																						var valid91 =
																							_errs427 ===
																							errors;
																					} else {
																						var valid91 = true;
																					}
																					if (
																						valid91
																					) {
																						if (
																							data155.byteLength !==
																							undefined
																						) {
																							let data160 =
																								data155.byteLength;
																							const _errs432 =
																								errors;
																							if (
																								!(
																									typeof data160 ==
																										'number' &&
																									isFinite(
																										data160
																									)
																								)
																							) {
																								const err8 =
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
																											err8,
																										];
																								} else {
																									vErrors.push(
																										err8
																									);
																								}
																								errors++;
																							}
																							var valid91 =
																								_errs432 ===
																								errors;
																						} else {
																							var valid91 = true;
																						}
																						if (
																							valid91
																						) {
																							if (
																								data155.byteOffset !==
																								undefined
																							) {
																								let data161 =
																									data155.byteOffset;
																								const _errs434 =
																									errors;
																								if (
																									!(
																										typeof data161 ==
																											'number' &&
																										isFinite(
																											data161
																										)
																									)
																								) {
																									const err9 =
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
																												err9,
																											];
																									} else {
																										vErrors.push(
																											err9
																										);
																									}
																									errors++;
																								}
																								var valid91 =
																									_errs434 ===
																									errors;
																							} else {
																								var valid91 = true;
																							}
																							if (
																								valid91
																							) {
																								if (
																									data155.length !==
																									undefined
																								) {
																									let data162 =
																										data155.length;
																									const _errs436 =
																										errors;
																									if (
																										!(
																											typeof data162 ==
																												'number' &&
																											isFinite(
																												data162
																											)
																										)
																									) {
																										const err10 =
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
																													err10,
																												];
																										} else {
																											vErrors.push(
																												err10
																											);
																										}
																										errors++;
																									}
																									var valid91 =
																										_errs436 ===
																										errors;
																								} else {
																									var valid91 = true;
																								}
																							}
																						}
																					}
																				}
																			}
																		}
																	} else {
																		const err11 =
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
																					err11,
																				];
																		} else {
																			vErrors.push(
																				err11
																			);
																		}
																		errors++;
																	}
																}
																var _valid0 =
																	_errs420 ===
																	errors;
																valid89 =
																	valid89 ||
																	_valid0;
															}
														}
														if (!valid89) {
															const err12 = {
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
																	err12,
																];
															} else {
																vErrors.push(
																	err12
																);
															}
															errors++;
															validate14.errors =
																vErrors;
															return false;
														} else {
															errors = _errs416;
															if (
																vErrors !== null
															) {
																if (_errs416) {
																	vErrors.length =
																		_errs416;
																} else {
																	vErrors =
																		null;
																}
															}
														}
														var valid87 =
															_errs415 === errors;
													} else {
														var valid87 = true;
													}
												}
											}
										}
									}
								}
							} else {
								validate14.errors = [
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
					} else if (tag0 === 'wp-cli') {
						const _errs438 = errors;
						if (errors === _errs438) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing30;
								if (
									(data.command === undefined &&
										(missing30 = 'command')) ||
									(data.step === undefined &&
										(missing30 = 'step'))
								) {
									validate14.errors = [
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
									const _errs440 = errors;
									for (const key61 in data) {
										if (
											!(
												key61 === 'progress' ||
												key61 === 'step' ||
												key61 === 'command' ||
												key61 === 'wpCliPath'
											)
										) {
											validate14.errors = [
												{
													instancePath,
													schemaPath:
														'#/oneOf/26/additionalProperties',
													keyword:
														'additionalProperties',
													params: {
														additionalProperty:
															key61,
													},
													message:
														'must NOT have additional properties',
												},
											];
											return false;
											break;
										}
									}
									if (_errs440 === errors) {
										if (data.progress !== undefined) {
											let data163 = data.progress;
											const _errs441 = errors;
											if (errors === _errs441) {
												if (
													data163 &&
													typeof data163 ==
														'object' &&
													!Array.isArray(data163)
												) {
													const _errs443 = errors;
													for (const key62 in data163) {
														if (
															!(
																key62 ===
																	'weight' ||
																key62 ===
																	'caption'
															)
														) {
															validate14.errors =
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
													if (_errs443 === errors) {
														if (
															data163.weight !==
															undefined
														) {
															let data164 =
																data163.weight;
															const _errs444 =
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
																validate14.errors =
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
															var valid95 =
																_errs444 ===
																errors;
														} else {
															var valid95 = true;
														}
														if (valid95) {
															if (
																data163.caption !==
																undefined
															) {
																const _errs446 =
																	errors;
																if (
																	typeof data163.caption !==
																	'string'
																) {
																	validate14.errors =
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
																var valid95 =
																	_errs446 ===
																	errors;
															} else {
																var valid95 = true;
															}
														}
													}
												} else {
													validate14.errors = [
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
											var valid94 = _errs441 === errors;
										} else {
											var valid94 = true;
										}
										if (valid94) {
											if (data.step !== undefined) {
												let data166 = data.step;
												const _errs448 = errors;
												if (
													typeof data166 !== 'string'
												) {
													validate14.errors = [
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
												if ('wp-cli' !== data166) {
													validate14.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/26/properties/step/const',
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
												var valid94 =
													_errs448 === errors;
											} else {
												var valid94 = true;
											}
											if (valid94) {
												if (
													data.command !== undefined
												) {
													let data167 = data.command;
													const _errs450 = errors;
													const _errs451 = errors;
													let valid96 = false;
													const _errs452 = errors;
													if (
														typeof data167 !==
														'string'
													) {
														const err13 = {
															instancePath:
																instancePath +
																'/command',
															schemaPath:
																'#/oneOf/26/properties/command/anyOf/0/type',
															keyword: 'type',
															params: {
																type: 'string',
															},
															message:
																'must be string',
														};
														if (vErrors === null) {
															vErrors = [err13];
														} else {
															vErrors.push(err13);
														}
														errors++;
													}
													var _valid1 =
														_errs452 === errors;
													valid96 =
														valid96 || _valid1;
													if (!valid96) {
														const _errs454 = errors;
														if (
															errors === _errs454
														) {
															if (
																Array.isArray(
																	data167
																)
															) {
																var valid97 = true;
																const len0 =
																	data167.length;
																for (
																	let i0 = 0;
																	i0 < len0;
																	i0++
																) {
																	const _errs456 =
																		errors;
																	if (
																		typeof data167[
																			i0
																		] !==
																		'string'
																	) {
																		const err14 =
																			{
																				instancePath:
																					instancePath +
																					'/command/' +
																					i0,
																				schemaPath:
																					'#/oneOf/26/properties/command/anyOf/1/items/type',
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
																	var valid97 =
																		_errs456 ===
																		errors;
																	if (
																		!valid97
																	) {
																		break;
																	}
																}
															} else {
																const err15 = {
																	instancePath:
																		instancePath +
																		'/command',
																	schemaPath:
																		'#/oneOf/26/properties/command/anyOf/1/type',
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
														var _valid1 =
															_errs454 === errors;
														valid96 =
															valid96 || _valid1;
													}
													if (!valid96) {
														const err16 = {
															instancePath:
																instancePath +
																'/command',
															schemaPath:
																'#/oneOf/26/properties/command/anyOf',
															keyword: 'anyOf',
															params: {},
															message:
																'must match a schema in anyOf',
														};
														if (vErrors === null) {
															vErrors = [err16];
														} else {
															vErrors.push(err16);
														}
														errors++;
														validate14.errors =
															vErrors;
														return false;
													} else {
														errors = _errs451;
														if (vErrors !== null) {
															if (_errs451) {
																vErrors.length =
																	_errs451;
															} else {
																vErrors = null;
															}
														}
													}
													var valid94 =
														_errs450 === errors;
												} else {
													var valid94 = true;
												}
												if (valid94) {
													if (
														data.wpCliPath !==
														undefined
													) {
														const _errs458 = errors;
														if (
															typeof data.wpCliPath !==
															'string'
														) {
															validate14.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/wpCliPath',
																		schemaPath:
																			'#/oneOf/26/properties/wpCliPath/type',
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
														var valid94 =
															_errs458 === errors;
													} else {
														var valid94 = true;
													}
												}
											}
										}
									}
								}
							} else {
								validate14.errors = [
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
					} else if (tag0 === 'setSiteLanguage') {
						const _errs460 = errors;
						if (errors === _errs460) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing31;
								if (
									(data.language === undefined &&
										(missing31 = 'language')) ||
									(data.step === undefined &&
										(missing31 = 'step'))
								) {
									validate14.errors = [
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
									const _errs462 = errors;
									for (const key63 in data) {
										if (
											!(
												key63 === 'progress' ||
												key63 === 'step' ||
												key63 === 'language'
											)
										) {
											validate14.errors = [
												{
													instancePath,
													schemaPath:
														'#/oneOf/27/additionalProperties',
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
													for (const key64 in data170) {
														if (
															!(
																key64 ===
																	'weight' ||
																key64 ===
																	'caption'
															)
														) {
															validate14.errors =
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
																validate14.errors =
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
															var valid100 =
																_errs466 ===
																errors;
														} else {
															var valid100 = true;
														}
														if (valid100) {
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
																	validate14.errors =
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
																var valid100 =
																	_errs468 ===
																	errors;
															} else {
																var valid100 = true;
															}
														}
													}
												} else {
													validate14.errors = [
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
											var valid99 = _errs463 === errors;
										} else {
											var valid99 = true;
										}
										if (valid99) {
											if (data.step !== undefined) {
												let data173 = data.step;
												const _errs470 = errors;
												if (
													typeof data173 !== 'string'
												) {
													validate14.errors = [
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
												if (
													'setSiteLanguage' !==
													data173
												) {
													validate14.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/27/properties/step/const',
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
												var valid99 =
													_errs470 === errors;
											} else {
												var valid99 = true;
											}
											if (valid99) {
												if (
													data.language !== undefined
												) {
													const _errs472 = errors;
													if (
														typeof data.language !==
														'string'
													) {
														validate14.errors = [
															{
																instancePath:
																	instancePath +
																	'/language',
																schemaPath:
																	'#/oneOf/27/properties/language/type',
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
													var valid99 =
														_errs472 === errors;
												} else {
													var valid99 = true;
												}
											}
										}
									}
								}
							} else {
								validate14.errors = [
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
					} else {
						validate14.errors = [
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
					validate14.errors = [
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
			validate14.errors = [
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
	validate14.errors = vErrors;
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
														typeof data9 !==
														'string'
													) {
														const err0 = {
															instancePath:
																instancePath +
																'/preferredVersions/php',
															schemaPath:
																'#/definitions/SupportedPHPVersion/type',
															keyword: 'type',
															params: {
																type: 'string',
															},
															message:
																'must be string',
														};
														if (vErrors === null) {
															vErrors = [err0];
														} else {
															vErrors.push(err0);
														}
														errors++;
													}
													if (
														!(
															data9 === '8.3' ||
															data9 === '8.2' ||
															data9 === '8.1' ||
															data9 === '8.0' ||
															data9 === '7.4' ||
															data9 === '7.3' ||
															data9 === '7.2' ||
															data9 === '7.1' ||
															data9 === '7.0'
														)
													) {
														const err1 = {
															instancePath:
																instancePath +
																'/preferredVersions/php',
															schemaPath:
																'#/definitions/SupportedPHPVersion/enum',
															keyword: 'enum',
															params: {
																allowedValues:
																	schema13.enum,
															},
															message:
																'must be equal to one of the allowed values',
														};
														if (vErrors === null) {
															vErrors = [err1];
														} else {
															vErrors.push(err1);
														}
														errors++;
													}
													var _valid0 =
														_errs24 === errors;
													valid4 = valid4 || _valid0;
													if (!valid4) {
														const _errs27 = errors;
														if (
															typeof data9 !==
															'string'
														) {
															const err2 = {
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
																	err2,
																];
															} else {
																vErrors.push(
																	err2
																);
															}
															errors++;
														}
														if (
															'latest' !== data9
														) {
															const err3 = {
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
																	err3,
																];
															} else {
																vErrors.push(
																	err3
																);
															}
															errors++;
														}
														var _valid0 =
															_errs27 === errors;
														valid4 =
															valid4 || _valid0;
													}
													if (!valid4) {
														const err4 = {
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
															vErrors = [err4];
														} else {
															vErrors.push(err4);
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
														const _errs29 = errors;
														if (
															typeof data8.wp !==
															'string'
														) {
															validate11.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/preferredVersions/wp',
																		schemaPath:
																			'#/properties/preferredVersions/properties/wp/type',
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
															_errs29 === errors;
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
									const _errs31 = errors;
									if (errors === _errs31) {
										if (
											data11 &&
											typeof data11 == 'object' &&
											!Array.isArray(data11)
										) {
											const _errs33 = errors;
											for (const key3 in data11) {
												if (!(key3 === 'networking')) {
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
											if (_errs33 === errors) {
												if (
													data11.networking !==
													undefined
												) {
													if (
														typeof data11.networking !==
														'boolean'
													) {
														validate11.errors = [
															{
																instancePath:
																	instancePath +
																	'/features/networking',
																schemaPath:
																	'#/properties/features/properties/networking/type',
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
									var valid0 = _errs31 === errors;
								} else {
									var valid0 = true;
								}
								if (valid0) {
									if (data.extraLibraries !== undefined) {
										let data13 = data.extraLibraries;
										const _errs36 = errors;
										if (errors === _errs36) {
											if (Array.isArray(data13)) {
												var valid7 = true;
												const len1 = data13.length;
												for (
													let i1 = 0;
													i1 < len1;
													i1++
												) {
													let data14 = data13[i1];
													const _errs38 = errors;
													if (
														typeof data14 !==
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
													if ('wp-cli' !== data14) {
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
														_errs38 === errors;
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
										var valid0 = _errs36 === errors;
									} else {
										var valid0 = true;
									}
									if (valid0) {
										if (data.constants !== undefined) {
											let data15 = data.constants;
											const _errs41 = errors;
											if (errors === _errs41) {
												if (
													data15 &&
													typeof data15 == 'object' &&
													!Array.isArray(data15)
												) {
													for (const key4 in data15) {
														const _errs44 = errors;
														if (
															typeof data15[
																key4
															] !== 'string'
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
																			'#/properties/constants/additionalProperties/type',
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
															_errs44 === errors;
														if (!valid9) {
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
																'#/properties/constants/type',
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
											var valid0 = _errs41 === errors;
										} else {
											var valid0 = true;
										}
										if (valid0) {
											if (data.plugins !== undefined) {
												let data17 = data.plugins;
												const _errs46 = errors;
												if (errors === _errs46) {
													if (Array.isArray(data17)) {
														var valid10 = true;
														const len2 =
															data17.length;
														for (
															let i2 = 0;
															i2 < len2;
															i2++
														) {
															let data18 =
																data17[i2];
															const _errs48 =
																errors;
															const _errs49 =
																errors;
															let valid11 = false;
															const _errs50 =
																errors;
															if (
																typeof data18 !==
																'string'
															) {
																const err5 = {
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
																_errs50 ===
																errors;
															valid11 =
																valid11 ||
																_valid1;
															if (!valid11) {
																const _errs52 =
																	errors;
																if (
																	!validate12(
																		data18,
																		{
																			instancePath:
																				instancePath +
																				'/plugins/' +
																				i2,
																			parentData:
																				data17,
																			parentDataProperty:
																				i2,
																			rootData,
																		}
																	)
																) {
																	vErrors =
																		vErrors ===
																		null
																			? validate12.errors
																			: vErrors.concat(
																					validate12.errors
																			  );
																	errors =
																		vErrors.length;
																}
																var _valid1 =
																	_errs52 ===
																	errors;
																valid11 =
																	valid11 ||
																	_valid1;
															}
															if (!valid11) {
																const err6 = {
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
																		err6,
																	];
																} else {
																	vErrors.push(
																		err6
																	);
																}
																errors++;
																validate11.errors =
																	vErrors;
																return false;
															} else {
																errors =
																	_errs49;
																if (
																	vErrors !==
																	null
																) {
																	if (
																		_errs49
																	) {
																		vErrors.length =
																			_errs49;
																	} else {
																		vErrors =
																			null;
																	}
																}
															}
															var valid10 =
																_errs48 ===
																errors;
															if (!valid10) {
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
												var valid0 = _errs46 === errors;
											} else {
												var valid0 = true;
											}
											if (valid0) {
												if (
													data.siteOptions !==
													undefined
												) {
													let data19 =
														data.siteOptions;
													const _errs53 = errors;
													if (errors === _errs53) {
														if (
															data19 &&
															typeof data19 ==
																'object' &&
															!Array.isArray(
																data19
															)
														) {
															const _errs55 =
																errors;
															for (const key5 in data19) {
																if (
																	!(
																		key5 ===
																		'blogname'
																	)
																) {
																	const _errs56 =
																		errors;
																	if (
																		typeof data19[
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
																	var valid12 =
																		_errs56 ===
																		errors;
																	if (
																		!valid12
																	) {
																		break;
																	}
																}
															}
															if (
																_errs55 ===
																errors
															) {
																if (
																	data19.blogname !==
																	undefined
																) {
																	if (
																		typeof data19.blogname !==
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
														_errs53 === errors;
												} else {
													var valid0 = true;
												}
												if (valid0) {
													if (
														data.login !== undefined
													) {
														let data22 = data.login;
														const _errs60 = errors;
														const _errs61 = errors;
														let valid14 = false;
														const _errs62 = errors;
														if (
															typeof data22 !==
															'boolean'
														) {
															const err7 = {
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
																	err7,
																];
															} else {
																vErrors.push(
																	err7
																);
															}
															errors++;
														}
														var _valid2 =
															_errs62 === errors;
														valid14 =
															valid14 || _valid2;
														if (!valid14) {
															const _errs64 =
																errors;
															if (
																errors ===
																_errs64
															) {
																if (
																	data22 &&
																	typeof data22 ==
																		'object' &&
																	!Array.isArray(
																		data22
																	)
																) {
																	let missing2;
																	if (
																		(data22.username ===
																			undefined &&
																			(missing2 =
																				'username')) ||
																		(data22.password ===
																			undefined &&
																			(missing2 =
																				'password'))
																	) {
																		const err8 =
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
																					err8,
																				];
																		} else {
																			vErrors.push(
																				err8
																			);
																		}
																		errors++;
																	} else {
																		const _errs66 =
																			errors;
																		for (const key6 in data22) {
																			if (
																				!(
																					key6 ===
																						'username' ||
																					key6 ===
																						'password'
																				)
																			) {
																				const err9 =
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
																							err9,
																						];
																				} else {
																					vErrors.push(
																						err9
																					);
																				}
																				errors++;
																				break;
																			}
																		}
																		if (
																			_errs66 ===
																			errors
																		) {
																			if (
																				data22.username !==
																				undefined
																			) {
																				const _errs67 =
																					errors;
																				if (
																					typeof data22.username !==
																					'string'
																				) {
																					const err10 =
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
																								err10,
																							];
																					} else {
																						vErrors.push(
																							err10
																						);
																					}
																					errors++;
																				}
																				var valid15 =
																					_errs67 ===
																					errors;
																			} else {
																				var valid15 = true;
																			}
																			if (
																				valid15
																			) {
																				if (
																					data22.password !==
																					undefined
																				) {
																					const _errs69 =
																						errors;
																					if (
																						typeof data22.password !==
																						'string'
																					) {
																						const err11 =
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
																									err11,
																								];
																						} else {
																							vErrors.push(
																								err11
																							);
																						}
																						errors++;
																					}
																					var valid15 =
																						_errs69 ===
																						errors;
																				} else {
																					var valid15 = true;
																				}
																			}
																		}
																	}
																} else {
																	const err12 =
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
																				err12,
																			];
																	} else {
																		vErrors.push(
																			err12
																		);
																	}
																	errors++;
																}
															}
															var _valid2 =
																_errs64 ===
																errors;
															valid14 =
																valid14 ||
																_valid2;
														}
														if (!valid14) {
															const err13 = {
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
																	err13,
																];
															} else {
																vErrors.push(
																	err13
																);
															}
															errors++;
															validate11.errors =
																vErrors;
															return false;
														} else {
															errors = _errs61;
															if (
																vErrors !== null
															) {
																if (_errs61) {
																	vErrors.length =
																		_errs61;
																} else {
																	vErrors =
																		null;
																}
															}
														}
														var valid0 =
															_errs60 === errors;
													} else {
														var valid0 = true;
													}
													if (valid0) {
														if (
															data.phpExtensionBundles !==
															undefined
														) {
															let data25 =
																data.phpExtensionBundles;
															const _errs71 =
																errors;
															if (
																errors ===
																_errs71
															) {
																if (
																	Array.isArray(
																		data25
																	)
																) {
																	var valid16 = true;
																	const len3 =
																		data25.length;
																	for (
																		let i3 = 0;
																		i3 <
																		len3;
																		i3++
																	) {
																		let data26 =
																			data25[
																				i3
																			];
																		const _errs73 =
																			errors;
																		if (
																			typeof data26 !==
																			'string'
																		) {
																			validate11.errors =
																				[
																					{
																						instancePath:
																							instancePath +
																							'/phpExtensionBundles/' +
																							i3,
																						schemaPath:
																							'#/definitions/SupportedPHPExtensionBundle/type',
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
																				data26 ===
																					'kitchen-sink' ||
																				data26 ===
																					'light'
																			)
																		) {
																			validate11.errors =
																				[
																					{
																						instancePath:
																							instancePath +
																							'/phpExtensionBundles/' +
																							i3,
																						schemaPath:
																							'#/definitions/SupportedPHPExtensionBundle/enum',
																						keyword:
																							'enum',
																						params: {
																							allowedValues:
																								schema21.enum,
																						},
																						message:
																							'must be equal to one of the allowed values',
																					},
																				];
																			return false;
																		}
																		var valid16 =
																			_errs73 ===
																			errors;
																		if (
																			!valid16
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
																					'/phpExtensionBundles',
																				schemaPath:
																					'#/properties/phpExtensionBundles/type',
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
																_errs71 ===
																errors;
														} else {
															var valid0 = true;
														}
														if (valid0) {
															if (
																data.steps !==
																undefined
															) {
																let data27 =
																	data.steps;
																const _errs76 =
																	errors;
																if (
																	errors ===
																	_errs76
																) {
																	if (
																		Array.isArray(
																			data27
																		)
																	) {
																		var valid18 = true;
																		const len4 =
																			data27.length;
																		for (
																			let i4 = 0;
																			i4 <
																			len4;
																			i4++
																		) {
																			let data28 =
																				data27[
																					i4
																				];
																			const _errs78 =
																				errors;
																			const _errs79 =
																				errors;
																			let valid19 = false;
																			const _errs80 =
																				errors;
																			if (
																				!validate14(
																					data28,
																					{
																						instancePath:
																							instancePath +
																							'/steps/' +
																							i4,
																						parentData:
																							data27,
																						parentDataProperty:
																							i4,
																						rootData,
																					}
																				)
																			) {
																				vErrors =
																					vErrors ===
																					null
																						? validate14.errors
																						: vErrors.concat(
																								validate14.errors
																						  );
																				errors =
																					vErrors.length;
																			}
																			var _valid3 =
																				_errs80 ===
																				errors;
																			valid19 =
																				valid19 ||
																				_valid3;
																			if (
																				!valid19
																			) {
																				const _errs81 =
																					errors;
																				if (
																					typeof data28 !==
																					'string'
																				) {
																					const err14 =
																						{
																							instancePath:
																								instancePath +
																								'/steps/' +
																								i4,
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
																								err14,
																							];
																					} else {
																						vErrors.push(
																							err14
																						);
																					}
																					errors++;
																				}
																				var _valid3 =
																					_errs81 ===
																					errors;
																				valid19 =
																					valid19 ||
																					_valid3;
																				if (
																					!valid19
																				) {
																					const _errs83 =
																						errors;
																					const err15 =
																						{
																							instancePath:
																								instancePath +
																								'/steps/' +
																								i4,
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
																								err15,
																							];
																					} else {
																						vErrors.push(
																							err15
																						);
																					}
																					errors++;
																					var _valid3 =
																						_errs83 ===
																						errors;
																					valid19 =
																						valid19 ||
																						_valid3;
																					if (
																						!valid19
																					) {
																						const _errs85 =
																							errors;
																						if (
																							typeof data28 !==
																							'boolean'
																						) {
																							const err16 =
																								{
																									instancePath:
																										instancePath +
																										'/steps/' +
																										i4,
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
																										err16,
																									];
																							} else {
																								vErrors.push(
																									err16
																								);
																							}
																							errors++;
																						}
																						if (
																							false !==
																							data28
																						) {
																							const err17 =
																								{
																									instancePath:
																										instancePath +
																										'/steps/' +
																										i4,
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
																										err17,
																									];
																							} else {
																								vErrors.push(
																									err17
																								);
																							}
																							errors++;
																						}
																						var _valid3 =
																							_errs85 ===
																							errors;
																						valid19 =
																							valid19 ||
																							_valid3;
																						if (
																							!valid19
																						) {
																							const _errs87 =
																								errors;
																							if (
																								data28 !==
																								null
																							) {
																								const err18 =
																									{
																										instancePath:
																											instancePath +
																											'/steps/' +
																											i4,
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
																											err18,
																										];
																								} else {
																									vErrors.push(
																										err18
																									);
																								}
																								errors++;
																							}
																							var _valid3 =
																								_errs87 ===
																								errors;
																							valid19 =
																								valid19 ||
																								_valid3;
																						}
																					}
																				}
																			}
																			if (
																				!valid19
																			) {
																				const err19 =
																					{
																						instancePath:
																							instancePath +
																							'/steps/' +
																							i4,
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
																							err19,
																						];
																				} else {
																					vErrors.push(
																						err19
																					);
																				}
																				errors++;
																				validate11.errors =
																					vErrors;
																				return false;
																			} else {
																				errors =
																					_errs79;
																				if (
																					vErrors !==
																					null
																				) {
																					if (
																						_errs79
																					) {
																						vErrors.length =
																							_errs79;
																					} else {
																						vErrors =
																							null;
																					}
																				}
																			}
																			var valid18 =
																				_errs78 ===
																				errors;
																			if (
																				!valid18
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
																	_errs76 ===
																	errors;
															} else {
																var valid0 = true;
															}
															if (valid0) {
																if (
																	data.$schema !==
																	undefined
																) {
																	const _errs89 =
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
																		_errs89 ===
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
