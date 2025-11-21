export function shouldRenderProgress(
	writeStream?: { isTTY?: boolean } | null
): boolean {
	if (process.env['CI'] === 'true' || process.env['CI'] === '1') {
		return false;
	}
	if (
		process.env['GITHUB_ACTIONS'] === 'true' ||
		process.env['GITHUB_ACTIONS'] === '1'
	) {
		return false;
	}
	if ((process.env['TERM'] || '').toLowerCase() === 'dumb') {
		return false;
	}
	if (writeStream) {
		return Boolean(writeStream.isTTY);
	}
	return process.stdout.isTTY;
}
