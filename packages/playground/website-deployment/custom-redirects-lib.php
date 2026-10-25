<?php
/**
 * ATTENTION: Please update Playground's .htaccess file as necessary
 * whenever making changes here.
 */

// Used during deployment to identify files that need to be served in a custom way via PHP
function playground_is_static_file_needing_special_treatment( $path ) {
	if ( str_ends_with( $path, '.php' ) ) {
		return false;
	}

	return (
		!! playground_maybe_rewrite( $path ) ||
		!! playground_maybe_redirect( $path ) ||
		!! playground_get_custom_response_headers( $path ) ||
		!! playground_maybe_set_environment( $path )
	);
}

/**
 * Apply the deployed website's rewrites, redirects, headers, and PHP setup.
 *
 * The configured sandbox host serves only the wordpress-sandbox/ subdirectory:
 * the built HTTP helper and worker loaders, never app documents or PHP endpoints.
 * Other hosts continue through the existing request handling below.
 *
 * The deployment script passes its private build directory. Personal WP passes no
 * argument and keeps its existing public/static-files-to-serve-via-php layout.
 * A missing private build must fail rather than fall back to public files.
 *
 * Deployment writes the configured sandbox origin into the release entry. Request
 * headers and query parameters must not change that configuration. The build
 * has already pointed the sandbox's script URLs at the shared app origin.
 *
 * @param string|null $build_directory Private main-website build, or null for the public layout.
 * @param string|null $wordpress_origin Configured sandbox origin; null for the legacy layout.
 */
