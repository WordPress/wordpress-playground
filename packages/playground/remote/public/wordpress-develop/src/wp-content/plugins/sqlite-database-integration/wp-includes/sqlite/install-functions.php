<?php
/**
 * Main integration file.
 *
 * @package wp-sqlite-integration
 * @since 1.0.0
 */

/**
 * Function to create tables according to the schemas of WordPress.
 *
 * This is executed only once while installation.
 *
 * @since 1.0.0
 *
 * @return boolean
 *
 * @throws PDOException If the database connection fails.
 */
function sqlite_make_db_sqlite() {
	include_once ABSPATH . 'wp-admin/includes/schema.php';

	$table_schemas = wp_get_db_schema();
	$queries       = explode( ';', $table_schemas );
	try {
		$pdo = new PDO( 'sqlite:' . FQDB, null, null, array( PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION ) ); // phpcs:ignore WordPress.DB.RestrictedClasses
	} catch ( PDOException $err ) {
		$err_data = $err->errorInfo; // phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase
		$message  = 'Database connection error!<br />';
		$message .= sprintf( 'Error message is: %s', $err_data[2] );
		wp_die( $message, 'Database Error!' );
	}

	$translator = new WP_SQLite_Translator( $pdo, $GLOBALS['table_prefix'] );
	$query      = null;

	try {
		$translator->begin_transaction();
		foreach ( $queries as $query ) {
			$query = trim( $query );
			if ( empty( $query ) ) {
				continue;
			}

			$result = $translator->query( $query );
			if ( false === $result ) {
				throw new PDOException( $translator->get_error_message() );
			}
		}
		$translator->commit();
	} catch ( PDOException $err ) {
		$err_data = $err->errorInfo; // phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase
		$err_code = $err_data[1];
		$translator->rollback();
		$message  = sprintf(
			'Error occurred while creating tables or indexes...<br />Query was: %s<br />',
			var_export( $query, true )
		);
		$message .= sprintf( 'Error message is: %s', $err_data[2] );
		wp_die( $message, 'Database Error!' );
	}

	/*
	 * Debug: Cross-check with MySQL.
	 * This is for debugging purpose only and requires files
	 * that are present in the GitHub repository
	 * but not the plugin published on WordPress.org.
	 */
	if ( defined( 'SQLITE_DEBUG_CROSSCHECK' ) && SQLITE_DEBUG_CROSSCHECK ) {
		$host = DB_HOST;
		$port = 3306;
		if ( str_contains( $host, ':' ) ) {
			$host_parts = explode( ':', $host );
			$host       = $host_parts[0];
			$port       = $host_parts[1];
		}
		$dsn       = 'mysql:host=' . $host . '; port=' . $port . '; dbname=' . DB_NAME;
		$pdo_mysql = new PDO( $dsn, DB_USER, DB_PASSWORD, array( PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION ) ); // phpcs:ignore WordPress.DB.RestrictedClasses.mysql__PDO
		$pdo_mysql->query( 'SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";' );
		$pdo_mysql->query( 'SET time_zone = "+00:00";' );
		foreach ( $queries as $query ) {
			$query = trim( $query );
			if ( empty( $query ) ) {
				continue;
			}
			try {
				$pdo_mysql->beginTransaction();
				$pdo_mysql->query( $query );
			} catch ( PDOException $err ) {
				$err_data = $err->errorInfo; // phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase
				$err_code = $err_data[1];
				if ( 5 == $err_code || 6 == $err_code ) { // phpcs:ignore WordPress.PHP.StrictComparisons.LooseComparison
					// If the database is locked, commit again.
					$pdo_mysql->commit();
				} else {
					$pdo_mysql->rollBack();
					$message  = sprintf(
						'Error occurred while creating tables or indexes...<br />Query was: %s<br />',
						var_export( $query, true )
					);
					$message .= sprintf( 'Error message is: %s', $err_data[2] );
					wp_die( $message, 'Database Error!' );
				}
			}
		}
	}

	$pdo = null;

	return true;
}

