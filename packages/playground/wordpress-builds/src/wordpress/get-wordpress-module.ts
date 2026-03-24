import { getWordPressModuleDetails } from './get-wordpress-module-details';

export async function getWordPressModule(wpVersion = '6.8'): Promise<File> {
	const url = getWordPressModuleDetails(wpVersion).url;
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
	return new File([data as any], `${wpVersion || 'wp'}.zip`, {
		type: 'application/zip',
	});
}
