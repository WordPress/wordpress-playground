import type { MountDescriptor, PlaygroundClient } from '@wp-playground/remote';

const SITE_RUNTIME_LOCK_PREFIX = 'wordpress-playground-site-runtime:';
const DEFAULT_EXCLUSIVE_WAIT_MS = 500;

const siteBootAbortControllers = new Map<string, AbortController>();
const runtimeLocksBySignal = new WeakMap<AbortSignal, RuntimeLockLease>();

type RuntimeLockLease = {
	acquired: Promise<void>;
	release: () => void;
	released: Promise<void>;
	isReleaseRequested: () => boolean;
};

export type SiteRuntimeSuspension = {
	/** Restores the runtime after exclusive access was not obtained. */
	restore: () => Promise<void>;
	/** Abandons the old runtime after destructive work started. */
	discard: () => Promise<void> | void;
};

type ExclusiveSiteRuntimeLockOptions = {
	/** Stops this tab's runtime so the queued exclusive lock can be granted. */
	suspendCurrentRuntime?: () => Promise<SiteRuntimeSuspension | undefined>;
	/** Maximum time to wait for runtimes in other tabs to release the site. */
	timeoutMs?: number;
	/** Allows a failed operation that made no durable changes to resume the runtime. */
	canRestoreAfterOperationFailure?: (error: unknown) => boolean;
};

/** Reports that another tab kept a site's runtime mounted during a mutation. */
export class SiteRuntimeLockUnavailableError extends Error {
	constructor(siteSlug: string) {
		super(
			`Cannot modify ${siteSlug} while it is open in another tab. Close the other tab and try again.`
		);
		this.name = 'SiteRuntimeLockUnavailableError';
	}
}

/** Carries a detached runtime that can be restored after lock request cancellation. */
class SiteRuntimeSuspensionError extends Error {
	readonly originalError: unknown;
	readonly suspension: SiteRuntimeSuspension;

	constructor(originalError: unknown, suspension: SiteRuntimeSuspension) {
		super('Could not cleanly suspend the current Playground runtime.');
		this.name = 'SiteRuntimeSuspensionError';
		this.originalError = originalError;
		this.suspension = suspension;
	}
}

/** Creates and registers the abort controller that owns one site's current boot. */
export function createSiteBootAbortController(siteSlug: string) {
	siteBootAbortControllers.get(siteSlug)?.abort();
	const controller = new AbortController();
	siteBootAbortControllers.set(siteSlug, controller);
	controller.signal.addEventListener(
		'abort',
		() => {
			if (siteBootAbortControllers.get(siteSlug) === controller) {
				siteBootAbortControllers.delete(siteSlug);
			}
		},
		{ once: true }
	);
	return controller;
}

/** Aborts the current iframe boot before destructive work touches its files. */
export function abortSiteBoot(siteSlug: string) {
	siteBootAbortControllers.get(siteSlug)?.abort();
}

/** Returns the signal owned by the iframe currently booting this site. */
export function getCurrentSiteBootSignal(siteSlug: string) {
	return siteBootAbortControllers.get(siteSlug)?.signal;
}

/** Acquires the runtime lock for a temporary iframe that just became OPFS-backed. */
export async function acquireCurrentSiteRuntimeLock(siteSlug: string) {
	if (typeof navigator === 'undefined' || !navigator.locks) {
		return;
	}
	const controller = siteBootAbortControllers.get(siteSlug);
	if (!controller) {
		throw new Error(`Cannot find the active Playground boot: ${siteSlug}`);
	}
	await acquireSiteRuntimeLock(siteSlug, controller.signal);
}

/** Releases this tab's shared runtime lock after its OPFS mount is detached. */
export async function releaseCurrentSiteRuntimeLock(siteSlug: string) {
	const signal = siteBootAbortControllers.get(siteSlug)?.signal;
	if (!signal) {
		return;
	}
	await releaseSiteRuntimeLock(signal);
}

/** Releases the shared runtime lease associated with one boot signal. */
export async function releaseSiteRuntimeLock(signal: AbortSignal) {
	const lease = runtimeLocksBySignal.get(signal);
	if (!lease) {
		return;
	}
	lease.release();
	await lease.released;
}

/**
 * Detaches this tab's OPFS mount without abandoning its iframe boot.
 *
 * A failed exclusive-lock attempt can restore the same client and shared lock.
 * Destructive work calls `discard` instead, which aborts stale callbacks and
 * removes the client from application state through `onDiscard`.
 */
