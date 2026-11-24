/**
 * Smoke-tests every `.php`/`.copy` file under a directory with the
 * PHP 5.2 WebAssembly runtime by loading the file through the SAPI
 * request handler and inspecting stderr for parse errors.
 *
 * Usage: node scripts/php52-downgrader/bin/lint-php52.mjs <dir>
 *
 * Prints a summary and exits non-zero if any file has a Parse error.
 * Non-parse runtime errors (undefined functions, missing classes,
 * includes failing, etc.) are ignored — the files are executed in a
 * context that doesn't have WordPress or the rest of the plugin
 * loaded, so runtime failures are expected and uninteresting for the
 * purpose of syntax validation.
 *
 * The PHP 5.2 WASM build doesn't expose a CLI entry point
 * (`wasm_add_cli_arg` / `run_cli` aren't compiled in), so we can't
 * use `php.cli(['php', '-l', ...])`. The SAPI `run()` path is the
 * only supported invocation — PHP compiles the whole file before
 * execution begins, and a parse error shows up in stderr regardless
 * of what the first statement tries to do.
 */
import fs from 'fs';
import path from 'path';
import { loadNodeRuntime } from '@php-wasm/node';
import { PHP, FileLockManagerInMemory } from '@php-wasm/universal';

const ROOT = process.argv[2];
if (!ROOT) {
	console.error('usage: lint-php52.mjs <dir>');
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
console.log(`Linting ${files.length} files with PHP 5.2 WASM...`);

// A single PHP instance is reusable across run() calls (unlike cli()),
// and PHP 5.2 WASM doesn't expose cli() anyway, so we just use one
// instance for the whole lint.
const php = new PHP(
	await loadNodeRuntime('5.2', {
		fileLockManager: new FileLockManagerInMemory(),
		emscriptenOptions: { processId: 1 },
	})
);
php.mkdir('/check');

let failures = 0;
for (const file of files) {
	const rel = path.relative(ROOT, file);
	try {
		const contents = fs.readFileSync(file, 'utf-8');
		php.writeFile('/check/file.php', contents);
		let response;
		try {
			response = await php.run({ scriptPath: '/check/file.php' });
		} catch (err) {
			// run() throws PHPExecutionFailureError on any non-zero
			// exit code. Fish out the inner response so we can inspect
			// stderr for parse errors. Anything that isn't a parse
			// error is not our concern for lint purposes.
			if (err && err.response) {
				response = err.response;
			} else {
				throw err;
			}
		}
		const stderr = response.errors || '';
		const stdout = response.text || '';
		const combined = stderr + '\n' + stdout;
		if (/Parse error|syntax error/i.test(combined)) {
			failures++;
			console.log(`FAIL ${rel}`);
			const firstErr = combined
				.split('\n')
				.find((l) => /Parse error|syntax error/i.test(l));
			if (firstErr) {
				console.log(`  ${firstErr.trim()}`);
			}
		}
	} catch (e) {
		failures++;
		console.log(`FAIL ${rel}: ${e.message}`);
	}
}

console.log(`\n${failures}/${files.length} failed`);
process.exit(failures ? 1 : 0);