function playground_handle_request( $build_directory = null, $wordpress_origin = null ) {
	$directory = realpath( $build_directory ?? __DIR__ );
	if ( false === $directory || ! is_dir( $directory ) ) {
		http_response_code( 503 );
		exit;
	}

	$may_edge_cache = true;

	// TODO: If needed, switch to a printf style signature
	// so string interpolation only occurs when actually logging.
	$log = defined( 'PLAYGROUND_DEBUG' ) && PLAYGROUND_DEBUG
		? function ( $str ) { error_log( "PLAYGROUND: $str" ); }
		: function () {};

	$log( "Handling request for '{$_SERVER['REQUEST_URI']}'" );

	$url = parse_url( $_SERVER['REQUEST_URI'] );
	if ( false === $url ) {
		$log( "Unable to parse URL: '$url'" );
		return;
	}

	$original_requested_path = $url['path'];
	$log( "Requested path: '$original_requested_path'" );

	// Do not let this host reach the normal app handler, including its redirects
	// and PHP endpoints. The real scripts/downloads stay at shared app-host URLs;
	// only the small built sandbox directory belongs on the WordPress origin.
	$request_host = parse_url( 'https://' . ( $_SERVER['HTTP_HOST'] ?? '' ), PHP_URL_HOST );
	if ( null !== $wordpress_origin && is_string( $request_host ) &&
		0 === strcasecmp( $request_host, parse_url( $wordpress_origin, PHP_URL_HOST ) )
	) {
		// This directory contains only built helper/loader files. Never fall back
		// to app files, redirects, directory indexes, or native PHP on this host.
		// Scoped WordPress pages come from the browser service worker, not this directory.
		$sandbox = realpath( $directory . '/wordpress-sandbox' );
		$file = $sandbox ? realpath( $sandbox . $original_requested_path ) : false;
		if ( ! $file || ! is_file( $file ) || ! str_starts_with( $file, $sandbox . '/' ) ) {
			http_response_code( 404 );
			exit;
		}
		require_once __DIR__ . '/mime-types.php';
		$extension = strtolower( pathinfo( $file, PATHINFO_EXTENSION ) );
		header( 'Content-Type: ' . ( $mime_types[ $extension ] ?? $mime_types['_default'] ) );
		header( 'Cache-Control: private, no-store' );
		header( 'X-Content-Type-Options: nosniff' );
		header_remove( 'X-Frame-Options' );
		playground_serve_static_file( $file );
		exit;
	}

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
		// Disable edge caching because this resource may be redirected by PHP.
		// Note: Using the header `Vary: Referer` does not seem to affect cacheability.
		$may_edge_cache = false;

		if ( isset( $redirect['internal' ] ) && $redirect['internal'] ) {
			$requested_path = $redirect['location'];
		} else {
			$should_redirect = true;
			if ( isset( $redirect['condition']['referers'] ) ) {
				$should_redirect = false;
				if ( isset( $_SERVER['HTTP_REFERER'] ) ) {
					foreach ( $redirect['condition']['referers'] as $referer ) {
						if ( str_starts_with( $_SERVER['HTTP_REFERER'], $referer ) ) {
							$should_redirect = true;
							break;
						}
					}
				}
			}

			if ( $should_redirect ) {
				$log( "Redirecting to '{$redirect['location']}' with status '{$redirect['status']}'" );
				header( "Location: {$redirect['location']}" );
				http_response_code( $redirect['status'] );
				die();
			}
		}
	}

	//
	// PATH RESOLUTION
	//
	$served_path = $requested_path;
	$resolved_path = realpath( $directory . $served_path );
	if ( is_dir( $resolved_path ) ) {
		if ( null !== $build_directory &&
			str_starts_with( $resolved_path, $directory . '/' ) &&
			! str_ends_with( $served_path, '/' )
		) {
			// Nginx normally adds the trailing slash for public directories. It
			// cannot see private build directories, so preserve that redirect here.
			$location = './' . rawurlencode( basename( $served_path ) ) . '/';
			if ( isset( $url['query'] ) ) {
				$location .= '?' . $url['query'];
			}
			header( 'Location: ' . $location, true, 301 );
			die();
		}
		$resolved_path = playground_resolve_to_index_file( $resolved_path );
	}

	if ( false === $resolved_path && ! str_ends_with( $served_path, '.php' ) ) {
		// Static files that need special treatment are served from a different directory.
		$resolved_path = realpath( $directory . '/static-files-to-serve-via-php' . $served_path );
		if ( is_dir( $resolved_path ) ) {
			$resolved_path = playground_resolve_to_index_file( $resolved_path );
		}
	}

	if ( false === $resolved_path && playground_is_my_wordpress_net_request() ) {
		$served_path = '/index.html';
		$resolved_path = playground_resolve_my_wordpress_net_index_fallback();
	}

	$log( "Resolved '$original_requested_path' to '$resolved_path'." );

	if ( false === $resolved_path ) {
		$log( "File not found: '$resolved_path'" );
		http_response_code( 404 );
		die();
	}

	if ( ! str_starts_with( $resolved_path, $directory . '/' ) ) {
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

	// The private main build shares platform code with the WordPress origin. Add
	// CORS independently so existing cache/agent-cluster exceptions still run.
	// Personal WP keeps its existing public-file headers.
	$is_shared_asset = null !== $build_directory && 'php' !== $extension && (
		str_starts_with( $served_path, '/assets/' ) ||
		str_ends_with( $served_path, '.js' ) || preg_match( '~^/wp-[^/]+/~', $served_path )
	);
	if ( $is_shared_asset ) {
		header( 'Access-Control-Allow-Origin: *' );
		header( 'Access-Control-Allow-Headers: *' );
		header( 'Access-Control-Allow-Methods: GET, HEAD' );
		header( 'Cross-Origin-Resource-Policy: cross-origin' );
		if ( 'OPTIONS' === $_SERVER['REQUEST_METHOD'] ) {
			http_response_code( 204 );
			die();
		}
	}

	$custom_response_headers = playground_get_custom_response_headers( $served_path );
	if ( ! empty( $custom_response_headers ) ) {
		foreach ( $custom_response_headers as $custom_header ) {
			header( $custom_header );
		}
	} else {
		if ( $may_edge_cache ) {
			$log( "Marking for cache: '$resolved_path'" );
			header( 'A8C-Edge-Cache: cache' );
			if ( $is_shared_asset && 'html' !== $extension ) {
				header( 'Cache-Control: public, max-age=3600' );
			}
		} else {
			$log( "Skipping edge cache: '$resolved_path'" );
			header( 'Cache-Control: no-cache' );
		}
	}

	if ( 'HEAD' === $_SERVER['REQUEST_METHOD'] ) {
		if ( 'php' !== $extension ) {
			playground_serve_static_file( $resolved_path );
		}
		die();
	}

	//
	// CONTENT
	//

	if ( 'php' === $extension ) {
		$log( "Running PHP: '$original_requested_path'" );
		playground_maybe_set_environment( $served_path );
		if ( null !== $build_directory ) {
			// Nginx cannot execute a private endpoint directly. Run the resolved
			// file only after the same headers and persistent-data setup as before.
			require $resolved_path;
			die();
		}
		// Let the web server continue executing PHP in a complete environment
	} else {
		$log( "Reading static file: '$resolved_path'" );
		playground_serve_static_file( $resolved_path );
		die();
	}
}

