/**
 * Post-link size optimization for MAIN_MODULE=2 JSPI builds.
 *
 * The runtime exports the full public libphp ABI so externally compiled PHP
 * extensions (JSPI side modules) can dynamically link against any public PHP
 * symbol. Those symbols must be present in the wasm export table
 * (`-Wl,--export=`), because a side module resolves an imported symbol against
 * the main module's `wasmExports` (mergeLibSymbols -> wasmImports ->
 * resolveGlobalSymbol in Emscripten's generated glue).
 *
 * For every wasm export, though, Emscripten also emits a JS-side alias in the
 * generated loader:
 *
 *     _zend_adler32 = Module['_zend_adler32'] = wasmExports['zend_adler32'];
 *
 * plus a `_zend_adler32,` entry in the top-level `var` declaration block. With
 * the full ABI exported that is thousands of aliases and megabytes of dead JS:
 * nothing in our JS or TypeScript reads these ABI aliases (side-module linking
 * uses `wasmExports`, not the `Module['_x']` aliases), and `ccall` only touches
 * the curated runtime symbols we keep. See PR #4108 discussion for measurements.
 *
 * This script removes the alias + declaration for exactly the ABI symbols that
 * are NOT part of the JS-facing export set, leaving the wasm exports (and every
 * genuinely-used alias) untouched.
 *
 * ---------------------------------------------------------------------------
 * A STRONGER ALTERNATIVE WE DELIBERATELY DID NOT TAKE: `-sDECLARE_ASM_MODULE_EXPORTS=0`
 * ---------------------------------------------------------------------------
 * Emscripten can be told, via `-sDECLARE_ASM_MODULE_EXPORTS=0`, to never emit
 * these `Module['_x']` aliases at all (code then reaches exports through
 * `wasmExports.x`). That is the "do it the Emscripten way" fix and would drop
 * the aliases for ALL exports without any post-link text surgery.
 *
 * We did not adopt it because it is global and high blast-radius for this
 * codebase:
 *   - `ccall` resolves functions via `Module['_' + ident]` (getCFunc), and
 *     @php-wasm/universal calls `ccall` for core operations (run_cli, request
 *     handling, etc.). Turning the aliases off would break every `ccall` unless
 *     Emscripten rewires getCFunc for this mode — unverified.
 *   - Our custom `--js-library` glue (sockets, file locking, DNS) calls wasm
 *     exports as `_malloc`, `_close`, `_connect`, ... which would each need to
 *     become `wasmExports.x`.
 *   - The `PHPLoader['malloc']` / `['free']` public API is built by post-link
 *     patches that rewrite the `_malloc = Module['_malloc']` alias lines; those
 *     lines would no longer exist.
 *
 * This targeted strip is surgical: it only removes aliases for ABI symbols that
 * nothing references, so no working `ccall`/js-library/PHPLoader path changes.
 * If the team later validates `DECLARE_ASM_MODULE_EXPORTS=0` (start with a spike
 * build proving `ccall` still resolves), it would supersede this script.
 *
 * Usage: node strip-unused-abi-export-aliases.mjs <php.js> <strip-list-file>
 *   <strip-list-file> holds one JS alias name per line (e.g. `_zend_adler32`),
 *   derived at build time as (full ABI) minus (JS-facing export set).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const [, , jsPath, stripListPath] = process.argv;
if (!jsPath || !stripListPath) {
	throw new Error(
		'Usage: strip-unused-abi-export-aliases.mjs <php.js> <strip-list-file>'
	);
}

const stripNames = readFileSync(stripListPath, 'utf8')
	.split('\n')
	.map((line) => line.trim())
	.filter(Boolean);

let js = readFileSync(jsPath, 'utf8');
const originalLength = js.length;

if (stripNames.length === 0) {
	console.log('strip-unused-abi-export-aliases: nothing to strip.');
	process.exit(0);
}

let removedAliases = 0;
let keptReferenced = 0;
const stripped = new Set();

for (const jsName of stripNames) {
	// jsName is the JS alias, e.g. `_zend_adler32`; the wasm export name is the
	// same without the single leading underscore Emscripten adds for JS.
	const wasmName = jsName.slice(1);

	// Safety gate: never remove an alias that is actually *called*. Nothing
	// should call an ABI-only symbol from JS, but if the strip list ever
	// over-includes, skip rather than break the loader.
	if (new RegExp(`(?<![\\w$])${escape(jsName)}\\(`).test(js)) {
		keptReferenced++;
		continue;
	}

	// The generated alias assignment. Two formats occur: node builds are
	// unminified (`\t\t_X = Module["_X"] = wasmExports["X"];\n`) while web builds
	// are minified (`;_X=Module["_X"]=wasmExports["X"];`, no spaces, semicolon-
	// separated). Tolerate whitespace around `=`, optional leading indentation,
	// and an optional trailing newline; double or single quotes. The leading
	// `(?<![\w$])` keeps `_X` from matching inside a longer identifier.
	const aliasStmt = new RegExp(
		`[ \\t]*(?<![\\w$])${escape(jsName)}\\s*=\\s*Module\\[['"]${escape(
			jsName
		)}['"]\\]\\s*=\\s*wasmExports\\[['"]${escape(wasmName)}['"]\\]\\s*;\\n?`
	);

	if (aliasStmt.test(js)) {
		js = js.replace(aliasStmt, '');
		stripped.add(jsName);
		removedAliases++;
	}
}

// Remove the stripped names from the top-level export declaration. Emscripten
// emits it as a single `var _a, _b, ..., _z, memory, wasmTable, wasmMemory;`
// statement (thousands of names on one line in raw linker output; a prettier
// pass may later wrap it one-per-line, so tolerate whitespace/newlines between
// entries). This matches a declaration of only comma-separated identifiers — not
// just `_`-prefixed ones, since the block ends with `memory`/`wasmTable`/
// `wasmMemory` — but never `var x = ...;` (those contain `=`). Only names in the
// strip set are dropped, so unrelated declarations pass through unchanged.
if (stripped.size > 0) {
	js = js.replace(
		/\bvar\s+([\w$]+(?:\s*,\s*[\w$]+)*)\s*;/g,
		(full, body) => {
			const kept = body
				.split(/\s*,\s*/)
				.filter((name) => !stripped.has(name));
			return kept.length ? `var ${kept.join(', ')};` : '';
		}
	);
}

