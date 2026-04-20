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
>;

/**
 * Creates a proxy that distributes method calls and property accesses
 * across a pool of object instances. Only one ongoing access per
 * instance is allowed at a time. If all instances are busy, accesses
 * wait until one becomes free.
 *
 * The returned proxy provides a promisified version of the original
 * interface: method calls and property accesses all return promises.
 */
export function createObjectPoolProxy<T extends object>(
	instances: T[]
): Pooled<T> {
	if (instances.length === 0) {
		throw new Error('At least one instance is required');
	}

	const freeInstances: T[] = [...instances];
	const waitQueue: Array<(instance: T) => void> = [];

	function acquire(): Promise<T> {
		const free = freeInstances.shift();
		if (free !== undefined) {
			return Promise.resolve(free);
		}
		return new Promise<T>((resolve) => {
			waitQueue.push(resolve);
		});
	}

	function release(instance: T): void {
		const waiter = waitQueue.shift();
		if (waiter) {
			waiter(instance);
		} else {
			freeInstances.push(instance);
		}
	}

	function withInstance<R>(fn: (instance: T) => R | Promise<R>): Promise<R> {
		return acquire().then((instance) => {
			let result: R | Promise<R>;
			try {
				result = fn(instance);
			} catch (e) {
				release(instance);
				throw e;
			}
			if (result != null && typeof (result as any).then === 'function') {
				return (result as Promise<R>).then(
					(val) => {
						release(instance);
						return val;
					},
					(err) => {
						release(instance);
						throw err;
					}
				);
			}
			release(instance);
			return result as R;
		});
	}

	return new Proxy({} as Pooled<T>, {
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
