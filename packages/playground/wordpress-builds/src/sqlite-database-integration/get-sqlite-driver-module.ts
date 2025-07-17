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
		data = await response.blob();
	}
	return new File([data], `sqlite-${pluginVersion}.zip`, {
		type: 'application/zip',
	});
}
