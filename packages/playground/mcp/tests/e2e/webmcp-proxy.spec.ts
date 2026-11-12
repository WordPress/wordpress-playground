import { test, expect } from '@playwright/test';

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
	</script>
	<?php
}, 20);
`;

/**
 * Playwright runs a stock Chromium with no `document.modelContext`, so stand
 * in for the browser's registry the way `webmcp.spec.ts` does.
 */
const webmcpMock = () => {
	type MockTool = {
		name: string;
		execute: (input: Record<string, unknown>) => Promise<unknown>;
	};
	const registeredTools: MockTool[] = [];

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
				options?.signal?.addEventListener('abort', () => {
					const index = registeredTools.indexOf(tool);
					if (index !== -1) {
						registeredTools.splice(index, 1);
					}
				});
			},
		},
	});
};

test('the website proxies tools registered by the site', async ({ page }) => {
	await page.addInitScript(webmcpMock);
	await page.goto('/');
	await expect(
		page
			.frameLocator(
				'#playground-viewport:visible,.playground-viewport:visible'
			)
			.frameLocator('#wp')
			.locator('body')
	).not.toBeEmpty();

	const run = (name: string, input: Record<string, unknown> = {}) =>
		page.evaluate(
			({ name, input }) =>
				(document as any).modelContext.tools
					.find((tool: { name: string }) => tool.name === name)
					.execute(input),
			{ name, input }
		);
	const toolNames = () =>
		page.evaluate(() =>
			(document as any).modelContext.tools.map(
				(tool: { name: string }) => tool.name
			)
		);

	// Playground's tools land on the polyfill before the site has booted, so
	// wait until one of them can actually reach the client.
	await expect
		.poll(
			() =>
				page.evaluate(async () => {
					const tool = (document as any).modelContext?.tools.find(
						(candidate: { name: string }) =>
							candidate.name === 'playground_get_site_info'
					);
					if (!tool) {
						return false;
					}
					const info = await tool.execute({});
					return typeof info?.wpVersion === 'string';
				}),
			{ timeout: 60_000, intervals: [1_000] }
		)
		.toBe(true);

	await run('playground_mkdir', { path: '/wordpress/wp-content/mu-plugins' });
	await run('playground_write_file', {
		path: '/wordpress/wp-content/mu-plugins/webmcp-tool.php',
		contents: TOOL_PLUGIN,
	});
	await run('playground_navigate', { path: '/' });

	await expect
		.poll(toolNames, { timeout: 60_000, intervals: [1_000] })
		.toContain('site_greeting');

	const result = await run('site_greeting', { name: 'Playground' });
	expect(result.greeting).toContain('Hello Playground from ');

	// A document Playground does not inject the registry into announces
	// nothing, so the tool must not stay advertised on its predecessor's
	// behalf — and must come back on return.
	await run('playground_navigate', {
		path: '/wp-admin/admin-ajax.php?action=nope',
	});
	await expect
		.poll(toolNames, { timeout: 30_000, intervals: [500] })
		.not.toContain('site_greeting');

	await run('playground_navigate', { path: '/' });
	await expect
		.poll(toolNames, { timeout: 30_000, intervals: [500] })
		.toContain('site_greeting');

	// Removing the plugin takes its tools with it, leaving Playground's own
	// tools registered.
	await run('playground_delete_file', {
		path: '/wordpress/wp-content/mu-plugins/webmcp-tool.php',
	});
	await run('playground_navigate', { path: '/' });
	await expect
		.poll(toolNames, { timeout: 30_000, intervals: [500] })
		.not.toContain('site_greeting');
	expect(await toolNames()).toContain('playground_execute_php');
});
