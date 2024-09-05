import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { urlContainsSiteConfiguration } from '../../lib/resolve-blueprint';
import { listSites } from '../../lib/site-storage';
import { useSearchParams } from '../../lib/router-hooks';

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

	useEffect(() => {
		if (siteSlug) {
			if (!query.get('storage') || query.get('storage') === 'temporary') {
				setQuery({ storage: 'browser' });
			}
			return;
		}
		async function load() {
			if (urlContainsSiteConfiguration()) {
				if (
					!query.get('storage') ||
					query.get('storage') === 'temporary'
				) {
					setQuery({ 'site-slug': 'temporary' });
				} else {
					// @TODO: Create a new permanent site
					const randomSlug = Math.random()
						.toString(36)
						.substring(2, 15);
					setQuery({ 'site-slug': randomSlug });
				}
			} else {
				// Boot the most recently used site
				const sites = await listSites();
				if (sites.length > 0) {
					setQuery({ 'site-slug': sites[0].slug });
				} else {
					setQuery({ 'site-slug': 'temporary' });
				}
			}
		}
		load();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [siteSlug, setLocation]);

	if (!siteSlug || (siteSlug !== 'temporary' && !query.get('storage'))) {
		return null;
	}

	return children;
}
