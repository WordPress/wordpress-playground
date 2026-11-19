/**
 * Formats a byte count for display in progress captions, e.g. "17.9 MB".
 */
export function formatBytes(bytes: number): string {
	if (bytes < 1024) {
		return `${bytes} B`;
	}
	const megabytes = bytes / 1024 / 1024;
	if (megabytes >= 1) {
		return `${megabytes.toFixed(1)} MB`;
	}
	const kilobytes = bytes / 1024;
	return `${kilobytes.toFixed(0)} KB`;
}
