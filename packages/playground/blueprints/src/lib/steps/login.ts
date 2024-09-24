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
 * Under the hood, this function sets the `PLAYGROUND_AUTOLOGIN_USERNAME` constant
 * which is used to automatically log in the user in
 * packages/playground/remote/src/lib/playground-mu-plugin/playground-includes/login_step.php
 */
export const login: StepHandler<LoginStep> = async (
	playground,
	{ username = 'admin' } = {},
	progress
) => {
	progress?.tracker.setCaption(progress?.initialCaption || 'Logging in');
	await playground.defineConstant('PLAYGROUND_AUTOLOGIN_USERNAME', username);

	// Make a request to the wp-admin to ensure the user is logged after the blueprint runs.
	await playground.request({
		url: '/wp-admin/index.php',
	});
};
