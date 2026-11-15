<?php
/**
 * PHP steps of apply-update.sh, the single website installer.
 *
 * apply-update.sh runs the shell steps (host probes, moves, edge purge) and calls
 * this file for each step that needs PHP:
 *
 *     php apply-update.php <command> <arguments...>
 *
 * Values arrive only as arguments. Generated PHP and JavaScript embed them with
 * var_export() or json_encode(), never by splicing text into source code.
 */

$commands = array(
	'check-origins'       => 'check_origins',
	'check-build'         => 'check_build',
	'write-private-files' => 'write_private_files',
	'activate'            => 'activate',
	'prune'               => 'prune',
);
$command = $argv[1] ?? '';
if ( ! isset( $commands[ $command ] ) ) {
	fwrite( STDERR, "Unknown apply-update.php command: $command\n" );
	exit( 2 );
}
$commands[ $command ]( ...array_slice( $argv, 2 ) );

/**
 * Reject origins before touching the web root.
 *
 * A bad origin could put app documents on the sandbox host or import platform
 * scripts from the wrong host. Pages compare these strings with location.origin,
 * so they must already be canonical.
 */
function check_origins( $app_origin, $wordpress_origin, $release, $local ) {
	foreach ( array( $app_origin, $wordpress_origin ) as $origin ) {
		$parts    = parse_url( $origin );
		$host     = $parts['host'] ?? '';
		$scheme   = $parts['scheme'] ?? null;
		$loopback = in_array( $host, array( 'localhost', '127.0.0.1' ), true ) || str_ends_with( $host, '.localhost' );
		if ( ! filter_var( $origin, FILTER_VALIDATE_URL ) ||
			! ( 'https' === $scheme || ( '1' === $local && $loopback && 'http' === $scheme ) ) ||
			( '1' === $local && ! $loopback ) ||
			isset( $parts['user'] ) || isset( $parts['pass'] ) ||
			isset( $parts['path'] ) || isset( $parts['query'] ) || isset( $parts['fragment'] )
		) {
			throw new RuntimeException( "Expected an HTTPS origin without a path: $origin" );
		}
		$default_port = array( 'http' => 80, 'https' => 443 )[ $scheme ];
		$canonical    = $scheme . '://' . strtolower( $host ) .
			( isset( $parts['port'] ) && $parts['port'] !== $default_port ? ':' . $parts['port'] : '' );
		if ( $origin !== $canonical ) {
			throw new RuntimeException( "Expected the origin in canonical form: $canonical" );
		}
	}
	if ( 0 === strcasecmp( parse_url( $app_origin, PHP_URL_HOST ), parse_url( $wordpress_origin, PHP_URL_HOST ) ) ) {
		throw new RuntimeException( 'The app and WordPress must use different hostnames' );
	}
	require_release_id( $release );
}

/**
 * Check the uploaded build's pages and links before it goes live.
 *
 * Both hostnames serve every page, so each must stop itself on the wrong origin.
 * Check every page, as the build guards them: a page added outside the guarded
 * Vite builds would otherwise run app code on the WordPress host.
 *
 * Nginx follows symlinks, so a link could publish any server file. Allow only
 * relative links to files in the build; they still resolve after it is moved.
 */
function check_build( $build, $app_origin, $wordpress_origin ) {
	$root = realpath( $build );
	foreach ( new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $build, FilesystemIterator::SKIP_DOTS ) ) as $file ) {
		$page = substr( $file->getPathname(), strlen( $build ) + 1 );
		if ( $file->isLink() ) {
			$target = realpath( $file->getPathname() );
			if ( str_starts_with( readlink( $file->getPathname() ), '/' ) || false === $target || ! str_starts_with( $target, "$root/" ) ) {
				refuse( "$page links outside the build." );
			}
		}
		if ( ! preg_match( '/\.html?\z/i', $page ) || preg_match( '~\Awp-[^/]+/~', $page ) ) {
			continue;
		}
		$origin = 'wordpress-bridge.html' === $page ? $wordpress_origin : $app_origin;
		if ( ! str_contains( file_get_contents( $file->getPathname() ), "location.origin!==\"$origin\"" ) ) {
			refuse( "$page does not check for $origin." );
		}
	}
}

