/// <reference types="vitest" />
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { defineConfig, type Plugin } from 'vite';
import dts from 'vite-plugin-dts';

const npmRoot = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(npmRoot, '..');
const repositoryRoot = resolve(packageRoot, '../../..');
const outputRoot = join(repositoryRoot, 'dist/packages/playground/cli-native');
const assetRoot = join(outputRoot, 'share/wp-playground-native');

function copyPrivatePackage(): Plugin {
	return {
		name: 'copy-private-native-cli-package',
		writeBundle() {
			mkdirSync(outputRoot, { recursive: true });
			for (const [source, destination] of [
				[
					join(packageRoot, 'package.json'),
					join(outputRoot, 'package.json'),
				],
				[
					join(npmRoot, 'wp-playground.js'),
					join(outputRoot, 'wp-playground.js'),
				],
				[
					join(npmRoot, 'native-host-manifest.json'),
					join(outputRoot, 'native-host-manifest.json'),
				],
				[
					join(packageRoot, 'compatibility.json'),
					join(outputRoot, 'compatibility.json'),
				],
				[join(npmRoot, 'README.md'), join(outputRoot, 'README.md')],
				[join(repositoryRoot, 'LICENSE'), join(outputRoot, 'LICENSE')],
				[
					join(packageRoot, 'THIRD_PARTY_NOTICES.md'),
					join(outputRoot, 'THIRD_PARTY_NOTICES.md'),
				],
			] as const)
				copyFileSync(source, destination);

			const sourceManifestPath = join(
				packageRoot,
				'assets/php-assets.json'
			);
			const sourceManifest = JSON.parse(
				readFileSync(sourceManifestPath, 'utf8')
			) as {
				php: Record<
					string,
					{
						wasm: { path: string; sha256: string };
						wasmtime?: unknown;
					}
				>;
			};
			for (const php of Object.values(sourceManifest.php)) {
				delete php.wasmtime;
				const source = join(repositoryRoot, php.wasm.path);
				if (sha256(source) !== php.wasm.sha256) {
					throw new Error(
						`PHP WASI asset checksum mismatch: ${php.wasm.path}`
					);
				}
				const destination = join(assetRoot, php.wasm.path);
				mkdirSync(dirname(destination), { recursive: true });
				copyFileSync(source, destination);
			}
			const packagedManifestPath = join(
				assetRoot,
				'packages/playground/cli-native/assets/php-assets.json'
			);
			mkdirSync(dirname(packagedManifestPath), { recursive: true });
			writeFileSync(
				packagedManifestPath,
				`${JSON.stringify(sourceManifest, null, '\t')}\n`
			);

			const sqliteRelative =
				'packages/playground/wordpress-builds/src/sqlite-database-integration/sqlite-database-integration-trunk.zip';
			const sqliteDestination = join(assetRoot, sqliteRelative);
			mkdirSync(dirname(sqliteDestination), { recursive: true });
			copyFileSync(
				join(repositoryRoot, sqliteRelative),
				sqliteDestination
			);
		},
	};
}

function sha256(path: string): string {
	return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export default defineConfig({
	root: npmRoot,
	cacheDir: join(
		repositoryRoot,
		'node_modules/.vite/playground-cli-native-npm'
	),
	plugins: [
		dts({
			entryRoot: join(npmRoot, 'src'),
			tsconfigPath: join(npmRoot, 'tsconfig.lib.json'),
			rollupTypes: true,
		}),
		copyPrivatePackage(),
	],
	build: {
		outDir: outputRoot,
		emptyOutDir: true,
		target: 'node20',
		rollupOptions: { external: [/^node:/] },
		lib: {
			entry: {
				index: join(npmRoot, 'src/index.ts'),
				cli: join(npmRoot, 'src/cli.ts'),
			},
			formats: ['es', 'cjs'],
			fileName: (format, entryName) =>
				`${entryName}.${format === 'es' ? 'js' : 'cjs'}`,
		},
	},
	test: {
		environment: 'node',
		include: [join(npmRoot, 'tests/**/*.spec.ts')],
		pool: 'forks',
	},
});
