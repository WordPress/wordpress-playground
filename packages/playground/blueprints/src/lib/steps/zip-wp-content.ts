import { joinPaths } from '@php-wasm/util';
import { wpContentFilesExcludedFromExport } from '../utils/wp-content-files-excluded-from-exports';
import { UniversalPHP, iterateFiles } from '@php-wasm/universal';
import { encodeZip, collectBytes } from '@wp-playground/stream-compression';

interface ZipWpContentOptions {
	/**
	 * @private
	 * A temporary workaround to enable including the WordPress default theme
	 * in the exported zip file.
	 */
	selfContained?: boolean;
}

/**
 * Replace the current wp-content directory with one from the provided zip file.
 *
 * @param playground Playground client.
 * @param wpContentZip Zipped WordPress site.
 */
export const zipWpContent = async (playground: UniversalPHP) => {
	const documentRoot = await playground.documentRoot;
	const wpContentPath = joinPaths(documentRoot, 'wp-content');

	let exceptPaths = wpContentFilesExcludedFromExport;
	/*
	 * This is a temporary workaround to enable including the WordPress
	 * default theme and the SQLite plugin in the exported zip file. Let's
	 * transition from this workaround to iterator-based streams once the
	 * new API is merged in PR 851.
	 */
	if (selfContained) {
		// This is a bit backwards, so hang on!
		// We have a list of paths to exclude.
		// We then *remove* the default theme and the SQLite plugin from that list.
		// As a result, we *include* the default theme and the SQLite plugin in the final zip.
		// It is hacky and will be removed soon.
		exceptPaths = exceptPaths
			.filter((path) => !path.startsWith('themes/twenty'))
			.filter((path) => path !== 'plugins/sqlite-database-integration');
	}
  
	const allFiles = async function* () {
		const wpConfigBytes = await playground.readFileAsBuffer(
			joinPaths(documentRoot, 'wp-config.php')
		);
		yield new File([wpConfigBytes], 'wp-config.php');
		yield* iterateFiles(playground, wpContentPath, {
			relativePaths: true,
			pathPrefix: 'wp-content/',
			exceptPaths: wpContentFilesExcludedFromExport.map((path) =>
				joinPaths(documentRoot, 'wp-content', path)
			),
		});
	};

	return await collectBytes(encodeZip(allFiles()));
};
