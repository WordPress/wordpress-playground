import { readFileSync } from 'node:fs';
import type {
	PHPExtension,
	RuntimePHPExtensionSource,
	XdebugOptions,
} from '@php-wasm/node';

/**
 * Converts Playground CLI extension options into the runtime `extensions`
 * array.
 *
 * The CLI receives built-in extensions as individual options (`intl`, `redis`,
 * `memcached`, and `xdebug`) and external extensions as manifest/config paths.
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
	runtimePHPExtensions?: RuntimePHPExtensionSource[];
	phpExtension?: string[];
	'php-extension'?: string[];
	phpExtensionConfig?: string[];
	'php-extension-config'?: string[];
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
	for (const manifestUrl of getArrayOption(args, 'phpExtension')) {
		extensions.push({
			source: {
				format: 'manifest',
				manifestUrl,
			},
		});
	}
	for (const configPath of getArrayOption(args, 'phpExtensionConfig')) {
		extensions.push(readPHPExtensionConfig(configPath));
	}
	extensions.push(...(args.runtimePHPExtensions ?? []));
	return extensions;
}

export function readPHPExtensionConfig(
	configPath: string
): RuntimePHPExtensionSource {
	let config: unknown;
	try {
		config = JSON.parse(readFileSync(configPath, 'utf8'));
	} catch (error) {
		throw new Error(`Could not read PHP extension config: ${configPath}`, {
			cause: error,
		});
	}

	if (!isRecord(config) || !isRecord(config['source'])) {
		throw new Error(
			`Invalid PHP extension config: ${configPath}. Expected an object with a source field.`
		);
	}
	if (
		'loadWithIniDirective' in config &&
		config['loadWithIniDirective'] !== false &&
		config['loadWithIniDirective'] !== 'extension' &&
		config['loadWithIniDirective'] !== 'zend_extension'
	) {
		throw new Error(
			`Invalid PHP extension config: ${configPath}. loadWithIniDirective must be "extension", "zend_extension", or false.`
		);
	}

	const source = config['source'];
	if (source['format'] === 'so') {
		throw new Error(
			`Invalid PHP extension config: ${configPath}. The CLI cannot load direct bytes; use a manifest or URL source.`
		);
	}
	if (source['format'] === 'url') {
		if (typeof source['url'] !== 'string') {
			throw new Error(
				`Invalid PHP extension config: ${configPath}. A URL source requires a string url.`
			);
		}
		return config as RuntimePHPExtensionSource;
	}
	if (source['format'] === 'manifest') {
		if (
			typeof source['manifestUrl'] !== 'string' &&
			!isRecord(source['manifest'])
		) {
			throw new Error(
				`Invalid PHP extension config: ${configPath}. A manifest source requires manifestUrl or manifest.`
			);
		}
		return config as RuntimePHPExtensionSource;
	}

	throw new Error(
		`Invalid PHP extension config: ${configPath}. Unknown source format.`
	);
}

function getArrayOption(
	args: {
		phpExtension?: string[];
		'php-extension'?: string[];
		phpExtensionConfig?: string[];
		'php-extension-config'?: string[];
	},
	camelCaseKey: 'phpExtension' | 'phpExtensionConfig'
): string[] {
	const dashCaseKey =
		camelCaseKey === 'phpExtension'
			? 'php-extension'
			: 'php-extension-config';
	const value = args[camelCaseKey] ?? args[dashCaseKey];
	if (value === undefined) {
		return [];
	}
	return Array.isArray(value) ? value : [value];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
