import type { Plugin } from 'vite';
import { protectStaticReleasePages } from './static-release-documents.mjs';

/**
 * Both WP Cloud hostnames serve the same files, so every page is reachable on
 * both. Stop each static release page before any of its scripts load unless it
 * runs on its intended origin: the WordPress request helper on the sandbox,
 * everything else on the app origin, where PHP and saved sites live.
 *
 * Writing an unclosed <plaintext> element turns the rest of the document into
 * inert text, so later module scripts never start.
 */
export function staticReleaseOriginCheckPlugin(): Plugin {
	const releaseBase = getStaticReleaseBase();
	const appOrigin =
		releaseBase && process.env['VITE_PLAYGROUND_APP_ORIGIN']
			? requireOrigin('VITE_PLAYGROUND_APP_ORIGIN')
			: undefined;
	const wordPressOrigin = appOrigin
		? requireOrigin('VITE_WORDPRESS_SITE_URL')
		: undefined;
	return {
		name: 'static-release-origin-check',
		apply: 'build',
		async writeBundle({ dir }) {
			if (!dir)
				throw new Error(
					'Static release builds need an output directory.'
				);
			if (appOrigin && wordPressOrigin) {
				await protectStaticReleasePages(
					dir,
					appOrigin,
					wordPressOrigin
				);
			}
		},
	};
}

/**
 * WP Cloud deployments serve each build from its own public directory,
 * /releases/<id>/, so every asset URL names the release that references it.
 * Open documents keep loading their own files after a newer release deploys.
 * Builds without PLAYGROUND_RELEASE_ID keep their usual base.
 */
export function getStaticReleaseBase(): string | undefined {
	const id = process.env['PLAYGROUND_RELEASE_ID'];
	if (!id) {
		return undefined;
	}
	if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) {
		throw new Error(`Invalid PLAYGROUND_RELEASE_ID: ${id}`);
	}
	return `/releases/${id}/`;
}

function requireOrigin(name: string): string {
	const value = process.env[name];
	if (!value || new URL(value).origin !== value) {
		throw new Error(`${name} must be an origin for static release builds.`);
	}
	return value;
}
