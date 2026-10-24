/**
 * Build one shared set of app assets for the two-host preview and upgrade tests.
 *
 * Keep root-relative asset URLs: the app host serves the bundles, and host routing
 * rewrites the WordPress helper's URLs to that host. Do not build another asset
 * tree for each WordPress iframe. Copy the same output into the "new" release
 * directory so deployment tests upgrade to this setup, not a single-origin build.
 */
import { build } from 'vite';
import { cp, mkdir } from 'node:fs/promises';

// One public asset origin for app, PHP, and WordPress; no per-site copies.
for (const name of ['client', 'remote', 'website', 'website-extras']) {
	await build({
		configFile: `packages/playground/${name}/vite.config.ts`,
		mode: 'production',
		base: '/',
		build: { outDir: `../../../dist/packages/playground/${name}` },
	});
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
