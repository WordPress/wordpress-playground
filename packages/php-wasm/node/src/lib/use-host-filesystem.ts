import { PHP } from '@php-wasm/universal';
import { lstatSync, readdirSync } from 'node:fs';
import { NodeFSMount } from './node-fs-mount';

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
		.filter((file) => lstatSync(file).isDirectory());
	for (const dir of dirs) {
		if (!php.fileExists(dir)) {
			php.mkdirTree(dir);
		}
		php.mount(dir, new NodeFSMount(dir));
	}
	php.chdir(process.cwd());
}
