import type { V2StepHandler } from '../types';
import { registerV2StepHandler } from './index';
import { joinPaths, phpVar } from '@php-wasm/util';

/**
 * Resolves a `site:` prefixed path to an absolute path on the
 * virtual filesystem. Paths that start with `site:` are relative
 * to the WordPress document root.
 */
function resolveSitePath(path: string, documentRoot: string): string {
	if (path.startsWith('site:')) {
		return joinPaths(documentRoot, path.slice(5));
	}
	return path;
}

/**
 * Copies a file from one location to another using PHP's
 * `copy()` function.
 */
export const cpHandler: V2StepHandler = async (args, context) => {
	const { fromPath, toPath } = args as { fromPath: string; toPath: string };
	const documentRoot = await context.php.documentRoot;
	const from = resolveSitePath(fromPath, documentRoot);
	const to = resolveSitePath(toPath, documentRoot);

	const result = await context.php.run({
		code: `<?php
		$result = copy(${phpVar(from)}, ${phpVar(to)});
		if (!$result) {
			throw new Exception('Failed to copy ' . ${phpVar(from)} . ' to ' . ${phpVar(to)});
		}
		`,
	});
	if (result.errors) {
		throw new Error(result.errors);
	}
};

/**
 * Moves/renames a file or directory using PHP's `rename()`
 * function.
 */
export const mvHandler: V2StepHandler = async (args, context) => {
	const { fromPath, toPath } = args as { fromPath: string; toPath: string };
	const documentRoot = await context.php.documentRoot;
	const from = resolveSitePath(fromPath, documentRoot);
	const to = resolveSitePath(toPath, documentRoot);

	const result = await context.php.run({
		code: `<?php
		$result = rename(${phpVar(from)}, ${phpVar(to)});
		if (!$result) {
			throw new Exception('Failed to move ' . ${phpVar(from)} . ' to ' . ${phpVar(to)});
		}
		`,
	});
	if (result.errors) {
		throw new Error(result.errors);
	}
};

/**
 * Creates a directory (and any necessary parent directories)
 * using PHP's `mkdir()` with the recursive flag.
 */
export const mkdirHandler: V2StepHandler = async (args, context) => {
	const { path } = args as { path: string };
	const documentRoot = await context.php.documentRoot;
	const resolved = resolveSitePath(path, documentRoot);

	const result = await context.php.run({
		code: `<?php
		if (!is_dir(${phpVar(resolved)})) {
			$result = mkdir(${phpVar(resolved)}, 0777, true);
			if (!$result) {
				throw new Exception('Failed to create directory ' . ${phpVar(resolved)});
			}
		}
		`,
	});
	if (result.errors) {
		throw new Error(result.errors);
	}
};

/**
 * Removes a single file using the PHP runtime's `unlink()`
 * method.
 */
export const rmHandler: V2StepHandler = async (args, context) => {
	const { path } = args as { path: string };
	const documentRoot = await context.php.documentRoot;
	const resolved = resolveSitePath(path, documentRoot);

	await context.php.unlink(resolved);
};

/**
 * Recursively removes a directory and all its contents using a
 * PHP helper that walks the directory tree.
 */
export const rmdirHandler: V2StepHandler = async (args, context) => {
	const { path } = args as { path: string };
	const documentRoot = await context.php.documentRoot;
	const resolved = resolveSitePath(path, documentRoot);

	const result = await context.php.run({
		code: `<?php
		function playground_rmdir_recursive($dir) {
			if (!is_dir($dir)) {
				return;
			}
			$entries = scandir($dir);
			foreach ($entries as $entry) {
				if ($entry === '.' || $entry === '..') {
					continue;
				}
				$path = $dir . '/' . $entry;
				if (is_dir($path)) {
					playground_rmdir_recursive($path);
				} else {
					unlink($path);
				}
			}
			rmdir($dir);
		}
		playground_rmdir_recursive(${phpVar(resolved)});
		`,
	});
	if (result.errors) {
		throw new Error(result.errors);
	}
};

registerV2StepHandler('cp', cpHandler);
registerV2StepHandler('mv', mvHandler);
registerV2StepHandler('mkdir', mkdirHandler);
registerV2StepHandler('rm', rmHandler);
registerV2StepHandler('rmdir', rmdirHandler);
