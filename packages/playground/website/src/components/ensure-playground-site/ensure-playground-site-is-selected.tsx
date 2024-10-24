import { useEffect } from 'react';
import { resolveBlueprintFromURL } from '../../lib/state/url/resolve-blueprint-from-url';
import { useCurrentUrl } from '../../lib/state/url/router-hooks';
import { opfsSiteStorage } from '../../lib/state/opfs/opfs-site-storage';
import {
	siteListingLoaded,
	selectSiteBySlug,
	setTemporarySiteSpec,
} from '../../lib/state/redux/slice-sites';
import {
	setActiveSite,
	useAppDispatch,
	useAppSelector,
} from '../../lib/state/redux/store';
import { redirectTo } from '../../lib/state/url/router';
import { logger } from '@php-wasm/logger';
import { Blueprint } from '@wp-playground/blueprints';

/**
 * Ensures the redux store always has an activeSite value.
 *
 * It has two routing modes:
 * * When `site-slug` is provided, it load an existing site
 * * When `site-slug` is missing, it creates a new site using the Query API and Blueprint API
 *   data sourced from the current URL.
 */
export function EnsurePlaygroundSiteIsSelected({
	children,
}: {
	children: React.ReactNode;
}) {
	const siteListingStatus = useAppSelector(
		(state) => state.sites.loadingState
	);
	const dispatch = useAppDispatch();
	const url = useCurrentUrl();
	const requestedSiteSlug = url.searchParams.get('site-slug');
	const requestedSiteObject = useAppSelector((state) =>
		selectSiteBySlug(state, requestedSiteSlug!)
	);

	useEffect(() => {
		if (!opfsSiteStorage) {
			logger.error('Error loading sites: OPFS not available');
			dispatch(siteListingLoaded([]));
			return;
		}
		opfsSiteStorage.list().then(
			(sites) => dispatch(siteListingLoaded(sites)),
			(error) => {
				logger.error('Error loading sites:', error);
				dispatch(siteListingLoaded([]));
			}
		);
	}, [dispatch]);

	useEffect(() => {
		async function ensureSiteIsSelected() {
			// Don't create a new temporary site until the site listing settles.
			// Otherwise, the status change from "loading" to "loaded" would
			// re-run this entire effect, potentially leading to multiple
			// sites being created since we couldn't look for duplicates yet.
			if (!['loaded', 'error'].includes(siteListingStatus)) {
				return;
			}

			// If the site slug is provided, try to load the site.
			if (requestedSiteSlug) {
				// If the site does not exist, redirect to a new temporary site.
				if (!requestedSiteObject) {
					// @TODO: Notification: 'The requested site was not found. Redirecting to a new temporary site.'
					logger.log(
						'The requested site was not found. Redirecting to a new temporary site.'
					);
					const currentUrl = new URL(window.location.href);
					currentUrl.searchParams.delete('site-slug');
					redirectTo(currentUrl.toString());
					return;
				}

				dispatch(setActiveSite(requestedSiteSlug, { redirect: false }));
				return;
			}

			// If the site slug is missing, create a new temporary site.
			// Lean on the Query API parameters and the Blueprint API to
			// create the new site.
			const url = new URL(window.location.href);
			let blueprint: Blueprint | undefined = undefined;
			try {
				blueprint = await resolveBlueprintFromURL(url);
			} catch (e) {
				logger.error('Error resolving blueprint:', e);
			}
			// Create a new site otherwise
			const newSiteInfo = await dispatch(
				setTemporarySiteSpec({
					metadata: {
						originalBlueprint: blueprint,
					},
					originalUrlParams: {
						searchParams: Object.fromEntries(
							url.searchParams.entries()
						),
						hash: url.hash,
					},
				})
			);
			dispatch(setActiveSite(newSiteInfo.slug));
		}

		ensureSiteIsSelected();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [url.href, requestedSiteSlug, siteListingStatus]);

	return children;
}
