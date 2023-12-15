import { joinPaths, phpVars } from '@php-wasm/util';
import { runPhpWithZipFunctions } from './common';
import { wpContentFilesExcludedFromExport } from './common';
import { UniversalPHP } from '@php-wasm/universal';

interface ZipWpContentOptions {
	/**
	 * @private
	 * A temporary workaround to enable including the WordPress default theme
	 * in the exported zip file.
	 */
	includeDefaultTheme?: boolean;
	/**
	 * @private
	 * A temporary workaround to enable including wp-config in the exported zip file.
	 */
	includeWpConfig?: boolean;
}

/**
 * Replace the current wp-content directory with one from the provided zip file.
 *
 * @param playground Playground client.
 * @param wpContentZip Zipped WordPress site.
 */
export const zipWpContent = async (
	playground: UniversalPHP,
	{
		includeDefaultTheme = false,
		includeWpConfig = false,
	}: ZipWpContentOptions = {}
) => {
	const zipPath = '/tmp/wordpress-playground.zip';

	const documentRoot = await playground.documentRoot;
	const wpContentPath = joinPaths(documentRoot, 'wp-content');

	let exceptPaths = wpContentFilesExcludedFromExport;
	/*
	 * This is a temporary workaround to enable removing the WordPress
	 * default theme from the exported zip file. Let's remove this
	 * once the iterator-based file API is merged.
	 */
	if (includeDefaultTheme) {
		// This is a bit backwards, so hang on!
		// We have a list of paths to exclude.
		// We then *remove* the default theme from that list.
		// As a result, we *include* the default theme in the final zip.
		// It is hacky and will be removed soon.
		exceptPaths = exceptPaths.filter(
			(path) => !path.startsWith('themes/twenty')
		);
	}
	const js = phpVars({
		zipPath,
		wpContentPath,
		documentRoot,
		exceptPaths: exceptPaths.map((path) =>
			joinPaths(documentRoot, 'wp-content', path)
		),
		additionalPaths: includeWpConfig
			? {
					[joinPaths(documentRoot, 'wp-config.php')]: 'wp-config.php',
			  }
			: {},
	});
	await runPhpWithZipFunctions(
		playground,
		`zipDir(${js.wpContentPath}, ${js.zipPath}, array(
			'exclude_paths' => ${js.exceptPaths},
			'zip_root'      => ${js.documentRoot},
			'additional_paths' => ${js.additionalPaths}
		));`
	);

	const fileBuffer = await playground.readFileAsBuffer(zipPath);
	playground.unlink(zipPath);

	return fileBuffer;
};
