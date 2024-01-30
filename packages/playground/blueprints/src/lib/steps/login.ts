import { StepHandler } from '.';

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
 * Logs in to the Playground.
 * Under the hood, this function submits the wp-login.php form
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

	await playground.request({
		url: '/wp-login.php',
		method: 'POST',
		formData: {
			log: username,
			pwd: password,
			rememberme: 'forever',
		},
	});

	const response = await playground.request({
		url: '/wp-admin',
	});
	// Naive check to see if we're logged in.
	if (!response.text.includes('id="wpadminbar"')) {
		console.warn('WordPress response was', {
			response,
			text: response.text,
		});
		throw new Error(
			`Failed to log in as ${username} with password ${password}`
		);
	}
};
