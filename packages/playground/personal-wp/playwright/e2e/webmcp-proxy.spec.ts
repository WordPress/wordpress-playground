import type { Page } from '@playwright/test';
import { test, expect } from '../playground-fixtures';

/**
 * WebMCP (`document.modelContext`) ships behind a flag in Chrome Canary, and
 * Playwright runs stock Chromium. This mock stands in for the browser's
 * registry so the test can inspect what Playground advertises and invoke it
 * the way an agent would.
 */
const webmcpMock = () => {
	type MockTool = {
		name: string;
		execute: (input: Record<string, unknown>) => Promise<unknown>;
	};
	const registeredTools: MockTool[] = [];
	(window as any).__webmcpTools = registeredTools;
	(window as any).__webmcpExecutors = {};

	Object.defineProperty(document as any, 'modelContext', {
		configurable: true,
		value: {
			get tools() {
				return registeredTools;
			},
			async registerTool(
				tool: MockTool,
				options?: { signal?: AbortSignal }
			) {
				registeredTools.push(tool);
				(window as any).__webmcpExecutors[tool.name] = (
					input: Record<string, unknown>
				) => tool.execute(input);
				options?.signal?.addEventListener('abort', () => {
					const index = registeredTools.indexOf(tool);
					if (index !== -1) {
						registeredTools.splice(index, 1);
						delete (window as any).__webmcpExecutors[tool.name];
					}
				});
			},
		},
	});
};

/**
 * A plugin that registers a WebMCP tool inside the WordPress document. The
 * tool returns a value only PHP knows, which proves the call really executed
 * in the site rather than in the proxy.
 */
const TOOL_PLUGIN = `<?php
add_action('wp_head', function () {
	?>
	<script>
	document.modelContext.registerTool({
		name: 'site_greeting',
		description: 'Greets someone using the WordPress site name.',
		inputSchema: {
			type: 'object',
			properties: { name: { type: 'string' } },
			required: ['name'],
		},
		execute: async (input) => ({
			greeting: 'Hello ' + input.name + ' from ' +
				<?php echo json_encode(get_bloginfo('name')); ?>,
		}),
	});

	// Lets the test add and withdraw a tool while the page stays put.
	// Registers through the deprecated \`navigator\` alias on purpose: Chrome
	// still serves it, so an unmigrated plugin must reach the same registry.
	var extra = null;
	window.__addExtraTool = function () {
		extra = new AbortController();
		navigator.modelContext.registerTool({
			name: 'site_extra',
			description: 'Registered after the document loaded.',
			inputSchema: { type: 'object', properties: {} },
			execute: async () => ({ ok: true }),
		}, { signal: extra.signal });
	};
	window.__withdrawExtraTool = function () {
		extra.abort();
	};
	</script>
	<?php
}, 20);
`;

