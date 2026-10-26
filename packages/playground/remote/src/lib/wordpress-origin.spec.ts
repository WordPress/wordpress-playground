import { selectWordPressOrigin } from './wordpress-origin';

const app = 'https://playground.wordpress.net';
const sandbox = 'https://wpsandbox.wordpress.net';

describe('WordPress origin selection', () => {
	it.each([
		['/remote.html', app],
		['/remote.html?reprint-api', app],
		['/remote.html?reprint', sandbox],
		['/remote.html?wp=6.9&reprint=', sandbox],
		['/remote.html?reprint=0', sandbox],
		['/remote.html?reprint=https://untrusted.example', sandbox],
	])('selects the fixed origin for %s', (path, expected) => {
		expect(selectWordPressOrigin(new URL(path, app), app, sandbox)).toBe(
			expected
		);
	});

	it('keeps sandbox helpers and thumbnail documents there without the flag', () => {
		for (const path of ['/wordpress-bridge.html?scope=a', '/scope:a/']) {
			expect(
				selectWordPressOrigin(new URL(path, sandbox), app, sandbox)
			).toBe(sandbox);
		}
	});

	it('keeps one origin when the deployment has no sandbox', () => {
		expect(selectWordPressOrigin(new URL('/?reprint', app), app, app)).toBe(
			app
		);
	});
});