/**
 * Send a validated static file, including a single byte range for download retries.
 *
 * For example, GET with Range: bytes=1024- returns only the bytes still missing
 * from a PHP runtime download, with status 206 and Content-Range. Bounded ranges
 * work too; an end beyond the file is clamped to its last byte. A supported
 * range with no valid bytes returns 416 and the current file size.
 *
 * Multiple ranges, suffix ranges, unknown units, and unrecognized syntax are
 * ignored: send the normal full response, not a multipart body or a false 416.
 * Requests with If-Range also get a full response; this handler does not compare
 * validators. Only GET uses ranges. HEAD sends the full length without a body.
 *
 * The caller must already have resolved and checked the path and set MIME/cache
 * headers. Full responses still use readfile(); partial responses seek directly
 * to the requested offset and stream only the requested bytes.
 *
 * @param string $path Existing static file selected by playground_handle_request().
 */
function playground_serve_static_file( $path ) {
	$size = filesize( $path );
	$start = 0;
	$end = $size - 1;
	$range = null;
	header( 'Accept-Ranges: bytes' );
	if (
		'GET' === $_SERVER['REQUEST_METHOD'] &&
		! isset( $_SERVER['HTTP_IF_RANGE'] ) &&
		isset( $_SERVER['HTTP_RANGE'] ) &&
		preg_match( '/\Abytes=(\d+)-(\d*)\z/i', trim( $_SERVER['HTTP_RANGE'] ), $range )
	) {
		$start = (int) $range[1];
		$end = '' === $range[2] ? $end : min( $end, (int) $range[2] );
		if ( $start > $end ) {
			header( "Content-Range: bytes */$size", true, 416 );
			header( 'Content-Length: 0' );
			return;
		}
		http_response_code( 206 );
		header( "Content-Range: bytes $start-$end/$size" );
	}
	$length = $end - $start + 1;
	header( "Content-Length: $length" );
	if ( 'HEAD' === $_SERVER['REQUEST_METHOD'] ) {
		return;
	}
	if ( ! $range ) {
		readfile( $path );
		return;
	}
	$stream = fopen( $path, 'rb' );
	fseek( $stream, $start );
	stream_copy_to_stream( $stream, fopen( 'php://output', 'wb' ), $length );
	fclose( $stream );
}

function playground_maybe_rewrite( $original_requested_path ) {
	$requested_path = $original_requested_path;

	if ( str_ends_with( $requested_path, 'plugin-proxy' ) ) {
		$requested_path = '/plugin-proxy.php';
	}

	if (
		playground_is_my_wordpress_net_request() &&
		(
			'/relay' === $requested_path ||
			str_starts_with( $requested_path, '/relay/' )
		)
	) {
		$requested_path = '/relay.php';
	}

	if ( $requested_path !== $original_requested_path ) {
		return $requested_path;
	}

	return false;
}

