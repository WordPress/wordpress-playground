import type {
	URLReference,
	ExecutionContextPath,
	PluginDirectoryReference,
	ThemeDirectoryReference,
	WordPressVersion,
	PHPVersion,
	DataReference,
} from './appendix-B-data-sources';

export type Blueprint = {
	/**
	 * Not a generic 'number' type – this schema is specifically for
	 * Blueprints v2. Version 1 had no "version" field and versions 3, 4,
	 * 5, etc will be different from version 2.
	 */
	version: 2;

	/**
	 * JSON Schema URL.
	 */
	$schema?: URLReference | ExecutionContextPath;

	blueprintMeta?: {
		name?: string; // Example: 'WooCommerce Starter Store with Books'
		description?: string; // Example: "A possible WooCommerce setup for selling books"
		moreInfo?: string; // Any additional information about the blueprint that doesn't fit into the other fields
		version?: string; // Example: "0.0.8"
		authors?: string[]; // Example: ["Riad Benguella", "Adam Zieliński"]
		homepage?: URLReference; // Example: "https://example.com"
		donateLink?: URLReference; // Example: "https://example.com"
		tags?: string[]; // Example: ["woocommerce", "developer environment"]
		license?: LicenseKeyword | string; // Example: "GPLv2 or later"
	};

	/**
	 * Divergence from Blueprints v1:
	 *
	 * There are no `landingPage` or `login` top-level properties.
	 * Instead, Blueprint v2 introduces a dedicated top-level `applicationOptions` property
	 * for declaring options or opinions for different application contexts.
	 *
	 * To keep Blueprints portable and focused on site creation, this specification
	 * only allows two Playground-specific options. Other environments cannot declare
	 * additional options. Future versions of this specification may allow additional
	 * options – they will be discussed on a case-by-case basis.
	 */
	applicationOptions?: {
		/**
		 * Options for the WordPress Playground.
		 */
		'wordpress-playground': {
			/**
			 * The first page the user is redirected to once the Playground is loaded and
			 * the Blueprint is executed.
			 *
			 * @default "/wp-admin"
			 */
			landingPage?: string;

			/**
			 * Whether to log the user in after the Blueprint is executed. If true,
			 * the user is logged in as "admin".
			 *
			 * @default false
			 */
			login?:
				| boolean
				| {
						username: string;
						password: string;
				  };

			/**
			 * Whether to allow the site to access the network.
			 *
			 * @default false
			 */
			networkAccess?: boolean;
		};
	};

	/**
	 * SITE OPTIONS {{{
	 *
	 * There are no "nice" top-level shortcuts such as `siteTitle` to implicitly set "popular"
	 * site options. All the options must be explicitly declared via the `siteOptions` property.
	 * Why? Two reasons:
	 *
	 * * No need to ask developers to learn a new set of identifiers.
	 * * It's unclear which site title should win if the Blueprint declares both
	 *   `siteTitle` and `siteOptions.blogname`.
	 *
	 * The tao of Python says: Explicit is better than implicit. Let's stick with that.
	 */

	/**
	 * Sets the WPLANG constant and downloads any missing translations for WordPress
	 * core and all the installed plugins and themes. If you need a fine-grained
	 * control over the translations, use imperative steps in the `additionalStepsAfterExecution`
	 * array.
	 *
	 * @default "en_US"
	 */
	siteLanguage?: string;

	/**
	 * Site options. In WordPress, the values are PHP-serializable, but Blueprints are
	 * intentionally restricted to an even stricter subset of those, that are JSON-serializable.
	 * This is to prevent passing JavaScript Date objects and similar.
	 *
	 * The runner **MUST** use the WordPress `update_option` function to store the
	 * siteOptions values defined in this property as WordPress options. Lists and
	 * objects are passed to `update_option` as PHP arrays.
	 *
	 * Site options example:
	 *
	 * ```json
	 * {
	 *     "blogname": "Adam's Movies",
	 *     "timezone": "Poland/Warsaw",
	 *     "gutenberg-experiments": {
	 * 			'gutenberg-custom-dataviews': true,
	 * 			'gutenberg-new-posts-dashboard': true,
	 * 			'gutenberg-quick-edit-dataviews': true
	 * 		}
	 * }
	 * ```
	 */
	siteOptions?: {
		/**
		 * Site title.
		 *
		 * Example: "Adam's Movies"
		 * @default "My WordPress Site"
		 */
		blogname?: string;

		/**
		 * Example: "Poland/Warsaw"
		 * @default "UTC"
		 */
		timezone_string?: string;

		/**
		 * Site permalink structure. If present and different from the current permalink structure,
		 * the Blueprint runner will run `$wp_rewrite->flush_rules();`. If you only want to set this
		 * option without flushing the rules, use an explicit `additionalStepsAfterExecution` step.
		 *
		 * Example: "/%year%/%monthnum%/%postname%/" or false for no pretty permalinks.
		 * @default "/%postname%/"
		 */
		permalink_structure?: string | false;
	} & Record<Exclude<string, 'siteUrl'>, JsonValue>;

	/**
	 * }}}
	 */

	/**
	 * Constants to define in the wp-config.php file.
	 *
	 * The runner may overwrite the define() calls in the wp-config.php file
	 * on the target site. It assumes the wp-config.php file at the Blueprint
	 * Execution Target is writable.
	 *
	 * @see https://github.com/WordPress/blueprints-library/issues/118
	 */
	constants?: WordPressConstants;

	/**
	 * WordPress version to install.
	 *
	 * When we're setting up the entire site, this will be used to resolve the
	 * installed WordPress version. The latest version matching the constraint
	 * will be chosen.
	 *
	 * When we're applying this Blueprint to an existing site, this will be used
	 * as an integrity check to verify that the currently installed version of
	 * WordPress installed on the target site matches the constraint.
	 *
	 * @default "latest".
	 */
	wordpressVersion?:
		| WordPressVersion
		| DataReference
		| {
				min: WordPressVersion;
				max?: WordPressVersion;
				/**
				 * @default "latest"
				 */
				preferred?: WordPressVersion;
		  };

	/**
	 * The PHP version required for this Blueprint to work.
	 *
	 * In runtimes where we set up the runtime, such as Playground and wp-env, the
	 * runner will choose a version compatible with this constraint.
	 *
	 * In other environments, this is used for validation. The Blueprint engine will
	 * throw an error if the currently running PHP version doesn't match this constraint.
	 *
	 * @default "8.0". Changing the default value will bump the Blueprint version.
	 *
	 * @see https://github.com/WordPress/blueprints-library/issues/47
	 */
	phpVersion?:
		| PHPVersion
		| {
				min?: PHPVersion;
				recommended?: PHPVersion;
				max?: PHPVersion;
		  };

	/**
	 * The theme to install and also activate.
	 *
	 * > Why not support an `active` property in the `themes` array?
	 *
	 * Because an `"active"` property would have to default to `false` for themes while it
	 * defaults to `true` for plugins. That's error-prone and confusing.
	 *
	 * @example `"activeTheme": "stylish-press-theme"`
	 * @example `"activeTheme": "adventurer@4.6.0"`
	 * @example
	 * ```json
	 * "activeTheme": {
	 *     "source": "https://github.com/richtabor/kanso/archive/refs/heads/main.zip",
	 *     "id": "kanso"
	 * }
	 * ```
	 */
	activeTheme?: ThemeDefinition;

	/**
	 * Installed themes to install without activating them.
	 *
	 * Example:
	 *
	 * ```json
	 * themes: [
	 *     "stylish-press-theme",
	 *     "adventurer@4.6.0",
	 *     {
	 *         "source": "https://github.com/richtabor/kanso/archive/refs/heads/main.zip",
	 *         "id": "kanso"
	 *     }
	 * ]
	 * ```
	 */
	themes?: ThemeDefinition[];

	/**
	 * A list of plugins to install and activate.
	 *
	 * Example:
	 *
	 * ```json
	 * plugins: [
	 *     "jetpack",
	 *     "akismet@6.4.3",
	 *     "./query-monitor.php",
	 *     "./code-block.zip",
	 *     {
	 *         "source": "https://github.com/woocommerce/woocommerce/archive/refs/heads/6.4.3.zip",
	 *         "active": false
	 *     }
	 * ]
	 */
	plugins?: PluginDefinition[];

	/**
	 * A list of mu-plugins to install.
	 *
	 * Example:
	 *
	 * ```json
	 * muPlugins: [
	 *     {
	 *         "file": {
	 *             "filename": "addFilter-0.php",
	 *             "content": "<?php add_action( 'requests-requests.before_request', function( &$url ) {\n$url = 'https://playground.wordpress.net/cors-proxy.php?' . $url;\n} );"
	 *         }
	 *     }
	 * ]
	 * ```
	 */
	muPlugins?: Array<DataReference>;

	/**
	 * Very basic schema for defining custom post types.
	 *
	 * IMPORTANT: Using this property requires an explicit inclusion of the
	 * `secure-custom-fields` plugin. If it's missing, the Blueprint runner will
	 * throw an error.
	 *
	 * See https://github.com/WordPress/blueprints-library/issues/32 for more context.
	 */
	postTypes?: Record<PostTypeKey, PostType | ExecutionContextPath>;

	/**
	 * A list of fonts to register in the site's Font Library.
	 *
	 * Example:
	 *
	 * ```json
	 * fonts: {
	 *     "open-sans": "https://example.com/fonts/open-sans.woff2",
	 *     "roboto": "./wp-content/fonts/roboto.woff2"
	 * }
	 * ```
	 *
	 * Or using the full font collection schema:
	 *
	 * ```json
	 * fonts: {
	 *     "my-collection": {
	 *         "font_families": [
	 *             {
	 *                 "font_family_settings": {
	 *                     "name": "Open Sans",
	 *                     "slug": "open-sans",
	 *                     "fontFamily": "Open Sans",
	 *                     "preview": "https://example.com/previews/open-sans.png",
	 *                     "fontFace": [
	 *                         {
	 *                             "fontFamily": "Open Sans",
	 *                             "fontWeight": "400",
	 *                             "fontStyle": "normal",
	 *                             "src": "./wp-content/fonts/open-sans-regular.woff2"
	 *                         }
	 *                     ]
	 *                 },
	 *                 "categories": ["sans-serif"]
	 *             }
	 *         ]
	 *     }
	 * }
	 * ```
	 */
	fonts?: Record<string, DataReference | FontCollection>;

	/**
	 * A list of media files to upload to the WordPress Media Library – in formats
	 * supported by the WordPress Media Library.
	 *
	 * Example:
	 *
	 * ```json
	 * media: [
	 *     "https://example.com/images/hero.jpg",
	 *     "./wp-content/uploads/2024/01/logo.png",
	 *     {
	 *         "source": "https://example.com/videos/intro.mp4",
	 *         "title": "Introduction Video",
	 *         "description": "A brief introduction to our company",
	 *         "alt": "Company introduction video"
	 *     },
	 *     {
	 *         "source": "./wp-content/uploads/2024/01/brochure.pdf",
	 *         "title": "Product Brochure",
	 *         "description": "Detailed information about our products"
	 *     }
	 * ]
	 * ```
	 *
	 */
	media?: Array<MediaDefinition>;

	// Site data {{{

	content?: Array<ContentDefinition>;

	users?: Array<{
		username: string;
		email: string;
		role: string;
		meta: Record<string, string>;
	}>;

	roles?: Array<{
		name: string;
		capabilities: Record<string, string>;
	}>;

	// }}}

	additionalStepsAfterExecution?: Array<Step>;
};

