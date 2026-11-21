import { joinPaths, phpVars, randomFilename } from '@php-wasm/util';
import type { UniversalPHP } from '@php-wasm/universal';
import { getLegacyPlaygroundRuntimeWpContentPaths } from '../utils/legacy-playground-runtime-wp-content-paths';
import { zipExportAdminPhp } from './zip-export-admin';

/**
 * Creates a Playground site archive containing user-owned wp-content,
 * wp-config.php, and export metadata. Runtime artifacts are supplied by the
 * Playground that imports the archive.
 *
 * @param playground Playground client.
 * @param newAdminUsername Rename the existing admin account only in this ZIP.
 */
export const zipWpContent = async (
	playground: UniversalPHP,
	newAdminUsername?: string
) => {
	const directory = `/tmp/playground-export-${randomFilename()}`;
	const zipPath = joinPaths(directory, 'wordpress-playground.zip');
	const manifestPath = joinPaths(directory, 'playground-export.json');
	const snapshotPath = joinPaths(directory, 'database.sqlite');
	const documentRoot = await playground.documentRoot;
	const wpContentPath = joinPaths(documentRoot, 'wp-content');

	// Record the site URL so import can migrate URLs when the scope changes.
	const siteUrl = await playground.absoluteUrl;
	const additionalPaths: Record<string, string> = {
		[manifestPath]: 'playground-export.json',
		[joinPaths(documentRoot, 'wp-config.php')]: 'wp-config.php',
	};
	const excludedPaths = (
		await getLegacyPlaygroundRuntimeWpContentPaths(
			playground,
			wpContentPath
		)
	).map((path) => joinPaths(wpContentPath, path));

	await playground.mkdir(directory);
	try {
		await playground.writeFile(
			manifestPath,
			new TextEncoder().encode(
				JSON.stringify({ formatVersion: 2, siteUrl })
			)
		);
		const js = phpVars({
			zipPath,
			wpContentPath,
			documentRoot,
			excludedPaths,
			additionalPaths,
			snapshotPath,
			newAdminUsername: newAdminUsername?.trim() ?? null,
		});
		const url = new URL(siteUrl);
		const response = await playground.run({
			usePrimaryPhp: true,
			...(newAdminUsername !== undefined && {
				// Multisite needs the host and path to load the right network.
				// Suppress the browser's first-visit auto-login during this run.
				relativeUri: url.pathname,
				protocol: url.protocol.slice(0, -1),
				headers: {
					host: url.host,
					cookie: 'playground_auto_login_already_happened=1',
				},
			}),
			code:
				zipFunctions +
				(newAdminUsername === undefined ? '' : zipExportAdminPhp) +
				`
			$excluded = ${js.excludedPaths};
			$additional = ${js.additionalPaths};
			if (null !== ${js.newAdminUsername}) {
				if (!method_exists('SQLite3', 'backup')) {
					echo json_encode('Changing the ZIP username requires PHP 7.4 or newer.');
					return;
				}
				require_once ${js.documentRoot} . '/wp-load.php';
				try {
					$database = playground_prepare_export_database(${js.documentRoot}, ${js.snapshotPath}, ${js.newAdminUsername});
				} catch (InvalidArgumentException $error) {
					echo json_encode($error->getMessage());
					return;
				}
				// Never include the live database or its journals beside the snapshot.
				$excluded = array_merge($excluded, array($database, $database . '-wal', $database . '-shm', $database . '-journal'));
				$additional[${js.snapshotPath}] = substr($database, strlen(${js.documentRoot}) + 1);
			}
			zipDir(${js.wpContentPath}, ${js.zipPath}, array(
				'exclude_paths' => $excluded,
				'zip_root'      => ${js.documentRoot},
				'additional_paths' => $additional
			));`,
		});
		if (
			newAdminUsername !== undefined &&
			response.text.trim() &&
			!(await playground.fileExists(zipPath))
		) {
			const error = new Error(response.json as string);
			error.name = 'ZipExportUsernameError';
			throw error;
		}
		return await playground.readFileAsBuffer(zipPath);
	} finally {
		await playground.rmdir(directory, { recursive: true });
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
                        // ensure compliance with zip spec by only using relative paths for files
                        $zip->addFile($entry, ltrim(substr($entry, strlen($zip_root)), '/'));
                    }
                }
                closedir($handle);
            }
        }
        foreach ($additionalPaths as $disk_path => $zip_path) {
            if (!$zip->addFile($disk_path, $zip_path)) {
                throw new RuntimeException('Could not add ' . $zip_path . ' to the ZIP.');
            }
        }
        if (!$zip->close()) {
            throw new RuntimeException('Could not write the ZIP.');
        }
        chmod($output, 0777);
    } else {
        throw new RuntimeException('Could not open the ZIP for writing.');
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
