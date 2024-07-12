import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * We want to cache all files from the website root directory, and the assets directory, except for the files listed below.
 */
const patternsToNotCache = [
	/**
	 * Static files that are not needed for the website to function offline.
	 * TODO: Check if these are needed in the production build.
	 */
	'/package.json',
	'/README.md',
	'/.DS_Store',
	'/index.cjs',
	'/index.d.ts',
	/\/lib\/.*/, // Remote lib files
	/\/test-fixtures\/.*/, // Test fixtures
	/**
	 * WordPress remote assets that are fetched on demand by Playground.
	 */
	/^\/wp-[\w+((\.\d+)?)]+\/.*/,
	/**
	 * Demos are not needed for the website to function offline.
	 */
	/^\/demos\/.*/,
	/**
	 * Files needed only by the Playground.WordPress.Net server.
	 */
	'/.htaccess',
	/\/.*\.php$/, // PHP files used by the website server
	/**
	 * WordPress, PHP, and SQLite files that are loaded during boot.
	 * By loading these files during boot, we can ensure that only the current PHP/WordPress/SQLite files are cached.
	 * These files are large, so loading only the current files will reduce the bandwidth usage.
	 */
	/^\/assets\/php_.*\.wasm$/, // PHP WASM files
	/^\/assets\/php_.*\.js$/, // PHP JS files
	/^\/assets\/wp-.*\.zip$/, // WordPress zip files
	/^\/assets\/sqlite-database-integration-[\w]+\.zip/, // SQLite plugin
];

/**
 * For Playground to work offline we need to cache all the files that are needed for the website to function.
 * Playground uses this list at the end of the boot process to cache files.
 */
export const websiteCachePathsPlugin = () => {
	function listFiles(dirPath: string, fileList: string[] = []) {
		const files = readdirSync(dirPath);

		files.forEach((file) => {
			const filePath = join(dirPath, file);
			const fileStat = statSync(filePath);

			if (fileStat.isDirectory()) {
				listFiles(filePath, fileList);
			} else {
				fileList.push(filePath);
			}
		});

		return fileList;
	}
	return {
		name: 'website-cache-paths-plugin',
		apply: 'build',
		writeBundle({ dir: outputDir }: { dir: string }) {
			const outputManifestPath = join(outputDir, 'cache-files.json');
			const directoriesToList = ['/', '../remote', '../client'];

			const files = directoriesToList.flatMap((dir) => {
				const fullDirPath = join(outputDir, dir);
				return listFiles(fullDirPath)
					.map((file) => {
						file = file.replace(fullDirPath, '');
						if (file.startsWith('/')) {
							return file;
						}
						return `/${file}`;
					})
					.filter((item) => {
						return !patternsToNotCache.some((pattern) => {
							if (pattern instanceof RegExp) {
								return pattern.test(item);
							}
							return pattern === item;
						});
					});
			});
			writeFileSync(outputManifestPath, JSON.stringify(files, null, 2));
		},
	};
};
