// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { directoryHandleFromMountDevice } from '@wp-playground/storage';
import { startPlaygroundWeb } from '@wp-playground/client';
import { storedDirectoryHasPlaygroundFiles } from './wordpress-core-file-check';
import { opfsSiteStorage } from '../opfs/opfs-site-storage';
import { bootSiteClient } from './boot-site-client';
import reducer, { sitesSlice, type SiteInfo } from './slice-sites';
import type { PlaygroundReduxState } from './store';
import { shouldShowGitHubAuthModal } from '../../../github/git-auth-helpers';

vi.mock('@wp-playground/storage', () => ({
	directoryHandleFromMountDevice: vi.fn(),
}));

vi.mock('@wp-playground/client', () => ({
	startPlaygroundWeb: vi.fn(),
}));

vi.mock('@php-wasm/web', () => ({
	setupPostMessageRelay: vi.fn(),
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

vi.mock('./wordpress-core-file-check', () => ({
	isFileSystemPermissionError: vi.fn(() => false),
	isMissingFileSystemEntryError: vi.fn(() => false),
	storedDirectoryHasPlaygroundFiles: vi.fn(),
	storedDirectoryHasWordPressCoreFiles: vi.fn(),
}));

vi.mock('./store', () => ({
	selectActiveSite: vi.fn(),
	setActiveSite: vi.fn((slug: string | undefined) => ({
		type: 'ui/setActiveSite',
		payload: slug,
	})),
}));

vi.mock('../opfs/opfs-site-storage', () => ({
	getDirectoryPathForSite: (site: SiteInfo) => `/sites/${site.slug}`,
	opfsSiteStorage: {
		resetSiteFiles: vi.fn(),
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
		vi.mocked(directoryHandleFromMountDevice).mockReset();
		vi.mocked(directoryHandleFromMountDevice).mockResolvedValue({} as any);
		vi.mocked(storedDirectoryHasPlaygroundFiles).mockReset();
		vi.mocked(storedDirectoryHasPlaygroundFiles).mockResolvedValue(false);
		vi.mocked(shouldShowGitHubAuthModal).mockReset();
		vi.mocked(shouldShowGitHubAuthModal).mockReturnValue(false);
		vi.mocked(startPlaygroundWeb).mockReset();
		vi.mocked(startPlaygroundWeb).mockImplementation(
			async (options: any) => {
				const playground = {
					onNavigation: vi.fn(),
				} as any;
				options.onClientConnected(playground);
				return playground;
			}
		);
		vi.mocked(opfsSiteStorage!.resetSiteFiles).mockReset();
		vi.mocked(opfsSiteStorage!.resetSiteFiles).mockResolvedValue(undefined);
		vi.mocked(opfsSiteStorage!.update).mockReset();
		vi.mocked(opfsSiteStorage!.update).mockResolvedValue(undefined);
	});

	it('finishes pending OPFS resets before checking whether WordPress is installed', async () => {
		const site = createSite('autosaved', {
			opfsResetPending: true,
		});
		const state = createState(site);
		const dispatch = createDispatch(state);

		await bootSiteClient('autosaved', document.createElement('iframe'), {
			signal: new AbortController().signal,
		})(dispatch, () => state);

		expect(opfsSiteStorage!.resetSiteFiles).toHaveBeenCalledWith(
			'autosaved'
		);
		expect(
			vi.mocked(opfsSiteStorage!.resetSiteFiles).mock
				.invocationCallOrder[0]
		).toBeLessThan(
			vi.mocked(storedDirectoryHasPlaygroundFiles).mock
				.invocationCallOrder[0]
		);
		expect(opfsSiteStorage!.update).toHaveBeenCalledWith(
			'autosaved',
			expect.objectContaining({ opfsResetPending: undefined }),
			undefined
		);
	});

	it('does not boot when a pending reset marker cannot be cleared', async () => {
		const markerError = new Error('metadata write failed');
		vi.mocked(opfsSiteStorage!.update).mockRejectedValueOnce(markerError);
		const site = createSite('autosaved', {
			opfsResetPending: true,
		});
		const state = createState(site);
		const dispatch = createDispatch(state);

		await bootSiteClient('autosaved', document.createElement('iframe'), {
			signal: new AbortController().signal,
		})(dispatch, () => state);

		expect(opfsSiteStorage!.resetSiteFiles).toHaveBeenCalledWith(
			'autosaved'
		);
		expect(startPlaygroundWeb).not.toHaveBeenCalled();
		expect(directoryHandleFromMountDevice).not.toHaveBeenCalled();
		expect(dispatch).toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'ui/setActiveSiteError',
				payload: expect.objectContaining({
					siteSlug: 'autosaved',
					error: 'directory-handle-unknown-error',
				}),
			})
		);
	});

	it('opens GitHub auth without setting a fatal boot error for private repos', async () => {
		vi.mocked(shouldShowGitHubAuthModal).mockReturnValue(true);
		const authError = new Error(
			'GitHub authentication required'
		) as Error & {
			repoUrl: string;
		};
		authError.name = 'GitAuthenticationError';
		authError.repoUrl = 'https://github.com/private/repo';
		vi.mocked(startPlaygroundWeb).mockRejectedValueOnce(authError);
		const site = createSite('private-repo');
		const state = createState(site);
		const dispatch = createDispatch(state);

		await bootSiteClient('private-repo', document.createElement('iframe'), {
			signal: new AbortController().signal,
		})(dispatch, () => state);

		expect(dispatch).toHaveBeenCalledWith({
			type: 'ui/setGitHubAuthRepoUrl',
			payload: 'https://github.com/private/repo',
		});
		expect(dispatch).toHaveBeenCalledWith({
			type: 'ui/setActiveModal',
			payload: 'github-private-repo-auth',
		});
		expect(dispatch).not.toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'ui/setActiveSiteError',
			})
		);
	});

	it('uses the stored experimental Blueprint v2 runner setup parameter', async () => {
		const site = {
			...createSite('v2-blueprint'),
			originalUrlParams: {
				searchParams: {
					'experimental-blueprints-v2-runner': 'yes',
				},
			},
		};
		const state = createState(site);
		const dispatch = createDispatch(state);

		await bootSiteClient('v2-blueprint', document.createElement('iframe'), {
			signal: new AbortController().signal,
		})(dispatch, () => state);

		expect(startPlaygroundWeb).toHaveBeenCalledWith(
			expect.objectContaining({
				experimentalBlueprintsV2Runner: true,
			})
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

function createState(...sites: SiteInfo[]) {
	return {
		sites: reducer(undefined, sitesSlice.actions.addSites(sites)),
	} as unknown as PlaygroundReduxState;
}

function createSite(
	slug: string,
	metadata: Partial<SiteInfo['metadata']> = {}
): SiteInfo {
	return {
		slug,
		metadata: {
			storage: 'opfs',
			id: slug,
			name: slug,
			whenCreated: 0,
			persistence: 'autosave',
			runtimeConfiguration: {
				phpVersion: '8.3',
				wpVersion: 'latest',
				intl: false,
				networking: true,
				extraLibraries: [],
				constants: {},
			},
			originalBlueprint: {},
			originalBlueprintSource: { type: 'none' },
			...metadata,
		},
	};
}
