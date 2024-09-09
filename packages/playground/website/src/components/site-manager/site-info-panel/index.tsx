import classNames from 'classnames';
import css from './style.module.css';
import { SiteInfo } from '../../../lib/site-storage';
import { getLogoDataURL, WordPressIcon } from '../icons';
import { useState } from '@wordpress/element';
import {
	Button,
	Notice,
	Flex,
	FlexItem,
	Icon,
	DropdownMenu,
	MenuGroup,
	MenuItem,
	TabPanel,
} from '@wordpress/components';
import {
	moreVertical,
	external,
	copy,
	seen,
	unseen,
	chevronLeft,
} from '@wordpress/icons';
import { SiteLogs } from '../../log-modal';
import {
	useAppDispatch,
	setSiteManagerIsOpen,
	saveSiteToDevice,
	useAppSelector,
} from '../../../lib/redux-store';
import { StorageType } from '../storage-type';
import { usePlaygroundClientInfo } from '../../../lib/use-playground-client';
import { SiteEditButton } from '../site-edit-button';
import { OfflineNotice } from '../../offline-notice';
import { DownloadAsZipMenuItem } from '../../toolbar-buttons/download-as-zip';
import { GithubExportMenuItem } from '../../toolbar-buttons/github-export-menu-item';
import { GithubImportMenuItem } from '../../toolbar-buttons/github-import-menu-item';
import { ReportError } from '../../toolbar-buttons/report-error';
import { RestoreFromZipMenuItem } from '../../toolbar-buttons/restore-from-zip';

function SiteInfoRow({
	label,
	value,
}: {
	label: string;
	value: string | JSX.Element;
}) {
	return (
		<Flex justify="flex-start" expanded={true}>
			<FlexItem className={css.infoRowLabel}>{label}</FlexItem>
			<FlexItem className={css.infoRowValue}>{value}</FlexItem>
		</Flex>
	);
}

export function SiteInfoPanel({
	className,
	site,
	removeSite,
	showBackButton,
	onBackButtonClick,
}: {
	className: string;
	site: SiteInfo;
	removeSite: (site: SiteInfo) => Promise<void>;
	showBackButton?: boolean;
	onBackButtonClick?: () => void;
}) {
	const offline = useAppSelector((state) => state.offline);
	const removeSiteAndCloseMenu = async (onClose: () => void) => {
		// TODO: Replace with HTML-based dialog
		const proceed = window.confirm(
			`Are you sure you want to delete the site '${site.metadata.name}'?`
		);
		if (proceed) {
			await removeSite(site);
			onClose();
		}
	};
	const clientInfo = useAppSelector((state) => state.clients[site.slug]);
	const playground = clientInfo?.client;
	const dispatch = useAppDispatch();

	return (
		<section className={classNames(className, css.siteInfoPanel)}>
			{site.metadata.storage === 'none' ? (
				<Notice
					className={css.siteNotice}
					spokenMessage="This is a temporary site. Your changes will be lost on page refresh."
					status="info"
					isDismissible={false}
				>
					<Flex direction="row" gap={2} expanded={true}>
						<FlexItem>
							<b>This is a temporary site.</b> Your changes will
							be lost on page refresh.
						</FlexItem>
						<FlexItem>
							<SaveSiteButton siteSlug={site.slug} mode="opfs">
								Save in this browser
							</SaveSiteButton>
							<SaveSiteButton
								siteSlug={site.slug}
								mode="local-fs"
							>
								Save on your computer
							</SaveSiteButton>
						</FlexItem>
					</Flex>
				</Notice>
			) : null}
			<Flex
				direction="column"
				gap={1}
				justify="flex-start"
				expanded={true}
			>
				<FlexItem>
					<Flex
						direction="row"
						gap={4}
						justify="space-between"
						align="center"
						expanded={true}
						className={css.padded}
					>
						<FlexItem>
							<Flex direction="row" gap={2}>
								{showBackButton && (
									<FlexItem>
										<Button
											variant="link"
											label="Back to sites list"
											icon={() => (
												<Icon
													icon={chevronLeft}
													size={38}
												/>
											)}
											className={css.grayLinkDark}
											onClick={onBackButtonClick}
										/>
									</FlexItem>
								)}
								<FlexItem className={css.siteInfoHeaderIcon}>
									{site.metadata.logo ? (
										<img
											src={getLogoDataURL(
												site.metadata.logo
											)}
											alt={site.metadata.name + ' logo'}
										/>
									) : (
										<WordPressIcon
											className={
												css.siteInfoHeaderIconDefault
											}
										/>
									)}
								</FlexItem>
								<Flex
									direction="column"
									gap={0.25}
									expanded={true}
								>
									<h1
										className={
											css.siteInfoHeaderDetailsName
										}
									>
										{site.metadata.name}
									</h1>
									<span
										className={
											css.siteInfoHeaderDetailsCreatedAt
										}
									>
										{site.metadata.whenCreated
											? `Created ${new Date(
													site.metadata.whenCreated
											  ).toLocaleString()}`
											: 'Created recently'}
									</span>
								</Flex>
							</Flex>
						</FlexItem>
						<FlexItem>
							<Flex direction="row" gap={4} align="center">
								<Button
									variant="secondary"
									onClick={() => {
										// Collapse the sidebar when opening a site
										// because otherwise the site view will remain
										// hidden by the sidebar on small screens.
										dispatch(setSiteManagerIsOpen(false));

										playground?.goTo('/');
									}}
								>
									Open site
								</Button>
								<DropdownMenu
									icon={moreVertical}
									label="Additional actions"
									popoverProps={{
										placement: 'bottom-end',
									}}
								>
									{({ onClose }) => (
										<MenuGroup>
											{/* 
												@TODO: Duplicate site feature = Export site + import site using these PHP tools:
												* https://github.com/adamziel/wxr-normalize/pull/1
												* https://github.com/adamziel/site-transfer-protocol
											*/}
											{/* <MenuItem onClick={onClose}>Duplicate</MenuItem> */}
											<ReportError
												onClose={onClose}
												disabled={offline}
											/>
											<DownloadAsZipMenuItem
												onClose={onClose}
											/>
											<RestoreFromZipMenuItem
												onClose={onClose}
											/>
											<GithubImportMenuItem
												onClose={onClose}
												disabled={offline}
											/>
											<GithubExportMenuItem
												onClose={onClose}
												disabled={offline}
											/>
											<MenuItem
												onClick={() =>
													removeSiteAndCloseMenu(
														onClose
													)
												}
											>
												Delete
											</MenuItem>
										</MenuGroup>
									)}
								</DropdownMenu>
							</Flex>
						</FlexItem>
					</Flex>
				</FlexItem>
				<FlexItem style={{ flexGrow: 1 }}>
					<TabPanel
						className={css.tabs}
						onSelect={function noRefCheck() {}}
						tabs={[
							{
								name: 'settings',
								title: 'Settings',
							},
							{
								name: 'logs',
								title: 'Logs',
							},
						]}
					>
						{(tab) => (
							<>
								{tab.name === 'settings' && (
									<div
										className={classNames(
											css.tabContents,
											css.padded
										)}
									>
										<SiteSettingsTab site={site} />
									</div>
								)}
								{tab.name === 'logs' && (
									<div className={css.tabContents}>
										<div
											className={classNames(
												css.scrollPane,
												css.padded
											)}
										>
											<SiteLogs
												className={css.logsSection}
											/>
										</div>
									</div>
								)}
							</>
						)}
					</TabPanel>
				</FlexItem>
			</Flex>
		</section>
	);
}