/**
 * Write the release's private PHP: MIME map, native endpoints, and request entry.
 *
 * PHP endpoints leave the public release because Nginx would run them on both
 * hostnames. The entry selects this exact release. Once PHP loads it, it keeps
 * using this release even if another deployment replaces the root entry.
 * Personal WP still uses the existing no-argument entry.
 */
function write_private_files( $staging, $private, $release, $wordpress_origin, $app_origin, $mime_map ) {
	$types = json_decode( file_get_contents( $mime_map ), true, 512, JSON_THROW_ON_ERROR );
	if ( ( $types['_default'] ?? null ) !== 'application/octet-stream' ||
		( $types['html'] ?? null ) !== 'text/html' ||
		( $types['jpeg'] ?? null ) !== 'image/jpeg'
	) {
		throw new RuntimeException( 'MIME map is missing required entries' );
	}
	write_file( "$private/mime-types.php", "<?php\n\$mime_types = " . var_export( $types, true ) . ";\n" );

	$files = new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $staging, FilesystemIterator::SKIP_DOTS ) );
	foreach ( iterator_to_array( $files ) as $file ) {
		$relative = substr( $file->getPathname(), strlen( $staging ) + 1 );
		if ( ! str_ends_with( strtolower( $relative ), '.php' ) ) {
			continue;
		}
		$target = "$private/files/$relative";
		if ( ! is_dir( dirname( $target ) ) ) {
			mkdir( dirname( $target ), 0755, true );
		}
		if ( ! rename( $file->getPathname(), $target ) ) {
			throw new RuntimeException( "Cannot move $relative" );
		}
	}

	$entry = "/.playground-releases/$release";
	write_file(
		"$private/public-entry.php",
		"<?php\nif (\"cli\" === php_sapi_name()) { return; }\n" .
		"define(\"PLAYGROUND_DEBUG\", false);\n" .
		'require_once __DIR__ . ' . var_export( "$entry/custom-redirects-lib.php", true ) . ";\n" .
		'playground_handle_request(__DIR__ . ' . var_export( "/releases/$release", true ) . ', ' .
		var_export( $wordpress_origin, true ) . ', ' . var_export( $app_origin, true ) . ', __DIR__ . ' .
		var_export( "$entry/files", true ) . ");\n"
	);
}

/**
 * Activate a staged release, or restore a root snapshot for manual rollback.
 *
 * One inventory owns root activation, failure recovery, manual rollback and pruning.
 * Release files remain immutable; only these small entry files are replaced.
 */
