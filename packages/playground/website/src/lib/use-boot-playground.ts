import { useEffect, useRef, useState } from 'react';
import { Blueprint, startPlaygroundWeb } from '@wp-playground/client';
import type { PlaygroundClient } from '@wp-playground/client';
import { getRemoteUrl } from './config';
import { logger } from '@php-wasm/logger';
import {
	PlaygroundDispatch,
	PlaygroundReduxState,
	setActiveModal,
} from './redux-store';
import { useDispatch, useSelector } from 'react-redux';
import { playgroundAvailableInOpfs } from '../components/playground-configuration-group/playground-available-in-opfs';
import { directoryHandleFromMountDevice } from '@wp-playground/storage';

interface UsePlaygroundOptions {
	blueprint?: Blueprint;
}
export function useBootPlayground({ blueprint }: UsePlaygroundOptions) {
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const iframe = iframeRef.current;
	const started = useRef<string | undefined>(undefined);
	const [url, setUrl] = useState<string>();
	const mountDescriptor = useSelector(
		(state: PlaygroundReduxState) => state.opfsMountDescriptor
	);
	const [playground, setPlayground] = useState<PlaygroundClient>();
	const [awaitedIframe, setAwaitedIframe] = useState(false);
	const dispatch: PlaygroundDispatch = useDispatch();

	useEffect(() => {
		const remoteUrl = getRemoteUrl();
		if (!iframe) {
			// Iframe ref is likely not set on the initial render.
			// Re-render the current component to start the playground.
			if (!awaitedIframe) {
				setAwaitedIframe(true);
			}
			return;
		}

		async function doRun() {
			started.current = remoteUrl.toString();

			let isWordPressInstalled = false;
			if (mountDescriptor) {
				isWordPressInstalled = await playgroundAvailableInOpfs(
					await directoryHandleFromMountDevice(mountDescriptor.device)
				);
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
					mounts: mountDescriptor
						? [
								{
									...mountDescriptor,
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
	}, [iframe, awaitedIframe, mountDescriptor]);

	return { playground, url, iframeRef };
}
