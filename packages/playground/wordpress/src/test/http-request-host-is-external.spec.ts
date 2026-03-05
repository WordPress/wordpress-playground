import { RecommendedPHPVersion } from '@wp-playground/common';
import { loadNodeRuntime } from '@php-wasm/node';
import { bootWordPressAndRequestHandler } from '../boot';
import {
	getSqliteDriverModule,
	getWordPressModule,
} from '@wp-playground/wordpress-builds';

describe('http_request_host_is_external filter', () => {
	it('returns true after WordPress boot', async () => {
		const handler = await bootWordPressAndRequestHandler({
			createPhpRuntime: async () =>
				await loadNodeRuntime(RecommendedPHPVersion),
			siteUrl: 'http://playground-domain/',
			wordPressZip: await getWordPressModule(),
			sqliteIntegrationPluginZip: await getSqliteDriverModule(),
		});

		const php = await handler.getPrimaryPhp();
		const result = await php.run({
			code: `<?php
				ob_start();
				require getenv('DOCUMENT_ROOT') . '/wp-load.php';
				$val = apply_filters('http_request_host_is_external', false, 'https://resplendent-curlew-7b82c2.instawp.xyz/wp-content/uploads/2025/08/portland2.jpeg');
				ob_clean();
				echo $val ? '1' : '0';
				ob_end_flush();
			`,
			env: {
				DOCUMENT_ROOT: php.documentRoot,
			},
		});

		expect(result.text).toBe('1');
	});
});
