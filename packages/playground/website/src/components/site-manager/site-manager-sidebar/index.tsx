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
import type { SiteLogo, SiteInfo } from '../../../lib/site-storage';
import { AddSiteButton } from '../add-site-button';
import { LatestSupportedPHPVersion } from '@php-wasm/universal';
import { LatestSupportedWordPressVersion } from '@wp-playground/wordpress-builds';

function generateNewSiteFromName(name: string): SiteInfo {
	/**
	 * Ensure WordPress is capitalized correctly in the UI.
	 */
	name = name.replace(/wordpress/i, 'WordPress');

	/**
	 * Generate a slug from the site name.
	 * TODO: remove this when site storage is implemented.
	 * In site storage slugs will be generated automatically.
	 */
	const slug = name.toLowerCase().replaceAll(' ', '-');

	return {
		id: crypto.randomUUID(),
		slug,
		name,
		storage: 'opfs',
		wpVersion: LatestSupportedWordPressVersion,
		phpVersion: LatestSupportedPHPVersion,
		phpExtensionBundle: 'kitchen-sink',
	};
}

export function SiteManagerSidebar({
	className,
	siteSlug,
	onSiteClick,
}: {
	className?: string;
	siteSlug?: string;
	onSiteClick: (siteSlug?: string) => void;
}) {
	const sites = useSelector(
		(state: PlaygroundReduxState) => state.siteListing.sites
	);

	const addSite = (newName: string) => {
		const newSite = generateNewSiteFromName(newName);
		store.dispatch(addSiteToStore(newSite.slug, newSite));
		onSiteClick(newSite.slug);
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
				<Logo className={css.siteManagerSidebarLogoButton} />
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
