import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { createDockerContext } from './docker';
import {
	DockerAssetPaths,
	isPhpWasmDockerContext,
	publishFetchedDockerAssets,
	resolveDockerAssetsRef,
} from './docker-assets';

describe('createDockerContext', () => {
	it('uses the Playground workspace assets when available', async () => {
		const root = await mkdtemp(
			path.join(os.tmpdir(), 'compile-extension-context-')
		);
		const workspaceRoot = path.join(root, 'workspace');
		const workspacePhpWasmRoot = path.join(
			workspaceRoot,
			'packages/php-wasm'
		);
		const packageRoot = path.join(root, 'package');

		await createPhpWasmDockerAssets(workspacePhpWasmRoot);
		await createPhpWasmDockerAssets(path.join(packageRoot, 'php-wasm'));

		const context = await createDockerContext(workspaceRoot, {
			packageRoot,
		});

		expect(context).toMatchObject({
			workspaceRoot,
			phpWasmRoot: workspacePhpWasmRoot,
			compileRoot: path.join(workspacePhpWasmRoot, 'compile'),
			compileExtensionRoot: path.join(
				workspacePhpWasmRoot,
				'compile-extension'
			),
		});
	});

	it('falls back to packaged assets outside the Playground workspace', async () => {
		const root = await mkdtemp(
			path.join(os.tmpdir(), 'compile-extension-context-')
		);
		const workspaceRoot = path.join(root, 'workspace');
		const packageRoot = path.join(root, 'package');
		const packagedPhpWasmRoot = path.join(packageRoot, 'php-wasm');

		await mkdir(workspaceRoot, { recursive: true });
		await createPhpWasmDockerAssets(packagedPhpWasmRoot);

		const context = await createDockerContext(workspaceRoot, {
			packageRoot,
		});

		expect(context).toMatchObject({
			workspaceRoot,
			phpWasmRoot: packagedPhpWasmRoot,
			compileRoot: path.join(packagedPhpWasmRoot, 'compile'),
			compileExtensionRoot: path.join(
				packagedPhpWasmRoot,
				'compile-extension'
			),
		});
	});

	it('fetches version-matched assets for package consumers', async () => {
		const root = await mkdtemp(
			path.join(os.tmpdir(), 'compile-extension-context-')
		);
		const workspaceRoot = path.join(root, 'workspace');
		const packageRoot = path.join(root, 'package');
		const cacheRoot = path.join(root, 'cache');
		const fetchedRefs: string[] = [];

		await mkdir(workspaceRoot, { recursive: true });
		await createPackageJson(packageRoot, '3.1.27');

		const context = await createDockerContext(workspaceRoot, {
			packageRoot,
			cacheRoot,
			fetchDockerAssets: async ({ ref, cacheRoot: fetchCacheRoot }) => {
				fetchedRefs.push(ref);
				const phpWasmRoot = path.join(fetchCacheRoot, 'fetched/php-wasm');
				await createPhpWasmDockerAssets(phpWasmRoot);
				return phpWasmRoot;
			},
		});

		expect(fetchedRefs).toEqual(['v3.1.27']);
		expect(context.phpWasmRoot).toBe(path.join(cacheRoot, 'fetched/php-wasm'));
	});

	it('fetches trunk assets for Playground workspace development', async () => {
		const root = await mkdtemp(
			path.join(os.tmpdir(), 'compile-extension-context-')
		);
		const workspaceRoot = path.join(root, 'workspace');
		const packageRoot = path.join(root, 'package');
		const cacheRoot = path.join(root, 'cache');
		const fetchedRefs: string[] = [];

		await createPackageJson(packageRoot, '3.1.27');
		await mkdir(workspaceRoot, { recursive: true });
		await writeFile(path.join(workspaceRoot, 'nx.json'), '{}');
		await createPackageJson(
			path.join(workspaceRoot, 'packages/php-wasm/compile-extension'),
			'3.1.27'
		);

		await createDockerContext(workspaceRoot, {
			packageRoot,
			cacheRoot,
			fetchDockerAssets: async ({ ref, cacheRoot: fetchCacheRoot }) => {
				fetchedRefs.push(ref);
				const phpWasmRoot = path.join(fetchCacheRoot, 'fetched/php-wasm');
				await createPhpWasmDockerAssets(phpWasmRoot);
				return phpWasmRoot;
			},
		});

		expect(fetchedRefs).toEqual(['trunk']);
	});
});

