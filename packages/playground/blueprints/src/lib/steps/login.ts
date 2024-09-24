import { StepHandler } from '.';
import { phpVar } from '@php-wasm/util';
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
	 * @deprecated The password field is deprecated and will be removed in a future version.
	 * Only the username field is required for user authentication.
	 */
	password?: string;
};

/**
 * Logs in to Playground.
 * Under the hood, this function creates a file in the WordPress directory
 * that logs in the user using the WordPress function wp_set_current_user.
 */
export const login: StepHandler<LoginStep> = async (
	playground,
	{ username = 'admin' } = {},
	progress
) => {
	progress?.tracker.setCaption(progress?.initialCaption || 'Logging in');

	// Ensure the WordPress directory exists
	if (!(await playground.isDir('/wordpress/'))) {
		await playground.mkdir('/wordpress/');
	}

	const docroot = await playground.documentRoot;

	// Login as the current user without a password
	await playground.writeFile(
		`${docroot}/playground-login.php`,
		`<?php
		require_once( dirname( __FILE__ ) . '/wp-load.php' );
		if ( is_user_logged_in() ) {
			return;
		}

        $user = get_user_by('login', ${phpVar(username)});
        if (!$user) {
            return;
        }

        wp_set_current_user( $user->ID, $user->user_login );
        wp_set_auth_cookie( $user->ID );
        do_action( 'wp_login', $user->user_login, $user );
		`
	);
	const response = await playground.request({
		url: '/playground-login.php',
	});
	await playground.unlink(`${docroot}/playground-login.php`);

	if (response.httpStatusCode !== 200) {
		logger.warn('WordPress response was', {
			response,
			text: response.text,
		});
		throw new Error(
			`Failed to log in as ${username}`
		);
	}
};
