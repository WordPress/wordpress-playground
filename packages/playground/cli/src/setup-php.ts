import { NodePHP } from '@php-wasm/node';
import {
	BasePHP,
	PHPRequestHandler,
	SupportedPHPVersion,
	rotatePHPRuntime,
} from '@php-wasm/universal';
import { rootCertificates } from 'tls';
import { dirname } from '@php-wasm/util';

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
	php.setPhpIniPath('/tmp/php.ini');
	php.writeFile('/tmp/php.ini', '');
	php.setPhpIniEntry('memory_limit', '256M');
	php.setPhpIniEntry('allow_url_fopen', '1');
	php.setPhpIniEntry('disable_functions', '');

	// Write the ca-bundle.crt file to disk so that PHP can find it.
	php.setPhpIniEntry('openssl.cafile', '/tmp/ca-bundle.crt');
	php.writeFile('/tmp/ca-bundle.crt', rootCertificates.join('\n'));

	if (!isPrimary) {
		/**
		 * @TODO: Consider an API similar to
		 *
		 * php.mount('/wordpress', primaryPHP.getMountPoint('/wordpress'));
		 */
		proxyFileSystem(
			await requestHandler.getPrimaryPhp(),
			php,
			'/wordpress'
		);
	}

	// php.setSpawnHandler(spawnHandlerFactory(processManager));
	// Rotate the PHP runtime periodically to avoid memory leak-related crashes.
	// @see https://github.com/WordPress/wordpress-playground/pull/990 for more context
	rotatePHPRuntime({
		php,
		cwd: '/wordpress',
		recreateRuntime: createPhpRuntime,
		maxRequests: 400,
	});
	return php;
}

/**
 * Share the parent's MEMFS instance with the child process.
 * Only mount the document root and the /tmp directory,
 * the rest of the filesystem (like the devices) should be
 * private to each PHP instance.
 *
 * @TODO: Ship this feature in the php-wasm library. It
 *        will be commonly used in multi-instance Playground
 *        applications. The website app does something similar,
 *        and so will wp-now, VSCode, etc.
 */
export function proxyFileSystem(
	sourceOfTruth: BasePHP,
	replica: BasePHP,
	documentRoot: string
) {
	// We can't just import the symbol from the library because
	// Playground CLI is built as ESM and php-wasm-node is built as
	// CJS and the imported symbols will different in the production build.
	const __private__symbol = Object.getOwnPropertySymbols(sourceOfTruth)[0];
	for (const path of [documentRoot, '/tmp']) {
		if (!replica.fileExists(path)) {
			replica.mkdir(path);
		}
		if (!sourceOfTruth.fileExists(path)) {
			sourceOfTruth.mkdir(path);
		}
		// @ts-ignore
		replica[__private__symbol].FS.mount(
			// @ts-ignore
			replica[__private__symbol].PROXYFS,
			{
				root: path,
				// @ts-ignore
				fs: sourceOfTruth[__private__symbol].FS,
			},
			path
		);
	}
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
