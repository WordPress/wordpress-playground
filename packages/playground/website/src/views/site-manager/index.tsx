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
		console.log(siteSlug);
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
