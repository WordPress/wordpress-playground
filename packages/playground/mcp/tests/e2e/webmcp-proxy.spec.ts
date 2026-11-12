import { test, expect } from '@playwright/test';
import { grantActiveSiteAccess, webmcpMock } from './webmcp-helpers';

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

test('the website offers site tools through the gateway', async ({ page }) => {
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
	await expect
		.poll(
			() =>
				page.evaluate(
					() =>
						!!(window as any).__webmcpExecutors
							.playground_request_site_access
				),
			{ timeout: 60_000, intervals: [1_000] }
		)
		.toBe(true);
	await grantActiveSiteAccess(page);

	const run = (name: string, input: Record<string, unknown> = {}) =>
		page.evaluate(
			({ name, input }) => (window as any).__webmcpExecutors[name](input),
			{ name, input }
		);
	const siteToolNames = async () => {
		const listed = await run('playground_list_site_tools');
		return (listed.content?.tools ?? []).map(
			(tool: { name: string }) => tool.name
		);
	};

	// Playground's tools land before the site has booted, so wait until one
	// of them can actually reach the client.
	await expect
		.poll(
			async () =>
				typeof (await run('playground_get_site_info'))?.wpVersion ===
				'string',
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
		.poll(siteToolNames, { timeout: 60_000, intervals: [1_000] })
		.toContain('site_greeting');
	// The site's tool is never registered as a tool of the page itself.
	expect(
		await page.evaluate(() =>
			(document as any).modelContext.tools.map(
				(tool: { name: string }) => tool.name
			)
		)
	).not.toContain('site_greeting');

	const result = await run('playground_call_site_tool', {
		tool: 'site_greeting',
		arguments: { name: 'Playground' },
	});
	expect(result.source).toBe('wordpress-site');
	expect(result.content.result.greeting).toContain('Hello Playground from ');

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

	// Removing the plugin takes its tools with it.
	await run('playground_delete_file', {
		path: '/wordpress/wp-content/mu-plugins/webmcp-tool.php',
	});
	await run('playground_navigate', { path: '/' });
	await expect
		.poll(siteToolNames, { timeout: 30_000, intervals: [500] })
		.not.toContain('site_greeting');
});
