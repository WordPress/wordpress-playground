import { SiteManagerSidebar } from './site-manager-sidebar';

import css from './style.module.css';

export function SiteManager({
	siteSlug,
	onSiteChange,
}: {
	siteSlug?: string;
	onSiteChange: (siteSlug?: string) => void;
}) {
	return (
		<div className={css.siteManager}>
			<SiteManagerSidebar
				className={css.siteManagerSidebar}
				onSiteChange={onSiteChange}
				siteSlug={siteSlug}
			/>
		</div>
	);
}