type LicenseKeyword =
	| 'AFL-3.0'
	| 'Apache-2.0'
	| 'Artistic-2.0'
	| 'BSL-1.0'
	| 'BSD-2-Clause'
	| 'BSD-3-Clause'
	| 'BSD-3-Clause-Clear'
	| 'BSD-4-Clause'
	| '0BSD'
	| 'CC'
	| 'CC0-1.0'
	| 'CC-BY-4.0'
	| 'CC-BY-SA-4.0'
	| 'WTFPL'
	| 'ECL-2.0'
	| 'EPL-1.0'
	| 'EPL-2.0'
	| 'EUPL-1.1'
	| 'AGPL-3.0'
	| 'GPL'
	| 'GPL-2.0'
	| 'GPL-3.0'
	| 'LGPL'
	| 'LGPL-2.1'
	| 'LGPL-3.0'
	| 'ISC'
	| 'LPPL-1.3c'
	| 'MS-PL'
	| 'MIT'
	| 'MPL-2.0'
	| 'OSL-3.0'
	| 'PostgreSQL'
	| 'OFL-1.1'
	| 'NCSA'
	| 'Unlicense'
	| 'Zlib';

type URLMappingConfig = {
	/**
	 * Whether to rewrite the hrefs in the remote site's content URLs in the WXR file
	 * from the remote site domain to the current site domain's (and path etc).
	 *
	 * Possible values:
	 *
	 * * "rewrite" – Rewrite the hrefs to the current site domain's (and path etc).
	 * * "preserve" – Preserve the hrefs as they are.
	 *
	 * @default "rewrite".
	 */
	urlsMode?: 'rewrite' | 'preserve';

	/**
	 * A mapping of base URLs to rewrite.
	 */
	urlsMap?: Record<URLReference, URLReference>;
};

