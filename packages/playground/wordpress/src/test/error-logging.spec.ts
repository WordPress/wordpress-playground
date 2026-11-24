import { RecommendedPHPVersion } from '@wp-playground/common';
// eslint-disable-next-line @nx/enforce-module-boundaries -- ignore test-related interdependencies so we can test.
import { loadNodeRuntime } from '@php-wasm/node';
import { bootWordPressAndRequestHandler } from '../boot';
import {
	getSqliteDriverModule,
	getWordPressModule,
} from '@wp-playground/wordpress-builds';

async function getErrorLoggingSettings(
	constants: Record<string, string | boolean>
) {
	await using handler = await bootWordPressAndRequestHandler({
		createPhpRuntime: async () =>
			await loadNodeRuntime(RecommendedPHPVersion),
		siteUrl: 'http://playground-domain/',
		wordPressZip: await getWordPressModule(),
		sqliteIntegrationPluginZip: await getSqliteDriverModule(),
		constants,
	});

	const php = await handler.getPrimaryPhp();
	const result = await php.run({
		code: `<?php
			ob_start();
			require getenv('DOCUMENT_ROOT') . '/wp-load.php';
			ob_clean();
			echo json_encode([
				'error_log' => ini_get('error_log'),
				'log_errors' => ini_get('log_errors'),
				'ERROR_LOG_FILE' => ERROR_LOG_FILE,
			]);
			ob_end_flush();
		`,
		env: { DOCUMENT_ROOT: php.documentRoot },
	});
	return result.json;
}

describe('Error logging setup', () => {
	it('should disable logging when WP_DEBUG_LOG is not set', async () => {
		const settings = await getErrorLoggingSettings({});
		expect(settings).toMatchObject({
			log_errors: '0',
		});
	});

	it('should log to default debug.log when WP_DEBUG_LOG is true', async () => {
		const settings = await getErrorLoggingSettings({
			WP_DEBUG_LOG: true,
		});
		expect(settings.error_log).toContain('debug.log');
		expect(settings.ERROR_LOG_FILE).toContain('debug.log');
	});

	it('should log to custom path when WP_DEBUG_LOG is a string', async () => {
		const settings = await getErrorLoggingSettings({
			WP_DEBUG_LOG: '/custom/path/errors.log',
		});
		expect(settings).toMatchObject({
			error_log: '/custom/path/errors.log',
			ERROR_LOG_FILE: '/custom/path/errors.log',
		});
	});

	it('should disable logging when WP_DEBUG_LOG is false', async () => {
		const settings = await getErrorLoggingSettings({
			WP_DEBUG_LOG: false,
		});
		expect(settings).toMatchObject({
			log_errors: '0',
		});
	});
});
