import { SiteManagerSidebar } from './site-manager-sidebar';
import { __experimentalUseNavigator as useNavigator } from '@wordpress/components';
import store, { selectSite, type AppState } from '../../lib/redux-store';
import { useSelector } from 'react-redux';
import { siteInfoToUrl } from '../../lib/query-api';

import css from './style.module.css';

export function SiteManager({
	siteSlug,
	onSiteChange,
	siteViewRef,
}: {
	siteSlug?: string;
	onSiteChange: (siteSlug?: string) => void;
	siteViewRef: React.RefObject<HTMLDivElement>;
}) {
	const { goTo } = useNavigator();
	const sites = useSelector((state: AppState) => state.siteListing.sites);

	const shouldHideSiteManagerOnSiteChange = () => {
		/**
		 * TODO: Currently we check if the site view is hidden.
		 * Once we add the site editor to the site manager,
		 * we should check if the site editor is hidden instead.
		 */
		return (
			siteViewRef.current &&
			window.getComputedStyle(siteViewRef.current).display === 'none'
		);
	};

	const onSiteClick = async (siteSlug: string) => {
		const selectedSite = sites.find((site) => site.slug === siteSlug);
		if (!selectedSite) {
			return;
		}

		onSiteChange(siteSlug);

		const url = siteInfoToUrl(new URL(window.location.href), selectedSite);
		window.history.pushState({}, '', url.toString());

		await store.dispatch(selectSite(siteSlug));

		/**
		 * On mobile, the site editor and site preview are hidden.
		 * This doesn't give users any way to go back to the site view.
		 * So we hide the site manager on site change.
		 */
		if (shouldHideSiteManagerOnSiteChange()) {
			goTo('/');
		}
	};
	return (
		<div className={css.siteManager}>
			<SiteManagerSidebar
				className={css.siteManagerSidebar}
				onSiteClick={onSiteClick}
				siteSlug={siteSlug}
			/>
		</div>
	);
}
