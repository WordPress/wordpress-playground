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
import {
	createSiteBootAbortController,
	getCurrentSiteBootSignal,
} from '../site-runtime-lock';

const storedSites = vi.hoisted(() => new Map<string, SiteInfo>());

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
	blueprintBundleLoadErrorSymbol: Symbol('blueprintBundleLoadError'),
	getDirectoryPathForSlug: (slug: string) => `/sites/${slug}`,
	legacyOpfsPathSymbol: Symbol('legacyOpfsPath'),
	opfsSiteStorage: {
		read: vi.fn(async (slug: string) => storedSites.get(slug)),
		removeWordPressFilesKeepMetadata: vi.fn(),
		update: vi.fn(),
	},
}));

vi.mock('@php-wasm/logger', () => ({
	logger: {
		error: vi.fn(),
	},
}));

describe('bootSiteClient', () => {
	beforeEach(() => {
		storedSites.clear();
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
		vi.mocked(
			opfsSiteStorage!.removeWordPressFilesKeepMetadata
		).mockReset();
		vi.mocked(
			opfsSiteStorage!.removeWordPressFilesKeepMetadata
		).mockResolvedValue(undefined);
		vi.mocked(opfsSiteStorage!.update).mockReset();
		vi.mocked(opfsSiteStorage!.update).mockImplementation(
			async (slug, metadata, originalUrlParams) => {
				const existing = storedSites.get(slug);
				if (existing) {
					storedSites.set(slug, {
						...existing,
						metadata,
						originalUrlParams,
					});
				}
			}
		);
		vi.mocked(opfsSiteStorage!.read).mockReset();
		vi.mocked(opfsSiteStorage!.read).mockImplementation(async (slug) =>
			storedSites.get(slug)
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
		).toHaveBeenCalledWith('autosaved', undefined);
		expect(
			vi.mocked(opfsSiteStorage!.removeWordPressFilesKeepMetadata).mock
				.invocationCallOrder[0]
		).toBeLessThan(
			vi.mocked(startPlaygroundWeb).mock.invocationCallOrder[0]
		);
		expect(opfsSiteStorage!.update).toHaveBeenCalledWith(
			'autosaved',
			expect.objectContaining({ opfsSiteRemovalPending: undefined }),
			undefined
		);
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
		).toHaveBeenCalledWith('autosaved', undefined);
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

	it('boots stored OPFS files based on Playground metadata, not WordPress file probes', async () => {
		const site = createSite('stored-save', { loadedFromStorage: true });
		const state = createState(site);
		const dispatch = createDispatch(state);

		await bootSiteClient('stored-save', document.createElement('iframe'), {
			signal: new AbortController().signal,
		})(dispatch, () => state);

		expect(startPlaygroundWeb).toHaveBeenCalledWith(
			expect.objectContaining({
				wordpressInstallMode: 'install-from-existing-files-if-needed',
				mounts: [
					expect.objectContaining({
						initialSyncDirection: 'opfs-to-memfs',
					}),
				],
			})
		);
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
		await vi.waitFor(() => {
			expect(startPlaygroundWeb).toHaveBeenCalled();
		});

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

	it('does not abort a replacement boot when a stale metadata read settles', async () => {
		const site = createSite('replaced-boot');
		const state = createState(site);
		const dispatch = createDispatch(state);
		let resolveRead = (_site: SiteInfo | undefined) => {};
		vi.mocked(opfsSiteStorage!.read).mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolveRead = resolve;
				})
		);
		const staleBoot = createSiteBootAbortController(site.slug);
		const boot = bootSiteClient(
			site.slug,
			document.createElement('iframe'),
			{ signal: staleBoot.signal }
		)(dispatch, () => state);
		await vi.waitFor(() => {
			expect(opfsSiteStorage!.read).toHaveBeenCalledWith(site.slug);
		});

		const replacementBoot = createSiteBootAbortController(site.slug);
		resolveRead(site);
		await boot;

		expect(staleBoot.signal.aborted).toBe(true);
		expect(replacementBoot.signal.aborted).toBe(false);
		expect(getCurrentSiteBootSignal(site.slug)).toBe(
			replacementBoot.signal
		);
		expect(startPlaygroundWeb).not.toHaveBeenCalled();
		replacementBoot.abort();
	});

	it.each([
		[
			'startup rejects',
			async () => Promise.reject(new Error('boot failed')),
		],
		['startup returns no client', async () => undefined],
	])('releases the runtime lease when %s', async (_label, start) => {
		const originalLocks = Object.getOwnPropertyDescriptor(
			navigator,
			'locks'
		);
		let activeLocks = 0;
		Object.defineProperty(navigator, 'locks', {
			configurable: true,
			value: {
				request: vi.fn(
					async (
						_name: string,
						optionsOrCallback: unknown | (() => Promise<unknown>),
						callback?: () => Promise<unknown>
					) => {
						const lockCallback =
							typeof optionsOrCallback === 'function'
								? optionsOrCallback
								: callback!;
						activeLocks++;
						try {
							return await lockCallback();
						} finally {
							activeLocks--;
						}
					}
				),
			},
		});
		try {
			vi.mocked(startPlaygroundWeb).mockImplementationOnce(start as any);
			const site = createSite('failed-runtime');
			const state = createState(site);
			const controller = createSiteBootAbortController(site.slug);

			await bootSiteClient(site.slug, document.createElement('iframe'), {
				signal: controller.signal,
			})(createDispatch(state), () => state);
			await Promise.resolve();

			expect(activeLocks).toBe(0);
			expect(controller.signal.aborted).toBe(true);
		} finally {
			if (originalLocks) {
				Object.defineProperty(navigator, 'locks', originalLocks);
			} else {
				Reflect.deleteProperty(navigator, 'locks');
			}
		}
	});

	it('detaches a connected client before releasing a failed boot lease', async () => {
		const originalLocks = Object.getOwnPropertyDescriptor(
			navigator,
			'locks'
		);
		let activeLocks = 0;
		Object.defineProperty(navigator, 'locks', {
			configurable: true,
			value: {
				request: vi.fn(
					async (
						_name: string,
						optionsOrCallback: unknown | (() => Promise<unknown>),
						callback?: () => Promise<unknown>
					) => {
						const lockCallback =
							typeof optionsOrCallback === 'function'
								? optionsOrCallback
								: callback!;
						activeLocks++;
						try {
							return await lockCallback();
						} finally {
							activeLocks--;
						}
					}
				),
			},
		});
		const connectedClient = createPlaygroundClient({
			unmountOpfs: vi.fn(async () => undefined),
		});
		vi.mocked(startPlaygroundWeb).mockImplementationOnce(
			async (options: any) => {
				options.onClientConnected(connectedClient);
				throw new Error('Blueprint failed after connection');
			}
		);
		try {
			const site = createSite('connected-failure');
			const state = createState(site);
			const controller = createSiteBootAbortController(site.slug);
			const iframe = document.createElement('iframe');
			document.body.append(iframe);

			await bootSiteClient(site.slug, iframe, {
				signal: controller.signal,
			})(createDispatch(state), () => state);
			expect(connectedClient.unmountOpfs).toHaveBeenCalledWith(
				'/wordpress'
			);
			expect(iframe.isConnected).toBe(false);
			expect(activeLocks).toBe(0);
			expect(controller.signal.aborted).toBe(true);
		} finally {
			if (originalLocks) {
				Object.defineProperty(navigator, 'locks', originalLocks);
			} else {
				Reflect.deleteProperty(navigator, 'locks');
			}
		}
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
			expect.objectContaining({ initialOpfsSyncPending: false }),
			undefined
		);
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
		ui: {
			activeSite: sites[0] ? { slug: sites[0].slug } : undefined,
		},
	} as PlaygroundReduxState;
}

function createSite(
	slug: string,
	options: {
		loadedFromStorage?: boolean;
		metadata?: Partial<SiteInfo['metadata']>;
	} = {}
): SiteInfo {
	const site: SiteInfo = {
		slug,
		loadedFromStorage: options.loadedFromStorage,
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
	storedSites.set(slug, site);
	return site;
}

function createPlaygroundClient(overrides: Record<string, unknown> = {}): any {
	return {
		flushOpfs: vi.fn(async () => undefined),
		mountOpfs: vi.fn(async () => undefined),
		onNavigation: vi.fn(),
		...overrides,
	};
}
