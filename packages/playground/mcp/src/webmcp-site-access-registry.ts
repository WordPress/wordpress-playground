/**
 * The record of agent site access shared by every Playground tab on this
 * origin.
 *
 * Grant tokens stay in the memory of the tab that issued them. This registry
 * holds what other tabs must see to enforce cross-site rules: which sites have
 * live grants, which grants the user allowed to share data, and which sites an
 * agent used recently. Every change runs under a Web Lock, and anything that
 * cannot be read or written makes the change fail, so a bookkeeping problem
 * denies access rather than granting it.
 */

export const GRANT_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const GRANT_MAX_LIFETIME_MS = 4 * 60 * 60 * 1000;
export const HISTORY_LIFETIME_MS = GRANT_MAX_LIFETIME_MS;

const DEFAULT_KEY = 'playground-webmcp-site-access';

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
	 * Applies `change` to the current state under the registry lock and stores
	 * the result. Rejects when the state cannot be read or written.
	 */
	update<T>(change: (state: SiteAccessState) => T): Promise<T>;
	/** Replaces the state with an empty one, even if it is unreadable. */
	reset(): Promise<void>;
	/** Reads the state without the lock, for display only. */
	read(): SiteAccessState;
	/** Notifies about changes from this tab and from other tabs. */
	subscribe(listener: () => void): () => void;
}

export interface SiteAccessRegistryOptions {
	storage?: Pick<Storage, 'getItem' | 'setItem'>;
	locks?: Pick<LockManager, 'request'>;
	now?: () => number;
	key?: string;
}

export function createSiteAccessRegistry(
	options: SiteAccessRegistryOptions = {}
): SiteAccessRegistry {
	const key = options.key ?? DEFAULT_KEY;
	const now = options.now ?? Date.now;
	const listeners = new Set<() => void>();

	function getStorage() {
		const storage = options.storage ?? globalThis.localStorage;
		if (!storage) {
			throw new Error('Agent site access needs localStorage.');
		}
		return storage;
	}

	async function withLock<T>(run: () => T): Promise<T> {
		const locks = options.locks ?? globalThis.navigator?.locks;
		if (!locks) {
			throw new Error('Agent site access needs the Web Locks API.');
		}
		const result = await locks.request(key, async () => run());
		notify();
		return result as T;
	}

	function notify() {
		for (const listener of listeners) {
			listener();
		}
	}

	function onStorage(event: StorageEvent) {
		if (event.key === key || event.key === null) {
			notify();
		}
	}

	return {
		update(change) {
			return withLock(() => {
				const storage = getStorage();
				const state = parseState(storage.getItem(key));
				prune(state, now());
				const result = change(state);
				prune(state, now());
				storage.setItem(key, JSON.stringify(state));
				return result;
			});
		},
		reset() {
			return withLock(() => {
				getStorage().setItem(key, JSON.stringify(emptyState()));
			});
		},
		read() {
			const state = parseState(getStorage().getItem(key));
			prune(state, now());
			return state;
		},
		subscribe(listener) {
			if (listeners.size === 0 && typeof window !== 'undefined') {
				window.addEventListener('storage', onStorage);
			}
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
				if (listeners.size === 0 && typeof window !== 'undefined') {
					window.removeEventListener('storage', onStorage);
				}
			};
		},
	};
}

function emptyState(): SiteAccessState {
	return { grants: {}, history: {} };
}

function parseState(serialized: string | null): SiteAccessState {
	if (serialized === null) {
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
