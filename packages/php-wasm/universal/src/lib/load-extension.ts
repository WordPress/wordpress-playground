import { dirname, joinPaths } from '@php-wasm/util';
import type { Emscripten } from './emscripten-types';
import { FSHelpers } from './fs-helpers';
import type { EmscriptenOptions, PHPRuntime } from './load-php-runtime';
import { PHP, PHP_INI_PATH } from './php';
import type { UniversalPHP } from './universal-php';
import type { FileTree } from './write-files';
import { writeFiles } from './write-files';

export const PHP_EXTENSIONS_DIR = '/internal/shared/extensions';
export const PHP_EXTENSION_PRELOAD_DIR = '/internal/shared/preload';

export type PHPWasmAsyncMode = 'jspi' | 'asyncify';
export type PHPExtensionLoadTiming =
	| 'before-php-startup'
	| 'after-php-startup'
	| 'auto';
export type PHPExtensionIniDirective = 'extension' | 'zend_extension';
export type PHPExtensionSourceFormat = 'so' | 'manifest';

export interface PHPExtensionManifestArtifact {
	phpVersion: string;
	asyncMode: PHPWasmAsyncMode;
	/**
	 * Relative to the manifest URL/base URL, or an absolute URL.
	 */
	file: string;
	sha256?: string;
}

export interface PHPExtensionManifest {
	name: string;
	version?: string;
	mode?: 'php-extension';
	artifacts: PHPExtensionManifestArtifact[];
}

export type PHPExtensionSource =
	| {
			format: 'so';
			name?: string;
			bytes: Uint8Array | ArrayBuffer;
			sha256?: string;
	  }
	| {
			format: 'url';
			name?: string;
			url: string | URL;
			sha256?: string;
	  }
	| {
			format: 'manifest';
			url: string | URL;
	  }
	| {
			format: 'manifest';
			manifest: PHPExtensionManifest;
			baseUrl?: string | URL;
	  };

export interface PHPExtensionExtraFiles {
	/**
	 * Files are written here. Defaults to
	 * `/internal/shared/extensions/<name>-assets`.
	 */
	targetPath?: string;
	files: FileTree;
}

export interface LoadPHPExtensionOptions {
	source: PHPExtensionSource;
	name?: string;
	phpVersion?: string;
	asyncMode?: PHPWasmAsyncMode;
	loadTiming?: PHPExtensionLoadTiming;
	loadWithIniDirective?: PHPExtensionIniDirective;
	iniEntries?: Record<string, string>;
	extraFiles?: PHPExtensionExtraFiles;
	env?: Record<string, string>;
	extensionDir?: string;
	fetch?: typeof fetch;
}

export type ResolvePHPExtensionInstallPlanOptions = Omit<
	LoadPHPExtensionOptions,
	'phpVersion' | 'asyncMode'
> & {
	phpVersion: string;
	asyncMode: PHPWasmAsyncMode;
};

export interface InstallPHPExtensionFilesOptions {
	name: string;
	soBytes: Uint8Array | ArrayBuffer;
	loadTiming?: PHPExtensionLoadTiming;
	loadWithIniDirective?: PHPExtensionIniDirective;
	iniEntries?: Record<string, string>;
	extraFiles?: PHPExtensionExtraFiles;
	env?: Record<string, string>;
	extensionDir?: string;
}

export interface PHPExtensionInstallPlan {
	name: string;
	soPath: string;
	soBytes: Uint8Array;
	iniPath: string;
	iniContent: string;
	preloadPath?: string;
	extraFiles?: PHPExtensionExtraFiles & { targetPath: string };
	env?: Record<string, string>;
	loadTiming: Exclude<PHPExtensionLoadTiming, 'auto'>;
	loadWithIniDirective: PHPExtensionIniDirective;
	extensionDir: string;
}

export interface LoadedPHPExtension {
	name: string;
	path: string;
	iniPath: string;
	preloadPath?: string;
	manifest?: PHPExtensionManifest;
	artifact?: PHPExtensionManifestArtifact;
}

export interface ResolvedPHPExtensionInstallPlan {
	plan: PHPExtensionInstallPlan;
	manifest?: PHPExtensionManifest;
	artifact?: PHPExtensionManifestArtifact;
}

export interface PHPExtensionRuntimeInstall {
	plan: PHPExtensionInstallPlan;
	onInstalled?: (phpRuntime: PHPRuntime) => void;
}

