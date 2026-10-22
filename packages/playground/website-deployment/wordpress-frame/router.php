<?php
/**
 * Serve the app and WordPress hostnames from one WP Cloud site's release directory.
 *
 * Call from custom-redirects.php before normal WordPress handling. The app host
 * serves the SPA, remote.html, shared bundles, and the existing allowed PHP
 * endpoints. The WordPress host serves only wordpress-bridge.html, /sw.js, and
 * marked thumbnail-worker loaders. Its /scope:site-a/ pages are generated in the
 * browser by the WordPress service worker, not by this PHP server. All other
 * WordPress-host paths, including /api.html, return 404.
 *
 * Reject app-host /scope:... paths as well: serving a site's HTML there would
 * let its scripts run with the app's document and OPFS access. Reject unknown
 * hosts and paths outside the release directory rather than serving a fallback.
 *
 * On the first visit, rewrite the helper HTML's built script/preload URLs to the
 * app host so its bridge code identifies the correct parent origin. Later the
 * browser service worker generates that helper itself. Keep the real scripts
 * and downloads at shared app-host URLs; CORS/CORP headers allow WordPress to
 * load them without deploying another bundle copy on the WordPress host.
 *
 * Keep the release behind a server-level deny rule. If Nginx serves its files
 * directly, a request can bypass every host/path check and header here. The
 * configured origins must come from server configuration, not request parameters.
 * This handler does not boot WordPress or authorize requests between running
 * Playgrounds. It also leaves existing app/API iframe embeds working, including
 * embeds without a referrer; WordPress can still embed a fresh app/API document.
 *
 * @param string $directory Absolute path to the deployed build, outside public file serving.
 * @param string $app_origin Configured app origin, also used for shared asset URLs.
 * @param string $wordpress_origin Configured origin for rendered WordPress and its worker.
 */
function playground_serve_wordpress_frame( $directory, $app_origin, $wordpress_origin ) {
	$directory = realpath( $directory );
	if ( false === $directory ) {
		// Never let a missing release turn asset paths into absolute filesystem reads.
		http_response_code( 503 );
		exit;
	}
	$host = strtolower( $_SERVER['HTTP_HOST'] ?? '' );
	$path = rawurldecode( parse_url( $_SERVER['REQUEST_URI'], PHP_URL_PATH ) ?: '/' );
	header( 'X-Content-Type-Options: nosniff' );
	header( 'Cache-Control: private, no-store' );
	header_remove( 'X-Frame-Options' );

	if ( $host === parse_url( $wordpress_origin, PHP_URL_HOST ) ) {
		// The helper is untrusted. It may sit below an external embedder, but
		// its root parent accepts only scoped HTTP requests from this exact frame.
		if ( '/wordpress-bridge.html' === $path ) {
			header( 'Content-Type: text/html; charset=utf-8' );
			echo preg_replace(
				'~((?:src|href)=["\'])/(?!/)~',
				'$1' . $app_origin . '/',
				file_get_contents( $directory . '/wordpress-bridge.html' )
			);
			exit;
		}
		if ( '/sw.js' === $path ) {
			header( 'Content-Type: text/javascript; charset=utf-8' );
			echo 'import ' . json_encode( $app_origin . '/sw.js' ) . ';';
			exit;
		}
		if (
			str_starts_with( $path, '/assets/' ) &&
			'1' === ( $_GET['playground-site-thumbnail-worker'] ?? '' )
		) {
			header( 'Content-Type: text/javascript; charset=utf-8' );
			echo 'importScripts(' . json_encode( $app_origin . $_SERVER['REQUEST_URI'] ) . ');';
			exit;
		}
		// Only the WordPress service worker may produce scoped site responses.
		http_response_code( 404 );
		exit;
	}

	if ( $host !== parse_url( $app_origin, PHP_URL_HOST ) ) {
		http_response_code( 404 );
		exit;
	}

	if ( str_starts_with( $path, '/scope:' ) || str_starts_with( $path, '/proxy/' ) ) {
		http_response_code( 404 );
		exit;
	}

	// Retain the normal deployment's MIME/cache/agent-cluster exceptions.
	require_once __DIR__ . '/custom-redirects-lib.php';
	$custom_headers = playground_get_custom_response_headers( $path ) ?: array();
	$is_asset = str_starts_with( $path, '/assets/' ) ||
		str_ends_with( $path, '.js' ) || preg_match( '~^/wp-[^/]+/~', $path );
	if ( $is_asset ) {
		header( 'Access-Control-Allow-Origin: *' );
		header( 'Access-Control-Allow-Headers: *' );
		header( 'Access-Control-Allow-Methods: GET, HEAD' );
		header( 'Cross-Origin-Resource-Policy: cross-origin' );
		if ( 'OPTIONS' === $_SERVER['REQUEST_METHOD'] ) {
			http_response_code( 204 );
			exit;
		}
		if ( ! str_ends_with( $path, '.html' ) && empty( $custom_headers ) ) {
			header( 'Cache-Control: public, max-age=3600' );
			header( 'A8C-Edge-Cache: cache' );
		}
	}

	foreach ( $custom_headers as $header ) {
		header( $header );
	}

	// Reuse the deployed website's redirects and native PHP endpoint setup.
	if ( '/builder' === $path ) {
		header( 'Location: /builder/builder.html', true, 302 );
		exit;
	}
	$path = playground_maybe_rewrite( $path ) ?: $path;
	$redirect = playground_maybe_redirect( $path );
	if ( $redirect && empty( $redirect['condition'] ) ) {
		header( 'Location: ' . $redirect['location'], true, $redirect['status'] );
		exit;
	}
	$resolved = realpath( $directory . $path );
	if ( $resolved && is_dir( $resolved ) ) {
		$resolved = realpath( $resolved . '/index.html' );
	}
	if ( ! $resolved || ! str_starts_with( $resolved, $directory . '/' ) || ! is_file( $resolved ) ) {
		http_response_code( 404 );
		exit;
	}
	if ( str_ends_with( $resolved, '.php' ) ) {
		if ( ! in_array( $path, array( '/oauth.php', '/logger.php', '/plugin-proxy.php', '/dynamic-manifest.json.php' ), true ) ) {
			http_response_code( 404 );
			exit;
		}
		playground_maybe_set_environment( $path );
		require $resolved;
		exit;
	}

	$mime_types = json_decode( file_get_contents( __DIR__ . '/mime-types.json' ), true );
	$extension = strtolower( pathinfo( $resolved, PATHINFO_EXTENSION ) );
	header( 'Content-Type: ' . ( $mime_types[$extension] ?? $mime_types['_default'] ) );
	playground_wordpress_frame_file( $resolved );
	exit;
}

