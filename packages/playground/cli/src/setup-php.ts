import { NodePHP } from '@php-wasm/node';
import {
	PHPRequestHandler,
	SupportedPHPVersion,
	proxyFileSystem,
	rotatePHPRuntime,
} from '@php-wasm/universal';
import { rootCertificates } from 'tls';
import {
	preloadPhpInfoRoute,
	enablePlatformMuPlugins,
	preloadRequiredMuPlugin,
} from '@wp-playground/wordpress';

export async function createPhp(
	requestHandler: PHPRequestHandler<NodePHP>,
	phpVersion: SupportedPHPVersion,
	isPrimary: boolean
) {
	const createPhpRuntime = async () => await NodePHP.loadRuntime(phpVersion);
	const php = new NodePHP();
	php.requestHandler = requestHandler;
	/**
	 * @TODO: Consider an API like
	 *
	 * await php.useRuntimeFactory(runtimeFactory, { rotateAfterRequests: 400 });
	 *
	 * or
	 *
	 * const php = await NodePHP.create({
	 *     runtimeFactory,
	 *     rotateAfterRequests: 400,
	 * })
	 */
	php.initializeRuntime(await createPhpRuntime());
	php.setSapiName('cli');
	php.setPhpIniPath('/internal/shared/php.ini');
	php.setPhpIniEntry('openssl.cafile', '/internal/shared/ca-bundle.crt');
	php.setPhpIniEntry('memory_limit', '256M');
	php.setPhpIniEntry('allow_url_fopen', '1');
	php.setPhpIniEntry('disable_functions', '');

	// Write the ca-bundle.crt file to disk so that PHP can find it.
	if (isPrimary) {
		php.writeFile('/internal/shared/php.ini', '');
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