interface ResolvedPHPExtensionSource {
	name: string;
	soBytes: Uint8Array;
	manifest?: PHPExtensionManifest;
	artifact?: PHPExtensionManifestArtifact;
}

export async function loadPHPExtension(
	php: UniversalPHP,
	options: LoadPHPExtensionOptions
): Promise<LoadedPHPExtension> {
	const phpVersion = options.phpVersion ?? getPHPVersionFromRuntime(php);
	const asyncMode = options.asyncMode ?? getAsyncModeFromRuntime(php);
	if (!phpVersion) {
		throw new Error(
			'Could not determine the PHP version for this runtime. Pass phpVersion explicitly.'
		);
	}
	if (!asyncMode) {
		throw new Error(
			'Could not determine the PHP.wasm async mode for this runtime. Pass asyncMode explicitly.'
		);
	}

	const resolved = await resolvePHPExtensionInstallPlan({
		...options,
		phpVersion,
		asyncMode,
	});

	await installPHPExtensionFiles(php, resolved.plan);

	return {
		name: resolved.plan.name,
		path: resolved.plan.soPath,
		iniPath: resolved.plan.iniPath,
		preloadPath: resolved.plan.preloadPath,
		manifest: resolved.manifest,
		artifact: resolved.artifact,
	};
}

export async function resolvePHPExtensionInstallPlan(
	options: ResolvePHPExtensionInstallPlanOptions
): Promise<ResolvedPHPExtensionInstallPlan> {
	const resolved = await resolvePHPExtensionSource(
		options,
		options.fetch ?? globalThis.fetch
	);
	const plan = buildPHPExtensionInstallPlan({
		name: options.name ?? resolved.name,
		soBytes: resolved.soBytes,
		loadTiming: options.loadTiming,
		loadWithIniDirective: options.loadWithIniDirective,
		iniEntries: options.iniEntries,
		extraFiles: options.extraFiles,
		env: options.env,
		extensionDir: options.extensionDir,
	});

	return {
		plan,
		manifest: resolved.manifest,
		artifact: resolved.artifact,
	};
}

export function appendPHPExtensionInstallPlans(
	options: EmscriptenOptions,
	extensions: PHPExtensionRuntimeInstall[]
): EmscriptenOptions {
	if (!extensions.length) {
		return options;
	}

	const env = {
		...options.ENV,
	};

	for (const { plan } of extensions) {
		Object.assign(env, plan.env);
		if (plan.loadTiming === 'before-php-startup') {
			env['PHP_INI_SCAN_DIR'] = appendPathEnv(
				env['PHP_INI_SCAN_DIR'],
				plan.extensionDir
			);
		}
	}

	return {
		...options,
		ENV: env,
		onRuntimeInitialized: (phpRuntime: PHPRuntime) => {
			options.onRuntimeInitialized?.(phpRuntime);
			for (const { plan, onInstalled } of extensions) {
				installPHPExtensionFilesSync(phpRuntime.FS, plan);
				onInstalled?.(phpRuntime);
			}
		},
	};
}

export function buildPHPExtensionInstallPlan(
	options: InstallPHPExtensionFilesOptions
): PHPExtensionInstallPlan {
	const extensionDir = options.extensionDir ?? PHP_EXTENSIONS_DIR;
	const name = validateExtensionName(options.name);
	const loadWithIniDirective = options.loadWithIniDirective ?? 'extension';
	const loadTiming = normalizeLoadTiming(
		options.loadTiming ?? 'auto',
		loadWithIniDirective
	);
	const soPath = joinPaths(extensionDir, `${name}.so`);
	const iniPath = joinPaths(extensionDir, `${name}.ini`);
	const iniContent = buildIniContent({
		loadWithIniDirective,
		soPath,
		iniEntries: options.iniEntries ?? {},
	});
	const preloadPath =
		loadTiming === 'after-php-startup'
			? joinPaths(PHP_EXTENSION_PRELOAD_DIR, `${name}.php`)
			: undefined;
	const extraFiles = options.extraFiles
		? {
				...options.extraFiles,
				targetPath:
					options.extraFiles.targetPath ??
					joinPaths(extensionDir, `${name}-assets`),
			}
		: undefined;

	return {
		name,
		soPath,
		soBytes: toUint8Array(options.soBytes),
		iniPath,
		iniContent,
		preloadPath,
		extraFiles,
		env: options.env,
		loadTiming,
		loadWithIniDirective,
		extensionDir,
	};
}

