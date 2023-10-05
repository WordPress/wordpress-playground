import { useEffect, useRef, useState } from 'react';
import { Blueprint, startPlaygroundWeb } from '@wp-playground/client';
import type { PlaygroundClient } from '@wp-playground/client';
import { buildVersion } from './config';

interface UsePlaygroundOptions {
	blueprint?: Blueprint;
	storage?: 'opfs-host' | 'opfs-browser' | 'browser' | 'device' | 'temporary';
}
export function usePlayground({ blueprint, storage }: UsePlaygroundOptions) {
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const iframe = iframeRef.current;
	const started = useRef(false);
	const [url, setUrl] = useState<string>();
	const [playground, setPlayground] = useState<PlaygroundClient>();
	const [awaitedIframe, setAwaitedIframe] = useState(false);

	useEffect(() => {
		if (started.current) {
			return;
		}
		if (!iframe) {
			// Iframe ref is likely not set on the initial render.
			// Re-render the current component to start the playground.
			if (!awaitedIframe) {
				setAwaitedIframe(true);
			}
			return;
		}
		started.current = true;

		const remoteUrl = new URL(window.location.origin);
		remoteUrl.pathname = '/remote.html';
		remoteUrl.searchParams.set('v', buildVersion);
		if (storage) {
			remoteUrl.searchParams.set('storage', storage);
		}

		startPlaygroundWeb({
			iframe,
			remoteUrl: remoteUrl.toString(),
			blueprint,
		}).then(async (playground) => {
			playground.onNavigation((url) => setUrl(url));
			setPlayground(() => playground);
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [iframe, awaitedIframe]);

	return { playground, url, iframeRef };
}
