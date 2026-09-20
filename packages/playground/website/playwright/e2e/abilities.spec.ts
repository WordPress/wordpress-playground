import { test, expect } from '../playground-fixtures';

const fixture = `<?php
add_action('wp_abilities_api_categories_init', function () {
 wp_register_ability_category('fixture', array('label' => 'Fixture', 'description' => 'Developer test abilities'));
});
add_action('wp_abilities_api_init', function () {
 $base = array('label' => 'Echo object', 'description' => 'Returns input with the current WordPress user.', 'category' => 'fixture', 'permission_callback' => '__return_true');
 wp_register_ability('fixture/object', array_merge($base, array(
  'input_schema' => array('type' => 'object', 'properties' => array('message' => array('type' => 'string')), 'required' => array('message')),
  'execute_callback' => function ($input) { return array('message' => $input['message'], 'user' => get_current_user_id()); }
 )));
 wp_register_ability('fixture/scalar', array_merge($base, array('label' => 'Echo scalar', 'input_schema' => array('type' => 'string'), 'execute_callback' => function ($input) { return $input; })));
 wp_register_ability('fixture/no-input', array_merge($base, array('label' => 'No input', 'execute_callback' => function () { return false; })));
 wp_register_ability('fixture/denied', array_merge($base, array('label' => 'Denied', 'permission_callback' => '__return_false', 'execute_callback' => function () { return 'MUST NOT RUN'; })));
 wp_register_ability('fixture/error', array_merge($base, array('label' => 'Error', 'execute_callback' => function () { return new WP_Error('fixture_error', 'Fixture failure', array('reason' => 42)); })));
});`;

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

function blueprint(wp = '6.9') {
	return Buffer.from(
		JSON.stringify({
			preferredVersions: { php: '8.3', wp },
			landingPage: '/wp-admin/',
			steps: [
				{
					step: 'writeFile',
					path: '/wordpress/wp-content/mu-plugins/abilities-fixture.php',
					data: fixture,
				},
				{ step: 'login' },
			],
		})
	).toString('base64');
}

test('native abilities execute with permissions and reconcile WebMCP exposure', async ({
	website,
}, testInfo) => {
	const page = website.page;
	await page.addInitScript(mockWebMCP);
	await website.goto(`./?storage=temp#${blueprint()}`);
	await website.openDockPane('Abilities');
	const pane = page.getByRole('dialog', { name: 'Abilities pane' });
	await expect(
		pane.getByRole('button', { name: 'Echo object', exact: true })
	).toBeVisible();
	await page.screenshot({
		path: testInfo.outputPath('abilities-list-desktop.png'),
		animations: 'disabled',
	});
	await page.waitForFunction(() => Boolean((window as any).playground));
	const results = await page.evaluate(async () => {
		const client = (window as any).playground;
		return {
			list: await client.listAbilities(),
			object: await client.executeAbility('fixture/object', {
				message: 'hello',
			}),
			scalar: await client.executeAbility('fixture/scalar', 'scalar'),
			noInput: await client.executeAbility('fixture/no-input'),
			denied: await client.executeAbility('fixture/denied'),
			error: await client.executeAbility('fixture/error'),
			invalid: await client.executeAbility('fixture/object', {
				message: 7,
			}),
		};
	});
	expect(results.list.available).toBe(true);
	expect(
		results.list.abilities.find(
			(ability: any) => ability.name === 'fixture/object'
		).meta.show_in_rest
	).not.toBe(true);
	expect(results.object).toEqual({
		success: true,
		data: { message: 'hello', user: results.list.user.id },
	});
	expect(results.scalar).toEqual({ success: true, data: 'scalar' });
	expect(results.noInput).toEqual({ success: true, data: false });
	expect(results.denied.success).toBe(false);
	expect(results.invalid.success).toBe(false);
	expect(results.error.errors).toContainEqual({
		code: 'fixture_error',
		message: 'Fixture failure',
		data: { reason: 42 },
	});
	const toolNames = () =>
		page.evaluate(() =>
			(document as any).modelContext.tools.map((tool: any) => tool.name)
		);
	expect(await toolNames()).not.toContain('wp_ability_fixture.object');
	await pane
		.getByRole('checkbox', {
			name: 'Expose Echo object through WebMCP',
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
		data: { message: 'agent', user: results.list.user.id },
	});
	await pane
		.getByRole('button', { name: 'Echo object', exact: true })
		.click();
	await pane
		.getByLabel('JSON input', { exact: true })
		.fill('{"message":"manual"}');
	await pane.getByRole('button', { name: 'Run', exact: true }).click();
	await expect(pane.getByRole('status')).toContainText('manual');
	await page.screenshot({
		path: testInfo.outputPath('abilities-detail-desktop.png'),
		animations: 'disabled',
	});
	await page.setViewportSize({ width: 390, height: 844 });
	await page.waitForTimeout(400);
	await page.screenshot({
		path: testInfo.outputPath('abilities-detail-mobile.png'),
		animations: 'disabled',
	});
	await pane
		.getByRole('button', { name: 'Back to abilities', exact: true })
		.click();
	await page.screenshot({
		path: testInfo.outputPath('abilities-list-mobile.png'),
		animations: 'disabled',
	});
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
			name: 'Expose through WebMCP',
			exact: true,
		})
	).toBeChecked();
	await pane
		.getByRole('checkbox', { name: 'Expose through WebMCP', exact: true })
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
	await page.evaluate(async (userId) => {
		await (window as any).playground.run({
			code:
				'<?php require "/wordpress/wp-load.php"; WP_Session_Tokens::get_instance(' +
				userId +
				')->destroy_all();',
		});
	}, results.list.user.id);
	await expect(
		page.evaluate(async () => (window as any).playground.listAbilities())
	).rejects.toThrow('Sign in to WordPress');
});

test('manual runner remains available without WebMCP', async ({ website }) => {
	await website.goto(`./?storage=temp#${blueprint()}`);
	await website.openDockPane('Abilities');
	const pane = website.page.getByRole('dialog', { name: 'Abilities pane' });
	await expect(
		pane.getByText('This browser does not support WebMCP.', {
			exact: false,
		})
	).toBeVisible();
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
