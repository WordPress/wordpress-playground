import { dirname, joinPaths, randomFilename } from '@php-wasm/util';
import type { PlaygroundClient } from '@wp-playground/remote';
import type { OpenerBlueprintFile } from './opener-blueprint-protocol';

const IMPORT_MEDIA_FILE = `<?php
require '/wordpress/wp-load.php';
require_once ABSPATH . 'wp-admin/includes/image.php';
require_once ABSPATH . 'wp-admin/includes/file.php';

$source_path = getenv('PLAYGROUND_UPLOAD_PATH');
$requested_name = getenv('PLAYGROUND_UPLOAD_NAME');
$requested_mime_type = getenv('PLAYGROUND_UPLOAD_MIME_TYPE');

if (!$source_path || !is_readable($source_path)) {
	throw new Exception('The uploaded media file is not readable.');
}

$filename = sanitize_file_name($requested_name ? $requested_name : '');
if (!$filename) {
	throw new Exception('The uploaded media file needs a valid filename.');
}

$uploads = wp_upload_dir();
if (!empty($uploads['error'])) {
	throw new Exception($uploads['error']);
}
if (!wp_mkdir_p($uploads['path'])) {
	throw new Exception('Could not create the WordPress uploads directory.');
}

$filename = wp_unique_filename($uploads['path'], $filename);
$target_path = trailingslashit($uploads['path']) . $filename;
if (!copy($source_path, $target_path)) {
	throw new Exception('Could not copy the uploaded media file.');
}

$filetype = wp_check_filetype($filename, null);
$mime_type = $requested_mime_type
	? $requested_mime_type
	: (!empty($filetype['type']) ? $filetype['type'] : 'application/octet-stream');
$attachment = array(
	'guid' => trailingslashit($uploads['url']) . $filename,
	'post_mime_type' => $mime_type,
	'post_title' => preg_replace('/\\.[^.]+$/', '', $filename),
	'post_status' => 'inherit',
);
$attachment_id = wp_insert_attachment($attachment, $target_path, 0);
if (is_wp_error($attachment_id)) {
	throw new Exception($attachment_id->get_error_message());
}
if (!$attachment_id) {
	throw new Exception('Could not create the WordPress media attachment.');
}

$metadata = wp_generate_attachment_metadata($attachment_id, $target_path);
if (!is_wp_error($metadata) && !empty($metadata)) {
	wp_update_attachment_metadata($attachment_id, $metadata);
}
`;

export async function applyOpenerBlueprintFiles(
	playground: PlaygroundClient,
	files: OpenerBlueprintFile[],
	signal: AbortSignal,
	onFileApplied?: (completedFiles: number) => void
): Promise<void> {
	for (let index = 0; index < files.length; index++) {
		if (signal.aborted) {
			throw new Error('The Playground boot was cancelled.');
		}
		const file = files[index];
		if (file.destination === 'vfs') {
			await writeVfsFile(playground, file);
		} else {
			await importMediaLibraryFile(playground, file);
		}
		if (signal.aborted) {
			throw new Error('The Playground boot was cancelled.');
		}
		onFileApplied?.(index + 1);
	}
}

async function writeVfsFile(
	playground: PlaygroundClient,
	file: OpenerBlueprintFile
): Promise<void> {
	const parentPath = dirname(file.path!);
	if (!(await playground.fileExists(parentPath))) {
		await playground.mkdir(parentPath);
	}
	await playground.writeFile(file.path!, new Uint8Array(file.bytes));
}

async function importMediaLibraryFile(
	playground: PlaygroundClient,
	file: OpenerBlueprintFile
): Promise<void> {
	const temporaryPath = joinPaths(
		'/tmp',
		`playground-opener-upload-${randomFilename()}`
	);
	await playground.writeFile(temporaryPath, new Uint8Array(file.bytes));
	try {
		const result = await playground.run({
			code: IMPORT_MEDIA_FILE,
			env: {
				PLAYGROUND_UPLOAD_PATH: temporaryPath,
				PLAYGROUND_UPLOAD_NAME: file.name,
				PLAYGROUND_UPLOAD_MIME_TYPE: file.mimeType ?? '',
			},
		});
		if (result.exitCode !== 0) {
			throw new Error(
				result.errors || 'Could not import the Media Library file.'
			);
		}
	} finally {
		if (await playground.fileExists(temporaryPath)) {
			await playground.unlink(temporaryPath);
		}
	}
}
