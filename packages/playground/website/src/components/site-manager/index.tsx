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
import { __experimentalUseNavigator as useNavigator } from '@wordpress/components';
import { useSearchParams } from '../../lib/router-hooks';

export const SiteManager = forwardRef<
	HTMLDivElement,
	{
		className?: string;
	}
>(({ className }, ref) => {
	const { goTo } = useNavigator();
	const [, setQuery] = useSearchParams();

	const activeSite = useSelector(
		(state: PlaygroundReduxState) => state.activeSite!
	);

	const removeSite = async (siteToRemove: SiteInfo) => {
		const removingSelectedSite = siteToRemove.slug === activeSite?.slug;
		await store.dispatch(removeSiteFromStore(siteToRemove));
		if (removingSelectedSite) {
			setQuery({ 'site-slug': undefined });
			goTo('/manager');
		}
	};

	const fullScreenSections = useMediaQuery('(max-width: 750px)');
	const sitesList = <Sidebar className={css.sidebar} />;
	const siteInfoPanel = activeSite && (
		<SiteInfoPanel
			key={activeSite.slug}
			className={css.siteManagerSiteInfo}
			site={activeSite}
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
