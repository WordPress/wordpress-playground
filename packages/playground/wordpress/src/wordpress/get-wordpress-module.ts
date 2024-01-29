import { getWordPressModuleDetails } from './get-wordpress-module-details';

export async function getWordPressModule(
	wpVersion: string = '6.4'
): Promise<Blob> {
	const url = getWordPressModuleDetails(wpVersion).url;
	if (url.startsWith('/')) {
		let path = url;
		if (path.startsWith('/@fs/')) {
			path = path.slice(4);
		}

		const { readFile } = await import('node:fs/promises');
		const buffer = await readFile(path);
		return new File([buffer], path);
	} else {
		const res = await fetch(url);
		return await res.blob();
	}
}
