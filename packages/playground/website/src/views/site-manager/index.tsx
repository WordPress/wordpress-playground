import { SiteManagerEditor } from '../../components/site-manager-editor';
import { SiteManagerSidebar } from '../../components/site-manager-sidebar';

import css from './style.module.css';

export function SiteManager({
	iframeRef,
	siteSlug,
}: {
	iframeRef: React.RefObject<HTMLIFrameElement>;
	siteSlug?: string;
}) {
	const onSiteChange = (siteSlug: string) => {
		const url = new URL(window.location.href);
		url.searchParams.set('site-slug', siteSlug);
		// Return back to site view
		url.searchParams.delete('site-manager');
		window.location.assign(url.toString());
	};

	return (
		<div className={css.siteManager}>
			<SiteManagerSidebar />
			<SiteManagerEditor
				iframeRef={iframeRef}
				siteSlug={siteSlug}
				onSiteChange={onSiteChange}
			/>
		</div>
	);
}
