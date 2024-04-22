import { NodePHP } from '@php-wasm/node';
import { rotatePHPRuntime } from '@php-wasm/universal';
import { rootCertificates } from 'tls';
import { Mount } from './cli';

export async function createPhp(mounts: Mount[]) {
	const php = new NodePHP();
	php.initializeRuntime(await createPhpRuntime());
	php.setPhpIniEntry('disable_functions', '');
	php.setPhpIniEntry('allow_url_fopen', '1');
	php.setPhpIniEntry('memory_limit', '256M');

	// Write the ca-bundle.crt file to disk so that PHP can find it.
	php.setPhpIniEntry('openssl.cafile', '/tmp/ca-bundle.crt');
	php.writeFile('/tmp/ca-bundle.crt', rootCertificates.join('\n'));

	php.mkdir('/wordpress');
	for (const mount of mounts) {
		php.mount(mount.hostPath, mount.vfsPath);
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

const createPhpRuntime = async () => await NodePHP.loadRuntime('8.0');
