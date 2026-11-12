/**
 * Agent access to Playground sites, granted by the user one site at a time.
 *
 * An agent asks for a site with `request()` and receives an opaque token. Every
 * tool that touches a site passes the site ID and that token to `authorize()`,
 * which returns the site's client only when both agree with a live grant. The
 * token designates the site, so a tool never falls back to whichever site
 * happens to be active, and any missing or stale record refuses the call.
 *
 * Grants for different sites coexist only when the user allowed cross-site
 * work. The rules are evaluated against a registry shared by every tab on this
 * origin, so separate tabs cannot sidestep them.
 *
 * @see ./webmcp-site-access-registry.ts
 */

import type { PlaygroundClient } from '@wp-playground/remote';
import type {
	SiteAccessRegistry,
	SiteAccessState,
} from './webmcp-site-access-registry';
import {
	createSiteAccessRegistry,
	GRANT_IDLE_TIMEOUT_MS,
	GRANT_MAX_LIFETIME_MS,
} from './webmcp-site-access-registry';

const MAX_LOGGED_CALLS = 100;
const MAX_CALL_SUMMARY_LENGTH = 200;

export interface SiteAccessSite {
	slug: string;
	name: string;
	isActive: boolean;
}

export interface SiteAccessSiteRef {
	siteId: string;
	/** Known only for sites this tab can list. */
	name?: string;
}

/**
 * What the user is asked to confirm. Everything except `reason` comes from
 * Playground; `reason` is the agent's own claim.
 */
export interface SiteAccessRequest {
	site: SiteAccessSiteRef;
	/** Other sites the agent used during this session. */
	earlierSites: SiteAccessSiteRef[];
	/** Other sites the agent can access right now. */
	sitesWithAccess: SiteAccessSiteRef[];
	reason?: string;
}

/**
 * - `allow`: grant access. Only valid when no other site has a live grant.
 * - `allow-revoke-others`: grant access and revoke every other site's grant.
 * - `allow-cross-site`: grant access and keep the other grants. Needs a reason.
 * - `deny`: refuse.
 */
export type SiteAccessDecision =
	| 'allow'
	| 'allow-revoke-others'
	| 'allow-cross-site'
	| 'deny';

export interface SiteAccessGrant {
	grant: string;
	siteId: string;
	/** When the grant expires unless it is used again. */
	expiresAt: string;
}

export interface SiteAccessCall {
	at: number;
	siteId: string;
	tool: string;
	summary: string;
}

export interface SiteAccessSnapshot {
	grants: Array<{
		grantId: string;
		site: SiteAccessSiteRef;
		inThisTab: boolean;
		expiresAt: number;
		crossSiteWith: SiteAccessSiteRef[];
	}>;
	earlierSites: Array<SiteAccessSiteRef & { lastUsedAt: number }>;
	/** Agent calls made from this tab, newest first. */
	calls: SiteAccessCall[];
	/** The site whose tool is currently asking the user for input. */
	interactingSite?: SiteAccessSiteRef;
	/** Set when the shared record cannot be read. */
	error?: string;
}

export interface SiteAccessOptions {
	listSites(): SiteAccessSite[];
	getActiveClient(): PlaygroundClient | undefined;
	/**
	 * Asks the user. Without it, access is granted only when exactly one site
	 * exists and no other site was used, as in a single-site embed. `signal`
	 * aborts when the request is abandoned, so the UI can stop asking.
	 */
	confirm?: (
		request: SiteAccessRequest,
		signal: AbortSignal
	) => Promise<SiteAccessDecision>;
	registry?: SiteAccessRegistry;
	now?: () => number;
}

export interface SiteAccessRequestOptions {
	reason?: string;
	/**
	 * Runs the confirmation, e.g. inside the browser's
	 * `requestUserInteraction()` so the agent yields to the user. Its return
	 * value is ignored: only the answer `confirm` receives counts.
	 */
	interact?: (confirm: () => Promise<unknown>) => Promise<unknown>;
	/** Abandons the request. Nothing is granted once it aborts. */
	signal?: AbortSignal;
}

