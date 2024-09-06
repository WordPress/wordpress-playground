import { useEffect } from 'react';
import { resolveBlueprint } from '../../lib/resolve-blueprint';
import { useCurrentUrl, useSearchParams } from '../../lib/router-hooks';
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
	const [query] = useSearchParams();
	const urlString = useCurrentUrl();
	const requestedSiteSlug = query.get('site-slug');

	useEffect(() => {
		async function ensureSiteIsSelected() {
			if (requestedSiteSlug) {
				const siteInfo = await getSiteInfoBySlug(requestedSiteSlug!);
				dispatch(setActiveSite(siteInfo!));
				// @TODO: Handle the case where site is not found
			} else {
				// Create a new temporary site using the config passed in the current URL
				const url = new URL(urlString);
				const blueprint = await resolveBlueprint(url);
				const newSiteInfo = createNewSiteInfo({
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
