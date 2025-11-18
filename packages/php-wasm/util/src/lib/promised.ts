// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
type PromisedMethod<T extends (...args: any[]) => any> = (
	...args: Parameters<T>
) => Promise<ReturnType<T>>;

export type Promised<T> = {
	[P in keyof T]: T[P] extends (...args: any[]) => any
		? PromisedMethod<T[P]>
		: T[P];
};

/**
 * Wraps a synchronous interface as a promised interface.
 *
 * This function tries to avoid wrapping methods inherited from
 * built-in JS object types (e.g., `Object`, `Array`, `Function`, etc.).
 *
 * The initial use case for this function is for unit testing
 * file locking in php-wasm. Php-wasm for JSPI expects the file lock manager
 * to be a promised interface used via comlink,
 * but the interface itself is synchronous.
 *
 * @param obj
 * @returns A promised interface that wraps the synchronous interface.
 */
export function wrapSynchronousInterfaceAsPromised<T extends object>(
	obj: T
): Promised<T> {
	const keysAlreadySeen = new Set<string | symbol>();
	const keysToMakePromised = new Set<string | symbol>();
	const looksLikeBuiltInObject =
		// NOTE: We don't generally add custom things to the global scope,
		// so let's use this as a heuristic to determine if an object is a built-in object type.
		(obj: object) =>
			(globalThis as any)[obj.constructor.name] !== obj.constructor;

	let proto: object = obj;
	while (proto !== null && !looksLikeBuiltInObject(proto)) {
		const allKeys = [
			...Object.getOwnPropertyNames(proto),
			...Object.getOwnPropertySymbols(proto),
		];
		for (const key of allKeys) {
			if (
				// Track keys already seen so an inherited method property
				// masked by a descendant property of the same name is not considered.
				!keysAlreadySeen.has(key) &&
				!keysToMakePromised.has(key) &&
				typeof (proto as any)[key] === 'function'
			) {
				keysToMakePromised.add(key);
			}
			keysAlreadySeen.add(key);
		}
		proto = Object.getPrototypeOf(proto);
	}

	// NOTE: We could use Proxy here instead,
	// but providing a regular object is ultimately simpler.
	const promisifiedObj = Object.create(obj);
	for (const key of keysToMakePromised) {
		promisifiedObj[key] = function (...args: any[]) {
			return Promise.resolve((obj as any)[key](...args));
		};
	}
	return promisifiedObj;
}