export interface SiteAccess {
	request(
		siteId: string,
		options?: SiteAccessRequestOptions
	): Promise<SiteAccessGrant>;
	/**
	 * Returns the client of the granted site. Rejects unless the grant is live,
	 * belongs to `siteId`, and that site is the current one.
	 */
	authorize(siteId: string, grant: string): Promise<PlaygroundClient>;
	/** Like `authorize()`, but without requiring the site to be current. */
	authorizeSwitch(siteId: string, grant: string): Promise<void>;
	revoke(grantId: string): Promise<void>;
	/** Revokes every grant in every tab and forgets the site history. */
	endSession(): Promise<void>;
	/** Revokes this tab's grants for sites that no longer exist. */
	sitesChanged(): Promise<void>;
	/** Logs an agent call for the user to review. */
	recordCall(call: {
		siteId: string;
		tool: string;
		input?: Record<string, unknown>;
	}): void;
	/**
	 * Marks a site as asking the user for input until the returned function
	 * is called.
	 */
	beginInteraction(siteId: string): () => void;
	getSnapshot(): SiteAccessSnapshot;
	subscribe(listener: () => void): () => void;
}

/** A refusal whose message is fixed Playground text, safe to show an agent. */
export class SiteAccessError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'SiteAccessError';
	}
}

const ERRORS = {
	unknownSite:
		'Unknown site. Call playground_list_sites for the available site IDs.',
	denied: 'The user did not grant access to this site.',
	invalidGrant:
		'This grant is not valid for this site. Call ' +
		'playground_request_site_access to request access.',
	expired:
		'This grant has expired or was revoked. Call ' +
		'playground_request_site_access to request access again.',
	siteRemoved: 'This site no longer exists.',
	notCurrent:
		'This site is not the current site. Call playground_switch_site to ' +
		'switch to it first.',
	starting: 'This site is still starting. Try again in a moment.',
	changed:
		'Agent access changed while the user was deciding. Request access again.',
	crossSite:
		'Another site is open to the agent without cross-site permission. ' +
		'Request access to this site again.',
	unavailable:
		'Agent site access is unavailable in this browser, so access is denied.',
};

