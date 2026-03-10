import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import WebSocket from 'ws';

// Use a random port so tests are isolated from real browser tabs
// that might also connect to the default MCP WebSocket port.
const MCP_WS_PORT = 17999 + Math.floor(Math.random() * 1000);

type McpTestFixtures = {
	siteId: string;
};

type McpWorkerFixtures = {
	mcpClient: Client;
	playgroundPage: Page;
};

const test = base.extend<McpTestFixtures, McpWorkerFixtures>({
	mcpClient: [
		// eslint-disable-next-line no-empty-pattern
		async ({}, use) => {
			const transport = new StdioClientTransport({
				command: 'node',
				args: [
					'--experimental-strip-types',
					'--experimental-transform-types',
					'--import',
					'../../../meta/src/node-es-module-loader/register.mts',
					'../src/index.ts',
					`--port=${MCP_WS_PORT}`,
				],
				cwd: dirname(fileURLToPath(import.meta.url)),
				env: {
					...process.env,
					NODE_NO_WARNINGS: '1',
				} as Record<string, string>,
			});
			const client = new Client({
				name: 'playwright-mcp-test',
				version: '1.0.0',
			});
			await client.connect(transport);
			await use(client);
			await client.close();
		},
		{ scope: 'worker' },
	],

	// Auto-fixture: loads the Playground website in a real browser.
	// The MCP bridge auto-connects via WebSocket and registers sites
	// from the Redux store. The bridge reconnects every 5s if dropped.
	playgroundPage: [
		async ({ browser, mcpClient }, use) => {
			const page = await browser.newPage();
			await page.goto(
				`http://127.0.0.1:5400/website-server/?mcp=yes&mcp-port=${MCP_WS_PORT}`
			);

			// Wait for WordPress to load inside the nested iframes
			await expect(
				page
					.frameLocator(
						'#playground-viewport:visible,.playground-viewport:visible'
					)
					.frameLocator('#wp')
					.locator('body')
			).not.toBeEmpty();

			// Wait for the MCP bridge to register at least one active
			// site. The Playground website may do internal navigation
			// after the initial load, causing the bridge to disconnect
			// and reconnect. We wait long enough for the connection to
			// stabilize.
			await waitForActiveSite(mcpClient);

			await use(page);
			await page.close();
		},
		{ scope: 'worker', auto: true },
	],

	siteId: async ({ mcpClient }, use) => {
		const siteId = await waitForActiveSite(mcpClient, 30_000);
		await use(siteId);
	},
});

function resultText(result: Awaited<ReturnType<Client['callTool']>>): string {
	return (result.content as Array<{ text: string }>)[0].text;
}

/**
 * Poll playground_list_sites until at least one active site is found
 * AND verify the site can actually handle commands. The MCP bridge
 * reconnects every 5s, so this may need to wait through a
 * disconnect/reconnect cycle. After finding an active site, we
 * verify it's operational by calling getCurrentURL — the
 * PlaygroundClient in the browser may not be ready immediately
 * after the site is registered.
 */
async function waitForActiveSite(
	client: Client,
	timeoutMs = 60_000,
	{ probe: shouldProbe = true } = {}
): Promise<string> {
	const start = Date.now();
	let lastError: Error | undefined;
	while (Date.now() - start < timeoutMs) {
		try {
			const result = await client.callTool({
				name: 'playground_list_sites',
				arguments: {},
			});
			const parsed = JSON.parse(resultText(result));
			if (parsed.connectedTabs === 0) {
				throw new Error('No browser connected yet');
			}
			const activeSite = parsed.sites.find((s) => s.isActive);
			if (!activeSite) {
				throw new Error('No active site yet');
			}
			const siteId = activeSite.siteId;
			if (shouldProbe) {
				// Verify the site can actually handle commands.
				// The PlaygroundClient may not be ready immediately
				// after the bridge registers the site.
				const probeResult = await client.callTool({
					name: 'playground_get_site_info',
					arguments: { siteId },
				});
				if (probeResult.isError) {
					throw new Error('Site not ready for commands yet');
				}
			}
			return siteId;
		} catch (error) {
			lastError = error as Error;
			await new Promise((r) => setTimeout(r, 2_000));
		}
	}
	throw lastError ?? new Error('Timeout waiting for active site');
}

