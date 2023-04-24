import { UniversalPHP } from '@php-wasm/universal';
import { updateFile } from './common';

/**
 * Sets site URL of the WordPress installation.
 *
 * @param playground The playground client.
 * @param siteUrl
 */
export async function defineSiteUrl(playground: UniversalPHP, siteUrl: string) {
	await updateFile(
		playground,
		`/wordpress/wp-config.php`,
		// @TODO: Remove any existing define('WP_HOME') and define('WP_SITEURL') lines.
		(contents) =>
			`<?php 
            define('WP_HOME', "${siteUrl}");
            define('WP_SITEURL', "${siteUrl}");
            ?>${contents}`
	);
}
