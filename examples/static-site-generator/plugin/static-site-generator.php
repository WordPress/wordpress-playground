<?php
/**
 * Plugin Name: Playground Static Site Generator
 * Plugin URI: https://github.com/WordPress/wordpress-playground/issues/707
 * Description: Exports a WordPress site to static files, with WordPress Playground-friendly admin, CLI, and Blueprint workflows.
 * Version: 0.1.0
 * Requires at least: 6.5
 * Requires PHP: 7.4
 * Author: WordPress Contributors
 * License: GPL-2.0-or-later
 * Text Domain: playground-static-site-generator
 *
 * @package PlaygroundStaticSiteGenerator
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'SSGWP_VERSION', '0.1.0' );
define( 'SSGWP_PLUGIN_FILE', __FILE__ );
define( 'SSGWP_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'SSGWP_PLUGIN_BASENAME', plugin_basename( __FILE__ ) );

require_once SSGWP_PLUGIN_DIR . 'includes/class-url-collector.php';
require_once SSGWP_PLUGIN_DIR . 'includes/class-static-exporter.php';
require_once SSGWP_PLUGIN_DIR . 'includes/class-plugin.php';

add_action( 'plugins_loaded', array( 'SSGWP_Plugin', 'init' ) );

/**
 * Programmatic export API for Playground Blueprints and local automation.
 *
 * @param string $output_file Absolute path to the zip file to create.
 * @param array  $args        Export options.
 * @return array Export summary.
 */
function ssgwp_export_static_site( $output_file, array $args = array() ) {
	$exporter = new SSGWP_Static_Exporter();

	return $exporter->export_to_zip( $output_file, $args );
}
