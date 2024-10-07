import React from 'react';
import css from './style.module.css';
import AddressBar from '../address-bar';
import classNames from 'classnames';
import { OpenSiteManagerButton } from '../open-site-manager-button';
import {
	useAppSelector,
	getActiveClientInfo,
	useActiveSite,
} from '../../lib/state/redux/store';
import { SyncLocalFilesButton } from '../sync-local-files-button';
import { Dropdown, Icon } from '@wordpress/components';
import { cog } from '@wordpress/icons';
import Button from '../button';
import { ActiveSiteSettingsForm } from '../site-manager/site-settings-form';

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
	const clientInfo = useAppSelector(getActiveClientInfo);
	const activeSite = useActiveSite();
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
						<Dropdown
							className="my-container-class-name"
							contentClassName="my-dropdown-content-classname"
							popoverProps={{ placement: 'bottom-start' }}
							renderToggle={({ isOpen, onToggle }) => (
								<Button
									variant="browser-chrome"
									onClick={onToggle}
									aria-expanded={isOpen}
									style={{
										padding: '0 10px',
										fill: '#FFF',
										alignItems: 'center',
										display: 'flex',
									}}
								>
									<Icon icon={cog} />
								</Button>
							)}
							renderContent={({ onClose }) => (
								<div
									style={{
										width: 400,
										maxWidth: '100vw',
										padding: 0,
									}}
								>
									<div className={css.headerSection}>
										<h2 style={{ margin: 0 }}>
											Playground settings
										</h2>
									</div>
									<ActiveSiteSettingsForm
										onSubmit={onClose}
									/>
								</div>
							)}
						/>
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
