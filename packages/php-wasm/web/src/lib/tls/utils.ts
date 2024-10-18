export function flipObject(obj: Record<any, any>) {
	return Object.fromEntries(Object.entries(obj).map(([k, v]) => [v, k]));
}
