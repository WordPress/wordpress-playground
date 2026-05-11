export function shouldAutoBackup(
	interval: string | undefined,
	referenceTimestamp?: number
): boolean {
	if (!interval || interval === 'none' || interval === 'ignore') {
		return false;
	}
	if (!referenceTimestamp) {
		return true;
	}

	const daysSinceReference =
		(Date.now() - referenceTimestamp) / (1000 * 60 * 60 * 24);

	switch (interval) {
		case 'daily':
			return daysSinceReference >= 1;
		case 'every-2-days':
			return daysSinceReference >= 2;
		case 'weekly':
			return daysSinceReference >= 7;
		default:
			return false;
	}
}