// Fail closed: a non-empty strip list that removed nothing means Emscripten's
// output format drifted. Abort loudly instead of silently shipping the bloat.
if (removedAliases === 0) {
	// Diagnostic: show the exact assignment for a candidate so the alias
	// pattern can be updated to the real (possibly minified) format.
	for (const n of stripNames) {
		const w = n.slice(1);
		const idx =
			js.indexOf(`wasmExports["${w}"]`) >= 0
				? js.indexOf(`wasmExports["${w}"]`)
				: js.indexOf(`wasmExports['${w}']`);
		if (idx >= 0) {
			console.error(
				`[strip debug] assignment for ${n}:\n` +
					JSON.stringify(js.slice(Math.max(0, idx - 90), idx + 40))
			);
			break;
		}
	}
	throw new Error(
		`strip-unused-abi-export-aliases: ${stripNames.length} candidates but ` +
			'removed 0 aliases. Emscripten loader format may have changed; ' +
			'update the alias/declaration patterns.'
	);
}

writeFileSync(jsPath, js);

// Fail closed: the edited loader must still parse.
execFileSync(process.execPath, ['--check', jsPath], { stdio: 'inherit' });

console.log(
	`strip-unused-abi-export-aliases: removed ${removedAliases} ABI aliases ` +
		`(${keptReferenced} kept as referenced), ` +
		`${originalLength - js.length} bytes saved.`
);

function escape(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
