import fs from 'fs';
import path from 'path';
import startWPNow from './wp-now';
import { WPNowOptions } from './config';
import { disableOutput } from './output';

const VFS_TMP_PATH = '/vfs-wp-now-tmp';
const VFS_PHP_FILE = path.join(VFS_TMP_PATH, 'parent.php');

/**
 *
 * Execute a PHP file given its path. For non index mode it loads WordPress context.
 *
 * @param {string} filePath - The path to the PHP file to be executed.
 * @param {WPNowOptions} [options={}] - Optional configuration object for WPNow. Defaults to an empty object.
 * @returns {Promise<{ name: string; status: 0; }>} - Returns a Promise that resolves to an object containing
 * the exit name and status (0 for success).
 * @throws {Error} - Throws an error if the specified file is not found or if an error occurs while executing the file.
 */
export async function executePHPFile(
	filePath: string,
	options: WPNowOptions = {}
): Promise<{
	name: string;
	status: 0;
}> {
	disableOutput();
	const { php, options: wpNowOptions } = await startWPNow({
		...options,
		autoLogin: false,
	});

	// check if filePath exists
	const absoluteFilePath = path.resolve(filePath);
	if (!fs.existsSync(absoluteFilePath)) {
		throw new Error(`Could not open input file: ${absoluteFilePath}`);
	}

	php.useHostFilesystem();

	let fileToExecute = absoluteFilePath;
	if (wpNowOptions.mode !== 'index') {
		// Load WordPress context for non index mode.
		php.mkdirTree(VFS_TMP_PATH);
		php.writeFile(
			VFS_PHP_FILE,
			`<?php
      $_SERVER['HTTP_HOST'] = '${wpNowOptions.absoluteUrl}';
      require_once '${path.join(wpNowOptions.documentRoot, 'wp-load.php')}';
      require_once '${filePath}';
    `
		);
		fileToExecute = VFS_PHP_FILE;
	}

	try {
		await php.cli(['php', fileToExecute]);
	} catch (resultOrError) {
		if (resultOrError.name === 'ExitStatus' && resultOrError.status === 0) {
			// Success
			return resultOrError;
		} else {
			// Real error
			throw resultOrError;
		}
	}
}
