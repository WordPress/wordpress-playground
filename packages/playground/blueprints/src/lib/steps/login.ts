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
	// Allow WordPress to set the cookies.
	await playground.request({
		url: '/wp-login.php',
	});

	const response = await playground.request({
		url: '/wp-login.php',
		method: 'POST',
		body: {
			log: username,
			pwd: password,
			rememberme: 'forever',
		},
	});

	if (!response.headers?.['location']?.[0]?.includes('/wp-admin/')) {
		logger.warn('WordPress response was', {
			response,
			text: response.text,
		});
		throw new Error(
			`Failed to log in as ${username} with password ${password}`
		);
	}
};
