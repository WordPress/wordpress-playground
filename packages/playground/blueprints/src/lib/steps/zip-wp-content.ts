import { joinPaths } from '@php-wasm/util';
import { wpContentFilesExcludedFromExport } from '../utils/wp-content-files-excluded-from-exports';
import { UniversalPHP, iterateFiles } from '@php-wasm/universal';
import { encodeZip, collectBytes } from '@php-wasm/stream-compression';

/**
 * Replace the current wp-content directory with one from the provided zip file.
 *
 * @param playground Playground client.
 * @param wpContentZip Zipped WordPress site.
 */
export const zipWpContent = async (playground: UniversalPHP) => {
	const documentRoot = await playground.documentRoot;
	const wpContentPath = joinPaths(documentRoot, 'wp-content');

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
