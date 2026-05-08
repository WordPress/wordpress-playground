import type { PHPExtension, XdebugOptions } from '@php-wasm/node';

/**
 * Converts the legacy Playground CLI extension options object into the runtime
 * `extensions` array.
 *
 * The CLI still receives extensions as individual options: `intl`, `redis`,
 * `memcached`, and `xdebug`. The PHP runtime no longer has separate `with*`
 * entry points for new callers; it expects one array that can contain built-in
 * extension names and, elsewhere, external extension sources. This function is
 * the CLI boundary between those two shapes.
 *
 * Xdebug is the only CLI extension here with options. A plain `true` becomes
 * the built-in `xdebug` request, while an object preserves the Xdebug settings
 * and passes them through to the Node runtime.
 */
export function legacyPHPExtensionsObjectToExtensionsArray(args: {
	intl?: boolean;
	redis?: boolean;
	memcached?: boolean;
	xdebug?: boolean | XdebugOptions;
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
	return extensions;
}
