import { PHP } from '@php-wasm/universal';
import {
	PHPRequestHandler,
	SupportedPHPVersion,
	proxyFileSystem,
	rotatePHPRuntime,
	setPhpIniEntries,
} from '@php-wasm/universal';
import { rootCertificates } from 'tls';
import {
	preloadPhpInfoRoute,
	enablePlatformMuPlugins,
	preloadRequiredMuPlugin,
} from '@wp-playground/wordpress';
import { loadNodeRuntime } from '@php-wasm/node';

export async function createPhp(
	requestHandler: PHPRequestHandler,
	phpVersion: SupportedPHPVersion,
	isPrimary: boolean
) {
	const createPhpRuntime = async () => await loadNodeRuntime(phpVersion);
	const php = new PHP();
	php.requestHandler = requestHandler;
	php.initializeRuntime(await createPhpRuntime());
	php.setSapiName('cli');
	await setPhpIniEntries(php, {
		'openssl.cafile': '/internal/shared/ca-bundle.crt',
		memory_limit: '256M',
		allow_url_fopen: '1',
		disable_functions: '',
	});

	// Write the ca-bundle.crt file to disk so that PHP can find it.
	if (isPrimary) {
		php.writeFile(
			'/internal/shared/ca-bundle.crt',
			rootCertificates.join('\n')
		);
		await preloadPhpInfoRoute(php);
		await enablePlatformMuPlugins(php);
		await preloadRequiredMuPlugin(php);
	} else {
		/**
		 * @TODO: Consider an API similar to
		 *
		 * php.mount('/wordpress', primaryPHP.getMountPoint('/wordpress'));
		 */
		proxyFileSystem(await requestHandler.getPrimaryPhp(), php, [
			'/tmp',
			requestHandler.documentRoot,
			'/internal/shared',
		]);
	}

	// php.setSpawnHandler(spawnHandlerFactory(processManager));
	// Rotate the PHP runtime periodically to avoid memory leak-related crashes.
	// @see https://github.com/WordPress/wordpress-playground/pull/990 for more context
	rotatePHPRuntime({
		php,
		cwd: requestHandler.documentRoot,
		recreateRuntime: createPhpRuntime,
		maxRequests: 400,
	});
	return php;
}
