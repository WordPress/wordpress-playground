import { useEffect, useRef, useState } from 'react';
import { Blueprint, startPlaygroundWeb } from '@wp-playground/client';
import type { PlaygroundClient } from '@wp-playground/client';
import { getRemoteUrl } from './config';
import { logger } from '@php-wasm/logger';
import { PlaygroundDispatch, setActiveModal } from './redux-store';
import { useDispatch } from 'react-redux';
import { directoryHandle } from './directory-handle';

interface UsePlaygroundOptions {
	blueprint?: Blueprint;
}
export function useBootPlayground({ blueprint }: UsePlaygroundOptions) {
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

		async function doRun() {
			const resolvedDirectoryHandle = await directoryHandle;

			let isWordPressInstalled = false;
			if (resolvedDirectoryHandle) {
				try {
					await resolvedDirectoryHandle?.handle.getFileHandle(
						'wp-settings.php'
					);
					isWordPressInstalled = true;
				} catch (error) {
					// No WordPress.
				}
			}

			let playgroundTmp: PlaygroundClient | undefined = undefined;
			try {
				await startPlaygroundWeb({
					iframe: iframe!,
					remoteUrl: getRemoteUrl().toString(),
					blueprint,
					// Intercept the Playground client even if the
					// Blueprint fails.
					onClientConnected: (playground) => {
						playgroundTmp = playground;
						(window as any)['playground'] = playground;
					},
					mounts: resolvedDirectoryHandle
						? [
								{
									...resolvedDirectoryHandle,
									initialSyncDirection: 'opfs-to-memfs',
								},
						  ]
						: [],
					shouldInstallWordPress: !isWordPressInstalled,
				});
			} catch (error) {
				logger.error(error);
				dispatch(setActiveModal('start-error'));
			} finally {
				if (playgroundTmp) {
					(playgroundTmp as PlaygroundClient).onNavigation(
						(url: string) => setUrl(url)
					);
					setPlayground(() => playgroundTmp);
				}
			}
		}
		doRun();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [iframe, awaitedIframe, directoryHandle]);

	return { playground, url, iframeRef };
}
