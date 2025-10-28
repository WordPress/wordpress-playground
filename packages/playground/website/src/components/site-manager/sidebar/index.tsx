import css from './style.module.css';
import classNames from 'classnames';
import {
	__experimentalHeading as Heading,
	NavigableMenu,
	MenuGroup,
	MenuItem,
	__experimentalHStack as HStack,
	FlexBlock,
	Icon,
	__experimentalItemGroup as ItemGroup,
	__experimentalItem as Item,
	Flex,
	DropdownMenu,
	Button,
} from '@wordpress/components';
import { page, close } from '@wordpress/icons';
import { ClockIcon, WordPressIcon } from '@wp-playground/components';
import {
	setActiveSite,
	useActiveSite,
	useAppDispatch,
	useAppSelector,
} from '../../../lib/state/redux/store';
import type { SiteLogo } from '../../../lib/state/redux/slice-sites';
import {
	selectSortedSites,
	selectTemporarySite,
} from '../../../lib/state/redux/slice-sites';
import { PlaygroundRoute, redirectTo } from '../../../lib/state/url/router';
import { setSiteManagerSection } from '../../../lib/state/redux/slice-ui';
import { WordPressPRMenuItem } from '../../toolbar-buttons/wordpress-pr-menu-item';
import { GutenbergPRMenuItem } from '../../toolbar-buttons/gutenberg-pr-menu-item';
import { RestoreFromZipMenuItem } from '../../toolbar-buttons/restore-from-zip';
import { GithubImportMenuItem } from '../../toolbar-buttons/github-import-menu-item';

