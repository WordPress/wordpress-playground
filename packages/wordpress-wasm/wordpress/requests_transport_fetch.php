<?php
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
].join("\\r\\n");
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
