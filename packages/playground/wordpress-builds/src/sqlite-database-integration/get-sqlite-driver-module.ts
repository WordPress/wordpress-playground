import {
	getSqliteDriverModuleDetails,
	LatestSqliteDriverVersion,
} from './get-sqlite-driver-module-details';

export { LatestSqliteDriverVersion };

export async function getSqliteDriverModule(
	pluginVersion = LatestSqliteDriverVersion
): Promise<File> {
	const { url } = getSqliteDriverModuleDetails(pluginVersion);
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
	return new File([data], `sqlite-${pluginVersion}.zip`, {
		type: 'application/zip',
	});
}
