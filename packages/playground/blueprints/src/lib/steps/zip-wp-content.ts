import { joinPaths, phpVars } from '@php-wasm/util';
import { runPhpWithZipFunctions } from './common';
import { wpContentFilesExcludedFromExport } from './common';
import { UniversalPHP } from '@php-wasm/universal';

/**
 * Replace the current wp-content directory with one from the provided zip file.
 *
 * @param playground Playground client.
 * @param wpContentZip Zipped WordPress site.
 */
export const zipWpContent = async (playground: UniversalPHP) => {
	const zipName = 'wordpress-playground.zip';
	const zipPath = `/tmp/${zipName}`;

	const documentRoot = await playground.documentRoot;
	const wpContentPath = joinPaths(documentRoot, 'wp-content');

	const js = phpVars({
		zipPath,
		wpContentPath,
		exceptPaths: wpContentFilesExcludedFromExport.map((path) =>
			joinPaths(documentRoot, 'wp-content', path)
		),
	});
	await runPhpWithZipFunctions(
		playground,
		`zipDir(${js.wpContentPath}, ${js.zipPath}, ${js.exceptPaths});`
	);
	console.log(wpContentPath);

	const fileBuffer = await playground.readFileAsBuffer(zipPath);
	playground.unlink(zipPath);

	return new File([fileBuffer], zipName);
};
