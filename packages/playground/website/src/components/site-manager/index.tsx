import { Sidebar } from './sidebar';
import { useMediaQuery } from '@wordpress/compose';
import store, {
	PlaygroundReduxState,
	removeSite as removeSiteFromStore,
} from '../../lib/redux-store';
import { useSelector } from 'react-redux';

import css from './style.module.css';
import { SiteInfo } from '../../lib/site-storage';
import { SiteInfoPanel } from './site-info-panel';
import classNames from 'classnames';

import React, { forwardRef } from 'react';
import { useNavigatorParams } from '../../lib/use-navigator-params';
import { useSearchParams } from '../../lib/router-hooks';

export const SiteManager = forwardRef<
	HTMLDivElement,
	{
		className?: string;
		siteViewRef: React.RefObject<HTMLDivElement>;
	}
>(({ siteViewRef, className, ...rest }, ref) => {
	const {
		goTo,
		matchedParams: { siteSlug },
	} = useNavigatorParams('/manager/:siteSlug');
	const [, setQuery] = useSearchParams();

	const sites = useSelector(
		(state: PlaygroundReduxState) => state.siteListing.sites
	);

	const selectedSite = sites.find((site) => site.slug === siteSlug);

	const removeSite = async (siteToRemove: SiteInfo) => {
		const removingSelectedSite = siteToRemove.slug === selectedSite?.slug;
		await store.dispatch(removeSiteFromStore(siteToRemove));
		if (removingSelectedSite) {
			// TODO: What site to select after removing the current selection?
			onSiteClick('wordpress');
		}
	};

	const onSiteClick = async (siteSlug: string) => {
		setQuery({ 'site-slug': siteSlug });
		goTo('/manager/' + siteSlug);
	};

	const fullScreenSections = useMediaQuery('(max-width: 750px)');
	const sitesList = <Sidebar className={css.sidebar} />;
	const siteInfoPanel = selectedSite && (
		<SiteInfoPanel
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
				siteInfoPanel || sitesList
			) : (
				<>
					{sitesList}
					{siteInfoPanel}
				</>
			)}
		</div>
	);
});
