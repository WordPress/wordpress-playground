import { useEffect } from 'react';
import { resolveBlueprint } from '../../lib/resolve-blueprint';
import { useCurrentUrl } from '../../lib/router-hooks';
import {
	createSite,
	setActiveSite,
	useAppDispatch,
	useAppSelector,
} from '../../lib/redux-store';
import { createNewSiteInfo, getSiteInfoBySlug } from '../../lib/site-storage';

/**
 * Ensures the redux store always has an activeSite value.
 * It uses the URL as the source of truth and assumes the
 * `site-slug` and `storage` query args are always set.
 */
export function EnsurePlaygroundSiteIsSelected({
	children,
}: {
	children: React.ReactNode;
}) {
	const activeSite = useAppSelector((state) => state.activeSite);
	const dispatch = useAppDispatch();
	const [url, setUrlComponents] = useCurrentUrl();
	const requestedSiteSlug = url.searchParams.get('site-slug');

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
				dispatch(setActiveSite(siteInfo!));
				setUrlComponents({
					searchParams: { 'site-slug': siteInfo!.slug },
				});
			} else {
				// Create a new temporary site using the config passed in the current URL
				const url = new URL(window.location.href);
				const blueprint = await resolveBlueprint(url);
				const newSiteInfo = await createNewSiteInfo({
					originalBlueprint: blueprint,
				});
				await dispatch(createSite(newSiteInfo));
				dispatch(setActiveSite(newSiteInfo!));
			}
		}

		ensureSiteIsSelected();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [requestedSiteSlug]);

	if (!activeSite) {
		return null;
	}

	return children;
}
