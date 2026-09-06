import { useEffect, useRef, useState } from 'react';

// Category 7 is Make Playground's existing Updates category. Meetings and
// status reports have separate categories and do not belong in this pane.
const UPDATES_URL =
	'https://make.wordpress.org/playground/wp-json/wp/v2/posts?categories=7&per_page=5&_fields=id,date_gmt,link,title';
const CACHE_KEY = 'playground-updates';
const LAST_SEEN_KEY = 'playground-updates-last-seen';
const REFRESH_INTERVAL = 60 * 60 * 1000;

export type PlaygroundUpdate = {
	id: number;
	date: number;
	url: string;
	title: string;
};

/**
 * Loads Make updates outside the WordPress runtime. Cached posts survive a
 * failed request, and the read marker is shared by every site in this browser.
 */
export function usePlaygroundUpdates(isOpen: boolean) {
	const [cached] = useState(readCachedUpdates);
	const [posts, setPosts] = useState(cached.posts);
	const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
		cached.fetchedAt ? 'ready' : 'loading'
	);
	const [lastSeen, setLastSeen] = useState(readLastSeen);
	const newestDate = Math.max(0, ...posts.map((post) => post.date));
	const fetchedAt = useRef(cached.fetchedAt);

	useEffect(() => {
		let disposed = false;
		let pending: AbortController | undefined;

		/** Refreshes stale posts without competing with an in-flight request. */
		async function refresh() {
			if (pending || Date.now() - fetchedAt.current < REFRESH_INTERVAL) {
				return;
			}
			const controller = new AbortController();
			pending = controller;
			const timeout = window.setTimeout(() => controller.abort(), 10000);
			setStatus('loading');
			try {
				const response = await fetch(UPDATES_URL, {
					credentials: 'omit',
					signal: controller.signal,
				});
				if (!response.ok) {
					throw new Error('Could not load Playground updates.');
				}
				const data = await response.json();
				const updates = parsePlaygroundUpdates(data);
				if (disposed) {
					return;
				}
				fetchedAt.current = Date.now();
				setPosts(updates);
				setStatus('ready');
				try {
					localStorage.setItem(
						CACHE_KEY,
						JSON.stringify({
							fetchedAt: fetchedAt.current,
							posts: data,
						})
					);
				} catch {
					// Updates still work when browser storage is unavailable or full.
				}
			} catch {
				if (!disposed) {
					setStatus('error');
				}
			} finally {
				window.clearTimeout(timeout);
				pending = undefined;
			}
		}

		/** Checks for updates when a long-running Playground becomes visible. */
		function refreshWhenVisible() {
			if (document.visibilityState === 'visible') {
				void refresh();
			}
		}

		void refresh();
		const interval = window.setInterval(
			refreshWhenVisible,
			REFRESH_INTERVAL
		);
		window.addEventListener('online', refreshWhenVisible);
		document.addEventListener('visibilitychange', refreshWhenVisible);
		return () => {
			disposed = true;
			pending?.abort();
			window.clearInterval(interval);
			window.removeEventListener('online', refreshWhenVisible);
			document.removeEventListener(
				'visibilitychange',
				refreshWhenVisible
			);
		};
	}, []);

	useEffect(() => {
		/** Clears the dot here when another tab has already shown the posts. */
		function syncLastSeen(event: StorageEvent) {
			if (event.key === LAST_SEEN_KEY || event.key === null) {
				setLastSeen(readLastSeen());
			}
		}
		window.addEventListener('storage', syncLastSeen);
		return () => window.removeEventListener('storage', syncLastSeen);
	}, []);

	useEffect(() => {
		if (!isOpen || newestDate <= lastSeen) {
			return;
		}
		// Compare publication dates, not the visitor's clock or modified dates:
		// editing an old announcement must not make it unread again. Re-read
		// storage so an older tab cannot move another tab's marker backwards.
		const seen = Math.max(newestDate, readLastSeen());
		setLastSeen(seen);
		try {
			localStorage.setItem(LAST_SEEN_KEY, String(seen));
		} catch {
			// Keep the in-memory marker when persistent storage is blocked.
		}
	}, [isOpen, newestDate, lastSeen]);

	return { posts, status, hasUnread: newestDate > lastSeen };
}

/** Validates both network and cached posts before they reach the Dock. */
export function parsePlaygroundUpdates(data: unknown): PlaygroundUpdate[] {
	if (!Array.isArray(data)) {
		throw new Error('Invalid Playground updates response.');
	}
	return data.map((post) => {
		if (
			!post ||
			!Number.isSafeInteger(post.id) ||
			typeof post.date_gmt !== 'string' ||
			typeof post.link !== 'string' ||
			typeof post.title?.rendered !== 'string'
		) {
			throw new Error('Invalid Playground update.');
		}
		const url = new URL(post.link);
		const date = Date.parse(`${post.date_gmt}Z`);
		if (
			url.origin !== 'https://make.wordpress.org' ||
			!url.pathname.startsWith('/playground/') ||
			url.username ||
			url.password ||
			!Number.isFinite(date)
		) {
			throw new Error('Invalid Playground update URL or date.');
		}
		return {
			id: post.id,
			date,
			url: url.href,
			title: htmlToText(post.title.rendered),
		};
	});
}

/** Extracts plain text in an inert template; feed HTML never enters the page. */
function htmlToText(html: string): string {
	const template = document.createElement('template');
	template.innerHTML = html;
	template.content
		.querySelectorAll('script, style')
		.forEach((node) => node.remove());
	return (template.content.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** Revalidates the saved API response so a broken cache cannot break the Dock. */
function readCachedUpdates(): { posts: PlaygroundUpdate[]; fetchedAt: number } {
	try {
		const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null');
		if (
			cached &&
			Number.isFinite(cached.fetchedAt) &&
			cached.fetchedAt > 0 &&
			cached.fetchedAt <= Date.now()
		) {
			return {
				posts: parsePlaygroundUpdates(cached.posts),
				fetchedAt: cached.fetchedAt,
			};
		}
	} catch {
		// A missing, unreadable, or outdated cache is replaced by the next fetch.
	}
	return { posts: [], fetchedAt: 0 };
}

/** Reads the latest publication date shown in this browser, or zero if unread. */
function readLastSeen(): number {
	try {
		const seen = Number(localStorage.getItem(LAST_SEEN_KEY));
		return Number.isFinite(seen) && seen > 0 ? seen : 0;
	} catch {
		return 0;
	}
}
