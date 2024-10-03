import { Sidebar } from './sidebar';
import { useMediaQuery } from '@wordpress/compose';
import {
	useActiveSite,
	useAppDispatch,
	useAppSelector,
} from '../../lib/state/redux/store';

import css from './style.module.css';
import { SiteInfoPanel } from './site-info-panel';
import classNames from 'classnames';

import { forwardRef } from 'react';
import { removeSite, SiteInfo } from '../../lib/state/redux/slice-sites';
import { setSiteManagerSection } from '../../lib/state/redux/slice-ui';
import { ArchivedSitesPanel } from './archived-sites-panel';

export const SiteManager = forwardRef<
	HTMLDivElement,
	{
		className?: string;
	}
>(({ className }, ref) => {
	const activeSite = useActiveSite()!;

	const fullScreenSections = useMediaQuery('(max-width: 875px)');
	const activeSiteManagerSection = useAppSelector(
		(state) => state.ui.siteManagerSection
	);
	const dispatch = useAppDispatch();

	const onRemoveSite = async (siteToRemove: SiteInfo) => {
		await dispatch(removeSite(siteToRemove.slug));
		dispatch(setSiteManagerSection('sidebar'));
	};

	const sidebar = <Sidebar className={css.sidebar} />;

	let activePanel;
	switch (activeSiteManagerSection) {
		case 'archived-sites':
			activePanel = <ArchivedSitesPanel />;
			break;
		case 'site-details':
			activePanel = activeSite ? (
				<SiteInfoPanel
					key={activeSite?.slug}
					className={css.siteManagerSiteInfo}
					removeSite={onRemoveSite}
					site={activeSite}
					mobileUi={fullScreenSections}
				/>
			) : null;
			break;
		default:
			activePanel = null;
			break;
	}

	if (fullScreenSections) {
		return (
			<div className={classNames(css.siteManager, className)} ref={ref}>
				{activeSiteManagerSection === 'sidebar' ? sidebar : activePanel}
			</div>
		);
	}

	return (
		<div className={classNames(css.siteManager, className)} ref={ref}>
			{sidebar}
			{activePanel}
		</div>
	);
});