test.afterEach(async ({ mcpClient, playgroundPage, browser }) => {
	let needsReset = false;

	for (const context of browser.contexts()) {
		for (const page of context.pages()) {
			if (page !== playgroundPage) {
				await page.close();
				needsReset = true;
			}
		}
	}

	if (!playgroundPage.url().includes('website-server')) {
		needsReset = true;
	}

	if (needsReset) {
		await playgroundPage.goto(
			`http://127.0.0.1:5400/website-server/?mcp=yes&mcp-port=${MCP_WS_PORT}`
		);
		await waitForActiveSite(mcpClient, 60_000, { probe: false });
	}
});

test('lists all 16 registered tools', async ({ mcpClient }) => {
	const result = await mcpClient.listTools();
	expect(result.tools).toHaveLength(16);
	const names = result.tools.map((t) => t.name).sort();
	expect(names).toEqual([
		'playground_delete_directory',
		'playground_delete_file',
		'playground_execute_php',
		'playground_file_exists',
		'playground_get_current_url',
		'playground_get_site_info',
		'playground_list_files',
		'playground_list_sites',
		'playground_mkdir',
		'playground_navigate',
		'playground_open_site',
		'playground_read_file',
		'playground_rename_site',
		'playground_request',
		'playground_save_site',
		'playground_write_file',
	]);
});

test('playground_list_sites includes playground url with mcp params', async ({
	mcpClient,
	siteId,
}) => {
	const result = await mcpClient.callTool({
		name: 'playground_list_sites',
		arguments: {},
	});
	const parsed = JSON.parse(resultText(result));
	const site = parsed.sites.find(
		(s: { siteId: string }) => s.siteId === siteId
	);
	expect(site).toBeDefined();
	expect(site.url).toMatch(new RegExp(`\\?mcp=yes&mcp-port=${MCP_WS_PORT}$`));
});

test('playground_open_site activates an inactive site in a new tab', async ({
	mcpClient,
	playgroundPage,
	siteId,
}) => {
	// Save the site so it persists in OPFS across page reloads
	await mcpClient.callTool({
		name: 'playground_save_site',
		arguments: { siteId },
	});

	// Reload the Playground without ?site-slug. This creates a
	// new temporary site (active) while loading the saved site
	// from OPFS (inactive).
	await playgroundPage.goto(
		`http://127.0.0.1:5400/website-server/?mcp=yes&mcp-port=${MCP_WS_PORT}`
	);
	await expect(
		playgroundPage
			.frameLocator(
				'#playground-viewport:visible,.playground-viewport:visible'
			)
			.frameLocator('#wp')
			.locator('body')
	).not.toBeEmpty();

	// Wait for the saved site to appear as inactive
	await expect
		.poll(
			async () => {
				const result = await mcpClient.callTool({
					name: 'playground_list_sites',
					arguments: {},
				});
				const parsed = JSON.parse(resultText(result));
				const site = parsed.sites.find((s) => s.siteId === siteId);
				return site?.isActive;
			},
			{ timeout: 30_000, intervals: [2_000] }
		)
		.toBe(false);

	// Open the inactive site — the browser calls window.open(),
	// a new tab loads, and the site becomes active.
	await mcpClient.callTool({
		name: 'playground_open_site',
		arguments: { siteId },
	});

	// Verify list_sites now reports the site as active
	await expect
		.poll(
			async () => {
				const result = await mcpClient.callTool({
					name: 'playground_list_sites',
					arguments: {},
				});
				const parsed = JSON.parse(resultText(result));
				const site = parsed.sites.find((s) => s.siteId === siteId);
				return site?.isActive;
			},
			{ timeout: 30_000, intervals: [2_000] }
		)
		.toBe(true);
});

test('playground_list_sites returns at least one site', async ({
	mcpClient,
	siteId,
}) => {
	const result = await mcpClient.callTool({
		name: 'playground_list_sites',
		arguments: {},
	});
	const parsed = JSON.parse(resultText(result));
	expect(parsed.connectedTabs).toBeGreaterThan(0);
	expect(parsed.sites.length).toBeGreaterThan(0);
	expect(parsed.sites.find((s) => s.siteId === siteId)).toBeTruthy();
});