export async function installPHPExtensionFiles(
	php: UniversalPHP,
	plan: PHPExtensionInstallPlan
): Promise<void> {
	await ensureDirectory(php, plan.extensionDir);
	await php.writeFile(plan.soPath, plan.soBytes);
	await php.writeFile(plan.iniPath, plan.iniContent);

	if (plan.extraFiles) {
		await writeFiles(
			php,
			plan.extraFiles.targetPath,
			plan.extraFiles.files
		);
	}

	if (plan.env && php instanceof PHP) {
		registerRuntimeEnv(php, plan.env);
	}
	if (php instanceof PHP) {
		registerRuntimeEnv(php, {
			PHP_INI_SCAN_DIR: appendPathEnv(
				getRuntimeEnv(php)['PHP_INI_SCAN_DIR'],
				plan.extensionDir
			),
		});
	}

	await upsertPhpIniEntries(php, {
		extension_dir: plan.extensionDir,
		...(plan.loadTiming === 'after-php-startup' ? { enable_dl: 'On' } : {}),
	});

	if (plan.preloadPath) {
		await ensureDirectory(php, dirname(plan.preloadPath));
		await php.writeFile(
			plan.preloadPath,
			createExtensionPreloadScript(plan.name, plan.soPath)
		);
	}
}

export function installPHPExtensionFilesSync(
	fs: Emscripten.RootFS,
	options: InstallPHPExtensionFilesOptions | PHPExtensionInstallPlan
): PHPExtensionInstallPlan {
	const plan =
		'soPath' in options ? options : buildPHPExtensionInstallPlan(options);
	ensureDirectorySync(fs, plan.extensionDir);
	fs.writeFile(plan.soPath, plan.soBytes);
	fs.writeFile(plan.iniPath, plan.iniContent);
	if (plan.extraFiles) {
		writeFileTreeSync(
			fs,
			plan.extraFiles.targetPath,
			plan.extraFiles.files
		);
	}
	if (plan.preloadPath) {
		ensureDirectorySync(fs, dirname(plan.preloadPath));
		fs.writeFile(
			plan.preloadPath,
			createExtensionPreloadScript(plan.name, plan.soPath)
		);
	}
	return plan;
}

async function resolvePHPExtensionSource(
	options: ResolvePHPExtensionInstallPlanOptions,
	fetchFn: typeof fetch | undefined
): Promise<ResolvedPHPExtensionSource> {
	const source = options.source;
	if (source.format === 'so') {
		const name = options.name ?? source.name;
		if (!name) {
			throw new Error(
				'name is required when loading an extension from direct bytes.'
			);
		}
		if (source.sha256) {
			await assertSha256(source.bytes, source.sha256, name);
		}
		return { name, soBytes: toUint8Array(source.bytes) };
	}

	if (source.format === 'url') {
		const name =
			options.name ?? source.name ?? inferExtensionName(source.url);
		if (!name) {
			throw new Error(
				'name is required when loading an extension from a direct URL.'
			);
		}
		const soBytes = await fetchBytes(fetchFn, new URL(String(source.url)));
		if (source.sha256) {
			await assertSha256(soBytes, source.sha256, String(source.url));
		}
		return { name, soBytes };
	}

	const manifestUrl =
		'url' in source ? new URL(String(source.url)) : undefined;
	const manifest =
		'manifest' in source
			? validateExtensionManifest(source.manifest)
			: validateExtensionManifest(await fetchJson(fetchFn, manifestUrl!));
	const baseUrl =
		'baseUrl' in source && source.baseUrl
			? new URL(String(source.baseUrl))
			: manifestUrl;
	const artifact = manifest.artifacts.find(
		(candidate) =>
			candidate.phpVersion === options.phpVersion &&
			candidate.asyncMode === options.asyncMode
	);
	if (!artifact) {
		throw new Error(
			`No extension artifact found for PHP ${options.phpVersion} ${options.asyncMode}.`
		);
	}
	if (!baseUrl) {
		throw new Error(
			'Manifest artifacts require a manifest URL or baseUrl so relative files can be resolved.'
		);
	}

	const artifactUrl = new URL(artifact.file, baseUrl);
	const soBytes = await fetchBytes(fetchFn, artifactUrl);
	if (artifact.sha256) {
		await assertSha256(soBytes, artifact.sha256, artifact.file);
	}

	return {
		name: manifest.name,
		soBytes,
		manifest,
		artifact,
	};
}

