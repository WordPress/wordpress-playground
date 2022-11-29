var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// packages/wordpress-wasm/src/requests_transport_fetch.php
var require_requests_transport_fetch = __commonJS({
  "packages/wordpress-wasm/src/requests_transport_fetch.php"(exports, module) {
    module.exports = `<?php
/**
 * This mu-plugin delegates PHP HTTP requests to JavaScript synchronous XHR.
 *
 * This file isn't actually used. It's just here for reference and development. The actual
 * PHP code used in WordPress is hardcoded copy residing in wordpress.mjs in the _patchWordPressCode
 * function.
 *
 * @TODO Make the build pipeline use this exact file.
 */

class Requests_Transport_Fetch implements Requests_Transport {
	public $headers = '';

	public function __construct() {
	}

	public function __destruct() {
	}

	/**
	 * Delegates PHP HTTP requests to JavaScript synchronous XHR.
	 *
	 * @TODO Implement handling for more $options such as cookies, filename, auth, etc.
	 *
	 * @param $url
	 * @param $headers
	 * @param $data
	 * @param $options
	 *
	 * @return false|string
	 */
	public function request( $url, $headers = array(), $data = array(), $options = array() ) {
		// Disable wp-cron requests that are extremely slow in node.js runtime environment.
		// @TODO: Make wp-cron requests faster.
		if ( str_contains( $url, '/wp-cron.php' ) ) {
			return false;
		}

		$headers = Requests::flatten( $headers );
		if ( ! empty( $data ) ) {
			$data_format = $options['data_format'];
			if ( $data_format === 'query' ) {
				$url  = self::format_get( $url, $data );
				$data = '';
			} elseif ( ! is_string( $data ) ) {
				$data = http_build_query( $data, null, '&' );
			}
		}

		$request = json_encode( json_encode( array(
			'headers' => $headers,
			'data'    => $data,
			'url'     => $url,
			'method'  => $options['type'],
		) ) );

		$js = <<<JAVASCRIPT
const request = JSON.parse({$request});
console.log("Requesting " + request.url);
const xhr = new XMLHttpRequest();
xhr.open(
	request.method,
	request.url,
	false // false makes the xhr synchronous
);
for ( var name in request.headers ) {
	xhr.setRequestHeader(name, request.headers[name]);
}
xhr.send(request.data);

[
	"HTTP/1.1 " + xhr.status + " " + xhr.statusText,
	xhr.getAllResponseHeaders(),
	"",
	xhr.responseText
].join("\\\\r\\\\n");
JAVASCRIPT;

		$this->headers = vrzno_eval( $js );

		return $this->headers;
	}

	public function request_multiple( $requests, $options ) {
		$responses = array();
		$class     = get_class( $this );
		foreach ( $requests as $id => $request ) {
			try {
				$handler          = new $class();
				$responses[ $id ] = $handler->request( $request['url'], $request['headers'], $request['data'], $request['options'] );
				$request['options']['hooks']->dispatch( 'transport.internal.parse_response', array( &$responses[ $id ], $request ) );
			} catch ( Requests_Exception $e ) {
				$responses[ $id ] = $e;
			}
			if ( ! is_string( $responses[ $id ] ) ) {
				$request['options']['hooks']->dispatch( 'multiple.request.complete', array( &$responses[ $id ], $id ) );
			}
		}

		return $responses;
	}

	protected static function format_get( $url, $data ) {
		if ( ! empty( $data ) ) {
			$query     = '';
			$url_parts = parse_url( $url );
			if ( empty( $url_parts['query'] ) ) {
				$url_parts['query'] = '';
			} else {
				$query = $url_parts['query'];
			}
			$query .= '&' . http_build_query( $data, null, '&' );
			$query = trim( $query, '&' );
			if ( empty( $url_parts['query'] ) ) {
				$url .= '?' . $query;
			} else {
				$url = str_replace( $url_parts['query'], $query, $url );
			}
		}

		return $url;
	}

	public static function test( $capabilities = array() ) {
		if ( ! function_exists( 'vrzno_eval' ) ) {
			return false;
		}

		if ( vrzno_eval( "typeof XMLHttpRequest;" ) !== 'function' ) {
			return false;
		}

		return true;
	}

}

if(defined('USE_FETCH_FOR_REQUESTS') && USE_FETCH_FOR_REQUESTS) {
	Requests::add_transport( 'Requests_Transport_Fetch' );
	add_filter('http_request_host_is_external', function($arg) {
		return true;
	});
}
`;
  }
});

