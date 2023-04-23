import { UniversalPHP } from '@php-wasm/universal';

/**
 * Logs in to the Playground.
 * Under the hood, this function submits the wp-login.php form
 * just like a user would.
 *
 * @param playground The playground client.
 * @param user The user to log in as. Defaults to 'admin'.
 * @param password The password to log in with. Defaults to 'password'.
 */
export async function login(
	playground: UniversalPHP,
	user = 'admin',
	password = 'password'
) {
	await playground.request({
		url: '/wp-login.php',
	});

	await playground.request({
		url: '/wp-login.php',
		method: 'POST',
		formData: {
			log: user,
			pwd: password,
			rememberme: 'forever',
		},
	});
}