async function fetchJson(
	fetchFn: typeof fetch | undefined,
	url: URL
): Promise<unknown> {
	if (!fetchFn) {
		throw new Error('loadPHPExtension() requires a fetch implementation.');
	}
	const response = await fetchFn(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch ${url}: ${response.status}`);
	}
	return await response.json();
}

async function fetchBytes(
	fetchFn: typeof fetch | undefined,
	url: URL
): Promise<Uint8Array> {
	if (!fetchFn) {
		throw new Error('loadPHPExtension() requires a fetch implementation.');
	}
	const response = await fetchFn(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch ${url}: ${response.status}`);
	}
	return new Uint8Array(await response.arrayBuffer());
}

function validateExtensionManifest(candidate: unknown): PHPExtensionManifest {
	if (!candidate || typeof candidate !== 'object') {
		throw new Error('Extension manifest must be an object.');
	}
	const manifest = candidate as PHPExtensionManifest;
	if (typeof manifest.name !== 'string' || !manifest.name) {
		throw new Error('Extension manifest must include a name.');
	}
	if (!Array.isArray(manifest.artifacts)) {
		throw new Error('Extension manifest must include an artifacts array.');
	}
	for (const artifact of manifest.artifacts) {
		if (
			!artifact ||
			typeof artifact.phpVersion !== 'string' ||
			(artifact.asyncMode !== 'jspi' &&
				artifact.asyncMode !== 'asyncify') ||
			typeof artifact.file !== 'string'
		) {
			throw new Error('Extension manifest contains an invalid artifact.');
		}
	}
	return manifest;
}

function normalizeLoadTiming(
	loadTiming: PHPExtensionLoadTiming,
	loadWithIniDirective: PHPExtensionIniDirective
): Exclude<PHPExtensionLoadTiming, 'auto'> {
	if (
		loadWithIniDirective === 'zend_extension' &&
		loadTiming === 'after-php-startup'
	) {
		throw new Error('Zend extensions must load before PHP startup.');
	}
	if (loadTiming === 'auto') {
		return loadWithIniDirective === 'zend_extension'
			? 'before-php-startup'
			: 'after-php-startup';
	}
	return loadTiming;
}

function buildIniContent({
	loadWithIniDirective,
	soPath,
	iniEntries,
}: {
	loadWithIniDirective: PHPExtensionIniDirective;
	soPath: string;
	iniEntries: Record<string, string>;
}): string {
	return [
		`${loadWithIniDirective}=${soPath}`,
		...Object.entries(iniEntries).map(([key, value]) => `${key}=${value}`),
	].join('\n');
}

function validateExtensionName(name: string): string {
	if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
		throw new Error(
			`loadPHPExtension: invalid extension name ${JSON.stringify(
				name
			)}. Use only [a-zA-Z0-9_-].`
		);
	}
	return name;
}

function inferExtensionName(url: string | URL): string | undefined {
	const path = new URL(String(url), 'https://example.com').pathname;
	const file = path.split('/').pop() ?? '';
	return file.endsWith('.so') ? file.slice(0, -3) : undefined;
}

function getPHPVersionFromRuntime(php: UniversalPHP): string | undefined {
	if (!(php instanceof PHP)) {
		return undefined;
	}
	const runtime = getPHPRuntime(php);
	const version = runtime?.phpVersion;
	if (
		typeof version?.major === 'number' &&
		typeof version?.minor === 'number'
	) {
		return `${version.major}.${version.minor}`;
	}
	return undefined;
}

function getAsyncModeFromRuntime(
	php: UniversalPHP
): PHPWasmAsyncMode | undefined {
	if (!(php instanceof PHP)) {
		return undefined;
	}
	return getPHPRuntime(php).phpWasmAsyncMode;
}

