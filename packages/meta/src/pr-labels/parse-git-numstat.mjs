/**
 * Parse `git diff --numstat -z` output into per-file change stats. This is the
 * one `git diff` the whole Auto-label flow runs off: its paths feed the
 * path-glob labels and its line counts feed the package ranking.
 *
 * The runner passes `-z`, so each record is "<added>\t<deleted>\t<path>" and is
 * terminated by a NUL byte, with the path VERBATIM. That matters: without `-z`,
 * git quotes any path with an "unusual" byte (a tab, non-ASCII) as
 * "..\t.." — and a quoted path matches no package prefix or glob, so the file
 * would be silently unlabeled. A verbatim path may itself contain a tab, so we
 * split each record on tabs and rejoin everything after the two counts.
 *
 * Binary files (e.g. recompiled PHP.wasm) report "-" for the counts; we treat
 * those as 0 lines — the file still counts toward its package. Getting this
 * right is what lets labeling work on binary-heavy PRs, the whole reason we
 * moved off pulls.listFiles: a "-" leaking through as NaN would zero out every
 * package label on exactly those PRs.
 *
 * @param {string} stdout - Raw `git diff --numstat -z` output.
 * @returns {{ path: string, lines: number }[]}
 */
export function parseGitNumstat(stdout) {
	return stdout
		.split('\0')
		.filter(Boolean)
		.map((record) => {
			const [added, deleted, ...pathParts] = record.split('\t');
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
