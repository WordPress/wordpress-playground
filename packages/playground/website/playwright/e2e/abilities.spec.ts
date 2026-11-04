import { test, expect } from '../playground-fixtures';
import { blueprint } from '../abilities-fixtures';

// The browser registry is mocked; discovery and execution run in real WordPress.
function mockWebMCP() {
	const tools: any[] = [];
	Object.defineProperty(document, 'modelContext', {
		configurable: true,
		value: {
			get tools() {
				return tools;
			},
			registerTool(tool: any, options: any) {
				if (options?.signal.aborted) return;
				if (!/^[a-zA-Z0-9_.-]{1,128}$/.test(tool.name)) {
					throw new Error(
						'WebMCP tool names may only contain letters, digits, underscores, hyphens, and dots.'
					);
				}
				if (tools.some((existing) => existing.name === tool.name))
					throw new Error('Duplicate tool');
				tools.push(tool);
				options?.signal.addEventListener('abort', () => {
					const index = tools.indexOf(tool);
					if (index >= 0) tools.splice(index, 1);
				});
			},
		},
	});
}

test('ability controls reconcile WebMCP exposure and run manually', async ({
	website,
}) => {
	const page = website.page;
	await page.addInitScript(mockWebMCP);
	await website.goto(`./?storage=temp#${blueprint()}`);
	await website.openDockPane('Abilities');
	const pane = page.getByRole('dialog', { name: 'Abilities pane' });
	const fixtureGroup = pane.getByRole('button', {
		name: 'fixture',
		exact: true,
	});
	await expect(fixtureGroup).toHaveAttribute('aria-expanded', 'false');
	await fixtureGroup.click();
	await expect(
		pane.getByRole('button', { name: 'Echo object', exact: true })
	).toBeVisible();
	await page.waitForFunction(() => Boolean((window as any).playground));
	const userId = await page.evaluate(
		async () => (await (window as any).playground.listAbilities()).user.id
	);
	const toolNames = () =>
		page.evaluate(() =>
			(document as any).modelContext.tools.map((tool: any) => tool.name)
		);
	expect(await toolNames()).not.toContain('wp_ability_fixture.object');
	const fixtureTools = [
		'object',
		'scalar',
		'no-input',
		'denied',
		'error',
	].map((name) => `wp_ability_fixture.${name}`);
	const groupSwitch = pane.getByRole('checkbox', {
		name: 'Expose all fixture abilities to agents through WebMCP and MCP',
		exact: true,
	});
	await groupSwitch.check();
	await expect.poll(toolNames).toEqual(expect.arrayContaining(fixtureTools));
	await groupSwitch.uncheck();
	await expect
		.poll(async () =>
			(await toolNames()).filter((name: string) =>
				fixtureTools.includes(name)
			)
		)
		.toEqual([]);
	await pane
		.getByRole('checkbox', {
			name: 'Expose Echo object to agents through WebMCP and MCP',
			exact: true,
		})
		.check();
	await expect.poll(toolNames).toContain('wp_ability_fixture.object');
	expect(
		await page.evaluate(async () =>
			(document as any).modelContext.tools
				.find((tool: any) => tool.name === 'wp_ability_fixture.object')
				.execute({ input: { message: 'agent' } })
		)
	).toEqual({
		success: true,
		data: { message: 'agent', user: userId },
	});
	await pane
		.getByRole('button', { name: 'Echo object', exact: true })
		.click();
	await pane
		.getByLabel('JSON input', { exact: true })
		.fill('{"message":"manual"}');
	await pane.getByRole('button', { name: 'Run', exact: true }).click();
	await expect(pane.getByRole('status')).toContainText('manual');
	await page.setViewportSize({ width: 390, height: 844 });
	await pane
		.getByRole('button', { name: 'Back to abilities', exact: true })
		.click();
	await pane
		.getByRole('button', { name: 'Echo object', exact: true })
		.click();
	await page.setViewportSize({ width: 1280, height: 900 });
	await page.keyboard.press('Escape');
	await expect(pane).not.toBeVisible();
	expect(await toolNames()).toContain('wp_ability_fixture.object');
	await website.openDockPane('Abilities');
	await expect(
		pane.getByRole('checkbox', {
			name: 'Expose to agents (WebMCP and MCP)',
			exact: true,
		})
	).toBeChecked();
	await pane
		.getByRole('checkbox', {
			name: 'Expose to agents (WebMCP and MCP)',
			exact: true,
		})
		.uncheck();
	await expect.poll(toolNames).not.toContain('wp_ability_fixture.object');
	await page.evaluate(async () => {
		const client = (window as any).playground;
		await client.unlink(
			'/wordpress/wp-content/mu-plugins/abilities-fixture.php'
		);
		await client.goTo('/wp-admin/plugins.php');
	});
	await expect(
		pane.getByRole('button', { name: 'Echo object', exact: true })
	).toHaveCount(0);
	await pane.getByRole('button', { name: 'Refresh', exact: true }).click();
	await expect(pane.getByText('Loading abilities…')).toHaveCount(0);
	expect(
		await page.evaluate(async () =>
			(window as any).playground.executeAbility('fixture/object', {})
		)
	).toMatchObject({
		success: false,
		errors: [{ code: 'ability_not_found' }],
	});
});

test('manual runner remains available without WebMCP', async ({ website }) => {
	await website.page.addInitScript(() => {
		for (const target of [document, navigator]) {
			Object.defineProperty(target, 'modelContext', {
				configurable: true,
				value: undefined,
			});
		}
	});
	await website.goto(`./?storage=temp#${blueprint()}`);
	await website.openDockPane('Abilities');
	const pane = website.page.getByRole('dialog', { name: 'Abilities pane' });
	await expect(
		pane.getByText(
			'Connect the Playground MCP server to expose abilities to agents.',
			{
				exact: false,
			}
		)
	).toBeVisible();
	await pane.getByRole('button', { name: 'fixture', exact: true }).click();
	await pane
		.getByRole('button', { name: 'Echo scalar', exact: true })
		.click();
	await pane.getByLabel('JSON input', { exact: true }).fill('"test"');
	await pane.getByRole('button', { name: 'Run', exact: true }).click();
	await expect(pane.getByRole('status')).toContainText('test');
});

test('older WordPress reports that the Abilities API is unavailable', async ({
	website,
}) => {
	await website.goto(`./?storage=temp#${blueprint('6.8')}`);
	await website.openDockPane('Abilities');
	await expect(
		website.page.getByRole('dialog', { name: 'Abilities pane' })
	).toContainText('The Abilities API is unavailable');
});
