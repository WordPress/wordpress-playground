import css from './style.module.css';
import classNames from 'classnames';
import { useSelector } from 'react-redux';
import {
	__experimentalHeading as Heading,
	NavigableMenu,
	MenuGroup,
	MenuItem,
	__experimentalHStack as HStack,
	FlexBlock,
	__experimentalItemGroup as ItemGroup,
	__experimentalItem as Item,
} from '@wordpress/components';
import { Logo, TemporaryStorageIcon, WordPressIcon } from '../icons';
import store, {
	PlaygroundReduxState,
	addSite as addSiteToStore,
} from '../../../lib/redux-store';
import { type SiteLogo, createNewSiteInfo } from '../../../lib/site-storage';
import { AddSiteButton } from '../add-site-button';
import { LatestSupportedPHPVersion } from '@php-wasm/universal';
import { LatestMinifiedWordPressVersion } from '@wp-playground/wordpress-builds';

export function SiteManagerSidebar({
	className,
	siteSlug,
	onSiteClick,
}: {
	className?: string;
	siteSlug?: string;
	onSiteClick: (siteSlug: string) => void;
}) {
	const unsortedSites = useSelector(
		(state: PlaygroundReduxState) => state.siteListing.sites
	);
	const sites = unsortedSites
		.concat()
		.sort((a, b) =>
			a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
		);

	const addSite = async (name: string) => {
		const newSiteInfo = createNewSiteInfo({
			name,
			storage: 'opfs',
			wpVersion: LatestMinifiedWordPressVersion,
			phpVersion: LatestSupportedPHPVersion,
			phpExtensionBundle: 'kitchen-sink',
		});
		await store.dispatch(addSiteToStore(newSiteInfo));
		onSiteClick(newSiteInfo.slug);
	};

	const resources = [
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

	return (
		<NavigableMenu
			className={classNames(css.siteManagerSidebar, className)}
		>
			<header className={css.siteManagerSidebarHeader}>
				{/* Remove Playground logo because branding isn't finalized. */}
				{/* <Logo className={css.siteManagerSidebarLogoButton} /> */}
			</header>
			<nav
				className={classNames(
					css.siteManagerSidebarSection,
					css.siteManagerSidebarContent
				)}
			>
				<Heading
					level="6"
					className={classNames(
						css.siteManagerSidebarLabel,
						css.siteManagerSidebarListLabel
					)}
				>
					Your sites
				</Heading>
				<MenuGroup className={css.siteManagerSidebarList}>
					{sites.map((site) => {
						/**
						 * The `wordpress` site is selected when no site slug is provided.
						 */
						const isSelected =
							site.slug === siteSlug ||
							(siteSlug === undefined &&
								site.slug === 'wordpress');
						return (
							<MenuItem
								key={site.slug}
								className={classNames(
									css.siteManagerSidebarItem,
									{
										[css.siteManagerSidebarItemSelected]:
											isSelected,
									}
								)}
								onClick={() => onSiteClick(site.slug)}
								isSelected={isSelected}
								role="menuitemradio"
								icon={
									site.storage === 'temporary' ||
									!site.storage ? (
										<TemporaryStorageIcon
											className={
												css.siteManagerSidebarItemStorageIcon
											}
										/>
									) : undefined
								}
								iconPosition="right"
							>
								<HStack justify="flex-start" alignment="center">
									{site.logo ? (
										<img
											src={getLogoDataURL(site.logo)}
											alt={site.name + ' logo'}
											className={
												css.siteManagerSidebarItemLogo
											}
										/>
									) : (
										<WordPressIcon
											className={
												css.siteManagerSidebarItemLogo
											}
										/>
									)}
									<FlexBlock
										className={
											css.siteManagerSidebarItemSiteName
										}
									>
										{site.name}
									</FlexBlock>
								</HStack>
							</MenuItem>
						);
					})}
				</MenuGroup>
			</nav>
			<footer
				className={classNames(
					css.siteManagerSidebarSection,
					css.siteManagerSidebarFooter
				)}
			>
				<Heading level="6" className={css.siteManagerSidebarLabel}>
					Resources
				</Heading>
				<ItemGroup className={css.siteManagerSidebarList}>
					{resources.map((item) => (
						<Item
							key={item.href}
							as="a"
							rel="noreferrer"
							className={css.siteManagerSidebarFooterLink}
							href={item.href}
							target="_blank"
						>
							{item.label} ↗
						</Item>
					))}
				</ItemGroup>
			</footer>
			<AddSiteButton onAddSite={addSite} sites={sites} />
		</NavigableMenu>
	);
}
