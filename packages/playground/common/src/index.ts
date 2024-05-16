/**
 * Avoid adding new code here. @wp-playground/common should remain
 * as lean as possible.
 *
 * This package exists to avoid circular dependencies. Let's not
 * use it as a default place to add code that doesn't seem to fit
 * anywhere else. If there's no good place for your code, perhaps
 * it needs to be restructured? Or maybe there's a need for a new package?
 * Let's always consider these questions before adding new code here.
 */

import { UniversalPHP } from '@php-wasm/universal';
import { phpVars } from '@php-wasm/util';

export const RecommendedPHPVersion = '8.0';

// @TODO Make these ZIP functions more versatile and
//       move them to one of the @php-wasm packages.

/**
 * Unzip a zip file inside Playground.
 */
const tmpPath = '/tmp/file.zip';
export const unzipFile = async (
	php: UniversalPHP,
	zipPath: string | File,
	extractToPath: string
) => {
	if (zipPath instanceof File) {
		const zipFile = zipPath;
		zipPath = tmpPath;
		await php.writeFile(
			zipPath,
			new Uint8Array(await zipFile.arrayBuffer())
		);
	}
	const js = phpVars({
		zipPath,
		extractToPath,
	});
	await runPhpWithZipFunctions(
		php,
		`unzip(${js.zipPath}, ${js.extractToPath});`
	);
	if (php.fileExists(tmpPath)) {
		await php.unlink(tmpPath);
	}
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

function unzip($zipPath, $extractTo, $overwrite = true)
{
    if (!is_dir($extractTo)) {
        mkdir($extractTo, 0777, true);
    }
    $zip = new ZipArchive;
    $res = $zip->open($zipPath);
    if ($res === TRUE) {
        $zip->extractTo($extractTo);
        $zip->close();
        chmod($extractTo, 0777);
    }
}


function delTree($dir)
{
    $files = array_diff(scandir($dir), array('.', '..'));
    foreach ($files as $file) {
        (is_dir("$dir/$file")) ? delTree("$dir/$file") : unlink("$dir/$file");
    }
    return rmdir($dir);
}
`;

export async function runPhpWithZipFunctions(
	playground: UniversalPHP,
	code: string
) {
	return await playground.run({
		code: zipFunctions + code,
	});
}
