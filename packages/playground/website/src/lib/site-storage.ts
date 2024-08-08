/**
 * NOTE: This module should probably become a separate package
 * or be added to an existing separate package like @playground/storage,
 * but while we are iterating on the web app redesign,
 * let's keep this module with the web app.
 */

import { LatestSupportedWordPressVersion } from '@wp-playground/wordpress-builds';
import {
	LatestSupportedPHPVersion,
	SupportedPHPVersion,
} from '@php-wasm/universal';
import { type Blueprint } from '@wp-playground/blueprints';

export type SiteStorageType = 'temporary' | 'opfs' | 'local-fs';

// TODO: move types to site storage
// TODO: Explore better ways of obtaining site logos
export type SiteLogo = {
	mime: string;
	data: string;
};

export type SiteInfo = {
	// TODO: Should we have both `id` and `slug`? UUIDs can help avoid conflicts when sharing sites, but slugs are more readable.
	id: string;
	// TODO: Make slug a local concept and do not store in site metadata file.
	slug: string;
	name: string;
	logo?: SiteLogo;
	wpVersion: string;
	phpVersion: SupportedPHPVersion;

	storage: SiteStorageType;

	// TODO: Consider keeping timestamps.
	//       For a user, timestamps might be useful to disambiguate identically-named sites.
	//       For playground, we might choose to sort by most recently used.
	//whenCreated: number;
	//whenLastLoaded: number;

	originalBlueprint?: Blueprint;
};

export async function listSites(): Promise<SiteInfo[]> {
	const virtualOpfsRoot = await navigator.storage.getDirectory();
	const opfsSites: SiteInfo[] = [];
	for await (const entry of virtualOpfsRoot.values()) {
		if (entry.kind !== 'directory') {
			continue;
		}

		// To give us flexibility for the future,
		// let's avoid assuming all top-level OPFS dirs are sites
		if (entry.name !== 'wordpress' && !entry.name.startsWith('site-')) {
			continue;
		}

		/**
		 * Sites stored in browser storage are prefixed with "site-"
		 * so we need to remove the prefix to get the slug.
		 *
		 * The default site is stored in the `wordpress` directory
		 * and it doesn't have a prefix.
		 */
		const slug = entry.name.replace(/^site-/, '');
		const name = slug.charAt(0).toUpperCase() + slug.slice(1);

		// TODO: Backfill site info file if missing, detecting actual WP version if possible
		// TODO: Read site info file
		opfsSites.push({
			id: crypto.randomUUID(),
			slug,
			name,
			storage: 'opfs',
			wpVersion: LatestSupportedWordPressVersion,
			phpVersion: LatestSupportedPHPVersion,
		});
	}
	return opfsSites;
}
