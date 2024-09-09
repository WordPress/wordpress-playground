import React, { useState, useEffect } from 'react';
import css from './style.module.css';
import AddressBar from '../address-bar';
import { close } from '@wordpress/icons';
import classNames from 'classnames';
import { OpenSiteManagerButton } from '../open-site-manager-button';
import {
	useAppSelector,
	getActiveClient,
	useActiveSite,
} from '../../lib/redux-store';
import { SyncLocalFilesButton } from '../sync-local-files-button';

interface BrowserChromeProps {
	children?: React.ReactNode;
	hideToolbar?: boolean;
	className?: string;
}

export default function BrowserChrome({
	children,
	hideToolbar,
	className,
}: BrowserChromeProps) {
	const clientInfo = useAppSelector(getActiveClient);
	const activeSite = useActiveSite()!;
	const showAddressBar = !!clientInfo;
	const url = clientInfo?.url;
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

	return (
		<div
			className={`${wrapperClass} ${className}`}
			data-cy="simulated-browser"
		>
			<div className={`${css.window} browser-chrome-window`}>
				<header
					className={`
						${css.toolbar}
						${hideToolbar ? css.toolbarHidden : ''}
					`}
					aria-label="Playground toolbar"
				>
					<div className={css.windowControls}>
						<OpenSiteManagerButton />
					</div>

					<div className={addressBarClass}>
						<AddressBar
							url={url}
							onUpdate={(newUrl) =>
								clientInfo?.client.goTo(newUrl)
							}
						/>
					</div>

					<div className={css.toolbarButtons}>
						{activeSite?.metadata?.storage === 'local-fs' ? (
							<SyncLocalFilesButton />
						) : null}
					</div>
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
