<?php

class Site_Privacy {
	const OAUTH_PATH = '/_oauth_access';
	
	public static function enforce() {
		$privacy = new Site_Privacy();

		if ( $privacy->is_request_a8c_proxied() ) {
			// The user is A8C-proxied. Let the request pass through.
			return;
		}  

		$privacy->assert_secrets_present_for_oauth();
		if ( $privacy->is_request_authorized_via_oauth() ) {
			// The user is authorized. Let the request pass through.
			return;
		}
		
		$should_start_oauth = ! str_starts_with(
			$_SERVER["REQUEST_URI"],
			self::OAUTH_PATH,
		);
		if ( $should_start_oauth ) {
			$privacy->start_oauth( $_SERVER['REQUEST_URI'] );
		} else {
			$privacy->complete_oauth();
		}
		die();
	}

	private $secrets = null;
	function __construct() {
		__atomic_env_define( 'DB_PASSWORD' );
		$this->secrets = new Atomic_Persistent_Data;
	}

	public function is_request_a8c_proxied() {
		return ! empty( $_SERVER["A8C_PROXIED_REQUEST"] );
	}

	public function assert_secrets_present_for_oauth() {
		$secrets_present_for_oauth = isset(
			$this->secrets->WPCOM_OAUTH_CLIENT_ID,
			$this->secrets->WPCOM_OAUTH_CLIENT_SECRET,
			$this->secrets->WPCOM_OAUTH_USER_SALT,
			$this->secrets->WPCOM_OAUTH_USER_HMAC_SECRET,
		);

		if ( ! $secrets_present_for_oauth ) {
			// Deny access because OAuth is not configured.
			http_response_code( 401 );
			echo 'Unauthorized. Please proxy.';
			die();
		}
	}

	public function is_request_authorized_via_oauth() {
		if ( ! isset( $_COOKIE['AUTH_HASH'], $_COOKIE['AUTH_HASH_HMAC'] ) ) {
			return false;
		}

		if ( $_COOKIE['AUTH_HASH_HMAC'] !== hash_hmac(
			'sha256',
			$_COOKIE['AUTH_HASH'],
			$this->secrets->WPCOM_OAUTH_USER_HMAC_SECRET,
		) ) {
			return false;
		}

		$parts = explode( ',', $_COOKIE['AUTH_HASH'] );
		$expiry = $parts[1] ?? 0;

		// Enforce expiry so that auth cookie values cannot be used indefinitely
		return $expiry > time();
	}

	public function start_oauth( $target_path ) {
		$wpcom_oauth_url = 'https://public-api.wordpress.com/oauth2/authorize?' .
			'client_id=113927' .
			'&response_type=code' .
			'&blog_id=0' .
			'&redirect_uri=' . urlencode( $this->get_oauth_redirect_uri() ) .
			'&state=' . urlencode( $target_path );

		http_response_code( 302 );
		header( "Location: $wpcom_oauth_url" );

		die();
	}

	public function complete_oauth() {
		if ( empty( $_GET['code'] ) ) {
			http_response_code( 401 );
			echo 'Access denied. Unable to complete OAuth without code.';
			die();
		}
		
		$target_path = '/';
		if ( isset( $_GET['state'] ) ) {
			$target_path = $_GET['state'];
		}

		$access_token = $this->request_access_token(
			$_GET['code'],
			$target_path
		);

		$is_automattician = $this->request_is_automattician( $access_token );
		if ( ! $is_automattician ) {
			http_response_code( 401 );
			echo 'User is unauthorized';
			die();
		}

		$user = $this->request_user_data( $access_token );
		$this->complete_auth_and_redirect(
			$user->username,
			$target_path,
		);
		die();
	}

	private function get_oauth_redirect_uri() {
		return "https://{$_SERVER['HTTP_HOST']}" . self::OAUTH_PATH;
	}

