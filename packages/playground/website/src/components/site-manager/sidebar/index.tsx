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
	Button,
} from '@wordpress/components';
import { TemporaryStorageIcon, WordPressIcon } from '../icons';
import { type SiteLogo } from '../../../lib/site-storage';
import { useActiveSite, useAppSelector } from '../../../lib/redux-store';
import { useCurrentUrl } from '../../../lib/router-hooks';
import { useMemo } from 'react';
import { SiteCreateButton } from '../site-create-button';

export function Sidebar({
	className,
	afterSiteClick,
}: {
	className?: string;
	afterSiteClick?: (slug: string) => void;
}) {
	const sitesRaw = useAppSelector(
		// Sites may be in an arbitrary order, so let's sort them by name
		// @TODO: Sort by last access date
		(state) => state.siteListing?.sites
	);
	const sites = useMemo(() => {
		return sitesRaw
			? sitesRaw
					.slice()
					.sort(
						(a, b) =>
							(a.metadata.whenCreated || 0) -
							(b.metadata.whenCreated || 0)
					)
			: [];
	}, [sitesRaw]);
	const activeSite = useActiveSite()!;

	const [, setUrlComponents] = useCurrentUrl();

	const onSiteClick = (slug: string) => {
		const site = sites.find((site) => site.slug === slug);
		if (site?.originalUrlParams) {
			setUrlComponents(site.originalUrlParams);
		} else {
			setUrlComponents({ searchParams: { 'site-slug': slug } });
		}
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
								title={
									site.metadata.storage === 'none'
										? 'This is a temporary site. Your changes will be lost when the site is reset.'
										: ''
								}
								icon={
									site.metadata.storage === 'none' ? (
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
			<SiteCreateButton>
				{(onClick) => (
					<div className={css.addSiteButtonWrapper}>
						<Button
							variant="primary"
							className={css.addSiteButtonButton}
							onClick={onClick}
						>
							Add site
						</Button>
					</div>
				)}
			</SiteCreateButton>
		</NavigableMenu>
	);
}