function activate( $root, $backups, $release, $rollback, $retention ) {
	retention_seconds( $retention );
	require_release_id( $release );
	require_once __DIR__ . '/custom-redirects-lib.php';
	$manifest = is_file( "$root/release.json" ) ? read_json( "$root/release.json" ) : array();
	$owned    = array_unique(
		array_merge(
			$manifest['rootFiles'] ?? array(),
			array( 'custom-redirects.php', 'sw.js', 'release.json', '__wp__/index.php' )
		)
	);
	if ( '' !== $rollback ) {
		require_release_id( $rollback );
		$backup    = "$backups/$rollback";
		$inventory = read_json( "$backup/inventory.json" );
		$target    = is_file( "$backup/release.json" ) ? read_json( "$backup/release.json" ) : null;
		if ( $target && ( ! is_dir( "$root/releases/{$target['release']}" ) || ! is_dir( "$root/.playground-releases/{$target['release']}" ) ) ) {
			throw new RuntimeException( 'Rollback release has expired.' );
		}
		record_activation( $root, $manifest['release'] ?? null, $target['release'] ?? null );
		restore_snapshot( $root, $backup, $inventory, $owned );
		echo "Restored root snapshot $rollback\n";
		return;
	}

	$public  = "$root/releases/$release";
	$private = "$root/.playground-releases/$release";
	$sources = array(
		'custom-redirects.php' => "$private/public-entry.php",
		'__wp__/index.php'     => __DIR__ . '/__wp__/index.php',
	);
	foreach ( new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $public, FilesystemIterator::SKIP_DOTS ) ) as $file ) {
		$path = substr( $file->getPathname(), strlen( $public ) + 1 );
		if ( str_ends_with( $path, '.html' ) && ! preg_match( '~^wp-[^/]+/~', $path ) && ! playground_is_static_file_needing_special_treatment( "/$path" ) ) {
			$sources[ $path ] = $file->getPathname();
		}
	}
	write_file( "$private/root-sw.js", 'import ' . json_encode( "/releases/$release/sw.js", JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR ) . ";\n" );
	$sources['sw.js'] = "$private/root-sw.js";
	$next = array(
		'release'         => $release,
		'previousRelease' => $manifest['release'] ?? null,
		'installedAt'     => time(),
		'rootFiles'       => array_merge( array_keys( $sources ), array( 'release.json' ) ),
	);
	write_file( "$private/release.json", json_encode( $next, JSON_THROW_ON_ERROR ) . "\n" );
	$sources['release.json'] = "$private/release.json";

	$backup = "$backups/$release";
	if ( is_dir( $backup ) ) {
		throw new RuntimeException( 'Backup already exists.' );
	}
	mkdir( $backup, 0755, true );
	$inventory = array(
		'files'  => array(),
		'absent' => array(),
	);
	foreach ( array_unique( array_merge( $owned, array_keys( $sources ) ) ) as $path ) {
		if ( is_file( "$root/$path" ) ) {
			install_file( "$backup/$path", "$root/$path" );
			$inventory['files'][] = $path;
		} else {
			$inventory['absent'][] = $path;
		}
	}
	write_file( "$backup/inventory.json", json_encode( $inventory, JSON_THROW_ON_ERROR ) );
	record_activation( $root, $manifest['release'] ?? null, $release );
	try {
		foreach ( array_diff( $owned, array_keys( $sources ) ) as $path ) {
			remove_root_file( $root, $path );
		}
		foreach ( $sources as $path => $source ) {
			install_file( "$root/$path", $source );
		}
	} catch ( Throwable $error ) {
		restore_snapshot( $root, $backup, $inventory, array_keys( $sources ) );
		throw new RuntimeException( 'Activation failed; previous root files restored.', 0, $error );
	}
	echo "Activated release $release; root snapshot: $backup\n";
}

/**
 * Remove inactive releases after the activation's edge purge.
 *
 * A cleanup failure must not leave stale entry responses cached, and must still
 * be reported as a deployment error. Protect the active release and its rollback
 * target.
 */
function prune( $root, $backups, $retention ) {
	$window = retention_seconds( $retention );
	if ( ! is_file( "$root/release.json" ) ) {
		return;
	}
	$active    = read_json( "$root/release.json" );
	$protected = array( $active['release'], $active['previousRelease'] ?? null );
	foreach ( glob( "$root/.playground-releases/*/release.json" ) as $metadata ) {
		$candidate = read_json( $metadata );
		$id        = $candidate['release'] ?? null;
		// The ID names directories to delete, so it must be the metadata's own directory.
		if ( basename( dirname( $metadata ) ) !== $id ) {
			throw new RuntimeException( "Lifecycle metadata names another release: $metadata" );
		}
		if ( $id === $active['release'] ) {
			continue;
		}
		// Failed uploads may never have been activated. Start their inactivity window
		// on first observation; real activation/rollback transitions were recorded then.
		if ( ! isset( $candidate['inactiveSince'] ) ) {
			$candidate['inactiveSince'] = time();
			$json                       = json_encode( $candidate, JSON_THROW_ON_ERROR ) . "\n";
			if ( file_put_contents( $metadata, $json, LOCK_EX ) !== strlen( $json ) ) {
				throw new RuntimeException( "Cannot update lifecycle metadata: $id" );
			}
		}
		if ( in_array( $id, $protected, true ) || $candidate['inactiveSince'] >= time() - $window ) {
			continue;
		}
		foreach ( array( "$root/releases/$id", "$root/.playground-releases/.staging-$id", "$root/.playground-releases/$id", "$backups/$id" ) as $directory ) {
			remove_tree( $directory );
		}
		echo "Expired release $id\n";
	}
}

function refuse( $reason ) {
	fwrite( STDERR, "Refusing deployment: $reason\n" );
	exit( 1 );
}

