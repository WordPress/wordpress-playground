/**
 * The record of agent site access shared by every Playground tab on this
 * origin.
 *
 * Grant tokens stay in the memory of the tab that issued them. This registry
 * holds what other tabs must see to enforce cross-site rules: which sites have
 * live grants, which grants the user allowed to share data, and which sites an
 * agent used recently.
 *
 * Every change is one IndexedDB read-write transaction, which browsers
 * serialize across tabs and processes. Anything that cannot be read or written
 * makes the change fail, so a bookkeeping problem denies access rather than
 * granting it.
 */

export const GRANT_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const GRANT_MAX_LIFETIME_MS = 4 * 60 * 60 * 1000;
export const HISTORY_LIFETIME_MS = GRANT_MAX_LIFETIME_MS;

const DEFAULT_NAME = 'playground-webmcp-site-access';

export interface SiteAccessGrantRecord {
	grantId: string;
	siteId: string;
	/** The tab holding the grant's token. */
	tabId: string;
	createdAt: number;
	lastUsedAt: number;
	/** Grants for other sites the user allowed this one to share data with. */
	crossSiteGrantIds: string[];
}

export interface SiteAccessState {
	grants: Record<string, SiteAccessGrantRecord>;
	/** When an agent last used each site, keyed by site ID. */
	history: Record<string, number>;
}

export interface SiteAccessRegistry {
	/**
	 * Applies `change` to the current state atomically and stores the result.
	 * Rejects, without storing anything, when the state cannot be read or
	 * written or when `change` throws.
	 */
	update<T>(change: (state: SiteAccessState) => T): Promise<T>;
	/** Replaces the state with an empty one, even if it is unreadable. */
	reset(): Promise<void>;
	/**
	 * The last state this tab read or wrote, for display only. Throws when it
	 * was unreadable.
	 */
	read(): SiteAccessState;
	/** Notifies about changes from this tab and from other tabs. */
	subscribe(listener: () => void): () => void;
}

/** Stores the serialized state with atomic read-modify-write transactions. */
export interface SiteAccessStore {
	transact<T>(
		change: (stored: string | undefined) => { result: T; next: string }
	): Promise<T>;
}

export interface SiteAccessRegistryOptions {
	store?: SiteAccessStore;
	/** Tells other tabs about changes. `null` disables cross-tab updates. */
	channel?: Pick<
		BroadcastChannel,
		'postMessage' | 'addEventListener' | 'removeEventListener'
	> | null;
	now?: () => number;
}

export function createSiteAccessRegistry(
	options: SiteAccessRegistryOptions = {}
): SiteAccessRegistry {
	const store = options.store ?? createIndexedDBStore(DEFAULT_NAME);
	const channel =
		options.channel === undefined
			? createChannel(DEFAULT_NAME)
			: options.channel;
	const now = options.now ?? Date.now;
	const listeners = new Set<() => void>();
	let cached: SiteAccessState | Error = emptyState();

	function notify() {
		for (const listener of listeners) {
			listener();
		}
	}

	async function refresh() {
		try {
			cached = await store.transact((stored) => ({
				result: parseState(stored),
				next: stored ?? JSON.stringify(emptyState()),
			}));
		} catch (error) {
			cached = error instanceof Error ? error : new Error(String(error));
		}
		notify();
	}

	async function commit<T>(
		change: (stored: string | undefined) => {
			result: T;
			state: SiteAccessState;
		}
	): Promise<T> {
		let state: SiteAccessState | undefined;
		const result = await store.transact((stored) => {
			const changed = change(stored);
			state = changed.state;
			return {
				result: changed.result,
				next: JSON.stringify(changed.state),
			};
		});
		cached = state!;
		channel?.postMessage('changed');
		notify();
		return result;
	}

	channel?.addEventListener('message', () => void refresh());
	void refresh();

	return {
		update(change) {
			return commit((stored) => {
				const state = parseState(stored);
				prune(state, now());
				const result = change(state);
				prune(state, now());
				return { result, state };
			});
		},
		reset() {
			return commit(() => ({ result: undefined, state: emptyState() }));
		},
		read() {
			if (cached instanceof Error) {
				throw cached;
			}
			const state = structuredClone(cached);
			prune(state, now());
			return state;
		},
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	};
}

