import type { BlueprintV2Declaration } from '../../lib/v2/blueprint-v2-declaration';

export type V2SchemaConformanceCase = {
	name: string;
	declaration: BlueprintV2Declaration;
};

type DataReference = NonNullable<BlueprintV2Declaration['muPlugins']>[number];

// These declarations are intentionally dense. They expose every reachable v2
// schema branch to the compiler test rather than model a practical site.
const urlReference = 'https://example.com/asset.zip';
const executionContextReference = './assets/asset.zip';
const inlineFileReference = {
	filename: 'asset.php',
	content: '<?php echo "Blueprint v2";',
};
const inlineDirectoryReference = {
	directoryName: 'inline-asset',
	files: {
		'index.php': '<?php',
		includes: {
			files: {
				'helper.php': '<?php',
				nested: {
					files: {
						'readme.txt': 'Nested directory',
					},
				},
			},
		},
	},
};
const gitReference = {
	gitRepository: 'https://github.com/WordPress/wordpress-importer.git',
	ref: 'trunk',
	pathInRepository: 'src',
} satisfies DataReference;
const dataReferences = [
	urlReference,
	executionContextReference,
	inlineFileReference,
	inlineDirectoryReference,
	gitReference,
] as const satisfies readonly DataReference[];
const fileReferences = [
	'https://example.com/file.php',
	'./assets/file.php',
	{
		filename: 'inline.php',
		content: '<?php',
	},
] as const;

const jsonValueVariants = {
	stringValue: 'value',
	booleanValue: true,
	numberValue: 42,
	arrayValue: ['nested', false, 7, ['nested array'], { child: 'value' }],
	objectValue: {
		child: 'value',
		booleanChild: false,
		numberChild: 7,
		arrayChild: ['nested'],
		objectChild: { leaf: 'value' },
	},
};
const urlsMap = {
	'https://source.example': 'https://target.example',
} as const;

const postTypeLabels = {
	name: 'Books',
	singular_name: 'Book',
	add_new: 'Add Book',
	add_new_item: 'Add New Book',
	edit_item: 'Edit Book',
	new_item: 'New Book',
	view_item: 'View Book',
	view_items: 'View Books',
	search_items: 'Search Books',
	not_found: 'No books found',
	not_found_in_trash: 'No books found in Trash',
	parent_item_colon: 'Parent Book:',
	all_items: 'All Books',
	archives: 'Book Archives',
	attributes: 'Book Attributes',
	insert_into_item: 'Insert into book',
	uploaded_to_this_item: 'Uploaded to this book',
	featured_image: 'Book cover',
	set_featured_image: 'Set book cover',
	remove_featured_image: 'Remove book cover',
	use_featured_image: 'Use as book cover',
	menu_name: 'Books',
	filter_items_list: 'Filter books list',
	filter_by_date: 'Filter books by date',
	items_list_navigation: 'Books list navigation',
	items_list: 'Books list',
	item_published: 'Book published.',
	item_published_privately: 'Book published privately.',
	item_reverted_to_draft: 'Book reverted to draft.',
	item_trashed: 'Book trashed.',
	item_scheduled: 'Book scheduled.',
	item_updated: 'Book updated.',
	item_link: 'Book Link',
	item_link_description: 'A link to a book.',
	future_label: 'Future WordPress label',
};

const completePost = {
	post_author: 1,
	post_date: '2026-07-11 12:00:00',
	post_content: '<p>Blueprint v2 content</p>',
	post_title: 'Complete post',
	post_excerpt: 'Post excerpt',
	post_status: 'publish' as const,
	post_type: 'book',
	comment_status: 'open' as const,
	post_password: 'secret',
	post_name: 'complete-post',
	post_parent_name: 'Parent post',
	menu_order: 1,
	post_mime_type: 'text/plain',
	guid: 'https://example.com/complete-post',
	post_category: ['Blueprint category'],
	post_tags: ['Blueprint tag'],
	tax_input: {
		category: ['Tax input category'],
	},
	meta_input: jsonValueVariants,
	page_template: 'templates/full-width.php',
};
const postStatuses = [
	'publish',
	'pending',
	'draft',
	'auto-draft',
	'future',
	'private',
	'inherit',
	'trash',
] as const;
const statusPosts = postStatuses.map((post_status, index) => ({
	post_title: `Post status ${post_status}`,
	post_name: `post-status-${post_status}`,
	post_status,
	comment_status: index % 2 === 0 ? ('open' as const) : ('closed' as const),
}));

