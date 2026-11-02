import type { BlueprintV2Declaration } from '../../lib/v2/blueprint-v2-declaration';

export type V2SchemaConformanceCase = {
	name: string;
	declaration: BlueprintV2Declaration;
};

type DataReference = NonNullable<BlueprintV2Declaration['muPlugins']>[number];

// These declarations are intentionally dense. The runtime conformance test
// supplies every URL, execution-context file, and Git checkout used below.
const urlReference = 'https://example.com/assets/installable.zip';
const executionContextReference = './assets/installable.zip';
const inlineFileReference = {
	filename: 'inline-plugin.php',
	content: `<?php
/**
 * Plugin Name: Blueprint v2 Inline Plugin
 */
`,
};
const inlineThemeArchiveReference = {
	filename: 'inline-theme.zip',
	// Inline file contents are UTF-8 strings. This fixture archive only uses
	// ASCII bytes so materializing that string preserves the ZIP byte stream.
	content: atob(
		'UEsDBBQAAAAAAAAAAAAUQB1rNgAAADYAAAAWAAAAaW5saW5lLXRoZW1lL3N0eWxlLmNzcy8qClRoZW1l' +
			'IE5hbWU6IEJsdWVwcmludCB2MiBJbmxpbmUgRmlsZSBUaGVtZQoqLwovKjYqL1BLAwQUAAAAAAAAAAAA' +
			'Jm19HjMAAAAzAAAAFgAvAGlubGluZS10aGVtZS9pbmRleC5waHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
			'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADw/cGhwIGVjaG8gIkJsdWVwcmludCB2MiBpbmxpbmUgZmls' +
			'ZSB0aGVtZSI7Ci8qMTYqL1BLAQIUABQAAAAAAAAAAAAUQB1rNgAAADYAAAAWAAAAAAAAAAAAAAAAAAAA' +
			'AABpbmxpbmUtdGhlbWUvc3R5bGUuY3NzUEsBAhQAFAAAAAAAAAAAACZtfR4zAAAAMwAAABYAeAAAAAAA' +
			'AAAAAAAAagAAAGlubGluZS10aGVtZS9pbmRleC5waHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
			'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
			'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQSwUGAAAAAAIAAgAAAQAAAAEAAAAA'
	),
};
const inlineDirectoryReference = {
	directoryName: 'inline-installable',
	files: {
		'style.css': '/*\nTheme Name: Blueprint v2 Inline Theme\n*/',
		'index.php': '<?php echo "Blueprint v2 inline theme";',
		'inline-plugin.php': `<?php
/**
 * Plugin Name: Blueprint v2 Inline Directory Plugin
 */
`,
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
	gitRepository: 'https://example.com/installable.git',
	ref: 'conformance',
	pathInRepository: 'installable',
} satisfies DataReference;
const dataReferences = [
	urlReference,
	executionContextReference,
	inlineFileReference,
	inlineDirectoryReference,
	gitReference,
] as const satisfies readonly DataReference[];

export const v2SchemaConformanceFileContents = {
	font: 'font data',
	media: 'Blueprint v2 media',
	post: '<p>Blueprint v2 execution-context post</p>',
	sql: 'CREATE TABLE IF NOT EXISTS blueprint_v2_conformance (value TEXT);',
	wxr: `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/">
	<channel>
		<title>Blueprint v2 conformance</title>
		<link>https://source.example</link>
		<description></description>
		<pubDate>Sat, 11 Jul 2026 12:00:00 +0000</pubDate>
		<language>en-US</language>
		<wp:wxr_version>1.2</wp:wxr_version>
		<wp:base_site_url>https://source.example</wp:base_site_url>
		<wp:base_blog_url>https://source.example</wp:base_blog_url>
	</channel>
</rss>`,
	php: '<?php require "/wordpress/wp-load.php";',
} as const;

const fontFileReferences = createFileReferences(
	'fonts',
	'woff2',
	v2SchemaConformanceFileContents.font
);
const mediaFileReferences = createFileReferences(
	'media',
	'txt',
	v2SchemaConformanceFileContents.media
);
const postFileReferences = createFileReferences(
	'posts',
	'html',
	v2SchemaConformanceFileContents.post
);
const sqlFileReferences = createFileReferences(
	'sql',
	'sql',
	v2SchemaConformanceFileContents.sql
);
const wxrFileReferences = createFileReferences(
	'wxr',
	'xml',
	v2SchemaConformanceFileContents.wxr
);
const phpFileReferences = createFileReferences(
	'php',
	'php',
	v2SchemaConformanceFileContents.php
);
const zipFileReferences = createFileReferences(
	'archives',
	'zip',
	`PK\u0005\u0006${'\u0000'.repeat(18)}`
);

/**
 * Creates URL, execution-context, and inline-file references for one asset type.
 */
function createFileReferences(
	name: string,
	extension: string,
	inlineContent: string
) {
	return [
		`https://example.com/${name}/url.${extension}`,
		`./${name}/execution-context.${extension}`,
		`site:wp-content/blueprint-v2-conformance/${name}/target-site.${extension}`,
		{
			filename: `inline.${extension}`,
			content: inlineContent,
		},
	] as const;
}

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
	...mediaFileReferences,
	...mediaFileReferences.map((source, index) => ({
		source,
		title: `Media ${index}`,
		description: 'Media description',
		alt: 'Media alternative text',
		caption: 'Media caption',
	})),
] satisfies NonNullable<BlueprintV2Declaration['media']>;

