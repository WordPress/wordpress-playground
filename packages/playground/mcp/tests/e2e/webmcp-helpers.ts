import type { Page } from '@playwright/test';

/**
 * WebMCP (document.modelContext) is only available in Chrome behind
 * chrome://flags/#enable-webmcp-testing. Playwright uses a stock Chromium that
 * doesn't expose the API, so this init script stands in for the browser's
 * registry. It captures registered tools on `window.__webmcpTools` and
 * exposes their `execute()` on `window.__webmcpExecutors`.
 */
export function webmcpMock() {
	const registeredTools: Array<{
		name: string;
		description: string;
		inputSchema?: { required?: string[] };
		execute: (input: Record<string, unknown>) => Promise<unknown>;
	}> = [];
	(window as any).__webmcpTools = registeredTools;
	(window as any).__webmcpExecutors = {};

	Object.defineProperty(document as any, 'modelContext', {
		configurable: true,
		value: {
			get tools() {
				return registeredTools;
			},
			async registerTool(
				tool: (typeof registeredTools)[0],
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
}

/**
 * Requests access to the active site the way an agent would, approves it in
 * Playground's dialog, and makes `window.__webmcpExecutors` pass the site ID
 * and grant to every tool that needs them.
 */
export async function grantActiveSiteAccess(page: Page) {
	const siteId: string = await page.evaluate(async () => {
		const { sites } = await (
			window as any
		).__webmcpExecutors.playground_list_sites({});
		return sites.find((site: { isActive: boolean }) => site.isActive)
			.siteId;
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
	if (typeof grant !== 'string') {
		throw new Error('Site access was not granted.');
	}
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
	return { siteId, grant };
}
