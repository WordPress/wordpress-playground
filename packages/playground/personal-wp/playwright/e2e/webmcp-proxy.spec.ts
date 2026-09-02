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
	navigator.modelContext.registerTool({
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

		// A document Playground does not inject the registry into announces
		// nothing, so the tool must not stay advertised on its predecessor's
		// behalf — and must come back on return.
		const toolNames = () =>
			page.evaluate(() =>
				(window as any).__webmcpTools.map(
					(tool: { name: string }) => tool.name
				)
			);
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

test.describe('WebMCP polyfill', () => {
	test('puts both tool sets on document.modelContext', async ({
		website,
	}) => {
		// No mock here: this is a browser without WebMCP, where the polyfill
		// has to provide `document.modelContext` itself.
		const { page } = website;
		await website.goto('./');

		// Playground's tools land on the polyfill before the site has booted,
		// so wait until one of them can actually reach the client.
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

		await page.evaluate(async (plugin) => {
			const run = (name: string, input: Record<string, unknown>) =>
				(document as any).modelContext.tools
					.find((tool: { name: string }) => tool.name === name)
					.execute(input);
			await run('playground_mkdir', {
				path: '/wordpress/wp-content/mu-plugins',
			});
			await run('playground_write_file', {
				path: '/wordpress/wp-content/mu-plugins/webmcp-tool.php',
				contents: plugin,
			});
			await run('playground_navigate', { path: '/' });
		}, TOOL_PLUGIN);

		await expect
			.poll(
				() =>
					page.evaluate(() =>
						(document as any).modelContext.tools.map(
							(tool: { name: string }) => tool.name
						)
					),
				{ timeout: 60_000, intervals: [1_000] }
			)
			.toContain('site_greeting');

		// The standard API is enough to run either kind of tool.
		const results = await page.evaluate(async () => {
			const run = (name: string, input: Record<string, unknown>) =>
				(document as any).modelContext.tools
					.find((tool: { name: string }) => tool.name === name)
					.execute(input);
			return {
				php: await run('playground_execute_php', {
					code: '<?php echo "from PHP";',
				}),
				site: await run('site_greeting', { name: 'Playground' }),
			};
		});
		expect(results.php.text).toContain('from PHP');
		expect(results.site.greeting).toContain('Hello Playground from ');
	});
});
