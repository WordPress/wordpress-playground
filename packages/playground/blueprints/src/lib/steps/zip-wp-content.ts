import { joinPaths, phpVars } from '@php-wasm/util';
import { UniversalPHP } from '@php-wasm/universal';
import { wpContentFilesExcludedFromExport } from '../utils/wp-content-files-excluded-from-exports';

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
export const zipWpContent = async (
	playground: UniversalPHP,
	{ selfContained = false }: ZipWpContentOptions = {}
) => {
	const zipPath = '/tmp/wordpress-playground.zip';

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
			.filter(
				(path) => path !== 'mu-plugins/sqlite-database-integration'
			);
	}
	const js = phpVars({
		zipPath,
		wpContentPath,
		documentRoot,
		exceptPaths: exceptPaths.map((path) =>
			joinPaths(documentRoot, 'wp-content', path)
		),
		additionalPaths: selfContained
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

const zipFunctions = `<?php

function zipDir($root, $output, $options = array())
{
    $root = rtrim($root, '/');
    $additionalPaths = array_key_exists('additional_paths', $options) ? $options['additional_paths'] : array();
    $excludePaths = array_key_exists('exclude_paths', $options) ? $options['exclude_paths'] : array();
    $zip_root = array_key_exists('zip_root', $options) ? $options['zip_root'] : $root;

    $zip = new ZipArchive;
    $res = $zip->open($output, ZipArchive::CREATE);
    if ($res === TRUE) {
        $directories = array(
            $root . '/'
        );
        while (sizeof($directories)) {
            $current_dir = array_pop($directories);

            if ($handle = opendir($current_dir)) {
                while (false !== ($entry = readdir($handle))) {
                    if ($entry == '.' || $entry == '..') {
                        continue;
                    }

                    $entry = join_paths($current_dir, $entry);
                    if (in_array($entry, $excludePaths)) {
                        continue;
                    }

                    if (is_dir($entry)) {
                        $directory_path = $entry . '/';
                        array_push($directories, $directory_path);
                    } else if (is_file($entry)) {
                        $zip->addFile($entry, substr($entry, strlen($zip_root)));
                    }
                }
                closedir($handle);
            }
        }
        foreach ($additionalPaths as $disk_path => $zip_path) {
            $zip->addFile($disk_path, $zip_path);
        }
        $zip->close();
        chmod($output, 0777);
    }
}

function join_paths()
{
    $paths = array();

    foreach (func_get_args() as $arg) {
        if ($arg !== '') {
            $paths[] = $arg;
        }
    }

    return preg_replace('#/+#', '/', join('/', $paths));
}
`;

async function runPhpWithZipFunctions(playground: UniversalPHP, code: string) {
	return await playground.run({
		code: zipFunctions + code,
	});
}
