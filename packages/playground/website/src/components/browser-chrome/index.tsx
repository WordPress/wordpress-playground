import React, { useState, useEffect } from 'react';
import css from './style.module.css';
import AddressBar from '../address-bar';
import { close } from '@wordpress/icons';
import classNames from 'classnames';
import { OpenSiteManagerButton } from '../open-site-manager-button';

interface BrowserChromeProps {
	children?: React.ReactNode;
	toolbarButtons?: Array<React.ReactElement | false | null>;
	url?: string;
	showAddressBar?: boolean;
	onUrlChange?: (url: string) => void;
	hideToolbar?: boolean;
	className?: string;
}

export default function BrowserChrome({
	children,
	url,
	onUrlChange,
	showAddressBar = true,
	toolbarButtons,
	hideToolbar,
	className,
}: BrowserChromeProps) {
	const addressBarClass = classNames(css.addressBarSlot, {
		[css.isHidden]: !showAddressBar,
	});
	const wrapperClass = classNames(css.wrapper, css.hasFullSizeWindow);

	const [noticeHidden, setNoticeHidden] = useState(
		document.cookie.includes('hideExperimentalNotice=true')
	);

	const hideNotice = () => {
		document.cookie = 'hideExperimentalNotice=true';
		setNoticeHidden(true);
	};
	useEffect(() => {
		const hideNoticeTimeout = setTimeout(hideNotice, 20000);
		return () => {
			clearTimeout(hideNoticeTimeout);
		};
	}, []);

	const experimentalNoticeClass = classNames(css.experimentalNotice, {
		[css.isHidden]: noticeHidden,
	});

	/**
	 * Temporary feature flag to enable the site manager
	 * while using browser storage.
	 *
	 * TODO: Remove this once the site manager supports all storage options.
	 */
	const query = new URL(window.location.href).searchParams;
	const showSiteManager = query.get('storage') === 'browser';

	return (
		<div
			className={`${wrapperClass} ${className}`}
			data-cy="simulated-browser"
		>
			<div className={`${css.window} browser-chrome-window`}>
				<header
					className={`${css.toolbar} ${
						showSiteManager ? css.hasSiteManager : ''
					} ${hideToolbar ? css.toolbarHidden : ''}`}
					aria-label="Playground toolbar"
				>
					<div className={css.windowControls}>
						{showSiteManager && <OpenSiteManagerButton />}
						{!showSiteManager && (
							<>
								<div
									className={`${css.windowControl} ${css.isNeutral}`}
								></div>
								<div
									className={`${css.windowControl} ${css.isNeutral}`}
								></div>
								<div
									className={`${css.windowControl} ${css.isNeutral}`}
								></div>
							</>
						)}
					</div>

					<div className={addressBarClass}>
						<AddressBar url={url} onUpdate={onUrlChange} />
					</div>

					<div className={css.toolbarButtons}>{toolbarButtons}</div>
				</header>
				<div className={css.content}>{children}</div>
				<div className={experimentalNoticeClass} onClick={hideNotice}>
					{close}
					This is a cool fun experimental WordPress running in your
					browser :) All your changes are private and gone after a
					page refresh.
				</div>
			</div>
		</div>
	);
}
