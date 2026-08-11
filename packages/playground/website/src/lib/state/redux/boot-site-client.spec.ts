// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { startPlaygroundWeb } from '@wp-playground/client';
import { loadDirectoryHandle } from '../opfs/opfs-directory-handle-storage';
import {
	legacyOpfsPathSymbol,
	opfsSiteStorage,
} from '../opfs/opfs-site-storage';
import { bootSiteClient } from './boot-site-client';
import reducer, { sitesSlice, type SiteInfo } from './slice-sites';
import type { PlaygroundReduxState } from './store';
import { logBlueprintEvents } from '../../tracking';
import { shouldShowGitHubAuthModal } from '../../../github/git-auth-helpers';
import { registerSiteFirstBootInitializer } from './site-first-boot-initializer';
import clientsReducer from './slice-clients';

vi.mock('@wp-playground/client', () => ({
	startPlaygroundWeb: vi.fn(),
}));

vi.mock('../opfs/opfs-directory-handle-storage', () => ({
	loadDirectoryHandle: vi.fn(),
}));

vi.mock('@php-wasm/web', () => ({
	setupPostMessageRelay: vi.fn(),
}));

vi.mock('virtual:cors-proxy-url', () => ({
	corsProxyUrl: 'https://playground.test/cors-proxy',
}));

vi.mock('../../config', () => ({
	getRemoteUrl: () => new URL('https://playground.test/remote.html'),
}));

vi.mock('../../tracking', () => ({
	logBlueprintEvents: vi.fn(),
	logTrackingEvent: vi.fn(),
}));

vi.mock('../../../github/git-auth-helpers', () => ({
	createGitAuthHeaders: vi.fn(() => undefined),
	shouldShowGitHubAuthModal: vi.fn(() => false),
}));

vi.mock('./store', () => ({
	selectActiveSite: vi.fn(),
	setActiveSite: vi.fn((slug: string | undefined) => ({
		type: 'ui/setActiveSite',
		payload: slug,
	})),
}));

vi.mock('../opfs/opfs-site-storage', () => ({
	getDirectoryPathForSlug: (slug: string) => `/sites/${slug}`,
	legacyOpfsPathSymbol: Symbol('legacyOpfsPath'),
	opfsSiteStorage: {
		removeWordPressFilesKeepMetadata: vi.fn(),
		update: vi.fn(),
	},
}));

vi.mock('@php-wasm/logger', () => ({
	logger: {
		error: vi.fn(),
		warn: vi.fn(),
	},
}));

