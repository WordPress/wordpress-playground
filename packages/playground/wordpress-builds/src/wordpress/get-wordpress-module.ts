import { getWordPressModuleDetails } from './get-wordpress-module-details';
import { fetchGitDirectoryFiles } from './fetch-git-directory';
import {
	ZipWriter,
	BlobWriter,
	Uint8ArrayReader,
	configure as configureZip,
} from '@zip.js/zip.js';

configureZip({ useCompressionStream: false, useWebWorkers: false });

export async function getWordPressModule(
	wpVersion?: string
): Promise<File> {
	const details = getWordPressModuleDetails(wpVersion);
	if (details.type === 'zip') {
		const data = await loadZipFromUrl(details.url);
		return new File([data], `${wpVersion || 'wp'}.zip`, {
			type: 'application/zip',
		});
	}

	const files = await fetchGitDirectoryFiles(details.gitDirectory);
	const blob = await createZipFromFiles(files);
	return new File([blob], `${wpVersion || 'wp'}.zip`, {
		type: 'application/zip',
	});
}

async function loadZipFromUrl(url: string): Promise<Blob | Uint8Array> {
	if (url.startsWith('/')) {
		let path = url;
		if (path.startsWith('/@fs/')) {
			path = path.slice(4);
		}
		const { readFile } = await import('node:fs/promises');
		return readFile(path);
	}
	const response = await fetch(url);
	return response.blob();
}

async function createZipFromFiles(
	files: Record<string, Uint8Array>
): Promise<Blob> {
	const writer = new ZipWriter(new BlobWriter('application/zip'));
	for (const [path, contents] of Object.entries(files)) {
		const entryPath = path || 'wordpress';
		await writer.add(entryPath, new Uint8ArrayReader(contents));
	}
	return writer.close();
}
