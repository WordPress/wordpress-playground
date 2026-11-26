import { test, expect } from '../playground-fixtures';
import type { Blueprint } from '@wp-playground/blueprints';

// These smoke tests cover Personal WP's own launch URL and boot behavior.

test('should land on My Apps on first visit', async ({ website }) => {
	await website.goto('./');
	await expect(website.page).toHaveURL(/\/my-apps\/$/);
});

test('should ignore a blueprint passed via URL hash', async ({ website }) => {
	const blueprint: Blueprint = { landingPage: '/sample-page/' };
	await website.goto(`./#${JSON.stringify(blueprint)}`);
	await expect(website.page).toHaveURL(/\/my-apps\/$/);
});

test('should ignore a blueprint passed via URL parameter', async ({
	website,
}) => {
	const blueprint: Blueprint = { landingPage: '/sample-page/' };
	const blueprintUrl = `data:application/json,${encodeURIComponent(JSON.stringify(blueprint))}`;
	await website.goto(`./?blueprint-url=${encodeURIComponent(blueprintUrl)}`);
	await expect(website.page).toHaveURL(/\/my-apps\/$/);
});

test('should display the seamless viewport and Site Tools latch', async ({
	website,
}) => {
	await website.goto('./');
	await expect(
		website.page.locator('.playground-viewport:visible')
	).toBeVisible();
	await expect(
		website.page.getByRole('button', { name: /Open Site Tools/ })
	).toBeVisible();
});

// Contract: the nested frame receives its policy before its first WordPress request.
// A late parent callback can leave startup fetches blocked even if the final DOM
// looks correct. The shared client sets src independently of Personal WP's listener.
test('delegates loopback before WordPress startup on a custom host', async ({
	website,
}) => {
	await website.page.addInitScript(() => {
		const descriptor = Object.getOwnPropertyDescriptor(
			HTMLIFrameElement.prototype,
			'src'
		)!;
		Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
			...descriptor,
			set(value: string) {
				if (
					this.id === 'wp' &&
					!(window as any).initialWordPressPolicy
				) {
					(window as any).initialWordPressPolicy = {
						allow: this.allow,
						url: value,
					};
				}
				descriptor.set!.call(this, value);
			},
		});
	});
	await website.goto('./');
	const initial = await website.page
		.frameLocator('.playground-viewport:visible')
		.locator('#wp')
		.evaluate(() => (window as any).initialWordPressPolicy);
	expect(initial).toBeTruthy();
	expect(initial.allow).toBe(
		`loopback-network ${new URL(initial.url).origin}`
	);
});
