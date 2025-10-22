import { Sidebar } from './sidebar';
import { useMediaQuery } from '@wordpress/compose';
import {
	useAppDispatch,
	useActiveSite,
	useAppSelector,
} from '../../lib/state/redux/store';

import css from './style.module.css';
import { SiteInfoPanel } from './site-info-panel';
import classNames from 'classnames';

import { forwardRef } from 'react';
import { setSiteManagerOpen } from '../../lib/state/redux/slice-ui';
import { BlueprintsPanel } from './blueprints-panel';
import { ResizableBox } from '@wordpress/components';

const SITE_INFO_MIN_WIDTH = 400;
const SITE_INFO_DEFAULT_WIDTH = 555;

export const SiteManager = forwardRef<
	HTMLDivElement,
	{
		className?: string;
	}
>(({ className }, ref) => {
	const activeSite = useActiveSite();
	const dispatch = useAppDispatch();

	const fullScreenSiteManager = useMediaQuery('(max-width: 1126px)');
	const fullScreenSections = useMediaQuery('(max-width: 875px)');
	const activeSiteManagerSection = useAppSelector(
		(state) => state.ui.siteManagerSection
	);

	const sidebar = (
		<Sidebar
			className={css.sidebar}
			mobileUi={fullScreenSections}
			afterSiteClick={() => {
				if (fullScreenSiteManager) {
					// Close the site manager so the site view is visible.
					dispatch(setSiteManagerOpen(false));
				}
			}}
		/>
	);

	let activePanel;
	switch (activeSiteManagerSection) {
		case 'blueprints':
			activePanel = (
				<BlueprintsPanel
					className={css.blueprintsPanel}
					mobileUi={fullScreenSections}
				/>
			);
			break;
		case 'site-details':
			activePanel = activeSite ? (
				fullScreenSections ? (
					<SiteInfoPanel
						key={activeSite?.slug}
						className={css.siteManagerSiteInfo}
						site={activeSite}
						mobileUi={fullScreenSections}
					/>
				) : (
					<ResizableBox
						key={activeSite?.slug}
						className={css.siteInfoResizable}
						minWidth={SITE_INFO_MIN_WIDTH}
						defaultSize={{
							width: SITE_INFO_DEFAULT_WIDTH,
							height: '100%',
						}}
						enable={{
							top: false,
							right: true,
							bottom: false,
							left: false,
						}}
						showHandle={true}
						handleClasses={{
							right: css.siteInfoResizeHandle,
						}}
						handleProps={{
							right: {
								'aria-label': 'Resize site info panel width',
							},
						}}
					>
						<SiteInfoPanel
							className={css.siteManagerSiteInfo}
							site={activeSite}
							mobileUi={fullScreenSections}
						/>
					</ResizableBox>
				)
			) : null;
			break;
		default:
			activePanel = null;
			break;
	}
	if (fullScreenSections) {
		return (
			<div className={classNames(css.siteManager, className)} ref={ref}>
				{activeSiteManagerSection === 'sidebar' || !activePanel
					? sidebar
					: activePanel}
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
