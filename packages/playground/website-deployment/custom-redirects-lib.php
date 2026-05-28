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

function playground_handle_request() {
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

	if ( playground_is_pr_preview_request( $original_requested_path ) ) {
		playground_handle_pr_preview_request( $original_requested_path );
		die();
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
	$resolved_path = realpath( __DIR__ . $served_path );
	if ( is_dir( $resolved_path ) ) {
		$resolved_path = playground_resolve_to_index_file( $resolved_path );
	}

	if ( false === $resolved_path && ! str_ends_with( $served_path, '.php' ) ) {
		// Static files that need special treatment are served from a different directory.
		$resolved_path = realpath( __DIR__ . '/static-files-to-serve-via-php' . $served_path );
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

	$custom_response_headers = playground_get_custom_response_headers( $served_path );
	if ( ! empty( $custom_response_headers ) ) {
		foreach ( $custom_response_headers as $custom_header ) {
			header( $custom_header );
		}
	} else {
		if ( $may_edge_cache ) {
			$log( "Marking for cache: '$resolved_path'" );
			header( 'A8C-Edge-Cache: cache' );
		} else {
			$log( "Skipping edge cache: '$resolved_path'" );
			header( 'Cache-Control: no-cache' );
		}
	}

	if ( 'HEAD' === $_SERVER['REQUEST_METHOD'] ) {
		die();
	}

	//
	// CONTENT
	//

	if ( 'php' === $extension ) {
		$log( "Running PHP: '$original_requested_path'" );
		playground_maybe_set_environment( $served_path );
		// Let the web server continue executing PHP in a complete environment
	} else {
		$log( "Reading static file: '$resolved_path'" );
		readfile( $resolved_path );
		die();
	}
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
		playground_maybe_set_github_token_environment( 'plugin-proxy.php' );

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

	return false;
}

function playground_maybe_set_github_token_environment( $context ) {
	if ( getenv( 'GITHUB_TOKEN' ) ) {
		return true;
	}

	if ( ! function_exists( '__atomic_env_define' ) || ! class_exists( 'Atomic_Persistent_Data' ) ) {
		error_log( "PLAYGROUND: Missing GitHub token environment helpers for $context" );
		return false;
	}

	// Define DB_PASSWORD early so Atomic_Persistent_Data can work.
	__atomic_env_define( 'DB_PASSWORD' );
	$secrets = new Atomic_Persistent_Data;
	if ( isset( $secrets->GITHUB_TOKEN ) ) {
		putenv( "GITHUB_TOKEN={$secrets->GITHUB_TOKEN}" );
		return true;
	}

	error_log( "PLAYGROUND: Missing secrets for $context" );
	return false;
}

function playground_is_pr_preview_request( $requested_path ) {
	return preg_match( '#^/pr-previews/\d+/(current\.json|[a-f0-9]{7,40}(/.*)?)$#i', $requested_path );
}

function playground_handle_pr_preview_request( $requested_path ) {
	playground_maybe_set_github_token_environment( 'Playground PR preview' );

	$match = array();
	if ( preg_match( '#^/pr-previews/(?<pr>\d+)/current\.json$#', $requested_path, $match ) ) {
		playground_send_pr_preview_current_json( $match['pr'] );
		return;
	}

	if (
		! preg_match(
			'#^/pr-previews/(?<pr>\d+)/(?<sha>[a-f0-9]{7,40})(?<path>/.*)?$#i',
			$requested_path,
			$match
		)
	) {
		http_response_code( 404 );
		return;
	}

	$path = isset( $match['path'] ) && '' !== $match['path'] ? $match['path'] : '/';
	playground_send_pr_preview_file( $match['pr'], strtolower( $match['sha'] ), $path );
}

function playground_send_pr_preview_current_json( $pr_number ) {
	$head_sha = playground_get_pr_preview_head_sha( $pr_number );
	$artifact = playground_get_pr_preview_artifact( $pr_number, $head_sha );

	header( 'Content-Type: application/json' );
	header( 'Cache-Control: max-age=0, no-cache, no-store, must-revalidate' );
	echo json_encode(
		array(
			'pr' => $pr_number,
			'sha' => $head_sha,
			'artifactName' => $artifact->name,
			'basePath' => "/pr-previews/$pr_number/$head_sha/",
		)
	);
}

function playground_send_pr_preview_file( $pr_number, $sha, $requested_file ) {
	$artifact = playground_get_pr_preview_artifact( $pr_number, $sha );
	$artifact_root = playground_get_pr_preview_artifact_root( $artifact );

	$relative_file = ltrim( $requested_file, '/' );
	if ( '' === $relative_file ) {
		$relative_file = 'index.html';
	}
	if ( str_contains( $relative_file, '..' ) || str_starts_with( $relative_file, '/' ) ) {
		http_response_code( 400 );
		echo 'Invalid PR preview path';
		return;
	}

	$resolved_path = realpath( $artifact_root . '/' . $relative_file );
	if ( is_dir( $resolved_path ) ) {
		$resolved_path = playground_resolve_to_index_file( $resolved_path );
	}

	if ( false === $resolved_path || ! str_starts_with( $resolved_path, $artifact_root . '/' ) ) {
		http_response_code( 404 );
		echo 'PR preview file not found';
		return;
	}

	playground_send_pr_preview_static_file( $resolved_path, $requested_file );
}


function playground_pr_preview_json_error( $status, $error, $extra = array() ) {
	http_response_code( $status );
	header( 'Content-Type: application/json' );
	die( json_encode( array_merge( array( 'error' => $error ), $extra ) ) );
}

function playground_get_pr_preview_head_sha( $pr_number ) {
	$response = playground_github_api_request(
		"https://api.github.com/repos/WordPress/wordpress-playground/pulls/$pr_number"
	);
	if ( empty( $response->head->sha ) || ! preg_match( '/^[a-f0-9]{40}$/i', $response->head->sha ) ) {
		playground_pr_preview_json_error( 404, 'invalid_pr_number' );
	}
	return strtolower( $response->head->sha );
}

function playground_get_pr_preview_artifact( $pr_number, $sha ) {
	$artifact_name = "playground-pr-preview-$pr_number-$sha";
	$response = playground_github_api_request(
		'https://api.github.com/repos/WordPress/wordpress-playground/actions/artifacts?name=' .
			rawurlencode( $artifact_name )
	);

	if ( empty( $response->artifacts ) ) {
		playground_pr_preview_json_error(
			404,
			'artifact_not_found',
			array( 'artifactName' => $artifact_name )
		);
	}

	foreach ( $response->artifacts as $artifact ) {
		if ( $artifact_name === $artifact->name && empty( $artifact->expired ) ) {
			return $artifact;
		}
	}

	playground_pr_preview_json_error( 404, 'artifact_expired' );
}

function playground_get_pr_preview_artifact_root( $artifact ) {
	$cache_dir = playground_get_pr_preview_cache_dir();
	$extract_dir = "$cache_dir/extracted/{$artifact->id}";
	$marker_file = "$extract_dir/.playground-artifact-ready";

	if ( file_exists( $marker_file ) ) {
		return playground_find_pr_preview_artifact_root( $extract_dir );
	}

	if ( ! class_exists( 'ZipArchive' ) ) {
		playground_pr_preview_json_error( 500, 'zip_extension_missing' );
	}

	$zip_file = "$cache_dir/downloads/{$artifact->id}.zip";
	if ( ! file_exists( $zip_file ) ) {
		playground_download_pr_preview_artifact( $artifact, $zip_file );
	}

	$tmp_extract_dir = "$extract_dir.tmp." . getmypid();
	playground_delete_directory( $tmp_extract_dir );
	mkdir( $tmp_extract_dir, 0777, true );
	playground_extract_zip_safely( $zip_file, $tmp_extract_dir );
	rename( $tmp_extract_dir, $extract_dir );
	touch( $marker_file );

	return playground_find_pr_preview_artifact_root( $extract_dir );
}

function playground_get_pr_preview_cache_dir() {
	$cache_dir = sys_get_temp_dir() . '/playground-pr-previews';
	if ( ! is_dir( "$cache_dir/downloads" ) ) {
		mkdir( "$cache_dir/downloads", 0777, true );
	}
	if ( ! is_dir( "$cache_dir/extracted" ) ) {
		mkdir( "$cache_dir/extracted", 0777, true );
	}
	return $cache_dir;
}

function playground_download_pr_preview_artifact( $artifact, $zip_file ) {
	$response = playground_github_api_request( $artifact->archive_download_url, false, false );
	$download_url = playground_find_header( $response['headers'], 'location' );
	if ( ! $download_url ) {
		playground_pr_preview_json_error( 502, 'artifact_redirect_not_present' );
	}

	$tmp_file = "$zip_file.tmp." . getmypid();
	$fp = fopen( $tmp_file, 'w' );
	$ch = curl_init( $download_url );
	curl_setopt_array(
		$ch,
		array(
			CURLOPT_FILE => $fp,
			CURLOPT_FOLLOWLOCATION => true,
			CURLOPT_FAILONERROR => true,
			CURLOPT_CONNECTTIMEOUT => 30,
		)
	);
	$ok = curl_exec( $ch );
	$http_code = curl_getinfo( $ch, CURLINFO_HTTP_CODE );
	curl_close( $ch );
	fclose( $fp );

	if ( ! $ok || $http_code < 200 || $http_code >= 300 ) {
		@unlink( $tmp_file );
		playground_pr_preview_json_error( 502, 'artifact_download_failed' );
	}

	rename( $tmp_file, $zip_file );
}

function playground_extract_zip_safely( $zip_file, $target_dir ) {
	$zip = new ZipArchive();
	if ( true !== $zip->open( $zip_file ) ) {
		playground_pr_preview_json_error( 502, 'artifact_zip_invalid' );
	}

	for ( $i = 0; $i < $zip->numFiles; $i++ ) {
		$name = $zip->getNameIndex( $i );
		if ( str_ends_with( $name, '/' ) ) {
			continue;
		}
		if ( str_starts_with( $name, '/' ) || str_contains( $name, '..' ) ) {
			continue;
		}

		$target_file = "$target_dir/$name";
		$target_parent = dirname( $target_file );
		if ( ! is_dir( $target_parent ) ) {
			mkdir( $target_parent, 0777, true );
		}

		copy( "zip://$zip_file#$name", $target_file );
	}

	$zip->close();
}

function playground_find_pr_preview_artifact_root( $extract_dir ) {
	$candidates = array(
		$extract_dir,
		"$extract_dir/wasm-wordpress-net",
		"$extract_dir/dist/packages/playground/wasm-wordpress-net",
	);
	foreach ( $candidates as $candidate ) {
		if ( file_exists( "$candidate/sw.js" ) && file_exists( "$candidate/remote.html" ) ) {
			return realpath( $candidate );
		}
	}

	$iterator = new RecursiveIteratorIterator(
		new RecursiveDirectoryIterator( $extract_dir, FilesystemIterator::SKIP_DOTS )
	);
	foreach ( $iterator as $file ) {
		if ( 'sw.js' !== $file->getFilename() ) {
			continue;
		}
		$candidate = dirname( $file->getPathname() );
		if ( file_exists( "$candidate/remote.html" ) ) {
			return realpath( $candidate );
		}
	}

	playground_pr_preview_json_error( 502, 'artifact_missing_website_build' );
}

function playground_send_pr_preview_static_file( $resolved_path, $requested_file ) {
	$filename = basename( $resolved_path );
	$extension = strtolower( pathinfo( $filename, PATHINFO_EXTENSION ) );

	if ( file_exists( __DIR__ . '/mime-types.php' ) ) {
		require __DIR__ . '/mime-types.php';
		if ( isset( $mime_types[ $extension ] ) ) {
			header( "Content-Type: {$mime_types[$extension]}" );
		}
	} else {
		$fallback_mime_types = array(
			'css' => 'text/css',
			'html' => 'text/html',
			'js' => 'application/javascript',
			'json' => 'application/json',
			'wasm' => 'application/wasm',
		);
		if ( isset( $fallback_mime_types[ $extension ] ) ) {
			header( "Content-Type: {$fallback_mime_types[$extension]}" );
		}
	}

	$custom_response_headers = playground_get_custom_response_headers(
		'/pr-previews/1/abcdef1/' . ltrim( $requested_file, '/' )
	);
	if ( ! empty( $custom_response_headers ) ) {
		foreach ( $custom_response_headers as $custom_header ) {
			header( $custom_header );
		}
	}
	if ( 'sw.js' !== $filename && 'current.json' !== $filename ) {
		header( 'Cache-Control: public, max-age=31536000, immutable' );
	}

	if ( 'HEAD' !== $_SERVER['REQUEST_METHOD'] ) {
		readfile( $resolved_path );
	}
}

function playground_github_api_request( $url, $decode = true, $follow_location = true ) {
	$token = getenv( 'GITHUB_TOKEN' );
	if ( ! $token ) {
		playground_pr_preview_json_error( 500, 'github_token_missing' );
	}

	$ch = curl_init( $url );
	curl_setopt_array(
		$ch,
		array(
			CURLOPT_RETURNTRANSFER => true,
			CURLOPT_FOLLOWLOCATION => $follow_location,
			CURLOPT_HTTPHEADER => array(
				'Accept: application/vnd.github+json',
				'Authorization: Bearer ' . $token,
				'User-Agent: WordPress Playground PR preview',
				'X-GitHub-Api-Version: 2022-11-28',
			),
			CURLOPT_HEADER => true,
			CURLOPT_CONNECTTIMEOUT => 30,
		)
	);
	$response = curl_exec( $ch );
	$header_size = curl_getinfo( $ch, CURLINFO_HEADER_SIZE );
	$http_code = curl_getinfo( $ch, CURLINFO_HTTP_CODE );
	curl_close( $ch );

	if ( false === $response || $http_code < 200 || $http_code >= 400 ) {
		playground_pr_preview_json_error( 502, 'github_request_failed' );
	}

	$headers = explode( "\r\n", trim( substr( $response, 0, $header_size ) ) );
	$body = substr( $response, $header_size );
	return array(
		'body' => $decode ? json_decode( $body ) : $body,
		'headers' => $headers,
	)[$decode ? 'body' : null] ?? array( 'body' => $body, 'headers' => $headers );
}

function playground_find_header( $headers, $name ) {
	$name = strtolower( $name );
	foreach ( $headers as $header ) {
		if ( ! str_contains( $header, ':' ) ) {
			continue;
		}
		$header_name = strtolower( substr( $header, 0, strpos( $header, ':' ) ) );
		if ( $name === $header_name ) {
			return trim( substr( $header, strpos( $header, ':' ) + 1 ) );
		}
	}
	return null;
}

function playground_delete_directory( $dir ) {
	if ( ! is_dir( $dir ) ) {
		return;
	}
	$files = new RecursiveIteratorIterator(
		new RecursiveDirectoryIterator( $dir, FilesystemIterator::SKIP_DOTS ),
		RecursiveIteratorIterator::CHILD_FIRST
	);
	foreach ( $files as $fileinfo ) {
		$fileinfo->isDir() ? rmdir( $fileinfo->getRealPath() ) : unlink( $fileinfo->getRealPath() );
	}
	rmdir( $dir );
}

function playground_get_custom_response_headers( $requested_path ) {
	$filename = basename( $requested_path );

	if ( preg_match( '#^/pr-previews/\d+/[a-f0-9]{7,40}/sw\.js$#i', $requested_path ) ) {
		return array(
			'Service-Worker-Allowed: /',
			'Cache-Control: max-age=0, no-cache, no-store, must-revalidate',
		);
	} elseif ( preg_match( '#^/pr-previews/\d+/current\.json$#', $requested_path ) ) {
		return array( 'Cache-Control: max-age=0, no-cache, no-store, must-revalidate' );
	} elseif ( 'iframe-worker.html' === $filename ) {
		return array( 'Origin-Agent-Cluster: ?1' );
	} elseif ( str_ends_with( $filename, 'store.zip' ) ) {
		// Disable compression so zip file can be read piece by piece
		// using file offsets embedded in the zip's metadata.
		return array(
			'Content-Encoding: identity',
			'Access-Control-Allow-Origin: *',
		);
	} elseif (
		'/' === $requested_path ||
		'/index.html' === $requested_path
	) {
		return array( 'Cache-Control: max-age=0, no-cache, no-store, must-revalidate' );
	} elseif (
		in_array(
			$filename,
			array(
				'index.js',
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
