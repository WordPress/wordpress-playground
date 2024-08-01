import classNames from 'classnames';
import { SiteManagerPreview } from '../site-manager-preview';

import css from './style.module.css';

export function SiteManagerEditor({
	className,
	iframeRef,
	siteSlug,
	onSiteChange,
}: {
	className?: string;
	iframeRef: React.RefObject<HTMLIFrameElement>;
	siteSlug?: string;
	onSiteChange?: (siteSlug?: string) => void;
}) {
	const onClick = () => {
		if (onSiteChange) {
			onSiteChange(siteSlug);
		}
	};
	return (
		<div className={classNames(css.siteManagerEditor, className)}>
			<SiteManagerPreview iframeRef={iframeRef} onClick={onClick} />
		</div>
	);
}
