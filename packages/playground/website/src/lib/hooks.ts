import { useCallback, useEffect, useRef, useState } from 'react';
import { Blueprint, startPlayground } from '@wp-playground/client';
import type { PlaygroundClient } from '@wp-playground/client';
import { remotePlaygroundOrigin } from './config';

export function useRerender() {
	const [, setTick] = useState(0);
	const tick = useCallback(() => {
		setTick((tick) => tick + 1);
	}, []);
	return tick;
}

interface UsePlaygroundOptions {
	blueprint?: Blueprint;
	php?: string;
	wp?: string;
}
export function usePlayground({ blueprint }: UsePlaygroundOptions) {
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

		startPlayground({
			iframe,
			remoteUrl: `${remotePlaygroundOrigin}/remote.html`,
			blueprint,
		}).then(async (playground) => {
			playground.onNavigation((url) => setUrl(url));
			setPlayground(() => playground);
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [iframe, awaitedIframe]);

	return { playground, url, iframeRef };
}