test('playground_navigate goes to /wp-admin/', async ({
	mcpClient,
	siteId,
}) => {
	const result = await mcpClient.callTool({
		name: 'playground_navigate',
		arguments: { siteId, path: '/wp-admin/' },
	});
	const parsed = JSON.parse(resultText(result));
	expect(parsed.url).toContain('wp-admin');
});

test('playground_execute_php runs code and returns output', async ({
	mcpClient,
	siteId,
}) => {
	const result = await mcpClient.callTool({
		name: 'playground_execute_php',
		arguments: {
			siteId,
			code: '<?php echo "Hello from PHP " . phpversion();',
		},
	});
	const parsed = JSON.parse(resultText(result));
	expect(parsed.text).toContain('Hello from PHP');
	expect(parsed.exitCode).toBe(0);
});

test('playground_request fetches the homepage', async ({
	mcpClient,
	siteId,
}) => {
	const result = await mcpClient.callTool({
		name: 'playground_request',
		arguments: { siteId, url: '/wp-admin/' },
	});
	const parsed = JSON.parse(resultText(result));
	expect(parsed.httpStatusCode).toBe(200);
	expect(parsed.text).toContain('Dashboard');
});

test('playground_write_file, playground_read_file, and playground_delete_file', async ({
	mcpClient,
	siteId,
}) => {
	const testPath = '/wordpress/wp-content/e2e-test.txt';
	const testContent = `E2E test at ${Date.now()}`;

	const writeResult = await mcpClient.callTool({
		name: 'playground_write_file',
		arguments: { siteId, path: testPath, contents: testContent },
	});
	expect(JSON.parse(resultText(writeResult)).success).toBe(true);

	const readResult = await mcpClient.callTool({
		name: 'playground_read_file',
		arguments: { siteId, path: testPath },
	});
	expect(JSON.parse(resultText(readResult)).contents).toBe(testContent);

	await mcpClient.callTool({
		name: 'playground_delete_file',
		arguments: { siteId, path: testPath },
	});

	const readAfterDelete = await mcpClient.callTool({
		name: 'playground_read_file',
		arguments: { siteId, path: testPath },
	});
	expect(resultText(readAfterDelete)).toContain('Error');
});

test('playground_list_files lists the plugins directory', async ({
	mcpClient,
	siteId,
}) => {
	const result = await mcpClient.callTool({
		name: 'playground_list_files',
		arguments: { siteId, path: '/wordpress/' },
	});
	const parsed = JSON.parse(resultText(result));
	expect(parsed.files).toBeInstanceOf(Array);
	const files = parsed.files as string[];
	expect(files.length).toBeGreaterThan(0);
	expect(parsed.files).toContain('wp-content');
	expect(parsed.files).toContain('wp-load.php');
});

test('playground_mkdir creates and verifies a directory and playground_delete_directory removes it', async ({
	mcpClient,
	siteId,
}) => {
	const testDir = '/wordpress/wp-content/e2e-test-dir';

	const mkdirResult = await mcpClient.callTool({
		name: 'playground_mkdir',
		arguments: { siteId, path: testDir },
	});
	expect(JSON.parse(resultText(mkdirResult)).success).toBe(true);

	const listResult = await mcpClient.callTool({
		name: 'playground_list_files',
		arguments: { siteId, path: '/wordpress/wp-content' },
	});
	const files = JSON.parse(resultText(listResult)).files as string[];
	expect(files).toContain('e2e-test-dir');

	await mcpClient.callTool({
		name: 'playground_delete_directory',
		arguments: { siteId, path: testDir },
	});

	const listAfterDelete = await mcpClient.callTool({
		name: 'playground_list_files',
		arguments: { siteId, path: '/wordpress/wp-content' },
	});
	const filesAfterDelete = JSON.parse(resultText(listAfterDelete))
		.files as string[];
	expect(filesAfterDelete).not.toContain('e2e-test-dir');
});

