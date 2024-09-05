import { useEffect } from 'react';
import { resolveBlueprint } from '../../lib/resolve-blueprint';
import { useCurrentUrl, useSearchParams } from '../../lib/router-hooks';
import {
	addSite,
	setActiveSite,
	useAppDispatch,
	useAppSelector,
} from '../../lib/redux-store';
import {
	createNewSiteInfo,
	getSiteInfoBySlug,
	SiteStorageType,
} from '../../lib/site-storage';

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
	const siteSlug = query.get('site-slug');
	const storage = query.get('storage')! as SiteStorageType;

	useEffect(() => {
		async function ensureSiteIsSelected() {
			if (activeSite) {
				return;
			}

			if (siteSlug !== 'create') {
				const siteInfo = await getSiteInfoBySlug(siteSlug!);
				dispatch(setActiveSite(siteInfo!));
				return;
			}

			const url = new URL(urlString);
			const blueprint = await resolveBlueprint(url);
			const newSiteInfo = createNewSiteInfo({
				originalBlueprint: blueprint,
				storage: storage,
			});
			await dispatch(addSite(newSiteInfo));
			dispatch(setActiveSite(newSiteInfo!));
		}

		ensureSiteIsSelected();
	}, [urlString, activeSite, siteSlug, dispatch]);

	if (!activeSite) {
		return null;
	}

	return children;
}