function SaveSiteButton({
	siteSlug,
	mode,
	children,
}: {
	siteSlug: string;
	mode: 'local-fs' | 'opfs';
	children: React.ReactNode;
}) {
	const clientInfo = useAppSelector((state) => state.clients[siteSlug]);
	const dispatch = useAppDispatch();

	const isSyncing =
		clientInfo?.opfsIsSyncing &&
		clientInfo?.opfsMountDescriptor?.device.type === mode;
	// @TODO: The parent component should be aware if local FS is unavailable so that it
	//        can adjust the UI accordingly.
	// 		  Also, acknowledge Safari doesn't support local FS yet as we cannot pass the directory
	//        handle to the worker. Perhaps we could work around this by triggering showDirectoryPicker
	//        from the worker thread.
	if (!isSyncing) {
		return (
			<Button
				variant="primary"
				disabled={!clientInfo?.client}
				onClick={async () => {
					dispatch(saveSiteToDevice(siteSlug, mode));
				}}
			>
				{children}
			</Button>
		);
	}

	if (!clientInfo?.opfsSyncProgress) {
		return (
			<>
				<div>
					<progress id="file" max="100" value="0"></progress>
				</div>
				<div>Preparing to save...</div>
			</>
		);
	}

	return (
		<>
			<div>
				<progress
					id="file"
					max={clientInfo.opfsSyncProgress.total}
					value={clientInfo.opfsSyncProgress.files}
				></progress>
			</div>
			<div>
				{clientInfo.opfsSyncProgress.files}
				{' / '}
				{clientInfo.opfsSyncProgress.total} files saved
			</div>
		</>
	);
}

