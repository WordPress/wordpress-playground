import path from 'path';
import getWpNowPath from './get-wp-now-path';

/**
 * The path where WordPress zip files will be unzipped and stored within the WP Now folder.
 */
export default function getWordpressVersionsPath() {
	return path.join(getWpNowPath(), 'wordpress-versions');
}
