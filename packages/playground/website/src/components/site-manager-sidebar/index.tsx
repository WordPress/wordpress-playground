import { Blueprint } from '@wp-playground/blueprints';
import { StorageType } from '../../types';

import css from './style.module.css';
import classNames from 'classnames';
import { useEffect, useState } from 'react';

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
	onSiteChange,
}: {
	className?: string;
	onSiteChange: (siteSlug?: string) => void;
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
					const name = entry.name.replace(/^site-/, '');
					opfsSites.push({
						slug: name,
						name: name.toUpperCase(),
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

	const getLogoDataURL = (logo?: SiteLogo): string => {
		if (!logo) {
			return getLogoDataURL({
				mime: 'image/png',
				data: 'iVBORw0KGgoAAAANSUhEUgAAABQAAAAVCAYAAABG1c6oAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAALFSURBVHgBlVVLaxpRFL6OLpLdJIssko0kixQSqJAHNCilC6UbJf0H7T/IRhE3mo0Iumh/QV27SapLhVZ84EKpBXWnDC6kuPCB+ABRe76LZ5hYE9oPxpl7zz3f+c45915N4gUEAgHbcrnEY11PVS0WixYOh6vP+Zi2Tfp8vuDu7u4dEamHh4dif39fzvd6PdHpdMRsNtNoeB+NRuMvEvr9futisXg4Pj62uVwuQe9t8US5XBbpdFr0+33NbDa/i0Qi2l+Ea7KfTqdTpUf8C5LJpMjn8xp9fiC1sgyKgez7/5DV63WplGCl5yEUCqkYWPBDZEGqlXVvb48XicvLS6mA6iUwj/d0OpVlgA2EmFvDOplMvkKpGepWq1V8NBrJRSg6mnByciLa7bacw4Nv4PT0VBwcHEhyzAPUQEG1fHV9fZ1VSN3d2dmZ2NnZkcajoyPBaePtdrv1NLEGazkDY9MwpkxuUcPXFxcXcgJoNpsyOgNKOVir1XpiYx/YQT4cDt+C0IYUz8/PpREOlUpFd0I67AgYbQgGoMbIjEpnBaEKJ0SAAajVasIIQ/Gf2FitIaAKwsFmCkgNzWGgDAzYaEPLb14DpWvyAQg1drDb7bojd5CdjA3grQXydTPksSRUQZhlJ04doBOgq4MCHEUG25A+Z9VoNPD6pVAhH1ForgdvC4yhAGp4i3C3YUskEroAqAM57cXPSiwW+0ELHnHYuY7siDk0hFUbu41A3OVMJoN1cVwS8izP5/NPhUJBwyJExZVlTJfBW4uBjZ/L5bCVcOvcY86Mn1KpNLu5uclSHd7TUL26utIL7/F49O2EN4Kgy6w6lUoNiOwNX2FmjlYsFn87HI5v5HBL8tVutysJQGgEyPjEkIDqs/ehEV6v96PJZApi50PJ5o2tKMpgPB5/ofqHNn23EhqI5f8JqbBhTAE0elX5Mt2GP/1pl0TWF7M6AAAAAElFTkSuQmCC',
			});
		}
		return `data:${logo.mime};base64,${logo.data}`;
	};

	const onLogoClick = () => {
		onSiteChange();
	};

	return (
		<aside className={classNames(css.siteManagerSidebar, className)}>
			<header className={css.siteManagerSidebarHeader}>
				{/* TODO move logo to components */}
				<button
					className={css.siteManagerSidebarLogoButton}
					onClick={onLogoClick}
				>
					{/* TODO: move logo to component package */}
					<svg
						width="32"
						height="32"
						viewBox="0 0 32 32"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<rect
							width="10.4176"
							height="10.4176"
							rx="3.86258"
							transform="matrix(0.829038 -0.559193 0.838671 0.544639 7.45703 24.1775)"
							stroke="white"
							strokeWidth="0.965644"
						/>
						<rect
							width="13.2346"
							height="13.2346"
							rx="3.86258"
							transform="matrix(0.829038 -0.559193 0.838671 0.544639 5.0918 18.9934)"
							stroke="white"
							strokeWidth="1.44847"
						/>
						<rect
							width="17.451"
							height="17.451"
							rx="3.86258"
							transform="matrix(0.829038 -0.559193 0.838671 0.544639 1.55371 11.6099)"
							stroke="white"
							strokeWidth="1.93129"
						/>
					</svg>
				</button>
			</header>
			<div
				className={classNames(
					css.siteManagerSidebarSection,
					css.siteManagerSidebarContent
				)}
			>
				<h2 className={css.siteManagerSidebarSubtitle}>
					WordPress Playground
				</h2>
				<label
					className={classNames(
						css.siteManagerSidebarLabel,
						css.siteManagerSidebarListLabel
					)}
					htmlFor="site-list"
				>
					Your sites
				</label>
				<ul id="site-list" className={css.siteManagerSidebarList}>
					{sites.map((site) => (
						<li
							key={site.slug}
							className={css.siteManagerSidebarItem}
						>
							<button
								className={css.siteManagerSidebarItemButton}
								onClick={() => onSiteChange(site.slug)}
							>
								<img
									src={getLogoDataURL(site.logo)}
									alt="Site logo"
									className={css.siteManagerSidebarItemLogo}
								/>
								<span
									className={
										css.siteManagerSidebarItemSiteName
									}
								>
									{site.name}
								</span>
								{(site.storage === 'none' || !site.storage) && (
									<span
										className={
											css.siteManagerSidebarItemStorageIcon
										}
										title="No storage"
									>
										{/* TODO: move icon to component package */}
										<svg
											width="16"
											height="17"
											viewBox="0 0 16 17"
											fill="none"
											xmlns="http://www.w3.org/2000/svg"
										>
											<path
												fillRule="evenodd"
												clipRule="evenodd"
												d="M8 15C4.41015 15 1.5 12.0899 1.5 8.5C1.5 4.91015 4.41015 2 8 2C11.5899 2 14.5 4.91015 14.5 8.5C14.5 12.0899 11.5899 15 8 15ZM0 8.5C0 4.08172 3.58172 0.5 8 0.5C12.4183 0.5 16 4.08172 16 8.5C16 12.9183 12.4183 16.5 8 16.5C3.58172 16.5 0 12.9183 0 8.5ZM9 9.5V4.5H7.5V8H5.5V9.5H9Z"
												fill="#949494"
											/>
										</svg>
									</span>
								)}
							</button>
						</li>
					))}
				</ul>
			</div>
			<footer
				className={classNames(
					css.siteManagerSidebarSection,
					css.siteManagerSidebarFooter
				)}
			>
				<label
					className={css.siteManagerSidebarLabel}
					htmlFor="site-manager-sidebar-footer-resources"
				>
					Respources
				</label>
				<ul
					className={css.siteManagerSidebarList}
					id="site-manager-sidebar-footer-resources"
				>
					{resources.map((item) => (
						<li key={item.href}>
							<a
								target="_blank"
								rel="noreferrer"
								className={css.siteManagerSidebarFooterLink}
								href={item.href}
							>
								{item.label} ↗
							</a>
						</li>
					))}
				</ul>
			</footer>
		</aside>
	);
}
