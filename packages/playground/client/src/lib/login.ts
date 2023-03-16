import type { PlaygroundClient } from '../';

export async function login(
	playground: PlaygroundClient,
	user = 'admin',
	password = 'password'
) {
	await playground.request({
		relativeUrl: '/wp-login.php',
	});

	await playground.request({
		relativeUrl: '/wp-login.php',
		method: 'POST',
		formData: {
			log: user,
			pwd: password,
			rememberme: 'forever',
		},
	});
}
