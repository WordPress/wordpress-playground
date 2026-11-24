/**
 * Keep the app and rendered WordPress on different origins in local browser tests.
 * The hostnames share one listener, but the browser gives each its own document
 * and storage access. Use the same pair in server routing and Playwright URLs so
 * a test cannot silently fall back to the ordinary single-origin preview.
 */
// Multisite rejects custom ports. CI uses HTTP's default port; local work stays on 9500.
export const appOrigin = `http://playground.localhost${process.env.CI ? '' : ':9500'}`;
export const wordPressOrigin = appOrigin.replace(
	'://playground.',
	'://wp.playground.'
);
