import classNames from 'classnames';
import css from './style.module.css';
import { getLogoDataURL, WordPressIcon } from '../icons';
import {
	Button,
	Flex,
	FlexItem,
	Icon,
	DropdownMenu,
	MenuGroup,
	MenuItem,
	TabPanel,
} from '@wordpress/components';
import { useMediaQuery } from '@wordpress/compose';
import { moreVertical, external, copy, chevronLeft } from '@wordpress/icons';
import { SiteLogs } from '../../log-modal';
import {
	useAppDispatch,
	setSiteManagerIsOpen,
	useAppSelector,
	SiteInfo,
} from '../../../lib/state/redux/store';
import { StorageType } from '../storage-type';
import { usePlaygroundClientInfo } from '../../../lib/use-playground-client';
import { SiteEditButton } from '../site-edit-button';
import { OfflineNotice } from '../../offline-notice';
import { DownloadAsZipMenuItem } from '../../toolbar-buttons/download-as-zip';
import { GithubExportMenuItem } from '../../toolbar-buttons/github-export-menu-item';
import { GithubImportMenuItem } from '../../toolbar-buttons/github-import-menu-item';
import { ReportError } from '../../toolbar-buttons/report-error';
import { RestoreFromZipMenuItem } from '../../toolbar-buttons/restore-from-zip';
import { TemporarySiteNotice } from '../temporary-site-notice';
import { SitePersistButton } from '../site-persist-button';

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
	mobileUi,
	onBackButtonClick,
}: {
	className: string;
	site: SiteInfo;
	removeSite: (site: SiteInfo) => Promise<void>;
	mobileUi?: boolean;
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

	const navigationButtonsPlacement = useMediaQuery('(min-width: 1400px)')
		? 'header'
		: mobileUi
		? 'footer'
		: 'menu';
	function navigateTo(path: string) {
		if (mobileUi) {
			// Collapse the sidebar when opening a site
			// because otherwise the site view will remain
			// hidden by the sidebar on small screens.
			dispatch(setSiteManagerIsOpen(false));
		}

		playground?.goTo(path);
	}

	return (
		<section
			className={classNames(className, css.siteInfoPanel, {
				[css.isMobile]: mobileUi,
			})}
		>
			{site.metadata.storage === 'none' ? (
				<TemporarySiteNotice className={css.siteNotice} />
			) : null}
			<Flex
				direction="column"
				gap={1}
				justify="flex-start"
				expanded={true}
			>
				<FlexItem style={{ flexShrink: 0 }}>
					<Flex
						direction="row"
						gap={4}
						justify="space-between"
						align="center"
						expanded={true}
						className={css.padded}
					>
						<FlexItem style={{ flexShrink: 0 }}>
							<Flex direction="row" gap={2}>
								{mobileUi && (
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
						<FlexItem style={{ flexShrink: 0 }}>
							<Flex direction="row" gap={4} align="center">
								{navigationButtonsPlacement === 'header' && (
									<>
										<Button
											variant="tertiary"
											disabled={!playground}
											onClick={() =>
												navigateTo('/wp-admin/')
											}
										>
											WP Admin
										</Button>
										<Button
											variant="secondary"
											disabled={!playground}
											onClick={() => navigateTo('/')}
										>
											Homepage
										</Button>
									</>
								)}
								<DropdownMenu
									icon={moreVertical}
									label="Additional actions"
									popoverProps={{
										placement: 'bottom-end',
									}}
								>
									{({ onClose }) => (
										<>
											{navigationButtonsPlacement ===
												'menu' && (
												<MenuGroup>
													<MenuItem
														icon={external}
														iconPosition="right"
														aria-label="Go to homepage"
														onClick={() =>
															navigateTo('/')
														}
													>
														Open site
													</MenuItem>
													<MenuItem
														icon={external}
														iconPosition="right"
														aria-label="Go to WP Admin"
														onClick={() =>
															navigateTo(
																'/wp-admin/'
															)
														}
													>
														WP Admin
													</MenuItem>
												</MenuGroup>
											)}
											<MenuGroup>
												<MenuItem
													aria-label="Delete this site"
													className={css.danger}
													onClick={() =>
														removeSiteAndCloseMenu(
															onClose
														)
													}
												>
													Delete
												</MenuItem>
											</MenuGroup>
											<MenuGroup>
												{/* 
													@TODO: Duplicate site feature = Export site + import site using these PHP tools:
													* https://github.com/adamziel/wxr-normalize/pull/1
													* https://github.com/adamziel/site-transfer-protocol
												*/}
												{/* <MenuItem onClick={onClose}>Duplicate Site</MenuItem> */}
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
											</MenuGroup>
											<MenuGroup>
												<ReportError
													onClose={onClose}
													disabled={offline}
												/>
											</MenuGroup>
										</>
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
									<div
										className={classNames(
											css.tabContents,
											css.padded
										)}
									>
										<div
											className={classNames(
												css.logsWrapper
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
				{navigationButtonsPlacement === 'footer' && (
					<FlexItem className={css.mobileFooter}>
						<Flex direction="row" gap={2} justify="center">
							<FlexItem style={{ flexGrow: 1 }}>
								<Button
									className={css.mobileFooterButton}
									variant="secondary"
									disabled={!playground}
									onClick={() => navigateTo('/wp-admin/')}
								>
									WP Admin
								</Button>
							</FlexItem>
							<FlexItem style={{ flexGrow: 1 }}>
								<Button
									className={css.mobileFooterButton}
									variant="primary"
									disabled={!playground}
									onClick={() => navigateTo('/')}
								>
									Homepage
								</Button>
							</FlexItem>
						</Flex>
					</FlexItem>
				)}
			</Flex>
		</section>
	);
}

function SiteSettingsTab({ site }: { site: SiteInfo }) {
	const username = 'admin';
	const password = 'password';

	const offline = useAppSelector((state) => state.offline);

	const { opfsMountDescriptor } = usePlaygroundClientInfo(site.slug) || {};

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
								<Flex
									direction="row"
									gap={4}
									justify="center"
									align="center"
								>
									<FlexItem>
										<StorageType
											type={site.metadata.storage}
										/>
									</FlexItem>

									{site.metadata.storage === 'none' ? (
										<FlexItem>
											<SitePersistButton
												siteSlug={site.slug}
											>
												<Button variant="link">
													Save
												</Button>
											</SitePersistButton>
										</FlexItem>
									) : null}

									{site.metadata.storage === 'local-fs' ? (
										<FlexItem>
											{' '}
											(
											{
												(opfsMountDescriptor as any)
													?.device?.handle.name
											}
											)
										</FlexItem>
									) : null}
								</Flex>
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
								<Button
									variant="link"
									className={classNames(
										css.grayLink,
										css.buttonNoPadding
									)}
									icon={() => <Icon size={16} icon={copy} />}
									iconPosition="right"
									onClick={() => {
										navigator.clipboard.writeText(password);
									}}
									label="Copy password"
								>
									{password}
								</Button>
							}
						/>
						{/* @TODO Discuss supporting and masking passwords fancier than "password" */}
						{/* <SiteInfoRow
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
						/> */}
					</Flex>
				</FlexItem>
				<FlexItem>
					<Flex
						direction="row"
						gap={8}
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
										{site.metadata.storage === 'none'
											? 'Edit site settings'
											: 'Edit runtime configuration'}
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
