import { Blueprint } from '@wp-playground/blueprints';
import { StorageType } from '../../../types';

import css from './style.module.css';
import classNames from 'classnames';
import { useEffect, useState } from 'react';
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
import { AddSiteButton } from '../add-site-button';

// TODO: move types to site storage
// TODO: Explore better ways of obtaining site logos
type SiteLogo = {
	mime: string;
	data: string;
};
type Site = {
	slug: string;
	name: string;
	logo?: SiteLogo;
	blueprint?: Blueprint;
	storage?: StorageType;
};

export function SiteManagerSidebar({
	className,
	siteSlug,
	onSiteClick,
}: {
	className?: string;
	siteSlug?: string;
	onSiteClick: (siteSlug?: string) => void;
}) {
	const [sites, setSites] = useState<Site[]>([]);

	/**
	 * TODO: This is a temporary solution to get the sites from the OPFS.
	 * This will be removed when Site storage is implemented.
	 */
	useEffect(() => {
		const getVirtualOpfsRoot = async () => {
			const virtualOpfsRoot = await navigator.storage.getDirectory();
			const opfsSites: Site[] = [];
			for await (const entry of virtualOpfsRoot.values()) {
				if (entry.kind === 'directory') {
					/**
					 * Sites stored in browser storage are prefixed with "site-"
					 * so we need to remove the prefix to get the slug.
					 *
					 * The default site is stored in the `wordpress` directory
					 * and it doesn't have a prefix.
					 */
					const slug = entry.name.replace(/^site-/, '');
					let name = slug.charAt(0).toUpperCase() + slug.slice(1);
					/**
					 * Ensure WordPress is spelt correctly in the UI.
					 */
					if (slug === 'wordpress') {
						name = 'WordPress';
					}
					opfsSites.push({
						slug,
						name,
						storage: 'browser',
					});
				}
			}
			setSites(opfsSites);
		};
		getVirtualOpfsRoot();
	}, []);

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
						 * The default site is selected when no site slug provided.
						 *
						 * The default site is stored in the `wordpress` directory
						 * and that's used as the slug.
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
									site.storage === 'none' || !site.storage ? (
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
			<AddSiteButton onAddSite={onSiteClick} />
		</NavigableMenu>
	);
}
