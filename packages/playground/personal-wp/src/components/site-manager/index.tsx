import { useMediaQuery } from '@wordpress/compose';
import { useActiveSite } from '../../lib/state/redux/store';

import css from './style.module.css';
import { SiteInfoPanel } from './site-info-panel';
import classNames from 'classnames';

import { forwardRef, useState } from 'react';
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

	if (!activeSite) {
		return null;
	}

	const activePanel = fullScreenSections ? (
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
	);

	return (
		<div className={classNames(css.siteManager, className)} ref={ref}>
			{activePanel}
		</div>
	);
});
