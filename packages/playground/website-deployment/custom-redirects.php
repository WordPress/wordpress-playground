<?php
/**
 * ATTENTION: Please update Playground's .htaccess file as necessary
 * whenever making changes here.
 */

define('PLAYGROUND_DEBUG', true);
playground_handle_request();

// Used during deployment to identify files that need to be served in a custom way via PHP
function playground_file_needs_special_treatment( $path ) {
	return (
		!! playground_maybe_rewrite( $path ) ||
		!! playground_maybe_redirect( $path ) ||
		!! playground_get_custom_response_headers( $path )
	);
}

function playground_handle_request() {
	if ( empty( $_SERVER['REQUEST_URI'] ) ) {
		return;
	}

	$log = defined( 'PLAYGROUND_DEBUG' ) && PLAYGROUND_DEBUG
		? function ( $str ) { error_log( "PLAYGROUND: $str" ); }
		: function () {};

	$log( "Handling request for '${_SERVER['REQUEST_URI']}'" );

	$url = parse_url( $_SERVER['REQUEST_URI'] );
	if ( false === $url ) {
		$log( "Unable to parse URL: '$url'" );
		return;
	}

	$original_requested_path = $url['path'];
	$log( "Requested path: '$original_requested_path'" );

	//
	// REWRITES
	//
	$requested_path = $original_requested_path;
	$rewritten_path = playground_maybe_rewrite( $original_requested_path );
	if ( $rewritten_path ) {
		$requested_path = $rewritten_path;
		$log( "Rewrote '$original_requested_path' to '$requested_path'" );
	}

	//
	// REDIRECTS
	//
	$redirect = playground_maybe_redirect( $requested_path );
	if ( false !== $redirect ) {
		$log( "Redirecting to '${redirect['location']}' with status '${redirect['status']}'" );
		header( "Location: ${redirect['location']}" );
		http_response_code( $redirect['status'] );
		die();
	}

	//
	// PATH RESOLUTION
	//
	$resolved_path = realpath( __DIR__ . $requested_path );
	if ( is_dir( $resolved_path ) ) {
		$resolved_path = playground_resolve_to_index_file( $resolved_path );
	}

	if ( false === $resolved_path ) {
		$resolved_path = realpath( __DIR__ . '/playground-files' . $requested_path );
		if ( is_dir( $resolved_path ) ) {
			$resolved_path = playground_resolve_to_index_file( $resolved_path );
		}
	}

	$log( "Resolved '$original_requested_path' to '$resolved_path'." );

	if ( false === $resolved_path ) {
		$log( "File not found: '$resolved_path'" );
		http_response_code( 404 );
		die();
	}

	if ( ! str_starts_with( $resolved_path, '/srv/htdocs/' ) ) {
		$log( "This looks like attempted path traversal: '$original_requested_path'" );
		http_response_code( 403 );
		die();
	}

	//
	// RESPONSE HEADERS
	//
	
	$mtime = filemtime( $resolved_path );
	$last_modified = date( 'F d Y H:i:s.', $mtime );
	header( "Last-Modified: $last_modified" );

	$filename = basename( $resolved_path );

	$extension_match = array();
	$extension_match_result = preg_match(
		'/\.(?<value>[^\.]+)$/',
		$filename,
		$extension_match
	);
	$extension = $extension_match_result === 1
		? strtolower( $extension_match['value'] )
		: false;

	require_once __DIR__ . '/mime-types.php';
	if ( isset( $mime_types[ $extension ] ) ) {
		$content_type = $mime_types[ $extension ];
		$log( "Setting Content-Type to '$content_type'" );
		header( "Content-Type: $content_type" );
	}

	$custom_response_headers = playground_get_custom_response_headers( $filename );
	if ( ! empty( $custom_response_headers ) ) {
		foreach ( $custom_response_headers as $custom_header ) {
			header( $custom_header );
		}
	} else {
		$log( "Marking for cache: '$resolved_path'" );
		header( 'A8C-Edge-Cache: cache' );
		//header( 'Cache-Control: max-age=300, must-revalidate' );	
	}

	if ( 'HEAD' === $_SERVER['REQUEST_METHOD'] ) {
		die();
	}

	//
	// CONTENT
	//

	if ( 'php' === $extension ) {
		$log( "Running PHP: '$resolved_path'" );
		// TODO: Set these from persistent data for logger.php
		/*
		# Slack All
		SetEnv SLACK_CHANNEL --secret--
		SetEnv SLACK_TOKEN --secret--
		*/
		require $resolved_path;
	} else {
		$log( "Reading static file: '$resolved_path'" );
		readfile( $resolved_path );
	}
	die();
}

function playground_maybe_rewrite( $original_requested_path ) {
	$requested_path = $original_requested_path;

	if ( str_ends_with( $requested_path, 'plugin-proxy' ) ) {
		$requested_path = '/plugin-proxy.php';
	}

	if ( $requested_path !== $original_requested_path ) {
		return $requested_path;
	}

	return false;	
}

function playground_maybe_redirect( $requested_path ) {
	if ( str_ends_with( $requested_path, '/wordpress-browser.html' ) ) {
		return array(
			'location' => '/',
			'status' => 301
		);
	}

	$has_dotorg_referrer = isset( $_SERVER['HTTP_REFERER'] ) && (
		str_starts_with( $_SERVER['HTTP_REFERER'], 'https://developer.wordpress.org/' ) ||
		str_starts_with( $_SERVER['HTTP_REFERER'], 'https://wordpress.org/' )
	);
	if ( $has_dotorg_referrer && str_ends_with( $requested_path, '/wordpress.html' ) ) {
		return array(
			'location' => '/index.html',
			'status' => 302,
		);
	}

	return false;
}

function playground_get_custom_response_headers( $filename ) {
	if ( 'iframe-worker.html' === $filename ) {
		return array( 'Origin-Agent-Cluster: ?1' );
	} elseif ( str_ends_with( $filename, 'store.zip' ) ) {
		// Disable compression so zip file can be read piece by piece
		// using file offsets embedded in the zip's metadata.
		return array(
			'Content-Encoding: identity',
			'Access-Control-Allow-Origin: *',
		);
	} elseif ( 'index.html' === $filename ) {
		return array( 'Cache-Control: max-age=0, no-cache, no-store, must-revalidate' );
	} elseif (
		in_array(
			$filename,
			array(
				'index.js',
				'blueprint-schema.json',
				'logger.php',
				'wp-cli.phar',
				'wordpress-importer.zip',
			),
			true
		)
	) {
		return array(
			'Access-Control-Allow-Origin: *',
			'Cache-Control: max-age=0, no-cache, no-store, must-revalidate',
		);
	}

	return false;
}

function playground_resolve_to_index_file( $real_path ) {
	if ( file_exists( "$real_path/index.php" ) ) {
		return "$real_path/index.php";
	} elseif ( file_exists( "$real_path/index.html" ) ) {
		return "$real_path/index.html";
	} else {
		return false;
	}
}
