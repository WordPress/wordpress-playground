import type { PHP } from '@php-wasm/universal';
import type { Stats } from 'node:fs';
import { lstatSync, readdirSync } from 'node:fs';
import { createNodeFsMountHandler } from './node-fs-mount';

/**
 * Enables host filesystem usage by mounting root
 * directories (e.g. /, /home, /var) into the in-memory
 * virtual filesystem used by this PHP instance, and
 * setting the current working directory to one used by
 * the current node.js process.
 */
export function useHostFilesystem(php: PHP) {
	const dirs = readdirSync('/')
		/*
		 * Don't mount the dev directory – it's polyfilled by Emscripten.
		 */
		.filter((file) => file !== 'dev')
		.map((file) => `/${file}`)
		.filter((file) => {
			try {
				/**
				 * We need to follow the symlink before deciding whether a
				 * path is a directory.
				 *
				 * For example, on Mac, the top level /var directory is a symlink
				 * to /private/var. If we don't follow the symlink, we won't mount
				 * it and PHP will use a separate, VFS-scoped /var directory. This,
				 * in turn, will break the following use-case:
				 *
				 * * PHP.wasm writes a PHP script to a temporary directory in
				 *   /private/var/folders/.../T/ in the host filesystem.
				 * * PHP.wasm calls proc_open() to execute the script in the host filesystem.
				 */
				return statPathFollowSymlinks(file).isDirectory();
			} catch {
				return false;
			}
		});
	for (const dir of dirs) {
		if (!php.fileExists(dir)) {
			php.mkdirTree(dir);
		}
		php.mount(dir, createNodeFsMountHandler(dir));
	}
	php.chdir(process.cwd());
}

/**
 * @param path The path to the file or symlink to stat.
 * @returns The stats of the file or symlink target.
 */
function statPathFollowSymlinks(path: string): Stats {
	let stat = lstatSync(path);
	if (stat.isSymbolicLink()) {
		// Follow symlinks recursively to check if the target is a directory
		const fs = require('fs');
		let target = path;
		const seen = new Set();
		while (true) {
			if (seen.has(target)) {
				// Detected a symlink loop
				throw new Error(`Symlink loop detected: ${path}`);
			}
			seen.add(target);
			const linkStat = lstatSync(target);
			if (linkStat.isSymbolicLink()) {
				target = fs.realpathSync(target);
				continue;
			}
			stat = linkStat;
			break;
		}
	}
	return stat;
}
