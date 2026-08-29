import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NativeCLIError, NativeCLIErrorCode } from './errors.js';

export const nativeTargets = [
	'linux-x64-gnu',
	'linux-arm64-gnu',
	'darwin-x64',
	'darwin-arm64',
	'win32-x64',
	'win32-arm64',
] as const;

export type NativeTarget = (typeof nativeTargets)[number];

export interface NativeHostAsset {
	path: string;
	compressedSize: number;
	compressedSha256: string;
	size: number;
	sha256: string;
}

export interface NativeHostManifest {
	schemaVersion: 1;
	protocolVersion: 1;
	hostVersion: string;
	targets: Partial<Record<NativeTarget, NativeHostAsset>>;
}

export interface PlatformInfo {
	platform: NodeJS.Platform;
	arch: string;
	glibcVersion?: string;
}

export function installedPackageRoot(importMetaUrl?: string): string {
	const moduleDirectory =
		typeof __dirname === 'string'
			? __dirname
			: dirname(fileURLToPath(importMetaUrl ?? import.meta.url));
	return moduleDirectory.endsWith(`${join('npm', 'src')}`)
		? dirname(moduleDirectory)
		: moduleDirectory;
}

export function installedAssetRoot(importMetaUrl = import.meta.url): string {
	return join(
		installedPackageRoot(importMetaUrl),
		'share',
		'wp-playground-native'
	);
}

export function currentPlatformInfo(): PlatformInfo {
	const report = process.report?.getReport() as
		| { header?: { glibcVersionRuntime?: string } }
		| undefined;
	const header = report?.header;
	return {
		platform: process.platform,
		arch: process.arch,
		glibcVersion: header?.glibcVersionRuntime,
	};
}

export function resolveNativeTarget(
	info = currentPlatformInfo()
): NativeTarget {
	if (info.platform === 'linux' && !info.glibcVersion) {
		throw new NativeCLIError(
			NativeCLIErrorCode.Unsupported,
			'Linux musl/Alpine is not supported by @wp-playground/cli-native yet. Use a glibc-based distribution.'
		);
	}

	const target = `${info.platform}-${info.arch}${
		info.platform === 'linux' ? '-gnu' : ''
	}`;
	if (!(nativeTargets as readonly string[]).includes(target)) {
		throw new NativeCLIError(
			NativeCLIErrorCode.Unsupported,
			`Unsupported native CLI platform: ${info.platform}/${info.arch}.`
		);
	}
	return target as NativeTarget;
}

export async function loadNativeHostManifest(
	manifestPath = join(installedPackageRoot(), 'native-host-manifest.json')
): Promise<NativeHostManifest> {
	let value: unknown;
	try {
		value = JSON.parse(await readFile(manifestPath, 'utf8'));
	} catch (cause) {
		throw new NativeCLIError(
			NativeCLIErrorCode.Configuration,
			`Could not read the native host manifest at ${manifestPath}.`,
			{ cause }
		);
	}
	return validateNativeHostManifest(value);
}

export function validateNativeHostManifest(value: unknown): NativeHostManifest {
	if (!isRecord(value) || value.schemaVersion !== 1) {
		throw invalidManifest('schemaVersion must be 1');
	}
	if (value.protocolVersion !== 1) {
		throw invalidManifest('protocolVersion must be 1');
	}
	if (
		typeof value.hostVersion !== 'string' ||
		!/^[a-zA-Z0-9._+-]+$/.test(value.hostVersion) ||
		value.hostVersion === '.' ||
		value.hostVersion === '..'
	) {
		throw invalidManifest('hostVersion must be a path-safe version string');
	}
	if (!isRecord(value.targets)) {
		throw invalidManifest('targets must be an object');
	}

	for (const [target, asset] of Object.entries(value.targets)) {
		if (
			!(nativeTargets as readonly string[]).includes(target) ||
			!isRecord(asset)
		) {
			throw invalidManifest(`invalid target entry ${target}`);
		}
		for (const key of ['compressedSize', 'size'] as const) {
			if (
				!Number.isSafeInteger(asset[key]) ||
				(asset[key] as number) <= 0
			) {
				throw invalidManifest(
					`${target}.${key} must be a positive integer`
				);
			}
		}
		if (
			typeof asset.path !== 'string' ||
			!asset.path.endsWith('.gz') ||
			!/^[a-zA-Z0-9._+-]+(?:\/[a-zA-Z0-9._+-]+)*$/.test(asset.path) ||
			asset.path.startsWith('/') ||
			asset.path.includes('\\') ||
			asset.path
				.split('/')
				.some((segment) => ['', '.', '..'].includes(segment))
		) {
			throw invalidManifest(`${target}.path must identify a .gz file`);
		}
		for (const key of ['compressedSha256', 'sha256'] as const) {
			const hash = asset[key];
			if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) {
				throw invalidManifest(
					`${target}.${key} must be a lowercase SHA-256`
				);
			}
		}
	}
	return value as unknown as NativeHostManifest;
}

function invalidManifest(detail: string): NativeCLIError {
	return new NativeCLIError(
		NativeCLIErrorCode.Configuration,
		`Invalid native host manifest: ${detail}.`
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
