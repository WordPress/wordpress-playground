import type { PHPLoaderExtension, XdebugOptions } from '@php-wasm/node';

export function getRequestedPHPExtensions(args: {
	intl?: boolean;
	redis?: boolean;
	memcached?: boolean;
	xdebug?: boolean | XdebugOptions;
}): PHPLoaderExtension[] {
	const extensions: PHPLoaderExtension[] = [];
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