describe('bootSiteClient', () => {
	beforeEach(() => {
		vi.mocked(loadDirectoryHandle).mockReset();
		vi.mocked(loadDirectoryHandle).mockResolvedValue({} as any);
		vi.mocked(startPlaygroundWeb).mockReset();
		vi.mocked(startPlaygroundWeb).mockImplementation(
			async (options: any) => {
				const playground = createPlaygroundClient();
				options.onClientConnected(playground);
				return playground;
			}
		);
		vi.mocked(shouldShowGitHubAuthModal).mockReset();
		vi.mocked(shouldShowGitHubAuthModal).mockReturnValue(false);
		vi.mocked(
			opfsSiteStorage!.removeWordPressFilesKeepMetadata
		).mockReset();
		vi.mocked(
			opfsSiteStorage!.removeWordPressFilesKeepMetadata
		).mockResolvedValue(undefined);
		vi.mocked(opfsSiteStorage!.update).mockReset();
		vi.mocked(opfsSiteStorage!.update).mockImplementation(
			async (slug, changes) => {
				const site = createSite(slug);
				const {
					runtimeConfiguration: runtimeConfigurationChanges,
					...metadataChanges
				} = changes.metadata ?? {};
				return {
					...site,
					metadata: {
						...site.metadata,
						...metadataChanges,
						...(runtimeConfigurationChanges
							? {
									runtimeConfiguration: {
										...site.metadata.runtimeConfiguration,
										...runtimeConfigurationChanges,
									},
								}
							: {}),
					},
				};
			}
		);
	});

	it('does not report a missing site after boot is aborted', async () => {
		const state = createState();
		const dispatch = createDispatch(state);
		const abortController = new AbortController();
		abortController.abort();

		await bootSiteClient('deleted-site', document.createElement('iframe'), {
			signal: abortController.signal,
		})(dispatch, () => state);

		expect(dispatch).not.toHaveBeenCalled();
	});

	it('finishes pending OPFS resets before booting the site', async () => {
		const site = createSite('autosaved', {
			loadedFromStorage: true,
			metadata: {
				initialOpfsSyncPending: true,
				opfsSiteRemovalPending: true,
			},
		});
		const state = createState(site);
		const dispatch = createDispatch(state);

		await bootSiteClient('autosaved', document.createElement('iframe'), {
			signal: new AbortController().signal,
		})(dispatch, () => state);

		expect(
			opfsSiteStorage!.removeWordPressFilesKeepMetadata
		).toHaveBeenCalledWith('autosaved');
		expect(
			vi.mocked(opfsSiteStorage!.removeWordPressFilesKeepMetadata).mock
				.invocationCallOrder[0]
		).toBeLessThan(
			vi.mocked(startPlaygroundWeb).mock.invocationCallOrder[0]
		);
		expect(opfsSiteStorage!.update).toHaveBeenCalledWith('autosaved', {
			metadata: expect.objectContaining({
				opfsSiteRemovalPending: undefined,
			}),
		});
		expect(startPlaygroundWeb).toHaveBeenCalled();
	});

	it('retries pending OPFS reset cleanup before booting', async () => {
		vi.useFakeTimers();
		const removalError = new Error('OPFS delete failed once');
		vi.mocked(
			opfsSiteStorage!.removeWordPressFilesKeepMetadata
		).mockRejectedValueOnce(removalError);
		const site = createSite('autosaved', {
			metadata: { opfsSiteRemovalPending: true },
		});
		const state = createState(site);
		const dispatch = createDispatch(state);

		try {
			const boot = bootSiteClient(
				'autosaved',
				document.createElement('iframe'),
				{
					signal: new AbortController().signal,
				}
			)(dispatch, () => state);
			await vi.runAllTimersAsync();
			await boot;
		} finally {
			vi.useRealTimers();
		}

		expect(
			opfsSiteStorage!.removeWordPressFilesKeepMetadata
		).toHaveBeenCalledTimes(2);
		expect(startPlaygroundWeb).toHaveBeenCalled();
		expect(
			dispatch.mock.calls.some((call: unknown[]) => {
				const action = call[0] as { type?: string };
				return action.type === 'ui/setActiveSiteError';
			})
		).toBe(false);
	});

	it('does not boot when a pending reset marker cannot be cleared', async () => {
		vi.useFakeTimers();
		const markerError = new Error('metadata write failed');
		vi.mocked(opfsSiteStorage!.update).mockRejectedValue(markerError);
		const site = createSite('autosaved', {
			metadata: { opfsSiteRemovalPending: true },
		});
		const state = createState(site);
		const dispatch = createDispatch(state);

		try {
			const boot = bootSiteClient(
				'autosaved',
				document.createElement('iframe'),
				{
					signal: new AbortController().signal,
				}
			)(dispatch, () => state);
			await vi.runAllTimersAsync();
			await boot;
		} finally {
			vi.useRealTimers();
		}

		expect(
			opfsSiteStorage!.removeWordPressFilesKeepMetadata
		).toHaveBeenCalledWith('autosaved');
		expect(startPlaygroundWeb).not.toHaveBeenCalled();
		expect(dispatch).toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'ui/setActiveSiteError',
				payload: expect.objectContaining({
					error: 'browser-storage-cleanup-failed',
				}),
			})
		);
	});

	it('does not boot when old autosaved WordPress files cannot be removed', async () => {
		vi.useFakeTimers();
		const removalError = new Error('OPFS delete failed');
		vi.mocked(
			opfsSiteStorage!.removeWordPressFilesKeepMetadata
		).mockRejectedValue(removalError);
		const site = createSite('autosaved', {
			metadata: { opfsSiteRemovalPending: true },
		});
		const state = createState(site);
		const dispatch = createDispatch(state);

		try {
			const boot = bootSiteClient(
				'autosaved',
				document.createElement('iframe'),
				{
					signal: new AbortController().signal,
				}
			)(dispatch, () => state);
			await vi.runAllTimersAsync();
			await boot;
		} finally {
			vi.useRealTimers();
		}

		expect(
			opfsSiteStorage!.removeWordPressFilesKeepMetadata
		).toHaveBeenCalledTimes(3);
		expect(startPlaygroundWeb).not.toHaveBeenCalled();
		expect(dispatch).toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'ui/setActiveSiteError',
				payload: expect.objectContaining({
					error: 'browser-storage-cleanup-failed',
				}),
			})
		);
	});

	it('does not boot a stored OPFS site whose first file sync was interrupted', async () => {
		const site = createSite('interrupted-save', {
			loadedFromStorage: true,
			metadata: { initialOpfsSyncPending: true },
		});
		const state = createState(site);
		const dispatch = createDispatch(state);

		await bootSiteClient(
			'interrupted-save',
			document.createElement('iframe'),
			{
				signal: new AbortController().signal,
			}
		)(dispatch, () => state);

		expect(startPlaygroundWeb).not.toHaveBeenCalled();
		expect(dispatch).toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'ui/setActiveSiteError',
				payload: expect.objectContaining({
					error: 'initial-opfs-sync-interrupted',
				}),
			})
		);
	});

	it('requires an explicit retry for an interrupted Blueprint run', async () => {
		const site = createSite('blueprint-run', {
			loadedFromStorage: true,
			metadata: {
				initialOpfsSyncPending: true,
				siteSlugToReturnToIfBlueprintFails: 'source-site',
			},
		});
		const state = createState(site);
		const dispatch = createDispatch(state);

		await bootSiteClient(
			'blueprint-run',
			document.createElement('iframe'),
			{ signal: new AbortController().signal }
		)(dispatch, () => state);

		expect(startPlaygroundWeb).not.toHaveBeenCalled();
		expect(
			opfsSiteStorage!.removeWordPressFilesKeepMetadata
		).not.toHaveBeenCalled();
		expect(dispatch).toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'ui/setActiveSiteError',
				payload: expect.objectContaining({
					error: 'initial-opfs-sync-interrupted',
				}),
			})
		);
		expect(
			state.sites.entities['blueprint-run'].metadata
				.siteSlugToReturnToIfBlueprintFails
		).toBe('source-site');
	});

	it('boots stored OPFS files based on Playground metadata, not WordPress file probes', async () => {
		const site = createSite('stored-save', { loadedFromStorage: true });
		const state = createState(site);
		const dispatch = createDispatch(state);

		await bootSiteClient('stored-save', document.createElement('iframe'), {
			signal: new AbortController().signal,
		})(dispatch, () => state);

		expect(startPlaygroundWeb).toHaveBeenCalledWith(
			expect.objectContaining({
				onBlueprintValidated: logBlueprintEvents,
				wordpressInstallMode: 'install-from-existing-files-if-needed',
				mounts: [
					expect.objectContaining({
						initialSyncDirection: 'opfs-to-memfs',
					}),
				],
			})
		);
	});

	it('reopens the current page after a runtime settings reboot', async () => {
		const playground = createPlaygroundClient({
			goTo: vi.fn(async () => undefined),
		});
		vi.mocked(startPlaygroundWeb).mockImplementationOnce(
			async (options: any) => {
				options.onClientConnected(playground);
				return playground;
			}
		);
		const site = createSite('stored-save', {
			loadedFromStorage: true,
			urlToRestoreAfterRuntimeSettingsChange:
				'/index.php?slashes=///#more/slashes',
		});
		const state = createState(site);
		const dispatch = createDispatch(state);

		await bootSiteClient('stored-save', document.createElement('iframe'), {
			signal: new AbortController().signal,
		})(dispatch, () => state);

		expect(playground.goTo).toHaveBeenCalledWith(
			'/index.php?slashes=///#more/slashes'
		);
		expect(
			state.sites.entities['stored-save']
				.urlToRestoreAfterRuntimeSettingsChange
		).toBeUndefined();
	});

	it.each([
		'https://example.com/wp-admin/',
		'//example.com/wp-admin/',
		'/\\example.com/wp-admin/',
	])('skips unsafe runtime settings restore URL %s', async (urlToRestore) => {
		const playground = createPlaygroundClient({
			goTo: vi.fn(async () => undefined),
		});
		vi.mocked(startPlaygroundWeb).mockImplementationOnce(
			async (options: any) => {
				options.onClientConnected(playground);
				return playground;
			}
		);
		const site = createSite('stored-save', {
			loadedFromStorage: true,
			urlToRestoreAfterRuntimeSettingsChange: urlToRestore,
		});
		const state = createState(site);
		const dispatch = createDispatch(state);

		await bootSiteClient('stored-save', document.createElement('iframe'), {
			signal: new AbortController().signal,
		})(dispatch, () => state);

		expect(playground.goTo).not.toHaveBeenCalled();
		expect(
			state.sites.entities['stored-save']
				.urlToRestoreAfterRuntimeSettingsChange
		).toBeUndefined();
	});

	it('mounts legacy OPFS directories from stored metadata', async () => {
		const site = createSite('stored-save', {
			loadedFromStorage: true,
			metadata: {
				[legacyOpfsPathSymbol]: '/sites/site-stored-save',
			} as Partial<SiteInfo['metadata']>,
		});
		const state = createState(site);
		const dispatch = createDispatch(state);

		await bootSiteClient('stored-save', document.createElement('iframe'), {
			signal: new AbortController().signal,
		})(dispatch, () => state);

		expect(startPlaygroundWeb).toHaveBeenCalledWith(
			expect.objectContaining({
				mounts: [
					expect.objectContaining({
						device: expect.objectContaining({
							path: '/sites/site-stored-save',
						}),
					}),
				],
			})
		);
	});

	it('boots local directories as existing saved sites', async () => {
		const site = createSite('local-save', {
			metadata: { storage: 'local-fs' },
		});
		const state = createState(site);
		const dispatch = createDispatch(state);

		await bootSiteClient('local-save', document.createElement('iframe'), {
			signal: new AbortController().signal,
		})(dispatch, () => state);

		expect(loadDirectoryHandle).toHaveBeenCalledWith('local-save');
		expect(startPlaygroundWeb).toHaveBeenCalledWith(
			expect.objectContaining({
				wordpressInstallMode: 'install-from-existing-files-if-needed',
			})
		);
	});

	it('replays live auto-login constants after a saved site finishes its initial OPFS copy', async () => {
		const firstPlayground = createPlaygroundClient({
			fileExists: vi.fn(async () => true),
			readFileAsText: vi.fn(async () =>
				JSON.stringify({
					PLAYGROUND_AUTO_LOGIN_AS_USER: 'admin',
				})
			),
		});
		vi.mocked(startPlaygroundWeb).mockImplementationOnce(
			async (options: any) => {
				options.onClientConnected(firstPlayground);
				return firstPlayground;
			}
		);
		const site = createSite('auto-login', {
			metadata: { initialOpfsSyncPending: true },
		});
		const state = createState(site);
		const dispatch = createDispatch(state);

		await bootSiteClient('auto-login', document.createElement('iframe'), {
			signal: new AbortController().signal,
		})(dispatch, () => state);
		await vi.waitFor(() =>
			expect(
				state.sites.entities['auto-login'].metadata
					.playgroundDefinedConstants
			).toEqual({
				PLAYGROUND_AUTO_LOGIN_AS_USER: 'admin',
			})
		);
		expect(opfsSiteStorage!.update).toHaveBeenCalledWith('auto-login', {
			metadata: expect.objectContaining({
				initialOpfsSyncPending: false,
				playgroundDefinedConstants: {
					PLAYGROUND_AUTO_LOGIN_AS_USER: 'admin',
				},
			}),
		});

		const reloadedSite = {
			...state.sites.entities['auto-login'],
			loadedFromStorage: true,
		};
		const reloadedState = createState(reloadedSite);
		await bootSiteClient('auto-login', document.createElement('iframe'), {
			signal: new AbortController().signal,
		})(createDispatch(reloadedState), () => reloadedState);

		expect(startPlaygroundWeb).toHaveBeenLastCalledWith(
			expect.objectContaining({
				blueprint: expect.objectContaining({
					constants: expect.objectContaining({
						PLAYGROUND_AUTO_LOGIN_AS_USER: 'admin',
					}),
				}),
			})
		);
	});

	it('keeps the initial OPFS copy pending when live constants cannot be read', async () => {
		const constantsError = new Error('Unable to read live constants');
		const playground = createPlaygroundClient({
			fileExists: vi.fn(async () => true),
			readFileAsText: vi.fn(async () => {
				throw constantsError;
			}),
		});
		vi.mocked(startPlaygroundWeb).mockImplementationOnce(
			async (options: any) => {
				options.onClientConnected(playground);
				return playground;
			}
		);
		const site = createSite('constants-read-failed', {
			metadata: { initialOpfsSyncPending: true },
		});
		const state = createState(site);
		const dispatch = createDispatch(state);

		await bootSiteClient(
			'constants-read-failed',
			document.createElement('iframe'),
			{ signal: new AbortController().signal }
		)(dispatch, () => state);
		await vi.waitFor(() =>
			expect(dispatch).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'clients/updateClientInfo',
					payload: expect.objectContaining({
						siteSlug: 'constants-read-failed',
						changes: {
							opfsSync: {
								status: 'error',
								operation: 'autosave',
							},
						},
					}),
				})
			)
		);

		expect(
			state.sites.entities['constants-read-failed'].metadata
				.initialOpfsSyncPending
		).toBe(true);
		expect(opfsSiteStorage!.update).not.toHaveBeenCalledWith(
			'constants-read-failed',
			{
				metadata: expect.objectContaining({
					initialOpfsSyncPending: false,
				}),
			}
		);
	});

	it('keeps the initial OPFS sync pending until the final flush succeeds', async () => {
		let resolveMount = () => {};
		const mountFinished = new Promise<void>((resolve) => {
			resolveMount = resolve;
		});
		let resolveFlush = () => {};
		const flushFinished = new Promise<void>((resolve) => {
			resolveFlush = resolve;
		});
		const playground = createPlaygroundClient({
			mountOpfs: vi.fn(() => mountFinished),
			flushOpfs: vi.fn(() => flushFinished),
		});
		vi.mocked(startPlaygroundWeb).mockImplementationOnce(
			async (options: any) => {
				options.onClientConnected(playground);
				return playground;
			}
		);
		const site = createSite('blueprint-run', {
			metadata: {
				initialOpfsSyncPending: true,
				siteSlugToReturnToIfBlueprintFails: 'source-site',
			},
		});
		const state = createState(site);
		const dispatch = createDispatch(state);

		await bootSiteClient(
			'blueprint-run',
			document.createElement('iframe'),
			{ signal: new AbortController().signal }
		)(dispatch, () => state);

		expect(
			state.sites.entities['blueprint-run'].metadata
				.siteSlugToReturnToIfBlueprintFails
		).toBe('source-site');
		resolveMount();
		await vi.waitFor(() =>
			expect(playground.flushOpfs).toHaveBeenCalledWith('/wordpress')
		);
		expect(
			state.sites.entities['blueprint-run'].metadata
				.siteSlugToReturnToIfBlueprintFails
		).toBe('source-site');
		expect(
			state.sites.entities['blueprint-run'].metadata
				.initialOpfsSyncPending
		).toBe(true);
		expect(state.clients.entities['blueprint-run']?.opfsSync?.status).toBe(
			'syncing'
		);
		resolveFlush();
		await vi.waitFor(() => {
			expect(
				state.sites.entities['blueprint-run'].metadata
					.siteSlugToReturnToIfBlueprintFails
			).toBeUndefined();
			expect(
				state.sites.entities['blueprint-run'].metadata
					.initialOpfsSyncPending
			).toBe(false);
			expect(
				state.clients.entities['blueprint-run']?.opfsSync
			).toBeUndefined();
		});
	});

	it('keeps Blueprint recovery behind private repository authentication', async () => {
		const authenticationError = Object.assign(
			new Error('GitHub authentication required'),
			{
				name: 'GitAuthenticationError',
				repoUrl: 'https://github.com/example/private-repository',
			}
		);
		vi.mocked(startPlaygroundWeb).mockRejectedValueOnce(
			authenticationError
		);
		vi.mocked(shouldShowGitHubAuthModal).mockReturnValueOnce(true);
		const site = createSite('blueprint-run', {
			metadata: { siteSlugToReturnToIfBlueprintFails: 'source-site' },
		});
		const state = createState(site);
		const dispatch = createDispatch(state);

		await bootSiteClient(
			'blueprint-run',
			document.createElement('iframe'),
			{ signal: new AbortController().signal }
		)(dispatch, () => state);

		const actions: Array<{ type?: string; payload?: unknown }> =
			dispatch.mock.calls.map(
				([action]: [unknown]) =>
					action as { type?: string; payload?: unknown }
			);
		const errorIndex = actions.findIndex(
			(action) => action.type === 'ui/setActiveSiteError'
		);
		const authModalIndex = actions.findIndex(
			(action) => action.type === 'ui/setActiveModal'
		);
		expect(actions[errorIndex]).toEqual(
			expect.objectContaining({
				payload: expect.objectContaining({
					error: 'site-boot-failed',
					details: expect.objectContaining({
						name: 'GitAuthenticationError',
						message: 'GitHub authentication required',
					}),
				}),
			})
		);
		expect(actions[authModalIndex]).toEqual(
			expect.objectContaining({ payload: 'github-private-repo-auth' })
		);
		expect(errorIndex).toBeLessThan(authModalIndex);
	});

	it('classifies a worker resource-unavailable error', async () => {
		const unavailableError = Object.assign(
			new Error('WordPress 6.8 is not available for download.'),
			{ originalErrorClassName: 'ResourceUnavailableError' }
		);
		vi.mocked(startPlaygroundWeb).mockRejectedValueOnce(unavailableError);
		const site = createSite('unavailable-version');
		const state = createState(site);
		const dispatch = createDispatch(state);

		await bootSiteClient(
			'unavailable-version',
			document.createElement('iframe'),
			{ signal: new AbortController().signal }
		)(dispatch, () => state);

		expect(dispatch).toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'ui/setActiveSiteError',
				payload: expect.objectContaining({
					error: 'resource-unavailable',
				}),
			})
		);
	});

	it('does not add client info when iframe boot finishes after abort', async () => {
		let resolveStart = () => {};
		const startFinished = new Promise<void>((resolve) => {
			resolveStart = resolve;
		});
		vi.mocked(startPlaygroundWeb).mockImplementationOnce(
			async (options: any) => {
				await startFinished;
				options.onClientConnected(createPlaygroundClient());
				return createPlaygroundClient();
			}
		);
		const site = createSite('stale-iframe', { loadedFromStorage: true });
		const state = createState(site);
		const dispatch = createDispatch(state);
		const abortController = new AbortController();

		const boot = bootSiteClient(
			'stale-iframe',
			document.createElement('iframe'),
			{
				signal: abortController.signal,
			}
		)(dispatch, () => state);
		await Promise.resolve();
		await Promise.resolve();
		expect(startPlaygroundWeb).toHaveBeenCalled();

		abortController.abort();
		resolveStart();
		await boot;

		expect(
			dispatch.mock.calls.some((call: unknown[]) => {
				const action = call[0] as { type?: string };
				return action.type === 'clients/addClientInfo';
			})
		).toBe(false);
	});

	it('does not mutate Redux from an aborted initial OPFS sync', async () => {
		let reportProgress: ((progress: unknown) => void) | undefined;
		let resolveMount = () => {};
		const mountFinished = new Promise<void>((resolve) => {
			resolveMount = resolve;
		});
		const playground = createPlaygroundClient({
			mountOpfs: vi.fn(async (_descriptor, onProgress) => {
				reportProgress = onProgress;
				await mountFinished;
			}),
		});
		vi.mocked(startPlaygroundWeb).mockImplementationOnce(
			async (options: any) => {
				options.onClientConnected(playground);
				return playground;
			}
		);
		const site = createSite('initial-sync', {
			metadata: { initialOpfsSyncPending: true },
		});
		const state = createState(site);
		const dispatch = createDispatch(state);
		const abortController = new AbortController();

		await bootSiteClient('initial-sync', document.createElement('iframe'), {
			signal: abortController.signal,
		})(dispatch, () => state);

		abortController.abort();
		const actionCountAfterAbort = dispatch.mock.calls.length;
		reportProgress?.({} as any);
		resolveMount();
		await Promise.resolve();
		await Promise.resolve();

		expect(dispatch.mock.calls.length).toBe(actionCountAfterAbort);
		expect(opfsSiteStorage!.update).not.toHaveBeenCalledWith(
			'initial-sync',
			{
				metadata: expect.objectContaining({
					initialOpfsSyncPending: false,
				}),
			}
		);
	});

	it('does not capture a thumbnail after the initial OPFS copy fails', async () => {
		let rejectMount!: (error: Error) => void;
		const mountFinished = new Promise<void>((_, reject) => {
			rejectMount = reject;
		});
		const playground = createPlaygroundClient({
			mountOpfs: vi.fn(() => mountFinished),
			captureSiteThumbnail: vi.fn(),
		});
		vi.mocked(startPlaygroundWeb).mockImplementationOnce(
			async (options: any) => {
				options.onClientConnected(playground);
				return playground;
			}
		);
		const site = createSite('initial-sync', {
			metadata: { initialOpfsSyncPending: true },
		});
		const state = createState(site);
		const dispatch = createDispatch(state);

		await bootSiteClient('initial-sync', document.createElement('iframe'), {
			signal: new AbortController().signal,
		})(dispatch, () => state);

		// Another tab may clear this flag while this copy is still running.
		// Thumbnail capture must follow this copy's result, not shared metadata.
		dispatch(
			sitesSlice.actions.updateSite({
				id: 'initial-sync',
				changes: {
					metadata: {
						...state.sites.entities['initial-sync'].metadata,
						initialOpfsSyncPending: false,
					},
				},
			})
		);
		rejectMount(new Error('OPFS copy failed'));
		await vi.waitFor(() =>
			expect(dispatch).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'clients/updateClientInfo',
					payload: expect.objectContaining({
						changes: expect.objectContaining({
							opfsSync: expect.objectContaining({
								status: 'error',
							}),
						}),
					}),
				})
			)
		);

		expect(playground.captureSiteThumbnail).not.toHaveBeenCalled();
	});

	it('runs a first-boot initializer before the initial OPFS copy', async () => {
		const calls: string[] = [];
		const playground = createPlaygroundClient({
			mountOpfs: vi.fn(async () => {
				calls.push('copy to OPFS');
			}),
		});
		vi.mocked(startPlaygroundWeb).mockImplementationOnce(
			async (options: any) => {
				options.onClientConnected(playground);
				return playground;
			}
		);
		const site = createSite('zip-import', {
			metadata: { initialOpfsSyncPending: true },
		});
		const state = createState(site);
		const dispatch = createDispatch(state);
		const initialization = registerSiteFirstBootInitializer(
			'zip-import',
			async () => {
				calls.push('import ZIP');
			}
		);

		await bootSiteClient('zip-import', document.createElement('iframe'), {
			signal: new AbortController().signal,
		})(dispatch, () => state);
		await initialization.finished;
		await vi.waitFor(() => expect(calls).toHaveLength(2));

		expect(calls).toEqual(['import ZIP', 'copy to OPFS']);
	});
});

