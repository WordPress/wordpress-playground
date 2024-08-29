import { SiteManagerSidebar } from './site-manager-sidebar';
import { useMediaQuery } from '@wordpress/compose';
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
import { useNavigatorParams } from '../../lib/use-navigator-params';

export const SiteManager = forwardRef<
	HTMLDivElement,
	{
		className?: string;
		onSiteChange: (siteSlug?: string) => void;
		siteViewRef: React.RefObject<HTMLDivElement>;
	}
>(({ onSiteChange, siteViewRef, className, ...rest }, ref) => {
	const {
		goTo,
		matchedParams: { siteSlug },
	} = useNavigatorParams('/manager/:siteSlug');

	const sites = useSelector(
		(state: PlaygroundReduxState) => state.siteListing.sites
	);

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
		goTo('/manager/' + siteSlug);
	};

	const fullScreenSections = useMediaQuery('(max-width: 750px)');
	const siteManagerSidebar = (
		<SiteManagerSidebar
			className={css.siteManagerSidebar}
			onSiteClick={onSiteClick}
			siteSlug={siteSlug}
			addSite={addSite}
			sites={sites}
		/>
	);
	const siteInfoView = selectedSite && (
		<SiteInfoView
			key={selectedSite.slug}
			className={css.siteManagerSiteInfo}
			site={selectedSite}
			removeSite={removeSite}
			showBackButton={fullScreenSections}
			onBackButtonClick={() => {
				goTo('/manager');
			}}
		/>
	);
	return (
		<div className={classNames(css.siteManager, className)} ref={ref}>
			{fullScreenSections ? (
				siteInfoView || siteManagerSidebar
			) : (
				<>
					{siteManagerSidebar}
					{siteInfoView}
				</>
			)}
		</div>
	);
});
