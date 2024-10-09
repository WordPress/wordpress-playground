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
 * Under the hood, this function sets the `PLAYGROUND_AUTO_LOGIN_AS_USER` constant.
 * The `0-auto-login.php` mu-plugin uses that constant to log in the user on the first load.
 * This step depends on the `@wp-playground/wordpress` package because
 * the plugin is located in and loaded automatically by the `@wp-playground/wordpress` package.
 */
export const login: StepHandler<LoginStep> = async (
	playground,
	{ username = 'admin' } = {},
	progress
) => {
	progress?.tracker.setCaption(progress?.initialCaption || 'Logging in');

	playground.defineConstant('PLAYGROUND_AUTO_LOGIN_AS_USER', username);
};
