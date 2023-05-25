import path from 'path';
import getWpNowPath from './get-wp-now-path';
import getWpCliTmpPath from './get-wp-cli-tmp-path';

/**
 * The path for wp-cli phar file within the WP Now folder.
 */
export default function getWpCliPath() {
	if (process.env.NODE_ENV !== 'test') {
		return path.join(getWpNowPath(), 'wp-cli.phar');
	}
	return getWpCliTmpPath();
}
