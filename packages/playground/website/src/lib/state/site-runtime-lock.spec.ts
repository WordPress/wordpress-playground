// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlaygroundClient } from '@wp-playground/remote';
import {
	abortSiteBoot,
	acquireCurrentSiteRuntimeLock,
	acquireSiteRuntimeLock,
	createSiteBootAbortController,
	getCurrentSiteBootSignal,
	releaseCurrentSiteRuntimeLock,
	runWithExclusiveSiteRuntimeLock,
	SiteRuntimeLockUnavailableError,
	suspendCurrentSiteRuntime,
} from './site-runtime-lock';

const SITE_RUNTIME_LOCK_PREFIX = 'wordpress-playground-site-runtime:';

describe('site runtime locks', () => {
	let locks: FakeLockManager;
	const registeredSiteSlugs = new Set<string>();

	beforeEach(() => {
		locks = new FakeLockManager();
		Object.defineProperty(navigator, 'locks', {
			configurable: true,
			value: locks,
		});
	});

	afterEach(() => {
		for (const siteSlug of registeredSiteSlugs) {
			abortSiteBoot(siteSlug);
		}
		registeredSiteSlugs.clear();
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('holds a shared lock until the boot signal is aborted', async () => {
		const siteSlug = 'shared-until-abort';
		const lockName = getRuntimeLockName(siteSlug);
		const boot = new AbortController();

		await acquireSiteRuntimeLock(siteSlug, boot.signal);
		expect(locks.getActiveModes(lockName)).toEqual(['shared']);

		let exclusiveStarted = false;
		const exclusive = locks.request(lockName, { mode: 'exclusive' }, () => {
			exclusiveStarted = true;
		});
		await Promise.resolve();
		expect(exclusiveStarted).toBe(false);

		boot.abort();
		await exclusive;
		await Promise.resolve();

		expect(exclusiveStarted).toBe(true);
		expect(locks.getActiveModes(lockName)).toEqual([]);
	});

	it('releases and reacquires a shared lock for the same boot signal', async () => {
		const siteSlug = registerSiteSlug('reacquired-runtime');
		const lockName = getRuntimeLockName(siteSlug);
		const boot = createSiteBootAbortController(siteSlug);

		await acquireSiteRuntimeLock(siteSlug, boot.signal);
		await releaseCurrentSiteRuntimeLock(siteSlug);

		expect(getCurrentSiteBootSignal(siteSlug)).toBe(boot.signal);
		expect(locks.getActiveModes(lockName)).toEqual([]);

		await acquireSiteRuntimeLock(siteSlug, boot.signal);

		expect(locks.getRequestCount(lockName, 'shared')).toBe(2);
		expect(locks.getActiveModes(lockName)).toEqual(['shared']);
	});

	it('queues the exclusive request before suspension and restores after a timeout', async () => {
		vi.useFakeTimers();
		const siteSlug = 'exclusive-timeout';
		const lockName = getRuntimeLockName(siteSlug);
		const otherTab = new AbortController();
		await acquireSiteRuntimeLock(siteSlug, otherTab.signal);

		const restore = vi.fn(async () => {});
		const discard = vi.fn(async () => {});
		let exclusiveWasQueuedBeforeSuspension = false;
		const result = runWithExclusiveSiteRuntimeLock(
			siteSlug,
			vi.fn(async () => 'should not run'),
			{
				timeoutMs: 25,
				suspendCurrentRuntime: async () => {
					exclusiveWasQueuedBeforeSuspension = locks
						.getQueuedModes(lockName)
						.includes('exclusive');
					return { restore, discard };
				},
			}
		);
		const rejection = expect(result).rejects.toBeInstanceOf(
			SiteRuntimeLockUnavailableError
		);

		await vi.runAllTimersAsync();
		await rejection;

		expect(exclusiveWasQueuedBeforeSuspension).toBe(true);
		expect(restore).toHaveBeenCalledOnce();
		expect(discard).not.toHaveBeenCalled();
		otherTab.abort();
	});

	it('discards a suspended runtime after successful exclusive work', async () => {
		const restore = vi.fn(async () => {});
		const discard = vi.fn(async () => {});
		const order: string[] = [];

		const result = await runWithExclusiveSiteRuntimeLock(
			'exclusive-success',
			async () => {
				order.push('operation');
				return 'complete';
			},
			{
				suspendCurrentRuntime: async () => {
					order.push('suspend');
					return {
						restore,
						discard: async () => {
							order.push('discard');
							await discard();
						},
					};
				},
			}
		);

		expect(result).toBe('complete');
		expect(order).toEqual(['suspend', 'operation', 'discard']);
		expect(discard).toHaveBeenCalledOnce();
		expect(restore).not.toHaveBeenCalled();
	});

	it('restores a suspended mount from OPFS into MEMFS', async () => {
		const siteSlug = registerSiteSlug('restored-runtime');
		const lockName = getRuntimeLockName(siteSlug);
		const boot = createSiteBootAbortController(siteSlug);
		await acquireCurrentSiteRuntimeLock(siteSlug);
		const playground = {
			flushOpfs: vi.fn(async () => {}),
			unmountOpfs: vi.fn(async () => {}),
			mountOpfs: vi.fn(async () => {}),
		} as unknown as PlaygroundClient;
		const mountDescriptor = {
			mountpoint: '/wordpress',
			device: {} as never,
		};
		const onDiscard = vi.fn();

		const suspension = await suspendCurrentSiteRuntime({
			siteSlug,
			playground,
			mountDescriptor,
			onDiscard,
		});

		expect(playground.unmountOpfs).toHaveBeenCalledWith('/wordpress');
		expect(locks.getActiveModes(lockName)).toEqual([]);

		await suspension.restore();

		expect(locks.getActiveModes(lockName)).toEqual(['shared']);
		expect(playground.mountOpfs).toHaveBeenCalledWith({
			...mountDescriptor,
			initialSyncDirection: 'opfs-to-memfs',
		});
		expect(getCurrentSiteBootSignal(siteSlug)).toBe(boot.signal);
		expect(onDiscard).not.toHaveBeenCalled();
	});

	it('keeps the mount and shared lease when the explicit flush fails', async () => {
		const siteSlug = registerSiteSlug('failed-explicit-flush');
		const lockName = getRuntimeLockName(siteSlug);
		const boot = createSiteBootAbortController(siteSlug);
		await acquireCurrentSiteRuntimeLock(siteSlug);
		const flushError = new Error('OPFS flush failed');
		const playground = {
			flushOpfs: vi.fn(async () => {
				throw flushError;
			}),
			unmountOpfs: vi.fn(async () => {}),
			mountOpfs: vi.fn(async () => {}),
		} as unknown as PlaygroundClient;
		const onDiscard = vi.fn();
		const operation = vi.fn(async () => undefined);

		await expect(
			runWithExclusiveSiteRuntimeLock(siteSlug, operation, {
				suspendCurrentRuntime: () =>
					suspendCurrentSiteRuntime({
						siteSlug,
						playground,
						mountDescriptor: {
							mountpoint: '/wordpress',
							device: {} as never,
						},
						onDiscard,
					}),
			})
		).rejects.toBe(flushError);

		expect(playground.unmountOpfs).not.toHaveBeenCalled();
		expect(operation).not.toHaveBeenCalled();
		expect(onDiscard).not.toHaveBeenCalled();
		expect(getCurrentSiteBootSignal(siteSlug)).toBe(boot.signal);
		expect(locks.getActiveModes(lockName)).toEqual(['shared']);
	});

	it('keeps the lease when the final flush leaves the mount active', async () => {
		const siteSlug = registerSiteSlug('failed-final-flush');
		const lockName = getRuntimeLockName(siteSlug);
		const boot = createSiteBootAbortController(siteSlug);
		await acquireCurrentSiteRuntimeLock(siteSlug);
		const flushError = new Error('final OPFS flush failed');
		const playground = {
			flushOpfs: vi.fn(async () => {}),
			unmountOpfs: vi.fn(async () => {
				throw flushError;
			}),
			hasOpfsMount: vi.fn(async () => true),
			mountOpfs: vi.fn(async () => {}),
		} as unknown as PlaygroundClient;
		const onDiscard = vi.fn();
		const operation = vi.fn(async () => undefined);

		await expect(
			runWithExclusiveSiteRuntimeLock(siteSlug, operation, {
				suspendCurrentRuntime: () =>
					suspendCurrentSiteRuntime({
						siteSlug,
						playground,
						mountDescriptor: {
							mountpoint: '/wordpress',
							device: {} as never,
						},
						onDiscard,
					}),
			})
		).rejects.toBe(flushError);

		expect(operation).not.toHaveBeenCalled();
		expect(playground.mountOpfs).not.toHaveBeenCalled();
		expect(onDiscard).not.toHaveBeenCalled();
		expect(getCurrentSiteBootSignal(siteSlug)).toBe(boot.signal);
		expect(locks.getActiveModes(lockName)).toEqual(['shared']);
	});

	it('cancels exclusive work before restoring a failed suspension', async () => {
		const siteSlug = registerSiteSlug('failed-unmount');
		const lockName = getRuntimeLockName(siteSlug);
		const boot = createSiteBootAbortController(siteSlug);
		await acquireCurrentSiteRuntimeLock(siteSlug);
		const otherTab = new AbortController();
		await acquireSiteRuntimeLock(siteSlug, otherTab.signal);
		const unmountError = new Error('OPFS flush failed');
		const playground = {
			flushOpfs: vi.fn(async () => {}),
			unmountOpfs: vi.fn(async () => {
				throw unmountError;
			}),
			hasOpfsMount: vi.fn(async () => false),
			mountOpfs: vi.fn(async () => {}),
		} as unknown as PlaygroundClient;
		const onDiscard = vi.fn();
		const operation = vi.fn(async () => undefined);

		await expect(
			runWithExclusiveSiteRuntimeLock(siteSlug, operation, {
				suspendCurrentRuntime: () =>
					suspendCurrentSiteRuntime({
						siteSlug,
						playground,
						mountDescriptor: {
							mountpoint: '/wordpress',
							device: {} as never,
						},
						onDiscard,
					}),
			})
		).rejects.toBe(unmountError);

		expect(operation).not.toHaveBeenCalled();
		expect(playground.mountOpfs).toHaveBeenCalledWith({
			mountpoint: '/wordpress',
			device: {},
			initialSyncDirection: 'opfs-to-memfs',
		});
		expect(onDiscard).not.toHaveBeenCalled();
		expect(getCurrentSiteBootSignal(siteSlug)).toBe(boot.signal);
		expect(locks.getActiveModes(lockName)).toEqual(['shared', 'shared']);
		otherTab.abort();
	});

	it('does not release or discard a replacement boot after a stale unmount', async () => {
		const siteSlug = registerSiteSlug('replaced-during-unmount');
		createSiteBootAbortController(siteSlug);
		await acquireCurrentSiteRuntimeLock(siteSlug);
		let resolveUnmount = () => {};
		const unmount = new Promise<void>((resolve) => {
			resolveUnmount = resolve;
		});
		const playground = {
			flushOpfs: vi.fn(async () => {}),
			unmountOpfs: vi.fn(() => unmount),
			mountOpfs: vi.fn(async () => {}),
		} as unknown as PlaygroundClient;
		const onDiscard = vi.fn();
		const suspensionPromise = suspendCurrentSiteRuntime({
			siteSlug,
			playground,
			mountDescriptor: {
				mountpoint: '/wordpress',
				device: {} as never,
			},
			onDiscard,
		});
		await vi.waitFor(() => {
			expect(playground.unmountOpfs).toHaveBeenCalled();
		});

		const replacement = createSiteBootAbortController(siteSlug);
		await acquireCurrentSiteRuntimeLock(siteSlug);
		resolveUnmount();
		const suspension = await suspensionPromise;
		await suspension.restore();
		await suspension.discard();

		expect(replacement.signal.aborted).toBe(false);
		expect(onDiscard).not.toHaveBeenCalled();
		expect(playground.mountOpfs).not.toHaveBeenCalled();
	});

	function registerSiteSlug(siteSlug: string) {
		registeredSiteSlugs.add(siteSlug);
		return siteSlug;
	}
});

function getRuntimeLockName(siteSlug: string) {
	return `${SITE_RUNTIME_LOCK_PREFIX}${siteSlug}`;
}

type LockMode = 'exclusive' | 'shared';

type PendingLockRequest = {
	name: string;
	mode: LockMode;
	signal?: AbortSignal;
	callback: () => unknown | Promise<unknown>;
	resolve: (value: unknown) => void;
	reject: (error: unknown) => void;
	granted: boolean;
	onAbort?: () => void;
};

class FakeLockManager {
	private readonly active = new Map<string, PendingLockRequest[]>();
	private readonly queued = new Map<string, PendingLockRequest[]>();
	private readonly requestCounts = new Map<string, number>();

	request<T>(
		name: string,
		options: { mode?: LockMode; signal?: AbortSignal },
		callback: (lock: { name: string; mode: LockMode }) => T | Promise<T>
	): Promise<T> {
		const mode = options.mode ?? 'exclusive';
		this.requestCounts.set(
			`${name}:${mode}`,
			(this.requestCounts.get(`${name}:${mode}`) ?? 0) + 1
		);
		return new Promise<T>((resolve, reject) => {
			if (options.signal?.aborted) {
				reject(createAbortError());
				return;
			}
			const request: PendingLockRequest = {
				name,
				mode,
				signal: options.signal,
				callback: () => callback({ name, mode }),
				resolve: (value) => resolve(value as T),
				reject,
				granted: false,
			};
			request.onAbort = () => {
				if (request.granted) {
					return;
				}
				this.removeRequest(this.queued, request);
				request.reject(createAbortError());
				this.drain(name);
			};
			options.signal?.addEventListener('abort', request.onAbort, {
				once: true,
			});
			const queue = this.queued.get(name) ?? [];
			queue.push(request);
			this.queued.set(name, queue);
			this.drain(name);
		});
	}

	getActiveModes(name: string) {
		return (this.active.get(name) ?? []).map((request) => request.mode);
	}

	getQueuedModes(name: string) {
		return (this.queued.get(name) ?? []).map((request) => request.mode);
	}

	getRequestCount(name: string, mode: LockMode) {
		return this.requestCounts.get(`${name}:${mode}`) ?? 0;
	}

	private drain(name: string) {
		const queue = this.queued.get(name) ?? [];
		const active = this.active.get(name) ?? [];
		const first = queue[0];
		if (!first) {
			return;
		}
		if (first.mode === 'exclusive') {
			if (active.length === 0) {
				this.grant(first);
			}
			return;
		}
		if (active.some((request) => request.mode === 'exclusive')) {
			return;
		}
		while (queue[0]?.mode === 'shared') {
			this.grant(queue[0]);
		}
	}

	private grant(request: PendingLockRequest) {
		this.removeRequest(this.queued, request);
		request.granted = true;
		if (request.onAbort) {
			request.signal?.removeEventListener('abort', request.onAbort);
		}
		const active = this.active.get(request.name) ?? [];
		active.push(request);
		this.active.set(request.name, active);
		void Promise.resolve()
			.then(request.callback)
			.then(request.resolve, request.reject)
			.finally(() => {
				this.removeRequest(this.active, request);
				this.drain(request.name);
			});
	}

	private removeRequest(
		requestsByName: Map<string, PendingLockRequest[]>,
		request: PendingLockRequest
	) {
		const requests = requestsByName.get(request.name);
		if (!requests) {
			return;
		}
		const index = requests.indexOf(request);
		if (index !== -1) {
			requests.splice(index, 1);
		}
		if (requests.length === 0) {
			requestsByName.delete(request.name);
		}
	}
}

function createAbortError() {
	return new DOMException('The lock request was aborted.', 'AbortError');
}
