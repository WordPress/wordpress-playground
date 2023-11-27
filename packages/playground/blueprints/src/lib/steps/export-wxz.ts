import { UniversalPHP } from '@php-wasm/universal';

/**
 * Exports the WordPress database as a WXZ file using
 * the export-wxz plugin from https://github.com/akirk/export-wxz.
 *
 * @param playground Playground client
 * @returns WXZ file
 */
export async function exportWXZ(playground: UniversalPHP) {
	const databaseExportResponse = await playground.request({
		url: '/wp-admin/export.php?download=true&content=all&export_wxz=1',
	});
	return new File([databaseExportResponse.bytes], 'export.wxz');
}
