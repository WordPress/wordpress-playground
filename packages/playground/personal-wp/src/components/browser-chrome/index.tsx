import React from 'react';
import css from './style.module.css';
import AddressBar from '../address-bar';
import classNames from 'classnames';
import {
	useAppSelector,
	getActiveClientInfo,
	useActiveSite,
	useAppDispatch,
} from '../../lib/state/redux/store';
import { SyncLocalFilesButton } from '../sync-local-files-button';
import { Icon } from '@wordpress/components';
import { category } from '@wordpress/icons';
import Button from '../button';
import { MenuOverlay } from '../menu-overlay';
import { JustViewport } from '../playground-viewport';
import { setSiteManagerOpen } from '../../lib/state/redux/slice-ui';
import { SiteManagerIcon } from '@wp-playground/components';
import { BackupStatusIndicator } from './backup-status-indicator';

interface BrowserChromeProps {
	className?: string;
}

export default function BrowserChrome({ className }: BrowserChromeProps) {
	const clientInfo = useAppSelector(getActiveClientInfo);
	const activeSite = useActiveSite();
	const dispatch = useAppDispatch();
	const siteManagerIsOpen = useAppSelector(
		(state) => state.ui.siteManagerIsOpen
	);
	const showAddressBar = !!clientInfo || !!activeSite;
	const url = clientInfo?.url;

	const addressBarClass = classNames(css.addressBarSlot, {
		[css.isHidden]: !showAddressBar,
	});
	const wrapperClass = classNames(
		css.wrapper,
		css.hasFullSizeWindow,
		className
	);
	const [isMenuOverlayOpen, setIsMenuOverlayOpen] = React.useState(false);
	const closeMenuOverlay = () => setIsMenuOverlayOpen(false);

	return (
		<div className={wrapperClass} data-cy="simulated-browser">
			<div className={`${css.window} browser-chrome-window`}>
				<header
					className={classNames(css.toolbar, {
						[css.withSidebarOpen]: siteManagerIsOpen,
					})}
					aria-label="Playground toolbar"
				>
					<div className={css.toolbarButtonsLeft}>
						<Button
							variant="browser-chrome"
							aria-label={
								siteManagerIsOpen
									? 'Close Site Tools'
									: 'Open Site Tools'
							}
							aria-pressed={siteManagerIsOpen}
							className={classNames(css.openSiteManagerButton, {
								[css.openSiteManagerButtonActive]:
									siteManagerIsOpen,
							})}
							onClick={() => {
								dispatch(
									setSiteManagerOpen(!siteManagerIsOpen)
								);
							}}
						>
							<SiteManagerIcon
								sidebarActive={siteManagerIsOpen}
							/>
						</Button>
					</div>

					<div className={addressBarClass}>
						<AddressBar
							url={url}
							onUpdate={(newUrl) =>
								clientInfo?.client.goTo(newUrl)
							}
							onOpenOverlay={() => setIsMenuOverlayOpen(true)}
						/>
					</div>

					<BackupStatusIndicator />

					<div className={css.toolbarButtons}>
						<Button
							variant="browser-chrome"
							aria-label="Playground Menu"
							onClick={() => setIsMenuOverlayOpen(true)}
							aria-expanded={isMenuOverlayOpen}
							className={css.savedPlaygroundsButton}
						>
							<Icon icon={category} size={20} />
						</Button>
						{activeSite?.metadata?.storage === 'local-fs' ? (
							<SyncLocalFilesButton />
						) : null}
					</div>
				</header>
				<div className={css.content}>
					{activeSite && <JustViewport siteSlug={activeSite.slug} />}
				</div>
			</div>
			{isMenuOverlayOpen && <MenuOverlay onClose={closeMenuOverlay} />}
		</div>
	);
}
