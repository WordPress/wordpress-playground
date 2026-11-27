import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { grantActiveSiteAccess, webmcpMock } from './webmcp-helpers';

const test = base.extend<{ webmcpPage: Page }>({
	webmcpPage: async ({ page }, use) => {
		await page.addInitScript(webmcpMock);

		await page.goto('/');
		// Wait for WordPress to load inside nested iframes
		await expect(
			page
				.frameLocator(
					'#playground-viewport:visible,' +
						'.playground-viewport:visible'
				)
				.frameLocator('#wp')
				.locator('body')
		).not.toBeEmpty();

		// Wait for WebMCP tools to be registered
		await expect
			.poll(
				() =>
					page.evaluate(
						() =>
							!!(window as any).__webmcpExecutors
								.playground_request_site_access
					),
				{ timeout: 30_000, intervals: [1_000] }
			)
			.toBe(true);

		await grantActiveSiteAccess(page);

		// Wait for the PlaygroundClient to be available via
		// WebMCP tools. The client is added to the Redux store
		// after startPlaygroundWeb resolves, which may happen
		// after the iframe content is visible and tools are
		// registered.
		await expect
			.poll(
				() =>
					page.evaluate(async () => {
						try {
							const executors = (window as any).__webmcpExecutors;
							if (!executors?.playground_get_current_url)
								return false;
							const result =
								await executors.playground_get_current_url({});
							// The execute function catches errors and
							// returns { error: "..." } instead of
							// throwing. Check for a real URL object.
							return typeof result?.url === 'string';
						} catch {
							return false;
						}
					}),
				{ timeout: 60_000, intervals: [1_000] }
			)
			.toBe(true);

		await use(page);
	},
});

test('WebMCP registers all tools', async ({ webmcpPage }) => {
	const tools = await webmcpPage.evaluate(
		() => (window as any).__webmcpTools
	);
	const names = tools.map((t: { name: string }) => t.name).sort();
	expect(names).toEqual([
		'playground_call_site_tool',
		'playground_delete_directory',
		'playground_delete_file',
		'playground_execute_php',
		'playground_file_exists',
		'playground_get_current_url',
		'playground_get_site_info',
		'playground_get_website_url',
		'playground_list_emails',
		'playground_list_files',
		'playground_list_site_tools',
		'playground_list_sites',
		'playground_mkdir',
		'playground_navigate',
		'playground_read_file',
		'playground_rename_site',
		'playground_request',
		'playground_request_site_access',
		'playground_save_in_browser',
		'playground_switch_site',
		'playground_write_file',
	]);
});

test('WebMCP site tools refuse calls without a grant', async ({
	webmcpPage,
}) => {
	const result = await webmcpPage.evaluate(async () =>
		(window as any).__webmcpTools
			.find(
				(tool: { name: string }) =>
					tool.name === 'playground_execute_php'
			)
			.execute({ code: '<?php echo "no";' })
	);
	expect(result.error).toContain('grant');
});

test('WebMCP cleanup preserves other tools and allows registration again', async ({
	webmcpPage,
}) => {
	const clientModule = `/website-server/@fs/${process.cwd()}/packages/playground/mcp/src/client.ts`;
	const result = await webmcpPage.evaluate(async (modulePath) => {
		const { registerWebMCPTools, unregisterWebMCPTools } = await import(
			/* @vite-ignore */ modulePath
		);
		const registry = (document as any).modelContext;
		await registry.registerTool({
			name: 'other_tool',
			description: 'An unrelated tool',
			execute: async () => ({}),
		});

		unregisterWebMCPTools();
		const afterCleanup = registry.tools.map(
			(tool: { name: string }) => tool.name
		);

		await registerWebMCPTools({
			list: () => [],
			getClient: () => undefined,
			rename: async () => {},
			saveInBrowser: async () => ({ slug: 'site', storage: 'temporary' }),
		});
		const afterRegistration = registry.tools.map(
			(tool: { name: string }) => tool.name
		);
		unregisterWebMCPTools();
		return {
			afterCleanup,
			afterRegistration,
			afterSecondCleanup: registry.tools.map(
				(tool: { name: string }) => tool.name
			),
		};
	}, clientModule);

	expect(result.afterCleanup).toEqual(['other_tool']);
	expect(result.afterRegistration).toContain('playground_get_site_info');
	expect(result.afterRegistration).toContain('other_tool');
	expect(result.afterSecondCleanup).toEqual(['other_tool']);
});

