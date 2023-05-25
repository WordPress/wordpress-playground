import fs from 'fs';
import path from 'path';
import startWPNow from './wp-now';
import { WPNowOptions } from './config';
import { disableOutput } from './output';

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
) {
	disableOutput();
	const { phpInstances } = await startWPNow({
		...options,
		numberOfPhpInstances: 2,
	});
	const [, php] = phpInstances;

	// check if filePath exists
	const absoluteFilePath = path.resolve(filePath);
	if (!fs.existsSync(absoluteFilePath)) {
		throw new Error(`Could not open input file: ${absoluteFilePath}`);
	}

	try {
		php.useHostFilesystem();
		await php.cli(['php', absoluteFilePath]);
	} catch (resultOrError) {
		const success =
			resultOrError.name === 'ExitStatus' && resultOrError.status === 0;
		if (!success) {
			throw resultOrError;
		}
	}
}