const contentDefinitions = [
	...sqlFileReferences.map((source) => ({
		type: 'mysql-dump' as const,
		source,
	})),
	{
		type: 'mysql-dump' as const,
		source: [...sqlFileReferences],
	},
	...postFileReferences.map((source, index) => ({
		type: 'posts' as const,
		source,
		urlsMode:
			index % 2 === 0 ? ('rewrite' as const) : ('preserve' as const),
		urlsMap,
	})),
	{
		type: 'posts' as const,
		source: {
			post_title: 'Parent post',
			post_name: 'parent-post',
			post_type: 'book',
			post_status: 'publish' as const,
		},
	},
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
		source: [...postFileReferences, completePost, ...statusPosts],
		urlsMode: 'preserve' as const,
		urlsMap,
	},
	{
		type: 'wxr' as const,
		source: wxrFileReferences[1],
		authorsMode: 'map' as const,
		authorsMap: {
			remote: 'admin',
		},
		staticAssets: 'hotlink' as const,
		urlsMode: 'preserve' as const,
	},
	{
		type: 'wxr' as const,
		source: wxrFileReferences[2],
		authorsMode: 'map' as const,
		authorsMap: {
			remote: 'admin',
		},
	},
	{
		type: 'wxr' as const,
		source: wxrFileReferences[3],
		authorsMode: 'map' as const,
		authorsMap: {
			remote: 'admin',
		},
	},
	{
		type: 'wxr' as const,
		source: [...wxrFileReferences],
		authorsMode: 'map' as const,
		authorsMap: {
			remote: 'admin',
		},
	},
	{
		type: 'wxr' as const,
		source: wxrFileReferences[0],
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
		source: wxrFileReferences[0],
		authorsMode: 'create' as const,
	},
	{
		type: 'wxr' as const,
		source: wxrFileReferences[1],
		authorsMode: 'default-author' as const,
	},
	{
		type: 'wxr' as const,
		source: [...wxrFileReferences],
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
		source: wxrFileReferences[2],
		authorsMode: 'default-author' as const,
		staticAssets: 'fetch' as const,
		defaultAuthorUsername: 'admin',
		importUsers: false,
		importComments: false,
		urlsMode: 'rewrite' as const,
		urlsMap,
	},
	{
		type: 'wxr' as const,
		source: wxrFileReferences[3],
		authorsMode: 'default-author' as const,
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
		targetDirectoryName: 'plugin-inline-file',
		ifAlreadyInstalled: 'error' as const,
		humanReadableName: 'Inline Plugin',
	},
	{
		source: dataReferences[3],
		active: true,
		targetDirectoryName: 'plugin-inline-directory',
	},
	{
		source: dataReferences[4],
		active: true,
		targetDirectoryName: 'plugin-git',
	},
	{
		source: 'conformance-plugin@1.0',
		active: true,
		targetDirectoryName: 'plugin-directory-source',
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
		source: inlineThemeArchiveReference,
		targetDirectoryName: 'theme-inline-file',
		ifAlreadyInstalled: 'error' as const,
		humanReadableName: 'Inline File Theme',
	},
	{
		source: dataReferences[3],
		targetDirectoryName: 'theme-inline-directory',
		humanReadableName: 'Inline Directory Theme',
	},
	{
		source: dataReferences[4],
		targetDirectoryName: 'theme-git',
	},
	{
		source: 'conformance-theme@1.0',
		targetDirectoryName: 'theme-directory-source',
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
						src: fontFileReferences[0],
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
						src: [...fontFileReferences],
					},
					...(['fallback', 'swap', 'optional'] as const).map(
						(fontDisplay, index) => ({
							fontFamily: 'Conformance Sans',
							fontDisplay,
							src: fontFileReferences[index],
						})
					),
					{
						fontFamily: 'Conformance Sans',
						src: fontFileReferences[3],
					},
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
		step: 'installPlugin' as const,
		source: inlineDirectoryReference,
		active: false,
		targetDirectoryName: 'step-activation-plugin',
	},
	{
		step: 'activatePlugin' as const,
		pluginPath: 'step-activation-plugin/inline-plugin.php',
		humanReadableName: 'Blueprint v2 Activation Plugin',
	},
	{
		step: 'installTheme' as const,
		source: inlineDirectoryReference,
		active: false,
		targetDirectoryName: 'step-activation-theme',
	},
	{
		step: 'activateTheme' as const,
		themeDirectoryName: 'step-activation-theme',
		humanReadableName: 'Blueprint v2 Activation Theme',
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
		themeSlug: 'active-inline-theme',
	},
	...pluginObjectDefinitions.map((definition, index) => ({
		step: 'installPlugin' as const,
		...definition,
		targetDirectoryName: `step-plugin-${index}`,
	})),
	...themeObjectDefinitions.map((definition, index) => ({
		step: 'installTheme' as const,
		active: index % 2 === 0,
		...definition,
		targetDirectoryName: `step-theme-${index}`,
	})),
	{
		step: 'mkdir' as const,
		path: 'site:created',
	},
	{
		step: 'mkdir' as const,
		path: 'site:directory',
	},
	{
		step: 'writeFiles' as const,
		files: {
			...Object.fromEntries(
				dataReferences.map((reference, index) => [
					`site:written-${index}`,
					reference,
				])
			),
			'site:source.txt': {
				filename: 'source.txt',
				content: 'source',
			},
			'site:old.txt': {
				filename: 'old.txt',
				content: 'old',
			},
			'site:file.txt': {
				filename: 'file.txt',
				content: 'remove me',
			},
		},
	},
	{
		step: 'cp' as const,
		fromPath: 'site:source.txt',
		toPath: 'site:copy.txt',
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
	...phpFileReferences.map((code, index) => ({
		step: 'runPHP' as const,
		code,
		env: {
			CASE: String(index),
		},
	})),
	...sqlFileReferences.map((source) => ({
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
	...zipFileReferences.map((zipFile, index) => ({
		step: 'unzip' as const,
		zipFile,
		extractToPath: `site:unzipped-${index}`,
	})),
	{
		step: 'wp-cli' as const,
		command: 'wp option get blogname',
		wpCliPath: '/tmp/wp-cli.phar',
	},
	{
		step: 'enableMultisite' as const,
	},
	{
		step: 'resetData' as const,
		contentTypes: ['posts', 'pages', 'comments'] as const,
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
			loadPhpExtensions: ['intl'],
		},
	},
	contentBaseline: 'empty' as const,
	usersBaseline: 'empty' as const,
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
		'conformance-theme',
		'conformance-theme@1.0',
		dataReferences[0],
		dataReferences[1],
		inlineThemeArchiveReference,
		dataReferences[3],
		dataReferences[4],
		...themeObjectDefinitions,
	],
	plugins: [
		'conformance-plugin',
		'conformance-plugin@1.0',
		...dataReferences,
		...pluginObjectDefinitions,
	],
	muPlugins: [...dataReferences],
	postTypes,
	fonts: {
		url_font: fontFileReferences[0],
		execution_context_font: fontFileReferences[1],
		target_site_font: fontFileReferences[2],
		inline_font: fontFileReferences[3],
		collection: fontCollection,
	},
	media: mediaDefinitions,
	content: contentDefinitions,
	users: [
		{
			username: 'admin',
			email: 'admin@example.com',
			role: 'administrator',
			meta: {
				first_name: 'Schema',
				last_name: 'Administrator',
			},
		},
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

const themeDataReferences = [
	dataReferences[0],
	dataReferences[1],
	inlineThemeArchiveReference,
	dataReferences[3],
	dataReferences[4],
] as const;

const directActiveThemeCases = themeDataReferences.map(
	(activeTheme, index) => ({
		name: `direct active theme data reference ${index + 1}`,
		declaration: {
			version: 2 as const,
			activeTheme,
		},
	})
);

const wordpressDataReferenceCases = dataReferences.map(
	(wordpressVersion, index) => ({
		name: `WordPress data reference ${index + 1}`,
		declaration: {
			version: 2 as const,
			wordpressVersion,
		},
	})
);

const activeThemeObjectSources = [
	'conformance-theme@1.0',
	dataReferences[0],
	dataReferences[1],
	inlineThemeArchiveReference,
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
		name: 'PHP-only Blueprint',
		declaration: {
			version: 2,
			wordpressVersion: 'none',
		},
	},
	{
		name: 'scalar alternatives',
		declaration: {
			version: 2,
			$schema: './blueprint-schema.json',
			contentBaseline: 'keep-all',
			usersBaseline: 'keep-all',
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
			activeTheme: 'conformance-theme',
		},
	},
	{
		name: 'selected content baseline types',
		declaration: {
			version: 2,
			contentBaseline: ['posts', 'pages', 'comments'],
		},
	},
	{
		name: 'single content baseline type',
		declaration: {
			version: 2,
			contentBaseline: 'posts',
		},
	},
	{
		name: 'single page baseline type',
		declaration: {
			version: 2,
			contentBaseline: 'pages',
		},
	},
	...directActiveThemeCases,
	...activeThemeObjectCases,
	...wordpressDataReferenceCases,
] satisfies V2SchemaConformanceCase[];