type ContentDefinition =
	| ({
			type: 'mysql-dump';
			source: DataReference | DataReference[];
	  } & URLMappingConfig)
	| ({
			type: 'posts';
			source:
				| DataReference
				| DataReference[]
				| WordPressPost
				| WordPressPost[];
	  } & URLMappingConfig)
	/**
	 * WXR files to import.
	 *
	 * Example:
	 *
	 * ```json
	 * content: [
	 *     {
	 *         "type": "wxr",
	 *         "https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/stylish-press/woo-products.wxr"
	 *     },
	 *     {
	 *         "type": "wxr",
	 *         "url": "https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/stylish-press/site-content.wxr",
	 *         "rewriteUrls": true,
	 *         "fetchStaticAssets": false,
	 *         "users": false,
	 *         "comments": false,
	 *     }
	 * ]
	 * ```
	 */
	| ({
			type: 'wxr';
			source: DataReference;

			/**
			 * Static assets handling.
			 *
			 * Possible values:
			 *
			 * * "fetch" – Fetch the static assets and save them to the local filesystem.
			 * * "hotlink" – Hotlink the static assets from the remote site.
			 *
			 * @default "fetch".
			 */
			staticAssets?: 'fetch' | 'hotlink';

			/**
			 * How to handle authors that don't exist on the current site.
			 *
			 * Possible values:
			 *
			 * * "create" – Create a new author.
			 * * "default-author" – Use the default author.
			 * * "map" – Map the author to an existing author on the current site.
			 *
			 * @default "create".
			 */
			authorsMode?: 'create' | 'default-author' | 'map';

			/**
			 * The default author to use when `mode` is "default-author".
			 *
			 * @default "admin".
			 */
			defaultAuthorUsername?: string;

			/**
			 * Map post authors from the remote site to the current site.
			 *
			 * When not provided, the importer will attempt to match the authors by
			 * username, email, or name.
			 *
			 * Required when `authorsMode` is "map".
			 *
			 * @default undefined.
			 */
			authorsMap?: Record<RemoteUsername, LocalUsername>;

			/**
			 * Whether to import users from the remote site.
			 *
			 * @default false.
			 */
			importUsers?: boolean;

			/**
			 * Whether to import comments from the remote site.
			 *
			 * @default false.
			 */
			importComments?: boolean;

			/**
			 * Whether to import site settings from the remote site.
			 *
			 * @default false.
			 */
			importSiteOptions?: boolean;
	  } & URLMappingConfig);

type MediaDefinition =
	| DataReference
	| {
			source: DataReference;
			title?: string;
			description?: string;
			alt?: string;
			caption?: string;
	  };

type PluginDefinition =
	| DataReference
	| PluginDirectoryReference
	| PluginObjectDefinition;