test('WebMCP playground_execute_php runs PHP code', async ({ webmcpPage }) => {
	const result = await webmcpPage.evaluate(async () => {
		const executors = (window as any).__webmcpExecutors;
		return await executors['playground_execute_php']({
			code: '<?php echo "Hello WebMCP";',
		});
	});
	expect(result.text).toContain('Hello WebMCP');
	expect(result.exitCode).toBe(0);
});

test('WebMCP playground_read_file reads wp-config.php', async ({
	webmcpPage,
}) => {
	const result = await webmcpPage.evaluate(async () => {
		const executors = (window as any).__webmcpExecutors;
		return await executors['playground_read_file']({
			path: '/wordpress/wp-config.php',
		});
	});
	expect(result.contents).toContain('DB_NAME');
});

test('WebMCP playground_file_exists checks existence', async ({
	webmcpPage,
}) => {
	const result = await webmcpPage.evaluate(async () => {
		const executors = (window as any).__webmcpExecutors;
		return await executors['playground_file_exists']({
			path: '/wordpress/wp-config.php',
		});
	});
	expect(result.exists).toBe(true);

	const missing = await webmcpPage.evaluate(async () => {
		const executors = (window as any).__webmcpExecutors;
		return await executors['playground_file_exists']({
			path: '/wordpress/nope.txt',
		});
	});
	expect(missing.exists).toBe(false);
});

test('WebMCP playground_get_current_url returns URL', async ({
	webmcpPage,
}) => {
	const result = await webmcpPage.evaluate(async () => {
		const executors = (window as any).__webmcpExecutors;
		return await executors['playground_get_current_url']({});
	});
	expect(result.url).toBeTruthy();
	expect(typeof result.url).toBe('string');
});

test('WebMCP playground_get_site_info returns WP info', async ({
	webmcpPage,
}) => {
	const info = await webmcpPage.evaluate(async () => {
		const executors = (window as any).__webmcpExecutors;
		return await executors['playground_get_site_info']({});
	});
	expect(info.wpVersion).toBeTruthy();
	expect(info.phpVersion).toBeTruthy();
	expect(info.documentRoot).toContain('/wordpress');
});

test('WebMCP playground_list_sites returns sites', async ({ webmcpPage }) => {
	const result = await webmcpPage.evaluate(async () => {
		const executors = (window as any).__webmcpExecutors;
		return await executors['playground_list_sites']({});
	});
	expect(result.connectedTabs).toBe(1);
	expect(result.sites).toBeInstanceOf(Array);
	expect(result.sites.length).toBeGreaterThan(0);
	const site = result.sites[0];
	expect(site.siteId).toBeTruthy();
	expect(site.name).toBeTruthy();
	expect(site.isActive).toBe(true);
});

test('WebMCP playground_save_in_browser saves a site', async ({
	webmcpPage,
}) => {
	const result = await webmcpPage.evaluate(async () => {
		const executors = (window as any).__webmcpExecutors;
		return await executors['playground_save_in_browser']({});
	});
	expect(result.success).toBe(true);
	expect(result.siteId).toBeTruthy();
	expect(result.name).toBeTruthy();
	expect(typeof result.alreadySaved).toBe('boolean');
	expect(result.storage).toBeTruthy();
});

test('WebMCP playground_rename_site renames a site', async ({ webmcpPage }) => {
	// Save the site first — temporary sites cannot be renamed.
	await webmcpPage.evaluate(async () => {
		const executors = (window as any).__webmcpExecutors;
		return await executors['playground_save_in_browser']({});
	});

	const result = await webmcpPage.evaluate(async () => {
		const executors = (window as any).__webmcpExecutors;
		return await executors['playground_rename_site']({
			newName: 'WebMCP Test Site',
		});
	});
	expect(result.success).toBe(true);
	expect(result.siteId).toBeTruthy();
	expect(result.newName).toBe('WebMCP Test Site');
});