const mediaDefinitions = [
	fileReferences[0],
	fileReferences[1],
	fileReferences[2],
	...fileReferences.map((source, index) => ({
		source,
		title: `Media ${index}`,
		description: 'Media description',
		alt: 'Media alternative text',
		caption: 'Media caption',
	})),
] satisfies NonNullable<BlueprintV2Declaration['media']>;

const contentDefinitions = [
	...fileReferences.map((source) => ({
		type: 'mysql-dump' as const,
		source,
	})),
	{
		type: 'mysql-dump' as const,
		source: [...fileReferences],
	},
	...fileReferences.map((source, index) => ({
		type: 'posts' as const,
		source,
		urlsMode:
			index % 2 === 0 ? ('rewrite' as const) : ('preserve' as const),
		urlsMap,
	})),
	{
		type: 'posts' as const,
		source: completePost,
		urlsMode: 'rewrite' as const,
		urlsMap,
	},
	...statusPosts.map((source) => ({
		type: 'posts' as const,
		source,
	})),
	{
		type: 'posts' as const,
		source: [...fileReferences, completePost, ...statusPosts],
		urlsMode: 'preserve' as const,
		urlsMap,
	},
	{
		type: 'wxr' as const,
		source: fileReferences[1],
		authorsMode: 'map' as const,
		authorsMap: {
			remote: 'admin',
		},
		staticAssets: 'hotlink' as const,
		urlsMode: 'preserve' as const,
	},
	{
		type: 'wxr' as const,
		source: fileReferences[2],
		authorsMode: 'map' as const,
		authorsMap: {
			remote: 'admin',
		},
	},
	{
		type: 'wxr' as const,
		source: [...fileReferences],
		authorsMode: 'map' as const,
		authorsMap: {
			remote: 'admin',
		},
	},
	{
		type: 'wxr' as const,
		source: fileReferences[0],
		authorsMode: 'map' as const,
		authorsMap: {
			remote: 'admin',
		},
		staticAssets: 'fetch' as const,
		defaultAuthorUsername: 'admin',
		importUsers: false,
		importComments: true,
		urlsMode: 'rewrite' as const,
		urlsMap,
	},
	{
		type: 'wxr' as const,
		source: fileReferences[0],
		authorsMode: 'create' as const,
	},
	{
		type: 'wxr' as const,
		source: fileReferences[1],
		authorsMode: 'default-author' as const,
	},
	{
		type: 'wxr' as const,
		source: [...fileReferences],
		authorsMode: 'create' as const,
		authorsMap: {
			remote: 'editor',
		},
		staticAssets: 'hotlink' as const,
		defaultAuthorUsername: 'editor',
		importUsers: true,
		importComments: false,
		urlsMode: 'preserve' as const,
		urlsMap,
	},
	{
		type: 'wxr' as const,
		source: fileReferences[2],
		authorsMode: 'default-author' as const,
		staticAssets: 'fetch' as const,
		defaultAuthorUsername: 'admin',
		importUsers: false,
		importComments: false,
		urlsMode: 'rewrite' as const,
		urlsMap,
	},
] satisfies NonNullable<BlueprintV2Declaration['content']>;

const pluginObjectDefinitions = [
	{
		source: dataReferences[0],
		active: true,
		activationOptions: jsonValueVariants,
		targetDirectoryName: 'plugin-url',
		onError: 'skip-plugin' as const,
		ifAlreadyInstalled: 'overwrite' as const,
		humanReadableName: 'URL Plugin',
	},
	{
		source: dataReferences[1],
		active: false,
		activationOptions: jsonValueVariants,
		targetDirectoryName: 'plugin-path',
		onError: 'throw' as const,
		ifAlreadyInstalled: 'skip' as const,
		humanReadableName: 'Path Plugin',
	},
	{
		source: dataReferences[2],
		active: true,
		activationOptions: jsonValueVariants,
		ifAlreadyInstalled: 'error' as const,
		humanReadableName: 'Inline Plugin',
	},
	{
		source: dataReferences[3],
		active: true,
	},
	{
		source: dataReferences[4],
		active: true,
	},
	{
		source: 'akismet@5.3',
		active: true,
	},
] satisfies NonNullable<BlueprintV2Declaration['plugins']>;

