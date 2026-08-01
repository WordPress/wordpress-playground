import type { PHPExtension, XdebugOptions } from '@php-wasm/node';

/**
 * Converts Playground CLI extension options into the runtime `extensions`
 * array.
 *
 * The CLI receives built-in extensions as individual options (`intl`, `redis`,
 * `memcached`, and `xdebug`) and external extensions as manifest paths.
 * The PHP runtime expects one array that can contain built-in names and
 * external extension sources side by side.
 *
 * Xdebug is the only CLI extension here with options. A plain `true` becomes
 * the built-in `xdebug` request, while an object preserves the Xdebug settings
 * and passes them through to the Node runtime.
 */
export function cliExtensionArgsToExtensionsArray(args: {
	intl?: boolean;
	redis?: boolean;
	memcached?: boolean;
	xdebug?: boolean | XdebugOptions;
	phpExtension?: string[];
}): PHPExtension[] {
	const extensions: PHPExtension[] = [];
	if (args.intl) {
		extensions.push('intl');
	}
	if (args.redis) {
		extensions.push('redis');
	}
	if (args.memcached) {
		extensions.push('memcached');
	}
	if (args.xdebug) {
		extensions.push(
			typeof args.xdebug === 'object'
				? { name: 'xdebug', options: args.xdebug }
				: 'xdebug'
		);
	}
	for (const manifestUrl of args.phpExtension || []) {
		extensions.push({
			source: {
				format: 'manifest',
				manifestUrl,
			},
		});
	}
	return extensions;
}
