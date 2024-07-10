import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const patternsToNotCache = [
	'/package.json',
	'/README.md',
	'/index.cjs',
	'/index.d.ts',
	'/builder/builder.html',
	'/gutenberg.css',
	'/gutenberg.html',
	'/.htaccess',
	'/ogimage.png',
	'/previewer.css',
	'/wordpress-importer.zip',
	'/wordpress.html',
	'/wordpress.svg',
	'/.DS_Store',
	'/.htaccess',
	/^\/wp-[\w+((\.\d+)?)]+\/.*/, // WordPress static asset folders
	/^\/demos\/.*/, // Demos
	/\/.*\.php$/, // PHP files used by the website server
	/\/lib\/.*/, // Remote lib files
	/\/test-fixtures\/.*/,
	/^\/assets\/.*\.svg$/,
	/^\/assets\/builder.*/,
	/^\/assets\/peer.*/,
	/^\/assets\/php-blueprints.*/,
	/^\/assets\/setup-playground-sync.*/,
	/^\/assets\/sync.html-[\w]+\.js/,
	/^\/assets\/terminal.*/,
	/^\/assets\/time-traveling.*/,
	/^\/assets\/wp-cli.html-[\w]+\.js/,
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
