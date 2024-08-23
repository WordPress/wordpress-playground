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
import { moreVertical, external } from '@wordpress/icons';

export function SiteInfoView({
	className,
	site,
}: {
	className: string;
	site: SiteInfo;
}) {
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
					<span className={css.siteManagerSiteInfoHeaderDetailsDate}>
						{site.whenCreated
							? `Created ${new Date(
									site.whenCreated
							  ).toLocaleString()}`
							: '--'}
					</span>
				</div>
				<div className={css.siteManagerSiteInfoHeaderActions}>
					<Button>WP Admin</Button>
					<Button>Open site</Button>
					<DropdownMenu
						icon={moreVertical}
						label="Select a direction"
						popoverProps={{
							placement: 'bottom-end',
						}}
					>
						{({ onClose }) => (
							<>
								<MenuGroup>
									<MenuItem icon={external} onClick={onClose}>
										Open site
									</MenuItem>
									<MenuItem icon={external} onClick={onClose}>
										WP Admin
									</MenuItem>
								</MenuGroup>
								<MenuGroup>
									<MenuItem onClick={onClose}>
										Duplicate
									</MenuItem>
									<MenuItem onClick={onClose}>Reset</MenuItem>
									<MenuItem onClick={onClose}>
										Delete
									</MenuItem>
								</MenuGroup>
								<MenuGroup>
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
								</MenuGroup>
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
