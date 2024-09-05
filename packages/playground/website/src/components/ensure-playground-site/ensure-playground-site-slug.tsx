import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { urlContainsSiteConfiguration } from '../../lib/resolve-blueprint';
import { listSites, SiteStorageTypes } from '../../lib/site-storage';
import { useCurrentUrl, useSearchParams } from '../../lib/router-hooks';

// @ts-ignore
const opfsSupported = typeof navigator?.storage?.getDirectory !== 'undefined';

// Treats the URL as the source of truth. Ensures we're always at a URL
// that contains a site slug.
export function EnsurePlaygroundSiteSlug({
	children,
}: {
	children: React.ReactNode;
}) {
	const [query, setQuery] = useSearchParams();
	const siteSlug = query.get('site-slug');
	const [, setLocation] = useLocation();
	const urlString = useCurrentUrl();

	// Ensure the site slug is always present in the URL.
	useEffect(() => {
		/*
		 * @TODO: Change the entire mental model of the `storage` parameter.
		 *        For example, `storage=none` + an existing site slug makes
		 *        no sense. We don't load where to load the site from, e.g.
		 *        should it come from OPFS? Local directory? Network? We could
		 * 		  separate the "load from" and "save" to operations, but they
		 *        make more sense as user interactions than URL parameters.
		 *        Perhaps we only need a single `load-site-from` URL parameter?
		 */
		// Ensure the optional storage query arg points to a valid storage type.
		const storage = query.get('storage');
		if (
			storage &&
			(!opfsSupported || !SiteStorageTypes.includes(storage as any))
		) {
			setQuery({ storage: 'none' });
			return;
		}

		async function ensureSiteSlug() {
			// @TODO: Restrict `create` as a system slug that cannot be assigned to a user
			//        site.
			if (siteSlug) {
				if (!storage) {
					setQuery({ storage: opfsSupported ? 'opfs' : 'none' });
				}
				return;
			}

			if (urlContainsSiteConfiguration(new URL(urlString))) {
				if (!storage || storage === 'none') {
					setQuery({ 'site-slug': 'create', storage: 'none' });
				} else {
					setQuery({ 'site-slug': 'create' });
				}
			} else {
				// @TODO: Sort sites by most recently used
				const sites = await listSites();
				if (sites.length > 0) {
					setQuery({ 'site-slug': sites[0].slug });
				} else {
					setQuery({ 'site-slug': 'create' });
				}
			}
		}
		ensureSiteSlug();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [siteSlug, setLocation]);

	if (!siteSlug || (siteSlug !== 'create' && !query.get('storage'))) {
		return null;
	}

	return children;
}
