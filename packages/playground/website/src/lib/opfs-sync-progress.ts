/**
 * Turns OPFS file-count progress into the bounded 0–100 percentage shown by both
 * the dock save-status ring and the active Playground's row in the Playgrounds
 * list. Returns 0 when progress is unavailable or hasn't started.
 */
export function getOpfsSyncProgressPercent(
	progress: { files: number; total: number } | undefined | null
): number {
	if (!progress || progress.total <= 0) {
		return 0;
	}
	return Math.min(100, Math.round((progress.files / progress.total) * 100));
}
