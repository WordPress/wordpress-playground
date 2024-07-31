import { SiteManagerPreview } from '../site-manager-preview';

import css from './style.module.css';

export function SiteManagerEditor({
	iframeRef,
	siteSlug,
	onSiteChange,
}: {
	iframeRef: React.RefObject<HTMLIFrameElement>;
	siteSlug?: string;
	onSiteChange?: (siteSlug: string) => void;
}) {
	const onClick = () => {
		if (siteSlug && onSiteChange) {
			onSiteChange(siteSlug);
		}
	};
	return (
		<div className={css.siteManagerEditor}>
			<SiteManagerPreview iframeRef={iframeRef} onClick={onClick} />
		</div>
	);
}