function createDispatch(state: PlaygroundReduxState) {
	const dispatch = vi.fn((action: unknown) => {
		if (typeof action === 'function') {
			return action(dispatch, () => state);
		}
		const reduxAction = action as { type?: string };
		if (reduxAction.type?.startsWith('sites/')) {
			state.sites = reducer(state.sites, action as any);
		}
		if (reduxAction.type?.startsWith('clients/')) {
			state.clients = clientsReducer(state.clients, action as any);
		}
		return action;
	}) as any;
	return dispatch;
}

function createState(...sites: SiteInfo[]): PlaygroundReduxState {
	let sitesState = reducer(undefined, { type: 'init' });
	for (const site of sites) {
		sitesState = reducer(sitesState, sitesSlice.actions.addSite(site));
	}
	return {
		sites: sitesState,
		clients: clientsReducer(undefined, { type: 'init' }),
		ui: {
			activeSite: sites[0] ? { slug: sites[0].slug } : undefined,
		},
	} as PlaygroundReduxState;
}

function createSite(
	slug: string,
	options: {
		loadedFromStorage?: boolean;
		urlToRestoreAfterRuntimeSettingsChange?: string;
		metadata?: Partial<SiteInfo['metadata']>;
	} = {}
): SiteInfo {
	return {
		slug,
		loadedFromStorage: options.loadedFromStorage,
		urlToRestoreAfterRuntimeSettingsChange:
			options.urlToRestoreAfterRuntimeSettingsChange,
		metadata: {
			id: slug,
			name: slug,
			storage: 'opfs',
			persistence: 'autosave',
			originalBlueprint: {},
			originalBlueprintSource: { type: 'none' },
			runtimeConfiguration: {
				phpVersion: '8.3',
				wpVersion: 'latest',
				intl: false,
				networking: true,
				extraLibraries: [],
				constants: {},
			},
			...options.metadata,
		},
	};
}

function createPlaygroundClient(overrides: Record<string, unknown> = {}): any {
	return {
		fileExists: vi.fn(async () => false),
		mountOpfs: vi.fn(async () => undefined),
		flushOpfs: vi.fn(async () => undefined),
		onNavigation: vi.fn(),
		...overrides,
	};
}
