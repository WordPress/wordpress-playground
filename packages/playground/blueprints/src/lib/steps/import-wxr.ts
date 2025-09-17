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
	{ file },
	progress?
) => {
	await importWithDefaultImporter(playground, file, progress);
};

async function importWithDefaultImporter(
	playground: UniversalPHP,
	file: File,
	progress?: StepProgress | undefined
) {
	progress?.tracker?.setCaption('Importing content');
	await writeFile(playground, {
		path: '/tmp/import.wxr',
		data: file,
	});
	await playground.run({
		code: `<?php
	define('WP_LOAD_IMPORTERS', true);
	require 'wp-load.php';
	require 'wp-admin/includes/admin.php';

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

	// Prepare the data to be used in process_author_mapping();
	$wp_import->get_authors_from_import( $import_data );

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
		'rewrite_urls' => true,
	] );
	`,
		env: {
			IMPORT_FILE: '/tmp/import.wxr',
			FETCH_ATTACHMENTS: 'true',
		},
	});
}