/**
 * Stream a validated public build file, including resumable PHP runtime downloads.
 *
 * For example, Range: bytes=1024- returns the rest of a partially downloaded WASM
 * file with status 206 and Content-Range. Read only that range from disk rather
 * than loading the whole runtime into PHP memory. Clamp a requested end to the
 * file's last byte. Malformed, suffix, multiple, or ranges with no valid bytes
 * return 416 with the file size.
 * HEAD returns the same status and length headers without sending file bytes.
 *
 * The caller must already have resolved and checked this path inside the release
 * directory. This function does not validate paths or decide who may read a file.
 *
 * @param string $path Existing public file selected by playground_serve_wordpress_frame().
 */
function playground_wordpress_frame_file( $path ) {
	$size = filesize( $path );
	$start = 0;
	$end = $size - 1;
	header( 'Accept-Ranges: bytes' );
	if ( isset( $_SERVER['HTTP_RANGE'] ) ) {
		if ( ! preg_match( '/\Abytes=(\d+)-(\d*)\z/', $_SERVER['HTTP_RANGE'], $range ) ) {
			header( "Content-Range: bytes */$size", true, 416 );
			return;
		}
		$start = (int) $range[1];
		$end = '' === $range[2] ? $end : min( $end, (int) $range[2] );
		if ( $start > $end ) {
			header( "Content-Range: bytes */$size", true, 416 );
			return;
		}
		http_response_code( 206 );
		header( "Content-Range: bytes $start-$end/$size" );
	}
	$length = $end - $start + 1;
	header( "Content-Length: $length" );
	if ( 'HEAD' !== $_SERVER['REQUEST_METHOD'] ) {
		$stream = fopen( $path, 'rb' );
		fseek( $stream, $start );
		stream_copy_to_stream( $stream, fopen( 'php://output', 'wb' ), $length );
		fclose( $stream );
	}
}
