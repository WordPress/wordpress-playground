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
import { StorageType } from '../storage-type';
import { useSelector } from 'react-redux';
import { PlaygroundReduxState } from '../../../lib/redux-store';

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

export function SiteInfoView({
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
	const playground = useSelector(
		(state: PlaygroundReduxState) => state.playgroundClient
	);

	const [showNotice, setShowNotice] = useState(site.storage === 'temporary');

	return (
		<section className={classNames(className, css.siteInfoView)}>
			{showNotice ? (
				<Notice
					className={css.siteNotice}
					status="info"
					onRemove={() => setShowNotice(false)}
				>
					<Flex direction="row" gap={2} expanded={true}>
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
									{site.logo ? (
										<img
											src={getLogoDataURL(site.logo)}
											alt={site.name + ' logo'}
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
										{site.name}
									</h1>
									<span
										className={
											css.siteInfoHeaderDetailsCreatedAt
										}
									>
										{site.whenCreated
											? `Created ${new Date(
													site.whenCreated
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
										playground?.goTo('/');
									}}
								>
									Open site
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
														removeSiteAndCloseMenu(
															onClose
														)
													}
													// Avoid deleting the default WordPress site
													// ^ Why, though? Seeing a disabled delete button is confusing.
													//   Can we just delete it?
													disabled={
														site.slug ===
														'wordpress'
													}
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

function SiteSettingsTab({ site }: { site: SiteInfo }) {
	const [masked, setMasked] = useState(true);
	const username = 'admin';
	const password = 'password';

	return (
		<Flex
			gap={8}
			direction="column"
			className={css.maxWidth}
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
					<SiteInfoRow label="Site name" value={site.name} />
					<SiteInfoRow
						label="Storage"
						value={<StorageType type={site.storage} />}
					/>
					<SiteInfoRow
						label="WordPress version"
						value={site.wpVersion}
					/>
					<SiteInfoRow
						label="PHP version"
						value={`${site.phpVersion}${
							site.phpExtensionBundle === 'light'
								? ''
								: ' (with extensions)'
						}`}
					/>
					<SiteInfoRow
						label="Network access"
						value={
							site.originalBlueprint?.features?.networking
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
									icon={() => <Icon size={16} icon={copy} />}
									iconPosition="right"
									onClick={() => {
										navigator.clipboard.writeText(password);
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
									playground?.goTo('/wp-admin');
								}}
								target="_blank"
								rel="noopener noreferrer"
								className={css.buttonNoPadding}
								// icon={() => <Icon size={16} icon={external} />}
								// iconPosition="right"
								label="Go to Admin"
							>
								{site.url}/wp-admin{' '}
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
					{/* <FlexItem>
						<Button
							variant="tertiary"
							className={css.buttonNoPadding}
							onClick={() => {
								alert('Not implemented yet');
								// dispatch(setActiveModal('edit-site-details'));
							}}
						>
							Edit settings
						</Button>
					</FlexItem> */}
					{site.originalBlueprint ? (
						<FlexItem>
							<Button
								variant="link"
								className={css.buttonNoPadding}
								href={`/builder#${encodeURIComponent(
									site.originalBlueprint.id
								)}`}
								target="_blank"
								rel="noopener noreferrer"
								icon={() => <Icon icon={external} size={16} />}
								iconPosition="right"
							>
								View Blueprint
							</Button>
						</FlexItem>
					) : null}
				</Flex>
			</FlexItem>
		</Flex>
	);
}
