import { SiteManagerSidebar } from './site-manager-sidebar';

import css from './style.module.css';

export function SiteManager() {
	return (
		<div className={css.siteManager}>
			<SiteManagerSidebar className={css.siteManagerSidebar} />
		</div>
	);
}
