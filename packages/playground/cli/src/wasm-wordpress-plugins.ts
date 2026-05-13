import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { RuntimePHPExtensionSource } from '@php-wasm/node';
import type { RunCLIArgs } from './run-cli';

const MU_PLUGINS_VFS_DIR = '/wordpress/wp-content/mu-plugins';

export interface WasmWordPressPluginHook {
	type: 'action' | 'filter';
	hook: string;
	callback: string;
	priority?: number;
	acceptedArgs?: number;
}

export interface WasmWordPressPluginConfig {
	/**
	 * Stable WordPress plugin slug. Used for the generated mu-plugin filename.
	 */
	slug: string;
	name?: string;
	description?: string;
	version?: string;
	/**
	 * PHP.wasm extension that exposes PHP functions/classes implemented by
	 * the WebAssembly side module.
	 */
	extension: RuntimePHPExtensionSource;
	/**
	 * Optional PHP bootstrap file. Relative paths resolve from the descriptor
	 * file. Use this for PHP wrappers around extension functions.
	 */
	bootstrap?: string;
	/**
	 * Inline PHP bootstrap code. Mutually exclusive with `bootstrap`.
	 */
	bootstrapCode?: string;
	/**
	 * Declarative WordPress hook registrations. The callback must name a PHP
	 * callable made available by the extension or bootstrap code.
	 */
	hooks?: WasmWordPressPluginHook[];
}

export function expandWasmWordPressPluginArgs(args: RunCLIArgs): RunCLIArgs {
	const configPaths = getArrayOption(args, 'wasmWordPressPlugin');
	if (!configPaths.length) {
		return args;
	}

	const pluginConfigs = configPaths.map(readWasmWordPressPluginConfig);
	const runtimePHPExtensions = [
		...(args.runtimePHPExtensions ?? []),
		...pluginConfigs.map((plugin) => plugin.extension),
	];
	const extraSteps = [
		...((args as any)['additional-blueprint-steps'] || []),
		...pluginConfigs.map((plugin) => ({
			step: 'writeFile',
			path: `${MU_PLUGINS_VFS_DIR}/${plugin.slug}.php`,
			data: createWasmWordPressPluginBootstrap(plugin),
		})),
	];

	return {
		...args,
		wasmWordPressPlugin: undefined,
		'wasm-wordpress-plugin': undefined,
		runtimePHPExtensions,
		'additional-blueprint-steps': extraSteps,
	};
}

export function readWasmWordPressPluginConfig(
	configPath: string
): WasmWordPressPluginConfig {
	const absoluteConfigPath = path.resolve(process.cwd(), configPath);
	const configDir = path.dirname(absoluteConfigPath);
	let config: unknown;
	try {
		config = JSON.parse(readFileSync(absoluteConfigPath, 'utf8'));
	} catch (error) {
		throw new Error(`Could not read WASM WordPress plugin: ${configPath}`, {
			cause: error,
		});
	}

	if (!isRecord(config)) {
		throw new Error(
			`Invalid WASM WordPress plugin: ${configPath}. Expected an object.`
		);
	}

	const slug = config['slug'];
	if (typeof slug !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
		throw new Error(
			`Invalid WASM WordPress plugin: ${configPath}. slug must contain lowercase letters, numbers, and hyphens.`
		);
	}

	if (!isRecord(config['extension'])) {
		throw new Error(
			`Invalid WASM WordPress plugin: ${configPath}. Expected an extension object.`
		);
	}

	const bootstrap = config['bootstrap'];
	const bootstrapCode = config['bootstrapCode'];
	if (bootstrap !== undefined && typeof bootstrap !== 'string') {
		throw new Error(
			`Invalid WASM WordPress plugin: ${configPath}. bootstrap must be a string path.`
		);
	}
	if (bootstrapCode !== undefined && typeof bootstrapCode !== 'string') {
		throw new Error(
			`Invalid WASM WordPress plugin: ${configPath}. bootstrapCode must be a string.`
		);
	}
	if (bootstrap !== undefined && bootstrapCode !== undefined) {
		throw new Error(
			`Invalid WASM WordPress plugin: ${configPath}. Use bootstrap or bootstrapCode, not both.`
		);
	}

	const hooks = readHooks(configPath, config['hooks']);
	const inlineBootstrap =
		typeof bootstrapCode === 'string'
			? bootstrapCode
			: bootstrap
				? readBootstrap(configPath, configDir, bootstrap)
				: undefined;

	return {
		slug,
		name: readOptionalString(configPath, config, 'name'),
		description: readOptionalString(configPath, config, 'description'),
		version: readOptionalString(configPath, config, 'version'),
		extension: normalizeExtensionConfig(
			configPath,
			configDir,
			config['extension']
		),
		bootstrapCode: inlineBootstrap,
		hooks,
	};
}

