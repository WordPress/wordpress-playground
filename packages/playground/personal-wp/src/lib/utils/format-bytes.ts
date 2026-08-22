export function formatBytes(bytes: number, decimals = 2): string {
	if (bytes === 0) return '0 B';
	// toFixed() throws a RangeError outside 0..100 or for non-integers.
	const precision = Math.min(Math.max(Math.trunc(decimals) || 0, 0), 100);
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.min(
		Math.floor(Math.log(bytes) / Math.log(k)),
		sizes.length - 1
	);
	return `${parseFloat((bytes / Math.pow(k, i)).toFixed(precision))} ${sizes[i]}`;
}
