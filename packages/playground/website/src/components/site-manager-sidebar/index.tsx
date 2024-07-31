import css from './style.module.css';

export function SiteManagerSidebar() {
	const sites = [
		{
			slug: 'wordpress',
		},
		{
			slug: 'test',
		},
	];
	return (
		<div className={css.siteManagerSidebar}>
			<ul className={css.siteManagerSidebarList}>
				{sites.map((site) => (
					<li key={site.slug} className={css.siteManagerSidebarItem}>
						{site.slug}
					</li>
				))}
			</ul>
		</div>
	);
}
