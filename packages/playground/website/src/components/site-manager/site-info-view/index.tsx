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
import { moreVertical, external, copy, seen } from '@wordpress/icons';
import { SiteLogs } from '../../log-modal';

export function SiteInfoView({
	className,
	site,
	removeSite,
}: {
	className: string;
	site: SiteInfo;
	removeSite: (site: SiteInfo) => Promise<void>;
}) {
	const removeSiteAndCloseMenu = async (onClose: () => void) => {
		// TODO: Replace with HTML-based dialog
		const proceed = window.confirm(
			`Are you sure you want to delete the site '${site.name}'?`
		);
		if (proceed) {
			await removeSite(site);
			onClose();
		}
	};

	const [showNotice, setShowNotice] = useState(site.storage === 'temporary');
	return (
		<section
			className={classNames(className, css.siteManagerSiteInfoContainer)}
		>
			{showNotice ? (
				<Notice
					className={css.siteNotice}
					status="info"
					onRemove={() => setShowNotice(false)}
				>
					<Flex direction="row" gap={2}>
						<FlexItem>
							<b>This is a temporary site.</b> Your changes will
							be lost on page refresh.
						</FlexItem>
						<FlexItem>
							<Button
								variant="primary"
								onClick={() => {
									alert('@TODO implement me');
								}}
							>
								Save locally
							</Button>
						</FlexItem>
					</Flex>
				</Notice>
			) : null}
			<section className={css.siteManagerSiteInfoContents}>
				<header className={css.siteManagerSiteInfoHeader}>
					<div className={css.siteManagerSiteInfoHeaderIcon}>
						{site.logo ? (
							<img
								src={getLogoDataURL(site.logo)}
								alt={site.name + ' logo'}
							/>
						) : (
							<WordPressIcon
								className={
									css.siteManagerSiteInfoHeaderIconDefault
								}
							/>
						)}
					</div>
					<div className={css.siteManagerSiteInfoHeaderDetails}>
						<h1
							className={css.siteManagerSiteInfoHeaderDetailsName}
						>
							{site.name}
						</h1>
						<span
							className={
								css.siteManagerSiteInfoHeaderDetailsCreatedAt
							}
						>
							{site.whenCreated
								? `Created ${new Date(
										site.whenCreated
								  ).toLocaleString()}`
								: '--'}
						</span>
					</div>
					<div className={css.siteManagerSiteInfoHeaderActions}>
						<Button variant="tertiary">
							WP Admin
							<Icon
								icon={external}
								size={16}
								style={{ marginLeft: '8px' }}
							/>
						</Button>
						<Button variant="secondary">
							Open site
							<Icon
								icon={external}
								size={16}
								style={{ marginLeft: '8px' }}
							/>
						</Button>
						<DropdownMenu
							icon={moreVertical}
							label="Select a direction"
							popoverProps={{
								placement: 'bottom-end',
							}}
						>
							{({ onClose }) => (
								<>
									{/* <MenuGroup>
										<MenuItem icon={external} onClick={onClose}>
											Open site
										</MenuItem>
										<MenuItem icon={external} onClick={onClose}>
											WP Admin
										</MenuItem>
									</MenuGroup> */}
									<MenuGroup>
										{/* <MenuItem onClick={onClose}>
											Duplicate
										</MenuItem>
										<MenuItem onClick={onClose}>Reset</MenuItem> */}
										<MenuItem
											onClick={() =>
												removeSiteAndCloseMenu(onClose)
											}
											// Avoid deleting the default WordPress site
											disabled={site.slug === 'wordpress'}
										>
											Delete
										</MenuItem>
									</MenuGroup>
									{/* <MenuGroup>
										<MenuItem onClick={onClose}>
											Download as .zip
										</MenuItem>
										<MenuItem onClick={onClose}>
											Restore from .zip
										</MenuItem>
									</MenuGroup>
									<MenuGroup>
										<MenuItem onClick={onClose}>
											Share feedback
										</MenuItem>
									</MenuGroup> */}
								</>
							)}
						</DropdownMenu>
					</div>
				</header>
				<TabPanel
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
						<div>
							{tab.name === 'settings' && (
								<section
									className={css.siteManagerSiteInfoSection}
								>
									<Flex direction="column" gap={4}>
										<FlexItem>
											<h3
												className={
													css.siteManagerSiteInfoSectionTitle
												}
											>
												Site details
											</h3>
										</FlexItem>
										<FlexItem>
											<Flex justify="space-between">
												<FlexItem>Name:</FlexItem>
												<FlexItem>{site.name}</FlexItem>
											</Flex>
										</FlexItem>
										<FlexItem>
											<Flex justify="space-between">
												<FlexItem>Theme:</FlexItem>
												<FlexItem>TBD</FlexItem>
											</Flex>
										</FlexItem>
										<FlexItem>
											<Flex justify="space-between">
												<FlexItem>Storage:</FlexItem>
												<FlexItem>
													{
														{
															temporary: 'None',
															'local-fs':
																'Local directory',
															opfs: 'This browser',
														}[site.storage]
													}
												</FlexItem>
											</Flex>
										</FlexItem>
										<FlexItem>
											<Flex justify="space-between">
												<FlexItem>
													WordPress version:
												</FlexItem>
												<FlexItem>
													{site.wpVersion}
												</FlexItem>
											</Flex>
										</FlexItem>
										<FlexItem>
											<Flex justify="space-between">
												<FlexItem>
													PHP version:
												</FlexItem>
												<FlexItem>
													{site.phpVersion}
												</FlexItem>
											</Flex>
										</FlexItem>
										<FlexItem>
											<Flex justify="space-between">
												<FlexItem>
													Network access:
												</FlexItem>
												<FlexItem>TODO</FlexItem>
											</Flex>
										</FlexItem>
									</Flex>

									<Flex direction="column" gap={4}>
										<FlexItem>
											<h3
												className={
													css.siteManagerSiteInfoSectionTitle
												}
											>
												WP Admin
											</h3>
										</FlexItem>
										<FlexItem>
											<Flex justify="space-between">
												<FlexItem>Username:</FlexItem>
												<FlexItem>
													admin
													<Button
														variant="secondary"
														size="small"
														icon={
															<Icon icon={copy} />
														}
														onClick={() => {
															/* TODO: Implement copy */
														}}
														label="Copy password"
													/>
												</FlexItem>
											</Flex>
										</FlexItem>
										<FlexItem>
											<Flex justify="space-between">
												<FlexItem>Password:</FlexItem>
												<FlexItem>
													<Flex gap={2}>
														<FlexItem>
															••••••••
															<Button
																variant="secondary"
																size="small"
																icon={
																	<Icon
																		icon={
																			copy
																		}
																	/>
																}
																onClick={() => {
																	/* TODO: Implement copy */
																}}
																label="Copy password"
															/>
															<Button
																variant="secondary"
																size="small"
																icon={
																	<Icon
																		icon={
																			seen
																		}
																	/>
																}
																onClick={() => {
																	/* TODO: Implement reveal */
																}}
																label="Reveal password"
															/>
														</FlexItem>
													</Flex>
												</FlexItem>
											</Flex>
										</FlexItem>
										<FlexItem>
											<Flex justify="space-between">
												<FlexItem>
													WP Admin URL:
												</FlexItem>
												<FlexItem>
													<a
														href={`${site.url}/wp-admin`}
														target="_blank"
														rel="noopener noreferrer"
													>
														{site.url}/wp-admin{' '}
														<Icon
															icon={external}
															size={16}
														/>
													</a>
												</FlexItem>
											</Flex>
										</FlexItem>
									</Flex>

									<Flex direction="row" gap={2}>
										<FlexItem>
											<Button
												variant="tertiary"
												onClick={() => {
													/* TODO: Implement edit site details */
												}}
											>
												Edit site details
											</Button>
										</FlexItem>
										<FlexItem>
											<Button
												variant="tertiary"
												href="#" // TODO: Replace with actual Blueprint preview URL
												target="_blank"
												rel="noopener noreferrer"
												icon={
													<Icon
														icon={external}
														size={16}
													/>
												}
												iconPosition="right"
											>
												Preview Blueprint
											</Button>
										</FlexItem>
									</Flex>
								</section>
							)}
							{tab.name === 'logs' && (
								<section
									className={css.siteManagerSiteInfoSection}
								>
									<SiteLogs />
								</section>
							)}
						</div>
					)}
				</TabPanel>
			</section>
		</section>
	);
}
