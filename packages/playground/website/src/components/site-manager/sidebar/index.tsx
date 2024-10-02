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
import {
	setActiveSite,
	useActiveSite,
	useAppDispatch,
	useAppSelector,
} from '../../../lib/state/redux/store';
import { SiteCreateButton } from '../site-create-button';
import { SiteLogo } from '../../../lib/site-metadata';
import { selectSortedSites } from '../../../lib/state/redux/slice-sites';

export function Sidebar({
	className,
	afterSiteClick,
}: {
	className?: string;
	afterSiteClick?: (slug: string) => void;
}) {
	const sites = useAppSelector(selectSortedSites);
	const activeSite = useActiveSite();
	const dispatch = useAppDispatch();

	const onSiteClick = (slug: string) => {
		dispatch(setActiveSite(slug));
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
		// Disable the `role` as Axe accessibility checker complains that a `menu`
		// role cannot have `div`, `nav`, `footer` and `button` as children.
		<NavigableMenu
			className={classNames(css.sidebar, className)}
			// eslint-disable-next-line jsx-a11y/aria-role
			role=""
			aria-orientation={undefined}
		>
			<h1 className="sr-only">WordPress Playground</h1>
			<div className={css.sidebarHeader}>
				{/* Remove Playground logo because branding isn't finalized. */}
				{/* <Logo className={css.sidebarLogoButton} /> */}
			</div>
			<nav className={classNames(css.sidebarSection, css.sidebarContent)}>
				<Heading
					level="2"
					className={classNames(
						css.sidebarLabel,
						css.sidebarListLabel
					)}
				>
					Your Playgrounds
				</Heading>
				<MenuGroup className={css.sidebarList}>
					{sites.map((site) => {
						/**
						 * The `wordpress` site is selected when no site slug is provided.
						 */
						const isSelected = site.slug === activeSite?.slug;
						return (
							<MenuItem
								key={site.slug}
								className={classNames(css.sidebarItem, {
									[css.sidebarItemSelected]: isSelected,
								})}
								onClick={() => onSiteClick(site.slug)}
								isSelected={isSelected}
								// eslint-disable-next-line jsx-a11y/aria-role
								role=""
								title={
									site.metadata.storage === 'opfs-temporary'
										? 'This is a temporary Playground. It will be archived after a page refresh and deleted after 24 hours.'
										: ''
								}
								icon={
									site.metadata.storage ===
									'opfs-temporary' ? (
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
			<SiteCreateButton>
				{(onClick) => (
					<div className={css.addSiteButtonWrapper}>
						<Button
							variant="primary"
							className={css.addSiteButtonButton}
							onClick={onClick}
						>
							Add Playground
						</Button>
					</div>
				)}
			</SiteCreateButton>
		</NavigableMenu>
	);
}
