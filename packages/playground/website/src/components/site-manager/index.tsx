import { Sidebar } from './sidebar';
import { useMediaQuery } from '@wordpress/compose';
import {
	useAppDispatch,
	useAppSelector,
	setSiteManagerIsOpen,
	removeSite as removeSiteFromStore,
} from '../../lib/redux-store';

import css from './style.module.css';
import { SiteInfo } from '../../lib/site-storage';
import { SiteInfoPanel } from './site-info-panel';
import classNames from 'classnames';

import React, { forwardRef } from 'react';
import { useSearchParams } from '../../lib/router-hooks';

export const SiteManager = forwardRef<
	HTMLDivElement,
	{
		className?: string;
	}
>(({ className }, ref) => {
	const [, setQuery] = useSearchParams();

	const activeSite = useAppSelector((state) => state.activeSite!);
	const dispatch = useAppDispatch();

	const removeSite = async (siteToRemove: SiteInfo) => {
		const removingSelectedSite = siteToRemove.slug === activeSite?.slug;
		await dispatch(removeSiteFromStore(siteToRemove));
		if (removingSelectedSite) {
			setQuery({ 'site-slug': undefined });
			dispatch(setSiteManagerIsOpen(true));
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
				dispatch(setSiteManagerIsOpen(true));
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
