import { useEffect, useRef, useState } from 'react';
import { Blueprint, startPlaygroundWeb } from '@wp-playground/client';
import type { PlaygroundClient } from '@wp-playground/client';
import { getRemoteUrl } from './config';
import { logger } from '@php-wasm/logger';
import { PlaygroundDispatch, setActiveModal } from './redux-store';
import { useDispatch } from 'react-redux';
import { directoryHandle } from './markdown-directory-handle';
import { joinPaths } from '@php-wasm/util';

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
	const started = useRef<string | undefined>(undefined);
	const [url, setUrl] = useState<string>();
	const [playground, setPlayground] = useState<PlaygroundClient>();
	const [awaitedIframe, setAwaitedIframe] = useState(false);
	const dispatch: PlaygroundDispatch = useDispatch();

	useEffect(() => {
		const remoteUrl = getRemoteUrl();
		console.log('remoteUrl', remoteUrl.toString(), started.current);
		if (started.current === remoteUrl.toString()) {
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

		if (storage) {
			remoteUrl.searchParams.set('storage', storage);
		}

		started.current = remoteUrl.toString();

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
				const newDirectoryHandle = await directoryHandle;
				if (!newDirectoryHandle) {
					return;
				}
				await playgroundTmp!.bindOpfs({
					opfs: newDirectoryHandle,
					mountpoint: joinPaths(
						await playgroundTmp!.documentRoot,
						'wp-content',
						'uploads',
						'markdown'
					),
					initialSyncDirection: 'opfs-to-memfs',
				});
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
	}, [iframe, awaitedIframe, directoryHandle, siteSlug]);

	return { playground, url, iframeRef };
}
