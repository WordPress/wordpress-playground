import { JustViewport } from '../playground-viewport';
import css from './style.module.css';

export function SiteManagerPreview({
	iframeRef,
	onClick,
}: {
	iframeRef: React.RefObject<HTMLIFrameElement>;
	onClick: () => void;
}) {
	const onPreviewClick = (event: React.MouseEvent<HTMLDivElement>) => {
		event.preventDefault();
		event.stopPropagation();
		onClick();
	};

	return (
		<div className={css.siteManagerPreview}>
			<div
				onClick={onPreviewClick}
				className={css.siteManagerPreviewOverlay}
			/>
			<JustViewport iframeRef={iframeRef} />
		</div>
	);
}
