import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const PlaygroundRepositoryUrl =
	'https://github.com/WordPress/wordpress-playground.git';

export const DockerAssetPaths = [
	'compile/base-image/Dockerfile',
	'compile/base-image/emcc-for-php-wasm.sh',
	'compile/base-image/replace.sh',
	'compile/base-image/replace-across-lines.sh',
	'compile/php/php*.patch',
	'compile-extension/docker/Dockerfile.ext',
	'compile-extension/scripts/build-in-docker.sh',
];

const PlaygroundDockerAssetPaths = DockerAssetPaths.map(
	(relativePath) => `packages/php-wasm/${relativePath}`
);

export interface EnsureDockerAssetsOptions {
	workspaceRoot: string;
	packageRoot: string;
	cacheRoot?: string;
	fetchDockerAssets?: typeof fetchDockerAssets;
}

export interface FetchDockerAssetsOptions {
	ref: string;
	cacheRoot: string;
}

export async function ensureDockerAssets({
	workspaceRoot,
	packageRoot,
	cacheRoot = getDockerAssetsCacheRoot(),
	fetchDockerAssets: fetchDockerAssetsOption,
}: EnsureDockerAssetsOptions): Promise<string> {
	const ref = resolveDockerAssetsRef({ workspaceRoot, packageRoot });
	const phpWasmRoot = path.join(cacheRoot, stableHash(ref), 'php-wasm');

	if (isPhpWasmDockerContext(phpWasmRoot)) {
		return phpWasmRoot;
	}

	console.log(
		`Fetching PHP.wasm Docker assets from WordPress/wordpress-playground ${ref}.`
	);
	const fetchedPhpWasmRoot = await (
		fetchDockerAssetsOption ?? fetchDockerAssets
	)({ ref, cacheRoot });
	if (!isPhpWasmDockerContext(fetchedPhpWasmRoot)) {
		throw new Error(
			`Fetched PHP.wasm Docker assets from ${ref}, but the cache is incomplete.`
		);
	}
	return fetchedPhpWasmRoot;
}

export async function fetchDockerAssets({
	ref,
	cacheRoot,
}: FetchDockerAssetsOptions): Promise<string> {
	const cacheDir = path.join(cacheRoot, stableHash(ref));
	const phpWasmRoot = path.join(cacheDir, 'php-wasm');
	const tempDir = `${cacheDir}-${process.pid}-${Date.now()}.tmp`;
	const tempPhpWasmRoot = path.join(tempDir, 'php-wasm');

	await rm(tempDir, { recursive: true, force: true });
	await mkdir(tempPhpWasmRoot, { recursive: true });

	try {
		const { sparseCheckoutFiles } = await import('./git-sparse-checkout');
		const fetchedPaths = await sparseCheckoutFiles({
			repoUrl: PlaygroundRepositoryUrl,
			ref,
			paths: PlaygroundDockerAssetPaths,
			outDir: tempDir,
			workDir: path.join(tempDir, '.git-work'),
		});

		for (const fetchedPath of fetchedPaths) {
			const relativePath = stripPhpWasmPathPrefix(fetchedPath);
			const source = path.join(
				tempDir,
				'packages/php-wasm',
				relativePath
			);
			const destination = path.join(tempPhpWasmRoot, relativePath);
			await mkdir(path.dirname(destination), { recursive: true });
			await rename(source, destination);
		}

		await writeFile(
			path.join(tempPhpWasmRoot, 'source.json'),
			`${JSON.stringify({ repository: PlaygroundRepositoryUrl, ref }, null, 2)}\n`
		);
		await rm(path.join(tempDir, '.git-work'), {
			recursive: true,
			force: true,
		});
		await rm(path.join(tempDir, 'packages'), {
			recursive: true,
			force: true,
		});

		await publishFetchedDockerAssets({
			tempDir,
			cacheDir,
			phpWasmRoot,
		});
	} catch (error) {
		await rm(tempDir, { recursive: true, force: true });
		throw error;
	}

	return phpWasmRoot;
}

export function isPhpWasmDockerContext(phpWasmRoot: string): boolean {
	return DockerAssetPaths.every((relativePath) => {
		if (!relativePath.includes('*')) {
			return existsSync(path.join(phpWasmRoot, relativePath));
		}
		return findMatchingLocalFiles(phpWasmRoot, relativePath).length > 0;
	});
}

