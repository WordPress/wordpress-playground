<?php

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
	atob(xhr.responseText)
].join("\\r\\n");
JAVASCRIPT;


		$output = vrzno_eval( $js );

		$delim_offset = strpos($output, "\r\n\r\n");
		$headers = substr($output, 0, $delim_offset);
		$base64_str = substr($output, $delim_offset + 4);
		$body = base64_decode($base64_str);

		if(!empty($options['filename'])) {
			$this->headers = $headers;
			file_put_contents(
				$options['filename'],
				$body
			);
		} else {
			$this->headers = $headers . "\r\n\r\n" . $body;
		}

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
	// This check relies on gethostbyname which isn't yet supported in the WASM runtime.
	add_filter('http_request_host_is_external', function($arg) {
		return true;
	});
}
