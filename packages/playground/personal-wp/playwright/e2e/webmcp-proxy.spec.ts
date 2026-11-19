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

test.describe('WebMCP proxy', () => {
	test.beforeEach(async ({ page }) => {
		await page.addInitScript(webmcpMock);
	});

	test('advertises and runs a tool the site registered', async ({
		website,
	}) => {
		const { page } = website;
		await website.goto('./');

		// Playground registers its own tools before the site has booted, so
		// wait until one of them can actually reach the client.
		await expect
			.poll(
				() =>
					page.evaluate(async () => {
						const executors = (window as any).__webmcpExecutors;
						if (!executors?.playground_get_site_info) {
							return false;
						}
						const info = await executors.playground_get_site_info(
							{}
						);
						return typeof info?.wpVersion === 'string';
					}),
				{ timeout: 60_000, intervals: [1_000] }
			)
			.toBe(true);

		await page.evaluate(async (plugin) => {
			const executors = (window as any).__webmcpExecutors;
			await executors['playground_mkdir']({
				path: '/wordpress/wp-content/mu-plugins',
			});
			await executors['playground_write_file']({
				path: '/wordpress/wp-content/mu-plugins/webmcp-tool.php',
				contents: plugin,
			});
			await executors['playground_navigate']({ path: '/' });
		}, TOOL_PLUGIN);

		// The site's tool is now advertised by the Playground page itself.
		await expect
			.poll(
				() =>
					page.evaluate(() =>
						(window as any).__webmcpTools.map(
							(tool: { name: string }) => tool.name
						)
					),
				{ timeout: 60_000, intervals: [1_000] }
			)
			.toContain('site_greeting');

		const proxied = await page.evaluate(() =>
			(window as any).__webmcpTools.find(
				(tool: { name: string }) => tool.name === 'site_greeting'
			)
		);
		expect(proxied.description).toBe(
			'Greets someone using the WordPress site name.'
		);
		expect(proxied.inputSchema.required).toEqual(['name']);

		// Calling it from the outside executes inside the WordPress document.
		const result = await page.evaluate(async () =>
			(window as any).__webmcpExecutors['site_greeting']({
				name: 'Playground',
			})
		);
		expect(result.greeting).toContain('Hello Playground from ');

		const toolNames = () =>
			page.evaluate(() =>
				(window as any).__webmcpTools.map(
					(tool: { name: string }) => tool.name
				)
			);

		// A plugin can add and withdraw tools while the page stays put, so
		// the proxy must follow the registry rather than page loads.
		const wordpress = website.wordpress().locator('body');
		await wordpress.evaluate(() => (window as any).__addExtraTool());
		await expect
			.poll(toolNames, { timeout: 30_000, intervals: [500] })
			.toContain('site_extra');

		await wordpress.evaluate(() => (window as any).__withdrawExtraTool());
		await expect
			.poll(toolNames, { timeout: 30_000, intervals: [500] })
			.not.toContain('site_extra');
		// Withdrawing one tool leaves the rest alone.
		expect(await toolNames()).toContain('site_greeting');

		// A document Playground does not inject the registry into announces
		// nothing, so the tool must not stay advertised on its predecessor's
		// behalf — and must come back on return.
		await page.evaluate(async () => {
			await (window as any).__webmcpExecutors['playground_navigate']({
				path: '/wp-admin/admin-ajax.php?action=nope',
			});
		});
		await expect
			.poll(toolNames, { timeout: 30_000, intervals: [500] })
			.not.toContain('site_greeting');

		await page.evaluate(async () => {
			await (window as any).__webmcpExecutors['playground_navigate']({
				path: '/',
			});
		});
		await expect
			.poll(toolNames, { timeout: 30_000, intervals: [500] })
			.toContain('site_greeting');

		// The login screen is deliberately left out: it fires neither
		// `wp_head` nor `admin_head`, so it carries no registry and proxies
		// nothing. `reauth=1` reaches the form despite the auto-login.
		await page.evaluate(async () => {
			await (window as any).__webmcpExecutors['playground_navigate']({
				path: '/wp-login.php?reauth=1',
			});
		});
		await expect
			.poll(toolNames, { timeout: 30_000, intervals: [500] })
			.not.toContain('site_greeting');

		await page.evaluate(async () => {
			await (window as any).__webmcpExecutors['playground_navigate']({
				path: '/',
			});
		});
		await expect
			.poll(toolNames, { timeout: 30_000, intervals: [500] })
			.toContain('site_greeting');

		// Navigating to a page that registers nothing withdraws the tool.
		await page.evaluate(async () => {
			const executors = (window as any).__webmcpExecutors;
			await executors['playground_delete_file']({
				path: '/wordpress/wp-content/mu-plugins/webmcp-tool.php',
			});
			await executors['playground_navigate']({ path: '/' });
		});
		await expect
			.poll(
				() =>
					page.evaluate(() =>
						(window as any).__webmcpTools.map(
							(tool: { name: string }) => tool.name
						)
					),
				{ timeout: 60_000, intervals: [1_000] }
			)
			.not.toContain('site_greeting');
	});
});
