import { execFileSync } from 'node:child_process';

/**
 * Run `git diff --numstat` between two commits and return per-file change stats
 * — the one `git diff` the whole Auto-label flow runs off. Its paths feed the
 * path-glob labels and its line counts feed the package ranking.
 *
 * This module OWNS the numstat invocation, so the flags that make the output
 * machine-parseable live right next to the parser that depends on them:
 *
 *   -z            NUL-terminated records with VERBATIM (unquoted) paths.
 *                 Without it, git quotes any path with an "unusual" byte (a tab,
 *                 non-ASCII) as "..\t.." — and a quoted path matches no package
 *                 prefix or glob, so the file would be silently unlabeled.
 *   --no-renames  report a rename as a literal delete + add (full paths), not
 *                 git's brace-compressed "a/{old => new}/b" form (also unmatchable).
 *
 * A big PR's diff output can exceed execFileSync's 1 MiB default buffer, which
 * would throw ENOBUFS and fail the job — the opposite of handling large PRs — so
 * raise maxBuffer.
 *
 * @param {string} baseSha - Commit to diff from (PR base).
 * @param {string} head - Commit to diff to (PR head).
 * @returns {{ path: string, lines: number }[]}
 */
export function changedFileStats(baseSha, head) {
	const stdout = execFileSync(
		'git',
		['diff', '--numstat', '-z', '--no-renames', `${baseSha}...${head}`],
		{ maxBuffer: 64 * 1024 * 1024 }
	).toString();
	return parseGitNumstat(stdout);
}

/**
 * Parse `git diff --numstat -z` output into per-file change stats. Exported for
 * unit tests; production code should call changedFileStats() above.
 *
 * Each record is "<added>\t<deleted>\t<path>" terminated by a NUL byte, with the
 * path verbatim — so a path may itself contain a tab, which is why we split each
 * record on tabs and rejoin everything after the two counts.
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
