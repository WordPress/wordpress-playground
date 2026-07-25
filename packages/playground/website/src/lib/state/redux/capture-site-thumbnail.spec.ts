import type { PlaygroundClient, SiteThumbnail } from '@wp-playground/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { captureAndPersistSiteThumbnail } from './capture-site-thumbnail';
import type { PlaygroundDispatch, PlaygroundReduxState } from './store';

const mocks = vi.hoisted(() => ({
	updateSiteMetadata: vi.fn((payload) => ({
		type: 'sites/updateSiteMetadata',
		payload,
	})),
}));

vi.mock('./slice-sites', () => ({
	updateSiteMetadata: mocks.updateSiteMetadata,
}));

vi.mock('@php-wasm/logger', () => ({
	logger: {
		warn: vi.fn(),
	},
}));

describe('captureAndPersistSiteThumbnail', () => {
	beforeEach(() => {
		mocks.updateSiteMetadata.mockClear();
	});

	it('persists only the newest overlapping capture for a site', async () => {
		const firstCapture = deferred<SiteThumbnail>();
		const secondCapture = deferred<SiteThumbnail>();
		const playground = {
			captureSiteThumbnail: vi
				.fn()
				.mockReturnValueOnce(firstCapture.promise)
				.mockReturnValueOnce(secondCapture.promise),
		} as unknown as PlaygroundClient;
		const state = createStateWithClient('test-site', playground);
		const dispatch = vi.fn(async (action) => action);

		const firstResult = captureAndPersistSiteThumbnail({
			playground,
			siteSlug: 'test-site',
			dispatch: dispatch as unknown as PlaygroundDispatch,
			getState: () => state,
		});
		const secondResult = captureAndPersistSiteThumbnail({
			playground,
			siteSlug: 'test-site',
			dispatch: dispatch as unknown as PlaygroundDispatch,
			getState: () => state,
		});

		const newestThumbnail = { mime: 'image/webp', data: 'newest' };
		secondCapture.resolve(newestThumbnail);
		await secondResult;
		firstCapture.resolve({ mime: 'image/webp', data: 'stale' });
		await firstResult;

		expect(mocks.updateSiteMetadata).toHaveBeenCalledOnce();
		expect(mocks.updateSiteMetadata).toHaveBeenCalledWith({
			slug: 'test-site',
			changes: { thumbnail: newestThumbnail },
		});
	});

	it('discards a capture after the site client is replaced', async () => {
		const capture = deferred<SiteThumbnail>();
		const playground = {
			captureSiteThumbnail: vi.fn(() => capture.promise),
		} as unknown as PlaygroundClient;
		let state = createStateWithClient('test-site', playground);
		const result = captureAndPersistSiteThumbnail({
			playground,
			siteSlug: 'test-site',
			dispatch: vi.fn() as unknown as PlaygroundDispatch,
			getState: () => state,
		});

		state = createStateWithClient('test-site', {} as PlaygroundClient);
		capture.resolve({ mime: 'image/webp', data: 'stale' });
		await result;

		expect(mocks.updateSiteMetadata).not.toHaveBeenCalled();
	});

	it('discards a capture after its caller is aborted', async () => {
		const capture = deferred<SiteThumbnail>();
		const playground = {
			captureSiteThumbnail: vi.fn(() => capture.promise),
		} as unknown as PlaygroundClient;
		const state = createStateWithClient('test-site', playground);
		const abortController = new AbortController();
		const result = captureAndPersistSiteThumbnail({
			playground,
			siteSlug: 'test-site',
			dispatch: vi.fn() as unknown as PlaygroundDispatch,
			getState: () => state,
			signal: abortController.signal,
		});

		abortController.abort();
		capture.resolve({ mime: 'image/webp', data: 'stale' });
		await result;

		expect(mocks.updateSiteMetadata).not.toHaveBeenCalled();
	});
});

function createStateWithClient(
	siteSlug: string,
	playground: PlaygroundClient
): PlaygroundReduxState {
	return {
		clients: {
			ids: [siteSlug],
			entities: {
				[siteSlug]: {
					client: playground,
					siteSlug,
					url: '/',
				},
			},
		},
	} as unknown as PlaygroundReduxState;
}

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((resolvePromise) => {
		resolve = resolvePromise;
	});
	return { promise, resolve };
}
