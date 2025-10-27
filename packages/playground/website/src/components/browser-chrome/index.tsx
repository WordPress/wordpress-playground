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
import { cog } from '@wordpress/icons';
import Button from '../button';
import { ActiveSiteSettingsForm } from '../site-manager/site-settings-form';
import { setSiteManagerOpen } from '../../lib/state/redux/slice-ui';
import { SiteManagerIcon } from '@wp-playground/components';

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
	const [isModalOpen, setIsModalOpen] = React.useState(false);
	const onToggle = () => setIsModalOpen(!isModalOpen);
	const closeModal = () => setIsModalOpen(false);

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
						{showAddressBar && (
							<Button
								className={css.refreshButton}
								aria-label="Refresh"
								onClick={() => {
									if (clientInfo && url) {
										clientInfo.client.goTo(url);
									}
								}}
							>
								<svg
									width="20"
									height="20"
									viewBox="0 0 24 24"
									fill="none"
									xmlns="http://www.w3.org/2000/svg"
									aria-hidden="true"
								>
									<path
										d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"
										fill="currentColor"
										stroke="currentColor"
										strokeWidth="0.5"
									/>
								</svg>
							</Button>
						)}
						<AddressBar
							url={url}
							onUpdate={(newUrl) =>
								clientInfo?.client.goTo(newUrl)
							}
						/>
					</div>

					<div className={css.toolbarButtons}>
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
									onClick={onToggle}
									aria-expanded={isModalOpen}
									style={{
										fill: '#FFF',
										alignItems: 'center',
										display: 'flex',
									}}
								>
									<Icon icon={cog} size={28} />
								</Button>
								{isModalOpen && (
									<Modal
										isFullScreen={true}
										title="Playground settings"
										onRequestClose={closeModal}
									>
										<ActiveSiteSettingsForm
											onSubmit={closeModal}
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
		</div>
	);
}
