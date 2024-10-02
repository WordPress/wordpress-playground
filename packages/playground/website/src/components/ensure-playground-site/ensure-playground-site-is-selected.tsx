import { useEffect } from 'react';
import { resolveBlueprintFromURL } from '../../lib/state/url/resolve-blueprint-from-url';
import { useCurrentUrl } from '../../lib/state/url/router-hooks';
import { opfsSiteStorage } from '../../lib/state/opfs/opfs-site-storage';
import {
	addSite,
	siteListingLoaded,
	deriveSlugFromSiteName,
	SiteInfo,
	selectSiteBySlug,
} from '../../lib/state/redux/slice-sites';
import { createSiteMetadata, SiteMetadata } from '../../lib/site-metadata';
import {
	setActiveSite,
	useAppDispatch,
	useAppSelector,
} from '../../lib/state/redux/store';
import { randomSiteName } from '../../lib/state/redux/random-site-name';
import { PlaygroundRoute, redirectTo } from '../../lib/state/url/router';
import { logger } from '@php-wasm/logger';

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
	const sites = useAppSelector((state) => state.sites.entities);
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
			// If the site slug is provided, try to load the site.
			if (requestedSiteSlug) {
				// Wait until the site listing is loaded
				if (siteListingStatus !== 'loaded') {
					return;
				}

				// If the site does not exist, redirect to a new temporary site.
				if (!requestedSiteObject) {
					// @TODO: Notification: 'The requested site was not found. Redirecting to a new temporary site.'
					logger.log(
						'The requested site was not found. Redirecting to a new temporary site.'
					);
					redirectTo(PlaygroundRoute.newTemporarySite());
					return;
				}
				dispatch(setActiveSite(requestedSiteSlug));
				return;
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
			const urlParams = {
				searchParams: Object.fromEntries(url.searchParams.entries()),
				hash: url.hash,
			};
			const newSiteInfo = await createNewSiteInfo({
				metadata: {
					name: siteNameFromUrl || undefined,
					originalBlueprint: blueprint,
				},
				originalUrlParams: urlParams,
			});

			// Check if there's an existing site that matches the requested
			// specification exactly.
			const existingSite = Object.values(sites).find(
				(site) =>
					JSON.stringify(site.originalUrlParams) ===
					JSON.stringify(urlParams)
			);
			if (existingSite) {
				dispatch(setActiveSite(existingSite.slug));
				return;
			}

			// Create a new site otherwise
			await dispatch(addSite(newSiteInfo));
			dispatch(setActiveSite(newSiteInfo.slug));
		}

		ensureSiteIsSelected();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [url.href, requestedSiteSlug, siteListingStatus]);

	return children;
}

/**
 * The initial information used to create a new site.
 */
export type InitialSiteInfo = Omit<SiteInfo, 'id' | 'slug' | 'whenCreated'>;
async function createNewSiteInfo(
	initialInfo: Partial<Omit<InitialSiteInfo, 'metadata'>> & {
		metadata?: Partial<Omit<SiteMetadata, 'runtimeConfiguration'>>;
	}
): Promise<SiteInfo> {
	const { name: providedName, ...remainingMetadata } =
		initialInfo.metadata || {};

	const name = providedName || randomSiteName();

	return {
		slug: deriveSlugFromSiteName(name),

		...initialInfo,

		metadata: await createSiteMetadata({
			name,
			...remainingMetadata,
		}),
	};
}