// Separated from PluginDefinition to avoid duplicate step entries in the generated JSON schema
type PluginObjectDefinition = {
	source: DataReference | PluginDirectoryReference;

	/**
	 * Whether to activate the plugin.
	 *
	 * @default true.
	 */
	active?: boolean;

	/**
	 * Parameters to pass to the plugin during activation.
	 *
	 * These options are stored in a site option that the plugin can access
	 * during its activation hook. The option name is:
	 *
	 * ```php
	 * 'blueprint_activation_' . plugin_basename( __FILE__ )
	 * ```
	 *
	 * This ensures uniqueness even when multiple versions of the same plugin exist.
	 * This is similar to how the `register_activation_hook` function requires the
	 * plugin file path as its first argument.
	 *
	 * The Blueprint runner will remove the option after activating the plugin.
	 *
	 * Example:
	 *
	 * In the Blueprint:
	 * ```json
	 * {
	 *     "source": "woocommerce",
	 *     "activationOptions": {
	 *         "storeCity": "Wrocław",
	 *         "storeCountry": "Poland",
	 *         "storePostalCode": "53-607"
	 *     }
	 * }
	 * ```
	 *
	 * In the plugin's activation hook:
	 *
	 * ```php
	 * register_activation_hook( __FILE__, function( $network_wide ) {
	 *     // Get the activation options from the transient
	 *     $option_name = 'blueprint_activation_' . plugin_basename( __FILE__ );
	 *     $blueprint_activation_options = get_option( $option_name ) ?? [];
	 *
	 *     if ( $blueprint_activation_options ) {
	 *         $store_city = $blueprint_activation_options['storeCity'] ?? '';
	 *         $store_country = $blueprint_activation_options['storeCountry'] ?? '';
	 *         $store_postal_code = $blueprint_activation_options['storePostalCode'] ?? '';
	 *
	 *         // ...do something with the options...
	 *     }
	 *
	 *     // Continue with normal activation...
	 * } );
	 * ```
	 */
	activationOptions?: Record<string, JsonValue>;

	/**
	 * An explicit directory name within wp-content/plugins to install the plugin at.
	 * If not provided, it will be inferred from the plugin source.
	 */
	targetDirectoryName?: string;

	/**
	 * Sometimes it's fine when a plugin fails to install.
	 *
	 * Use-case:
	 *   Compatibility testing. A Blueprint may install WordPress nightly with
	 *   a number of plugins to test. Some of those plugins may not yet be compatible
	 *   with the latest version of WordPress. This is something to take not of,
	 *   but not a strong reason to fail the entire Blueprint installation.
	 *
	 * @see https://github.com/WordPress/wordpress-playground/issues/600
	 * @default "throw"
	 */
	onError?: 'skip-plugin' | 'throw';

	/**
	 * Human-readable name of the plugin for the progress bar.
	 *
	 * For example, with the following Blueprint:
	 *
	 * ```json
	 * {
	 *     "plugins": [
	 *         {
	 *             "source": "https://github.com/Automattic/jetpack/archive/refs/heads/beta.zip",
	 *             "humanReadableName": "Jetpack Beta"
	 *         }
	 *     ]
	 * }
	 * ```
	 *
	 * The progress bar will show "Installing Jetpack Beta plugin" instead of
	 * "Installing https://github.com/Automattic/jetpack/archive/refs/heads/beta.zip".
	 */
	humanReadableName?: string;
};

type ThemeDefinition =
	| ThemeDirectoryReference
	| DataReference
	| ThemeObjectDefinition;

// Separated from ThemeDefinition to avoid duplicate step entries in the generated JSON schema
type ThemeObjectDefinition = {
	source: ThemeDirectoryReference | DataReference;
	/**
	 * Whether to import the theme's starter content after installing it.
	 */
	importStarterContent?: boolean;
	/**
	 * An explicit directory name within wp-content/themes to install the theme at.
	 * If not provided, it will be inferred from the theme source.
	 */
	targetDirectoryName?: string;
	/**
	 * Human-readable name of the theme for the progress bar.
	 *
	 * For example, with the following Blueprint:
	 *
	 * ```json
	 * {
	 *     "themes": [
	 *         {
	 *             "source": "https://github.com/Automattic/adventurer/archive/refs/heads/beta.zip",
	 *             "humanReadableName": "Adventurer"
	 *         }
	 *     ]
	 * }
	 * ```
	 *
	 * The progress bar will show "Installing Adventurer theme" instead of
	 * "Installing https://github.com/Automattic/adventurer/archive/refs/heads/beta.zip".
	 */
	humanReadableName?: string;
};

type RemoteUsername = 'string';
type LocalUsername = 'string';

/**
 * WordPress register_post_type() arguments representation. {{{
 *
 * The inline docstrings are copied from the WordPress code reference.
 *
 * @see https://developer.wordpress.org/reference/functions/register_post_type/
 */

/**
 * Post type key. Must not exceed 20 characters and may only
 * contain lowercase alphanumeric characters, dashes, and underscores.
 */
type PostTypeKey = string;
type Block = [string, Record<string, JsonValue>];