export function createWasmWordPressPluginBootstrap(
	plugin: WasmWordPressPluginConfig
): string {
	const lines = [
		'<?php',
		'/**',
		` * Plugin Name: ${plugin.name ?? plugin.slug}`,
	];
	if (plugin.description) {
		lines.push(` * Description: ${plugin.description}`);
	}
	if (plugin.version) {
		lines.push(` * Version: ${plugin.version}`);
	}
	lines.push(
		' */',
		'',
		"if ( ! defined( 'ABSPATH' ) ) {",
		'\texit;',
		'}',
		''
	);

	if (plugin.extension.name) {
		lines.push(
			`if ( ! extension_loaded( ${phpStringLiteral(plugin.extension.name)} ) ) {`,
			`\terror_log( ${phpStringLiteral(`${plugin.slug}: PHP.wasm extension ${plugin.extension.name} is not loaded.`)} );`,
			'\treturn;',
			'}',
			''
		);
	}

	if (plugin.bootstrapCode) {
		lines.push(trimPhpTags(plugin.bootstrapCode).trim(), '');
	}

	for (const hook of plugin.hooks ?? []) {
		const registerFunction =
			hook.type === 'action' ? 'add_action' : 'add_filter';
		lines.push(
			`${registerFunction}( ${phpStringLiteral(hook.hook)}, ${phpStringLiteral(
				hook.callback
			)}, ${hook.priority ?? 10}, ${hook.acceptedArgs ?? 1} );`
		);
	}

	return `${lines.join('\n')}\n`;
}

function normalizeExtensionConfig(
	configPath: string,
	configDir: string,
	extension: Record<string, unknown>
): RuntimePHPExtensionSource {
	assertRuntimePHPExtensionSource(configPath, extension);
	const normalized = structuredClone(extension) as RuntimePHPExtensionSource;
	const source = normalized.source as Record<string, unknown>;
	if (source['format'] === 'url') {
		source['url'] = resolveLocalReference(configDir, source['url']);
	}
	if (source['format'] === 'manifest') {
		if (source['manifestUrl'] !== undefined) {
			source['manifestUrl'] = resolveLocalReference(
				configDir,
				source['manifestUrl']
			);
		}
		if (source['baseUrl'] !== undefined) {
			source['baseUrl'] = resolveLocalReference(
				configDir,
				source['baseUrl']
			);
		}
	}
	return normalized;
}

function assertRuntimePHPExtensionSource(
	configPath: string,
	extension: Record<string, unknown>
): void {
	if (!isRecord(extension['source'])) {
		throw new Error(
			`Invalid WASM WordPress plugin: ${configPath}. extension.source is required.`
		);
	}
	if (
		'loadWithIniDirective' in extension &&
		extension['loadWithIniDirective'] !== false &&
		extension['loadWithIniDirective'] !== 'extension' &&
		extension['loadWithIniDirective'] !== 'zend_extension'
	) {
		throw new Error(
			`Invalid WASM WordPress plugin: ${configPath}. extension.loadWithIniDirective must be "extension", "zend_extension", or false.`
		);
	}

	const source = extension['source'];
	if (source['format'] === 'so') {
		throw new Error(
			`Invalid WASM WordPress plugin: ${configPath}. The CLI cannot load direct bytes; use a manifest or URL source.`
		);
	}
	if (source['format'] === 'url') {
		if (typeof source['url'] !== 'string') {
			throw new Error(
				`Invalid WASM WordPress plugin: ${configPath}. A URL source requires a string url.`
			);
		}
		return;
	}
	if (source['format'] === 'manifest') {
		if (
			typeof source['manifestUrl'] !== 'string' &&
			!isRecord(source['manifest'])
		) {
			throw new Error(
				`Invalid WASM WordPress plugin: ${configPath}. A manifest source requires manifestUrl or manifest.`
			);
		}
		return;
	}

	throw new Error(
		`Invalid WASM WordPress plugin: ${configPath}. Unknown extension source format.`
	);
}