function createChannel(name: string) {
	return typeof BroadcastChannel === 'undefined'
		? null
		: new BroadcastChannel(name);
}

function createIndexedDBStore(name: string): SiteAccessStore {
	const KEY = 'state';
	let database: Promise<IDBDatabase> | undefined;
	function open() {
		database ??= new Promise((resolve, reject) => {
			if (typeof indexedDB === 'undefined') {
				reject(new Error('Agent site access needs IndexedDB.'));
				return;
			}
			const request = indexedDB.open(name, 1);
			request.onupgradeneeded = () =>
				request.result.createObjectStore(KEY);
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		return database;
	}
	return {
		async transact(change) {
			const db = await open();
			return await new Promise((resolve, reject) => {
				const transaction = db.transaction(KEY, 'readwrite');
				const objects = transaction.objectStore(KEY);
				let outcome:
					| { ok: true; result: any }
					| { ok: false; error: unknown }
					| undefined;
				const get = objects.get(KEY);
				get.onsuccess = () => {
					try {
						const stored = get.result;
						const { result, next } = change(
							typeof stored === 'string' ? stored : undefined
						);
						outcome = { ok: true, result };
						objects.put(next, KEY);
					} catch (error) {
						outcome = { ok: false, error };
						transaction.abort();
					}
				};
				transaction.oncomplete = () => {
					if (outcome?.ok) {
						resolve(outcome.result);
					} else {
						reject(
							new Error('The agent access record was not read.')
						);
					}
				};
				transaction.onabort = transaction.onerror = () => {
					reject(
						outcome && !outcome.ok
							? outcome.error
							: (transaction.error ??
									new Error('Storing agent access failed.'))
					);
				};
			});
		},
	};
}

function emptyState(): SiteAccessState {
	return { grants: {}, history: {} };
}

function parseState(serialized: string | undefined): SiteAccessState {
	if (serialized === undefined) {
		return emptyState();
	}
	let value: unknown;
	try {
		value = JSON.parse(serialized);
	} catch {
		value = undefined;
	}
	if (!isValidState(value)) {
		throw new Error(
			"Playground's record of agent site access is unreadable. End the " +
				'agent session in Playground to reset it.'
		);
	}
	return value;
}

function isValidState(value: unknown): value is SiteAccessState {
	if (
		!isRecord(value) ||
		!isRecord(value['grants']) ||
		!isRecord(value['history'])
	) {
		return false;
	}
	for (const [grantId, grant] of Object.entries(value['grants'])) {
		if (
			!isRecord(grant) ||
			grant['grantId'] !== grantId ||
			typeof grant['siteId'] !== 'string' ||
			typeof grant['tabId'] !== 'string' ||
			typeof grant['createdAt'] !== 'number' ||
			typeof grant['lastUsedAt'] !== 'number' ||
			!Array.isArray(grant['crossSiteGrantIds']) ||
			!grant['crossSiteGrantIds'].every((id) => typeof id === 'string')
		) {
			return false;
		}
	}
	return Object.values(value['history']).every(
		(usedAt) => typeof usedAt === 'number'
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Drops expired grants and history, and links to grants that no longer exist. */
function prune(state: SiteAccessState, time: number) {
	for (const [grantId, grant] of Object.entries(state.grants)) {
		if (
			time - grant.lastUsedAt > GRANT_IDLE_TIMEOUT_MS ||
			time - grant.createdAt > GRANT_MAX_LIFETIME_MS
		) {
			delete state.grants[grantId];
		}
	}
	for (const grant of Object.values(state.grants)) {
		grant.crossSiteGrantIds = grant.crossSiteGrantIds.filter(
			(grantId) => grantId in state.grants
		);
	}
	for (const [siteId, usedAt] of Object.entries(state.history)) {
		if (time - usedAt > HISTORY_LIFETIME_MS) {
			delete state.history[siteId];
		}
	}
}
