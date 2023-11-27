import { UniversalPHP } from '@php-wasm/universal';

/**
 * Exports the WordPress database as a WXR file using
 * the core WordPress export tool.
 *
 * @param playground Playground client
 * @returns WXR file
 */
export async function exportWXR(playground: UniversalPHP) {
	const databaseExportResponse = await playground.request({
		url: '/wp-admin/export.php?download=true&content=all',
	});
	return new File([databaseExportResponse.bytes], 'export.xml');
}
