import { useEffect, useRef, useState } from 'react';
import { Blueprint, startPlaygroundWeb } from '@wp-playground/client';
import type { PlaygroundClient } from '@wp-playground/client';
import { getRemoteUrl } from './config';
import { usePlaygroundContext } from '../playground-context';
import { logger } from '@php-wasm/logger';

interface UsePlaygroundOptions {
	blueprint?: Blueprint;
	storage?: 'browser' | 'device' | 'none';
}
export function usePlayground({ blueprint, storage }: UsePlaygroundOptions) {
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const iframe = iframeRef.current;
	const started = useRef(false);
	const [url, setUrl] = useState<string>();
	const [playground, setPlayground] = useState<PlaygroundClient>();
	const [awaitedIframe, setAwaitedIframe] = useState(false);
	const { setActiveModal } = usePlaygroundContext();

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

		const remoteUrl = getRemoteUrl();
		if (storage) {
			remoteUrl.searchParams.set('storage', storage);
		}

		let playgroundTmp: PlaygroundClient | undefined = undefined;
		startPlaygroundWeb({
			iframe,
			remoteUrl: remoteUrl.toString(),
			blueprint,
			// Intercept the Playground client even if the
			// Blueprint fails.
			onClientConnected: (playground) => {
				playgroundTmp = playground;
				(window as any)['playground'] = playground;
			},
		})
			.catch((error) => {
				logger.error(error);
				setActiveModal('log');
			})
			.finally(async () => {
				if (playgroundTmp) {
					playgroundTmp.onNavigation((url) => setUrl(url));
					setPlayground(() => playgroundTmp);
				}
			});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [iframe, awaitedIframe]);

	return { playground, url, iframeRef };
}