export async function suspendCurrentSiteRuntime({
	siteSlug,
	playground,
	mountDescriptor,
	onDiscard,
}: {
	siteSlug: string;
	playground: PlaygroundClient;
	mountDescriptor: Omit<MountDescriptor, 'initialSyncDirection'>;
	onDiscard: () => void;
}): Promise<SiteRuntimeSuspension> {
	const bootSignal = getCurrentSiteBootSignal(siteSlug);
	if (!bootSignal) {
		throw new Error(`Cannot find the active Playground boot: ${siteSlug}`);
	}
	// Report existing persistence failures before detach. `unmountOpfs()` then
	// performs a final flush and leaves the mount attached if that commit fails.
	await playground.flushOpfs(mountDescriptor.mountpoint);
	let suspensionError: unknown;
	try {
		await playground.unmountOpfs(mountDescriptor.mountpoint);
	} catch (error) {
		let mountIsStillActive = true;
		try {
			mountIsStillActive = await playground.hasOpfsMount(
				mountDescriptor.mountpoint
			);
		} catch {
			// Without a reliable mount-state check, keep the shared lease. It is
			// safer to block destructive work than to overlap a live journal.
		}
		if (mountIsStillActive) {
			throw error;
		}
		suspensionError = error;
	}
	try {
		// A successful unmount, or the mount-state check above, proves remote
		// tracking is clear. Release the lease; the exclusive-lock owner cancels
		// its queued request before it attempts safe restoration.
		await releaseSiteRuntimeLock(bootSignal);
	} catch (error) {
		suspensionError ??= error;
	}
	let discarded = false;
	const suspension: SiteRuntimeSuspension = {
		restore: async () => {
			if (
				discarded ||
				bootSignal.aborted ||
				getCurrentSiteBootSignal(siteSlug) !== bootSignal
			) {
				return;
			}
			try {
				await acquireSiteRuntimeLock(siteSlug, bootSignal);
				if (
					bootSignal.aborted ||
					getCurrentSiteBootSignal(siteSlug) !== bootSignal
				) {
					await releaseSiteRuntimeLock(bootSignal);
					return;
				}
				await playground.mountOpfs({
					...mountDescriptor,
					// Another tab kept the shared lock that caused this reset to
					// time out. Pull its authoritative changes into this runtime;
					// never push this tab's now-stale MEMFS snapshot over them.
					initialSyncDirection: 'opfs-to-memfs',
				});
				if (
					bootSignal.aborted ||
					getCurrentSiteBootSignal(siteSlug) !== bootSignal
				) {
					try {
						await playground.unmountOpfs(
							mountDescriptor.mountpoint
						);
					} finally {
						await releaseSiteRuntimeLock(bootSignal);
					}
				}
			} catch (error) {
				discarded = true;
				if (getCurrentSiteBootSignal(siteSlug) === bootSignal) {
					abortSiteBoot(siteSlug);
					onDiscard();
				}
				throw error;
			}
		},
		discard: () => {
			if (discarded) {
				return;
			}
			discarded = true;
			if (getCurrentSiteBootSignal(siteSlug) === bootSignal) {
				abortSiteBoot(siteSlug);
				onDiscard();
			}
		},
	};
	if (suspensionError) {
		// `runWithExclusiveSiteRuntimeLock()` queued its exclusive request
		// before this detach. It must cancel that request before restoration
		// can reacquire a shared lease, otherwise the two requests deadlock.
		throw new SiteRuntimeSuspensionError(suspensionError, suspension);
	}
	return suspension;
}

/**
 * Holds a shared browser lock for as long as one iframe may write a site's OPFS.
 *
 * The returned promise resolves after the lock is acquired. A reset may release
 * and later reacquire the lease without aborting the iframe boot; aborting the
 * boot always releases its current lease.
 */
export async function acquireSiteRuntimeLock(
	siteSlug: string,
	signal: AbortSignal
): Promise<void> {
	if (
		signal.aborted ||
		typeof navigator === 'undefined' ||
		!navigator.locks
	) {
		return;
	}

	const existingLease = runtimeLocksBySignal.get(signal);
	if (existingLease) {
		await existingLease.acquired;
		if (!existingLease.isReleaseRequested()) {
			return;
		}
		await existingLease.released;
		if (signal.aborted) {
			return;
		}
	}

	let resolveAcquired = () => {};
	let rejectAcquired = (_error: unknown) => {};
	const acquired = new Promise<void>((resolve, reject) => {
		resolveAcquired = resolve;
		rejectAcquired = reject;
	});
	let resolveRelease = () => {};
	let releaseRequested = false;
	const releaseRequestedPromise = new Promise<void>((resolve) => {
		resolveRelease = resolve;
	});

	const lockRequest = navigator.locks.request(
		getSiteRuntimeLockName(siteSlug),
		{ mode: 'shared', signal },
		async () => {
			resolveAcquired();
			await Promise.race([releaseRequestedPromise, waitForAbort(signal)]);
		}
	);
	void lockRequest.catch((error) => {
		if (signal.aborted && isAbortError(error)) {
			resolveAcquired();
			return;
		}
		rejectAcquired(error);
	});
	const released = lockRequest.then(
		() => undefined,
		() => undefined
	);
	const lease: RuntimeLockLease = {
		acquired,
		release: () => {
			if (!releaseRequested) {
				releaseRequested = true;
				resolveRelease();
			}
		},
		released,
		isReleaseRequested: () => releaseRequested,
	};
	runtimeLocksBySignal.set(signal, lease);
	void released.then(() => {
		if (runtimeLocksBySignal.get(signal) === lease) {
			runtimeLocksBySignal.delete(signal);
		}
	});
	await acquired;
}

