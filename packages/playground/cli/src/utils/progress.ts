export function shouldRenderProgress(
	writeStream?: { isTTY?: boolean } | null
): boolean {
	const termIsDumb = (process.env['TERM'] || '').toLowerCase() === 'dumb';
	const ciFlag = (process.env['CI'] || '').toLowerCase();
	const runningInCI = ciFlag === '1' || ciFlag === 'true';

	if (termIsDumb || runningInCI) {
		return false;
	}

	if (writeStream) {
		return Boolean(writeStream.isTTY);
	}

	return true;
}
