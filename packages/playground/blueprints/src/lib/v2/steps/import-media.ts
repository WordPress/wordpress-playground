import type { V2StepHandler } from '../types';
import type { DataSources } from '../wep-1-blueprint-v2-schema/appendix-B-data-sources';
import { joinPaths, phpVar } from '@php-wasm/util';
import { registerV2StepHandler } from './index';

interface ImportMediaArgs {
	source: DataSources.DataReference;
	title?: string;
	description?: string;
	alt?: string;
	caption?: string;
}

/**
 * Imports a media file into the WordPress media library.
 *
 * Resolves the source data reference, writes the file to
 * wp-content/uploads/, then registers it as an attachment
 * via wp_insert_attachment() and generates metadata.
 */
const handler: V2StepHandler<ImportMediaArgs> = async (args, context) => {
	const { php, dataReferenceResolver } = context;
	const docroot = await php.documentRoot;

	const file = await dataReferenceResolver.resolveFile(args.source);
	const uploadsDir = joinPaths(docroot, 'wp-content', 'uploads');
	const filePath = joinPaths(uploadsDir, file.name);

	// Ensure the uploads directory exists.
	if (!(await php.fileExists(uploadsDir))) {
		await php.mkdir(uploadsDir);
	}

	await php.writeFile(filePath, file.contents);

	const title = args.title || file.name.replace(/\.[^.]+$/, '');
	const description = args.description || '';
	const alt = args.alt || '';
	const caption = args.caption || '';

	await php.run({
		code: `<?php
require_once(${phpVar(docroot)} . '/wp-load.php');
require_once(${phpVar(docroot)} . '/wp-admin/includes/image.php');
require_once(${phpVar(docroot)} . '/wp-admin/includes/file.php');
require_once(${phpVar(docroot)} . '/wp-admin/includes/media.php');

wp_set_current_user(
	get_users(array('role' => 'Administrator'))[0]->ID
);

$file_path = ${phpVar(filePath)};
$file_name = ${phpVar(file.name)};
$file_type = wp_check_filetype($file_name);

$attachment = array(
	'post_title'     => ${phpVar(title)},
	'post_content'   => ${phpVar(description)},
	'post_excerpt'   => ${phpVar(caption)},
	'post_mime_type' => $file_type['type'],
	'post_status'    => 'inherit',
);

$attach_id = wp_insert_attachment(
	$attachment,
	$file_path
);

if (is_wp_error($attach_id)) {
	throw new Exception(
		'Failed to insert attachment: ' .
		$attach_id->get_error_message()
	);
}

$attach_data = wp_generate_attachment_metadata(
	$attach_id,
	$file_path
);
wp_update_attachment_metadata($attach_id, $attach_data);

if (!empty(${phpVar(alt)})) {
	update_post_meta($attach_id, '_wp_attachment_image_alt', ${phpVar(alt)});
}
`,
	});
};

registerV2StepHandler('importMedia', handler);
