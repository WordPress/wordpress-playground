/**
 * Static scan for `self::`, `parent::`, and `static::` tokens that
 * appear OUTSIDE any class body in pretty-printed PHP source.
 *
 * PHP 5.2 (and every other PHP) treats those as a runtime fatal:
 *
 *   Fatal error: Cannot access self:: when no class scope is active
 *
 * The PHP 5.2 SAPI lint (`lint-php52.mjs`) only catches PARSE errors,
 * so this class of bug slips past it. The legacy WP boot test does
 * catch it, but only after a full WordPress request cycle. This scan
 * is a fast, deterministic check we can run right after the AST
 * downgrader to fail the build with a precise file:line.
 *
 * Algorithm: walk every `.php`/`.copy` file under the given directory
 * one character at a time, tracking:
 *
 *   - whether we are inside a `'`/`"` string literal (with backslash
 *     escapes) or a heredoc/nowdoc;
 *   - whether we are inside a `//`, `#`, or `/* … *\/` comment;
 *   - the brace depth at which the most recent `class`/`interface`/
 *     `trait` keyword was opened, so we know if the current `{`-level
 *     is still inside that class body.
 *
 * Whenever we encounter `self::`, `parent::`, or `static::` outside any
 * class body, record a violation with file path and line number.
 *
 * This is intentionally a token scan, not an AST walk: the input has
 * already been pretty-printed and re-tokenised would be 100x slower.
 * The simple state machine catches every violation we have seen in
 * practice, including refs inside hoisted top-level array literals,
 * top-level function bodies, and global expressions.
 *
 * Usage: node scripts/php52-downgrader/bin/scan-out-of-class-self.mjs <dir>
 *
 * Exits non-zero (with a diagnostic) on any violation.
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.argv[2];
if (!ROOT) {
	console.error('usage: scan-out-of-class-self.mjs <dir>');
	process.exit(2);
}

function findFiles(dir) {
	const out = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			out.push(...findFiles(full));
		} else if (/\.(php|copy)$/.test(entry.name)) {
			out.push(full);
		}
	}
	return out;
}

const files = findFiles(ROOT);

const violations = [];
for (const file of files) {
	const src = fs.readFileSync(file, 'utf-8');
	scanOne(file, src);
}

if (violations.length > 0) {
	console.error(
		`\nFAIL: ${violations.length} out-of-class self::/parent::/static:: violations\n`
	);
	for (const v of violations) {
		console.error(`  ${v.file}:${v.line}: ${v.snippet}`);
	}
	process.exit(1);
}
console.log(`scanned ${files.length} files, 0 out-of-class self:: violations`);

/**
 * Scans a single file. Pushes any out-of-class self/parent/static
 * scope-resolution into the shared `violations` array.
 *
 * State: brace depth and a stack of "class-opens" recording the brace
 * depth at which each currently-open class/interface/trait body began.
 * When we see `{` at depth N right after a class declaration, we push
 * N+1 onto the stack and increment depth. When `}` closes that depth,
 * we pop. The stack is non-empty iff we are inside a class body.
 *
 * Implementation note: PHP 5.2 has no traits, but the downgraded
 * output may still contain `interface` declarations, so we treat
 * interface/trait bodies as class scopes too.
 */
