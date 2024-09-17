import css from './style.module.css';
import classNames from 'classnames';
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
import {
	temporaryStorage,
	WordPressIcon,
} from '../../../../../components/src/icons';
import { type SiteLogo } from '../../../lib/site-storage';
import { SiteInfo } from '../../../lib/site-storage';
import { AddSiteButton } from '../add-site-button';

export function Sidebar({
	className,
	siteSlug,
	sites,
	onSiteClick,
	addSite,
}: {
	className?: string;
	siteSlug?: string;
	sites: SiteInfo[];
	onSiteClick: (siteSlug: string) => void;
	addSite: (name: string) => Promise<SiteInfo>;
}) {
	// Sites may be in an arbitrary order, so let's sort them by name.
	sites = sites
		.concat()
		.sort((a, b) =>
			a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
		);

	const onAddSite = async (name: string) => {
		const newSiteInfo = await addSite(name);
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
		<NavigableMenu className={classNames(css.sidebar, className)}>
			<header className={css.sidebarHeader}>
				{/* Remove Playground logo because branding isn't finalized. */}
				{/* <Logo className={css.sidebarLogoButton} /> */}
			</header>
			<nav className={classNames(css.sidebarSection, css.sidebarContent)}>
				<Heading
					level="6"
					className={classNames(
						css.sidebarLabel,
						css.sidebarListLabel
					)}
				>
					Your sites
				</Heading>
				<MenuGroup className={css.sidebarList}>
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
								className={classNames(css.sidebarItem, {
									[css.sidebarItemSelected]: isSelected,
								})}
								onClick={() => onSiteClick(site.slug)}
								isSelected={isSelected}
								role="menuitemradio"
								icon={
									site.storage === 'temporary' ||
									!site.storage ? (
										<temporaryStorage
											className={
												css.sidebarItemStorageIcon
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
											className={css.sidebarItemLogo}
										/>
									) : (
										<WordPressIcon
											className={css.sidebarItemLogo}
										/>
									)}
									<FlexBlock
										className={css.sidebarItemSiteName}
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
				className={classNames(css.sidebarSection, css.sidebarFooter)}
			>
				<Heading level="6" className={css.sidebarLabel}>
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
			<AddSiteButton onAddSite={onAddSite} sites={sites} />
		</NavigableMenu>
	);
}
