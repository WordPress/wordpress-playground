export function formatBytes(bytes: number, decimals = 2): string {
	if (bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.min(
		Math.floor(Math.log(bytes) / Math.log(k)),
		sizes.length - 1
	);
	return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}
