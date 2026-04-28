import { PHP } from './php';
import type { Emscripten } from './emscripten-types';
import type { EmscriptenOptions } from './load-php-runtime';
import { FSHelpers } from './fs-helpers';

export const PHP_EXTENSIONS_DIR = '/internal/shared/extensions';

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

export interface PHPExtensionFile {
	path: string;
	data: Uint8Array;
}

export interface PHPExtensionInstallOptions {
	name: string;
	soBytes: Uint8Array;
	kind?: 'extension' | 'zend_extension';
	iniEntries?: Record<string, string>;
	extraFiles?: PHPExtensionFile[];
	extensionDir?: string;
	fileName?: string;
	iniFileName?: string;
}

export interface PreparedPHPWasmExtension extends PHPExtensionInstallOptions {
	manifest?: PHPWasmExtensionManifest;
	artifact?: PHPWasmExtensionArtifact;
}

export interface LoadedExtension {
	manifest: PHPWasmExtensionManifest;
	artifact: PHPWasmExtensionArtifact;
	path: string;
	iniPath: string;
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

	const manifestUrl = toUrl(options.manifestUrl);
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

	const prepared: PreparedPHPWasmExtension = {
		name: options.extensionName ?? manifest.name,
		soBytes: new Uint8Array(artifactBytes),
		extensionDir: options.extensionDir,
		fileName: basename(artifact.file),
		iniFileName: options.iniFileName,
		manifest,
		artifact,
	};
	const { soPath, iniPath, iniContent, extensionDir } =
		buildExtensionFiles(prepared);

	ensureDirectory(php, extensionDir);
	php.writeFile(soPath, prepared.soBytes);
	php.writeFile(iniPath, iniContent);
	for (const file of prepared.extraFiles ?? []) {
		ensureDirectory(php, dirname(file.path));
		php.writeFile(file.path, file.data);
	}
	registerScanDir(php, extensionDir);

	return {
		manifest,
		artifact,
		path: soPath,
		iniPath,
	};
}

export async function prepareExtensionFromManifest(
	options: Omit<LoadExtensionOptions, 'php'>
): Promise<PreparedPHPWasmExtension> {
	const fetchFn = options.fetch ?? globalThis.fetch;
	if (!fetchFn) {
		throw new Error(
			'prepareExtensionFromManifest() requires a fetch implementation.'
		);
	}

	if (!options.phpVersion) {
		throw new Error(
			'prepareExtensionFromManifest() requires phpVersion explicitly.'
		);
	}
	if (!options.asyncMode) {
		throw new Error(
			'prepareExtensionFromManifest() requires asyncMode explicitly.'
		);
	}

	const manifestUrl = toUrl(options.manifestUrl);
	const manifest = validateExtensionManifest(
		await fetchJson(fetchFn, manifestUrl)
	);
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

	const artifactUrl = new URL(artifact.file, manifestUrl);
	const artifactBytes = await fetchArrayBuffer(fetchFn, artifactUrl);
	if (artifact.sha256) {
		await assertSha256(artifactBytes, artifact.sha256, artifact.file);
	}

	return {
		name: options.extensionName ?? manifest.name,
		soBytes: new Uint8Array(artifactBytes),
		extensionDir: options.extensionDir,
		fileName: basename(artifact.file),
		iniFileName: options.iniFileName,
		manifest,
		artifact,
	};
}

export function installPHPExtensionFilesSync(
	fs: Emscripten.RootFS,
	options: PHPExtensionInstallOptions
): void {
	const { soBytes, extraFiles = [] } = options;
	const { soPath, iniPath, iniContent, extensionDir } =
		buildExtensionFiles(options);

	if (!FSHelpers.fileExists(fs, extensionDir)) {
		fs.mkdirTree(extensionDir);
	}
	if (!FSHelpers.fileExists(fs, soPath)) {
		fs.writeFile(soPath, soBytes);
	}
	if (!FSHelpers.fileExists(fs, iniPath)) {
		fs.writeFile(iniPath, iniContent);
	}
	for (const file of extraFiles) {
		if (FSHelpers.fileExists(fs, file.path)) {
			continue;
		}
		const dir = dirname(file.path);
		if (dir && !FSHelpers.fileExists(fs, dir)) {
			fs.mkdirTree(dir);
		}
		fs.writeFile(file.path, file.data);
	}
}

export function withPHPExtensionScanDir(
	options: EmscriptenOptions,
	extensionDir = PHP_EXTENSIONS_DIR
): EmscriptenOptions {
	return {
		...options,
		ENV: {
			...options.ENV,
			PHP_INI_SCAN_DIR: appendScanDir(
				options.ENV?.PHP_INI_SCAN_DIR,
				extensionDir
			),
		},
	};
}

function buildExtensionFiles(options: PHPExtensionInstallOptions): {
	extensionDir: string;
	soPath: string;
	iniPath: string;
	iniContent: string;
} {
	const {
		name,
		kind = 'extension',
		iniEntries = {},
		extensionDir = PHP_EXTENSIONS_DIR,
		fileName = `${name}.so`,
		iniFileName = `${name}.ini`,
	} = options;
	if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
		throw new Error(
			`loadExtension: invalid extension name ${JSON.stringify(
				name
			)}. Use only [a-zA-Z0-9_-].`
		);
	}
	const soPath = `${extensionDir}/${fileName}`;
	const iniPath = `${extensionDir}/${iniFileName}`;
	const iniLines = [`${kind}=${soPath}`];
	for (const [key, value] of Object.entries(iniEntries)) {
		iniLines.push(`${key}=${value}`);
	}

	return {
		extensionDir,
		soPath,
		iniPath,
		iniContent: iniLines.join('\n'),
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
	runtime.ENV['PHP_INI_SCAN_DIR'] = appendScanDir(
		runtime.ENV['PHP_INI_SCAN_DIR'],
		extensionDir
	);
}

function appendScanDir(current: string | undefined, extensionDir: string) {
	if (!current) {
		return extensionDir;
	}
	const paths = current.split(':');
	if (!paths.includes(extensionDir)) {
		return [...paths, extensionDir].join(':');
	}
	return current;
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
		throw new Error(`Cannot verify ${file}: crypto.subtle is not available.`);
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

function toUrl(url: string | URL): URL {
	if (url instanceof URL) {
		return url;
	}
	try {
		return new URL(url);
	} catch {
		const location = (globalThis as { location?: { href?: string } })
			.location;
		const base = location?.href ?? 'file://';
		return new URL(url, base);
	}
}

function dirname(file: string): string {
	const index = file.lastIndexOf('/');
	if (index === -1) {
		return '';
	}
	if (index === 0) {
		return '/';
	}
	return file.slice(0, index);
}
