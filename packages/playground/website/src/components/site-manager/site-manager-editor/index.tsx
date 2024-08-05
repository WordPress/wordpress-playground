import classNames from 'classnames';

import css from './style.module.css';

export function SiteManagerEditor({
	className,
}: {
	className?: string;
	iframeRef: React.RefObject<HTMLIFrameElement>;
	siteSlug?: string;
	onSiteChange?: (siteSlug?: string) => void;
}) {
	return (
		<div className={classNames(css.siteManagerEditor, className)}>
			{/* TODO: Add site manager editor */}
		</div>
	);
}