export function createSiteAccess(options: SiteAccessOptions): SiteAccess {
	const registry = options.registry ?? createSiteAccessRegistry();
	const now = options.now ?? Date.now;
	const tabId = crypto.randomUUID();
	const tokens = new Map<string, { grantId: string; siteId: string }>();
	const calls: SiteAccessCall[] = [];
	const listeners = new Set<() => void>();
	const interactions: string[] = [];
	let expiryTimer: ReturnType<typeof setTimeout> | undefined;
	let snapshot: SiteAccessSnapshot | undefined;

	registry.subscribe(() => {
		snapshot = undefined;
		notify();
	});

	if (typeof window !== 'undefined') {
		window.addEventListener('pagehide', () => {
			void update((state) => {
				for (const [grantId, grant] of Object.entries(state.grants)) {
					if (grant.tabId === tabId) {
						delete state.grants[grantId];
					}
				}
			}).catch(() => undefined);
		});
	}

	function notify() {
		for (const listener of listeners) {
			listener();
		}
	}

	function findSite(siteId: string) {
		return options.listSites().find((site) => site.slug === siteId);
	}

	function describeSite(siteId: string): SiteAccessSiteRef {
		const name = findSite(siteId)?.name;
		return name === undefined ? { siteId } : { siteId, name };
	}

	/** Registry updates fail closed: any failure becomes a refusal. */
	async function update<T>(change: (state: SiteAccessState) => T) {
		try {
			return await registry.update(change);
		} catch (error) {
			if (error instanceof SiteAccessError) {
				throw error;
			}
			throw new SiteAccessError(ERRORS.unavailable);
		}
	}

	function othersFor(state: SiteAccessState, siteId: string) {
		return {
			earlier: Object.keys(state.history).filter((id) => id !== siteId),
			grants: Object.values(state.grants).filter(
				(grant) => grant.siteId !== siteId
			),
		};
	}

	async function useGrant(siteId: string, token: string) {
		const entry = tokens.get(token);
		if (!entry || entry.siteId !== siteId) {
			throw new SiteAccessError(ERRORS.invalidGrant);
		}
		if (!findSite(siteId)) {
			tokens.delete(token);
			await revoke(entry.grantId).catch(() => undefined);
			throw new SiteAccessError(ERRORS.siteRemoved);
		}
		await update((state) => {
			const grant = state.grants[entry.grantId];
			if (!grant || grant.tabId !== tabId || grant.siteId !== siteId) {
				tokens.delete(token);
				throw new SiteAccessError(ERRORS.expired);
			}
			for (const other of Object.values(state.grants)) {
				if (
					other.siteId !== siteId &&
					!grant.crossSiteGrantIds.includes(other.grantId)
				) {
					throw new SiteAccessError(ERRORS.crossSite);
				}
			}
			const time = now();
			grant.lastUsedAt = time;
			state.history[siteId] = time;
		});
	}

	async function revoke(grantId: string) {
		await update((state) => {
			delete state.grants[grantId];
		});
		for (const [token, entry] of tokens) {
			if (entry.grantId === grantId) {
				tokens.delete(token);
			}
		}
	}

	/** Refreshes the snapshot when its earliest grant expires. */
	function scheduleExpiryRefresh(current: SiteAccessSnapshot) {
		clearTimeout(expiryTimer);
		const nextExpiry = Math.min(
			...current.grants.map((grant) => grant.expiresAt)
		);
		if (Number.isFinite(nextExpiry)) {
			expiryTimer = setTimeout(
				() => {
					snapshot = undefined;
					notify();
				},
				Math.max(0, nextExpiry - now()) + 1000
			);
		}
	}

	function buildSnapshot(): SiteAccessSnapshot {
		const base = {
			calls: [...calls],
			...(interactions.length > 0
				? { interactingSite: describeSite(interactions.at(-1)!) }
				: {}),
		};
		let state: SiteAccessState;
		try {
			state = registry.read();
		} catch (error) {
			return {
				...base,
				grants: [],
				earlierSites: [],
				error: error instanceof Error ? error.message : String(error),
			};
		}
		return {
			...base,
			grants: Object.values(state.grants).map((grant) => ({
				grantId: grant.grantId,
				site: describeSite(grant.siteId),
				inThisTab: grant.tabId === tabId,
				expiresAt: Math.min(
					grant.lastUsedAt + GRANT_IDLE_TIMEOUT_MS,
					grant.createdAt + GRANT_MAX_LIFETIME_MS
				),
				crossSiteWith: grant.crossSiteGrantIds
					.map((grantId) => state.grants[grantId]?.siteId)
					.filter((id): id is string => !!id)
					.map(describeSite),
			})),
			earlierSites: Object.entries(state.history).map(
				([siteId, lastUsedAt]) => ({
					...describeSite(siteId),
					lastUsedAt,
				})
			),
		};
	}

	return {
		async request(siteId, { reason, interact, signal } = {}) {
			const site = findSite(siteId);
			if (!site) {
				throw new SiteAccessError(ERRORS.unknownSite);
			}
			const shown = await update((state) => othersFor(state, siteId));
			const request: SiteAccessRequest = {
				site: { siteId, name: site.name },
				earlierSites: shown.earlier.map(describeSite),
				sitesWithAccess: [
					...new Set(shown.grants.map((grant) => grant.siteId)),
				].map(describeSite),
				...(reason ? { reason } : {}),
			};
			const confirm = options.confirm;
			// Only the answer the confirmation itself returns counts: whatever
			// wraps it, such as a browser's requestUserInteraction(), cannot
			// supply or alter the decision.
			let decision: unknown = 'deny';
			if (confirm) {
				const asking = new AbortController();
				const abandon = () => asking.abort();
				signal?.addEventListener('abort', abandon);
				const ask = async () => {
					decision = await confirm(request, asking.signal);
					return decision;
				};
				try {
					await (interact ? interact(ask) : ask());
				} finally {
					asking.abort();
					signal?.removeEventListener('abort', abandon);
				}
			} else {
				decision =
					options.listSites().length === 1 &&
					shown.earlier.length === 0 &&
					shown.grants.length === 0
						? 'allow'
						: 'deny';
			}
			if (
				!(
					decision === 'allow-revoke-others' ||
					(decision === 'allow' && shown.grants.length === 0) ||
					(decision === 'allow-cross-site' && !!reason)
				) ||
				signal?.aborted
			) {
				throw new SiteAccessError(ERRORS.denied);
			}

			const grantId = crypto.randomUUID();
			const token = createToken();
			const createdAt = await update((state) => {
				const current = othersFor(state, siteId);
				const shownGrantIds = shown.grants.map((g) => g.grantId);
				if (
					current.earlier.some((id) => !shown.earlier.includes(id)) ||
					current.grants.some(
						(grant) => !shownGrantIds.includes(grant.grantId)
					)
				) {
					throw new SiteAccessError(ERRORS.changed);
				}
				const crossSiteGrantIds: string[] = [];
				for (const other of current.grants) {
					if (decision === 'allow-cross-site') {
						crossSiteGrantIds.push(other.grantId);
						other.crossSiteGrantIds.push(grantId);
					} else {
						delete state.grants[other.grantId];
					}
				}
				const time = now();
				state.grants[grantId] = {
					grantId,
					siteId,
					tabId,
					createdAt: time,
					lastUsedAt: time,
					crossSiteGrantIds,
				};
				state.history[siteId] = time;
				return time;
			});
			tokens.set(token, { grantId, siteId });
			return {
				grant: token,
				siteId,
				expiresAt: new Date(
					createdAt + GRANT_IDLE_TIMEOUT_MS
				).toISOString(),
			};
		},

		async authorize(siteId, token) {
			await useGrant(siteId, token);
			if (!findSite(siteId)?.isActive) {
				throw new SiteAccessError(ERRORS.notCurrent);
			}
			const client = options.getActiveClient();
			if (!client) {
				throw new SiteAccessError(ERRORS.starting);
			}
			return client;
		},

		async authorizeSwitch(siteId, token) {
			await useGrant(siteId, token);
		},

		revoke,

		async endSession() {
			tokens.clear();
			calls.length = 0;
			await registry.reset();
		},

		async sitesChanged() {
			const siteIds = new Set(
				options.listSites().map((site) => site.slug)
			);
			const removed = [...tokens.values()].filter(
				(entry) => !siteIds.has(entry.siteId)
			);
			for (const entry of removed) {
				await revoke(entry.grantId).catch(() => undefined);
			}
		},

		recordCall({ siteId, tool, input }) {
			calls.unshift({
				at: now(),
				siteId,
				tool,
				summary:
					input && Object.keys(input).length > 0
						? summarize(input)
						: '',
			});
			calls.length = Math.min(calls.length, MAX_LOGGED_CALLS);
			snapshot = undefined;
			notify();
		},

		beginInteraction(siteId) {
			interactions.push(siteId);
			snapshot = undefined;
			notify();
			let ended = false;
			return () => {
				if (ended) {
					return;
				}
				ended = true;
				interactions.splice(interactions.indexOf(siteId), 1);
				snapshot = undefined;
				notify();
			};
		},

		getSnapshot() {
			if (!snapshot) {
				snapshot = buildSnapshot();
				scheduleExpiryRefresh(snapshot);
			}
			return snapshot;
		},

		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	};
}

