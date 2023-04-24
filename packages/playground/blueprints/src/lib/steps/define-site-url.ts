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
		(contents) =>
			`<?php 
			if ( ! defined( 'WP_HOME' ) ) {
            	define('WP_HOME', "${siteUrl}");
			}
			if ( ! defined( 'WP_SITEURL' ) ) {
            	define('WP_SITEURL', "${siteUrl}");
			}
            ?>${contents}`
	);
}
