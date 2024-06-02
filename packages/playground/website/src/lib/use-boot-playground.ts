import { useEffect, useRef, useState } from 'react';
import { Blueprint, login, startPlaygroundWeb } from '@wp-playground/client';
import type { LoginStep, PlaygroundClient } from '@wp-playground/client';
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
			async onBeforeBlueprint(event) {
				const newDirectoryHandle = await directoryHandle;
				if (newDirectoryHandle) {
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
				}

				// When WordPress is loaded from an external source, we may want to
				// skip the Blueprint execution. Running the same Blueprint twice,
				// installing the same plugins, overwriting the files etc. would
				// just corrupt the WordPress instance.
				// @TODO Find a better of checking wheter the WordPress site was just installed,
				//       or are we bringing in an existing site that, presumably, a Blueprint
				//       has already acted on.
				//
				//       One way would be hooking into the beforeDatabaseSetup() hook in bootWordPress()
				//       in worker-thread.ts where the early bindOpfs() call is being made.
				//
				//		 Another would be passing the relevant DirectoryHandle from this function
				//       to startPlaygroundWeb and ever reasoning about it in the worker-thread.ts.
				//       This way we could do prior check to see whether we're bringing in an existing
				//       WordPress instance.
				//
				//	 	 Perhaps the best way would be to do both of the above – provide the DirectoryHandle,
				//       let the Boot protocol do its thing, and then, in the crucial moment, check whether
				//       a WordPress site is installed or not.
				//
				//       This would allow us to:
				//       * Not distinguish between browser storage and native filesystem storage.
				//       * Not rely on file-based flags that can be accidentally deleted.
				if (newDirectoryHandle || storage === 'browser') {
					const client = event.detail.playground;
					if (storage === 'browser') {
						// When files are stored in OPFS, we can keep track of the
						// Blueprint execution state by creating a flag file on
						// site install.
						const isLoadedFlagPath = joinPaths(
							await client.documentRoot,
							'.blueprint-loaded'
						);
						if (await client.fileExists(isLoadedFlagPath)) {
							event.preventDefault();
						} else {
							await client.writeFile(isLoadedFlagPath, '');
						}
					} else {
						// When the file come from a native filesystem directory,
						// let's always prevent the Blueprint execution. The only
						// way we can have that handle available at this stage is
						// if the user booted a WordPress site using the UI modal,
						// synchronized it to a local directory, and then reloaded
						// the page. This means the Blueprint was already executed
						// and we should skip it here.
						event.preventDefault();
					}
					if (event.defaultPrevented) {
						await skipBlueprint(client, event.detail.blueprint);
					}
				}
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

/**
 * Uses the login step and the landingPage of the Blueprint
 * when the rest of the execution is skipped.
 * @TODO: Provide a canonical method of doing this without
 *        reasoning about an uncompiled Blueprint structure
 *        or having to maintain this function when new Blueprint
 *        schema or ideas are shipped.
 */
async function skipBlueprint(
	playground: PlaygroundClient,
	blueprint: Blueprint
) {
	const loginStep =
		blueprint.login ||
		(blueprint.steps?.find(
			(step) => typeof step === 'object' && step?.step === 'login'
		) as LoginStep | undefined);
	if (loginStep) {
		await login(playground, typeof loginStep === 'object' ? loginStep : {});
	}
	if (blueprint?.landingPage) {
		await playground.goTo(blueprint.landingPage);
	}
}
