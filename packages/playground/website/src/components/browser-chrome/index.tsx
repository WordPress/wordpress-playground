import React from 'react';
import css from './style.module.css';
import AddressBar from '../address-bar';
import classNames from 'classnames';
import { OpenSiteManagerButton } from '../open-site-manager-button';
import {
	useAppSelector,
	getActiveClient,
	useActiveSite,
} from '../../lib/state/redux/store';
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
			</div>
		</div>
	);
}