function summarize(input: Record<string, unknown>): string {
	const summary = JSON.stringify(input);
	return summary.length > MAX_CALL_SUMMARY_LENGTH
		? summary.slice(0, MAX_CALL_SUMMARY_LENGTH) + '…'
		: summary;
}

function createToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	let binary = '';
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary)
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}

export interface SiteAccessPrompt {
	/**
	 * Pass as `confirmSiteAccess`. A second request while one is open is
	 * denied, and an aborted request stops being shown.
	 */
	confirm(
		request: SiteAccessRequest,
		signal?: AbortSignal
	): Promise<SiteAccessDecision>;
	/** The request the UI should show, if any. */
	getPending(): SiteAccessRequest | undefined;
	/** Answers the pending request. */
	answer(decision: SiteAccessDecision): void;
	subscribe(listener: () => void): () => void;
}

/** Holds the confirmation the UI is showing, one request at a time. */
export function createSiteAccessPrompt(): SiteAccessPrompt {
	let pending:
		| {
				request: SiteAccessRequest;
				resolve: (decision: SiteAccessDecision) => void;
		  }
		| undefined;
	const listeners = new Set<() => void>();
	const notify = () => listeners.forEach((listener) => listener());
	return {
		confirm(request, signal) {
			if (pending || signal?.aborted) {
				return Promise.resolve('deny');
			}
			return new Promise((resolve) => {
				const entry = { request, resolve };
				pending = entry;
				signal?.addEventListener('abort', () => {
					if (pending === entry) {
						pending = undefined;
						resolve('deny');
						notify();
					}
				});
				notify();
			});
		},
		getPending() {
			return pending?.request;
		},
		answer(decision) {
			const current = pending;
			pending = undefined;
			current?.resolve(decision);
			notify();
		},
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	};
}
