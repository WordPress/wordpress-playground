import { SiteManagerSidebar } from './site-manager-sidebar';

import css from './style.module.css';

export function SiteManager({
	iframeRef,
	siteSlug,
}: {
	iframeRef: React.RefObject<HTMLIFrameElement>;
	siteSlug?: string;
}) {
	const onSiteChange = (siteSlug?: string) => {
		const url = new URL(window.location.href);
		if (siteSlug) {
			url.searchParams.set('site-slug', siteSlug);
		} else {
			url.searchParams.delete('site-slug');
		}
		window.location.assign(url.toString());
	};

	return (
		<div className={css.siteManager}>
			<SiteManagerSidebar
				className={css.siteManagerSidebar}
				onSiteChange={onSiteChange}
			/>
		</div>
	);
}
