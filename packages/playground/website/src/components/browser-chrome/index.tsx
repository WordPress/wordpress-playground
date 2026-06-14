import React from 'react';
import css from './style.module.css';
import AddressBar from '../address-bar';
import classNames from 'classnames';
import {
	useAppSelector,
	getActiveClientInfo,
	useActiveSite,
} from '../../lib/state/redux/store';
import { SyncLocalFilesButton } from '../sync-local-files-button';
import { SaveStatusIndicator } from './save-status-indicator';
import { isSiteSavingDisabled } from '../../lib/state/url/router';

const isSavingDisabled = isSiteSavingDisabled();

interface BrowserChromeProps {
	children?: React.ReactNode;
	className?: string;
}

export default function BrowserChrome({
	children,
	className,
}: BrowserChromeProps) {
	const clientInfo = useAppSelector(getActiveClientInfo);
	const activeSite = useActiveSite();
	const showAddressBar = !!clientInfo;
	const url = clientInfo?.url;
	const addressBarClass = classNames(css.addressBarSlot, {
		[css.isHidden]: !showAddressBar,
	});
	const wrapperClass = classNames(
		css.wrapper,
		css.hasFullSizeWindow,
		className
	);

	return (
		<div className={wrapperClass} data-cy="simulated-browser">
			<div className={`${css.window} browser-chrome-window`}>
				<header className={css.toolbar} aria-label="Playground toolbar">
					<div className={addressBarClass}>
						<AddressBar
							url={url}
							onUpdate={(newUrl) =>
								clientInfo?.client.goTo(newUrl)
							}
						/>
					</div>

					{!isSavingDisabled && <SaveStatusIndicator />}

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