type PostType = {
	/**
	 * Name of the post type shown in the menu. Usually plural.
	 * Default is value of $labels['name'].
	 */
	label?: string;
	/**
	 * An array of labels for this post type.
	 * If not set, post labels are inherited for non-hierarchical types
	 * and page labels for hierarchical ones
	 *
	 * The labels documented for WordPress 6.8 are listed below,
	 * and this type also supports an arbitrary set of labels to
	 * support future WordPress releases.
	 *
	 * @see https://developer.wordpress.org/reference/functions/get_post_type_labels/
	 */
	labels?: {
		/**
		 * General name for the post type, usually plural.
		 * Default is 'Posts' / 'Pages'.
		 */
		name?: string;
		/**
		 * Name for one object of this post type.
		 * Default is 'Post' / 'Page'.
		 */
		singular_name?: string;
		/**
		 * Label for adding a new item.
		 * Default is 'Add New' / 'Add New'.
		 */
		add_new?: string;
		/**
		 * Label for adding a new singular item.
		 * Default is 'Add New Post' / 'Add New Page'.
		 */
		add_new_item?: string;
		/**
		 * Label for editing a singular item.
		 * Default is 'Edit Post' / 'Edit Page'.
		 */
		edit_item?: string;
		/**
		 * Label for the new item page title.
		 * Default is 'New Post' / 'New Page'.
		 */
		new_item?: string;
		/**
		 * Label for viewing a singular item.
		 * Default is 'View Post' / 'View Page'.
		 */
		view_item?: string;
		/**
		 * Label for viewing post type archives.
		 * Default is 'View Posts' / 'View Pages'.
		 */
		view_items?: string;
		/**
		 * Label for searching plural items.
		 * Default is 'Search Posts' / 'Search Pages'.
		 */
		search_items?: string;
		/**
		 * Label used when no items are found.
		 * Default is 'No posts found' / 'No pages found'.
		 */
		not_found?: string;
		/**
		 * Label used when no items are in the Trash.
		 * Default is 'No posts found in Trash' / 'No pages found in Trash'.
		 */
		not_found_in_trash?: string;
		/**
		 * Label used to prefix parents of hierarchical items.
		 * Default is 'Parent Page:'.
		 */
		parent_item_colon?: string;
		/**
		 * Label to signify all items in a submenu link.
		 * Default is 'All Posts' / 'All Pages'.
		 */
		all_items?: string;
		/**
		 * Label for archives in nav menus.
		 * Default is 'Post Archives' / 'Page Archives'.
		 */
		archives?: string;
		/**
		 * Label for the attributes meta box.
		 * Default is 'Post Attributes' / 'Page Attributes'.
		 */
		attributes?: string;
		/**
		 * Label for the media frame button.
		 * Default is 'Insert into post' / 'Insert into page'.
		 */
		insert_into_item?: string;
		/**
		 * Label for the media frame filter.
		 * Default is 'Uploaded to this post' / 'Uploaded to this page'.
		 */
		uploaded_to_this_item?: string;
		/**
		 * Label for the featured image meta box title.
		 * Default is 'Featured image'.
		 */
		featured_image?: string;
		/**
		 * Label for setting the featured image.
		 * Default is 'Set featured image'.
		 */
		set_featured_image?: string;
		/**
		 * Label for removing the featured image.
		 * Default is 'Remove featured image'.
		 */
		remove_featured_image?: string;
		/**
		 * Label in the media frame for using a featured image.
		 * Default is 'Use as featured image'.
		 */
		use_featured_image?: string;
		/**
		 * Label for the menu name.
		 * Default is the same as name.
		 */
		menu_name?: string;
		/**
		 * Label for the table views hidden heading.
		 * Default is 'Filter posts list' / 'Filter pages list'.
		 */
		filter_items_list?: string;
		/**
		 * Label for the date filter in list tables.
		 * Default is 'Filter by date'.
		 */
		filter_by_date?: string;
		/**
		 * Label for the table pagination hidden heading.
		 * Default is 'Posts list navigation' / 'Pages list navigation'.
		 */
		items_list_navigation?: string;
		/**
		 * Label for the table hidden heading.
		 * Default is 'Posts list' / 'Pages list'.
		 */
		items_list?: string;
		/**
		 * Label used when an item is published.
		 * Default is 'Post published.' / 'Page published.'
		 */
		item_published?: string;
		/**
		 * Label used when an item is published with private visibility.
		 * Default is 'Post published privately.' / 'Page published privately.'
		 */
		item_published_privately?: string;
		/**
		 * Label used when an item is switched to a draft.
		 * Default is 'Post reverted to draft.' / 'Page reverted to draft.'
		 */
		item_reverted_to_draft?: string;
		/**
		 * Label used when an item is moved to Trash.
		 * Default is 'Post trashed.' / 'Page trashed.'
		 */
		item_trashed?: string;
		/**
		 * Label used when an item is scheduled for publishing.
		 * Default is 'Post scheduled.' / 'Page scheduled.'
		 */
		item_scheduled?: string;
		/**
		 * Label used when an item is updated.
		 * Default is 'Post updated.' / 'Page updated.'
		 */
		item_updated?: string;
		/**
		 * Title for a navigation link block variation.
		 * Default is 'Post Link' / 'Page Link'.
		 */
		item_link?: string;
		/**
		 * Description for a navigation link block variation.
		 * Default is 'A link to a post.' / 'A link to a page.'
		 */
		item_link_description?: string;
	} & Record<string, string>;
	/**
	 * A short descriptive summary of what the post type is.
	 */
	description?: string;
	/**
	 * Whether a post type is intended for use publicly either via the admin interface or by front-end users.
	 * While the default settings of $exclude_from_search, $publicly_queryable, $show_ui, and $show_in_nav_menus
	 * are inherited from $public, each does not rely on this relationship and controls a very specific intention.
	 * Default false.
	 */
	public?: boolean;
	/**
	 * Whether the post type is hierarchical (e.g. page).
	 * Default false.
	 */
	hierarchical?: boolean;
	/**
	 * Whether to exclude posts with this post type from front end search results.
	 * Default is the opposite value of $public.
	 */
	exclude_from_search?: boolean;
	/**
	 * Whether queries can be performed on the front end for the post type as part of parse_request().
	 * Endpoints would include:
	 * * ?post_type={post_type_key}
	 * * ?{post_type_key}={single_post_slug}
	 * * ?{post_type_query_var}={single_post_slug}
	 * If not set, the default is inherited from $public.
	 */
	publicly_queryable?: boolean;
	/**
	 * Whether to generate and allow a UI for managing this post type in the admin.
	 * Default is value of $public.
	 */
	show_ui?: boolean;
	/**
	 * Where to show the post type in the admin menu. To work, $show_ui must be true.
	 * If true, the post type is shown in its own top level menu.
	 * If false, no menu is shown.
	 * If a string of an existing top level menu ('tools.php' or 'edit.php?post_type=page', for example),
	 * the post type will be placed as a sub-menu of that.
	 * Default is value of $show_ui.
	 */
	show_in_menu?: boolean | string;
	/**
	 * Makes this post type available via the admin bar.
	 * Default is value of $show_in_menu.
	 */
	show_in_admin_bar?: boolean;
	/**
	 * Makes this post type available for selection in navigation menus.
	 * Default is value of $public.
	 */
	show_in_nav_menus?: boolean;
	/**
	 * Whether to include the post type in the REST API.
	 * Set this to true for the post type to be available in the block editor.
	 */
	show_in_rest?: boolean;
	/**
	 * To change the base URL of REST API route.
	 * Default is $post_type.
	 */
	rest_base?: string;
	/**
	 * To change the namespace URL of REST API route.
	 * Default is wp/v2.
	 */
	rest_namespace?: string;
	/**
	 * REST API controller class name.
	 * Default is 'WP_REST_Posts_Controller'.
	 */
	rest_controller_class?: string;
	/**
	 * The URL to the icon to be used for this menu.
	 * Pass a base64-encoded SVG using a data URI, which will be colored to match the color scheme —
	 * this should begin with 'data:image/svg+xml;base64,'.
	 * Pass the name of a Dashicons helper class to use a font icon, e.g. 'dashicons-chart-pie'.
	 * Pass 'none' to leave div.wp-menu-image empty so an icon can be added via CSS.
	 * Defaults to use the posts icon.
	 */
	menu_icon?: string;
	/**
	 * The position in the menu order the post type should appear.
	 * To work, $show_in_menu must be true.
	 * Default null (at the bottom).
	 */
	menu_position?: string | number;
	/**
	 * Whether to rename the capabilities for this post type.
	 */
	rename_capabilities?: boolean;
	/**
	 * The singular capability name for this post type.
	 */
	singular_capability_name?: string;
	/**
	 * The plural capability name for this post type.
	 */
	plural_capability_name?: string;
	/**
	 * An array of taxonomy identifiers that will be registered for the post type.
	 * Taxonomies can be registered later with register_taxonomy() or register_taxonomy_for_object_type().
	 */
	taxonomies?: string[];
	/**
	 * The query var name for this post type.
	 */
	query_var_name?: string;
	/**
	 * Provide a callback function that sets up the meta boxes for the edit form.
	 * Do remove_meta_box() and add_meta_box() calls in the callback.
	 * Default null.
	 */
	register_meta_box_cb?: string;
	/**
	 * Custom text for the "Enter title here" placeholder in the title field.
	 */
	enter_title_here?: string;
	/**
	 * The string to use to build the read, edit, and delete capabilities.
	 * May be passed as an array to allow for alternative plurals when using this argument as a base to construct the capabilities,
	 * e.g. array('story', 'stories').
	 * Default 'post'.
	 */
	capability_type?: string | [string, string];
	/**
	 * Array of capabilities for this post type.
	 * $capability_type is used as a base to construct capabilities by default.
	 * See get_post_type_capabilities().
	 */
	capabilities?: { [key: string]: string };
	/**
	 * Whether to use the internal default meta capability handling.
	 * Default false.
	 */
	map_meta_cap?: boolean;
	/**
	 * Core feature(s) the post type supports. Serves as an alias for calling add_post_type_support() directly.
	 *
	 * Core features include 'title', 'editor', 'comments', 'revisions', 'trackbacks', 'author', 'excerpt',
	 * 'page-attributes', 'thumbnail', 'custom-fields', and 'post-formats'.
	 *
	 * Additionally, the 'revisions' feature dictates whether the post type will store revisions,
	 * the 'autosave' feature dictates whether the post type will be autosaved,
	 * and the 'comments' feature dictates whether the comments count will show on the edit screen.
	 *
	 * For backward compatibility reasons, adding 'editor' support implies 'autosave' support too.
	 *
	 * A feature can also be specified as an array of arguments to provide additional information about supporting that feature.
	 *
	 * Example: array( 'my_feature', array( 'field' => 'value' ) ).
	 *
	 * If false, no features will be added.
	 * Default is an array containing 'title' and 'editor'.
	 */
	supports?: Array<
		| 'title'
		| 'editor'
		| 'author'
		| 'thumbnail'
		| 'excerpt'
		| 'trackbacks'
		| 'custom-fields'
		| 'comments'
		| 'revisions'
		| 'page-attributes'
		| 'post-formats'
	> &
		string[];
	/**
	 * Whether there should be post type archives, or if a string, the archive slug to use.
	 * Will generate the proper rewrite rules if $rewrite is enabled.
	 * Default false.
	 */
	has_archive?: boolean | string;
	/**
	 * Triggers the handling of rewrites for this post type. To prevent rewrite, set to false.
	 * Defaults to true, using $post_type as slug.
	 * To specify rewrite rules, an array can be passed with any of these keys:
	 * - slug (string): Customize the permastruct slug. Defaults to $post_type key.
	 * - with_front (bool): Whether the permastruct should be prepended with WP_Rewrite::$front. Default true.
	 * - feeds (bool): Whether the feed permastruct should be built for this post type. Default is value of $has_archive.
	 * - pages (bool): Whether the permastruct should provide for pagination. Default true.
	 * - ep_mask (int): Endpoint mask to assign. If not specified and permalink_epmask is set, inherits from $permalink_epmask.
	 *   If not specified and permalink_epmask is not set, defaults to EP_PERMALINK.
	 */
	rewrite?:
		| boolean
		| {
				slug?: string;
				with_front?: boolean;
				pages?: boolean;
				feeds?: boolean;
				ep_mask?: number;
		  };
	/**
	 * Sets the query_var key for this post type.
	 * Defaults to $post_type key.
	 * If false, a post type cannot be loaded at ?{query_var}={post_slug}.
	 * If specified as a string, the query ?{query_var_string}={post_slug} will be valid.
	 */
	query_var?: boolean | string;
	/**
	 * Whether to allow this post type to be exported.
	 * Default true.
	 */
	can_export?: boolean;
	/**
	 * Whether to delete posts of this type when deleting a user.
	 * If true, posts of this type belonging to the user will be moved to Trash when the user is deleted.
	 * If false, posts of this type belonging to the user will *not* be trashed or deleted.
	 * If not set (the default), posts are trashed if post type supports the 'author' feature.
	 * Otherwise posts are not trashed or deleted.
	 * Default null.
	 */
	delete_with_user?: boolean;
	/**
	 * Array of blocks to use as the default initial state for an editor session.
	 * Each item should be an array containing block name and optional attributes.
	 */
	template?: Array<Block>;
	/**
	 * Whether the block template should be locked if $template is set.
	 * If set to 'all', the user is unable to insert new blocks, move existing blocks and delete blocks.
	 * If set to 'insert', the user is able to move existing blocks but is unable to insert new blocks and delete blocks.
	 * Default false.
	 */
	template_lock?: 'all' | 'insert' | false;
};
/**
 * }}}
 */