/**
 * Runs destructive work only after every runtime has released the site's OPFS.
 *
 * The exclusive request is queued before this tab unmounts its runtime. Waiting
 * is bounded: if another tab keeps the site open, this tab restores its mount
 * instead of remaining clientless. Once `operation` starts, the old runtime is
 * discarded because a partial reset may have changed durable files.
 */
export async function runWithExclusiveSiteRuntimeLock<T>(
	siteSlug: string,
	operation: () => Promise<T>,
	options: ExclusiveSiteRuntimeLockOptions = {}
): Promise<T> {
	if (typeof navigator === 'undefined' || !navigator.locks) {
		let suspension: SiteRuntimeSuspension | undefined;
		try {
			suspension = await options.suspendCurrentRuntime?.();
		} catch (error) {
			if (error instanceof SiteRuntimeSuspensionError) {
				await error.suspension.restore();
				throw error.originalError;
			}
			throw error;
		}
		try {
			const result = await operation();
			await suspension?.discard();
			return result;
		} catch (error) {
			if (options.canRestoreAfterOperationFailure?.(error)) {
				await suspension?.restore();
			} else {
				await suspension?.discard();
			}
			throw error;
		}
	}

	const requestController = new AbortController();
	let resolveRuntimeReleased = () => {};
	const runtimeReleased = new Promise<void>((resolve) => {
		resolveRuntimeReleased = resolve;
	});
	let suspensionFailure: unknown;
	let suspensionFailed = false;
	let operationStarted = false;
	const exclusiveRequest = navigator.locks.request(
		getSiteRuntimeLockName(siteSlug),
		{ mode: 'exclusive', signal: requestController.signal },
		async () => {
			await runtimeReleased;
			if (suspensionFailed) {
				throw suspensionFailure;
			}
			operationStarted = true;
			return operation();
		}
	);

	let suspension: SiteRuntimeSuspension | undefined;
	try {
		suspension = await options.suspendCurrentRuntime?.();
		resolveRuntimeReleased();
	} catch (error) {
		suspensionFailed = true;
		suspensionFailure = error;
		resolveRuntimeReleased();
		requestController.abort();
		await exclusiveRequest.catch(() => undefined);
		if (error instanceof SiteRuntimeSuspensionError) {
			await error.suspension.restore();
			throw error.originalError;
		}
		throw error;
	}

	const timeout = setTimeout(
		() => requestController.abort(),
		options.timeoutMs ?? DEFAULT_EXCLUSIVE_WAIT_MS
	);
	try {
		const result = await exclusiveRequest;
		await suspension?.discard();
		return result;
	} catch (error) {
		if (
			!operationStarted ||
			options.canRestoreAfterOperationFailure?.(error)
		) {
			await suspension?.restore();
		} else {
			await suspension?.discard();
		}
		if (!operationStarted && isAbortError(error)) {
			throw new SiteRuntimeLockUnavailableError(siteSlug);
		}
		throw error;
	} finally {
		clearTimeout(timeout);
	}
}

/** Returns the browser-wide lock name for one mounted site runtime. */
function getSiteRuntimeLockName(siteSlug: string) {
	return `${SITE_RUNTIME_LOCK_PREFIX}${siteSlug}`;
}

/** Keeps a granted shared lock alive until its iframe boot is aborted. */
function waitForAbort(signal: AbortSignal) {
	if (signal.aborted) {
		return Promise.resolve();
	}
	return new Promise<void>((resolve) => {
		signal.addEventListener('abort', () => resolve(), { once: true });
	});
}

/** Checks whether a Web Locks request ended because its signal was aborted. */
function isAbortError(error: unknown): boolean {
	return (
		(error instanceof DOMException && error.name === 'AbortError') ||
		(typeof error === 'object' &&
			error !== null &&
			'name' in error &&
			(error as { name?: unknown }).name === 'AbortError')
	);
}
