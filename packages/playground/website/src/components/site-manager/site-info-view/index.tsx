import classNames from 'classnames';
import css from './style.module.css';
import { SiteInfo } from '../../../lib/site-storage';
import { getLogoDataURL, WordPressIcon } from '../icons';
import {
	Button,
	DropdownMenu,
	MenuGroup,
	MenuItem,
} from '@wordpress/components';
import { moreVertical } from '@wordpress/icons';

export function SiteInfoView({
	className,
	site,
	removeSite,
}: {
	className: string;
	site: SiteInfo;
	removeSite: (site: SiteInfo) => Promise<void>;
}) {
	const removeSiteAndCloseMenu = async (onClose: () => void) => {
		// TODO: Replace with HTML-based dialog
		const proceed = window.confirm(
			`Are you sure you want to delete the site '${site.name}'?`
		);
		if (proceed) {
			await removeSite(site);
			onClose();
		}
	};

	return (
		<section className={classNames(className, css.siteManagerSiteInfo)}>
			<header className={css.siteManagerSiteInfoHeader}>
				<div className={css.siteManagerSiteInfoHeaderIcon}>
					{site.logo ? (
						<img
							src={getLogoDataURL(site.logo)}
							alt={site.name + ' logo'}
						/>
					) : (
						<WordPressIcon
							className={css.siteManagerSiteInfoHeaderIconDefault}
						/>
					)}
				</div>
				<div className={css.siteManagerSiteInfoHeaderDetails}>
					<h1 className={css.siteManagerSiteInfoHeaderDetailsName}>
						{site.name}
					</h1>
					<span
						className={
							css.siteManagerSiteInfoHeaderDetailsCreatedAt
						}
					>
						{site.whenCreated
							? `Created ${new Date(
									site.whenCreated
							  ).toLocaleString()}`
							: '--'}
					</span>
				</div>
				<div className={css.siteManagerSiteInfoHeaderActions}>
					{/* TODO: Find how to specify classes on WP component Buttons. They don't seem to be applying. */}
					<Button
						className={css.sieManagerSiteInfoHeaderActionsWpAdmin}
					>
						WP Admin
					</Button>
					<Button className={css.sieManagerSiteInfoHeaderActionsOpen}>
						Open site
					</Button>
					<DropdownMenu
						icon={moreVertical}
						label="Select a direction"
						popoverProps={{
							placement: 'bottom-end',
						}}
					>
						{({ onClose }) => (
							<>
								{/* <MenuGroup>
									<MenuItem icon={external} onClick={onClose}>
										Open site
									</MenuItem>
									<MenuItem icon={external} onClick={onClose}>
										WP Admin
									</MenuItem>
								</MenuGroup> */}
								<MenuGroup>
									{/* <MenuItem onClick={onClose}>
										Duplicate
									</MenuItem>
									<MenuItem onClick={onClose}>Reset</MenuItem> */}
									<MenuItem
										onClick={() =>
											removeSiteAndCloseMenu(onClose)
										}
										// Avoid deleting the default WordPress site
										disabled={site.slug === 'wordpress'}
									>
										Delete
									</MenuItem>
								</MenuGroup>
								{/* <MenuGroup>
									<MenuItem onClick={onClose}>
										Download as .zip
									</MenuItem>
									<MenuItem onClick={onClose}>
										Restore from .zip
									</MenuItem>
								</MenuGroup>
								<MenuGroup>
									<MenuItem onClick={onClose}>
										Share feedback
									</MenuItem>
								</MenuGroup> */}
							</>
						)}
					</DropdownMenu>
				</div>
			</header>
			<section className={css.siteManagerSiteInfoSection}>
				<header className={css.siteManagerSiteInfoSectionTitle}>
					Site details
				</header>
				<div className={css.siteManagerSiteInfoSectionRow}>
					<div className={css.siteManagerSiteInfoSectionRowLabel}>
						Name:
					</div>
					<div className={css.siteManagerSiteInfoSectionRowValue}>
						{site.name}
					</div>
				</div>
				<div className={css.siteManagerSiteInfoSectionRow}>
					<div className={css.siteManagerSiteInfoSectionRowLabel}>
						Storage:
					</div>
					<div className={css.siteManagerSiteInfoSectionRowValue}>
						{site.storage}
					</div>
				</div>
				<div className={css.siteManagerSiteInfoSectionRow}>
					<div className={css.siteManagerSiteInfoSectionRowLabel}>
						WordPress version:
					</div>
					<div className={css.siteManagerSiteInfoSectionRowValue}>
						{site.wpVersion}
					</div>
				</div>
				<div className={css.siteManagerSiteInfoSectionRow}>
					<div className={css.siteManagerSiteInfoSectionRowLabel}>
						PHP version:
					</div>
					<div className={css.siteManagerSiteInfoSectionRowValue}>
						{site.phpVersion}
					</div>
				</div>
				<div className={css.siteManagerSiteInfoSectionRow}>
					<div className={css.siteManagerSiteInfoSectionRowLabel}>
						Network access:
					</div>
					<div className={css.siteManagerSiteInfoSectionRowValue}>
						TODO
					</div>
				</div>
			</section>
		</section>
	);
}
