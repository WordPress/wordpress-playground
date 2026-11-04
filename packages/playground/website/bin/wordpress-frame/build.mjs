/** Build once, then install the same static releases used by WP Cloud on both test origins. */
import { build } from 'vite';
import { cp, mkdir, rm } from 'node:fs/promises';
import { appOrigin, wordPressOrigin } from './origins.mjs';
import { installLocalRelease } from './install.mjs';

for (const name of ['client', 'remote', 'website', 'website-extras']) {
	await build({
		configFile: `packages/playground/${name}/vite.config.ts`,
		mode: 'production',
		base: '/',
		build: { outDir: `../../../dist/packages/playground/${name}` },
	});
}
const upload = 'dist/packages/playground/wordpress-frame-upload';
await rm(upload, { recursive: true, force: true });
await mkdir(upload, { recursive: true });
for (const name of ['remote', 'website', 'website-extras']) {
	await cp(`dist/packages/playground/${name}`, upload, { recursive: true });
}
await cp('dist/packages/playground/client', `${upload}/client`, {
	recursive: true,
});
await cp(
	'packages/playground/blueprints/public/blueprint-schema.json',
	`${upload}/blueprint-schema.json`
);
installLocalRelease(
	upload,
	'dist/packages/playground/wordpress-frame-public',
	appOrigin,
	wordPressOrigin
);
const upgradeApp = new URL(appOrigin);
const upgradeWordPress = new URL(wordPressOrigin);
upgradeApp.port = upgradeWordPress.port = '7999';
installLocalRelease(
	upload,
	'dist/packages/playground/wasm-wordpress-net-new',
	upgradeApp.origin,
	upgradeWordPress.origin
);
