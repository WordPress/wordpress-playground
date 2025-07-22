import { loadNodeRuntime } from '@php-wasm/node';
import { type PHPRequestHandler } from '@php-wasm/universal';
import { bootRequestHandler } from '@wp-playground/wordpress';
import { rootCertificates } from 'node:tls';
import { runBlueprintV2 } from '../src/blueprints-v2/run-blueprint-v2';
import { RecommendedPHPVersion } from '@wp-playground/common';

describe('V2 runner', () => {
	let handler: PHPRequestHandler;

	beforeEach(async () => {
		handler = await bootRequestHandler({
			createPhpRuntime: async () =>
				await loadNodeRuntime(RecommendedPHPVersion, {
					emscriptenOptions: {
						ENV: {
							DOCROOT: '/wordpress',
						},
					},
				}),
			sapiName: 'cli',
			siteUrl: 'http://playground-domain/',
			phpIniEntries: {
				'openssl.cafile': '/internal/shared/ca-bundle.crt',
			},
			createFiles: {
				'/internal/shared/ca-bundle.crt': rootCertificates.join('\n'),
			},
		});
	});

	it('should put WordPress in the document root', async () => {
		const instance = await handler.processManager.acquirePHPInstance();
		const result = await runBlueprintV2({
			php: instance.php as any,
			blueprint: '{"version":2}',
			cliArgs: [
				'--site-url=http://playground-domain/',
				'--db-engine=sqlite',
			],
		});
		await result.finished;
		expect(await result.exitCode).toBe(0);
		const instance2 = await handler.processManager.acquirePHPInstance();
		expect(instance2.php.listFiles('/wordpress')).toContain('wp-content');
	}, 60000);
});
