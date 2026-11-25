import { dirname } from '@php-wasm/util';

/**
 * Default OpenSSL configuration path compiled into Node PHP-WASM builds
 * (`openssl_get_cert_locations()['default_cert_area'] . '/openssl.cnf'`).
 */
export const DEFAULT_OPENSSL_CONF_PATH = '/root/install/ssl/openssl.cnf';

/**
 * Minimal OpenSSL configuration compatible with both OpenSSL 1.1.x and 3.x.
 *
 * Node PHP-WASM exposes the OpenSSL extension without populating its compiled
 * configuration tree, causing `openssl_pkey_new()` and CSR generation to fail
 * unless a readable `openssl.cnf` is present before module initialization.
 */
export const DEFAULT_OPENSSL_CONF_CONTENT = [
	'[req]',
	'default_bits = 2048',
	'distinguished_name = req_distinguished_name',
	'',
	'[req_distinguished_name]',
	'',
].join('\n');

/**
 * Returns an Emscripten preRun callback that writes
 * {@link DEFAULT_OPENSSL_CONF_CONTENT} to {@link DEFAULT_OPENSSL_CONF_PATH}
 * when no config file is already present.
 */
export function createOpenSslConfigPreRunStep(): (module: {
	FS: {
		analyzePath: (path: string) => { exists: boolean };
		mkdirTree: (path: string) => void;
		writeFile: (path: string, content: string) => void;
	};
}) => void {
	return (module) => {
		if (module.FS.analyzePath(DEFAULT_OPENSSL_CONF_PATH).exists) {
			return;
		}
		module.FS.mkdirTree(dirname(DEFAULT_OPENSSL_CONF_PATH));
		module.FS.writeFile(
			DEFAULT_OPENSSL_CONF_PATH,
			DEFAULT_OPENSSL_CONF_CONTENT
		);
	};
}