	private function request_access_token($code, $target_path) {
		$curl = curl_init( 'https://public-api.wordpress.com/oauth2/token' );
		curl_setopt( $curl, CURLOPT_POST, true );
		curl_setopt( $curl, CURLOPT_POSTFIELDS, array(
			'client_id' => $this->secrets->WPCOM_OAUTH_CLIENT_ID,
			'client_secret' => $this->secrets->WPCOM_OAUTH_CLIENT_SECRET,
			'code' => $_GET['code'],
			'grant_type' => 'authorization_code',
			'redirect_uri' => $this->get_oauth_redirect_uri(),
			'state' => $target_path,
		) );
		curl_setopt( $curl, CURLOPT_RETURNTRANSFER, 1 );
		$raw_response = curl_exec( $curl );
		$response_status = curl_getinfo( $curl, CURLINFO_HTTP_CODE );
		if ( $response_status != 200 ) {
			http_response_code( 401 );
			echo 'HTTP error during auth';
			die();
		}

		$response = json_decode( $raw_response );
		if ( isset( $response->error ) ) {
			http_response_code( 401 );
			echo "Auth error: {$response->error}";
			die();
		}

		return $response->access_token;
	}

	private function request_is_automattician( $access_token ) {
		$curl = curl_init( 'https://public-api.wordpress.com/rest/v1.1/internal/automattician' );
		curl_setopt( $curl, CURLOPT_HTTPHEADER, array( 'Authorization: Bearer ' . $access_token ) );
		curl_setopt( $curl, CURLOPT_RETURNTRANSFER, 1 );
		$raw_response = curl_exec( $curl );
		$response_status = curl_getinfo( $curl, CURLINFO_HTTP_CODE );

		// In testing, non-automatticians received a 403 response from this endpoint.
		if ( $response_status == 403 ) {
			return false;
		} elseif ( $response_status != 200 ) {
			http_response_code( 401 );
			echo 'HTTP error during user query';
			die();
		}

		$response = json_decode( $raw_response );
		return isset( $response->is_automattician ) && $response->is_automattician;
	}

	private function request_user_data( $access_token ) {
		$curl = curl_init( 'https://public-api.wordpress.com/rest/v1.1/me' );
		curl_setopt( $curl, CURLOPT_HTTPHEADER, array( 'Authorization: Bearer ' . $access_token ) );
		curl_setopt( $curl, CURLOPT_RETURNTRANSFER, 1 );
		$raw_me_response = curl_exec( $curl );
		$me_response_status = curl_getinfo( $curl, CURLINFO_HTTP_CODE );
		if ( $me_response_status != 200 ) {
			http_response_code( 401 );
			echo 'HTTP error during user lookup';
			die();
		}

		return json_decode( $raw_me_response );
	}

	private function complete_auth_and_redirect( $username, $target_path ) {
		$salt = $this->secrets->WPCOM_OAUTH_USER_SALT;
		// Note: We only use the username as some unique user-specific value.
		// We salt because there is no harm in additional discretion
		// in case the cookies leak to a Playground on the client side
		// (which they should not as long as the cookies are http-only).
		$salted_username = $username . $salt;
		if (
			! is_string( $username ) || empty( $username ) ||
			! is_string( $salt ) || empty( $salt )
		) {
			http_response_code( 401 );
			echo 'Unable to remember username';
			die();
		}

		$thirty_days_in_seconds = 30 * 24 * 60 * 60;
		$expiry = time() + $thirty_days_in_seconds;

		$username_hash = hash('sha256', $salted_username);
		// Include expiry so it can be validated and enforced.
		// Otherwise, clients could provide use with an auth
		// cookie value that is valid indefinitely.
		$username_hash_with_expiry = "$username_hash,$expiry";

		$hmac_secret = $this->secrets->WPCOM_OAUTH_USER_HMAC_SECRET;
		if ( empty( $hmac_secret ) ) {
			http_response_code( 401 );
			echo 'Unable to generate HMAC';
			die();
		}

		http_response_code( 302 );

		setcookie(
			'AUTH_HASH',
			$username_hash_with_expiry,
			$expiry,
			'/',
			$_SERVER['HTTP_HOST'],
			true, /* secure */
			true, /* http-only */
		);

		$username_hash_hmac = hash_hmac(
			'sha256',
			$username_hash_with_expiry,
			$hmac_secret
		);
		setcookie(
			'AUTH_HASH_HMAC',
			$username_hash_hmac,
			$expiry,
			'/',
			$_SERVER['HTTP_HOST'],
			true, /* secure */
			true, /* http-only */
		);

		header( "Location: {$target_path}" );
		die();
	}
}
