import type { StepHandler, StepProgress } from '.';
import { writeFile } from './write-file';
import type { UniversalPHP } from '@php-wasm/universal';

/**
 * @inheritDoc importWxr
 * @example
 *
 * <code>
 * {
 * 		"step": "importWxr",
 * 		"file": {
 * 			"resource": "url",
 * 			"url": "https://your-site.com/starter-content.wxr"
 * 		}
 * }
 * </code>
 */
export interface ImportWxrStep<ResourceType> {
	step: 'importWxr';
	/** The file to import */
	file: ResourceType;
	/**
	 * Whether to fetch and import attachment files referenced by the WXR file.
	 *
	 * @default true
	 */
	fetchAttachments?: boolean;
	/**
	 * Whether to rewrite imported URLs to the current site URL.
	 *
	 * @default true
	 */
	rewriteUrls?: boolean;
	/**
	 * Whether to import comments from the WXR file.
	 *
	 * @default true
	 */
	importComments?: boolean;
	/**
	 * Whether to import site options from the WXR file.
	 *
	 * @default false
	 */
	importSiteOptions?: boolean;
	/**
	 * The importer to use. Possible values:
	 *
	 * - `default`: The importer from https://github.com/humanmade/WordPress-Importer
	 * - `data-liberation`: The experimental Data Liberation WXR importer developed at
	 *                      https://github.com/WordPress/wordpress-playground/issues/1894
	 *
	 * This option is deprecated. The syntax will not be removed, but once the
	 * Data Liberation importer matures, it will become the only supported
	 * importer and the `importer` option will be ignored.
	 *
	 * @deprecated
	 */
	importer?: 'data-liberation' | 'default';
}

/**
 * Imports a WXR file into WordPress.
 *
 * @param playground Playground client.
 * @param file The file to import.
 */
export const importWxr: StepHandler<ImportWxrStep<File>> = async (
	playground,
	{
		file,
		fetchAttachments = true,
		rewriteUrls = true,
		importComments = true,
		importSiteOptions = false,
	},
	progress?
) => {
	await importWithDefaultImporter(playground, file, progress, {
		fetchAttachments,
		rewriteUrls,
		importComments,
		importSiteOptions,
	});
};

async function importWithDefaultImporter(
	playground: UniversalPHP,
	file: File,
	progress: StepProgress | undefined,
	options: {
		fetchAttachments: boolean;
		rewriteUrls: boolean;
		importComments: boolean;
		importSiteOptions: boolean;
	}
) {
	progress?.tracker?.setCaption('Importing content');
	await writeFile(playground, {
		path: '/tmp/import.wxr',
		data: file,
	});
	await playground.run({
		$_SERVER: {
			/**
			 * get_site_url() infers the protocol from $_SERVER['HTTPS'] instead of
			 * using the stored siteurl option. The importer relies on that behavior
			 * when rewriting links in the WXR payload, so we populate the flag here
			 * just as the web request layer would.
			 */
			HTTPS: (await playground.absoluteUrl).startsWith('https://')
				? 'on'
				: '',
		},
		code: `<?php
	define('WP_LOAD_IMPORTERS', true);
	require 'wp-load.php';
	require 'wp-admin/includes/admin.php';

	if (!function_exists('playground_import_wxr_site_options')) {
		function playground_import_wxr_site_options($file) {
			$reader_class = '\\WordPress\\DataLiberation\\EntityReader\\WXREntityReader';
			$stream_class = '\\WordPress\\ByteStream\\ReadStream\\FileReadStream';

			if (
				!class_exists($reader_class) ||
				!class_exists($stream_class)
			) {
				throw new Exception(
					'The active WordPress Importer does not support WXR site option imports.'
				);
			}

			try {
				$reader = $reader_class::create($stream_class::from_path($file));
				while ($reader->next_entity()) {
					$entity = $reader->get_entity();
					if ('site_option' !== $entity->get_type()) {
						continue;
					}
					$data = $entity->get_data();
					if (isset($data['option_name']) && 'blogname' === $data['option_name']) {
						update_option(
							'blogname',
							wp_specialchars_decode($data['option_value'], ENT_QUOTES)
						);
						return;
					}
				}
			} catch (Exception $e) {
				throw new Exception(
					'Could not parse WXR file for site option imports: ' . $e->getMessage(),
					0,
					$e
				);
			}
		}
	}

	/**
	 * Disable all kses filters to prevent content sanitization during import.
	 * It messes up Playground URL scheme by mangling transforming code such as:
	 *
	 *     <a href="/scope:kind-quiet-lake/index.php">Test</a>
	 *
	 * into:
	 *
	 *     <a href="kind-quiet-lake/index.php">Test</a>
	 */
	kses_remove_filters();

	// Set current user for the importer to pick it up as the default
	// post author.
	$admin_id = get_users(array('role' => 'Administrator') )[0]->ID;
	wp_set_current_user( $admin_id );

	$wp_import                  = new WP_Import();
	$import_data                = $wp_import->parse( getenv('IMPORT_FILE') );

	if (getenv('IMPORT_SITE_OPTIONS') === 'true') {
		playground_import_wxr_site_options(getenv('IMPORT_FILE'));
	}

	// Prepare the data to be used in process_author_mapping();
	$wp_import->get_authors_from_import( $import_data );

	if (getenv('IMPORT_COMMENTS') === 'false') {
		add_filter('wp_import_post_comments', '__return_empty_array');
	}

	// We no longer need the original data, so unset to avoid using excess
	// memory.
	unset( $import_data );

	// Drive the import
	$wp_import->fetch_attachments = getenv('FETCH_ATTACHMENTS') === 'true';

	$_GET  = array(
		'import' => 'wordpress',
		'step'   => 2,
	);
	$_POST = array(
		'imported_authors'  => array(),
		'user_map'          => array(),
		'fetch_attachments' => $wp_import->fetch_attachments,
	);

	$GLOBALS['wpcli_import_current_file'] = basename( $file );
	$wp_import->import( getenv('IMPORT_FILE'), [
		'rewrite_urls' => getenv('REWRITE_URLS') === 'true',
	] );
	`,
		env: {
			IMPORT_FILE: '/tmp/import.wxr',
			FETCH_ATTACHMENTS: options.fetchAttachments ? 'true' : 'false',
			REWRITE_URLS: options.rewriteUrls ? 'true' : 'false',
			IMPORT_COMMENTS: options.importComments ? 'true' : 'false',
			IMPORT_SITE_OPTIONS: options.importSiteOptions ? 'true' : 'false',
		},
	});
}