function readHooks(
	configPath: string,
	hooks: unknown
): WasmWordPressPluginHook[] {
	if (hooks === undefined) {
		return [];
	}
	if (!Array.isArray(hooks)) {
		throw new Error(
			`Invalid WASM WordPress plugin: ${configPath}. hooks must be an array.`
		);
	}
	return hooks.map((hook, index) => {
		if (!isRecord(hook)) {
			throw new Error(
				`Invalid WASM WordPress plugin: ${configPath}. hooks[${index}] must be an object.`
			);
		}
		const type = hook['type'];
		if (type !== 'action' && type !== 'filter') {
			throw new Error(
				`Invalid WASM WordPress plugin: ${configPath}. hooks[${index}].type must be "action" or "filter".`
			);
		}
		if (typeof hook['hook'] !== 'string') {
			throw new Error(
				`Invalid WASM WordPress plugin: ${configPath}. hooks[${index}].hook must be a string.`
			);
		}
		if (typeof hook['callback'] !== 'string') {
			throw new Error(
				`Invalid WASM WordPress plugin: ${configPath}. hooks[${index}].callback must be a string.`
			);
		}
		return {
			type,
			hook: hook['hook'],
			callback: hook['callback'],
			priority: readOptionalNumber(configPath, hook, 'priority'),
			acceptedArgs: readOptionalNumber(configPath, hook, 'acceptedArgs'),
		};
	});
}

function readBootstrap(
	configPath: string,
	configDir: string,
	bootstrap: string
): string {
	try {
		return readFileSync(path.resolve(configDir, bootstrap), 'utf8');
	} catch (error) {
		throw new Error(
			`Invalid WASM WordPress plugin: ${configPath}. Could not read bootstrap file ${bootstrap}.`,
			{ cause: error }
		);
	}
}

function readOptionalString(
	configPath: string,
	record: Record<string, unknown>,
	key: string
): string | undefined {
	const value = record[key];
	if (value === undefined) {
		return undefined;
	}
	if (typeof value !== 'string') {
		throw new Error(
			`Invalid WASM WordPress plugin: ${configPath}. ${key} must be a string.`
		);
	}
	return value;
}

function readOptionalNumber(
	configPath: string,
	record: Record<string, unknown>,
	key: string
): number | undefined {
	const value = record[key];
	if (value === undefined) {
		return undefined;
	}
	if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
		throw new Error(
			`Invalid WASM WordPress plugin: ${configPath}. ${key} must be a non-negative integer.`
		);
	}
	return value;
}

function resolveLocalReference(configDir: string, value: unknown): unknown {
	if (typeof value !== 'string' || isRemoteOrFileUrl(value)) {
		return value;
	}
	return path.resolve(configDir, value);
}

function isRemoteOrFileUrl(value: string): boolean {
	return /^(https?:|file:)/.test(value);
}

function getArrayOption(
	args: RunCLIArgs,
	camelCaseKey: 'wasmWordPressPlugin'
): string[] {
	const dashCaseKey = 'wasm-wordpress-plugin';
	const optionSource = args as unknown as Record<string, unknown>;
	const value = optionSource[camelCaseKey] ?? optionSource[dashCaseKey];
	if (value === undefined) {
		return [];
	}
	return Array.isArray(value) ? (value as string[]) : [value as string];
}

function phpStringLiteral(value: string): string {
	return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function trimPhpTags(source: string): string {
	return source.replace(/^\s*<\?php\s*/u, '').replace(/\s*\?>\s*$/u, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
