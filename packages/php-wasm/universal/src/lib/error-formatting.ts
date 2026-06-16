/**
 * Describe an error for display. Handles Error instances, Comlink-serialized
 * plain objects (which lose their Error prototype during worker thread
 * transfer), and arbitrary values.
 */
export function describeError(
	error: unknown,
	seen = new WeakSet<object>(),
	depth = 0,
	options: { suppressGenericErrorName?: boolean } = {}
): string {
	if (depth > 10) {
		return '[Max error cause depth exceeded]';
	}
	if (error instanceof Error) {
		if (error.message) {
			return error.message;
		}
		return describeErrorObject(error, seen, depth, {
			...options,
			suppressGenericErrorName: true,
		});
	}
	if (error && typeof error === 'object') {
		return describeErrorObject(error, seen, depth, options);
	}
	return String(error);
}

type ErrorLikeObject = object & {
	name?: unknown;
	message?: unknown;
	cause?: unknown;
	errno?: unknown;
	code?: unknown;
	stack?: unknown;
};

function describeErrorObject(
	error: ErrorLikeObject,
	seen: WeakSet<object>,
	depth: number,
	options: { suppressGenericErrorName?: boolean } = {}
): string {
	if (seen.has(error)) {
		return '[Circular error cause]';
	}
	seen.add(error);

	// Comlink-serialized errors arrive as plain objects like
	// { name: 'ErrnoError', errno: 20 } with no .message.
	const parts = [];
	if (
		error['name'] &&
		!(options.suppressGenericErrorName && error['name'] === 'Error')
	) {
		parts.push(String(error['name']));
	}
	if (error['message']) {
		parts.push(String(error['message']));
	}
	if (error['errno'] !== undefined) {
		parts.push(`errno: ${error['errno']}`);
	}
	if (error['code'] !== undefined) {
		parts.push(`code: ${error['code']}`);
	}
	if (error['cause']) {
		parts.push(
			`caused by: ${describeError(
				error['cause'],
				seen,
				depth + 1,
				options
			)}`
		);
	}
	if (parts.length > 0) {
		return parts.join(' — ');
	}
	if (typeof error['stack'] === 'string') {
		return error['stack'];
	}
	// Last resort: JSON-serialize the object so we at least see
	// what fields it has.
	try {
		return JSON.stringify(error);
	} catch {
		return String(error);
	}
}
