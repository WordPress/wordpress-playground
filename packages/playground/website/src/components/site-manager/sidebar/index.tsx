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
import { ClockIcon, WordPressIcon } from '../icons';
import {
	setActiveSite,
	useActiveSite,
	useAppDispatch,
	useAppSelector,
} from '../../../lib/state/redux/store';
import { SiteLogo } from '../../../lib/site-metadata';
import {
	selectSortedSites,
	selectTemporarySite,
} from '../../../lib/state/redux/slice-sites';
import { PlaygroundRoute, redirectTo } from '../../../lib/state/url/router';

export function Sidebar({
	className,
	afterSiteClick,
}: {
	className?: string;
	afterSiteClick?: (slug: string) => void;
}) {
	const storedSites = useAppSelector(selectSortedSites).filter(
		(site) => site.metadata.storage !== 'none'
	);
	const temporarySite = useAppSelector(selectTemporarySite);
	console.log('temporarySite', temporarySite);
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
				<MenuGroup className={css.sidebarList}>
					<MenuItem
						className={classNames(css.sidebarItem, {
							[css.sidebarItemSelected]:
								activeSite?.metadata.storage === 'none',
						})}
						onClick={() => {
							console.log('on click', { temporarySite });
							if (temporarySite) {
								onSiteClick(temporarySite.slug);
								return;
							}
							redirectTo(PlaygroundRoute.newTemporarySite());
						}}
						isSelected={activeSite?.metadata.storage === 'none'}
						// eslint-disable-next-line jsx-a11y/aria-role
						role=""
						title="This is a temporary Playground. Your changes will be lost on page refresh."
					>
						<HStack justify="flex-start" alignment="center">
							<ClockIcon className={css.sidebarItemLogo} />
							<FlexBlock className={css.sidebarItemSiteName}>
								Temporary Playground
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
									>
										<HStack
											justify="flex-start"
											alignment="center"
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