test('playground_delete_directory with recursive=true removes a non-empty directory', async ({
	mcpClient,
	siteId,
}) => {
	const testDir = '/wordpress/wp-content/e2e-recursive-dir';
	const nestedFile = `${testDir}/subdir/nested.txt`;

	// Create a nested structure: e2e-recursive-dir/subdir/nested.txt
	await mcpClient.callTool({
		name: 'playground_mkdir',
		arguments: { siteId, path: `${testDir}/subdir` },
	});
	await mcpClient.callTool({
		name: 'playground_write_file',
		arguments: { siteId, path: nestedFile, contents: 'nested content' },
	});

	// Verify the file exists
	const readResult = await mcpClient.callTool({
		name: 'playground_read_file',
		arguments: { siteId, path: nestedFile },
	});
	expect(JSON.parse(resultText(readResult)).contents).toBe('nested content');

	// Recursive delete should remove the entire tree
	const deleteResult = await mcpClient.callTool({
		name: 'playground_delete_directory',
		arguments: { siteId, path: testDir, recursive: true },
	});
	expect(JSON.parse(resultText(deleteResult)).success).toBe(true);

	// Verify the directory is gone
	const listAfterDelete = await mcpClient.callTool({
		name: 'playground_list_files',
		arguments: { siteId, path: '/wordpress/wp-content' },
	});
	const filesAfterDelete = JSON.parse(resultText(listAfterDelete))
		.files as string[];
	expect(filesAfterDelete).not.toContain('e2e-recursive-dir');
});

test('playground_get_site_info returns WordPress details', async ({
	mcpClient,
	siteId,
}) => {
	const result = await mcpClient.callTool({
		name: 'playground_get_site_info',
		arguments: { siteId },
	});
	const parsed = JSON.parse(resultText(result));
	expect(parsed.wpVersion).toBeTruthy();
	expect(parsed.wpVersion).not.toBe('unknown');
	expect(parsed.phpVersion).toBeTruthy();
	expect(parsed.phpVersion).not.toBe('unknown');
	expect(parsed.documentRoot).toMatch('/wordpress');
	expect(parsed.siteUrl).toMatch(new RegExp(`http(.)+`));
});

test('playground_rename_site renames an active site', async ({
	mcpClient,
	siteId,
}) => {
	// Get the original name so we can restore it
	const listBefore = await mcpClient.callTool({
		name: 'playground_list_sites',
		arguments: {},
	});
	const originalName = JSON.parse(resultText(listBefore)).sites.find(
		(s) => s.siteId === siteId
	)?.name;

	const result = await mcpClient.callTool({
		name: 'playground_rename_site',
		arguments: { siteId, newName: 'E2E Renamed Site' },
	});
	expect(result.isError).toBeFalsy();
	const parsed = JSON.parse(resultText(result));
	expect(parsed.success).toBe(true);
	expect(parsed.newName).toBe('E2E Renamed Site');

	// Verify the name changed in list_sites
	const listAfter = await mcpClient.callTool({
		name: 'playground_list_sites',
		arguments: {},
	});
	const renamedSite = JSON.parse(resultText(listAfter)).sites.find(
		(s) => s.siteId === siteId
	);
	expect(renamedSite?.name).toBe('E2E Renamed Site');

	// Restore the original name
	if (originalName) {
		await mcpClient.callTool({
			name: 'playground_rename_site',
			arguments: { siteId, newName: originalName },
		});
	}
});

test('playground_save_site persists a temporary site', async ({
	mcpClient,
	siteId,
}) => {
	const result = await mcpClient.callTool({
		name: 'playground_save_site',
		arguments: { siteId },
	});
	expect(result.isError).toBeFalsy();
	const parsed = JSON.parse(resultText(result));
	expect(parsed.success).toBe(true);

	// Verify the site is now stored in opfs
	const listResult = await mcpClient.callTool({
		name: 'playground_list_sites',
		arguments: {},
	});
	const savedSite = JSON.parse(resultText(listResult)).sites.find(
		(s) => s.siteId === siteId
	);
	expect(savedSite?.storage).toBe('opfs');
});

