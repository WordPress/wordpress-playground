import React from 'react';
import css from './style.module.css';
import AddressBar from '../address-bar';
import classNames from 'classnames';
import { useMediaQuery } from '@wordpress/compose';
import {
	useAppSelector,
	getActiveClientInfo,
	useActiveSite,
	useAppDispatch,
} from '../../lib/state/redux/store';
import { SyncLocalFilesButton } from '../sync-local-files-button';
import { Dropdown, Icon } from '@wordpress/components';
import { Modal } from '../../components/modal';
import { cog, category } from '@wordpress/icons';
import Button from '../button';
import { ActiveSiteSettingsForm } from '../site-manager/site-settings-form';
import { setSiteManagerOpen } from '../../lib/state/redux/slice-ui';
import { SiteManagerIcon } from '@wp-playground/components';
import {
	SavedPlaygroundsOverlay,
	type OverlayViewMode,
} from '../saved-playgrounds-overlay';
import { SaveStatusIndicator } from './save-status-indicator';

const query = new URL(document.location.href).searchParams;
const overlayParam = query.get('overlay');
const shouldOpenOverlay = overlayParam !== null;

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
	const dispatch = useAppDispatch();
	const siteManagerIsOpen = useAppSelector(
		(state) => state.ui.siteManagerIsOpen
	);
	const addressBarClass = classNames(css.addressBarSlot, {
		[css.isHidden]: !showAddressBar,
	});
	const wrapperClass = classNames(
		css.wrapper,
		css.hasFullSizeWindow,
		className
	);
	const isMobileUi = useMediaQuery('(max-width: 875px)');
	const [isSettingsModalOpen, setIsSettingsModalOpen] = React.useState(false);
	const [isPlaygroundsOverlayOpen, setIsPlaygroundsOverlayOpen] =
		React.useState(shouldOpenOverlay);
	const [overlayInitialViewMode, setOverlayInitialViewMode] =
		React.useState<OverlayViewMode>(
			overlayParam === 'blueprints' ? 'blueprints' : 'main'
		);
	const onSettingsToggle = () => setIsSettingsModalOpen(!isSettingsModalOpen);
	const closeSettingsModal = () => setIsSettingsModalOpen(false);
	const closePlaygroundsOverlay = () => {
		setIsPlaygroundsOverlayOpen(false);
		setOverlayInitialViewMode('main'); // Reset for next manual open

		// Remove overlay parameter from URL so reload doesn't reopen overlay
		const url = new URL(window.location.href);
		if (url.searchParams.has('overlay')) {
			url.searchParams.delete('overlay');
			window.history.replaceState({}, '', url.toString());
		}
	};

	return (
		<div className={wrapperClass} data-cy="simulated-browser">
			<div className={`${css.window} browser-chrome-window`}>
				<header
					className={classNames(css.toolbar, {
						[css.withSidebarOpen]: siteManagerIsOpen,
					})}
					aria-label="Playground toolbar"
				>
					<div className={addressBarClass}>
						<AddressBar
							url={url}
							onUpdate={(newUrl) =>
								clientInfo?.client.goTo(newUrl)
							}
						/>
					</div>

					<div className={css.saveStatusSlot}>
						<SaveStatusIndicator />
					</div>

					<div className={css.toolbarButtons}>
						<Button
							variant="browser-chrome"
							aria-label="Saved Playgrounds"
							onClick={() => setIsPlaygroundsOverlayOpen(true)}
							aria-expanded={isPlaygroundsOverlayOpen}
							className={css.savedPlaygroundsButton}
						>
							<Icon icon={category} size={20} />
						</Button>

						<Button
							variant="browser-chrome"
							aria-label={
								siteManagerIsOpen
									? 'Close Site Manager'
									: 'Open Site Manager'
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

						{isMobileUi ? (
							<>
								<Button
									variant="browser-chrome"
									aria-label="Edit Playground settings"
									onClick={onSettingsToggle}
									aria-expanded={isSettingsModalOpen}
									style={{
										fill: '#FFF',
										alignItems: 'center',
										display: 'flex',
									}}
								>
									<Icon icon={cog} size={28} />
								</Button>
								{isSettingsModalOpen && (
									<Modal
										isFullScreen={true}
										title="Playground settings"
										onRequestClose={closeSettingsModal}
									>
										<ActiveSiteSettingsForm
											onSubmit={closeSettingsModal}
										/>
									</Modal>
								)}
							</>
						) : (
							<Dropdown
								className="my-container-class-name"
								contentClassName="my-dropdown-content-classname"
								popoverProps={{ placement: 'bottom-start' }}
								renderToggle={({ isOpen, onToggle }) => (
									<Button
										variant="browser-chrome"
										aria-label="Edit Playground settings"
										onClick={onToggle}
										aria-expanded={isOpen}
										style={{
											fill: '#FFF',
											alignItems: 'center',
											display: 'flex',
										}}
									>
										<Icon icon={cog} size={28} />
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
						)}
						{activeSite?.metadata?.storage === 'local-fs' ? (
							<SyncLocalFilesButton />
						) : null}
					</div>
				</header>
				<div className={css.content}>{children}</div>
			</div>
			{isPlaygroundsOverlayOpen && (
				<SavedPlaygroundsOverlay
					onClose={closePlaygroundsOverlay}
					initialViewMode={overlayInitialViewMode}
				/>
			)}
		</div>
	);
}