/**
 * FONTS DECLARATIONS {{{
 * This mirrors WordPress core's font-collection.json schema.
 */

/**
 * Font face settings with added preview property.
 */
type FontFace = {
	/** URL to a preview image of the font. */
	preview?: string;
	/** CSS font-family value. */
	fontFamily: string;
	/** CSS font-style value. */
	fontStyle?: string;
	/** List of available font weights, separated by a space. */
	fontWeight?: string | number;
	/** CSS font-display value. */
	fontDisplay?: 'auto' | 'block' | 'fallback' | 'swap' | 'optional';
	/** Paths or URLs to the font files. */
	src: DataReference | DataReference[];
	/** CSS font-stretch value. */
	fontStretch?: string;
	/** CSS ascent-override value. */
	ascentOverride?: string;
	/** CSS descent-override value. */
	descentOverride?: string;
	/** CSS font-variant value. */
	fontVariant?: string;
	/** CSS font-feature-settings value. */
	fontFeatureSettings?: string;
	/** CSS font-variation-settings value. */
	fontVariationSettings?: string;
	/** CSS line-gap-override value. */
	lineGapOverride?: string;
	/** CSS size-adjust value. */
	sizeAdjust?: string;
	/** CSS unicode-range value. */
	unicodeRange?: string;
};

