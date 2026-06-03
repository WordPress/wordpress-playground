import { useMediaQuery } from '@wordpress/compose';
import { useActiveSite, useAppSelector } from '../../lib/state/redux/store';

import css from './style.module.css';
import { SiteInfoPanel } from './site-info-panel';
import classNames from 'classnames';

import { forwardRef, useState } from 'react';
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
		case 'blueprint':
		default:
		case 'site-details': {
			const STANDARD_SECTIONS = ['site-details', 'blueprints', 'sidebar'];
			const initialTab = !STANDARD_SECTIONS.includes(
				activeSiteManagerSection
			)
				? activeSiteManagerSection
				: undefined;
			activePanel = activeSite ? (
				fullScreenSections ? (
					<SiteInfoPanel
						key={`${activeSite?.slug}-${activeSiteManagerSection}`}
						className={css.siteManagerSiteInfo}
						site={activeSite}
						mobileUi={fullScreenSections}
						initialTab={initialTab}
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
							key={`${activeSite?.slug}-${activeSiteManagerSection}`}
							className={css.siteManagerSiteInfo}
							site={activeSite}
							mobileUi={fullScreenSections}
							initialTab={initialTab}
						/>
					</ResizableBox>
				)
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
