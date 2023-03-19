<?php
/**
 * Plugin Name: SQLite Database Integration
 * Description: SQLite database driver drop-in. (based on SQLite Integration by Kojima Toshiyasu)
 * Author: WordPress Performance Team
 * Version: 2.0
 * Requires PHP: 5.6
 * Textdomain: sqlite-database-integration
 *
 * This project is based on the original work of Kojima Toshiyasu and his SQLite Integration plugin,
 * and the work of Evan Mattson and his WP SQLite DB plugin - See https://github.com/aaemnnosttv/wp-sqlite-db
 *
 * @package wp-sqlite-integration
 */

define( 'SQLITE_MAIN_FILE', __FILE__ );

require_once __DIR__ . '/admin-page.php';
require_once __DIR__ . '/activate.php';
require_once __DIR__ . '/deactivate.php';
require_once __DIR__ . '/admin-notices.php';
require_once __DIR__ . '/health-check.php';
