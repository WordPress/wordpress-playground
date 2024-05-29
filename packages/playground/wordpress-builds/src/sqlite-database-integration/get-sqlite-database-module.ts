import { url } from './get-sqlite-database-plugin-details';

export async function getSqliteDatabaseModule(): Promise<File> {
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
		data = await response.blob();
	}
	return new File([data], 'sqlite.zip', {
		type: 'application/zip',
	});
}