test.describe('WebMCP site tool gateway', () => {
	test.beforeEach(async ({ page }) => {
		await page.addInitScript(webmcpMock);
	});

	test('offers and runs a tool the site registered', async ({ website }) => {
		const { page } = website;
		await website.goto('./');

		// Personal WP lists its site once the site's client exists.
		await expect
			.poll(
				() =>
					page.evaluate(async () => {
						const executors = (window as any).__webmcpExecutors;
						const result = await executors?.playground_list_sites?.(
							{}
						);
						return result?.sites?.[0]?.siteId ?? null;
					}),
				{ timeout: 60_000, intervals: [1_000] }
			)
			.not.toBeNull();
		await grantSiteAccess(page);

		const run = (name: string, input: Record<string, unknown> = {}) =>
			page.evaluate(
				({ name, input }) =>
					(window as any).__webmcpExecutors[name](input),
				{ name, input }
			);
		const siteToolNames = async () => {
			const listed = await run('playground_list_site_tools');
			return (listed.content?.tools ?? []).map(
				(tool: { name: string }) => tool.name
			);
		};

		// Playground registers its own tools before the site has booted, so
		// wait until one of them can actually reach the client.
		await expect
			.poll(
				async () =>
					typeof (await run('playground_get_site_info'))
						?.wpVersion === 'string',
				{ timeout: 60_000, intervals: [1_000] }
			)
			.toBe(true);

		await run('playground_mkdir', {
			path: '/wordpress/wp-content/mu-plugins',
		});
		await run('playground_write_file', {
			path: '/wordpress/wp-content/mu-plugins/webmcp-tool.php',
			contents: TOOL_PLUGIN,
		});
		await run('playground_navigate', { path: '/' });

		// The site's tool is offered through the gateway, never as a tool of
		// the Personal WP page itself.
		await expect
			.poll(siteToolNames, { timeout: 60_000, intervals: [1_000] })
			.toContain('site_greeting');
		expect(
			await page.evaluate(() =>
				(window as any).__webmcpTools.map(
					(tool: { name: string }) => tool.name
				)
			)
		).not.toContain('site_greeting');

		const listed = await run('playground_list_site_tools');
		const greeting = listed.content.tools.find(
			(tool: { name: string }) => tool.name === 'site_greeting'
		);
		expect(greeting.description).toBe(
			'Greets someone using the WordPress site name.'
		);
		expect(greeting.inputSchema.required).toEqual(['name']);

		// Calling it executes inside the WordPress document.
		const result = await run('playground_call_site_tool', {
			tool: 'site_greeting',
			arguments: { name: 'Playground' },
		});
		expect(result.source).toBe('wordpress-site');
		expect(result.content.result.greeting).toContain(
			'Hello Playground from '
		);

		// A plugin can add and withdraw tools while the page stays put, so
		// the gateway must follow the registry rather than page loads.
		const wordpress = website.wordpress().locator('body');
		await wordpress.evaluate(() => (window as any).__addExtraTool());
		await expect
			.poll(siteToolNames, { timeout: 30_000, intervals: [500] })
			.toContain('site_extra');

		await wordpress.evaluate(() => (window as any).__withdrawExtraTool());
		await expect
			.poll(siteToolNames, { timeout: 30_000, intervals: [500] })
			.not.toContain('site_extra');
		// Withdrawing one tool leaves the rest alone.
		expect(await siteToolNames()).toContain('site_greeting');

		// A document Playground does not inject the registry into announces
		// nothing, so the tool must not stay listed on its predecessor's
		// behalf — and must come back on return.
		await run('playground_navigate', {
			path: '/wp-admin/admin-ajax.php?action=nope',
		});
		await expect
			.poll(siteToolNames, { timeout: 30_000, intervals: [500] })
			.not.toContain('site_greeting');

		await run('playground_navigate', { path: '/' });
		await expect
			.poll(siteToolNames, { timeout: 30_000, intervals: [500] })
			.toContain('site_greeting');

		// The login screen is deliberately left out: it fires neither
		// `wp_head` nor `admin_head`, so it carries no registry and offers
		// nothing. `reauth=1` reaches the form despite the auto-login.
		await run('playground_navigate', { path: '/wp-login.php?reauth=1' });
		await expect
			.poll(siteToolNames, { timeout: 30_000, intervals: [500] })
			.not.toContain('site_greeting');

		await run('playground_navigate', { path: '/' });
		await expect
			.poll(siteToolNames, { timeout: 30_000, intervals: [500] })
			.toContain('site_greeting');

		// Navigating to a page that registers nothing withdraws the tool.
		await run('playground_delete_file', {
			path: '/wordpress/wp-content/mu-plugins/webmcp-tool.php',
		});
		await run('playground_navigate', { path: '/' });
		await expect
			.poll(siteToolNames, { timeout: 60_000, intervals: [1_000] })
			.not.toContain('site_greeting');
	});
});

/**
 * Requests access to the site the way an agent would, approves it in Personal
 * WP's dialog, and makes `window.__webmcpExecutors` pass the site ID and
 * grant to every tool that needs them.
 */
async function grantSiteAccess(page: Page) {
	const siteId: string = await page.evaluate(async () => {
		const { sites } = await (
			window as any
		).__webmcpExecutors.playground_list_sites({});
		return sites[0].siteId;
	});
	const request = page.evaluate(
		(siteId) =>
			(window as any).__webmcpExecutors.playground_request_site_access({
				siteId,
			}),
		siteId
	);
	await page.getByRole('button', { name: 'Allow', exact: true }).click();
	const { grant } = await request;
	await page.evaluate(
		({ siteId, grant }) => {
			const w = window as any;
			for (const tool of w.__webmcpTools) {
				if (tool.inputSchema?.required?.includes('grant')) {
					w.__webmcpExecutors[tool.name] = (
						input: Record<string, unknown>
					) => tool.execute({ siteId, grant, ...input });
				}
			}
		},
		{ siteId, grant }
	);
}
