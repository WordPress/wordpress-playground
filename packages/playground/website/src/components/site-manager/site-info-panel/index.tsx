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
import { moreVertical, external, chevronLeft } from '@wordpress/icons';
import { SiteLogs } from '../../log-modal';
import { useAppDispatch, useAppSelector } from '../../../lib/state/redux/store';
import { usePlaygroundClientInfo } from '../../../lib/use-playground-client';
import { OfflineNotice } from '../../offline-notice';
import { DownloadAsZipMenuItem } from '../../toolbar-buttons/download-as-zip';
import { GithubExportMenuItem } from '../../toolbar-buttons/github-export-menu-item';
import { GithubImportMenuItem } from '../../toolbar-buttons/github-import-menu-item';
import { ReportError } from '../../toolbar-buttons/report-error';
import { RestoreFromZipMenuItem } from '../../toolbar-buttons/restore-from-zip';
import { TemporarySiteNotice } from '../temporary-site-notice';
import { SiteInfo } from '../../../lib/state/redux/slice-sites';
import { setSiteManagerOpen } from '../../../lib/state/redux/slice-ui';
import { selectClientInfoBySiteSlug } from '../../../lib/state/redux/slice-clients';
import { encodeStringAsBase64 } from '../../../lib/base64';
import { ActiveSiteSettingsForm } from '../site-settings-form/active-site-settings-form';
import { getRelativeDate } from '../../../lib/get-relative-date';

export function SiteInfoPanel({
	className,
	site,
	removeSite,
	mobileUi,
	siteViewHidden,
	onBackButtonClick,
}: {
	className: string;
	site: SiteInfo;
	removeSite: (site: SiteInfo) => Promise<void>;
	mobileUi?: boolean;
	siteViewHidden?: boolean;
	onBackButtonClick?: () => void;
}) {
	const offline = useAppSelector((state) => state.ui.offline);
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
	const clientInfo = useAppSelector((state) =>
		selectClientInfoBySiteSlug(state, site.slug)
	);
	const playground = clientInfo?.client;
	const dispatch = useAppDispatch();

	const navigationButtonsPlacement = useMediaQuery('(min-width: 1400px)')
		? 'header'
		: mobileUi
		? 'footer'
		: 'menu';
	function navigateTo(path: string) {
		if (siteViewHidden) {
			// Close the site manager so the site view is visible.
			dispatch(setSiteManagerOpen(false));
		}

		playground?.goTo(path);
	}
	const isTemporary = site.metadata.storage === 'none';

	const { opfsMountDescriptor } = usePlaygroundClientInfo(site.slug) || {};

	const localDirName =
		site.metadata?.storage === 'local-fs'
			? (opfsMountDescriptor as any)?.device?.handle?.name
			: undefined;

	return (
		<section
			className={classNames(className, css.siteInfoPanel, {
				[css.isMobile]: mobileUi,
			})}
		>
			<Flex
				direction="column"
				gap={1}
				justify="flex-start"
				expanded={true}
				className={css.siteInfoPanelContent}
			>
				<FlexItem style={{ flexShrink: 0 }}>
					<Flex
						direction="row"
						gap={4}
						justify="space-between"
						align="center"
						expanded={true}
						className={css.padded}
						style={{ paddingBottom: 10 }}
					>
						<FlexItem>
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
										{isTemporary
											? 'Temporary Playground'
											: site.metadata.name}
									</h1>
									{!isTemporary && (
										<span
											className={
												css.siteInfoHeaderDetailsCreatedAt
											}
										>
											{(function () {
												const createdAgo = site.metadata
													.whenCreated
													? getRelativeDate(
															new Date(
																site.metadata.whenCreated
															)
													  )
													: '';
												switch (site.metadata.storage) {
													case 'local-fs':
														return (
															'Saved in a local directory' +
															(localDirName
																? ` (${localDirName})`
																: '') +
															` ${createdAgo}`
														);
													case 'opfs':
														return `Saved in this browser ${createdAgo}`;
												}
											})()}{' '}
										</span>
									)}
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
														onClick={() => {
															navigateTo('/');
															onClose();
														}}
													>
														Homepage
													</MenuItem>
													<MenuItem
														icon={external}
														iconPosition="right"
														aria-label="Go to WP Admin"
														onClick={() => {
															navigateTo(
																'/wp-admin/'
															);
															onClose();
														}}
													>
														WP Admin
													</MenuItem>
												</MenuGroup>
											)}
											{!isTemporary && (
												<MenuGroup>
													<MenuItem
														aria-label="Delete this Playground"
														className={css.danger}
														disabled={!playground}
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
											<MenuGroup>
												<DownloadAsZipMenuItem
													onClose={onClose}
													disabled={!playground}
												/>
												<RestoreFromZipMenuItem
													onClose={onClose}
													disabled={!playground}
												/>
												<GithubImportMenuItem
													onClose={onClose}
													disabled={
														offline || !playground
													}
												/>
												<GithubExportMenuItem
													onClose={onClose}
													disabled={
														offline || !playground
													}
												/>
												<MenuItem
													// @ts-ignore
													href={`/builder/builder.html#${encodeStringAsBase64(
														JSON.stringify(
															site.metadata
																.originalBlueprint as any
														) as string
													)}`}
													target="_blank"
													rel="noopener noreferrer"
													icon={external}
													iconPosition="right"
													aria-label="View Blueprint"
													disabled={offline}
												>
													View Blueprint
												</MenuItem>
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
										className={classNames(css.tabContents)}
									>
										{offline ? (
											<div className={css.padded}>
												<OfflineNotice />
											</div>
										) : null}

										{isTemporary ? (
											<TemporarySiteNotice
												className={css.siteNotice}
											/>
										) : null}

										<ActiveSiteSettingsForm />
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