function SiteSettingsTab({ site }: { site: SiteInfo }) {
	const [masked, setMasked] = useState(true);
	// @TODO: Get username and password from the site object
	const username = 'admin';
	const password = 'password';

	const offline = useAppSelector((state) => state.offline);

	const { client, opfsMountDescriptor } =
		usePlaygroundClientInfo(site.slug) || {};

	return (
		<>
			{offline ? <OfflineNotice /> : null}
			<Flex
				gap={8}
				direction="column"
				className={css.maxWidth}
				justify="flex-start"
				expanded={true}
			>
				<FlexItem>
					<Flex
						gap={4}
						direction="column"
						className={css.infoTable}
						expanded={true}
					>
						<FlexItem>
							<h3 className={css.sectionTitle}>Site details</h3>
						</FlexItem>
						<SiteInfoRow
							label="Site name"
							value={site.metadata.name}
						/>
						<SiteInfoRow
							label="Storage"
							value={
								<>
									<StorageType type={site.metadata.storage} />
									{opfsMountDescriptor?.device?.type ===
									'local-fs' ? (
										<>
											{' '}
											(
											{
												opfsMountDescriptor.device
													?.handle.name
											}
											)
										</>
									) : null}
								</>
							}
						/>
						<SiteInfoRow
							label="WordPress version"
							value={
								site.metadata.runtimeConfiguration
									.preferredVersions.wp
							}
						/>
						<SiteInfoRow
							label="PHP version"
							value={`${
								site.metadata.runtimeConfiguration
									.preferredVersions.php
							}${
								site.metadata.runtimeConfiguration.phpExtensionBundles?.includes(
									'kitchen-sink'
								)
									? ' (with extensions)'
									: ''
							}`}
						/>
						<SiteInfoRow
							label="Network access"
							value={
								site.metadata.runtimeConfiguration.features
									?.networking
									? 'Yes'
									: 'No'
							}
						/>
					</Flex>
				</FlexItem>

				<FlexItem>
					<Flex direction="column" gap={2} expanded={true}>
						<FlexItem>
							<h3 className={css.sectionTitle}>WP Admin</h3>
						</FlexItem>
						<SiteInfoRow
							label="Username"
							value={
								<Button
									variant="link"
									className={classNames(
										css.grayLink,
										css.buttonNoPadding
									)}
									icon={() => <Icon size={16} icon={copy} />}
									iconPosition="right"
									onClick={() => {
										navigator.clipboard.writeText(username);
									}}
									label="Copy username"
								>
									{username}
								</Button>
							}
						/>
						<SiteInfoRow
							label="Password"
							value={
								<Flex
									gap={0}
									expanded={true}
									align="center"
									justify="space-between"
								>
									<Button
										variant="link"
										className={classNames(
											css.grayLink,
											css.buttonNoPadding
										)}
										icon={() => (
											<Icon size={16} icon={copy} />
										)}
										iconPosition="right"
										onClick={() => {
											navigator.clipboard.writeText(
												password
											);
										}}
										label="Copy password"
									>
										{masked ? '••••••••' : 'password'}
									</Button>
									<Button
										variant="link"
										className={classNames(
											css.grayLink,
											css.buttonNoPadding
										)}
										icon={() => (
											<Icon
												size={18}
												icon={masked ? seen : unseen}
											/>
										)}
										iconPosition="right"
										onClick={() => {
											setMasked(!masked);
										}}
										label="Reveal password"
									/>
								</Flex>
							}
						/>
						<SiteInfoRow
							label="Admin URL"
							value={
								<Button
									variant="link"
									onClick={() => {
										client?.goTo('/wp-admin');
									}}
									target="_blank"
									rel="noopener noreferrer"
									className={css.buttonNoPadding}
									label="Go to Admin"
								>
									{/*@TODO: site.url*/}/wp-admin{' '}
								</Button>
							}
						/>
					</Flex>
				</FlexItem>
				<FlexItem>
					<Flex
						direction="row"
						gap={4}
						expanded={true}
						justify="flex-start"
					>
						<FlexItem>
							<SiteEditButton siteSlug={site.slug}>
								{(onClick) => (
									<Button
										variant="tertiary"
										className={css.buttonNoPadding}
										onClick={onClick}
									>
										Edit settings
									</Button>
								)}
							</SiteEditButton>
						</FlexItem>
						{site.metadata.originalBlueprint ? (
							<FlexItem>
								<Button
									variant="link"
									className={css.buttonNoPadding}
									href={`/builder/builder.html#${encodeURIComponent(
										btoa(
											JSON.stringify(
												// @TODO: Merge with the current runtime configuration
												site.metadata
													.originalBlueprint as any
											) as string
										) as string
									)}`}
									target="_blank"
									rel="noopener noreferrer"
									icon={() => (
										<Icon icon={external} size={16} />
									)}
									aria-label="Go to Blueprints Builder"
									iconPosition="right"
									disabled={offline}
								>
									View Blueprint
								</Button>
							</FlexItem>
						) : null}
					</Flex>
				</FlexItem>
			</Flex>
		</>
	);
}
