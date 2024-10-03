import { useEffect, useState } from 'react';
import { resolveBlueprintFromURL } from '../../lib/state/url/resolve-blueprint-from-url';
import { useCurrentUrl } from '../../lib/state/url/router-hooks';
import { opfsSiteStorage } from '../../lib/state/opfs/opfs-site-storage';
import {
	addSite,
	siteListingLoaded,
	deriveSlugFromSiteName,
	SiteInfo,
	deleteDormantArchivedSites,
	archiveAllTemporarySites,
	selectUnarchivedSiteBySlug,
} from '../../lib/state/redux/slice-sites';
import { createSiteMetadata } from '../../lib/site-metadata';
import {
	setActiveSite,
	useAppDispatch,
	useAppSelector,
} from '../../lib/state/redux/store';
import { randomSiteName } from '../../lib/state/redux/random-site-name';
import { logger } from '@php-wasm/logger';
import { setInitialSiteResolved } from '../../lib/state/redux/slice-ui';

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
	const requestedSlug =
		url.searchParams.get('site-slug') || url.searchParams.get('temp-slug');
	const didRequestTemporarySite =
		requestedSlug === url.searchParams.get('temp-slug');
	const requestedSiteObject = useAppSelector((state) =>
		selectUnarchivedSiteBySlug(state, requestedSlug!)
	);
	const [initialCleanupDone, setInitialCleanupDone] = useState(false);

	useEffect(() => {
		if (siteListingStatus !== 'loaded') {
			return;
		}
		async function cleanup() {
			await dispatch(archiveAllTemporarySites());
			await dispatch(deleteDormantArchivedSites());
			setInitialCleanupDone(true);
		}
		cleanup();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [siteListingStatus]);

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
			if (!initialCleanupDone) {
				return;
			}
			// If the site slug is provided, try to load the site.
			if (requestedSlug) {
				// Wait until the site listing is loaded
				if (siteListingStatus !== 'loaded') {
					return;
				}

				if (requestedSiteObject) {
					await dispatch(setActiveSite(requestedSlug));
					dispatch(setInitialSiteResolved(true));
					return;
				} else if (!didRequestTemporarySite) {
					dispatch(setInitialSiteResolved(true));
					return;
				}
			}

			// Don't create a new temporary site until the site listing settles.
			// Otherwise, the status change from "loading" to "loaded" would
			// re-run this entire effect, potentially leading to multiple
			// sites being created since we couldn't look for duplicates yet.
			if (!['loaded', 'error'].includes(siteListingStatus)) {
				return;
			}

			// If the site slug is missing, create a new temporary site.
			// Lean on the Query API parameters and the Blueprint API to
			// create the new site.
			const url = new URL(window.location.href);
			const blueprint = await resolveBlueprintFromURL(url);
			const siteNameFromUrl = url.searchParams.get('name')?.trim();
			const name = siteNameFromUrl || randomSiteName();
			const newSiteInfo: SiteInfo = {
				slug: deriveSlugFromSiteName(name),
				metadata: await createSiteMetadata({
					name,
					isArchived: false,
					originalBlueprint: blueprint,
					storage: 'opfs-temporary',
				}),
				originalUrlParams: {
					searchParams: Object.fromEntries(
						url.searchParams.entries()
					),
					hash: url.hash,
				},
			};

			await dispatch(addSite(newSiteInfo));
			await dispatch(setActiveSite(newSiteInfo.slug));
			dispatch(setInitialSiteResolved(true));
		}

		ensureSiteIsSelected();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [url.href, requestedSlug, siteListingStatus, initialCleanupDone]);

	return children;
}

/**
 * The initial information used to create a new site.
 */
export type InitialSiteInfo = Omit<SiteInfo, 'id' | 'slug' | 'whenCreated'>;
