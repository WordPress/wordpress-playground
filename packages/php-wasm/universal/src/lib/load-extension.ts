import { PHP, PHP_INI_PATH } from './php';

export type PHPWasmAsyncMode = 'jspi' | 'asyncify';

export interface PHPWasmExtensionArtifact {
	phpVersion: string;
	asyncMode: PHPWasmAsyncMode;
	file: string;
	sha256?: string;
}

export interface PHPWasmExtensionManifest {
	name: string;
	version?: string;
	mode?: 'php-extension';
	artifacts: PHPWasmExtensionArtifact[];
}

export interface LoadExtensionOptions {
	php?: PHP;
	manifestUrl: string | URL;
	phpVersion?: string;
	asyncMode?: PHPWasmAsyncMode;
	extensionDir?: string;
	extensionName?: string;
	iniFileName?: string;
	fetch?: typeof fetch;
}

export interface LoadedExtension {
	manifest: PHPWasmExtensionManifest;
	artifact: PHPWasmExtensionArtifact;
	path: string;
	iniPath: string;
	preloadPath: string;
}

export async function loadExtension(
	php: PHP,
	options: Omit<LoadExtensionOptions, 'php'>
): Promise<LoadedExtension>;
export async function loadExtension(
	options: LoadExtensionOptions & { php: PHP }
): Promise<LoadedExtension>;
export async function loadExtension(
	phpOrOptions: PHP | (LoadExtensionOptions & { php: PHP }),
	maybeOptions?: Omit<LoadExtensionOptions, 'php'>
): Promise<LoadedExtension> {
	const options =
		phpOrOptions instanceof PHP
			? { ...maybeOptions, php: phpOrOptions }
			: phpOrOptions;
	const php = options.php;
	const fetchFn = options.fetch ?? globalThis.fetch;
	if (!fetchFn) {
		throw new Error('loadExtension() requires a fetch implementation.');
	}

	const manifestUrl = new URL(String(options.manifestUrl));
	const manifest = validateExtensionManifest(
		await fetchJson(fetchFn, manifestUrl)
	);
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

	const artifact = manifest.artifacts.find(
		(candidate) =>
			candidate.phpVersion === phpVersion &&
			candidate.asyncMode === asyncMode
	);
	if (!artifact) {
		throw new Error(
			`No extension artifact found for PHP ${phpVersion} ${asyncMode}.`
		);
	}

	const artifactUrl = new URL(artifact.file, manifestUrl);
	const artifactBytes = await fetchArrayBuffer(fetchFn, artifactUrl);
	if (artifact.sha256) {
		await assertSha256(artifactBytes, artifact.sha256, artifact.file);
	}

	const extensionDir = options.extensionDir ?? '/internal/shared/extensions';
	const extensionName = options.extensionName ?? manifest.name;
	const fileName = basename(artifact.file);
	const extensionPath = `${extensionDir}/${fileName}`;
	const iniPath = `${extensionDir}/${
		options.iniFileName ?? `${extensionName}.ini`
	}`;
	const preloadDir = '/internal/shared/preload';
	const preloadPath = `${preloadDir}/${sanitizePathSegment(
		extensionName
	)}.php`;

	ensureDirectory(php, extensionDir);
	ensureDirectory(php, preloadDir);
	enableDynamicExtensionLoading(php, extensionDir);
	php.writeFile(extensionPath, new Uint8Array(artifactBytes));
	php.writeFile(iniPath, `extension=${extensionPath}\n`);
	// PHP_INI_SCAN_DIR is captured too early for runtimes that are already
	// initialized, so the preload script performs the actual runtime load.
	php.writeFile(
		preloadPath,
		createExtensionPreloadScript(extensionName, fileName)
	);
	registerScanDir(php, extensionDir);

	return {
		manifest,
		artifact,
		path: extensionPath,
		iniPath,
		preloadPath,
	};
}

async function fetchJson(fetchFn: typeof fetch, url: URL): Promise<unknown> {
	const response = await fetchFn(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch ${url}: ${response.status}`);
	}
	return await response.json();
}

async function fetchArrayBuffer(
	fetchFn: typeof fetch,
	url: URL
): Promise<ArrayBuffer> {
	const response = await fetchFn(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch ${url}: ${response.status}`);
	}
	return await response.arrayBuffer();
}

