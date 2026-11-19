/**
 * Build static releases with explicit origin pairs and install with the production script.
 *
 * The preview and the deployment upgrade tests serve the installed web roots, so
 * they exercise the same public release directories, root copies, and PHP entry
 * as WP Cloud. Like production, each root starts with one private release of the
 * root-only layout that preceded release directories, holding only a fixture bridge
 * script that old WordPress workers request. The upgrade tests use another port, so
 * it is built with that pair of origins as production is.
 */
import { build } from 'vite';
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { appOrigin, wordPressOrigin } from './origins.mjs';
import { assembleWebsite } from '../assemble-website.mjs';

const release = `preview-${Date.now()}`;
process.env.PLAYGROUND_RELEASE_ID = release;
const upgradeApp = new URL(appOrigin);
const upgradeWordPress = new URL(wordPressOrigin);
upgradeApp.port = upgradeWordPress.port = '7999';
for (const [webRoot, origins] of [
	['dist/packages/playground/website-preview', [appOrigin, wordPressOrigin]],
	[
		'dist/packages/playground/wasm-wordpress-net-new',
		[upgradeApp.origin, upgradeWordPress.origin],
	],
]) {
	process.env.PLAYGROUND_APP_ORIGIN = origins[0];
	process.env.VITE_WORDPRESS_SITE_URL = origins[1];
	for (const name of ['client', 'remote', 'website', 'website-extras']) {
		await build({
			configFile: `packages/playground/${name}/vite.config.ts`,
			mode: 'production',
			build: { outDir: `../../../dist/packages/playground/${name}` },
		});
	}

	// Assemble the upload with the website build target's own code, so the install
	// and browser checks cover every page production publishes.
	const upload = 'dist/packages/playground/wordpress-frame-upload';
	await assembleWebsite(
		'dist/packages/playground',
		upload,
		'packages/playground/blueprints/public/blueprint-schema.json'
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
	// The previous installer kept each live build in release.XXXXXXXX/files/.
	const rootLayoutRelease = `${webRoot}/.playground-releases/release.Fixture1/files`;
	await mkdir(rootLayoutRelease, { recursive: true });
	await cp(
		'packages/playground/website/playwright/wordpress-frame/fixtures/root-layout-release',
		rootLayoutRelease,
		{ recursive: true }
	);
	// A completed install wrote its MIME map; activation moved its public-entry.php away.
	await writeFile(
		`${rootLayoutRelease}/../mime-types.php`,
		'<?php\n$mime_types = array();\n'
	);
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
