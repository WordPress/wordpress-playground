import { StepHandler } from '.';

export type LoginStep = {
	step: 'login';
	username?: string;
	password?: string;
};

/**
 * Logs in to the Playground.
 * Under the hood, this function submits the wp-login.php form
 * just like a user would.
 *
 * @param playground The playground client.
 * @param user The user to log in as. Defaults to 'admin'.
 * @param password The password to log in with. Defaults to 'password'.
 */
export const login: StepHandler<LoginStep> = async (
	playground,
	{ username = 'admin', password = 'password' } = {},
	progress
) => {
	progress?.tracker.setCaption(progress?.initialCaption || 'Logging in');
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
};
