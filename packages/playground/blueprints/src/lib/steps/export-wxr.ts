import type { UniversalPHP } from '@php-wasm/universal';
import { PHPResponse, StreamedPHPResponse } from '@php-wasm/universal';

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

	// Handle both buffered and streamed responses
	const bytes =
		databaseExportResponse instanceof StreamedPHPResponse
			? await databaseExportResponse.stdoutBytes
			: databaseExportResponse.bytes;

	return new File([bytes], 'export.xml');
}
