import {
	getWordPressModuleDetails,
	type WordPressModuleDetails,
} from './get-wordpress-module-details';

export async function getWordPressModule(wpVersion = '6.8'): Promise<File> {
	const details = getWordPressModuleDetails(wpVersion);
	const url = details.url;
	let data = null;
	if (url.startsWith('/')) {
		let path = url;
		if (path.startsWith('/@fs/')) {
			path = path.slice(4);
		}

		const { readFile } = await import('node:fs/promises');
		data = await readFile(path);
	} else {
		const response = await fetch(url);
		// We use .arrayBuffer() and not .blob() here because blob() throws when the
		// client is low on disk space. Blobs tend to be stored as temporary files,
		// array buffers tend to be stored in memory.
		// @see https://github.com/WordPress/wordpress-playground/issues/2769
		data = await response.arrayBuffer();
	}
	const bundleFileMetadata = getWordPressBundleFileMetadata(details);
	return new File(
		[data as any],
		`${wpVersion || 'wp'}.${bundleFileMetadata.extension}`,
		{
			type: bundleFileMetadata.mimeType,
		}
	);
}

const WORDPRESS_BUNDLE_FILE_METADATA = {
	zip: {
		extension: 'zip',
		mimeType: 'application/zip',
	},
	'tar.zst': {
		extension: 'tar.zst',
		mimeType: 'application/zstd',
	},
} satisfies Record<
	WordPressModuleDetails['format'],
	{ extension: string; mimeType: string }
>;

function getWordPressBundleFileMetadata(details: WordPressModuleDetails) {
	return WORDPRESS_BUNDLE_FILE_METADATA[details.format];
}
