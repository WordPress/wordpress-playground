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

import { forwardRef, useState } from 'react';
import { setSiteManagerOpen } from '../../lib/state/redux/slice-ui';
import { BlueprintsPanel } from './blueprints-panel';
import { ResizableBox } from '@wordpress/components';

const SITE_INFO_MIN_WIDTH = 400;
const SITE_INFO_DEFAULT_WIDTH = 555;
const SITE_INFO_WIDTH_STORAGE_KEY = 'playground-site-info-panel-width';

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

	// Load saved width from localStorage or use default
	const [siteInfoWidth, setSiteInfoWidth] = useState<number>(() => {
		try {
			const saved = localStorage.getItem(SITE_INFO_WIDTH_STORAGE_KEY);
			if (saved) {
				const width = parseInt(saved, 10);
				if (!isNaN(width) && width >= SITE_INFO_MIN_WIDTH) {
					return width;
				}
			}
		} catch {
			// localStorage might not be available
		}
		return SITE_INFO_DEFAULT_WIDTH;
	});

	// Save width to localStorage whenever it changes
	const handleResize = (
		_event: any,
		_direction: any,
		element: HTMLElement
	) => {
		const newWidth = element.offsetWidth;
		setSiteInfoWidth(newWidth);
		try {
			localStorage.setItem(
				SITE_INFO_WIDTH_STORAGE_KEY,
				newWidth.toString()
			);
		} catch {
			// localStorage might not be available
		}
	};

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
						size={{
							width: siteInfoWidth,
							height: '100%',
						}}
						enable={{
							top: false,
							right: true,
							bottom: false,
							left: false,
						}}
						onResizeStop={handleResize}
						showHandle={true}
						handleClasses={{
							right: css.siteInfoResizeHandle,
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