function require_release_id( $id ) {
	if ( ! preg_match( '/\A[A-Za-z0-9][A-Za-z0-9._-]*\z/', $id ) ) {
		throw new RuntimeException( "Invalid release ID: $id" );
	}
}

function retention_seconds( $retention ) {
	if ( ! ctype_digit( $retention ) || (int) $retention < 1 ) {
		throw new RuntimeException( 'Retention must be a positive number of days.' );
	}
	return (int) $retention * 86400;
}

function read_json( $path ) {
	return json_decode( file_get_contents( $path ), true, 512, JSON_THROW_ON_ERROR );
}

/**
 * Record transitions before touching roots, independently of edge purge/cleanup.
 * A failed activation may extend retention; the next transition resets it again.
 */
function record_activation( $root, $previous, $active ) {
	foreach ( array_unique( array_filter( array( $active, $previous ) ) ) as $id ) {
		$metadata = "$root/.playground-releases/$id/release.json";
		// Earlier deployments without lifecycle metadata require the legacy audit.
		if ( ! is_file( $metadata ) ) {
			continue;
		}
		$candidate = read_json( $metadata );
		if ( $id === $active ) {
			unset( $candidate['inactiveSince'] );
		} else {
			$candidate['inactiveSince'] = time();
		}
		write_file( $metadata, json_encode( $candidate, JSON_THROW_ON_ERROR ) . "\n" );
	}
}

function restore_snapshot( $root, $backup, $inventory, $current ) {
	foreach ( array_unique( array_merge( $inventory['absent'], array_diff( $current, $inventory['files'] ) ) ) as $path ) {
		remove_root_file( $root, $path );
	}
	// release.json is committed last, just as during activation.
	foreach ( array_diff( $inventory['files'], array( 'release.json' ) ) as $path ) {
		install_file( "$root/$path", "$backup/$path" );
	}
	if ( in_array( 'release.json', $inventory['files'], true ) ) {
		install_file( "$root/release.json", "$backup/release.json" );
	}
}

function install_file( $target, $source ) {
	if ( ! is_dir( dirname( $target ) ) && ! mkdir( dirname( $target ), 0755, true ) ) {
		throw new RuntimeException( "Cannot create parent of $target" );
	}
	$temporary = tempnam( dirname( $target ), '.playground-new-' );
	if ( false === $temporary ) {
		throw new RuntimeException( "Cannot stage $target" );
	}
	try {
		if ( ! copy( $source, $temporary ) || ! chmod( $temporary, 0644 ) || ! rename( $temporary, $target ) ) {
			throw new RuntimeException( "Cannot install $target" );
		}
	} finally {
		if ( is_file( $temporary ) ) {
			unlink( $temporary );
		}
	}
}

function write_file( $path, $contents ) {
	$temporary = tempnam( dirname( $path ), '.playground-new-' );
	if ( false === $temporary ) {
		throw new RuntimeException( "Cannot stage $path" );
	}
	try {
		if ( file_put_contents( $temporary, $contents ) !== strlen( $contents ) || ! chmod( $temporary, 0644 ) || ! rename( $temporary, $path ) ) {
			throw new RuntimeException( "Cannot write $path" );
		}
	} finally {
		if ( is_file( $temporary ) ) {
			unlink( $temporary );
		}
	}
}

function remove_root_file( $root, $path ) {
	if ( is_file( "$root/$path" ) && ! unlink( "$root/$path" ) ) {
		throw new RuntimeException( "Cannot remove $path" );
	}
	$parent = dirname( "$root/$path" );
	while ( $parent !== $root && is_dir( $parent ) && 2 === count( scandir( $parent ) ) ) {
		rmdir( $parent );
		$parent = dirname( $parent );
	}
}

function remove_tree( $directory ) {
	if ( ! is_dir( $directory ) ) {
		return;
	}
	foreach ( new FilesystemIterator( $directory ) as $file ) {
		if ( $file->isDir() && ! $file->isLink() ) {
			remove_tree( $file->getPathname() );
		} else {
			unlink( $file->getPathname() );
		}
	}
	rmdir( $directory );
}
