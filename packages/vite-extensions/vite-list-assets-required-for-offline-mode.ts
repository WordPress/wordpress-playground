import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * We want to cache all files from the website root directory, except for the files listed below.
 */
const patternsToNotCache = [
	/**
	 * Static files that are not needed for the website to function offline.
	 */
	'/package.json',
	'/README.md',
	'/.DS_Store',
	'/index.cjs',
	'/index.d.ts',
	/\/lib\/.*/, // Remote lib files
	/\/test-fixtures\/.*/, // Test fixtures
	/**
	 * WordPress assets removed from the minified builds, for example:
	 *
	 *      /wp-6.2/wp-content/themes/twentytwentyone/style.css
	 *
	 * We don't need to cache them, because they're only used in a short time
	 * window after the Playground is initially loaded and before they're all backfilled
	 * from a dedicated ZIP file shipping all the static assets for a given minified
	 * build.
	 *
	 * See <Assets backfilling PR link>
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
	/**
	 * We can't download the PHP scripts – only get their execution result. This is fine,
	 * we don't need them for the offline mode anyway. This includes things like plugins-proxy.php.
	 */
	/\/.*\.php$/,
	/**
	 * WordPress, PHP, and SQLite files that are loaded during boot.
	 * By loading these files during boot, we can ensure that only the current PHP/WordPress/SQLite files are cached.
	 * These files are large, so loading only the current files will reduce the bandwidth usage.
	 */
	/^\/assets\/php_.*\.wasm$/, // PHP WASM files
	/^\/assets\/php_.*\.js$/, // PHP JS files
	/^\/assets\/wp-.*\.zip$/, // Minified WordPress builds and static assets bundles
	/^\/assets\/sqlite-database-integration-[\w]+\.zip/, // SQLite plugin
];

/**
 * For Playground to work offline we need to cache all the files that are needed for the website to function.
 * Playground uses this list at the end of the boot process to cache files.
 */
export const listAssetsRequiredForOfflineModePlugin = ({
	outputFile,
}: {
	outputFile: string;
}) => {
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
			const outputManifestPath = join(outputDir, outputFile);
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
