import { useEffect, useRef } from 'react';
import { startPlaygroundWeb } from '@wp-playground/client';
import {
	DEFAULT_URL_PREFIX,
	DEFAULT_WORKSPACE_DIR,
	DEFAULT_WP_REMOTE,
} from '../constants';
import { useAppDispatch, useAppSelector } from '../hooks';
import {
	applyUrlState,
	setBootError,
	setBootStatus,
	setClient,
	setWpVersion,
	setWpVersions,
	setWpVersionsLoading,
} from '../store';
import { setCurrentPath } from '../store';
import { loadStateFromURL, saveStateToURL } from '../url-state';
import { playgroundRuntime } from '../runtime';
import { logger } from '@php-wasm/logger';

export const PlaygroundManager = () => {
	const dispatch = useAppDispatch();
	const { code, phpVersion, wpVersion, runRequestId, client, initialized } =
		useAppSelector((state) => state.playground);

	const codeRef = useRef(code);
	const phpVersionRef = useRef(phpVersion);
	const wpVersionRef = useRef(wpVersion);
	const clientRef = useRef(client);
	const runCountRef = useRef(0);
	const bootPromiseRef = useRef<Promise<void>>(Promise.resolve());

	useEffect(() => {
		return () => {
			clientRef.current = null;
			playgroundRuntime.setClient(null);
			playgroundRuntime.setBootPromise(Promise.resolve());
		};
	}, []);

	useEffect(() => {
		codeRef.current = code;
	}, [code]);

	useEffect(() => {
		phpVersionRef.current = phpVersion;
	}, [phpVersion]);

	useEffect(() => {
		wpVersionRef.current = wpVersion;
	}, [wpVersion]);

	useEffect(() => {
		clientRef.current = client;
	}, [client]);

	function refreshStateFromUrl() {
		const state = loadStateFromURL();
		dispatch(
			applyUrlState({
				code: state.code,
				phpVersion: state.phpVersion,
				wpVersion: state.wpVersion,
			})
		);
	}

	useEffect(() => {
		if (!initialized) {
			refreshStateFromUrl();
		}
	}, [dispatch, initialized]);

	useEffect(() => {
		const handleHashChange = () => refreshStateFromUrl();
		window.addEventListener('hashchange', handleHashChange);
		return () => {
			window.removeEventListener('hashchange', handleHashChange);
		};
	}, [dispatch]);

	useEffect(() => {
		if (!initialized) {
			return;
		}
		const timeout = window.setTimeout(() => {
			saveStateToURL({
				code: codeRef.current,
				php: phpVersionRef.current,
				wp: wpVersionRef.current,
			});
		}, 500);
		return () => window.clearTimeout(timeout);
	}, [code, phpVersion, wpVersion, initialized]);

	useEffect(() => {
		if (!initialized) {
			return;
		}

		const previewIframe = document.getElementById(
			'preview'
		) as HTMLIFrameElement | null;
		if (!previewIframe) {
			return;
		}

		let cancelled = false;
		const boot = async () => {
			dispatch(setBootStatus('booting'));
			dispatch(setBootError(null));
			dispatch(setClient(null));
			clientRef.current = null;
			playgroundRuntime.setClient(null);
			dispatch(setWpVersionsLoading(true));
			runCountRef.current = 0;

			try {
				const clientInstance = await startPlaygroundWeb({
					iframe: previewIframe,
					remoteUrl: DEFAULT_WP_REMOTE,
					// blueprint: {
					// 	preferredVersions: {
					// 		wp: wpVersionRef.current,
					// 		php: phpVersionRef.current as any,
					// 	},
					// },
				});

				if (cancelled) {
					try {
						await (clientInstance as any).destroy();
					} catch {
						/** Ignore errors */
					}
					return;
				}

				try {
					const { all, latest } =
						await clientInstance.getMinifiedWordPressVersions();
					const versions = Object.keys(all);
					dispatch(setWpVersions(versions));
					if (!versions.includes(wpVersionRef.current)) {
						dispatch(setWpVersion(latest));
					}
				} catch (error) {
					logger.warn(
						'Failed to load WordPress versions list from client',
						error
					);
					dispatch(setWpVersionsLoading(false));
				}

				await clientInstance.isReady();
				if (cancelled) {
					try {
						await (clientInstance as any).destroy();
					} catch {
						// Ignore errors
					}
					return;
				}

				await clientInstance.mkdir(DEFAULT_WORKSPACE_DIR);
				await clientInstance.chdir(DEFAULT_WORKSPACE_DIR);
				const initialPath = `${DEFAULT_WORKSPACE_DIR}/code.php`;
				await clientInstance.writeFile(initialPath, codeRef.current);
				dispatch(setCurrentPath(initialPath));

				await clientInstance.goTo(`${DEFAULT_URL_PREFIX}/code.php`);

				clientRef.current = clientInstance;
				dispatch(setClient(clientInstance));
				playgroundRuntime.setClient(clientInstance);
				dispatch(setBootStatus('ready'));
			} catch (error: any) {
				const message = error?.message ?? String(error);
				dispatch(setBootStatus('error'));
				dispatch(setBootError(message));
				dispatch(setWpVersionsLoading(false));
			}
		};

		const promise = boot();
		bootPromiseRef.current = promise;
		playgroundRuntime.setBootPromise(promise);

		return () => {
			cancelled = true;
		};
	}, [dispatch, phpVersion, wpVersion, initialized]);

	const currentPath = useAppSelector((state) => state.playground.currentPath);

	useEffect(() => {
		if (!initialized) {
			return;
		}
		if (runRequestId === 0) {
			return;
		}

		const executeRun = async () => {
			await bootPromiseRef.current.catch(() => {});
			const currentClient = clientRef.current;
			if (!currentClient) {
				return;
			}
			runCountRef.current += 1;
			// Saving is handled by the editor, but for the default code.php file, we also
			// support manual save&run requests.
			// TODO: Investigate it for race conditions. Can we ever collide with the editor autosave?
			if (currentPath === `${DEFAULT_WORKSPACE_DIR}/code.php`) {
				await currentClient.writeFile(currentPath, codeRef.current);
				const cacheBuster = `run=${runCountRef.current}-${Date.now()}`;
				await currentClient.goTo(
					`${DEFAULT_URL_PREFIX}/code.php?${cacheBuster}`
				);
			}
		};

		void executeRun();
	}, [runRequestId, initialized, currentPath]);

	return null;
};
