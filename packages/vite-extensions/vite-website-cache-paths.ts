import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const patternsToCache = [
	'/',
	'/index.html',
	'/sw.js',
	'/favicon.ico',
	'/remote.html',
	/^\/logo-[\w]+\.png/,
	/^\/wp-[\w]\/wordpress-static.zip/,
	/^\/worker-thread-[\w]+\.js/,
	/^\/assets\/index-[\w]+\.js/,
	/^\/assets\/modulepreload-polyfill-[\w]+\.js/,
	/^\/assets\/index-[\w]+\.css/,
	/^\/assets\/preload-helper-[\w]+\.js/,
	/^\/assets\/main-[\w]+\.css/,
	/^\/assets\/client-[\w]+\.js/,
	/^\/assets\/config-[\w]+\.js/,
	/^\/assets\/main-[\w]+\.js/,
	/^\/assets\/wordpress-[\w]+\.js/,
	/^\/assets\/remote-[\w]+\.css/,
	/^\/assets\/sqlite-database-integration-[\w]+\.zip/,
	/^\/assets\/wp-\d+(\.\d+)+-[\w]+.zip/,
	/^\/assets\/php_[\w-]+\.js/,
	/^\/assets\/php_[\w-]+\.wasm/,
	/^\/wp-\w+((\.\d+)?)+\/wordpress-static.zip/,
];

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
						return patternsToCache.some((pattern) => {
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