export async function publishFetchedDockerAssets({
	tempDir,
	cacheDir,
	phpWasmRoot,
}: {
	tempDir: string;
	cacheDir: string;
	phpWasmRoot: string;
}): Promise<void> {
	await mkdir(path.dirname(cacheDir), { recursive: true });
	try {
		await rename(tempDir, cacheDir);
	} catch (error) {
		if (isExistingPathError(error) && isPhpWasmDockerContext(phpWasmRoot)) {
			await rm(tempDir, { recursive: true, force: true });
			return;
		}
		throw error;
	}
}

export function resolveDockerAssetsRef({
	workspaceRoot,
	packageRoot,
}: {
	workspaceRoot: string;
	packageRoot: string;
}): string {
	if (isPlaygroundWorkspace(workspaceRoot)) {
		return 'trunk';
	}
	const packageJson = readPackageJson(packageRoot);
	const version = packageJson.version;
	if (!version) {
		throw new Error(
			`Could not resolve @php-wasm/compile-extension version from ${packageRoot}.`
		);
	}
	return `v${version}`;
}

export function isPlaygroundWorkspace(workspaceRoot: string): boolean {
	return (
		existsSync(path.join(workspaceRoot, 'nx.json')) &&
		existsSync(
			path.join(
				workspaceRoot,
				'packages/php-wasm/compile-extension/package.json'
			)
		)
	);
}

export function getDockerAssetsCacheRoot(): string {
	const configuredCacheDir =
		process.env['PHP_WASM_COMPILE_EXTENSION_CACHE_DIR'];
	if (configuredCacheDir) {
		return configuredCacheDir;
	}
	const xdgCacheHome = process.env['XDG_CACHE_HOME'];
	if (xdgCacheHome) {
		return path.join(
			xdgCacheHome,
			'php-wasm/compile-extension/docker-assets'
		);
	}
	const home = os.homedir();
	if (home) {
		return path.join(home, '.cache/php-wasm/compile-extension/docker-assets');
	}
	return path.join(os.tmpdir(), 'php-wasm/compile-extension/docker-assets');
}

function readPackageJson(packageRoot: string): { version?: string } {
	const packageJsonPath = path.join(packageRoot, 'package.json');
	if (!existsSync(packageJsonPath)) {
		return {};
	}
	return JSON.parse(
		// This file is tiny and read synchronously while resolving CLI startup
		// paths; keeping the API sync avoids threading async through ref helpers.
		readFileSync(packageJsonPath, 'utf8')
	) as { version?: string };
}

export async function readDockerAssetSource(
	phpWasmRoot: string
): Promise<{ repository: string; ref: string } | undefined> {
	const sourceFile = path.join(phpWasmRoot, 'source.json');
	if (!existsSync(sourceFile)) {
		return undefined;
	}
	return readJsonFile(sourceFile);
}

function stableHash(value: string): string {
	return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function stripPhpWasmPathPrefix(fetchedPath: string): string {
	const prefix = 'packages/php-wasm/';
	if (!fetchedPath.startsWith(prefix)) {
		throw new Error(`Unexpected fetched Docker asset path: ${fetchedPath}`);
	}
	return fetchedPath.slice(prefix.length);
}

function findMatchingLocalFiles(
	root: string,
	relativePathPattern: string
): string[] {
	const directory = path.join(root, path.dirname(relativePathPattern));
	const basenamePattern = path.basename(relativePathPattern);
	if (!existsSync(directory)) {
		return [];
	}
	return readdirSync(directory, { withFileTypes: true })
		.filter(
			(entry) =>
				entry.isFile() &&
				pathSegmentMatchesPattern(entry.name, basenamePattern)
		)
		.map((entry) =>
			path
				.join(path.dirname(relativePathPattern), entry.name)
				.split(path.sep)
				.join('/')
		)
		.sort();
}

function pathSegmentMatchesPattern(segment: string, pattern: string): boolean {
	if (!pattern.includes('*')) {
		return segment === pattern;
	}
	return new RegExp(
		`^${pattern
			.split('*')
			.map(escapeRegExp)
			.join('.*')}$`
	).test(segment);
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function readJsonFile<T>(filename: string): Promise<T> {
	return JSON.parse(await readFile(filename, 'utf8')) as T;
}

function isExistingPathError(error: unknown): boolean {
	return (
		typeof error === 'object' &&
		error !== null &&
		'code' in error &&
		['EEXIST', 'ENOTEMPTY', 'EPERM'].includes(String(error.code))
	);
}