function scanOne(filePath, src) {
	const len = src.length;
	let i = 0;
	let line = 1;
	let inPhp = false;
	let braceDepth = 0;
	const classOpenDepths = [];
	let pendingClassDecl = false;

	while (i < len) {
		const ch = src[i];
		const next = src[i + 1];

		if (ch === '\n') line++;

		if (!inPhp) {
			// Look for `<?php` / `<?=` / `<?`.
			if (ch === '<' && next === '?') {
				inPhp = true;
				if (src.substr(i, 5).toLowerCase() === '<?php') {
					i += 5;
				} else {
					i += 2;
				}
				continue;
			}
			i++;
			continue;
		}

		// Closing tag.
		if (ch === '?' && next === '>') {
			inPhp = false;
			i += 2;
			continue;
		}

		// Line comment.
		if (ch === '/' && next === '/') {
			const nl = src.indexOf('\n', i);
			if (nl === -1) return;
			i = nl;
			continue;
		}
		// `#` line comment.
		if (ch === '#') {
			const nl = src.indexOf('\n', i);
			if (nl === -1) return;
			i = nl;
			continue;
		}
		// Block comment.
		if (ch === '/' && next === '*') {
			const end = src.indexOf('*/', i + 2);
			if (end === -1) return;
			for (let k = i; k < end + 2; k++) {
				if (src[k] === '\n') line++;
			}
			i = end + 2;
			continue;
		}

		// Strings.
		if (ch === "'") {
			i++;
			while (i < len) {
				if (src[i] === '\\' && src[i + 1] !== undefined) {
					i += 2;
					continue;
				}
				if (src[i] === '\n') line++;
				if (src[i] === "'") {
					i++;
					break;
				}
				i++;
			}
			continue;
		}
		if (ch === '"') {
			i++;
			while (i < len) {
				if (src[i] === '\\' && src[i + 1] !== undefined) {
					i += 2;
					continue;
				}
				if (src[i] === '\n') line++;
				if (src[i] === '"') {
					i++;
					break;
				}
				i++;
			}
			continue;
		}
		// Heredoc / nowdoc.
		if (ch === '<' && next === '<' && src[i + 2] === '<') {
			// `<<<LABEL` or `<<<'LABEL'` or `<<<"LABEL"`.
			let j = i + 3;
			while (j < len && /\s/.test(src[j]) && src[j] !== '\n') j++;
			let quote = '';
			if (src[j] === "'" || src[j] === '"') {
				quote = src[j];
				j++;
			}
			let label = '';
			while (j < len && /[A-Za-z0-9_]/.test(src[j])) {
				label += src[j];
				j++;
			}
			if (quote && src[j] === quote) j++;
			// Find end label at start-of-line.
			const endRe = new RegExp(`(^|\\n)\\s*${label}\\b`);
			const m = endRe.exec(src.slice(j));
			if (!m) return;
			const heredocEnd = j + m.index + m[0].length;
			for (let k = i; k < heredocEnd; k++) {
				if (src[k] === '\n') line++;
			}
			i = heredocEnd;
			continue;
		}

		// Braces.
		if (ch === '{') {
			braceDepth++;
			if (pendingClassDecl) {
				classOpenDepths.push(braceDepth);
				pendingClassDecl = false;
			}
			i++;
			continue;
		}
		if (ch === '}') {
			if (
				classOpenDepths.length > 0 &&
				classOpenDepths[classOpenDepths.length - 1] === braceDepth
			) {
				classOpenDepths.pop();
			}
			braceDepth--;
			i++;
			continue;
		}
		// `;` cancels a pending class decl (e.g. `class Foo;` doesn't exist
		// but `use Foo, Bar;` after an unrelated `class` keyword shouldn't
		// confuse the state).
		if (ch === ';' && pendingClassDecl) {
			pendingClassDecl = false;
		}

		// Class / interface / trait keyword.
		if (
			(ch === 'c' || ch === 'i' || ch === 't') &&
			isWordBoundary(src, i)
		) {
			const rest = src.slice(i, i + 10);
			let kwLen = 0;
			if (/^class\b/.test(rest) && !isClassConstantUse(src, i)) {
				kwLen = 5;
			} else if (/^interface\b/.test(rest)) {
				kwLen = 9;
			} else if (/^trait\b/.test(rest)) {
				kwLen = 5;
			}
			if (kwLen > 0) {
				pendingClassDecl = true;
				i += kwLen;
				continue;
			}
		}

		// The actual scan: self::, parent::, static::.
		if ((ch === 's' || ch === 'p') && isWordBoundary(src, i)) {
			const m = /^(self|parent|static)::/.exec(src.slice(i));
			if (m) {
				if (classOpenDepths.length === 0) {
					const lineSnippet = extractLine(src, i).trim();
					violations.push({
						file: path.relative(process.cwd(), filePath),
						line,
						snippet: lineSnippet.slice(0, 200),
					});
				}
				i += m[0].length;
				continue;
			}
		}

		i++;
	}
}

/**
 * True if position `i` is at a word boundary (the previous character is
 * not part of an identifier).
 */
function isWordBoundary(src, i) {
	if (i === 0) return true;
	const prev = src[i - 1];
	return !/[A-Za-z0-9_$\\]/.test(prev);
}

/**
 * Distinguishes the `class` keyword as a class declaration from
 * `Foo::class` (PHP 5.5+ class-name fetch). The downgrader rewrites
 * `::class` away, but be defensive in case any survive.
 */
function isClassConstantUse(src, i) {
	if (i < 2) return false;
	return src[i - 1] === ':' && src[i - 2] === ':';
}

function extractLine(src, idx) {
	const start = src.lastIndexOf('\n', idx - 1) + 1;
	let end = src.indexOf('\n', idx);
	if (end === -1) end = src.length;
	return src.slice(start, end);
}
