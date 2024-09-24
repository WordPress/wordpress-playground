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
 * Under the hood, this function calls /playground-login.php
 * which is preloaded during boot using auto_prepend_file.
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

	const response = await playground.request({
		url: '/playground-login.php',
		method: 'POST',
		body: {
			username,
		},
	});

	if (response.httpStatusCode !== 200) {
		logger.warn('WordPress response was', {
			response,
			text: response.text,
		});
		throw new Error(`Failed to log in as ${username}`);
	}
};
