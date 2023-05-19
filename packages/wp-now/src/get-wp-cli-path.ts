import path from 'path';
import getWpNowPath from './get-wp-now-path';

/**
 * The path for wp-cli phar file within the WP Now folder.
 */
export default function getWpCliPath() {
	return path.join(getWpNowPath(), 'wp-cli.phar');
}