function playground_is_my_wordpress_net_request() {
	if ( empty( $_SERVER['HTTP_HOST'] ) ) {
		return false;
	}

	if ( ! preg_match( '/^my\.wordpress\.net(:\d+)?$/i', $_SERVER['HTTP_HOST'] ) ) {
		return false;
	}

	return true;
}

function playground_resolve_my_wordpress_net_index_fallback() {
	$resolved_path = realpath( __DIR__ . '/index.html' );
	if ( false === $resolved_path ) {
		// Deployment may move index.html aside so PHP can apply custom cache headers.
		$resolved_path = realpath( __DIR__ . '/static-files-to-serve-via-php/index.html' );
	}

	return $resolved_path;
}

function playground_maybe_redirect( $requested_path ) {
	if ( str_ends_with( $requested_path, '/docs' ) ) {
		return array(
			'location' => 'https://wordpress.github.io/wordpress-playground/',
			'status' => 301
		);
	}

	if (
		// Since `/builder/` is an actual directory,
		// nginx redirects requests for `/builder` to `/builder/`.
		str_ends_with( $requested_path, '/builder/' ) ||
		str_ends_with( $requested_path, '/builder/index.php' )
	) {
		return array(
			'location' => 'builder.html',
			'status' => 301
		);
	}

	if ( str_ends_with( $requested_path, '/wordpress' ) ) {
		return array(
			'location' => 'wordpress.html',
			'status' => 301
		);
	}

	if ( str_ends_with( $requested_path, '/gutenberg' ) ) {
		return array(
			'location' => 'gutenberg.html',
			'status' => 301
		);
	}

	if ( str_ends_with( $requested_path, '/proxy' ) ) {
		return array(
			'location' => 'https://github-proxy.com/',
			'status' => 301
		);
	}

	if ( $requested_path === '/release' ) {
		// Make this redirect relative to `release` in case we implement
		// subdir staging for the Playground website.
		$redirect_base_path = substr($requested_path, 0, - strlen('release'));
		$redirect_location = 
			$redirect_base_path .
			'?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/beta-rc/blueprint.json';

		return array(
			'location' => $redirect_location,
			'status' => 301
		);
	}

	if ( str_ends_with( $requested_path, '/wordpress-browser.html' ) ) {
		return array(
			'location' => '/',
			'status' => 301
		);
	}

	if ( str_ends_with( $requested_path, '/wordpress.html' ) ) {
		return array(
			'condition' => array(
				'referers' => array(
					'https://developer.wordpress.org/',
					'https://wordpress.org/',
				),
			),
			'location' => '/index.html',
			'status' => 302,
		);
	}

	return false;
}

