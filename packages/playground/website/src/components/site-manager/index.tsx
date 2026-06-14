import { useMediaQuery } from '@wordpress/compose';
import { useActiveSite, useAppSelector } from '../../lib/state/redux/store';

import css from './style.module.css';
import { SiteInfoPanel, type SiteInfoPanelTabName } from './site-info-panel';
import classNames from 'classnames';

import { forwardRef } from 'react';
import { SavedPlaygroundsPane } from '../saved-playgrounds-overlay';
import { SiteSharePanel } from './site-share-panel';

const SITE_MANAGER_TOOL_TABS: Partial<Record<string, SiteInfoPanelTabName>> = {
	'site-details': 'settings',
	settings: 'settings',
	files: 'files',
	blueprint: 'blueprint',
	database: 'database',
	logs: 'logs',
};

export const SiteManager = forwardRef<
	HTMLDivElement,
	{
		className?: string;
	}
>(({ className }, ref) => {
	const activeSite = useActiveSite();
	const fullScreenSections = useMediaQuery('(max-width: 875px)');
	const activeSiteManagerSection = useAppSelector(
		(state) => state.ui.siteManagerSection
	);

	let activePanel;
	switch (activeSiteManagerSection) {
		case 'playgrounds':
			activePanel = <SavedPlaygroundsPane panel="playgrounds" />;
			break;
		case 'new':
			activePanel = <SavedPlaygroundsPane panel="new" />;
			break;
		case 'blueprints':
			activePanel = <SavedPlaygroundsPane panel="new" />;
			break;
		case 'share':
			activePanel = activeSite ? <SiteSharePanel /> : null;
			break;
		default: {
			const activeTabName =
				SITE_MANAGER_TOOL_TABS[activeSiteManagerSection];
			activePanel =
				activeSite && activeTabName ? (
					<SiteInfoPanel
						key={`${activeSite.slug}-${activeTabName}`}
						className={css.siteManagerSiteInfo}
						site={activeSite}
						mobileUi={fullScreenSections}
						activeTabName={activeTabName}
						showHeader={false}
					/>
				) : null;
			break;
		}
	}

	// If the site manager is open but there's no active panel,
	// close it (this can happen if the sidebar was the only content)
	if (!activePanel) {
		return null;
	}

	return (
		<div className={classNames(css.siteManager, className)} ref={ref}>
			{activePanel}
		</div>
	);
});