// packages/wordpress-wasm/src/worker-thread.js
import { PHP, PHPServer, PHPBrowser } from "php-wasm";
import { loadPHPWithProgress, initializeWorkerThread } from "php-wasm-browser";

// packages/wordpress-wasm/src/config.js
import { phpJsHash } from "php-wasm";
import { phpJsHash as phpJsHash2 } from "php-wasm";
var serviceWorkerUrl = "http://127.0.0.1:8777/service-worker.js";
var serviceWorkerOrigin = new URL(serviceWorkerUrl).origin;
var wpJsCacheBuster = "";

// packages/wordpress-wasm/src/index.js
import {
  postMessageExpectReply,
  awaitReply,
  responseTo,
  registerServiceWorker,
  startPHPWorkerThread,
  getWorkerThreadBackend
} from "php-wasm-browser";
var isUploadedFilePath = (path) => {
  return path.startsWith("/wp-content/uploads/") || path.startsWith("/wp-content/plugins/") || path.startsWith("/wp-content/themes/") && !path.startsWith("/wp-content/themes/twentytwentytwo/");
};

// packages/wordpress-wasm/src/worker-thread.js
initializeWorkerThread(startWordPress);
var DOCROOT = "/wordpress";
async function startWordPress({ absoluteUrl }) {
  const [phpLoaderModule, wpLoaderModule] = await Promise.all([
    import(`/php.js?${phpJsHash2}`),
    import(`/wp.js?${wpJsCacheBuster}`)
  ]);
  const php = await loadPHPWithProgress(phpLoaderModule, [wpLoaderModule]);
  patchWordPressFiles(php, absoluteUrl);
  const server = new PHPServer(php, {
    documentRoot: DOCROOT,
    absoluteUrl,
    isStaticFilePath: isUploadedFilePath
  });
  return new PHPBrowser(server);
}
function patchWordPressFiles(php, absoluteUrl) {
  function patchFile(path, callback) {
    php.writeFile(
      path,
      callback(php.readFileAsText(path))
    );
  }
  patchFile(
    `${DOCROOT}/wp-config.php`,
    (contents) => contents + `
            define('USE_FETCH_FOR_REQUESTS', false);
            define('WP_HOME', '${JSON.stringify(DOCROOT)}');
            
            // The original version of this function crashes WASM WordPress, let's define an empty one instead.
            function wp_new_blog_notification(...$args){} 
        `
  );
  patchFile(
    `${DOCROOT}/wp-includes/plugin.php`,
    (contents) => contents + `
            function _wasm_wp_force_site_url() {
                return ${JSON.stringify(absoluteUrl)};
            }
            add_filter( "option_home", '_wasm_wp_force_site_url', 10000 );
            add_filter( "option_siteurl", '_wasm_wp_force_site_url', 10000 );
        `
  );
  const transports = [
    `${DOCROOT}/wp-includes/Requests/Transport/fsockopen.php`,
    `${DOCROOT}/wp-includes/Requests/Transport/cURL.php`
  ];
  for (const transport of transports) {
    patchFile(transport, (contents) => contents.replace(
      "public static function test",
      "public static function test( $capabilities = array() ) { return false; } public static function test2"
    ));
  }
  patchFile(`${DOCROOT}/wp-includes/default-filters.php`, (contents) => contents.replace(
    /add_filter[^;]+wp_maybe_grant_site_health_caps[^;]+;/i,
    ""
  ));
  php.mkdirTree(`${DOCROOT}/wp-content/mu-plugins`);
  php.writeFile(
    `${DOCROOT}/wp-content/mu-plugins/requests_transport_fetch.php`,
    require_requests_transport_fetch()
  );
}
