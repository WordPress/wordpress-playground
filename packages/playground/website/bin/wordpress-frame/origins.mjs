// Multisite rejects custom ports. CI uses HTTP's default port; local work stays on 9500.
export const appOrigin = `http://playground.localhost${process.env.CI ? '' : ':9500'}`;
export const wordPressOrigin = appOrigin.replace(
	'://playground.',
	'://wp.playground.'
);
