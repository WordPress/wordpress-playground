// Provided by vite
import { blueprintsDirectoryUrl } from 'virtual:blueprints-directory-url';

/**
 * Path under which the production website serves its mirror of the
 * WordPress/blueprints repository. Populated at build time by
 * scripts/sync-blueprints-mirror.mjs and refreshed by the
 * "Refresh Blueprints mirror" workflow.
 */
export const BLUEPRINTS_MIRROR_PATH = '/blueprints';

/**
 * Returns the base URL of the Blueprints directory, without a trailing slash.
 *
 * In production this is the same-origin mirror, so booting Playground does not
 * depend on GitHub being reachable. In development it points at the GitHub
 * repository directly. A relative `BLUEPRINTS_DIRECTORY_URL` such as
 * `/website-server/blueprints` is resolved against the current origin, so it
 * works whichever port the dev server ends up on.
 */
export function getBlueprintsDirectoryUrl(): string {
	return new URL(
		blueprintsDirectoryUrl || BLUEPRINTS_MIRROR_PATH,
		window.location.origin
	)
		.toString()
		.replace(/\/+$/, '');
}

/**
 * Resolves a path within the WordPress/blueprints repository, e.g.
 * `blueprints/welcome/blueprint.json` or `index.json`, to an absolute URL.
 */
export function getBlueprintsDirectoryFileUrl(repositoryPath: string): string {
	return `${getBlueprintsDirectoryUrl()}/${repositoryPath.replace(/^\/+/, '')}`;
}
