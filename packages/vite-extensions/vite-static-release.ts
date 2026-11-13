import type { Plugin } from 'vite';

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

/**
 * Both WP Cloud hostnames serve the same files, so every page is reachable on
 * both. Stop each static release page before any of its scripts load unless it
 * runs on its intended origin: the WordPress request helper on the sandbox,
 * everything else on the app origin, where PHP and saved sites live.
 *
 * Writing an unclosed <plaintext> element turns the rest of the document into
 * inert text, so later module scripts never start.
 */
export function staticReleaseOriginCheckPlugin(): Plugin | null {
	// Local previews serve one build on several ports and derive the origins at
	// runtime. The deployment script refuses production builds without the check.
	if (!getStaticReleaseBase() || !process.env['VITE_PLAYGROUND_APP_ORIGIN']) {
		return null;
	}
	const appOrigin = requireOrigin('VITE_PLAYGROUND_APP_ORIGIN');
	const wordPressOrigin = requireOrigin('VITE_WORDPRESS_SITE_URL');
	return {
		name: 'static-release-origin-check',
		apply: 'build',
		transformIndexHtml: {
			order: 'pre',
			handler(_html, context) {
				const expected = context.path.endsWith('/wordpress-bridge.html')
					? wordPressOrigin
					: appOrigin;
				return [
					{
						tag: 'script',
						injectTo: 'head-prepend',
						children:
							`if(location.origin!==${JSON.stringify(expected)}){` +
							`document.write('<p>This Playground page cannot run on this host.</p><plaintext hidden>');` +
							`throw new Error('Playground page loaded on '+location.origin)}`,
					},
				];
			},
		},
	};
}

function requireOrigin(name: string): string {
	const value = process.env[name];
	if (!value || new URL(value).origin !== value) {
		throw new Error(`${name} must be an origin for static release builds.`);
	}
	return value;
}
