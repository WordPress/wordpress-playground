import { test, expect } from '@playwright/test';

test.use({
	launchOptions: {
		args: [
			'--enable-blink-features=WebMCP,WebMCPTesting',
			'--js-flags=--enable-experimental-webassembly-jspi',
		],
	},
});

// Protect the actual browser registration contract, which a permissive mock missed.
test('core abilities register and unregister through native WebMCP', async ({
	page,
}) => {
	await page.addInitScript(() => {
		// Chromium 149 exposes the native object on navigator. Only alias its
		// location for Playground; registration and validation remain native.
		if (
			!(document as any).modelContext &&
			(navigator as any).modelContext
		) {
			Object.defineProperty(document, 'modelContext', {
				configurable: true,
				value: (navigator as any).modelContext,
			});
		}
	});
	const blueprint = Buffer.from(
		JSON.stringify({
			preferredVersions: { php: '8.3', wp: '6.9' },
			landingPage: '/wp-admin/',
			steps: [{ step: 'login' }],
		})
	).toString('base64');
	await page.goto(`./?storage=temp#${blueprint}`);
	await page.waitForFunction(() => Boolean((window as any).playground));
	await expect(
		page
			.frameLocator(
				'#playground-viewport:visible,.playground-viewport:visible'
			)
			.frameLocator('#wp')
			.locator('body')
	).not.toBeEmpty();
	await page.getByRole('button', { name: 'Dev Tools', exact: true }).click();
	await page.getByRole('button', { name: 'Abilities', exact: true }).click();
	const pane = page.getByRole('dialog', { name: 'Abilities pane' });
	const abilities = await page.evaluate(
		async () => (await (window as any).playground.listAbilities()).abilities
	);
	const names = () =>
		page.evaluate(async () =>
			(await (document as any).modelContext.getTools()).map(
				(tool: any) => tool.name
			)
		);
	for (const name of ['core/get-user-info', 'core/get-environment-info']) {
		const ability = abilities.find((item: any) => item.name === name);
		expect(ability).toBeDefined();
		await pane
			.getByRole('checkbox', {
				name: `Expose ${ability.label} through WebMCP`,
				exact: true,
			})
			.check();
		await expect
			.poll(names)
			.toContain(`wp_ability_${name.replace('/', '.')}`);
	}
	await expect(pane).not.toContainText('[object Object]');
	for (const name of ['core/get-user-info', 'core/get-environment-info']) {
		const ability = abilities.find((item: any) => item.name === name);
		await pane
			.getByRole('checkbox', {
				name: `Expose ${ability.label} through WebMCP`,
				exact: true,
			})
			.uncheck();
		await expect
			.poll(names)
			.not.toContain(`wp_ability_${name.replace('/', '.')}`);
	}
});