function getPHPRuntime(php: PHP): {
	ENV?: Record<string, string>;
	phpVersion?: { major?: number; minor?: number };
	phpWasmAsyncMode?: PHPWasmAsyncMode;
} {
	const privateSymbol = Object.getOwnPropertySymbols(php)[0];
	if (!privateSymbol) {
		throw new Error(
			'loadPHPExtension() requires an initialized PHP runtime.'
		);
	}
	// The PHP wrapper intentionally hides the runtime. The loader only reads
	// runtime metadata needed to pick a manifest artifact.
	// @ts-ignore
	const runtime = php[privateSymbol];
	if (!runtime) {
		throw new Error(
			'loadPHPExtension() requires an initialized PHP runtime.'
		);
	}
	return runtime;
}

function getRuntimeEnv(php: PHP): Record<string, string> {
	const runtime = getPHPRuntime(php);
	runtime.ENV = runtime.ENV ?? {};
	return runtime.ENV;
}

function registerRuntimeEnv(php: PHP, env: Record<string, string>) {
	Object.assign(getRuntimeEnv(php), env);
}

function appendPathEnv(current: string | undefined, path: string): string {
	if (!current) {
		return path;
	}
	const paths = current.split(':');
	return paths.includes(path) ? current : [...paths, path].join(':');
}

async function ensureDirectory(php: UniversalPHP, directory: string) {
	if (!(await php.fileExists(directory))) {
		await php.mkdirTree(directory);
	}
}

function ensureDirectorySync(fs: Emscripten.RootFS, directory: string) {
	if (!FSHelpers.fileExists(fs, directory)) {
		fs.mkdirTree(directory);
	}
}

async function upsertPhpIniEntries(
	php: UniversalPHP,
	entries: Record<string, string>
) {
	let phpIni = await php.readFileAsText(PHP_INI_PATH);
	for (const [key, value] of Object.entries(entries)) {
		phpIni = upsertPhpIniEntry(phpIni, key, value);
	}
	await php.writeFile(PHP_INI_PATH, phpIni);
}

function upsertPhpIniEntry(phpIni: string, key: string, value: string): string {
	const entry = `${key}=${value}`;
	const pattern = new RegExp(`^\\s*${escapeRegExp(key)}\\s*=.*$`, 'm');
	if (pattern.test(phpIni)) {
		return phpIni.replace(pattern, entry);
	}
	return `${phpIni.trimEnd()}\n${entry}\n`;
}

function createExtensionPreloadScript(
	extensionName: string,
	extensionPath: string
) {
	const extensionDir = dirname(extensionPath);
	const extensionFile = `${extensionName}.so`;
	return `<?php
if (!extension_loaded(${phpStringLiteral(extensionName)})) {
	if (!function_exists('dl')) {
		throw new RuntimeException(${phpStringLiteral(
			`Cannot load PHP.wasm extension ${extensionName}: dl() is not available.`
		)});
	}
	// PHP's dl() only accepts a filename, so point extension_dir at the
	// directory where PHP.wasm staged the side module before loading it.
	ini_set('extension_dir', ${phpStringLiteral(extensionDir)});
	if (!dl(${phpStringLiteral(extensionFile)}) && !extension_loaded(${phpStringLiteral(
		extensionName
	)})) {
		throw new RuntimeException(${phpStringLiteral(
			`Failed to load PHP.wasm extension ${extensionName}.`
		)});
	}
}
`;
}

function writeFileTreeSync(
	fs: Emscripten.RootFS,
	root: string,
	files: FileTree
) {
	ensureDirectorySync(fs, root);
	for (const [relativePath, content] of Object.entries(files)) {
		const filePath = joinPaths(root, relativePath);
		ensureDirectorySync(fs, dirname(filePath));
		if (content instanceof Uint8Array || typeof content === 'string') {
			fs.writeFile(filePath, content);
		} else {
			writeFileTreeSync(fs, filePath, content);
		}
	}
}

async function assertSha256(
	bytes: Uint8Array | ArrayBuffer,
	expected: string,
	file: string
) {
	const subtle = globalThis.crypto?.subtle;
	if (!subtle) {
		throw new Error(
			`Cannot verify ${file}: crypto.subtle is not available.`
		);
	}
	const actual = bytesToHex(
		await subtle.digest('SHA-256', toUint8Array(bytes))
	);
	if (actual !== expected) {
		throw new Error(`SHA-256 mismatch for ${file}.`);
	}
}

function bytesToHex(bytes: ArrayBuffer): string {
	return Array.from(new Uint8Array(bytes))
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
}

function toUint8Array(bytes: Uint8Array | ArrayBuffer): Uint8Array {
	return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
}

function phpStringLiteral(value: string): string {
	return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
