import { SiteManagerSidebar } from './site-manager-sidebar';
import { __experimentalUseNavigator as useNavigator } from '@wordpress/components';
import store, {
	PlaygroundReduxState,
	selectSite,
	addSite as addSiteToStore,
	removeSite as removeSiteFromStore,
} from '../../lib/redux-store';
import { useSelector } from 'react-redux';

import css from './style.module.css';
import { createNewSiteInfo, SiteInfo } from '../../lib/site-storage';
import { LatestMinifiedWordPressVersion } from '@wp-playground/wordpress-builds';
import { LatestSupportedPHPVersion } from '@php-wasm/universal';
import { SiteInfoView } from './site-info-view';
import classNames from 'classnames';

import React, { forwardRef } from 'react';

export const SiteManager = forwardRef<
	HTMLDivElement,
	{
		className?: string;
		siteSlug?: string;
		onSiteChange: (siteSlug?: string) => void;
		siteViewRef: React.RefObject<HTMLDivElement>;
	}
>(({ siteSlug, onSiteChange, siteViewRef, className, ...rest }, ref) => {
	const { goTo } = useNavigator();

	const sites = useSelector(
		(state: PlaygroundReduxState) => state.siteListing.sites
	);

	siteSlug ??= 'wordpress';
	const selectedSite = sites.find((site) => site.slug === siteSlug);

	const addSite = async (name: string) => {
		const newSiteInfo = createNewSiteInfo({
			name,
			storage: 'opfs',
			wpVersion: LatestMinifiedWordPressVersion,
			phpVersion: LatestSupportedPHPVersion,
			phpExtensionBundle: 'kitchen-sink',
		});
		await store.dispatch(addSiteToStore(newSiteInfo));
		return newSiteInfo;
	};

	const removeSite = async (siteToRemove: SiteInfo) => {
		const removingSelectedSite = siteToRemove.slug === selectedSite?.slug;
		await store.dispatch(removeSiteFromStore(siteToRemove));
		if (removingSelectedSite) {
			// TODO: What site to select after removing the current selection?
			onSiteClick('wordpress');
		}
	};

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
		<div className={classNames(css.siteManager, className)} ref={ref}>
			<SiteManagerSidebar
				className={css.siteManagerSidebar}
				onSiteClick={onSiteClick}
				siteSlug={siteSlug}
				addSite={addSite}
				sites={sites}
			/>
			{selectedSite && (
				<SiteInfoView
					key={selectedSite.slug}
					className={css.siteManagerSiteInfo}
					site={selectedSite}
					removeSite={removeSite}
				/>
			)}
		</div>
	);
});