function validateExtensionManifest(
	candidate: unknown
): PHPWasmExtensionManifest {
	if (!candidate || typeof candidate !== 'object') {
		throw new Error('Extension manifest must be an object.');
	}
	const manifest = candidate as PHPWasmExtensionManifest;
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

function getPHPVersionFromRuntime(php: PHP): string | undefined {
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

function getAsyncModeFromRuntime(php: PHP): PHPWasmAsyncMode | undefined {
	const runtime = getPHPRuntime(php);
	return runtime?.phpWasmAsyncMode;
}

function ensureDirectory(php: PHP, directory: string) {
	if (!php.fileExists(directory)) {
		php.mkdirTree(directory);
	}
}

function registerScanDir(php: PHP, extensionDir: string) {
	const runtime = getPHPRuntime(php);
	runtime.ENV = runtime.ENV ?? {};
	const current = runtime.ENV['PHP_INI_SCAN_DIR'];
	if (!current) {
		runtime.ENV['PHP_INI_SCAN_DIR'] = extensionDir;
		return;
	}
	const paths = current.split(':');
	if (!paths.includes(extensionDir)) {
		runtime.ENV['PHP_INI_SCAN_DIR'] = [...paths, extensionDir].join(':');
	}
}

function getPHPRuntime(php: PHP): {
	ENV?: Record<string, string>;
	phpVersion?: { major?: number; minor?: number };
	phpWasmAsyncMode?: PHPWasmAsyncMode;
} {
	const privateSymbol = Object.getOwnPropertySymbols(php)[0];
	if (!privateSymbol) {
		throw new Error('loadExtension() requires an initialized PHP runtime.');
	}
	// The PHP wrapper intentionally hides the runtime. This loader needs the
	// runtime metadata to choose the artifact before the first request.
	// @ts-ignore
	const runtime = php[privateSymbol];
	if (!runtime) {
		throw new Error('loadExtension() requires an initialized PHP runtime.');
	}
	return runtime;
}

async function assertSha256(
	bytes: ArrayBuffer,
	expected: string,
	file: string
) {
	const subtle = globalThis.crypto?.subtle;
	if (!subtle) {
		throw new Error(
			`Cannot verify ${file}: crypto.subtle is not available.`
		);
	}
	const actual = bytesToHex(await subtle.digest('SHA-256', bytes));
	if (actual !== expected) {
		throw new Error(`SHA-256 mismatch for ${file}.`);
	}
}

function bytesToHex(bytes: ArrayBuffer): string {
	return Array.from(new Uint8Array(bytes))
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
}

function basename(file: string): string {
	const parts = file.split('/');
	return parts[parts.length - 1] || file;
}

function enableDynamicExtensionLoading(php: PHP, extensionDir: string) {
	let phpIni = php.readFileAsText(PHP_INI_PATH);
	phpIni = upsertPhpIniEntry(phpIni, 'enable_dl', 'On');
	phpIni = upsertPhpIniEntry(phpIni, 'extension_dir', extensionDir);
	php.writeFile(PHP_INI_PATH, phpIni);
}

function createExtensionPreloadScript(extensionName: string, fileName: string) {
	return `<?php
if (!extension_loaded(${phpStringLiteral(extensionName)})) {
	if (!function_exists('dl')) {
		throw new RuntimeException(${phpStringLiteral(
			`Cannot load PHP.wasm extension ${extensionName}: dl() is not available.`
		)});
	}
	if (!dl(${phpStringLiteral(fileName)}) && !extension_loaded(${phpStringLiteral(
		extensionName
	)})) {
		throw new RuntimeException(${phpStringLiteral(
			`Failed to load PHP.wasm extension ${extensionName}.`
		)});
	}
}
`;
}

function phpStringLiteral(value: string): string {
	return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function sanitizePathSegment(value: string): string {
	return value.replace(/[^A-Za-z0-9_.-]/g, '_') || 'extension';
}

function upsertPhpIniEntry(phpIni: string, key: string, value: string): string {
	const entry = `${key}=${value}`;
	const pattern = new RegExp(`^\\s*${escapeRegExp(key)}\\s*=.*$`, 'm');
	if (pattern.test(phpIni)) {
		return phpIni.replace(pattern, entry);
	}
	return `${phpIni.trimEnd()}\n${entry}\n`;
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