const themeObjectDefinitions = [
	{
		source: dataReferences[0],
		importStarterContent: true,
		targetDirectoryName: 'theme-url',
		onError: 'skip-theme' as const,
		ifAlreadyInstalled: 'overwrite' as const,
		humanReadableName: 'URL Theme',
	},
	{
		source: dataReferences[1],
		importStarterContent: false,
		targetDirectoryName: 'theme-path',
		onError: 'throw' as const,
		ifAlreadyInstalled: 'skip' as const,
		humanReadableName: 'Path Theme',
	},
	{
		source: dataReferences[2],
		ifAlreadyInstalled: 'error' as const,
		humanReadableName: 'Inline Theme',
	},
	{
		source: dataReferences[3],
	},
	{
		source: dataReferences[4],
	},
	{
		source: 'twentytwentyfour@1.3',
	},
] satisfies NonNullable<BlueprintV2Declaration['themes']>;

const fontCollection = {
	$schema: 'https://schemas.wp.org/trunk/font-collection.json',
	font_families: [
		{
			font_family_settings: {
				name: 'Conformance Sans',
				slug: 'conformance-sans',
				fontFamily: 'Conformance Sans',
				preview: 'https://example.com/font-preview.png',
				fontFace: [
					{
						preview: 'https://example.com/face-preview.png',
						fontFamily: 'Conformance Sans',
						fontStyle: 'normal',
						fontWeight: '400',
						fontDisplay: 'auto' as const,
						src: 'https://example.com/conformance.woff2',
						fontStretch: 'normal',
						ascentOverride: '90%',
						descentOverride: '20%',
						fontVariant: 'normal',
						fontFeatureSettings: 'normal',
						fontVariationSettings: 'normal',
						lineGapOverride: 'normal',
						sizeAdjust: '100%',
						unicodeRange: 'U+0000-00FF',
					},
					{
						fontFamily: 'Conformance Sans',
						fontWeight: 500,
						fontDisplay: 'block' as const,
						src: [
							'https://example.com/conformance-bold.woff2',
							'./fonts/conformance.woff2',
							{
								filename: 'conformance-inline.woff2',
								content: 'font data',
							},
						],
					},
					...(['fallback', 'swap', 'optional'] as const).map(
						(fontDisplay, index) => ({
							fontFamily: 'Conformance Sans',
							fontDisplay,
							src:
								index === 0
									? ('./fonts/fallback.woff2' as const)
									: {
											filename: `${fontDisplay}.woff2`,
											content: 'font data',
										},
						})
					),
				],
			},
			categories: ['sans-serif'],
		},
	],
} satisfies NonNullable<BlueprintV2Declaration['fonts']>[string];

const postTypes = {
	book: {
		label: 'Books',
		labels: postTypeLabels,
		description: 'A complete post type declaration',
		public: true,
		hierarchical: false,
		exclude_from_search: false,
		publicly_queryable: true,
		show_ui: true,
		show_in_menu: true,
		show_in_admin_bar: true,
		show_in_nav_menus: true,
		show_in_rest: true,
		rest_base: 'books',
		rest_namespace: 'wp/v2',
		rest_controller_class: 'WP_REST_Posts_Controller',
		menu_icon: 'dashicons-book',
		menu_position: 20,
		rename_capabilities: true,
		singular_capability_name: 'book',
		plural_capability_name: 'books',
		taxonomies: ['category', 'post_tag'],
		query_var_name: 'book',
		register_meta_box_cb: 'register_book_meta_boxes',
		enter_title_here: 'Enter book title',
		capability_type: 'book',
		capabilities: {
			edit_post: 'edit_book',
		},
		map_meta_cap: true,
		supports: [
			'title',
			'editor',
			'author',
			'thumbnail',
			'excerpt',
			'trackbacks',
			'custom-fields',
			'comments',
			'revisions',
			'page-attributes',
			'post-formats',
		],
		has_archive: true,
		rewrite: false,
		query_var: true,
		can_export: true,
		delete_with_user: false,
		template: [
			[
				'core/paragraph',
				{
					placeholder: 'Start writing',
					lock: { move: true },
					...jsonValueVariants,
				},
			],
		],
		template_lock: 'all' as const,
	},
	movie: {
		show_in_menu: 'edit.php?post_type=page',
		menu_position: '25',
		capability_type: ['movie', 'movies'] as [string, string],
		has_archive: 'movie-archive',
		rewrite: {
			slug: 'movies',
			with_front: false,
			pages: true,
			feeds: true,
			ep_mask: 1,
		},
		query_var: 'movie',
		template_lock: 'insert' as const,
	},
	album: {
		template_lock: false as const,
	},
	from_file: './post-types/from-file.json',
} satisfies NonNullable<BlueprintV2Declaration['postTypes']>;

