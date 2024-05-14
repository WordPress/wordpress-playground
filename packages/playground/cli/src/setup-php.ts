import { NodePHP } from '@php-wasm/node';
import {
	PHPRequestHandler,
	SupportedPHPVersion,
	proxyFileSystem,
	rotatePHPRuntime,
} from '@php-wasm/universal';
import { rootCertificates } from 'tls';
import { dirname } from '@php-wasm/util';
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

/**
 * @TODO: Ship this feature in the php-wasm library.
 *
 *        Perhaps change the implementation of the setPhpIniValue()?
 *        We could ensure there's always a valid php.ini file,
 *        even if empty. php_wasm.c wouldn't provide any defaults.
 *        BasePHP would, and it would write them to the default php.ini
 *        file. Then we'd be able to use setPhpIniValue() at any time, not
 *        just before the first run() call.
 */
export async function withPHPIniValues(
	php: NodePHP,
	phpIniValues: Record<string, string>,
	callback: () => Promise<void>
) {
	const phpIniPath = (
		await php.run({
			code: '<?php echo php_ini_loaded_file();',
		})
	).text;
	const phpIniDir = dirname(phpIniPath);
	if (!php.fileExists(phpIniDir)) {
		php.mkdir(phpIniDir);
	}
	if (!php.fileExists(phpIniPath)) {
		php.writeFile(phpIniPath, '');
	}
	const originalPhpIni = php.readFileAsText(phpIniPath);
	const newPhpIni = Object.entries(phpIniValues)
		.map(([key, value]) => `${key} = ${value}`)
		.join('\n');
	php.writeFile(phpIniPath, [originalPhpIni, newPhpIni].join('\n'));
	try {
		await callback();
	} finally {
		php.writeFile(phpIniPath, originalPhpIni);
	}
}
