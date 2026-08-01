/**
 * Rewrites relative PHP include/require paths to paths relative to
 * the file itself. Playground runs PHP requests with CWD set to the
 * document root, while old WordPress admin scripts assume CWD is the
 * script directory.
 *
 * Each pattern anchors the keyword to a non-word boundary (`(^|[^\w$])`)
 * so identifiers that merely end in `require`/`include` — e.g.
 * `my_require_once(...)` — are left untouched. A negative lookbehind
 * would be cleaner but isn't supported on older Safari, so the boundary
 * character is captured and re-emitted instead.
 */
export function rewriteRelativePhpIncludes(content: string): string {
	const patterns = [
		// Parenthesized forms.
		/(^|[^\w$])((?:require|include)(?:_once)?)\s*\(\s*(['"])(\.\.\/[^'"]+)\3\s*\)/g,
		/(^|[^\w$])((?:require|include)(?:_once)?)\s*\(\s*(['"])(\.\/[^'"]+)\3\s*\)/g,
		// Bare filename (e.g. 'admin-header.php'). Restrict to .php to
		// avoid false positives.
		/(^|[^\w$])((?:require|include)(?:_once)?)\s*\(\s*(['"])([a-z][\w-]*\.php)\3\s*\)/g,
		// Statement forms without parentheses (WP 2.0 uses this).
		/(^|[^\w$])((?:require|include)(?:_once)?)\s+(['"])(\.\.\/[^'"]+)\3/g,
		/(^|[^\w$])((?:require|include)(?:_once)?)\s+(['"])(\.\/[^'"]+)\3/g,
		/(^|[^\w$])((?:require|include)(?:_once)?)\s+(['"])([a-z][\w-]*\.php)\3/g,
	];
	return patterns.reduce(
		(text, pattern) =>
			text.replace(
				pattern,
				(_, pre, keyword, _q, path) =>
					`${pre}${keyword}(${toDirnameExpr(path)})`
			),
		content
	);
}

function toDirnameExpr(relPath: string): string {
	let remaining = relPath;
	let upLevels = 0;
	while (remaining.startsWith('../')) {
		upLevels++;
		remaining = remaining.slice(3);
	}
	while (remaining.startsWith('./')) {
		remaining = remaining.slice(2);
	}
	let dirExpr = 'dirname(__FILE__)';
	for (let i = 0; i < upLevels; i++) {
		dirExpr = `dirname(${dirExpr})`;
	}
	return `${dirExpr} . '/${remaining}'`;
}
