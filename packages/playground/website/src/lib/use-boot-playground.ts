import { useEffect, useRef, useState } from 'react';
import { Blueprint, startPlaygroundWeb } from '@wp-playground/client';
import type { PlaygroundClient } from '@wp-playground/client';
import { getRemoteUrl } from './config';
import { logger } from '@php-wasm/logger';
import { PlaygroundDispatch, setActiveModal } from './redux-store';
import { useDispatch } from 'react-redux';
import { directoryHandle } from './markdown-directory-handle';

interface UsePlaygroundOptions {
	blueprint?: Blueprint;
	storage?: 'browser' | 'device' | 'none';
	siteSlug?: string;
}
export function useBootPlayground({
	blueprint,
	storage,
	siteSlug,
}: UsePlaygroundOptions) {
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const iframe = iframeRef.current;
	const started = useRef(false);
	const [url, setUrl] = useState<string>();
	const [playground, setPlayground] = useState<PlaygroundClient>();
	const [awaitedIframe, setAwaitedIframe] = useState(false);
	const dispatch: PlaygroundDispatch = useDispatch();

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
			siteSlug,
			// Intercept the Playground client even if the
			// Blueprint fails.
			onClientConnected: (playground) => {
				playgroundTmp = playground;
				(window as any)['playground'] = playground;
			},
			async onBeforeBlueprint() {
				// @TODO this never resolves if there are no modals
				let newDirectoryHandle: FileSystemDirectoryHandle;
				try {
					newDirectoryHandle = await directoryHandle;
				} catch {
					return;
				}
				await playgroundTmp!.bindOpfs(newDirectoryHandle);
			},
		})
			.catch((error) => {
				logger.error(error);
				dispatch(setActiveModal('start-error'));
			})
			.finally(async () => {
				if (playgroundTmp) {
					playgroundTmp.onNavigation((url) => setUrl(url));
					setPlayground(() => playgroundTmp);
				}
			});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [iframe, awaitedIframe, directoryHandle]);

	return { playground, url, iframeRef };
}