const additionalSteps = [
	{
		step: 'activatePlugin' as const,
		pluginPath: 'akismet/akismet.php',
		humanReadableName: 'Akismet',
	},
	{
		step: 'activateTheme' as const,
		themeDirectoryName: 'twentytwentyfour',
		humanReadableName: 'Twenty Twenty-Four',
	},
	{
		step: 'cp' as const,
		fromPath: 'site:source.txt',
		toPath: 'site:copy.txt',
	},
	{
		step: 'defineConstants' as const,
		constants: {
			WP_DEBUG: true,
			WP_DEBUG_LOG: false,
			WP_DEBUG_DISPLAY: true,
			SCRIPT_DEBUG: false,
			CUSTOM_BOOLEAN: true,
			CUSTOM_STRING: 'value',
			CUSTOM_NUMBER: 42,
		},
	},
	{
		step: 'importContent' as const,
		content: contentDefinitions,
	},
	{
		step: 'importMedia' as const,
		media: mediaDefinitions,
	},
	{
		step: 'importThemeStarterContent' as const,
		themeSlug: 'twentytwentyfour',
	},
	...pluginObjectDefinitions.map((definition) => ({
		step: 'installPlugin' as const,
		...definition,
	})),
	...themeObjectDefinitions.map((definition, index) => ({
		step: 'installTheme' as const,
		active: index % 2 === 0,
		...definition,
	})),
	{
		step: 'mkdir' as const,
		path: 'site:created',
	},
	{
		step: 'mv' as const,
		fromPath: 'site:old.txt',
		toPath: 'site:new.txt',
	},
	{
		step: 'rm' as const,
		path: 'site:file.txt',
	},
	{
		step: 'rmdir' as const,
		path: 'site:directory',
	},
	...fileReferences.map((code, index) => ({
		step: 'runPHP' as const,
		code,
		env: {
			CASE: String(index),
		},
	})),
	...fileReferences.map((source) => ({
		step: 'runSQL' as const,
		source,
	})),
	{
		step: 'setSiteLanguage' as const,
		language: 'en_US',
	},
	{
		step: 'setSiteOptions' as const,
		options: jsonValueVariants,
	},
	...fileReferences.map((zipFile) => ({
		step: 'unzip' as const,
		zipFile,
		extractToPath: 'site:unzipped',
	})),
	{
		step: 'wp-cli' as const,
		command: 'wp option get blogname',
		wpCliPath: '/tmp/wp-cli.phar',
	},
	{
		step: 'writeFiles' as const,
		files: Object.fromEntries(
			dataReferences.map((reference, index) => [
				`site:written-${index}`,
				reference,
			])
		),
	},
] satisfies NonNullable<
	BlueprintV2Declaration['additionalStepsAfterExecution']
>;

