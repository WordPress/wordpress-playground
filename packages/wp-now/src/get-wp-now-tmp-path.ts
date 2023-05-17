import path from 'path';
import os from 'os';

/**
 * The full path to the hidden WP Now folder in the user's tmp directory.
 */
export default function getWpNowTmpPath() {
	const tmpDirectory = os.tmpdir();

	return path.join(tmpDirectory, `wp-now-tests-hidden-folder`);
}
