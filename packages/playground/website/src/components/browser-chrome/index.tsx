import React, { useState, useEffect } from 'react';
import css from './style.module.css';
import AddressBar from '../address-bar';
import { close } from '@wordpress/icons';
import classNames from 'classnames';

interface BrowserChromeProps {
	children?: React.ReactNode;
	toolbarButtons?: Array<React.ReactElement | false | null>;
	url?: string;
	showAddressBar?: boolean;
	onUrlChange?: (url: string) => void;
}

export default function BrowserChrome({
	children,
	url,
	onUrlChange,
	showAddressBar = true,
	toolbarButtons,
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

	// Temporary feature flag for the site manager
	const query = new URL(document.location.href).searchParams;
	const showSiteManager = query.get('site-manager') === 'true';

	return (
		<div className={wrapperClass} data-cy="simulated-browser">
			<div className={css.window}>
				<header className={css.toolbar} aria-label="Playground toolbar">
					<div className={css.windowControls}>
						{showSiteManager ? (
							<img
								src="/logo.svg"
								alt="Logo"
								className={css.logo}
							/>
						) : (
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
