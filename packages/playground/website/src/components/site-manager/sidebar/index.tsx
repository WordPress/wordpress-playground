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
import { useSearchParams } from '../../../lib/router-hooks';
import { __experimentalUseNavigator as useNavigator } from '@wordpress/components';
import { useMemo } from 'react';

export function Sidebar({ className }: { className?: string }) {
	const sitesRaw = useAppSelector(
		// Sites may be in an arbitrary order, so let's sort them by name
		// @TODO: Sort by last access date
		(state) => state.siteListing?.sites
	);
	const sites = useMemo(() => {
		return sitesRaw
			? sitesRaw.slice().sort((a, b) => a.name.localeCompare(b.name))
			: [];
	}, [sitesRaw]);
	const activeSite = useAppSelector((state) => state.activeSite!);

	const [, setQuery] = useSearchParams();

	// @TODO: Get rid of navigator
	const { goTo } = useNavigator();
	const onAddSite = async (name: string) => {
		setQuery({ 'site-slug': 'create', storage: 'opfs' });
		goTo('/manager/' + activeSite.slug);
	};

	const onSiteClick = (slug: string) => {
		setQuery({ 'site-slug': slug });
		goTo('/manager/' + slug);
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
									site.storage === 'none' || !site.storage ? (
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
