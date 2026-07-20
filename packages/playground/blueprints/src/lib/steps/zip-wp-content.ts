import { joinPaths, phpVars } from '@php-wasm/util';
import type { UniversalPHP } from '@php-wasm/universal';

/**
 * Creates a complete Playground archive containing wp-content, wp-config.php,
 * and export metadata.
 *
 * @param playground Playground client.
 */
export const zipWpContent = async (playground: UniversalPHP) => {
	const zipPath = '/tmp/wordpress-playground.zip';
	const manifestPath = '/tmp/playground-export.json';

	const documentRoot = await playground.documentRoot;
	const wpContentPath = joinPaths(documentRoot, 'wp-content');

	// Create a manifest file containing metadata about this export,
	// including the site URL (with scope). This will be used during import
	// to update URLs in the database when the scope changes.
	const siteUrl = await playground.absoluteUrl;
	await playground.writeFile(
		manifestPath,
		new TextEncoder().encode(JSON.stringify({ formatVersion: 2, siteUrl }))
	);

	const additionalPaths: Record<string, string> = {
		[manifestPath]: 'playground-export.json',
		[joinPaths(documentRoot, 'wp-config.php')]: 'wp-config.php',
	};

	const js = phpVars({
		zipPath,
		wpContentPath,
		documentRoot,
		additionalPaths,
	});
	await runPhpWithZipFunctions(
		playground,
		`zipDir(${js.wpContentPath}, ${js.zipPath}, array(
			'zip_root'      => ${js.documentRoot},
			'additional_paths' => ${js.additionalPaths}
		));`
	);

	const fileBuffer = await playground.readFileAsBuffer(zipPath);
	playground.unlink(zipPath);
	playground.unlink(manifestPath);

	return fileBuffer;
};

const zipFunctions = `<?php

function zipDir($root, $output, $options = array())
{
    $root = rtrim($root, '/');
    $additionalPaths = array_key_exists('additional_paths', $options) ? $options['additional_paths'] : array();
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
                    if (is_dir($entry)) {
                        $directory_path = $entry . '/';
                        array_push($directories, $directory_path);
                    } else if (is_file($entry)) {
                        // ensure compliance with zip spec by only using relative paths for files
                        $zip->addFile($entry, ltrim(substr($entry, strlen($zip_root)), '/'));
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
