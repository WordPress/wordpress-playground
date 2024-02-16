import { useEffect, useRef, useState } from 'react';
import { Blueprint, startPlaygroundWeb } from '@wp-playground/client';
import type { PlaygroundClient } from '@wp-playground/client';
import { getRemoteUrl } from './config';
import { LogSeverity, get_logger } from './logger';
import { PHPRequestEndEvent } from '@php-wasm/universal/src/lib/universal-php';

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

		const logger = get_logger();
		startPlaygroundWeb({
			iframe,
			remoteUrl: remoteUrl.toString(),
			blueprint,
		}).then(async (playground) => {
			playground.onNavigation((url) => setUrl(url));
			playground.addEventListener('request.end', (event) => {
				event = event as PHPRequestEndEvent;
				if (event.data && event.data.log) {
					logger.logRaw(event?.data.log);
				}
			} );
			setPlayground(() => playground);
		}).catch((error) => {
			logger.log(error, LogSeverity.Fatal);
		} );
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [iframe, awaitedIframe]);

	return { playground, url, iframeRef };
}
