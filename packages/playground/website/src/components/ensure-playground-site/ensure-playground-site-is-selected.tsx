import { useEffect, useRef } from 'react';
import { resolveBlueprint } from '../../lib/state/url/resolve-blueprint';
import { useCurrentUrl } from '../../lib/state/url/router-hooks';
import { opfsSiteStorage } from '../../lib/state/opfs/opfs-site-storage';
import {
	addSite,
	siteListingLoaded,
	deriveSlugFromSiteName,
	SiteInfo,
	selectSiteBySlug,
} from '../../lib/state/redux/slice-sites';
import { Blueprint, compileBlueprint } from '@wp-playground/blueprints';
import { SiteMetadata } from '../../lib/site-metadata';
import {
	setActiveSite,
	useActiveSite,
	useAppDispatch,
	useAppSelector,
} from '../../lib/state/redux/store';
import { randomSiteName } from '../../lib/state/redux/random-site-name';
import { PlaygroundRoute, redirectTo } from '../../lib/state/url/router';

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
	const activeSite = useActiveSite();
	const dispatch = useAppDispatch();
	const url = useCurrentUrl();
	const requestedSiteSlug = url.searchParams.get('site-slug');
	const requestedSiteObject = useAppSelector((state) =>
		selectSiteBySlug(state, requestedSiteSlug!)
	);

	useEffect(() => {
		opfsSiteStorage?.list().then(
			(sites) => dispatch(siteListingLoaded(sites)),
			(error) => {
				console.error('Error loading sites:', error);
			}
		);
	}, [dispatch]);

	// If the site slug is provided, try to load the site.
	useEffect(() => {
		if (siteListingStatus !== 'loaded') {
			return;
		}
		async function ensureSiteIsSelected() {
			if (!requestedSiteSlug || siteListingStatus !== 'loaded') {
				return;
			}
			if (!requestedSiteObject) {
				// @TODO: We can do better than alert() here.
				alert('Site not found');
				redirectTo(PlaygroundRoute.newTemporarySite());
				return;
			}
			// @TODO: Incorporate any query arg-driven config changes such as ?login=no.
			dispatch(setActiveSite(requestedSiteSlug));
		}

		ensureSiteIsSelected();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [requestedSiteSlug, siteListingStatus]);

	// If the site slug is missing, create a new temporary site.
	const lastSiteInfoRef = useRef<string | undefined>(undefined);
	useEffect(() => {
		async function ensureSiteIsSelected() {
			if (!requestedSiteSlug) {
				// Create a new temporary site using the config passed in the current URL
				const url = new URL(window.location.href);
				const blueprint = await resolveBlueprint(url);
				const siteNameFromUrl = url.searchParams.get('name')?.trim();
				const urlParams = {
					searchParams: Object.fromEntries(
						url.searchParams.entries()
					),
					hash: url.hash,
				};
				const newSiteInfo = await createNewSiteInfo({
					metadata: {
						name: siteNameFromUrl || undefined,
						originalBlueprint: blueprint,
					},
					originalUrlParams: urlParams,
				});
				const comparable = JSON.stringify(newSiteInfo);

				// Short-circuit if the site is already active
				if (comparable === lastSiteInfoRef.current) {
					return;
				}
				lastSiteInfoRef.current = comparable;

				// Activate an existing site if it already exists
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
			} else {
				lastSiteInfoRef.current = undefined;
			}
		}

		ensureSiteIsSelected();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [url.href, siteListingStatus]);

	if (!activeSite) {
		return null;
	}

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
	const {
		name: providedName,
		originalBlueprint,
		...remainingMetadata
	} = initialInfo.metadata || {};

	const name = providedName || randomSiteName();
	const blueprint: Blueprint =
		originalBlueprint ?? (await resolveBlueprint(new URL('https://w.org')));

	const compiledBlueprint = compileBlueprint(blueprint);

	return {
		slug: deriveSlugFromSiteName(name),

		...initialInfo,

		metadata: {
			name,
			id: crypto.randomUUID(),
			whenCreated: Date.now(),
			storage: 'none',
			originalBlueprint: blueprint,

			...remainingMetadata,

			runtimeConfiguration: {
				preferredVersions: {
					wp: compiledBlueprint.versions.wp,
					php: compiledBlueprint.versions.php,
				},
				phpExtensionBundles: blueprint.phpExtensionBundles || [
					'kitchen-sink',
				],
				features: compiledBlueprint.features,
				extraLibraries: compiledBlueprint.extraLibraries,
			},
		},
	};
}