/**
 * Font collection schema for WordPress Font Library.
 */
type FontCollection = {
	/** JSON schema URI for font-collection.json. */
	$schema?: string;
	/** Array of font families ready to be installed. */
	font_families: Array<{
		/** Font family settings with added preview property. */
		font_family_settings: {
			/** Name of the font family preset, translatable. */
			name: string;
			/** Kebab-case unique identifier for the font family preset. */
			slug: string;
			/** CSS font-family value. */
			fontFamily: string;
			/** URL to a preview image of the font family. */
			preview?: string;
			/** Array of font-face definitions. */
			fontFace?: FontFace[];
		};
		/** Array of category slugs. */
		categories?: string[];
	}>;
};

/**
 * WordPress Content Schema {{{
 */

/**
 * Post data type. It is inspired by the wp_insert_post() arguments,
 * but it diverges from it in a few ways.
 */
type WordPressPost = {
	/**
	 * Username of the post author.
	 *
	 * If missing, the default value will be resolved in the following order
	 * until one is available:
	 *
	 * * Default user defined in the runner configuration.
	 * * The first administrator in the database.
	 * * The first user in the database.
	 * * A newly created user.
	 *
	 * The aggressive resolution is necessary because post_author is NOT NULL
	 * in the database schema.
	 */
	post_author?: number;

	/**
	 * The date of the post in UTC. Accepts format 'YYYY-MM-DD HH:MM:SS'.
	 * Can be used to schedule future posts (when used with post_status: 'future').
	 *
	 * @default Current time
	 */
	post_date?: string;

	/**
	 * The main post content. Can contain HTML, shortcodes, etc.
	 * While technically optional, posts are usually expected to have content.
	 *
	 * @default ''
	 */
	post_content?: string;

	/** The post title. */
	post_title: string;

	/** The post excerpt. Default empty. */
	post_excerpt?: string;

	/** The post status */
	post_status?:
		| 'publish'
		| 'pending'
		| 'draft'
		| 'auto-draft'
		| 'future'
		| 'private'
		| 'inherit'
		| 'trash';

	/** The post type (e.g., 'post', 'page'). Default 'post'. */
	post_type?: string;

	/**
	 * Whether comments are allowed ('open' or 'closed').
	 *
	 * @default 'open'.
	 */
	comment_status?: 'open' | 'closed';

	/** A password to protect access. Default empty. */
	post_password?: string;

	/** The URL slug. Default sanitized post_title for new posts. */
	post_name?: string;

	/** Post parent name for hierarchical post types (e.g., pages). Default empty. */
	post_parent_name?: string;

	/** Menu order within a post type. Default 0. */
	menu_order?: number;

	/** MIME type for attachments. Default empty. */
	post_mime_type?: string;

	/** Global Unique ID. Default empty. */
	guid?: string;

	/** Array of category slugs. Defaults to the site's default category. */
	post_category?: string[];

	/** Array of tag names. Default empty. */
	post_tags?: Array<string>;

	/**
	 * Taxonomy terms keyed by taxonomy name.
	 * For hierarchical taxonomies: array of term names.
	 * For non-hierarchical: array of term names or slugs.
	 *
	 * Examples:
	 * ```json
	 * tax_input: {
	 *   // For hierarchical taxonomies like categories
	 *   "category": ["Books", "Fiction", "Science Fiction"],
	 *
	 *   // For non-hierarchical taxonomies like tags
	 *   "post_tag": ["bestseller", "featured", "summer-reading"],
	 *
	 *   // For custom taxonomies
	 *   "genre": ["mystery", "thriller"],
	 *   "author": ["Jane Doe", "John Smith"]
	 * }
	 * ```
	 */
	tax_input?: Record<string, Array<string>>;

	/**
	 * Post meta keyed by meta key to value. Default empty.
	 *
	 * Examples:
	 * ```json
	 * meta_input: {
	 *   // Simple values
	 *   "price": "19.99",
	 *   "in_stock": true,
	 *   "stock": 42,
	 *
	 *   // Array values
	 *   "related_products": [123, 456, 789],
	 *   "product_colors": ["red", "blue", "green"],
	 *
	 *   // Object values
	 *   "_product_attributes": {
	 *     "color": {
	 *       "name": "Color",
	 *       "value": "Red",
	 *       "position": 0,
	 *       "visible": true
	 *     }
	 *   },
	 *   "seo_data": {
	 *     "title": "Custom SEO Title",
	 *     "description": "Custom meta description",
	 *     "keywords": ["product", "featured"]
	 *   }
	 * }
	 * ```
	 */
	meta_input?: Record<string, JsonValue>;

	/**
	 * Specifies the page template file to use.
	 * This parameter only applies if post_type is 'page'. For other post types, it's ignored.
	 * Provide the template filename (e.g., 'template-contact.php'). Include subdirectory if applicable (e.g., 'templates/full-width.php').
	 * To set a template for non-page post types, use meta_input with key '_wp_page_template'.
	 *
	 * @default ''
	 */
	page_template?: string;

	/**
	 * Properties intentionally left out as not particularly useful:
	 *
	 * // The date of the post in the GMT timezone. Accepts format 'YYYY-MM-DD HH:MM:SS'.
	 * // This schema only supports UTC time via the post_date field.
	 * post_date_gmt?: string;
	 *
	 * // Space- or newline-separated list of URLs to ping. Default empty.
	 * to_ping?: string;
	 *
	 * // Space- or newline-separated list of URLs already pinged. Default empty.
	 * pinged?: string;
	 *
	 * ping_status?: 'open' | 'closed';
	 */
};

