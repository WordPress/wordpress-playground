import { StepHandler } from '.';
import { logger } from '@php-wasm/logger';

/**
 * @inheritDoc login
 * @hasRunnableExample
 * @example
 *
 * <code>
 * {
 * 	    "step": "login",
 * 		"username": "admin",
 * 		"password": "password"
 * }
 * </code>
 */
export type LoginStep = {
	step: 'login';
	/**
	 * The user to log in as. Defaults to 'admin'.
	 */
	username?: string;
	/**
	 * The password to log in with. Defaults to 'password'.
	 */
	password?: string;
};

/**
 * Logs in to Playground.
 * Under the hood, this function submits the [`wp-login.php`](https://developer.wordpress.org/reference/files/wp-login.php/) [form](https://developer.wordpress.org/reference/functions/wp_login_form/)
 * just like a user would.
 */
export const login: StepHandler<LoginStep> = async (
	playground,
	{ username = 'admin', password = 'password' } = {},
	progress
) => {
	progress?.tracker.setCaption(progress?.initialCaption || 'Logging in');

	// Login as the current user without a password
	await playground.writeFile(
		'/wordpress/playground-login.php',
		`<?php
		require_once( dirname( __FILE__ ) . '/wp-load.php' );
		if ( is_user_logged_in() ) {
			return;
		}

		$credentials = array(
			'user_login'    => '${username}',
			'user_password' => '${password}',
			'remember'      => true
		);

		$user = wp_signon( $credentials, false );

		if ( is_wp_error( $user ) ) {
			throw new WP_Error( 401, $user->get_error_message() );
		}`
	);
	const response = await playground.request({
		url: '/playground-login.php',
	});
	await playground.unlink('/wordpress/playground-login.php');

	if (response.httpStatusCode !== 200) {
		logger.warn('WordPress response was', {
			response,
			text: response.text,
		});
		throw new Error(
			`Failed to log in as ${username} with password ${password}`
		);
	}
};