export function Sidebar({
	className,
	afterSiteClick,
	mobileUi,
}: {
	className?: string;
	mobileUi?: boolean;
	afterSiteClick?: (slug: string) => void;
}) {
	const offline = useAppSelector((state) => state.ui.offline);
	const storedSites = useAppSelector(selectSortedSites).filter(
		(site) => site.metadata.storage !== 'none'
	);
	const temporarySite = useAppSelector(selectTemporarySite);
	const activeSite = useActiveSite();
	const dispatch = useAppDispatch();
	const activeSiteManagerSection = useAppSelector(
		(state) => state.ui.siteManagerSection
	);
	const onSiteClick = (slug: string) => {
		dispatch(setActiveSite(slug));
		dispatch(setSiteManagerSection('site-details'));
		afterSiteClick?.(slug);
	};

	const resources = [
		{
			label: 'Preview WordPress PR',
			href: '/wordpress.html',
		},
		{
			label: 'More demos',
			href: '/demos/index.html',
		},
		{
			label: 'Documentation',
			href: 'https://wordpress.github.io/wordpress-playground/',
		},
		{
			label: 'GitHub',
			href: 'https://github.com/wordpress/wordpress-playground',
		},
	];

	const getLogoDataURL = (logo: SiteLogo): string => {
		return `data:${logo.mime};base64,${logo.data}`;
	};

	const isTemporarySiteSelected =
		activeSite?.metadata.storage === 'none' &&
		['sidebar', 'site-details'].includes(activeSiteManagerSection);

	return (
		// Disable the `role` as Axe accessibility checker complains that a `menu`
		// role cannot have `div`, `nav`, `footer` and `button` as children.
		<NavigableMenu
			className={classNames(css.sidebar, className, 'main-sidebar')}
			// eslint-disable-next-line jsx-a11y/aria-role
			role=""
			aria-orientation={undefined}
		>
			{/* Padding 3px is because of focus on dropdown button */}
			<Flex
				justify="flex-start"
				direction="row"
				style={{ padding: '0 20px 0 16px', gap: 16 }}
			>
				<div className={css.sidebarLogo}>
					<svg
						viewBox="0 0 124 124"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							fillRule="evenodd"
							clipRule="evenodd"
							d="M14.755 45.1665C12.0512 48.8962 10.6245 53.4789 10.3951 58.5153C10.358 59.3301 10.3522 60.1566 10.3774 60.9934C10.7191 72.3238 16.7432 85.5209 27.6103 96.388C44.2413 113.019 66.3294 118.307 78.8323 109.243C73.5732 108.004 68.2526 106.073 63.0136 103.496C61.6689 103.437 60.222 103.262 58.6713 102.952C56.0196 102.421 53.2158 101.511 50.3594 100.216C50.3593 100.216 50.3592 100.215 50.359 100.215C45.1354 97.8469 39.7361 94.1934 34.7704 89.2277C29.8052 84.2625 26.1519 78.8637 23.784 73.6406C23.7838 73.6405 23.7836 73.6405 23.7834 73.6404C22.4884 70.7839 21.5779 67.9798 21.0476 65.3279C20.7375 63.7776 20.5621 62.3309 20.5032 60.9865C17.9263 55.7471 15.9944 50.426 14.755 45.1665ZM4.33861 76.7002C4.71713 76.3217 5.11425 75.9686 5.52862 75.6407C6.7468 79.1965 8.35436 82.7444 10.3249 86.214C10.06 87.3833 10.0041 88.9848 10.4335 91.1319C11.2858 95.3936 13.9437 100.626 18.659 105.341C23.3743 110.056 28.6064 112.714 32.8681 113.567C35.0158 113.996 36.6176 113.94 37.787 113.675C41.2566 115.645 44.8043 117.252 48.36 118.47C48.0319 118.885 47.6786 119.283 47.2998 119.661C39.3909 127.57 23.3622 124.365 11.4988 112.501C-0.364596 100.638 -3.57033 84.6091 4.33861 76.7002ZM43.7198 80.2786C67.4466 104.005 99.5039 110.417 115.322 94.599C121.041 88.8798 123.854 81.0375 123.994 72.2337C124.239 56.6885 116.149 38.1454 101.001 22.9976C77.2746 -0.729192 45.2173 -7.14065 29.3994 8.67722C23.6725 14.4041 20.8595 22.2597 20.7271 31.078C20.4941 46.6158 28.5836 65.1423 43.7198 80.2786ZM77.1341 84.4888C77.5747 86.6917 77.7433 88.6853 77.6924 90.4738C68.7821 87.3724 59.3392 81.5782 50.88 73.119C42.4208 64.6598 36.6267 55.2171 33.5253 46.3068C35.3138 46.2559 37.3074 46.4245 39.5104 46.8651C47.0115 48.3653 55.7301 52.9069 63.4112 60.588C71.0923 68.2691 75.6339 76.9877 77.1341 84.4888ZM36.5596 15.8374C32.2725 20.1245 29.985 27.0976 31.1373 36.3235C43.2662 35.1444 58.3841 41.2404 70.5714 53.4278C82.7587 65.6151 88.8548 80.7329 87.6757 92.8617C96.9016 94.014 103.875 91.7265 108.162 87.4394C112.932 82.6694 115.226 74.5742 113.061 63.7503C110.913 53.0099 104.488 40.8048 93.8412 30.1578C83.1942 19.5108 70.9891 13.0857 60.2487 10.9376C49.4248 8.7728 41.3296 11.0674 36.5596 15.8374Z"
							fill="#e5e6e6"
						/>
					</svg>
				</div>
				<h1 className={css.sidebarTitle} style={{ flexGrow: 1 }}>
					Playground
				</h1>

				<DropdownMenu
					className={css.componentsDropdown}
					icon={<>Import</>}
					label="Import"
					toggleProps={{
						className: 'is-primary',
						style: { paddingLeft: 12, paddingRight: 12 },
					}}
					popoverProps={{
						placement: 'bottom-end',
					}}
				>
					{({ onClose }) => (
						<>
							<WordPressPRMenuItem
								onClose={onClose}
								disabled={offline}
							/>
							<GutenbergPRMenuItem
								onClose={onClose}
								disabled={offline}
							/>
							<GithubImportMenuItem
								onClose={onClose}
								disabled={offline}
							/>
							<RestoreFromZipMenuItem
								text="Playground export file (.zip)"
								onClose={onClose}
								disabled={false}
							/>
						</>
					)}
				</DropdownMenu>

				{mobileUi && (
					<Button
						className={css.closeButton}
						onClick={() => {
							if (temporarySite) {
								onSiteClick(temporarySite.slug);
								return;
							}
							redirectTo(PlaygroundRoute.newTemporarySite());
						}}
						icon={close}
						label="Close sidebar"
						showTooltip={true}
					/>
				)}
			</Flex>
			<nav className={classNames(css.sidebarSection, css.sidebarContent)}>
				<MenuGroup className={css.sidebarList}>
					<MenuItem
						className={classNames(css.sidebarItem, {
							[css.sidebarItemSelected]: isTemporarySiteSelected,
						})}
						onClick={() => {
							if (temporarySite) {
								onSiteClick(temporarySite.slug);
								return;
							}
							redirectTo(PlaygroundRoute.newTemporarySite());
						}}
						isSelected={isTemporarySiteSelected}
						// eslint-disable-next-line jsx-a11y/aria-role
						role=""
						title="This is a temporary Playground. Your changes will be lost on page refresh."
						{...(activeSite?.metadata.storage === 'none'
							? {
									'aria-current': 'page',
							  }
							: {})}
					>
						<HStack justify="flex-start" alignment="center">
							<Flex
								style={{
									width: 24,
								}}
								align="center"
								justify="center"
							>
								<ClockIcon className={css.sidebarItemLogo} />
							</Flex>
							<FlexBlock className={css.sidebarItemSiteName}>
								Temporary Playground
							</FlexBlock>
						</HStack>
					</MenuItem>
					<MenuItem
						className={classNames(css.sidebarItem, {
							[css.sidebarItemSelected]:
								activeSiteManagerSection === 'blueprints',
						})}
						onClick={() =>
							dispatch(setSiteManagerSection('blueprints'))
						}
						isSelected={activeSiteManagerSection === 'blueprints'}
					>
						<HStack justify="flex-start" alignment="center">
							<Flex
								style={{
									width: 24,
								}}
								align="center"
								justify="center"
							>
								<Icon
									icon={page}
									className={css.sidebarItemLogo}
								/>
							</Flex>
							<FlexBlock className={css.sidebarItemSiteName}>
								Blueprints Gallery
							</FlexBlock>
						</HStack>
					</MenuItem>
				</MenuGroup>
				{storedSites.length > 0 && (
					<>
						<Heading
							level="2"
							className={classNames(
								css.sidebarLabel,
								css.sidebarListLabel
							)}
						>
							Saved Playgrounds
						</Heading>
						<MenuGroup className={css.sidebarList}>
							{storedSites.map((site) => {
								/**
								 * The `wordpress` site is selected when no site slug is provided.
								 */
								const isSelected =
									site.slug === activeSite?.slug;
								return (
									<MenuItem
										key={site.slug}
										className={classNames(css.sidebarItem, {
											[css.sidebarItemSelected]:
												isSelected,
										})}
										onClick={() => onSiteClick(site.slug)}
										isSelected={isSelected}
										// eslint-disable-next-line jsx-a11y/aria-role
										role=""
										{...(isSelected
											? {
													'aria-current': 'page',
											  }
											: {})}
									>
										<HStack
											justify="flex-start"
											alignment="center"
										>
											<Flex
												style={{
													width: 24,
												}}
												align="center"
												justify="center"
											>
												{site.metadata.logo ? (
													<img
														src={getLogoDataURL(
															site.metadata.logo
														)}
														alt={
															site.metadata.name +
															' logo'
														}
														className={
															css.sidebarItemLogo
														}
													/>
												) : (
													<WordPressIcon
														className={
															css.sidebarItemLogo
														}
													/>
												)}
											</Flex>
											<FlexBlock
												className={
													css.sidebarItemSiteName
												}
											>
												{site.metadata.name}
											</FlexBlock>
										</HStack>
									</MenuItem>
								);
							})}
						</MenuGroup>
					</>
				)}
			</nav>
			<footer
				className={classNames(css.sidebarSection, css.sidebarFooter)}
			>
				<Heading level="2" className={css.sidebarLabel}>
					Resources
				</Heading>
				<ItemGroup className={css.sidebarList}>
					{resources.map((item) => (
						<Item
							key={item.href}
							as="a"
							rel="noreferrer"
							className={css.sidebarFooterLink}
							href={item.href}
							target="_blank"
						>
							{item.label} ↗
						</Item>
					))}
				</ItemGroup>
			</footer>
		</NavigableMenu>
	);
}
