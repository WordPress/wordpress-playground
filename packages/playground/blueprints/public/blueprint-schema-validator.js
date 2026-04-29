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
				{ $ref: '#/definitions/SupportedPHPVersion' },
				{ $ref: '#/definitions/LegacyPHPVersion' },
			],
		},
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
						step: { type: 'string', const: 'loadPHPExtension' },
						source: {
							$ref: '#/definitions/FileReference',
							description:
								'The extension `.so` file or a compile-extension `manifest.json`.',
						},
						sourceFormat: {
							$ref: '#/definitions/PHPExtensionSourceFormat',
							description:
								'Defaults to "manifest" for `.json` files and "so" otherwise.',
						},
						name: {
							type: 'string',
							description:
								'Required when loading a `.so` file whose filename is not named after the extension.',
						},
						loadTiming: {
							$ref: '#/definitions/PHPExtensionLoadTiming',
							description: 'Defaults to "auto".',
						},
						loadWithIniDirective: {
							$ref: '#/definitions/PHPExtensionIniDirective',
							description:
								'Defaults to "extension". Use "zend_extension" for extensions like Xdebug.',
						},
						iniEntries: {
							type: 'object',
							additionalProperties: { type: 'string' },
							description:
								'Extra `php.ini` entries to write next to the extension.',
						},
						extraFiles: {
							$ref: '#/definitions/DirectoryReference',
							description:
								'Extra files required by the extension, such as ICU data or shared libraries.',
						},
						extraFilesPath: {
							type: 'string',
							description:
								'Where to write `extraFiles`. Defaults to an extension-specific assets directory.',
						},
						env: {
							type: 'object',
							additionalProperties: { type: 'string' },
							description:
								'Runtime environment variables needed by the extension.',
						},
						phpVersion: {
							type: 'string',
							description:
								'Overrides manifest artifact selection. Defaults to the running PHP version.',
						},
						asyncMode: {
							$ref: '#/definitions/PHPWasmAsyncMode',
							description:
								'Overrides manifest artifact selection. Defaults to the running async mode.',
						},
						manifestBaseUrl: {
							type: 'string',
							description:
								'Base URL for relative artifact paths in an inline or bundled manifest.',
						},
						extensionDir: {
							type: 'string',
							description:
								'Where to install the extension `.so` and `.ini` files.',
						},
					},
					required: ['source', 'step'],
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
				targetFolderName: {
					type: 'string',
					description:
						'The name of the folder to install the plugin to. Defaults to guessing from pluginData',
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
		PHPExtensionSourceFormat: { type: 'string', enum: ['so', 'manifest'] },
		PHPExtensionLoadTiming: {
			type: 'string',
			enum: ['before-php-startup', 'after-php-startup', 'auto'],
		},
		PHPExtensionIniDirective: {
			type: 'string',
			enum: ['extension', 'zend_extension'],
		},
		PHPWasmAsyncMode: { type: 'string', enum: ['jspi', 'asyncify'] },
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
const schema17 = { type: 'string', const: 'wp-cli' };
const schema18 = {
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
		{ $ref: '#/definitions/SupportedPHPVersion' },
		{ $ref: '#/definitions/LegacyPHPVersion' },
	],
};
const schema15 = {
	type: 'string',
	enum: ['8.5', '8.4', '8.3', '8.2', '8.1', '8.0', '7.4'],
};
const schema16 = { type: 'string', enum: ['5.2'] };
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
			schemaPath: '#/definitions/SupportedPHPVersion/type',
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
		const err1 = {
			instancePath,
			schemaPath: '#/definitions/SupportedPHPVersion/enum',
			keyword: 'enum',
			params: { allowedValues: schema15.enum },
			message: 'must be equal to one of the allowed values',
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
				schemaPath: '#/definitions/LegacyPHPVersion/type',
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
		if (!(data === '5.2')) {
			const err3 = {
				instancePath,
				schemaPath: '#/definitions/LegacyPHPVersion/enum',
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
const schema19 = {
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
const schema20 = {
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
const schema21 = {
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
const schema22 = {
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
const schema23 = {
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
const schema24 = {
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
const schema25 = {
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
const schema26 = {
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
const schema27 = {
	anyOf: [
		{ $ref: '#/definitions/GitDirectoryReference' },
		{ $ref: '#/definitions/DirectoryLiteralReference' },
	],
};
const schema28 = {
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
const schema29 = {
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
														schema29.enum,
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
const schema30 = {
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
const schema31 = {
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
								type: schema31.additionalProperties.anyOf[1]
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
const schema32 = {
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
				step: { type: 'string', const: 'loadPHPExtension' },
				source: {
					$ref: '#/definitions/FileReference',
					description:
						'The extension `.so` file or a compile-extension `manifest.json`.',
				},
				sourceFormat: {
					$ref: '#/definitions/PHPExtensionSourceFormat',
					description:
						'Defaults to "manifest" for `.json` files and "so" otherwise.',
				},
				name: {
					type: 'string',
					description:
						'Required when loading a `.so` file whose filename is not named after the extension.',
				},
				loadTiming: {
					$ref: '#/definitions/PHPExtensionLoadTiming',
					description: 'Defaults to "auto".',
				},
				loadWithIniDirective: {
					$ref: '#/definitions/PHPExtensionIniDirective',
					description:
						'Defaults to "extension". Use "zend_extension" for extensions like Xdebug.',
				},
				iniEntries: {
					type: 'object',
					additionalProperties: { type: 'string' },
					description:
						'Extra `php.ini` entries to write next to the extension.',
				},
				extraFiles: {
					$ref: '#/definitions/DirectoryReference',
					description:
						'Extra files required by the extension, such as ICU data or shared libraries.',
				},
				extraFilesPath: {
					type: 'string',
					description:
						'Where to write `extraFiles`. Defaults to an extension-specific assets directory.',
				},
				env: {
					type: 'object',
					additionalProperties: { type: 'string' },
					description:
						'Runtime environment variables needed by the extension.',
				},
				phpVersion: {
					type: 'string',
					description:
						'Overrides manifest artifact selection. Defaults to the running PHP version.',
				},
				asyncMode: {
					$ref: '#/definitions/PHPWasmAsyncMode',
					description:
						'Overrides manifest artifact selection. Defaults to the running async mode.',
				},
				manifestBaseUrl: {
					type: 'string',
					description:
						'Base URL for relative artifact paths in an inline or bundled manifest.',
				},
				extensionDir: {
					type: 'string',
					description:
						'Where to install the extension `.so` and `.ini` files.',
				},
			},
			required: ['source', 'step'],
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
const schema33 = {
	type: 'object',
	properties: {
		activate: {
			type: 'boolean',
			description: 'Whether to activate the plugin after installing it.',
		},
		targetFolderName: {
			type: 'string',
			description:
				'The name of the folder to install the plugin to. Defaults to guessing from pluginData',
		},
	},
	additionalProperties: false,
};
const schema34 = {
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
const schema35 = { type: 'string', enum: ['so', 'manifest'] };
const schema36 = {
	type: 'string',
	enum: ['before-php-startup', 'after-php-startup', 'auto'],
};
const schema37 = { type: 'string', enum: ['extension', 'zend_extension'] };
const schema38 = { type: 'string', enum: ['jspi', 'asyncify'] };
const schema45 = {
	type: 'object',
	properties: {
		adminUsername: { type: 'string' },
		adminPassword: { type: 'string' },
	},
	additionalProperties: false,
};
const schema39 = {
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
const schema40 = {
	type: 'string',
	enum: ['GET', 'POST', 'HEAD', 'OPTIONS', 'PATCH', 'PUT', 'DELETE'],
};
const schema41 = { type: 'object', additionalProperties: { type: 'string' } };
function validate39(
	data,
	{ instancePath = '', parentData, parentDataProperty, rootData = data } = {}
) {
	let vErrors = null;
	let errors = 0;
	if (errors === 0) {
		if (data && typeof data == 'object' && !Array.isArray(data)) {
			let missing0;
			if (data.url === undefined && (missing0 = 'url')) {
				validate39.errors = [
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
					if (data.method !== undefined) {
						let data0 = data.method;
						const _errs2 = errors;
						if (typeof data0 !== 'string') {
							validate39.errors = [
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
							validate39.errors = [
								{
									instancePath: instancePath + '/method',
									schemaPath: '#/definitions/HTTPMethod/enum',
									keyword: 'enum',
									params: { allowedValues: schema40.enum },
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
								validate39.errors = [
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
											var valid3 = _errs11 === errors;
											if (!valid3) {
												break;
											}
										}
									} else {
										validate39.errors = [
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
										validate39.errors = vErrors;
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
const schema42 = {
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
function validate41(
	data,
	{ instancePath = '', parentData, parentDataProperty, rootData = data } = {}
) {
	let vErrors = null;
	let errors = 0;
	if (errors === 0) {
		if (data && typeof data == 'object' && !Array.isArray(data)) {
			const _errs1 = errors;
			for (const key0 in data) {
				if (!func2.call(schema42.properties, key0)) {
					validate41.errors = [
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
						validate41.errors = [
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
							validate41.errors = [
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
								validate41.errors = [
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
									validate41.errors = [
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
									validate41.errors = [
										{
											instancePath:
												instancePath + '/method',
											schemaPath:
												'#/definitions/HTTPMethod/enum',
											keyword: 'enum',
											params: {
												allowedValues: schema40.enum,
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
													validate41.errors = [
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
											validate41.errors = [
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
											validate41.errors = vErrors;
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
															validate41.errors =
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
													validate41.errors = [
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
																validate41.errors =
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
														validate41.errors = [
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
														validate41.errors = [
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
			validate41.errors = [
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
	validate41.errors = vErrors;
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
																				schema32
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
																				schema32
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
																	schema32
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
																					data59.targetFolderName !==
																					undefined
																				) {
																					const _errs165 =
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
																						_errs165 ===
																						errors;
																				} else {
																					var valid34 = true;
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
						const _errs167 = errors;
						if (errors === _errs167) {
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
									const _errs169 = errors;
									for (const key22 in data) {
										if (
											!(
												key22 === 'progress' ||
												key22 ===
													'ifAlreadyInstalled' ||
												key22 === 'step' ||
												key22 === 'themeData' ||
												key22 === 'themeZipFile' ||
												key22 === 'options'
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
									if (_errs169 === errors) {
										if (data.progress !== undefined) {
											let data62 = data.progress;
											const _errs170 = errors;
											if (errors === _errs170) {
												if (
													data62 &&
													typeof data62 == 'object' &&
													!Array.isArray(data62)
												) {
													const _errs172 = errors;
													for (const key23 in data62) {
														if (
															!(
																key23 ===
																	'weight' ||
																key23 ===
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
													if (_errs172 === errors) {
														if (
															data62.weight !==
															undefined
														) {
															let data63 =
																data62.weight;
															const _errs173 =
																errors;
															if (
																!(
																	typeof data63 ==
																		'number' &&
																	isFinite(
																		data63
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
															var valid37 =
																_errs173 ===
																errors;
														} else {
															var valid37 = true;
														}
														if (valid37) {
															if (
																data62.caption !==
																undefined
															) {
																const _errs175 =
																	errors;
																if (
																	typeof data62.caption !==
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
																var valid37 =
																	_errs175 ===
																	errors;
															} else {
																var valid37 = true;
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
											var valid36 = _errs170 === errors;
										} else {
											var valid36 = true;
										}
										if (valid36) {
											if (
												data.ifAlreadyInstalled !==
												undefined
											) {
												let data65 =
													data.ifAlreadyInstalled;
												const _errs177 = errors;
												if (
													typeof data65 !== 'string'
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
														data65 ===
															'overwrite' ||
														data65 === 'skip' ||
														data65 === 'error'
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
																	schema32
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
												var valid36 =
													_errs177 === errors;
											} else {
												var valid36 = true;
											}
											if (valid36) {
												if (data.step !== undefined) {
													let data66 = data.step;
													const _errs179 = errors;
													if (
														typeof data66 !==
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
														data66
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
													var valid36 =
														_errs179 === errors;
												} else {
													var valid36 = true;
												}
												if (valid36) {
													if (
														data.themeData !==
														undefined
													) {
														let data67 =
															data.themeData;
														const _errs181 = errors;
														const _errs182 = errors;
														let valid38 = false;
														const _errs183 = errors;
														if (
															!validate16(
																data67,
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
															_errs183 === errors;
														valid38 =
															valid38 || _valid1;
														if (!valid38) {
															const _errs184 =
																errors;
															if (
																!validate18(
																	data67,
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
																_errs184 ===
																errors;
															valid38 =
																valid38 ||
																_valid1;
														}
														if (!valid38) {
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
															errors = _errs182;
															if (
																vErrors !== null
															) {
																if (_errs182) {
																	vErrors.length =
																		_errs182;
																} else {
																	vErrors =
																		null;
																}
															}
														}
														var valid36 =
															_errs181 === errors;
													} else {
														var valid36 = true;
													}
													if (valid36) {
														if (
															data.themeZipFile !==
															undefined
														) {
															const _errs185 =
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
															var valid36 =
																_errs185 ===
																errors;
														} else {
															var valid36 = true;
														}
														if (valid36) {
															if (
																data.options !==
																undefined
															) {
																let data69 =
																	data.options;
																const _errs186 =
																	errors;
																const _errs187 =
																	errors;
																if (
																	errors ===
																	_errs187
																) {
																	if (
																		data69 &&
																		typeof data69 ==
																			'object' &&
																		!Array.isArray(
																			data69
																		)
																	) {
																		const _errs189 =
																			errors;
																		for (const key24 in data69) {
																			if (
																				!(
																					key24 ===
																						'activate' ||
																					key24 ===
																						'importStarterContent' ||
																					key24 ===
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
																		if (
																			_errs189 ===
																			errors
																		) {
																			if (
																				data69.activate !==
																				undefined
																			) {
																				const _errs190 =
																					errors;
																				if (
																					typeof data69.activate !==
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
																				var valid40 =
																					_errs190 ===
																					errors;
																			} else {
																				var valid40 = true;
																			}
																			if (
																				valid40
																			) {
																				if (
																					data69.importStarterContent !==
																					undefined
																				) {
																					const _errs192 =
																						errors;
																					if (
																						typeof data69.importStarterContent !==
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
																					var valid40 =
																						_errs192 ===
																						errors;
																				} else {
																					var valid40 = true;
																				}
																				if (
																					valid40
																				) {
																					if (
																						data69.targetFolderName !==
																						undefined
																					) {
																						const _errs194 =
																							errors;
																						if (
																							typeof data69.targetFolderName !==
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
																						var valid40 =
																							_errs194 ===
																							errors;
																					} else {
																						var valid40 = true;
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
																var valid36 =
																	_errs186 ===
																	errors;
															} else {
																var valid36 = true;
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
					} else if (tag0 === 'loadPHPExtension') {
						const _errs196 = errors;
						if (errors === _errs196) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing12;
								if (
									(data.source === undefined &&
										(missing12 = 'source')) ||
									(data.step === undefined &&
										(missing12 = 'step'))
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
									const _errs198 = errors;
									for (const key25 in data) {
										if (
											!func2.call(
												schema32.oneOf[11].properties,
												key25
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
									if (_errs198 === errors) {
										if (data.progress !== undefined) {
											let data73 = data.progress;
											const _errs199 = errors;
											if (errors === _errs199) {
												if (
													data73 &&
													typeof data73 == 'object' &&
													!Array.isArray(data73)
												) {
													const _errs201 = errors;
													for (const key26 in data73) {
														if (
															!(
																key26 ===
																	'weight' ||
																key26 ===
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
													if (_errs201 === errors) {
														if (
															data73.weight !==
															undefined
														) {
															let data74 =
																data73.weight;
															const _errs202 =
																errors;
															if (
																!(
																	typeof data74 ==
																		'number' &&
																	isFinite(
																		data74
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
															var valid43 =
																_errs202 ===
																errors;
														} else {
															var valid43 = true;
														}
														if (valid43) {
															if (
																data73.caption !==
																undefined
															) {
																const _errs204 =
																	errors;
																if (
																	typeof data73.caption !==
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
																var valid43 =
																	_errs204 ===
																	errors;
															} else {
																var valid43 = true;
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
											var valid42 = _errs199 === errors;
										} else {
											var valid42 = true;
										}
										if (valid42) {
											if (data.step !== undefined) {
												let data76 = data.step;
												const _errs206 = errors;
												if (
													typeof data76 !== 'string'
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
												if (
													'loadPHPExtension' !==
													data76
												) {
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
																	'loadPHPExtension',
															},
															message:
																'must be equal to constant',
														},
													];
													return false;
												}
												var valid42 =
													_errs206 === errors;
											} else {
												var valid42 = true;
											}
											if (valid42) {
												if (data.source !== undefined) {
													const _errs208 = errors;
													if (
														!validate16(
															data.source,
															{
																instancePath:
																	instancePath +
																	'/source',
																parentData:
																	data,
																parentDataProperty:
																	'source',
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
													var valid42 =
														_errs208 === errors;
												} else {
													var valid42 = true;
												}
												if (valid42) {
													if (
														data.sourceFormat !==
														undefined
													) {
														let data78 =
															data.sourceFormat;
														const _errs209 = errors;
														if (
															typeof data78 !==
															'string'
														) {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/sourceFormat',
																		schemaPath:
																			'#/definitions/PHPExtensionSourceFormat/type',
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
																data78 ===
																	'so' ||
																data78 ===
																	'manifest'
															)
														) {
															validate28.errors =
																[
																	{
																		instancePath:
																			instancePath +
																			'/sourceFormat',
																		schemaPath:
																			'#/definitions/PHPExtensionSourceFormat/enum',
																		keyword:
																			'enum',
																		params: {
																			allowedValues:
																				schema35.enum,
																		},
																		message:
																			'must be equal to one of the allowed values',
																	},
																];
															return false;
														}
														var valid42 =
															_errs209 === errors;
													} else {
														var valid42 = true;
													}
													if (valid42) {
														if (
															data.name !==
															undefined
														) {
															const _errs212 =
																errors;
															if (
																typeof data.name !==
																'string'
															) {
																validate28.errors =
																	[
																		{
																			instancePath:
																				instancePath +
																				'/name',
																			schemaPath:
																				'#/oneOf/11/properties/name/type',
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
																_errs212 ===
																errors;
														} else {
															var valid42 = true;
														}
														if (valid42) {
															if (
																data.loadTiming !==
																undefined
															) {
																let data80 =
																	data.loadTiming;
																const _errs214 =
																	errors;
																if (
																	typeof data80 !==
																	'string'
																) {
																	validate28.errors =
																		[
																			{
																				instancePath:
																					instancePath +
																					'/loadTiming',
																				schemaPath:
																					'#/definitions/PHPExtensionLoadTiming/type',
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
																		data80 ===
																			'before-php-startup' ||
																		data80 ===
																			'after-php-startup' ||
																		data80 ===
																			'auto'
																	)
																) {
																	validate28.errors =
																		[
																			{
																				instancePath:
																					instancePath +
																					'/loadTiming',
																				schemaPath:
																					'#/definitions/PHPExtensionLoadTiming/enum',
																				keyword:
																					'enum',
																				params: {
																					allowedValues:
																						schema36.enum,
																				},
																				message:
																					'must be equal to one of the allowed values',
																			},
																		];
																	return false;
																}
																var valid42 =
																	_errs214 ===
																	errors;
															} else {
																var valid42 = true;
															}
															if (valid42) {
																if (
																	data.loadWithIniDirective !==
																	undefined
																) {
																	let data81 =
																		data.loadWithIniDirective;
																	const _errs217 =
																		errors;
																	if (
																		typeof data81 !==
																		'string'
																	) {
																		validate28.errors =
																			[
																				{
																					instancePath:
																						instancePath +
																						'/loadWithIniDirective',
																					schemaPath:
																						'#/definitions/PHPExtensionIniDirective/type',
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
																			data81 ===
																				'extension' ||
																			data81 ===
																				'zend_extension'
																		)
																	) {
																		validate28.errors =
																			[
																				{
																					instancePath:
																						instancePath +
																						'/loadWithIniDirective',
																					schemaPath:
																						'#/definitions/PHPExtensionIniDirective/enum',
																					keyword:
																						'enum',
																					params: {
																						allowedValues:
																							schema37.enum,
																					},
																					message:
																						'must be equal to one of the allowed values',
																				},
																			];
																		return false;
																	}
																	var valid42 =
																		_errs217 ===
																		errors;
																} else {
																	var valid42 = true;
																}
																if (valid42) {
																	if (
																		data.iniEntries !==
																		undefined
																	) {
																		let data82 =
																			data.iniEntries;
																		const _errs220 =
																			errors;
																		if (
																			errors ===
																			_errs220
																		) {
																			if (
																				data82 &&
																				typeof data82 ==
																					'object' &&
																				!Array.isArray(
																					data82
																				)
																			) {
																				for (const key27 in data82) {
																					const _errs223 =
																						errors;
																					if (
																						typeof data82[
																							key27
																						] !==
																						'string'
																					) {
																						validate28.errors =
																							[
																								{
																									instancePath:
																										instancePath +
																										'/iniEntries/' +
																										key27
																											.replace(
																												/~/g,
																												'~0'
																											)
																											.replace(
																												/\//g,
																												'~1'
																											),
																									schemaPath:
																										'#/oneOf/11/properties/iniEntries/additionalProperties/type',
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
																						_errs223 ===
																						errors;
																					if (
																						!valid47
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
																								'/iniEntries',
																							schemaPath:
																								'#/oneOf/11/properties/iniEntries/type',
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
																		var valid42 =
																			_errs220 ===
																			errors;
																	} else {
																		var valid42 = true;
																	}
																	if (
																		valid42
																	) {
																		if (
																			data.extraFiles !==
																			undefined
																		) {
																			const _errs225 =
																				errors;
																			if (
																				!validate18(
																					data.extraFiles,
																					{
																						instancePath:
																							instancePath +
																							'/extraFiles',
																						parentData:
																							data,
																						parentDataProperty:
																							'extraFiles',
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
																			var valid42 =
																				_errs225 ===
																				errors;
																		} else {
																			var valid42 = true;
																		}
																		if (
																			valid42
																		) {
																			if (
																				data.extraFilesPath !==
																				undefined
																			) {
																				const _errs226 =
																					errors;
																				if (
																					typeof data.extraFilesPath !==
																					'string'
																				) {
																					validate28.errors =
																						[
																							{
																								instancePath:
																									instancePath +
																									'/extraFilesPath',
																								schemaPath:
																									'#/oneOf/11/properties/extraFilesPath/type',
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
																					_errs226 ===
																					errors;
																			} else {
																				var valid42 = true;
																			}
																			if (
																				valid42
																			) {
																				if (
																					data.env !==
																					undefined
																				) {
																					let data86 =
																						data.env;
																					const _errs228 =
																						errors;
																					if (
																						errors ===
																						_errs228
																					) {
																						if (
																							data86 &&
																							typeof data86 ==
																								'object' &&
																							!Array.isArray(
																								data86
																							)
																						) {
																							for (const key28 in data86) {
																								const _errs231 =
																									errors;
																								if (
																									typeof data86[
																										key28
																									] !==
																									'string'
																								) {
																									validate28.errors =
																										[
																											{
																												instancePath:
																													instancePath +
																													'/env/' +
																													key28
																														.replace(
																															/~/g,
																															'~0'
																														)
																														.replace(
																															/\//g,
																															'~1'
																														),
																												schemaPath:
																													'#/oneOf/11/properties/env/additionalProperties/type',
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
																									_errs231 ===
																									errors;
																								if (
																									!valid48
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
																											'/env',
																										schemaPath:
																											'#/oneOf/11/properties/env/type',
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
																					var valid42 =
																						_errs228 ===
																						errors;
																				} else {
																					var valid42 = true;
																				}
																				if (
																					valid42
																				) {
																					if (
																						data.phpVersion !==
																						undefined
																					) {
																						const _errs233 =
																							errors;
																						if (
																							typeof data.phpVersion !==
																							'string'
																						) {
																							validate28.errors =
																								[
																									{
																										instancePath:
																											instancePath +
																											'/phpVersion',
																										schemaPath:
																											'#/oneOf/11/properties/phpVersion/type',
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
																							_errs233 ===
																							errors;
																					} else {
																						var valid42 = true;
																					}
																					if (
																						valid42
																					) {
																						if (
																							data.asyncMode !==
																							undefined
																						) {
																							let data89 =
																								data.asyncMode;
																							const _errs235 =
																								errors;
																							if (
																								typeof data89 !==
																								'string'
																							) {
																								validate28.errors =
																									[
																										{
																											instancePath:
																												instancePath +
																												'/asyncMode',
																											schemaPath:
																												'#/definitions/PHPWasmAsyncMode/type',
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
																									data89 ===
																										'jspi' ||
																									data89 ===
																										'asyncify'
																								)
																							) {
																								validate28.errors =
																									[
																										{
																											instancePath:
																												instancePath +
																												'/asyncMode',
																											schemaPath:
																												'#/definitions/PHPWasmAsyncMode/enum',
																											keyword:
																												'enum',
																											params: {
																												allowedValues:
																													schema38.enum,
																											},
																											message:
																												'must be equal to one of the allowed values',
																										},
																									];
																								return false;
																							}
																							var valid42 =
																								_errs235 ===
																								errors;
																						} else {
																							var valid42 = true;
																						}
																						if (
																							valid42
																						) {
																							if (
																								data.manifestBaseUrl !==
																								undefined
																							) {
																								const _errs238 =
																									errors;
																								if (
																									typeof data.manifestBaseUrl !==
																									'string'
																								) {
																									validate28.errors =
																										[
																											{
																												instancePath:
																													instancePath +
																													'/manifestBaseUrl',
																												schemaPath:
																													'#/oneOf/11/properties/manifestBaseUrl/type',
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
																									_errs238 ===
																									errors;
																							} else {
																								var valid42 = true;
																							}
																							if (
																								valid42
																							) {
																								if (
																									data.extensionDir !==
																									undefined
																								) {
																									const _errs240 =
																										errors;
																									if (
																										typeof data.extensionDir !==
																										'string'
																									) {
																										validate28.errors =
																											[
																												{
																													instancePath:
																														instancePath +
																														'/extensionDir',
																													schemaPath:
																														'#/oneOf/11/properties/extensionDir/type',
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
																										_errs240 ===
																										errors;
																								} else {
																									var valid42 = true;
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
					} else if (tag0 === 'login') {
						const _errs242 = errors;
						if (errors === _errs242) {
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
									const _errs244 = errors;
									for (const key29 in data) {
										if (
											!(
												key29 === 'progress' ||
												key29 === 'step' ||
												key29 === 'username' ||
												key29 === 'password'
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
									if (_errs244 === errors) {
										if (data.progress !== undefined) {
											let data92 = data.progress;
											const _errs245 = errors;
											if (errors === _errs245) {
												if (
													data92 &&
													typeof data92 == 'object' &&
													!Array.isArray(data92)
												) {
													const _errs247 = errors;
													for (const key30 in data92) {
														if (
															!(
																key30 ===
																	'weight' ||
																key30 ===
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
													if (_errs247 === errors) {
														if (
															data92.weight !==
															undefined
														) {
															let data93 =
																data92.weight;
															const _errs248 =
																errors;
															if (
																!(
																	typeof data93 ==
																		'number' &&
																	isFinite(
																		data93
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
															var valid52 =
																_errs248 ===
																errors;
														} else {
															var valid52 = true;
														}
														if (valid52) {
															if (
																data92.caption !==
																undefined
															) {
																const _errs250 =
																	errors;
																if (
																	typeof data92.caption !==
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
																var valid52 =
																	_errs250 ===
																	errors;
															} else {
																var valid52 = true;
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
											var valid51 = _errs245 === errors;
										} else {
											var valid51 = true;
										}
										if (valid51) {
											if (data.step !== undefined) {
												let data95 = data.step;
												const _errs252 = errors;
												if (
													typeof data95 !== 'string'
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
												if ('login' !== data95) {
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
																	'login',
															},
															message:
																'must be equal to constant',
														},
													];
													return false;
												}
												var valid51 =
													_errs252 === errors;
											} else {
												var valid51 = true;
											}
											if (valid51) {
												if (
													data.username !== undefined
												) {
													const _errs254 = errors;
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
																	'#/oneOf/12/properties/username/type',
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
													var valid51 =
														_errs254 === errors;
												} else {
													var valid51 = true;
												}
												if (valid51) {
													if (
														data.password !==
														undefined
													) {
														const _errs256 = errors;
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
																			'#/oneOf/12/properties/password/type',
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
															_errs256 === errors;
													} else {
														var valid51 = true;
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
										schemaPath: '#/oneOf/12/type',
										keyword: 'type',
										params: { type: 'object' },
										message: 'must be object',
									},
								];
								return false;
							}
						}
					} else if (tag0 === 'mkdir') {
						const _errs258 = errors;
						if (errors === _errs258) {
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
									const _errs260 = errors;
									for (const key31 in data) {
										if (
											!(
												key31 === 'progress' ||
												key31 === 'step' ||
												key31 === 'path'
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
									if (_errs260 === errors) {
										if (data.progress !== undefined) {
											let data98 = data.progress;
											const _errs261 = errors;
											if (errors === _errs261) {
												if (
													data98 &&
													typeof data98 == 'object' &&
													!Array.isArray(data98)
												) {
													const _errs263 = errors;
													for (const key32 in data98) {
														if (
															!(
																key32 ===
																	'weight' ||
																key32 ===
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
													if (_errs263 === errors) {
														if (
															data98.weight !==
															undefined
														) {
															let data99 =
																data98.weight;
															const _errs264 =
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
															var valid55 =
																_errs264 ===
																errors;
														} else {
															var valid55 = true;
														}
														if (valid55) {
															if (
																data98.caption !==
																undefined
															) {
																const _errs266 =
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
																var valid55 =
																	_errs266 ===
																	errors;
															} else {
																var valid55 = true;
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
											var valid54 = _errs261 === errors;
										} else {
											var valid54 = true;
										}
										if (valid54) {
											if (data.step !== undefined) {
												let data101 = data.step;
												const _errs268 = errors;
												if (
													typeof data101 !== 'string'
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
												if ('mkdir' !== data101) {
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
																	'mkdir',
															},
															message:
																'must be equal to constant',
														},
													];
													return false;
												}
												var valid54 =
													_errs268 === errors;
											} else {
												var valid54 = true;
											}
											if (valid54) {
												if (data.path !== undefined) {
													const _errs270 = errors;
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
																	'#/oneOf/13/properties/path/type',
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
													var valid54 =
														_errs270 === errors;
												} else {
													var valid54 = true;
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
					} else if (tag0 === 'mv') {
						const _errs272 = errors;
						if (errors === _errs272) {
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
									const _errs274 = errors;
									for (const key33 in data) {
										if (
											!(
												key33 === 'progress' ||
												key33 === 'step' ||
												key33 === 'fromPath' ||
												key33 === 'toPath'
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
									if (_errs274 === errors) {
										if (data.progress !== undefined) {
											let data103 = data.progress;
											const _errs275 = errors;
											if (errors === _errs275) {
												if (
													data103 &&
													typeof data103 ==
														'object' &&
													!Array.isArray(data103)
												) {
													const _errs277 = errors;
													for (const key34 in data103) {
														if (
															!(
																key34 ===
																	'weight' ||
																key34 ===
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
													if (_errs277 === errors) {
														if (
															data103.weight !==
															undefined
														) {
															let data104 =
																data103.weight;
															const _errs278 =
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
															var valid58 =
																_errs278 ===
																errors;
														} else {
															var valid58 = true;
														}
														if (valid58) {
															if (
																data103.caption !==
																undefined
															) {
																const _errs280 =
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
																var valid58 =
																	_errs280 ===
																	errors;
															} else {
																var valid58 = true;
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
											var valid57 = _errs275 === errors;
										} else {
											var valid57 = true;
										}
										if (valid57) {
											if (data.step !== undefined) {
												let data106 = data.step;
												const _errs282 = errors;
												if (
													typeof data106 !== 'string'
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
												if ('mv' !== data106) {
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
																	'mv',
															},
															message:
																'must be equal to constant',
														},
													];
													return false;
												}
												var valid57 =
													_errs282 === errors;
											} else {
												var valid57 = true;
											}
											if (valid57) {
												if (
													data.fromPath !== undefined
												) {
													const _errs284 = errors;
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
																	'#/oneOf/14/properties/fromPath/type',
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
													var valid57 =
														_errs284 === errors;
												} else {
													var valid57 = true;
												}
												if (valid57) {
													if (
														data.toPath !==
														undefined
													) {
														const _errs286 = errors;
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
																			'#/oneOf/14/properties/toPath/type',
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
															_errs286 === errors;
													} else {
														var valid57 = true;
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
										schemaPath: '#/oneOf/14/type',
										keyword: 'type',
										params: { type: 'object' },
										message: 'must be object',
									},
								];
								return false;
							}
						}
					} else if (tag0 === 'resetData') {
						const _errs288 = errors;
						if (errors === _errs288) {
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
									const _errs290 = errors;
									for (const key35 in data) {
										if (
											!(
												key35 === 'progress' ||
												key35 === 'step'
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
									if (_errs290 === errors) {
										if (data.progress !== undefined) {
											let data109 = data.progress;
											const _errs291 = errors;
											if (errors === _errs291) {
												if (
													data109 &&
													typeof data109 ==
														'object' &&
													!Array.isArray(data109)
												) {
													const _errs293 = errors;
													for (const key36 in data109) {
														if (
															!(
																key36 ===
																	'weight' ||
																key36 ===
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
													if (_errs293 === errors) {
														if (
															data109.weight !==
															undefined
														) {
															let data110 =
																data109.weight;
															const _errs294 =
																errors;
															if (
																!(
																	typeof data110 ==
																		'number' &&
																	isFinite(
																		data110
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
															var valid61 =
																_errs294 ===
																errors;
														} else {
															var valid61 = true;
														}
														if (valid61) {
															if (
																data109.caption !==
																undefined
															) {
																const _errs296 =
																	errors;
																if (
																	typeof data109.caption !==
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
																var valid61 =
																	_errs296 ===
																	errors;
															} else {
																var valid61 = true;
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
											var valid60 = _errs291 === errors;
										} else {
											var valid60 = true;
										}
										if (valid60) {
											if (data.step !== undefined) {
												let data112 = data.step;
												const _errs298 = errors;
												if (
													typeof data112 !== 'string'
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
												if ('resetData' !== data112) {
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
																	'resetData',
															},
															message:
																'must be equal to constant',
														},
													];
													return false;
												}
												var valid60 =
													_errs298 === errors;
											} else {
												var valid60 = true;
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
					} else if (tag0 === 'request') {
						const _errs300 = errors;
						if (errors === _errs300) {
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
									const _errs302 = errors;
									for (const key37 in data) {
										if (
											!(
												key37 === 'progress' ||
												key37 === 'step' ||
												key37 === 'request'
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
									if (_errs302 === errors) {
										if (data.progress !== undefined) {
											let data113 = data.progress;
											const _errs303 = errors;
											if (errors === _errs303) {
												if (
													data113 &&
													typeof data113 ==
														'object' &&
													!Array.isArray(data113)
												) {
													const _errs305 = errors;
													for (const key38 in data113) {
														if (
															!(
																key38 ===
																	'weight' ||
																key38 ===
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
													if (_errs305 === errors) {
														if (
															data113.weight !==
															undefined
														) {
															let data114 =
																data113.weight;
															const _errs306 =
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
															var valid64 =
																_errs306 ===
																errors;
														} else {
															var valid64 = true;
														}
														if (valid64) {
															if (
																data113.caption !==
																undefined
															) {
																const _errs308 =
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
																var valid64 =
																	_errs308 ===
																	errors;
															} else {
																var valid64 = true;
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
											var valid63 = _errs303 === errors;
										} else {
											var valid63 = true;
										}
										if (valid63) {
											if (data.step !== undefined) {
												let data116 = data.step;
												const _errs310 = errors;
												if (
													typeof data116 !== 'string'
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
												if ('request' !== data116) {
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
																	'request',
															},
															message:
																'must be equal to constant',
														},
													];
													return false;
												}
												var valid63 =
													_errs310 === errors;
											} else {
												var valid63 = true;
											}
											if (valid63) {
												if (
													data.request !== undefined
												) {
													const _errs312 = errors;
													if (
														!validate39(
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
																? validate39.errors
																: vErrors.concat(
																		validate39.errors
																	);
														errors = vErrors.length;
													}
													var valid63 =
														_errs312 === errors;
												} else {
													var valid63 = true;
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
					} else if (tag0 === 'rm') {
						const _errs313 = errors;
						if (errors === _errs313) {
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
									const _errs315 = errors;
									for (const key39 in data) {
										if (
											!(
												key39 === 'progress' ||
												key39 === 'step' ||
												key39 === 'path'
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
									if (_errs315 === errors) {
										if (data.progress !== undefined) {
											let data118 = data.progress;
											const _errs316 = errors;
											if (errors === _errs316) {
												if (
													data118 &&
													typeof data118 ==
														'object' &&
													!Array.isArray(data118)
												) {
													const _errs318 = errors;
													for (const key40 in data118) {
														if (
															!(
																key40 ===
																	'weight' ||
																key40 ===
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
													if (_errs318 === errors) {
														if (
															data118.weight !==
															undefined
														) {
															let data119 =
																data118.weight;
															const _errs319 =
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
															var valid67 =
																_errs319 ===
																errors;
														} else {
															var valid67 = true;
														}
														if (valid67) {
															if (
																data118.caption !==
																undefined
															) {
																const _errs321 =
																	errors;
																if (
																	typeof data118.caption !==
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
																var valid67 =
																	_errs321 ===
																	errors;
															} else {
																var valid67 = true;
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
											var valid66 = _errs316 === errors;
										} else {
											var valid66 = true;
										}
										if (valid66) {
											if (data.step !== undefined) {
												let data121 = data.step;
												const _errs323 = errors;
												if (
													typeof data121 !== 'string'
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
												if ('rm' !== data121) {
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
																	'rm',
															},
															message:
																'must be equal to constant',
														},
													];
													return false;
												}
												var valid66 =
													_errs323 === errors;
											} else {
												var valid66 = true;
											}
											if (valid66) {
												if (data.path !== undefined) {
													const _errs325 = errors;
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
													var valid66 =
														_errs325 === errors;
												} else {
													var valid66 = true;
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
					} else if (tag0 === 'rmdir') {
						const _errs327 = errors;
						if (errors === _errs327) {
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
									const _errs329 = errors;
									for (const key41 in data) {
										if (
											!(
												key41 === 'progress' ||
												key41 === 'step' ||
												key41 === 'path'
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
									if (_errs329 === errors) {
										if (data.progress !== undefined) {
											let data123 = data.progress;
											const _errs330 = errors;
											if (errors === _errs330) {
												if (
													data123 &&
													typeof data123 ==
														'object' &&
													!Array.isArray(data123)
												) {
													const _errs332 = errors;
													for (const key42 in data123) {
														if (
															!(
																key42 ===
																	'weight' ||
																key42 ===
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
													if (_errs332 === errors) {
														if (
															data123.weight !==
															undefined
														) {
															let data124 =
																data123.weight;
															const _errs333 =
																errors;
															if (
																!(
																	typeof data124 ==
																		'number' &&
																	isFinite(
																		data124
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
															var valid70 =
																_errs333 ===
																errors;
														} else {
															var valid70 = true;
														}
														if (valid70) {
															if (
																data123.caption !==
																undefined
															) {
																const _errs335 =
																	errors;
																if (
																	typeof data123.caption !==
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
																var valid70 =
																	_errs335 ===
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
											var valid69 = _errs330 === errors;
										} else {
											var valid69 = true;
										}
										if (valid69) {
											if (data.step !== undefined) {
												let data126 = data.step;
												const _errs337 = errors;
												if (
													typeof data126 !== 'string'
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
												if ('rmdir' !== data126) {
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
																	'rmdir',
															},
															message:
																'must be equal to constant',
														},
													];
													return false;
												}
												var valid69 =
													_errs337 === errors;
											} else {
												var valid69 = true;
											}
											if (valid69) {
												if (data.path !== undefined) {
													const _errs339 = errors;
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
																	'#/oneOf/18/properties/path/type',
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
													var valid69 =
														_errs339 === errors;
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
										schemaPath: '#/oneOf/18/type',
										keyword: 'type',
										params: { type: 'object' },
										message: 'must be object',
									},
								];
								return false;
							}
						}
					} else if (tag0 === 'runPHP') {
						const _errs341 = errors;
						if (errors === _errs341) {
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
									validate28.errors = [
										{
											instancePath,
											schemaPath: '#/oneOf/19/required',
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
									const _errs343 = errors;
									for (const key43 in data) {
										if (
											!(
												key43 === 'progress' ||
												key43 === 'step' ||
												key43 === 'code'
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
									if (_errs343 === errors) {
										if (data.progress !== undefined) {
											let data128 = data.progress;
											const _errs344 = errors;
											if (errors === _errs344) {
												if (
													data128 &&
													typeof data128 ==
														'object' &&
													!Array.isArray(data128)
												) {
													const _errs346 = errors;
													for (const key44 in data128) {
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
													if (_errs346 === errors) {
														if (
															data128.weight !==
															undefined
														) {
															let data129 =
																data128.weight;
															const _errs347 =
																errors;
															if (
																!(
																	typeof data129 ==
																		'number' &&
																	isFinite(
																		data129
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
															var valid73 =
																_errs347 ===
																errors;
														} else {
															var valid73 = true;
														}
														if (valid73) {
															if (
																data128.caption !==
																undefined
															) {
																const _errs349 =
																	errors;
																if (
																	typeof data128.caption !==
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
																var valid73 =
																	_errs349 ===
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
											var valid72 = _errs344 === errors;
										} else {
											var valid72 = true;
										}
										if (valid72) {
											if (data.step !== undefined) {
												let data131 = data.step;
												const _errs351 = errors;
												if (
													typeof data131 !== 'string'
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
												if ('runPHP' !== data131) {
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
																	'runPHP',
															},
															message:
																'must be equal to constant',
														},
													];
													return false;
												}
												var valid72 =
													_errs351 === errors;
											} else {
												var valid72 = true;
											}
											if (valid72) {
												if (data.code !== undefined) {
													let data132 = data.code;
													const _errs353 = errors;
													const _errs354 = errors;
													let valid74 = false;
													const _errs355 = errors;
													if (
														typeof data132 !==
														'string'
													) {
														const err2 = {
															instancePath:
																instancePath +
																'/code',
															schemaPath:
																'#/oneOf/19/properties/code/anyOf/0/type',
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
														_errs355 === errors;
													valid74 =
														valid74 || _valid2;
													if (!valid74) {
														const _errs357 = errors;
														if (
															errors === _errs357
														) {
															if (
																data132 &&
																typeof data132 ==
																	'object' &&
																!Array.isArray(
																	data132
																)
															) {
																let missing21;
																if (
																	(data132.filename ===
																		undefined &&
																		(missing21 =
																			'filename')) ||
																	(data132.content ===
																		undefined &&
																		(missing21 =
																			'content'))
																) {
																	const err3 =
																		{
																			instancePath:
																				instancePath +
																				'/code',
																			schemaPath:
																				'#/oneOf/19/properties/code/anyOf/1/required',
																			keyword:
																				'required',
																			params: {
																				missingProperty:
																					missing21,
																			},
																			message:
																				"must have required property '" +
																				missing21 +
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
																	const _errs359 =
																		errors;
																	for (const key45 in data132) {
																		if (
																			!(
																				key45 ===
																					'filename' ||
																				key45 ===
																					'content'
																			)
																		) {
																			const err4 =
																				{
																					instancePath:
																						instancePath +
																						'/code',
																					schemaPath:
																						'#/oneOf/19/properties/code/anyOf/1/additionalProperties',
																					keyword:
																						'additionalProperties',
																					params: {
																						additionalProperty:
																							key45,
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
																		_errs359 ===
																		errors
																	) {
																		if (
																			data132.filename !==
																			undefined
																		) {
																			const _errs360 =
																				errors;
																			if (
																				typeof data132.filename !==
																				'string'
																			) {
																				const err5 =
																					{
																						instancePath:
																							instancePath +
																							'/code/filename',
																						schemaPath:
																							'#/oneOf/19/properties/code/anyOf/1/properties/filename/type',
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
																			var valid75 =
																				_errs360 ===
																				errors;
																		} else {
																			var valid75 = true;
																		}
																		if (
																			valid75
																		) {
																			if (
																				data132.content !==
																				undefined
																			) {
																				const _errs362 =
																					errors;
																				if (
																					typeof data132.content !==
																					'string'
																				) {
																					const err6 =
																						{
																							instancePath:
																								instancePath +
																								'/code/content',
																							schemaPath:
																								'#/oneOf/19/properties/code/anyOf/1/properties/content/type',
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
																				var valid75 =
																					_errs362 ===
																					errors;
																			} else {
																				var valid75 = true;
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
																		'#/oneOf/19/properties/code/anyOf/1/type',
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
															_errs357 === errors;
														valid74 =
															valid74 || _valid2;
													}
													if (!valid74) {
														const err8 = {
															instancePath:
																instancePath +
																'/code',
															schemaPath:
																'#/oneOf/19/properties/code/anyOf',
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
														errors = _errs354;
														if (vErrors !== null) {
															if (_errs354) {
																vErrors.length =
																	_errs354;
															} else {
																vErrors = null;
															}
														}
													}
													var valid72 =
														_errs353 === errors;
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
										schemaPath: '#/oneOf/19/type',
										keyword: 'type',
										params: { type: 'object' },
										message: 'must be object',
									},
								];
								return false;
							}
						}
					} else if (tag0 === 'runPHPWithOptions') {
						const _errs364 = errors;
						if (errors === _errs364) {
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
									const _errs366 = errors;
									for (const key46 in data) {
										if (
											!(
												key46 === 'progress' ||
												key46 === 'step' ||
												key46 === 'options'
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
									if (_errs366 === errors) {
										if (data.progress !== undefined) {
											let data135 = data.progress;
											const _errs367 = errors;
											if (errors === _errs367) {
												if (
													data135 &&
													typeof data135 ==
														'object' &&
													!Array.isArray(data135)
												) {
													const _errs369 = errors;
													for (const key47 in data135) {
														if (
															!(
																key47 ===
																	'weight' ||
																key47 ===
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
													if (_errs369 === errors) {
														if (
															data135.weight !==
															undefined
														) {
															let data136 =
																data135.weight;
															const _errs370 =
																errors;
															if (
																!(
																	typeof data136 ==
																		'number' &&
																	isFinite(
																		data136
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
															var valid78 =
																_errs370 ===
																errors;
														} else {
															var valid78 = true;
														}
														if (valid78) {
															if (
																data135.caption !==
																undefined
															) {
																const _errs372 =
																	errors;
																if (
																	typeof data135.caption !==
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
																var valid78 =
																	_errs372 ===
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
											var valid77 = _errs367 === errors;
										} else {
											var valid77 = true;
										}
										if (valid77) {
											if (data.step !== undefined) {
												let data138 = data.step;
												const _errs374 = errors;
												if (
													typeof data138 !== 'string'
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
													'runPHPWithOptions' !==
													data138
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
																	'runPHPWithOptions',
															},
															message:
																'must be equal to constant',
														},
													];
													return false;
												}
												var valid77 =
													_errs374 === errors;
											} else {
												var valid77 = true;
											}
											if (valid77) {
												if (
													data.options !== undefined
												) {
													const _errs376 = errors;
													if (
														!validate41(
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
																? validate41.errors
																: vErrors.concat(
																		validate41.errors
																	);
														errors = vErrors.length;
													}
													var valid77 =
														_errs376 === errors;
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
										schemaPath: '#/oneOf/20/type',
										keyword: 'type',
										params: { type: 'object' },
										message: 'must be object',
									},
								];
								return false;
							}
						}
					} else if (tag0 === 'runWpInstallationWizard') {
						const _errs377 = errors;
						if (errors === _errs377) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing23;
								if (
									(data.options === undefined &&
										(missing23 = 'options')) ||
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
									const _errs379 = errors;
									for (const key48 in data) {
										if (
											!(
												key48 === 'progress' ||
												key48 === 'step' ||
												key48 === 'options'
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
									if (_errs379 === errors) {
										if (data.progress !== undefined) {
											let data140 = data.progress;
											const _errs380 = errors;
											if (errors === _errs380) {
												if (
													data140 &&
													typeof data140 ==
														'object' &&
													!Array.isArray(data140)
												) {
													const _errs382 = errors;
													for (const key49 in data140) {
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
													if (_errs382 === errors) {
														if (
															data140.weight !==
															undefined
														) {
															let data141 =
																data140.weight;
															const _errs383 =
																errors;
															if (
																!(
																	typeof data141 ==
																		'number' &&
																	isFinite(
																		data141
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
															var valid81 =
																_errs383 ===
																errors;
														} else {
															var valid81 = true;
														}
														if (valid81) {
															if (
																data140.caption !==
																undefined
															) {
																const _errs385 =
																	errors;
																if (
																	typeof data140.caption !==
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
																var valid81 =
																	_errs385 ===
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
											var valid80 = _errs380 === errors;
										} else {
											var valid80 = true;
										}
										if (valid80) {
											if (data.step !== undefined) {
												let data143 = data.step;
												const _errs387 = errors;
												if (
													typeof data143 !== 'string'
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
												if (
													'runWpInstallationWizard' !==
													data143
												) {
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
																	'runWpInstallationWizard',
															},
															message:
																'must be equal to constant',
														},
													];
													return false;
												}
												var valid80 =
													_errs387 === errors;
											} else {
												var valid80 = true;
											}
											if (valid80) {
												if (
													data.options !== undefined
												) {
													let data144 = data.options;
													const _errs389 = errors;
													const _errs390 = errors;
													if (errors === _errs390) {
														if (
															data144 &&
															typeof data144 ==
																'object' &&
															!Array.isArray(
																data144
															)
														) {
															const _errs392 =
																errors;
															for (const key50 in data144) {
																if (
																	!(
																		key50 ===
																			'adminUsername' ||
																		key50 ===
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
															if (
																_errs392 ===
																errors
															) {
																if (
																	data144.adminUsername !==
																	undefined
																) {
																	const _errs393 =
																		errors;
																	if (
																		typeof data144.adminUsername !==
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
																	var valid83 =
																		_errs393 ===
																		errors;
																} else {
																	var valid83 = true;
																}
																if (valid83) {
																	if (
																		data144.adminPassword !==
																		undefined
																	) {
																		const _errs395 =
																			errors;
																		if (
																			typeof data144.adminPassword !==
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
																		var valid83 =
																			_errs395 ===
																			errors;
																	} else {
																		var valid83 = true;
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
													var valid80 =
														_errs389 === errors;
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
										schemaPath: '#/oneOf/21/type',
										keyword: 'type',
										params: { type: 'object' },
										message: 'must be object',
									},
								];
								return false;
							}
						}
					} else if (tag0 === 'runSql') {
						const _errs397 = errors;
						if (errors === _errs397) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing24;
								if (
									(data.sql === undefined &&
										(missing24 = 'sql')) ||
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
									const _errs399 = errors;
									for (const key51 in data) {
										if (
											!(
												key51 === 'progress' ||
												key51 === 'step' ||
												key51 === 'sql'
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
									if (_errs399 === errors) {
										if (data.progress !== undefined) {
											let data147 = data.progress;
											const _errs400 = errors;
											if (errors === _errs400) {
												if (
													data147 &&
													typeof data147 ==
														'object' &&
													!Array.isArray(data147)
												) {
													const _errs402 = errors;
													for (const key52 in data147) {
														if (
															!(
																key52 ===
																	'weight' ||
																key52 ===
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
													if (_errs402 === errors) {
														if (
															data147.weight !==
															undefined
														) {
															let data148 =
																data147.weight;
															const _errs403 =
																errors;
															if (
																!(
																	typeof data148 ==
																		'number' &&
																	isFinite(
																		data148
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
															var valid86 =
																_errs403 ===
																errors;
														} else {
															var valid86 = true;
														}
														if (valid86) {
															if (
																data147.caption !==
																undefined
															) {
																const _errs405 =
																	errors;
																if (
																	typeof data147.caption !==
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
																var valid86 =
																	_errs405 ===
																	errors;
															} else {
																var valid86 = true;
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
											var valid85 = _errs400 === errors;
										} else {
											var valid85 = true;
										}
										if (valid85) {
											if (data.step !== undefined) {
												let data150 = data.step;
												const _errs407 = errors;
												if (
													typeof data150 !== 'string'
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
												if ('runSql' !== data150) {
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
																	'runSql',
															},
															message:
																'must be equal to constant',
														},
													];
													return false;
												}
												var valid85 =
													_errs407 === errors;
											} else {
												var valid85 = true;
											}
											if (valid85) {
												if (data.sql !== undefined) {
													const _errs409 = errors;
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
													var valid85 =
														_errs409 === errors;
												} else {
													var valid85 = true;
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
					} else if (tag0 === 'setSiteOptions') {
						const _errs410 = errors;
						if (errors === _errs410) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing25;
								if (
									(data.options === undefined &&
										(missing25 = 'options')) ||
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
									const _errs412 = errors;
									for (const key53 in data) {
										if (
											!(
												key53 === 'progress' ||
												key53 === 'step' ||
												key53 === 'options'
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
									if (_errs412 === errors) {
										if (data.progress !== undefined) {
											let data152 = data.progress;
											const _errs413 = errors;
											if (errors === _errs413) {
												if (
													data152 &&
													typeof data152 ==
														'object' &&
													!Array.isArray(data152)
												) {
													const _errs415 = errors;
													for (const key54 in data152) {
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
													if (_errs415 === errors) {
														if (
															data152.weight !==
															undefined
														) {
															let data153 =
																data152.weight;
															const _errs416 =
																errors;
															if (
																!(
																	typeof data153 ==
																		'number' &&
																	isFinite(
																		data153
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
															var valid89 =
																_errs416 ===
																errors;
														} else {
															var valid89 = true;
														}
														if (valid89) {
															if (
																data152.caption !==
																undefined
															) {
																const _errs418 =
																	errors;
																if (
																	typeof data152.caption !==
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
																var valid89 =
																	_errs418 ===
																	errors;
															} else {
																var valid89 = true;
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
											var valid88 = _errs413 === errors;
										} else {
											var valid88 = true;
										}
										if (valid88) {
											if (data.step !== undefined) {
												let data155 = data.step;
												const _errs420 = errors;
												if (
													typeof data155 !== 'string'
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
												if (
													'setSiteOptions' !== data155
												) {
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
																	'setSiteOptions',
															},
															message:
																'must be equal to constant',
														},
													];
													return false;
												}
												var valid88 =
													_errs420 === errors;
											} else {
												var valid88 = true;
											}
											if (valid88) {
												if (
													data.options !== undefined
												) {
													let data156 = data.options;
													const _errs422 = errors;
													if (errors === _errs422) {
														if (
															data156 &&
															typeof data156 ==
																'object' &&
															!Array.isArray(
																data156
															)
														) {
															for (const key55 in data156) {
																const _errs425 =
																	errors;
																var valid90 =
																	_errs425 ===
																	errors;
																if (!valid90) {
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
																			'#/oneOf/23/properties/options/type',
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
													var valid88 =
														_errs422 === errors;
												} else {
													var valid88 = true;
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
					} else if (tag0 === 'unzip') {
						const _errs426 = errors;
						if (errors === _errs426) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing26;
								if (
									(data.extractToPath === undefined &&
										(missing26 = 'extractToPath')) ||
									(data.step === undefined &&
										(missing26 = 'step'))
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
									const _errs428 = errors;
									for (const key56 in data) {
										if (
											!(
												key56 === 'progress' ||
												key56 === 'step' ||
												key56 === 'zipFile' ||
												key56 === 'zipPath' ||
												key56 === 'extractToPath'
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
									if (_errs428 === errors) {
										if (data.progress !== undefined) {
											let data158 = data.progress;
											const _errs429 = errors;
											if (errors === _errs429) {
												if (
													data158 &&
													typeof data158 ==
														'object' &&
													!Array.isArray(data158)
												) {
													const _errs431 = errors;
													for (const key57 in data158) {
														if (
															!(
																key57 ===
																	'weight' ||
																key57 ===
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
													if (_errs431 === errors) {
														if (
															data158.weight !==
															undefined
														) {
															let data159 =
																data158.weight;
															const _errs432 =
																errors;
															if (
																!(
																	typeof data159 ==
																		'number' &&
																	isFinite(
																		data159
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
															var valid93 =
																_errs432 ===
																errors;
														} else {
															var valid93 = true;
														}
														if (valid93) {
															if (
																data158.caption !==
																undefined
															) {
																const _errs434 =
																	errors;
																if (
																	typeof data158.caption !==
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
																var valid93 =
																	_errs434 ===
																	errors;
															} else {
																var valid93 = true;
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
											var valid92 = _errs429 === errors;
										} else {
											var valid92 = true;
										}
										if (valid92) {
											if (data.step !== undefined) {
												let data161 = data.step;
												const _errs436 = errors;
												if (
													typeof data161 !== 'string'
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
												if ('unzip' !== data161) {
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
																	'unzip',
															},
															message:
																'must be equal to constant',
														},
													];
													return false;
												}
												var valid92 =
													_errs436 === errors;
											} else {
												var valid92 = true;
											}
											if (valid92) {
												if (
													data.zipFile !== undefined
												) {
													const _errs438 = errors;
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
													var valid92 =
														_errs438 === errors;
												} else {
													var valid92 = true;
												}
												if (valid92) {
													if (
														data.zipPath !==
														undefined
													) {
														const _errs439 = errors;
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
																			'#/oneOf/24/properties/zipPath/type',
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
															_errs439 === errors;
													} else {
														var valid92 = true;
													}
													if (valid92) {
														if (
															data.extractToPath !==
															undefined
														) {
															const _errs441 =
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
																				'#/oneOf/24/properties/extractToPath/type',
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
																_errs441 ===
																errors;
														} else {
															var valid92 = true;
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
										schemaPath: '#/oneOf/24/type',
										keyword: 'type',
										params: { type: 'object' },
										message: 'must be object',
									},
								];
								return false;
							}
						}
					} else if (tag0 === 'updateUserMeta') {
						const _errs443 = errors;
						if (errors === _errs443) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing27;
								if (
									(data.meta === undefined &&
										(missing27 = 'meta')) ||
									(data.step === undefined &&
										(missing27 = 'step')) ||
									(data.userId === undefined &&
										(missing27 = 'userId'))
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
									const _errs445 = errors;
									for (const key58 in data) {
										if (
											!(
												key58 === 'progress' ||
												key58 === 'step' ||
												key58 === 'meta' ||
												key58 === 'userId'
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
									if (_errs445 === errors) {
										if (data.progress !== undefined) {
											let data165 = data.progress;
											const _errs446 = errors;
											if (errors === _errs446) {
												if (
													data165 &&
													typeof data165 ==
														'object' &&
													!Array.isArray(data165)
												) {
													const _errs448 = errors;
													for (const key59 in data165) {
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
													if (_errs448 === errors) {
														if (
															data165.weight !==
															undefined
														) {
															let data166 =
																data165.weight;
															const _errs449 =
																errors;
															if (
																!(
																	typeof data166 ==
																		'number' &&
																	isFinite(
																		data166
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
															var valid96 =
																_errs449 ===
																errors;
														} else {
															var valid96 = true;
														}
														if (valid96) {
															if (
																data165.caption !==
																undefined
															) {
																const _errs451 =
																	errors;
																if (
																	typeof data165.caption !==
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
																var valid96 =
																	_errs451 ===
																	errors;
															} else {
																var valid96 = true;
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
											var valid95 = _errs446 === errors;
										} else {
											var valid95 = true;
										}
										if (valid95) {
											if (data.step !== undefined) {
												let data168 = data.step;
												const _errs453 = errors;
												if (
													typeof data168 !== 'string'
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
												if (
													'updateUserMeta' !== data168
												) {
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
																	'updateUserMeta',
															},
															message:
																'must be equal to constant',
														},
													];
													return false;
												}
												var valid95 =
													_errs453 === errors;
											} else {
												var valid95 = true;
											}
											if (valid95) {
												if (data.meta !== undefined) {
													let data169 = data.meta;
													const _errs455 = errors;
													if (errors === _errs455) {
														if (
															data169 &&
															typeof data169 ==
																'object' &&
															!Array.isArray(
																data169
															)
														) {
															for (const key60 in data169) {
																const _errs458 =
																	errors;
																var valid97 =
																	_errs458 ===
																	errors;
																if (!valid97) {
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
																			'#/oneOf/25/properties/meta/type',
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
													var valid95 =
														_errs455 === errors;
												} else {
													var valid95 = true;
												}
												if (valid95) {
													if (
														data.userId !==
														undefined
													) {
														let data171 =
															data.userId;
														const _errs459 = errors;
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
																			'/userId',
																		schemaPath:
																			'#/oneOf/25/properties/userId/type',
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
															_errs459 === errors;
													} else {
														var valid95 = true;
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
					} else if (tag0 === 'writeFile') {
						const _errs461 = errors;
						if (errors === _errs461) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing28;
								if (
									(data.data === undefined &&
										(missing28 = 'data')) ||
									(data.path === undefined &&
										(missing28 = 'path')) ||
									(data.step === undefined &&
										(missing28 = 'step'))
								) {
									validate28.errors = [
										{
											instancePath,
											schemaPath: '#/oneOf/26/required',
											keyword: 'required',
											params: {
												missingProperty: missing28,
											},
											message:
												"must have required property '" +
												missing28 +
												"'",
										},
									];
									return false;
								} else {
									const _errs463 = errors;
									for (const key61 in data) {
										if (
											!(
												key61 === 'progress' ||
												key61 === 'step' ||
												key61 === 'path' ||
												key61 === 'data'
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
									if (_errs463 === errors) {
										if (data.progress !== undefined) {
											let data172 = data.progress;
											const _errs464 = errors;
											if (errors === _errs464) {
												if (
													data172 &&
													typeof data172 ==
														'object' &&
													!Array.isArray(data172)
												) {
													const _errs466 = errors;
													for (const key62 in data172) {
														if (
															!(
																key62 ===
																	'weight' ||
																key62 ===
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
													if (_errs466 === errors) {
														if (
															data172.weight !==
															undefined
														) {
															let data173 =
																data172.weight;
															const _errs467 =
																errors;
															if (
																!(
																	typeof data173 ==
																		'number' &&
																	isFinite(
																		data173
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
															var valid100 =
																_errs467 ===
																errors;
														} else {
															var valid100 = true;
														}
														if (valid100) {
															if (
																data172.caption !==
																undefined
															) {
																const _errs469 =
																	errors;
																if (
																	typeof data172.caption !==
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
																var valid100 =
																	_errs469 ===
																	errors;
															} else {
																var valid100 = true;
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
											var valid99 = _errs464 === errors;
										} else {
											var valid99 = true;
										}
										if (valid99) {
											if (data.step !== undefined) {
												let data175 = data.step;
												const _errs471 = errors;
												if (
													typeof data175 !== 'string'
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
												if ('writeFile' !== data175) {
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
																	'writeFile',
															},
															message:
																'must be equal to constant',
														},
													];
													return false;
												}
												var valid99 =
													_errs471 === errors;
											} else {
												var valid99 = true;
											}
											if (valid99) {
												if (data.path !== undefined) {
													const _errs473 = errors;
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
																	'#/oneOf/26/properties/path/type',
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
														_errs473 === errors;
												} else {
													var valid99 = true;
												}
												if (valid99) {
													if (
														data.data !== undefined
													) {
														let data177 = data.data;
														const _errs475 = errors;
														const _errs476 = errors;
														let valid101 = false;
														const _errs477 = errors;
														if (
															!validate16(
																data177,
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
															_errs477 === errors;
														valid101 =
															valid101 || _valid3;
														if (!valid101) {
															const _errs478 =
																errors;
															if (
																typeof data177 !==
																'string'
															) {
																const err9 = {
																	instancePath:
																		instancePath +
																		'/data',
																	schemaPath:
																		'#/oneOf/26/properties/data/anyOf/1/type',
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
																_errs478 ===
																errors;
															valid101 =
																valid101 ||
																_valid3;
															if (!valid101) {
																const _errs480 =
																	errors;
																if (
																	errors ===
																	_errs480
																) {
																	if (
																		data177 &&
																		typeof data177 ==
																			'object' &&
																		!Array.isArray(
																			data177
																		)
																	) {
																		let missing29;
																		if (
																			(data177.BYTES_PER_ELEMENT ===
																				undefined &&
																				(missing29 =
																					'BYTES_PER_ELEMENT')) ||
																			(data177.buffer ===
																				undefined &&
																				(missing29 =
																					'buffer')) ||
																			(data177.byteLength ===
																				undefined &&
																				(missing29 =
																					'byteLength')) ||
																			(data177.byteOffset ===
																				undefined &&
																				(missing29 =
																					'byteOffset')) ||
																			(data177.length ===
																				undefined &&
																				(missing29 =
																					'length'))
																		) {
																			const err10 =
																				{
																					instancePath:
																						instancePath +
																						'/data',
																					schemaPath:
																						'#/oneOf/26/properties/data/anyOf/2/required',
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
																						err10,
																					];
																			} else {
																				vErrors.push(
																					err10
																				);
																			}
																			errors++;
																		} else {
																			const _errs482 =
																				errors;
																			for (const key63 in data177) {
																				if (
																					!(
																						key63 ===
																							'BYTES_PER_ELEMENT' ||
																						key63 ===
																							'buffer' ||
																						key63 ===
																							'byteLength' ||
																						key63 ===
																							'byteOffset' ||
																						key63 ===
																							'length'
																					)
																				) {
																					let data178 =
																						data177[
																							key63
																						];
																					const _errs483 =
																						errors;
																					if (
																						!(
																							typeof data178 ==
																								'number' &&
																							isFinite(
																								data178
																							)
																						)
																					) {
																						const err11 =
																							{
																								instancePath:
																									instancePath +
																									'/data/' +
																									key63
																										.replace(
																											/~/g,
																											'~0'
																										)
																										.replace(
																											/\//g,
																											'~1'
																										),
																								schemaPath:
																									'#/oneOf/26/properties/data/anyOf/2/additionalProperties/type',
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
																					var valid102 =
																						_errs483 ===
																						errors;
																					if (
																						!valid102
																					) {
																						break;
																					}
																				}
																			}
																			if (
																				_errs482 ===
																				errors
																			) {
																				if (
																					data177.BYTES_PER_ELEMENT !==
																					undefined
																				) {
																					let data179 =
																						data177.BYTES_PER_ELEMENT;
																					const _errs485 =
																						errors;
																					if (
																						!(
																							typeof data179 ==
																								'number' &&
																							isFinite(
																								data179
																							)
																						)
																					) {
																						const err12 =
																							{
																								instancePath:
																									instancePath +
																									'/data/BYTES_PER_ELEMENT',
																								schemaPath:
																									'#/oneOf/26/properties/data/anyOf/2/properties/BYTES_PER_ELEMENT/type',
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
																					var valid103 =
																						_errs485 ===
																						errors;
																				} else {
																					var valid103 = true;
																				}
																				if (
																					valid103
																				) {
																					if (
																						data177.buffer !==
																						undefined
																					) {
																						let data180 =
																							data177.buffer;
																						const _errs487 =
																							errors;
																						if (
																							errors ===
																							_errs487
																						) {
																							if (
																								data180 &&
																								typeof data180 ==
																									'object' &&
																								!Array.isArray(
																									data180
																								)
																							) {
																								let missing30;
																								if (
																									data180.byteLength ===
																										undefined &&
																									(missing30 =
																										'byteLength')
																								) {
																									const err13 =
																										{
																											instancePath:
																												instancePath +
																												'/data/buffer',
																											schemaPath:
																												'#/oneOf/26/properties/data/anyOf/2/properties/buffer/required',
																											keyword:
																												'required',
																											params: {
																												missingProperty:
																													missing30,
																											},
																											message:
																												"must have required property '" +
																												missing30 +
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
																									const _errs489 =
																										errors;
																									for (const key64 in data180) {
																										if (
																											!(
																												key64 ===
																												'byteLength'
																											)
																										) {
																											const err14 =
																												{
																													instancePath:
																														instancePath +
																														'/data/buffer',
																													schemaPath:
																														'#/oneOf/26/properties/data/anyOf/2/properties/buffer/additionalProperties',
																													keyword:
																														'additionalProperties',
																													params: {
																														additionalProperty:
																															key64,
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
																										_errs489 ===
																										errors
																									) {
																										if (
																											data180.byteLength !==
																											undefined
																										) {
																											let data181 =
																												data180.byteLength;
																											if (
																												!(
																													typeof data181 ==
																														'number' &&
																													isFinite(
																														data181
																													)
																												)
																											) {
																												const err15 =
																													{
																														instancePath:
																															instancePath +
																															'/data/buffer/byteLength',
																														schemaPath:
																															'#/oneOf/26/properties/data/anyOf/2/properties/buffer/properties/byteLength/type',
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
																											'#/oneOf/26/properties/data/anyOf/2/properties/buffer/type',
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
																						var valid103 =
																							_errs487 ===
																							errors;
																					} else {
																						var valid103 = true;
																					}
																					if (
																						valid103
																					) {
																						if (
																							data177.byteLength !==
																							undefined
																						) {
																							let data182 =
																								data177.byteLength;
																							const _errs492 =
																								errors;
																							if (
																								!(
																									typeof data182 ==
																										'number' &&
																									isFinite(
																										data182
																									)
																								)
																							) {
																								const err17 =
																									{
																										instancePath:
																											instancePath +
																											'/data/byteLength',
																										schemaPath:
																											'#/oneOf/26/properties/data/anyOf/2/properties/byteLength/type',
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
																							var valid103 =
																								_errs492 ===
																								errors;
																						} else {
																							var valid103 = true;
																						}
																						if (
																							valid103
																						) {
																							if (
																								data177.byteOffset !==
																								undefined
																							) {
																								let data183 =
																									data177.byteOffset;
																								const _errs494 =
																									errors;
																								if (
																									!(
																										typeof data183 ==
																											'number' &&
																										isFinite(
																											data183
																										)
																									)
																								) {
																									const err18 =
																										{
																											instancePath:
																												instancePath +
																												'/data/byteOffset',
																											schemaPath:
																												'#/oneOf/26/properties/data/anyOf/2/properties/byteOffset/type',
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
																								var valid103 =
																									_errs494 ===
																									errors;
																							} else {
																								var valid103 = true;
																							}
																							if (
																								valid103
																							) {
																								if (
																									data177.length !==
																									undefined
																								) {
																									let data184 =
																										data177.length;
																									const _errs496 =
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
																										const err19 =
																											{
																												instancePath:
																													instancePath +
																													'/data/length',
																												schemaPath:
																													'#/oneOf/26/properties/data/anyOf/2/properties/length/type',
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
																									var valid103 =
																										_errs496 ===
																										errors;
																								} else {
																									var valid103 = true;
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
																					'#/oneOf/26/properties/data/anyOf/2/type',
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
																	_errs480 ===
																	errors;
																valid101 =
																	valid101 ||
																	_valid3;
															}
														}
														if (!valid101) {
															const err21 = {
																instancePath:
																	instancePath +
																	'/data',
																schemaPath:
																	'#/oneOf/26/properties/data/anyOf',
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
															errors = _errs476;
															if (
																vErrors !== null
															) {
																if (_errs476) {
																	vErrors.length =
																		_errs476;
																} else {
																	vErrors =
																		null;
																}
															}
														}
														var valid99 =
															_errs475 === errors;
													} else {
														var valid99 = true;
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
					} else if (tag0 === 'writeFiles') {
						const _errs498 = errors;
						if (errors === _errs498) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing31;
								if (
									(data.filesTree === undefined &&
										(missing31 = 'filesTree')) ||
									(data.step === undefined &&
										(missing31 = 'step')) ||
									(data.writeToPath === undefined &&
										(missing31 = 'writeToPath'))
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
									const _errs500 = errors;
									for (const key65 in data) {
										if (
											!(
												key65 === 'progress' ||
												key65 === 'step' ||
												key65 === 'writeToPath' ||
												key65 === 'filesTree'
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
									if (_errs500 === errors) {
										if (data.progress !== undefined) {
											let data185 = data.progress;
											const _errs501 = errors;
											if (errors === _errs501) {
												if (
													data185 &&
													typeof data185 ==
														'object' &&
													!Array.isArray(data185)
												) {
													const _errs503 = errors;
													for (const key66 in data185) {
														if (
															!(
																key66 ===
																	'weight' ||
																key66 ===
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
													if (_errs503 === errors) {
														if (
															data185.weight !==
															undefined
														) {
															let data186 =
																data185.weight;
															const _errs504 =
																errors;
															if (
																!(
																	typeof data186 ==
																		'number' &&
																	isFinite(
																		data186
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
															var valid107 =
																_errs504 ===
																errors;
														} else {
															var valid107 = true;
														}
														if (valid107) {
															if (
																data185.caption !==
																undefined
															) {
																const _errs506 =
																	errors;
																if (
																	typeof data185.caption !==
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
																var valid107 =
																	_errs506 ===
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
											var valid106 = _errs501 === errors;
										} else {
											var valid106 = true;
										}
										if (valid106) {
											if (data.step !== undefined) {
												let data188 = data.step;
												const _errs508 = errors;
												if (
													typeof data188 !== 'string'
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
												if ('writeFiles' !== data188) {
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
																	'writeFiles',
															},
															message:
																'must be equal to constant',
														},
													];
													return false;
												}
												var valid106 =
													_errs508 === errors;
											} else {
												var valid106 = true;
											}
											if (valid106) {
												if (
													data.writeToPath !==
													undefined
												) {
													const _errs510 = errors;
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
																	'#/oneOf/27/properties/writeToPath/type',
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
														_errs510 === errors;
												} else {
													var valid106 = true;
												}
												if (valid106) {
													if (
														data.filesTree !==
														undefined
													) {
														const _errs512 = errors;
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
														var valid106 =
															_errs512 === errors;
													} else {
														var valid106 = true;
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
					} else if (tag0 === 'wp-cli') {
						const _errs513 = errors;
						if (errors === _errs513) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing32;
								if (
									(data.command === undefined &&
										(missing32 = 'command')) ||
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
									const _errs515 = errors;
									for (const key67 in data) {
										if (
											!(
												key67 === 'progress' ||
												key67 === 'step' ||
												key67 === 'command' ||
												key67 === 'wpCliPath'
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
									if (_errs515 === errors) {
										if (data.progress !== undefined) {
											let data191 = data.progress;
											const _errs516 = errors;
											if (errors === _errs516) {
												if (
													data191 &&
													typeof data191 ==
														'object' &&
													!Array.isArray(data191)
												) {
													const _errs518 = errors;
													for (const key68 in data191) {
														if (
															!(
																key68 ===
																	'weight' ||
																key68 ===
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
																				key68,
																		},
																		message:
																			'must NOT have additional properties',
																	},
																];
															return false;
															break;
														}
													}
													if (_errs518 === errors) {
														if (
															data191.weight !==
															undefined
														) {
															let data192 =
																data191.weight;
															const _errs519 =
																errors;
															if (
																!(
																	typeof data192 ==
																		'number' &&
																	isFinite(
																		data192
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
															var valid110 =
																_errs519 ===
																errors;
														} else {
															var valid110 = true;
														}
														if (valid110) {
															if (
																data191.caption !==
																undefined
															) {
																const _errs521 =
																	errors;
																if (
																	typeof data191.caption !==
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
																var valid110 =
																	_errs521 ===
																	errors;
															} else {
																var valid110 = true;
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
											var valid109 = _errs516 === errors;
										} else {
											var valid109 = true;
										}
										if (valid109) {
											if (data.step !== undefined) {
												let data194 = data.step;
												const _errs523 = errors;
												if (
													typeof data194 !== 'string'
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
												if ('wp-cli' !== data194) {
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
																	'wp-cli',
															},
															message:
																'must be equal to constant',
														},
													];
													return false;
												}
												var valid109 =
													_errs523 === errors;
											} else {
												var valid109 = true;
											}
											if (valid109) {
												if (
													data.command !== undefined
												) {
													let data195 = data.command;
													const _errs525 = errors;
													const _errs526 = errors;
													let valid111 = false;
													const _errs527 = errors;
													if (
														typeof data195 !==
														'string'
													) {
														const err22 = {
															instancePath:
																instancePath +
																'/command',
															schemaPath:
																'#/oneOf/28/properties/command/anyOf/0/type',
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
														_errs527 === errors;
													valid111 =
														valid111 || _valid4;
													if (!valid111) {
														const _errs529 = errors;
														if (
															errors === _errs529
														) {
															if (
																Array.isArray(
																	data195
																)
															) {
																var valid112 = true;
																const len0 =
																	data195.length;
																for (
																	let i0 = 0;
																	i0 < len0;
																	i0++
																) {
																	const _errs531 =
																		errors;
																	if (
																		typeof data195[
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
																					'#/oneOf/28/properties/command/anyOf/1/items/type',
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
																	var valid112 =
																		_errs531 ===
																		errors;
																	if (
																		!valid112
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
																		'#/oneOf/28/properties/command/anyOf/1/type',
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
															_errs529 === errors;
														valid111 =
															valid111 || _valid4;
													}
													if (!valid111) {
														const err25 = {
															instancePath:
																instancePath +
																'/command',
															schemaPath:
																'#/oneOf/28/properties/command/anyOf',
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
														errors = _errs526;
														if (vErrors !== null) {
															if (_errs526) {
																vErrors.length =
																	_errs526;
															} else {
																vErrors = null;
															}
														}
													}
													var valid109 =
														_errs525 === errors;
												} else {
													var valid109 = true;
												}
												if (valid109) {
													if (
														data.wpCliPath !==
														undefined
													) {
														const _errs533 = errors;
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
																			'#/oneOf/28/properties/wpCliPath/type',
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
														var valid109 =
															_errs533 === errors;
													} else {
														var valid109 = true;
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
										schemaPath: '#/oneOf/28/type',
										keyword: 'type',
										params: { type: 'object' },
										message: 'must be object',
									},
								];
								return false;
							}
						}
					} else if (tag0 === 'setSiteLanguage') {
						const _errs535 = errors;
						if (errors === _errs535) {
							if (
								data &&
								typeof data == 'object' &&
								!Array.isArray(data)
							) {
								let missing33;
								if (
									(data.language === undefined &&
										(missing33 = 'language')) ||
									(data.step === undefined &&
										(missing33 = 'step'))
								) {
									validate28.errors = [
										{
											instancePath,
											schemaPath: '#/oneOf/29/required',
											keyword: 'required',
											params: {
												missingProperty: missing33,
											},
											message:
												"must have required property '" +
												missing33 +
												"'",
										},
									];
									return false;
								} else {
									const _errs537 = errors;
									for (const key69 in data) {
										if (
											!(
												key69 === 'progress' ||
												key69 === 'step' ||
												key69 === 'language'
											)
										) {
											validate28.errors = [
												{
													instancePath,
													schemaPath:
														'#/oneOf/29/additionalProperties',
													keyword:
														'additionalProperties',
													params: {
														additionalProperty:
															key69,
													},
													message:
														'must NOT have additional properties',
												},
											];
											return false;
											break;
										}
									}
									if (_errs537 === errors) {
										if (data.progress !== undefined) {
											let data198 = data.progress;
											const _errs538 = errors;
											if (errors === _errs538) {
												if (
													data198 &&
													typeof data198 ==
														'object' &&
													!Array.isArray(data198)
												) {
													const _errs540 = errors;
													for (const key70 in data198) {
														if (
															!(
																key70 ===
																	'weight' ||
																key70 ===
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
																			'#/oneOf/29/properties/progress/additionalProperties',
																		keyword:
																			'additionalProperties',
																		params: {
																			additionalProperty:
																				key70,
																		},
																		message:
																			'must NOT have additional properties',
																	},
																];
															return false;
															break;
														}
													}
													if (_errs540 === errors) {
														if (
															data198.weight !==
															undefined
														) {
															let data199 =
																data198.weight;
															const _errs541 =
																errors;
															if (
																!(
																	typeof data199 ==
																		'number' &&
																	isFinite(
																		data199
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
																				'#/oneOf/29/properties/progress/properties/weight/type',
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
															var valid115 =
																_errs541 ===
																errors;
														} else {
															var valid115 = true;
														}
														if (valid115) {
															if (
																data198.caption !==
																undefined
															) {
																const _errs543 =
																	errors;
																if (
																	typeof data198.caption !==
																	'string'
																) {
																	validate28.errors =
																		[
																			{
																				instancePath:
																					instancePath +
																					'/progress/caption',
																				schemaPath:
																					'#/oneOf/29/properties/progress/properties/caption/type',
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
																var valid115 =
																	_errs543 ===
																	errors;
															} else {
																var valid115 = true;
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
																'#/oneOf/29/properties/progress/type',
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
											var valid114 = _errs538 === errors;
										} else {
											var valid114 = true;
										}
										if (valid114) {
											if (data.step !== undefined) {
												let data201 = data.step;
												const _errs545 = errors;
												if (
													typeof data201 !== 'string'
												) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/29/properties/step/type',
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
													data201
												) {
													validate28.errors = [
														{
															instancePath:
																instancePath +
																'/step',
															schemaPath:
																'#/oneOf/29/properties/step/const',
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
												var valid114 =
													_errs545 === errors;
											} else {
												var valid114 = true;
											}
											if (valid114) {
												if (
													data.language !== undefined
												) {
													const _errs547 = errors;
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
																	'#/oneOf/29/properties/language/type',
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
													var valid114 =
														_errs547 === errors;
												} else {
													var valid114 = true;
												}
											}
										}
									}
								}
							} else {
								validate28.errors = [
									{
										instancePath,
										schemaPath: '#/oneOf/29/type',
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
																			type: schema18
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
