import { useEffect, useRef } from 'react';
import { resolveBlueprint } from '../../lib/resolve-blueprint';
import { useCurrentUrl } from '../../lib/router-hooks';
import {
	createSite,
	setActiveSite,
	useActiveSite,
	useAppDispatch,
	useAppSelector,
} from '../../lib/redux-store';
import { createNewSiteInfo, getSiteInfoBySlug } from '../../lib/site-storage';

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
	const sites = useAppSelector((state) => state.siteListing.sites);
	const activeSite = useActiveSite();
	const dispatch = useAppDispatch();
	const [url, setUrlComponents] = useCurrentUrl();
	const requestedSiteSlug = url.searchParams.get('site-slug');

	// If the site slug is provided, try to load the site.
	useEffect(() => {
		async function ensureSiteIsSelected() {
			if (requestedSiteSlug) {
				const siteInfo = await getSiteInfoBySlug(requestedSiteSlug!);
				if (!siteInfo) {
					// @TODO: We can do better than alert() here.
					alert('Site not found');
					setUrlComponents({
						searchParams: { 'site-slug': '' },
					});
					return;
				}
				// @TODO: Incorporate any query arg-driven config changes such as ?login=no.
				// Do not use any mutating query args like ?plugin= for now.
				dispatch(setActiveSite(siteInfo!.slug));
				setUrlComponents({
					searchParams: { 'site-slug': siteInfo!.slug },
				});
			}
		}

		ensureSiteIsSelected();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [requestedSiteSlug]);

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
				const existingSite = sites.find(
					(site) =>
						JSON.stringify(site.originalUrlParams) ===
						JSON.stringify(urlParams)
				);
				if (existingSite) {
					dispatch(setActiveSite(existingSite.slug));
					return;
				}

				// Create a new site otherwise
				await dispatch(createSite(newSiteInfo));
				dispatch(setActiveSite(newSiteInfo.slug));
			} else {
				lastSiteInfoRef.current = undefined;
			}
		}

		ensureSiteIsSelected();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [url.href]);

	if (!activeSite) {
		return null;
	}

	return children;
}
