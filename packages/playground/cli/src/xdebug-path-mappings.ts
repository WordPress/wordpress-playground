import fs from 'fs';
import { logger } from '@php-wasm/logger';

/**
 * Create a symlink to temp dir for the Playground CLI.
 *
 * The symlink is created to access the system temp dir
 * inside the current debugging directory.
 *
 * @param nativeDirPath The system temp dir path.
 * @param symlinkPath The symlink path.
 */
export async function createPlaygroundCliTempDirSymlink(
	nativeDirPath: string,
	symlinkPath: string
) {
	removePlaygroundCliTempDirSymlink(symlinkPath);

	fs.symlinkSync(nativeDirPath, symlinkPath, 'junction');
}

/**
 * Remove the temp dir symlink if it exists.
 *
 * @param symlinkPath The symlink path.
 */
export async function removePlaygroundCliTempDirSymlink(symlinkPath: string) {
	if (fs.existsSync(symlinkPath)) {
		const stat = fs.lstatSync(symlinkPath);

		if (stat.isSymbolicLink()) {
			fs.unlinkSync(symlinkPath);
		} else {
			logger.warn(
				`${symlinkPath} exists and is not a symlink. Skipping symlink creation.`
			);
			return;
		}
	}
}