/**
 * }}}
 */

type ActivatePluginStep = {
	step: 'activatePlugin';
	/**
	 * Path to the plugin directory as absolute path
	 * (/wordpress/wp-content/plugins/plugin-name); or the plugin entry file
	 * relative to the plugins directory (plugin-name/plugin-name.php).
	 */
	pluginPath: string;
	/**
	 * Human-readable name of the plugin for the progress bar.
	 *
	 * For example, with the following Blueprint:
	 *
	 * ```json
	 * {
	 *     "steps": [
	 *         {
	 *             "step": "activatePlugin",
	 *             "pluginPath": "wordpress-seo/wp-seo.php",
	 *             "humanReadableName": "Yoast SEO"
	 *         }
	 *     ]
	 * }
	 * ```
	 *
	 * The progress bar will show "Activating Yoast SEO" instead of
	 * "Activating wordpress-seo/wp-seo.php".
	 */
	humanReadableName?: string;
};

type ActivateThemeStep = {
	step: 'activateTheme';
	/**
	 * The name of the theme directory inside wp-content/themes/
	 */
	themeDirectoryName: string;
	/**
	 * Human-readable name of the theme for the progress bar.
	 *
	 * For example, with the following Blueprint:
	 *
	 * ```json
	 * {
	 *     "steps": [
	 *         {
	 *             "step": "activateTheme",
	 *             "themeDirectoryName": "twentytwentythree",
	 *             "humanReadableName": "Twenty Twenty-Three"
	 *         }
	 *     ]
	 * }
	 * ```
	 *
	 * The progress bar will show "Activating Twenty Twenty-Three" instead of
	 * "Activating twentytwentythree".
	 */
	humanReadableName?: string;
};

type CpStep = {
	step: 'cp';
	fromPath: string;
	toPath: string;
};

type WordPressConstants = Record<string, boolean | string | number> &
	Partial<{
		WP_DEBUG: boolean;
		WP_DEBUG_LOG: boolean;
		WP_DEBUG_DISPLAY: boolean;
		SCRIPT_DEBUG: boolean;
	}>;

type DefineConstantsStep = {
	step: 'defineConstants';
	constants: WordPressConstants;
};

type ImportContentStep = {
	step: 'importContent';
	content: ContentDefinition[];
};

type ImportMediaStep = {
	step: 'importMedia';
	media: MediaDefinition[];
};

type ImportThemeStarterContentStep = {
	step: 'importThemeStarterContent';
	/**
	 * The name of the theme to import content from.
	 */
	themeSlug?: string;
};

type MkdirStep = {
	step: 'mkdir';
	path: string;
};

type MvStep = {
	step: 'mv';
	fromPath: string;
	toPath: string;
};

type RmStep = {
	step: 'rm';
	path: string;
};

type RmdirStep = {
	step: 'rmdir';
	path: string;
};

type RunPHPStep = {
	step: 'runPHP';
	/**
	 * The PHP file to execute.
	 */
	code: DataReference;
	/**
	 * Environment variables to set for this run.
	 */
	env?: Record<string, string>;
};

type RunSQLStep = {
	step: 'runSQL';
	source: DataReference;
};

/**
 * Sets the site language and download translations for WordPress core
 * and all the installed plugins and themes.
 */
type SetSiteLanguageStep = {
	step: 'setSiteLanguage';
	/**
	 * The language to set, e.g. 'en_US'
	 */
	language: string;
};

type SetSiteOptionsStep = {
	step: 'setSiteOptions';
	options: Record<string, JsonValue>;
};

/**
 * Unzips a file. While this step is not strictly necessary, it is
 * very convenient for:
 *
 * * Working with GitHub releases that output doubly zipped data.
 * * Preprocessing zipped data before using them in the Blueprint.
 */
type UnzipStep = {
	step: 'unzip';
	/**
	 * The zip file resource to extract.
	 */
	zipFile: DataReference;
	/**
	 * The path to extract the zip file to inside the virtual filesystem.
	 */
	extractToPath: string;
};

type WpCliStep = {
	step: 'wp-cli';
	command: string;
	wpCliPath?: string;
};

type WriteFilesStep = {
	step: 'writeFiles';
	files: Record<string, DataReference>;
};

type PluginStep = {
	step: 'installPlugin';
} & PluginObjectDefinition;

type ThemeStep = {
	step: 'installTheme';
	/**
	 * Whether to activate the theme after installing it.
	 *
	 * This is not a part of the theme definition. Only the step
	 * can explicitly provide this option. The default value is `true`.
	 */
	active?: boolean;
} & ThemeObjectDefinition;

type Step =
	| ActivatePluginStep
	| ActivateThemeStep
	| CpStep
	| DefineConstantsStep
	| ImportContentStep
	| ImportMediaStep
	| ImportThemeStarterContentStep
	| PluginStep
	| ThemeStep
	| MkdirStep
	| MvStep
	| RmStep
	| RmdirStep
	| RunPHPStep
	| RunSQLStep
	| SetSiteLanguageStep
	| SetSiteOptionsStep
	| UnzipStep
	| WpCliStep
	| WriteFilesStep;

type JsonValue =
	| string
	| boolean
	| number
	| JsonValue[]
	| { [key: string]: JsonValue };