/**
 * Installs the site.
 *
 * Runs the required functions to set up and populate the database,
 * including primary admin user and initial options.
 *
 * @since 1.0.0
 *
 * @param string $blog_title    Site title.
 * @param string $user_name     User's username.
 * @param string $user_email    User's email.
 * @param bool   $is_public     Whether the site is public.
 * @param string $deprecated    Optional. Not used.
 * @param string $user_password Optional. User's chosen password. Default empty (random password).
 * @param string $language      Optional. Language chosen. Default empty.
 * @return array {
 *     Data for the newly installed site.
 *
 *     @type string $url              The URL of the site.
 *     @type int    $user_id          The ID of the site owner.
 *     @type string $password         The password of the site owner, if their user account didn't already exist.
 *     @type string $password_message The explanatory message regarding the password.
 * }
 */
function wp_install( $blog_title, $user_name, $user_email, $is_public, $deprecated = '', $user_password = '', $language = '' ) {
	if ( ! empty( $deprecated ) ) {
		_deprecated_argument( __FUNCTION__, '2.6.0' );
	}

	wp_check_mysql_version();
	wp_cache_flush();
	/* SQLite changes: Replace the call to make_db_current_silent() with sqlite_make_db_sqlite(). */
	sqlite_make_db_sqlite(); // phpcs:ignore PHPCompatibility.Extensions.RemovedExtensions.sqliteRemoved
	populate_options();
	populate_roles();

	update_option( 'blogname', $blog_title );
	update_option( 'admin_email', $user_email );
	update_option( 'blog_public', $is_public );

	// Freshness of site - in the future, this could get more specific about actions taken, perhaps.
	update_option( 'fresh_site', 1 );

	if ( $language ) {
		update_option( 'WPLANG', $language );
	}

	$guessurl = wp_guess_url();

	update_option( 'siteurl', $guessurl );

	// If not a public site, don't ping.
	if ( ! $is_public ) {
		update_option( 'default_pingback_flag', 0 );
	}

	/*
	 * Create default user. If the user already exists, the user tables are
	 * being shared among sites. Just set the role in that case.
	 */
	$user_id        = username_exists( $user_name );
	$user_password  = trim( $user_password );
	$email_password = false;
	$user_created   = false;

	if ( ! $user_id && empty( $user_password ) ) {
		$user_password = wp_generate_password( 12, false );
		$message       = __( '<strong><em>Note that password</em></strong> carefully! It is a <em>random</em> password that was generated just for you.', 'sqlite-database-integration' );
		$user_id       = wp_create_user( $user_name, $user_password, $user_email );
		update_user_meta( $user_id, 'default_password_nag', true );
		$email_password = true;
		$user_created   = true;
	} elseif ( ! $user_id ) {
		// Password has been provided.
		$message      = '<em>' . __( 'Your chosen password.', 'sqlite-database-integration' ) . '</em>';
		$user_id      = wp_create_user( $user_name, $user_password, $user_email );
		$user_created = true;
	} else {
		$message = __( 'User already exists. Password inherited.', 'sqlite-database-integration' );
	}

	$user = new WP_User( $user_id );
	$user->set_role( 'administrator' );

	if ( $user_created ) {
		$user->user_url = $guessurl;
		wp_update_user( $user );
	}

	wp_install_defaults( $user_id );

	wp_install_maybe_enable_pretty_permalinks();

	flush_rewrite_rules();

	wp_new_blog_notification( $blog_title, $guessurl, $user_id, ( $email_password ? $user_password : __( 'The password you chose during installation.', 'sqlite-database-integration' ) ) );

	wp_cache_flush();

	/**
	 * Fires after a site is fully installed.
	 *
	 * @since 3.9.0
	 *
	 * @param WP_User $user The site owner.
	 */
	do_action( 'wp_install', $user );

	return array(
		'url'              => $guessurl,
		'user_id'          => $user_id,
		'password'         => $user_password,
		'password_message' => $message,
	);
}