function playground_maybe_set_environment( $requested_path ) {
	if ( ! str_ends_with( $requested_path, '.php' ) ) {
		return false;
	}

	if ( str_ends_with( $requested_path, 'logger.php' ) ) {
		// Define DB_PASSWORD early so Atomic_Persistent_Data can work.
		__atomic_env_define( 'DB_PASSWORD' );
		$secrets = new Atomic_Persistent_Data;
		if ( isset(
			$secrets->LOGGER_SLACK_CHANNEL,
			$secrets->LOGGER_SLACK_TOKEN,
		) ) {
			putenv( "SLACK_CHANNEL={$secrets->LOGGER_SLACK_CHANNEL}" );
			putenv( "SLACK_TOKEN={$secrets->LOGGER_SLACK_TOKEN}" );
		} else {
			error_log( 'PLAYGROUND: Missing secrets for logger.php' );
		}

		return true;
	}

	if ( str_ends_with( $requested_path, 'plugin-proxy.php' ) ) {
		// Define DB_PASSWORD early so Atomic_Persistent_Data can work.
		__atomic_env_define( 'DB_PASSWORD' );
		$secrets = new Atomic_Persistent_Data;
		if ( isset( $secrets->GITHUB_TOKEN ) ) {
			putenv( "GITHUB_TOKEN={$secrets->GITHUB_TOKEN}" );
		} else {
			error_log( 'PLAYGROUND: Missing secrets for plugin-proxy.php' );
		}

		return true;
	}

	if ( str_ends_with( $requested_path, 'oauth.php' ) ) {
		// Define DB_PASSWORD early so Atomic_Persistent_Data can work.
		__atomic_env_define( 'DB_PASSWORD' );
		$secrets = new Atomic_Persistent_Data;
		if ( isset(
			$secrets->GITHUB_APP_CLIENT_ID,
			$secrets->GITHUB_APP_CLIENT_SECRET,
		) ) {
			putenv( "CLIENT_ID={$secrets->GITHUB_APP_CLIENT_ID}" );
			putenv( "CLIENT_SECRET={$secrets->GITHUB_APP_CLIENT_SECRET}" );
		} else {
			error_log( 'PLAYGROUND: Missing secrets for oauth.php' );
		}
		return true;
	}

	if ( str_ends_with( $requested_path, 'mywp-event.php' ) ) {
		// Define DB_PASSWORD early so Atomic_Persistent_Data can work.
		__atomic_env_define( 'DB_PASSWORD' );
		return true;
	}

	if ( str_ends_with( $requested_path, 'mywp-event-dashboard.php' ) ) {
		// Define DB_PASSWORD early so Atomic_Persistent_Data can work.
		__atomic_env_define( 'DB_PASSWORD' );
		$secrets = new Atomic_Persistent_Data;
		$github_client_id =
			$secrets->MYWP_EVENT_DASHBOARD_GITHUB_CLIENT_ID ??
			$secrets->GITHUB_APP_CLIENT_ID ??
			null;
		$github_client_secret =
			$secrets->MYWP_EVENT_DASHBOARD_GITHUB_CLIENT_SECRET ??
			$secrets->GITHUB_APP_CLIENT_SECRET ??
			null;
		if (
			isset(
				$github_client_id,
				$github_client_secret,
				$secrets->MYWP_EVENT_DASHBOARD_GITHUB_USERS,
			)
		) {
			putenv( "MYWP_EVENT_DASHBOARD_GITHUB_CLIENT_ID=$github_client_id" );
			putenv( "MYWP_EVENT_DASHBOARD_GITHUB_CLIENT_SECRET=$github_client_secret" );
			putenv( "MYWP_EVENT_DASHBOARD_GITHUB_USERS={$secrets->MYWP_EVENT_DASHBOARD_GITHUB_USERS}" );
		} else {
			error_log( 'PLAYGROUND: Missing secrets for mywp-event-dashboard.php' );
		}

		return true;
	}

	if ( basename( $requested_path ) === 'relay.php' ) {
		// Define DB_PASSWORD early so Atomic_Persistent_Data can work.
		__atomic_env_define( 'DB_PASSWORD' );
		return true;
	}

	return false;
}

function playground_get_custom_response_headers( $requested_path ) {
	$filename = basename( $requested_path );

	if ( 'iframe-worker.html' === $filename ) {
		return array( 'Origin-Agent-Cluster: ?1' );
	} elseif ( in_array( $filename, array( 'mywp-event.php', 'mywp-event-dashboard.php', 'relay.php' ), true ) ) {
		return array( 'Cache-Control: no-store' );
	} elseif ( str_ends_with( $filename, 'store.zip' ) ) {
		// Disable compression so zip file can be read piece by piece
		// using file offsets embedded in the zip's metadata.
		return array(
			'Content-Encoding: identity',
			'Access-Control-Allow-Origin: *',
		);
	} elseif (
		'/' === $requested_path ||
		'/index.html' === $requested_path ||
		'/api.html' === $requested_path
	) {
		return array( 'Cache-Control: max-age=0, no-cache, no-store, must-revalidate' );
	} elseif (
		in_array(
			$filename,
			array(
				'index.js',
				'php-code-snippet.js',
				'blueprint-schema.json',
				'logger.php',
				'oauth.php',
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
