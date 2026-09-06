// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import {
	parsePlaygroundUpdates,
	usePlaygroundUpdates,
} from './use-playground-updates';

const post = {
	id: 740,
	date_gmt: '2026-09-05T10:59:22',
	link: 'https://make.wordpress.org/playground/2026/09/05/new-feature/',
	title: { rendered: 'A new feature &amp; a demo' },
};
const publishedAt = Date.parse(`${post.date_gmt}Z`);

describe('Playground updates', () => {
	let root: Root;
	let container: HTMLDivElement;
	let updates: ReturnType<typeof usePlaygroundUpdates>;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-09-06T12:00:00Z'));
		vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(new Response(JSON.stringify([post])))
		);
		localStorage.clear();
		container = document.createElement('div');
		document.body.append(container);
		root = createRoot(container);
	});

	afterEach(() => {
		act(() => root.unmount());
		container.remove();
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it('marks the displayed publication date and retains it after closing', async () => {
		await render(false);
		expect(updates.hasUnread).toBe(true);
		expect(localStorage.getItem('playground-updates-last-seen')).toBeNull();
		await render(true);
		expect(updates.hasUnread).toBe(false);
		expect(
			Number(localStorage.getItem('playground-updates-last-seen'))
		).toBe(publishedAt);
		await render(false);
		expect(updates.hasUnread).toBe(false);
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('clears unread posts in another tab through the shared storage marker', async () => {
		await render(false);
		await act(async () => {
			localStorage.setItem(
				'playground-updates-last-seen',
				String(publishedAt)
			);
			window.dispatchEvent(
				new StorageEvent('storage', {
					key: 'playground-updates-last-seen',
				})
			);
		});
		expect(updates.hasUnread).toBe(false);
	});

	it('does not move a newer tab’s read marker backwards', async () => {
		await render(false);
		const newerDate = publishedAt + 60000;
		localStorage.setItem('playground-updates-last-seen', String(newerDate));
		await render(true);
		expect(
			Number(localStorage.getItem('playground-updates-last-seen'))
		).toBe(newerDate);
	});

	it('uses a fresh cache without requesting the same posts again', async () => {
		cachePosts(Date.now());
		await render(false);
		expect(updates.posts[0].id).toBe(post.id);
		expect(fetch).not.toHaveBeenCalled();
	});

	it('retains cached posts when the next refresh fails', async () => {
		cachePosts(Date.now() - 2 * 60 * 60 * 1000);
		vi.mocked(fetch).mockRejectedValue(new TypeError('Offline'));
		await render(false);
		expect(updates.status).toBe('error');
		expect(updates.posts[0].id).toBe(post.id);
		expect(
			JSON.parse(localStorage.getItem('playground-updates')!).posts
		).toEqual([post]);
	});

	it('replaces a corrupt cache with the next successful response', async () => {
		localStorage.setItem('playground-updates', '{broken');
		await render(false);
		expect(updates.status).toBe('ready');
		expect(updates.posts[0].id).toBe(post.id);
	});

	it('still loads and clears unread posts when local storage is blocked', async () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('Blocked');
		});
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('Blocked');
		});
		await render(false);
		expect(updates.hasUnread).toBe(true);
		await render(true);
		expect(updates.hasUnread).toBe(false);
		expect(updates.status).toBe('ready');
	});

	it('shows a dot for a newly published post but not an edited old post', async () => {
		await render(true);
		await render(false);
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response(
				JSON.stringify([
					{ ...post, title: { rendered: 'An edited title' } },
				])
			)
		);
		await act(() => vi.advanceTimersByTimeAsync(60 * 60 * 1000));
		expect(updates.posts[0].title).toBe('An edited title');
		expect(updates.hasUnread).toBe(false);
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response(
				JSON.stringify([
					{ ...post, id: 741, date_gmt: '2026-09-06T10:00:00' },
					post,
				])
			)
		);
		await act(() => vi.advanceTimersByTimeAsync(60 * 60 * 1000));
		expect(updates.hasUnread).toBe(true);
	});

	it('marks posts that finish loading while the pane is open', async () => {
		let finish: (response: Response) => void;
		vi.mocked(fetch).mockReturnValue(
			new Promise((resolve) => {
				finish = resolve;
			})
		);
		await render(true);
		expect(localStorage.getItem('playground-updates-last-seen')).toBeNull();
		await act(async () => finish(new Response(JSON.stringify([post]))));
		expect(updates.hasUnread).toBe(false);
		expect(
			Number(localStorage.getItem('playground-updates-last-seen'))
		).toBe(publishedAt);
	});

	it('turns remote HTML into text without mounting its elements', () => {
		const parsed = parsePlaygroundUpdates([
			{
				...post,
				title: {
					rendered:
						'<img src="https://example.com/tracker" onerror="alert(1)">A &amp; B<script>bad()</script>',
				},
			},
		]);
		expect(parsed[0].title).toBe('A & B');
		expect(document.querySelector('img,script')).toBeNull();
	});

	it.each([
		// eslint-disable-next-line no-script-url -- Rejected input, never used as an href.
		'javascript:alert(1)',
		'https://example.com/playground/post',
		'https://make.wordpress.org.evil.test/playground/post',
		'https://make.wordpress.org/core/post',
		'https://user:secret@make.wordpress.org/playground/post',
	])(
		'rejects an article link outside the public Playground blog: %s',
		(link) => {
			expect(() => parsePlaygroundUpdates([{ ...post, link }])).toThrow();
		}
	);

	it('rejects malformed responses instead of displaying an empty success', () => {
		expect(() => parsePlaygroundUpdates({ code: 'rest_error' })).toThrow();
		expect(() =>
			parsePlaygroundUpdates([{ ...post, date_gmt: 'invalid' }])
		).toThrow();
		expect(() => parsePlaygroundUpdates([null])).toThrow();
	});

	/** Mounts the hook with the same open state the Dock supplies. */
	async function render(isOpen: boolean) {
		await act(async () => root.render(<UpdatesProbe isOpen={isOpen} />));
	}

	/** Exposes hook state while retaining React's normal effects and lifecycle. */
	function UpdatesProbe({ isOpen }: { isOpen: boolean }) {
		updates = usePlaygroundUpdates(isOpen);
		return null;
	}

	/** Seeds the same raw response retained by the production cache. */
	function cachePosts(fetchedAt: number) {
		localStorage.setItem(
			'playground-updates',
			JSON.stringify({ fetchedAt, posts: [post] })
		);
	}
});