test('playground_get_current_url returns a path', async ({
	mcpClient,
	siteId,
}) => {
	await mcpClient.callTool({
		name: 'playground_navigate',
		arguments: { siteId, path: '/wp-admin/' },
	});
	const result = await mcpClient.callTool({
		name: 'playground_get_current_url',
		arguments: { siteId },
	});
	const parsed = JSON.parse(resultText(result));
	expect(parsed.url).toBe('/wp-admin/');
});

test('playground_file_exists checks for wp-config.php', async ({
	mcpClient,
	siteId,
}) => {
	const result = await mcpClient.callTool({
		name: 'playground_file_exists',
		arguments: { siteId, path: '/wordpress/wp-config.php' },
	});
	const parsed = JSON.parse(resultText(result));
	expect(parsed.exists).toBe(true);

	const missing = await mcpClient.callTool({
		name: 'playground_file_exists',
		arguments: { siteId, path: '/wordpress/does-not-exist.txt' },
	});
	const missingParsed = JSON.parse(resultText(missing));
	expect(missingParsed.exists).toBe(false);
});

test('playground_list_sites reports no browser when page navigates away', async ({
	mcpClient,
	playgroundPage,
}) => {
	await playgroundPage.goto('about:blank');
	await expect
		.poll(
			async () => {
				const result = await mcpClient.callTool({
					name: 'playground_list_sites',
					arguments: {},
				});
				const parsed = JSON.parse(resultText(result));
				return parsed.connectedTabs;
			},
			{ timeout: 15_000, intervals: [1_000] }
		)
		.toBe(0);
});

test('playground_list_sites reports connected but no sites when browser has no playground tab', async ({
	mcpClient,
	playgroundPage,
	browser,
}) => {
	// Disconnect the real Playground bridge
	await playgroundPage.goto('about:blank');
	await expect
		.poll(
			async () => {
				const result = await mcpClient.callTool({
					name: 'playground_list_sites',
					arguments: {},
				});
				return JSON.parse(resultText(result)).connectedTabs;
			},
			{ timeout: 15_000, intervals: [1_000] }
		)
		.toBe(0);

	// Open a bare page and connect a WebSocket that registers
	// with zero sites — simulating a browser tab that has no
	// Playground loaded.
	const wsPort = MCP_WS_PORT;
	const fakePage = await browser.newPage();
	// Navigate to an allowed origin so the WebSocket connection
	// passes the origin check in the bridge server.
	await fakePage.goto(`http://127.0.0.1:5400`);
	await fakePage.evaluate(async (port) => {
		// Fetch the session token before connecting
		const res = await fetch(`http://127.0.0.1:${port}/bridge-token`);
		const { token } = await res.json();

		return new Promise<void>((resolve, reject) => {
			const ws = new WebSocket(`ws://127.0.0.1:${port}?token=${token}`);
			ws.addEventListener('open', () => {
				ws.send(
					JSON.stringify({
						type: 'register',
						tabId: 'test-empty-tab',
						sites: [],
					})
				);
				resolve();
			});
			ws.addEventListener('error', () =>
				reject(new Error('WebSocket failed'))
			);
		});
	}, wsPort);

	await expect
		.poll(
			async () => {
				const result = await mcpClient.callTool({
					name: 'playground_list_sites',
					arguments: {},
				});
				const parsed = JSON.parse(resultText(result));
				return {
					connectedTabs: parsed.connectedTabs,
					siteCount: parsed.sites.length,
				};
			},
			{ timeout: 15_000, intervals: [1_000] }
		)
		.toEqual({ connectedTabs: 1, siteCount: 0 });
});

test('rejects WebSocket connections without a valid token', async ({
	mcpClient,
}) => {
	// Verify the bridge is running
	const tools = await mcpClient.listTools();
	expect(tools.tools.length).toBeGreaterThan(0);

	// Try connecting without a token — should be rejected.
	// The server rejects during the HTTP upgrade with 401,
	// which the ws library surfaces as an 'unexpected-response'
	// event (or an error + close).
	const ws = new WebSocket(`ws://127.0.0.1:${MCP_WS_PORT}`);
	const rejected = new Promise<void>((resolve) => {
		ws.on('unexpected-response', (_req, res) => {
			expect(res.statusCode).toBe(401);
			resolve();
		});
	});

	await rejected;
});
