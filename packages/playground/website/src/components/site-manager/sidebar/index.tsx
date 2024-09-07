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
import { TemporaryStorageIcon, WordPressIcon } from '../icons';
import { type SiteLogo } from '../../../lib/site-storage';
import { AddSiteButton } from '../add-site-button';
import { useAppSelector } from '../../../lib/redux-store';
import { useCurrentUrl } from '../../../lib/router-hooks';
import { useMemo } from 'react';

export function Sidebar({ className }: { className?: string }) {
	const sitesRaw = useAppSelector(
		// Sites may be in an arbitrary order, so let's sort them by name
		// @TODO: Sort by last access date
		(state) => state.siteListing?.sites
	);
	console.log('sites', sitesRaw);
	const sites = useMemo(() => {
		return sitesRaw
			? sitesRaw
					.slice()
					.sort((a, b) =>
						a.metadata.name.localeCompare(b.metadata.name)
					)
			: [];
	}, [sitesRaw]);
	const activeSite = useAppSelector((state) => state.activeSite!);

	const [, setUrlComponents] = useCurrentUrl();

	const onSiteClick = (slug: string) => {
		setUrlComponents({ searchParams: { 'site-slug': slug } });
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
						const isSelected = site.slug === activeSite.slug;
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
									site.metadata.storage === 'none' ||
									!site.metadata.storage ? (
										<TemporaryStorageIcon
											className={
												css.sidebarItemStorageIcon
											}
										/>
									) : undefined
								}
								iconPosition="right"
							>
								<HStack justify="flex-start" alignment="center">
									{site.metadata.logo ? (
										<img
											src={getLogoDataURL(
												site.metadata.logo
											)}
											alt={site.metadata.name + ' logo'}
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
										{site.metadata.name}
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
			<AddSiteButton />
		</NavigableMenu>
	);
}
