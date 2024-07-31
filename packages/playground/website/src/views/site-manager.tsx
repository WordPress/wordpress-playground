import { JustViewport } from '../components/playground-viewport';

export function SiteManager({
	iframeRef,
}: {
	iframeRef: React.RefObject<HTMLIFrameElement>;
}) {
	return <JustViewport iframeRef={iframeRef} />;
}