const maximalDeclaration = {
	version: 2 as const,
	$schema: 'https://playground.wordpress.net/blueprint-schema.json',
	blueprintMeta: {
		name: 'Schema conformance',
		description: 'Exercises the Blueprint v2 schema',
		moreInfo: 'Used by the TypeScript compiler conformance suite.',
		version: '1.0.0',
		authors: ['WordPress Playground'],
		homepage: 'https://playground.wordpress.net/',
		donateLink: 'https://wordpress.org/donate/',
		tags: ['blueprints', 'conformance'],
		license: 'GPL-2.0',
	},
	applicationOptions: {
		'wordpress-playground': {
			landingPage: '/wp-admin/',
			login: true,
			networkAccess: true,
		},
	},
	siteLanguage: 'en_US',
	siteOptions: {
		blogname: 'Schema conformance',
		timezone_string: 'Europe/Warsaw',
		permalink_structure: '/%postname%/',
		...jsonValueVariants,
	},
	constants: {
		WP_DEBUG: true,
		WP_DEBUG_LOG: false,
		WP_DEBUG_DISPLAY: true,
		SCRIPT_DEBUG: false,
		CUSTOM_BOOLEAN: true,
		CUSTOM_STRING: 'value',
		CUSTOM_NUMBER: 42,
	},
	wordpressVersion: 'latest',
	phpVersion: '8.3',
	activeTheme: {
		...themeObjectDefinitions[3],
		importStarterContent: true,
		targetDirectoryName: 'active-inline-theme',
		onError: 'skip-theme' as const,
		ifAlreadyInstalled: 'overwrite' as const,
		humanReadableName: 'Active Inline Theme',
	},
	themes: [
		'twentytwentyfour',
		'twentytwentyfour@1.3',
		...dataReferences,
		...themeObjectDefinitions,
	],
	plugins: [
		'akismet',
		'akismet@5.3',
		...dataReferences,
		...pluginObjectDefinitions,
	],
	muPlugins: [...dataReferences],
	postTypes,
	fonts: {
		url_font: 'https://example.com/url-font.woff2',
		execution_context_font: './fonts/context-font.woff2',
		inline_font: {
			filename: 'inline-font.woff2',
			content: 'font data',
		},
		collection: fontCollection,
	},
	media: mediaDefinitions,
	content: contentDefinitions,
	users: [
		{
			username: 'editor',
			email: 'editor@example.com',
			role: 'editor',
			meta: {
				first_name: 'Schema',
				last_name: 'Conformance',
			},
		},
	],
	roles: [
		{
			name: 'conformance_role',
			capabilities: {
				read: 'true',
				edit_posts: 'false',
			},
		},
	],
	additionalStepsAfterExecution: additionalSteps,
} satisfies BlueprintV2Declaration;

const directActiveThemeCases = dataReferences.map((activeTheme, index) => ({
	name: `direct active theme data reference ${index + 1}`,
	declaration: {
		version: 2 as const,
		activeTheme,
		wordpressVersion: dataReferences[index],
	},
}));

const activeThemeObjectSources = [
	'twentytwentyfour@1.3',
	dataReferences[0],
	dataReferences[1],
	dataReferences[2],
	dataReferences[4],
] as const;
const activeThemeObjectCases = activeThemeObjectSources.map(
	(source, index) => ({
		name: `active theme object source ${index + 1}`,
		declaration: {
			version: 2 as const,
			activeTheme: {
				source,
				importStarterContent: index % 2 === 0,
				targetDirectoryName: `active-theme-${index}`,
				onError:
					index % 2 === 0
						? ('throw' as const)
						: ('skip-theme' as const),
				ifAlreadyInstalled: (['skip', 'error', 'overwrite'] as const)[
					index % 3
				],
				humanReadableName: `Active theme ${index}`,
			},
		},
	})
);

export const v2SchemaConformanceCases = [
	{
		name: 'maximal declaration',
		declaration: maximalDeclaration,
	},
	{
		name: 'scalar alternatives',
		declaration: {
			version: 2,
			$schema: './blueprint-schema.json',
			applicationOptions: {
				'wordpress-playground': {
					login: {
						username: 'admin',
						password: 'password',
					},
				},
			},
			siteOptions: {
				permalink_structure: false,
			},
			wordpressVersion: {
				min: '6.8',
				max: '6.9',
				preferred: 'latest',
			},
			phpVersion: {
				min: '8.0',
				recommended: '8.3',
				max: '8.4',
			},
			activeTheme: 'twentytwentyfour',
		},
	},
	...directActiveThemeCases,
	...activeThemeObjectCases,
] satisfies V2SchemaConformanceCase[];
