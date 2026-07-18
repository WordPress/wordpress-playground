import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

export const PHP_ASSET_MANIFEST_RELATIVE_PATH =
	'packages/playground/cli-native/assets/php-assets.json';

function isRecord(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function fail(message) {
	throw new Error(`Invalid PHP asset manifest: ${message}`);
}

async function sha256(path) {
	const hash = createHash('sha256');
	for await (const chunk of createReadStream(path)) hash.update(chunk);
	return hash.digest('hex');
}

function resolveAssetPath(assetRoot, path, description) {
	if (
		typeof path !== 'string' ||
		path.length === 0 ||
		isAbsolute(path) ||
		path.includes('\\')
	) {
		fail(`${description} must be a relative forward-slash path`);
	}
	const resolvedRoot = resolve(assetRoot);
	const resolvedPath = resolve(resolvedRoot, path);
	const relativePath = relative(resolvedRoot, resolvedPath);
	if (
		relativePath === '' ||
		relativePath === '..' ||
		relativePath.startsWith(`..${sep}`) ||
		isAbsolute(relativePath)
	) {
		fail(`${description} escapes the asset root: ${path}`);
	}
	return resolvedPath;
}

async function verifyFile(assetRoot, version, variant, kind, descriptor) {
	const manifestPrefix =
		variant === 'base'
			? `php.${version}`
			: `php.${version}.variants.${variant}`;
	const humanVariant = variant === 'base' ? '' : `${variant} `;
	if (!isRecord(descriptor)) {
		fail(`${manifestPrefix}.${kind} must be an object`);
	}
	const keys = Object.keys(descriptor);
	if (
		keys.length !== 2 ||
		!keys.includes('path') ||
		!keys.includes('sha256')
	) {
		fail(`${manifestPrefix}.${kind} must contain only path and sha256`);
	}
	if (!/^[0-9a-f]{64}$/.test(descriptor.sha256 ?? '')) {
		fail(
			`${manifestPrefix}.${kind}.sha256 must be a lowercase SHA-256 digest`
		);
	}
	const absolutePath = resolveAssetPath(
		assetRoot,
		descriptor.path,
		`${manifestPrefix}.${kind}.path`
	);
	let fileStats;
	try {
		fileStats = await stat(absolutePath);
	} catch (error) {
		if (error?.code === 'ENOENT') {
			throw new Error(
				`PHP ${version} ${humanVariant}${kind} asset is missing: ${descriptor.path}`
			);
		}
		throw error;
	}
	if (!fileStats.isFile()) {
		throw new Error(
			`PHP ${version} ${humanVariant}${kind} asset is not a file: ${descriptor.path}`
		);
	}
	const digest = await sha256(absolutePath);
	if (digest !== descriptor.sha256) {
		throw new Error(
			`PHP ${version} ${humanVariant}${kind} asset checksum mismatch for ${descriptor.path}: expected ${descriptor.sha256}, received ${digest}`
		);
	}
	return {
		version,
		variant,
		kind,
		path: descriptor.path,
		absolutePath,
		sha256: digest,
	};
}

async function verifyComponent(
	assetRoot,
	version,
	variant,
	component,
	forbidWasmtime
) {
	if (!isRecord(component)) {
		fail(`PHP ${version} ${variant} component must be an object`);
	}
	const keys = Object.keys(component);
	if (
		!keys.includes('wasm') ||
		keys.some((key) => key !== 'wasm' && key !== 'wasmtime')
	) {
		fail(
			`PHP ${version} ${variant} component must contain wasm and optional wasmtime`
		);
	}
	if (forbidWasmtime && 'wasmtime' in component) {
		throw new Error(
			`Portable npm PHP assets must not declare a Wasmtime precompile for PHP ${version} ${variant}`
		);
	}
	const wasm = await verifyFile(
		assetRoot,
		version,
		variant,
		'wasm',
		component.wasm
	);
	if ('wasmtime' in component) {
		await verifyFile(
			assetRoot,
			version,
			variant,
			'wasmtime',
			component.wasmtime
		);
	}
	return wasm;
}

export async function verifyPortablePhpAssets(
	assetRoot,
	{ forbidWasmtime = false } = {}
) {
	const manifestPath = resolve(assetRoot, PHP_ASSET_MANIFEST_RELATIVE_PATH);
	let manifest;
	try {
		manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
	} catch (error) {
		if (error?.code === 'ENOENT') {
			throw new Error(`PHP asset manifest is missing: ${manifestPath}`);
		}
		throw new Error(
			`Could not parse PHP asset manifest ${manifestPath}: ${error.message}`
		);
	}
	if (!isRecord(manifest)) fail('root must be an object');
	const rootKeys = Object.keys(manifest);
	if (
		rootKeys.length !== 3 ||
		!rootKeys.includes('schemaVersion') ||
		!rootKeys.includes('runtime') ||
		!rootKeys.includes('php')
	) {
		fail('root must contain only schemaVersion, runtime, and php');
	}
	if (manifest.schemaVersion !== 2) fail('schemaVersion must equal 2');
	if (manifest.runtime !== 'wasip2-component') {
		fail('runtime must equal wasip2-component');
	}
	if (!isRecord(manifest.php) || Object.keys(manifest.php).length === 0) {
		fail('php must be a non-empty object');
	}

	const versions = Object.keys(manifest.php);
	const components = [];
	for (const version of versions) {
		if (!/^\d+\.\d+$/.test(version)) {
			fail(`invalid PHP version key ${JSON.stringify(version)}`);
		}
		const entry = manifest.php[version];
		if (!isRecord(entry)) fail(`php.${version} must be an object`);
		const entryKeys = Object.keys(entry);
		if (
			!entryKeys.includes('wasm') ||
			entryKeys.some(
				(key) =>
					key !== 'wasm' && key !== 'wasmtime' && key !== 'variants'
			)
		) {
			fail(
				`php.${version} must contain wasm, optional wasmtime, and optional variants`
			);
		}
		components.push(
			await verifyComponent(
				assetRoot,
				version,
				'base',
				{
					wasm: entry.wasm,
					...('wasmtime' in entry
						? { wasmtime: entry.wasmtime }
						: {}),
				},
				forbidWasmtime
			)
		);
		if ('variants' in entry) {
			if (!isRecord(entry.variants)) {
				fail(`php.${version}.variants must be an object`);
			}
			const variantKeys = Object.keys(entry.variants);
			if (variantKeys.length !== 1 || variantKeys[0] !== 'extended') {
				fail(`php.${version}.variants must contain only extended`);
			}
			components.push(
				await verifyComponent(
					assetRoot,
					version,
					'extended',
					entry.variants.extended,
					forbidWasmtime
				)
			);
		}
	}

	return { manifest, manifestPath, versions, components };
}
