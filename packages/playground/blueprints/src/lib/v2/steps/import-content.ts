import type { V2StepHandler } from '../types';
import type { DataSources } from '../wep-1-blueprint-v2-schema/appendix-B-data-sources';
import { phpVar } from '@php-wasm/util';
import { registerV2StepHandler } from './index';

interface ImportContentArgs {
	type?: 'wxr' | 'mysql-dump' | 'posts';
	source?: DataSources.DataReference;
	posts?: Array<Record<string, unknown>>;
	[key: string]: unknown;
}

/**
 * Imports content into WordPress. Supports three modes:
 *
 * - wxr: Resolves a WXR (WordPress eXtended RSS) file and
 *   imports it via the WP_Import class.
 * - mysql-dump: Resolves a SQL file and executes its
 *   statements via $wpdb->query().
 * - posts: Takes an array of post objects and inserts each
 *   one via wp_insert_post().
 */
const handler: V2StepHandler<ImportContentArgs> = async (args, context) => {
	const contentType = args.type || 'wxr';

	switch (contentType) {
		case 'wxr':
			await importWxr(args, context);
			break;
		case 'mysql-dump':
			await importMysqlDump(args, context);
			break;
		case 'posts':
			await importPosts(args, context);
			break;
		default:
			throw new Error(
				`Unsupported content import type: "${contentType}"`
			);
	}
};

/**
 * Imports a WXR file via the WordPress importer.
 */
async function importWxr(
	args: ImportContentArgs,
	context: Parameters<V2StepHandler>[1]
): Promise<void> {
	const { php, dataReferenceResolver } = context;
	const docroot = await php.documentRoot;

	if (!args.source) {
		throw new Error(
			'importContent with type "wxr" requires a "source" argument'
		);
	}

	const file = await dataReferenceResolver.resolveFile(args.source);
	const importPath = '/tmp/import.wxr';
	await php.writeFile(importPath, file.contents);

	await php.run({
		code: `<?php
define('WP_LOAD_IMPORTERS', true);
require 'wp-load.php';
require 'wp-admin/includes/admin.php';

kses_remove_filters();

$admin_id = get_users(
	array('role' => 'Administrator')
)[0]->ID;
wp_set_current_user($admin_id);

$wp_import = new WP_Import();
$import_data = $wp_import->parse(${phpVar(importPath)});

$wp_import->get_authors_from_import($import_data);
unset($import_data);

$wp_import->fetch_attachments = true;

$_GET = array(
	'import' => 'wordpress',
	'step'   => 2,
);
$_POST = array(
	'imported_authors'  => array(),
	'user_map'          => array(),
	'fetch_attachments' => $wp_import->fetch_attachments,
);

$wp_import->import(${phpVar(importPath)}, [
	'rewrite_urls' => true,
]);
`,
		$_SERVER: {
			HTTPS: (await php.absoluteUrl).startsWith('https://') ? 'on' : '',
		},
	});
}

/**
 * Imports a MySQL dump by resolving the SQL source and
 * executing the statements via $wpdb->query().
 */
async function importMysqlDump(
	args: ImportContentArgs,
	context: Parameters<V2StepHandler>[1]
): Promise<void> {
	const { php, dataReferenceResolver } = context;
	const docroot = await php.documentRoot;

	if (!args.source) {
		throw new Error(
			'importContent with type "mysql-dump" requires ' +
				'a "source" argument'
		);
	}

	const file = await dataReferenceResolver.resolveFile(args.source);
	const sqlPath = '/tmp/import.sql';
	await php.writeFile(sqlPath, file.contents);

	await php.run({
		code: `<?php
require_once(${phpVar(docroot)} . '/wp-load.php');
global $wpdb;

$sql = file_get_contents(${phpVar(sqlPath)});
$statements = array_filter(
	array_map('trim', explode(';', $sql))
);
foreach ($statements as $statement) {
	if (!empty($statement)) {
		$wpdb->query($statement);
	}
}
unlink(${phpVar(sqlPath)});
`,
	});
}

/**
 * Inserts posts using wp_insert_post() for each post
 * object in the "posts" array.
 */
async function importPosts(
	args: ImportContentArgs,
	context: Parameters<V2StepHandler>[1]
): Promise<void> {
	const { php } = context;
	const docroot = await php.documentRoot;
	const posts = args.posts || [];

	if (posts.length === 0) {
		return;
	}

	const postsJson = JSON.stringify(posts);

	await php.run({
		code: `<?php
require_once(${phpVar(docroot)} . '/wp-load.php');

wp_set_current_user(
	get_users(array('role' => 'Administrator'))[0]->ID
);

$posts = json_decode(${phpVar(postsJson)}, true);
foreach ($posts as $post_data) {
	$result = wp_insert_post($post_data, true);
	if (is_wp_error($result)) {
		throw new Exception(
			'Failed to insert post: ' .
			$result->get_error_message()
		);
	}
}
`,
	});
}

registerV2StepHandler('importContent', handler);
