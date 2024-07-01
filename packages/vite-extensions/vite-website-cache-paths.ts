import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// TODO create a list of files to cache
const patternsToCache = [
	'/',
	'/index.html',
	'/sw.js',
	/^\/assets\/index-[\w]+\/.js/,
	/^\/assets\/modulepreload-polyfill-[\w]+\/.js/,
	/^\/assets\/index-[\w]+\.css/,
	/^\/assets\/preload-helper-[\w]+\.js/,
	/^\/assets\/main-[\w]+\.css/,
	/^\/assets\/client-[\w]+\.js/,
	/^\/assets\/config-[\w]+\.js/,
	/^\/assets\/main-[\w]+\.js/,
	'/logo-192.png',
	/^\/localhost:9999\/wp-nightly\/wordpress-static.zip/,
	'/remote.html',
	/^\/assets\/wordpress-[\w]+\.js/,
	/^\/assets\/remote-[\w]+\.css/,
	/^\/assets\/sqlite-database-integration-[\w]+\.zip/,
	/^\/assets\/wp-[\w]+\.zip/,
	'/favicon.ico',
	'/worker-thread-[w]+.js',
	/^\/assets\/wp-[\w]+\.zip/,
	/^\/assets\/php_[\w-]+\.js/,
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
					.map((file) => file.replace(fullDirPath, '/'))
					.filter((file) =>
						file.match(new RegExp(patternsToCache.join('|')))
					);
			});

			writeFileSync(outputManifestPath, JSON.stringify(files, null, 2));
		},
	};
};
