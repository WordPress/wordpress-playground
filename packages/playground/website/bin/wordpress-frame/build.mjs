/**
 * Build static releases with explicit origin pairs and install with the production script.
 *
 * The preview and the deployment upgrade tests serve the installed web roots, so
 * they exercise the same public release directories, root copies, and PHP entry
 * as WP Cloud. Both roots start empty, as on a fresh host. The upgrade tests use
 * another port, so it is built with that pair of origins as production is.
 */
import { build } from 'vite';
import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { appOrigin, wordPressOrigin } from './origins.mjs';

const release = `preview-${Date.now()}`;
process.env.PLAYGROUND_RELEASE_ID = release;
const upgradeApp = new URL(appOrigin);
const upgradeWordPress = new URL(wordPressOrigin);
upgradeApp.port = upgradeWordPress.port = '7999';
for (const [webRoot, origins] of [
	[
		'dist/packages/playground/wordpress-frame-public',
		[appOrigin, wordPressOrigin],
	],
	[
		'dist/packages/playground/wasm-wordpress-net-new',
		[upgradeApp.origin, upgradeWordPress.origin],
	],
]) {
	process.env.VITE_PLAYGROUND_APP_ORIGIN = origins[0];
	process.env.VITE_WORDPRESS_SITE_URL = origins[1];
	for (const name of ['client', 'remote', 'website', 'website-extras']) {
		await build({
			configFile: `packages/playground/${name}/vite.config.ts`,
			mode: 'production',
			build: { outDir: `../../../dist/packages/playground/${name}` },
		});
	}

	// Assemble the upload as the website build target does.
	const upload = 'dist/packages/playground/wordpress-frame-upload';
	await rm(upload, { recursive: true, force: true });
	await mkdir(upload, { recursive: true });
	for (const name of ['remote', 'website', 'website-extras']) {
		await cp(`dist/packages/playground/${name}`, upload, {
			recursive: true,
		});
	}
	await cp('dist/packages/playground/client', `${upload}/client`, {
		recursive: true,
	});
	await cp(
		'packages/playground/blueprints/public/blueprint-schema.json',
		`${upload}/blueprint-schema.json`
	);
	// The normal CI assembly downloads WP-CLI; reuse it when present.
	if (existsSync('dist/packages/playground/wasm-wordpress-net/wp-cli.phar')) {
		await cp(
			'dist/packages/playground/wasm-wordpress-net/wp-cli.phar',
			`${upload}/wp-cli.phar`
		);
	}

	for (const directory of [webRoot, `${webRoot}-backups`]) {
		await rm(directory, { recursive: true, force: true });
	}
	// The installer moves its upload into place.
	const copy = await mkdtemp(
		'dist/packages/playground/wordpress-frame-install-'
	);
	await cp(upload, copy, { recursive: true });
	execFileSync(
		'bash',
		[
			'packages/playground/website-deployment/apply-update.sh',
			...origins,
			copy,
			webRoot,
			`${webRoot}-backups`,
		],
		{
			stdio: 'inherit',
			env: {
				...process.env,
				PLAYGROUND_LOCAL_RELEASES: '1',
				PLAYGROUND_MIME_TYPES:
					'packages/php-wasm/universal/src/lib/mime-types.json',
				SITE_PHP: 'php',
			},
		}
	);
}
