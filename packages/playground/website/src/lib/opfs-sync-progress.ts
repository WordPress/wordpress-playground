/**
 * Turns OPFS file-count progress into a bounded 0–100 percentage for save
 * progress indicators. Returns 0 when progress is unavailable or hasn't started.
 */
export function getOpfsSyncProgressPercent(
	progress: { files: number; total: number } | undefined | null
): number {
	if (!progress || progress.total <= 0) {
		return 0;
	}
	return Math.max(
		0,
		Math.min(100, Math.round((progress.files / progress.total) * 100))
	);
}