describe('resolveDockerAssetsRef', () => {
	it('uses package version tags outside Playground workspaces', async () => {
		const root = await mkdtemp(
			path.join(os.tmpdir(), 'compile-extension-context-')
		);
		const workspaceRoot = path.join(root, 'workspace');
		const packageRoot = path.join(root, 'package');

		await mkdir(workspaceRoot, { recursive: true });
		await createPackageJson(packageRoot, '3.1.27');

		expect(resolveDockerAssetsRef({ workspaceRoot, packageRoot })).toBe(
			'v3.1.27'
		);
	});
});

describe('isPhpWasmDockerContext', () => {
	it('requires all assets needed by the extension Docker build', async () => {
		const root = await mkdtemp(
			path.join(os.tmpdir(), 'compile-extension-context-')
		);
		const phpWasmRoot = path.join(root, 'php-wasm');

		expect(isPhpWasmDockerContext(phpWasmRoot)).toBe(false);

		await createPhpWasmDockerAssets(phpWasmRoot);

		expect(isPhpWasmDockerContext(phpWasmRoot)).toBe(true);
	});

	it('accepts any php*.patch file instead of a hardcoded PHP version list', async () => {
		const root = await mkdtemp(
			path.join(os.tmpdir(), 'compile-extension-context-')
		);
		const phpWasmRoot = path.join(root, 'php-wasm');

		for (const relativePath of DockerAssetPaths.filter(
			(relativePath) => !relativePath.includes('*')
		)) {
			const filename = path.join(phpWasmRoot, relativePath);
			await mkdir(path.dirname(filename), { recursive: true });
			await writeFile(filename, '');
		}

		expect(isPhpWasmDockerContext(phpWasmRoot)).toBe(false);

		const patchPath = path.join(
			phpWasmRoot,
			'compile/php/php-next-version.patch'
		);
		await mkdir(path.dirname(patchPath), { recursive: true });
		await writeFile(patchPath, '');

		expect(isPhpWasmDockerContext(phpWasmRoot)).toBe(true);
	});
});

describe('publishFetchedDockerAssets', () => {
	it('keeps an already-populated cache from a concurrent fetch', async () => {
		const root = await mkdtemp(
			path.join(os.tmpdir(), 'compile-extension-context-')
		);
		const cacheDir = path.join(root, 'cache');
		const phpWasmRoot = path.join(cacheDir, 'php-wasm');
		const tempDir = path.join(root, 'fetch.tmp');

		await createPhpWasmDockerAssets(phpWasmRoot);
		await createPhpWasmDockerAssets(path.join(tempDir, 'php-wasm'));

		await publishFetchedDockerAssets({
			tempDir,
			cacheDir,
			phpWasmRoot,
		});

		expect(isPhpWasmDockerContext(phpWasmRoot)).toBe(true);
		expect(isPhpWasmDockerContext(path.join(tempDir, 'php-wasm'))).toBe(
			false
		);
	});
});

async function createPhpWasmDockerAssets(phpWasmRoot: string) {
	for (const relativePath of DockerAssetPaths) {
		const fixturePaths = relativePath.includes('*')
			? [
					'compile/php/php8.4.patch',
					'compile/php/php-chunk-alloc-zend-assert-8.5.patch',
				]
			: [relativePath];
		for (const fixturePath of fixturePaths) {
			const filename = path.join(phpWasmRoot, fixturePath);
			await mkdir(path.dirname(filename), { recursive: true });
			await writeFile(filename, '');
		}
	}
}

async function createPackageJson(packageRoot: string, version: string) {
	await mkdir(packageRoot, { recursive: true });
	await writeFile(
		path.join(packageRoot, 'package.json'),
		`${JSON.stringify({ version }, null, 2)}\n`
	);
}
