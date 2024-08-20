import { SiteManagerSidebar } from './site-manager-sidebar';
import { __experimentalUseNavigator as useNavigator } from '@wordpress/components';
import store, { selectSite } from '../../lib/redux-store';

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
		onSiteChange(siteSlug);
		const url = new URL(window.location.href);
		if (siteSlug) {
			url.searchParams.set('site-slug', siteSlug);
		} else {
			url.searchParams.delete('site-slug');
		}
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
