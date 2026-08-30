/**
 * Parse `git diff --numstat` output into per-file change stats. This is the one
 * `git diff` the whole Auto-label flow runs off: its paths feed the path-glob
 * labels and its line counts feed the package ranking.
 *
 * Each line is "<added>\t<deleted>\t<path>". Binary files (e.g. recompiled
 * PHP.wasm) report "-" for the counts; we treat those as 0 lines — the file
 * still counts toward its package. Getting this right is what lets labeling
 * work on binary-heavy PRs, which is the whole reason we moved off
 * pulls.listFiles: a "-" leaking through as NaN would zero out every package
 * label on exactly those PRs.
 *
 * @param {string} stdout - Raw `git diff --numstat` output.
 * @returns {{ path: string, lines: number }[]}
 */
export function parseGitNumstat(stdout) {
	return stdout
		.split('\n')
		.filter(Boolean)
		.map((line) => {
			const [added, deleted, ...pathParts] = line.split('\t');
			return {
				path: pathParts.join('\t'),
				lines: toLines(added) + toLines(deleted),
			};
		});
}

// "-" marks a binary file (no line count); treat it as 0 lines.
function toLines(count) {
	return count === '-' ? 0 : Number(count);
}
