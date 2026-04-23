/**
 * Converts an object type to a promisified version where:
 * - Methods return `Promise<Awaited<ReturnType>>` (no double-wrapping)
 * - Properties become `Promise<Awaited<PropertyType>>`
 */
type Promisified<T extends object> = {
	[K in keyof T]: T[K] extends (...args: infer A) => infer R
		? (...args: A) => Promise<Awaited<R>>
		: Promise<Awaited<T[K]>>;
};

/**
 * The type returned by `createObjectPoolProxy`. All method calls and
 * property accesses are wrapped in promises because acquiring a free
 * pool instance is inherently async.
 *
 * Dispose/asyncDispose symbols are omitted because the pool proxy
 * forwards calls to a single random instance — disposing one
 * instance out of the pool is never the intended behavior. Pool
 * lifecycle should be managed by the code that created the pool.
 */
export type Pooled<T extends object> = Omit<
	Promisified<T>,
	typeof Symbol.dispose | typeof Symbol.asyncDispose
> & {
	/**
	 * Remove an instance from the pool. If the instance is currently
	 * free, it is removed immediately. If it is busy (acquired by a
	 * pending call), it will be discarded when that call releases it
	 * instead of being returned to the free list.
	 *
	 * This is useful when a worker thread backing a pool instance
	 * crashes — removing it prevents the pool from routing new
	 * requests to a dead worker.
	 */
	__removeInstance(instance: unknown): void;
};

/**
 * Creates a proxy that distributes method calls and property accesses
 * across a pool of object instances. Only one ongoing access per
 * instance is allowed at a time. If all instances are busy, accesses
 * wait until one becomes free.
 *
 * The returned proxy provides a promisified version of the original
 * interface: method calls and property accesses all return promises.
 *
 * Methods may return streamed response objects whose work continues
 * after the method promise resolves. When a returned value exposes a
 * `finished` promise, the pool keeps the instance checked out until
 * that promise settles.
 */
export function createObjectPoolProxy<T extends object>(
	instances: T[]
): Pooled<T> {
	if (instances.length === 0) {
		throw new Error('At least one instance is required');
	}

	// Copy the caller's array so pool eviction (via __removeInstance)
	// never mutates input the caller may still hold a reference to.
	// `freeInstances` and `allInstances` are both owned by the pool.
	const allInstances: T[] = [...instances];
	const freeInstances: T[] = [...instances];
	// Waiters hold both resolve and reject so capacity loss
	// (see removeInstance below) can fail them with a clear error
	// instead of leaving them hung on acquire() forever.
	interface Waiter {
		resolve: (instance: T) => void;
		reject: (error: Error) => void;
	}
	const waitQueue: Waiter[] = [];
	const removedInstances = new Set<T>();

	function removeInstance(instance: unknown): void {
		const inst = instance as T;

		// Remove from the canonical list
		const idx = allInstances.indexOf(inst);
		if (idx !== -1) {
			allInstances.splice(idx, 1);
		}

		// Remove from the free list if it's currently free
		const freeIdx = freeInstances.indexOf(inst);
		if (freeIdx !== -1) {
			freeInstances.splice(freeIdx, 1);
		} else {
			// Instance is currently busy — mark it for removal on release
			removedInstances.add(inst);
		}

		// If the pool has drained to zero capacity, fail any queued
		// waiters with a clear error instead of letting them hang
		// forever. Without this, a caller awaiting acquire() when the
		// last worker dies would deadlock: no instance will ever be
		// released back to wake them.
		if (allInstances.length === 0 && waitQueue.length > 0) {
			const waiters = waitQueue.splice(0, waitQueue.length);
			for (const waiter of waiters) {
				waiter.reject(
					new Error(
						'Pool is empty: all instances have been removed ' +
							'(likely because every worker crashed). ' +
							'Pending acquisitions cannot be satisfied.'
					)
				);
			}
		}
	}

	function acquire(): Promise<T> {
		const free = freeInstances.shift();
		if (free !== undefined) {
			return Promise.resolve(free);
		}
		if (allInstances.length === 0) {
			// Pool was drained before this acquire() was called.
			// Fail fast instead of pushing onto a queue that will
			// never drain.
			return Promise.reject(
				new Error(
					'Pool is empty: cannot acquire an instance from ' +
						'a pool with zero capacity.'
				)
			);
		}
		return new Promise<T>((resolve, reject) => {
			waitQueue.push({ resolve, reject });
		});
	}

	function release(instance: T): void {
		// If this instance was marked for removal while busy, discard it
		if (removedInstances.has(instance)) {
			removedInstances.delete(instance);
			return;
		}

		const waiter = waitQueue.shift();
		if (waiter) {
			waiter.resolve(instance);
		} else {
			freeInstances.push(instance);
		}
	}

	function withInstance<R>(fn: (instance: T) => R | Promise<R>): Promise<R> {
		return acquire().then((instance) => {
			const releaseWhenComplete = (value: R): R => {
				// `.finished` means this is a streamed response class.
				// Keep the instance checked out until streaming settles.
				const finished = (value as any)?.finished;
				if (finished && typeof finished.then === 'function') {
					Promise.resolve(finished).then(
						() => release(instance),
						() => release(instance)
					);
				} else {
					release(instance);
				}
				return value;
			};

			let result: R | Promise<R>;
			try {
				result = fn(instance);
			} catch (e) {
				release(instance);
				throw e;
			}
			if (result != null && typeof (result as any).then === 'function') {
				return (result as Promise<R>).then(
					(val) => releaseWhenComplete(val),
					(err) => {
						release(instance);
						throw err;
					}
				);
			}
			return releaseWhenComplete(result as R);
		});
	}

	const proxyTarget = {} as Pooled<T>;
	// Expose __removeInstance directly on the target so it's found
	// by the `prop in _target` check before hitting the proxy trap.
	(proxyTarget as any).__removeInstance = removeInstance;

	return new Proxy(proxyTarget, {
		get(_target, prop: string | symbol) {
			// Support returning assigned target properties.
			// The main reason for this is to allow us to override methods
			// for testing purposes.
			// TODO: Add test for this feature?
			if (prop in _target) {
				return (_target as any)[prop];
			}

			// Prevent the proxy from being treated as a thenable,
			// which would interfere with Promise resolution.
			if (prop === 'then') {
				return undefined;
			}

			// Return a dual-purpose proxy that works as both a method call
			// and a property access. This mirrors how comlink proxies handle
			// the ambiguity — the call site determines the behavior:
			//   - playground.run(opts)       → apply trap → method call
			//   - await playground.docroot   → .then accessed → property get
			//
			// We can't sample typeof on the instance to decide, because
			// comlink proxies are always functions regardless of whether
			// the remote value is a method or a property.
			return new Proxy(function () {}, {
				apply(_target, _thisArg, args: any[]) {
					return withInstance((inst) => (inst as any)[prop](...args));
				},
				get(_target, innerProp) {
					if (innerProp === 'then') {
						return (resolve: any, reject: any) =>
							withInstance((inst) => (inst as any)[prop]).then(
								resolve,
								reject
							);
					}
					return undefined;
				},
			});
		},
	});
}
