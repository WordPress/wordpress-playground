/**
 * Build one shared set of app assets for the two-host preview and upgrade tests.
 *
 * Keep root-relative asset URLs: the app host serves the bundles, and host routing
 * serves a built sandbox directory whose loaders use that host. Do not build
 * another asset tree for each WordPress iframe. Copy the same output into the "new" release
 * directory so deployment tests upgrade to this setup, not a single-origin build.
 */
import { build } from 'vite';
import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { appOrigin } from './origins.mjs';
import { writeWordPressSandbox } from '../../../remote/vite.wordpress-sandbox.ts';

const remoteSource = new URL('../../../remote/', import.meta.url);
let remoteBundle;

// One public asset origin for app, PHP, and WordPress; no per-site copies.
for (const name of ['client', 'remote', 'website', 'website-extras']) {
	const result = await build({
		configFile: `packages/playground/${name}/vite.config.ts`,
		mode: 'production',
		base: '/',
		build: { outDir: `../../../dist/packages/playground/${name}` },
	});
	if (name === 'remote') {
		const output = Array.isArray(result) ? result[0].output : result.output;
		remoteBundle = Object.fromEntries(
			output.map((file) => [file.fileName, file])
		);
		await writeWordPressSandbox(
			fileURLToPath(
				new URL(
					'../../../../../dist/packages/playground/remote/',
					import.meta.url
				)
			),
			appOrigin,
			remoteBundle,
			remoteSource
		);
	}
}

// The deployment tests must upgrade to the split-origin build, not the normal build.
const release = 'dist/packages/playground/wasm-wordpress-net-new';
await mkdir(release, { recursive: true });
for (const name of ['remote', 'website', 'website-extras']) {
	await cp(`dist/packages/playground/${name}`, release, { recursive: true });
}
await cp('dist/packages/playground/client', `${release}/client`, {
	recursive: true,
});

// Only the tiny bootstrap files need another address for the release-switching server.
const upgradeOrigin = new URL(appOrigin);
upgradeOrigin.port = '7999';
await writeWordPressSandbox(
	release,
	upgradeOrigin.origin,
	remoteBundle,
	remoteSource
);
