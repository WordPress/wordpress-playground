import { describe, expect, it } from 'vitest';
import { toolExecutors } from '../../src/tools/tool-executors';
import type { ToolClient } from '../../src/tools/tool-executors';

describe('toolExecutors', () => {
	it('serializes object request bodies', async () => {
		const requests: Array<{
			url: string;
			method: string;
			headers?: Record<string, string>;
			body?: string;
		}> = [];
		const client = createToolClient({
			request: async (options) => {
				requests.push(options);
				return {
					text: options.url.includes('mcp-nonce-') ? 'nonce' : '{}',
					httpStatusCode: 200,
					headers: {},
				};
			},
		});

		await toolExecutors['playground_request'](client, {
			url: '/wp-json/wp/v2/posts',
			method: 'POST',
			body: {
				title: 'Object Body Test',
				status: 'publish',
			},
		});

		expect(requests.at(-1)).toMatchObject({
			url: '/wp-json/wp/v2/posts',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-WP-Nonce': 'nonce',
			},
			body: JSON.stringify({
				title: 'Object Body Test',
				status: 'publish',
			}),
		});
	});
});

function createToolClient(overrides: Partial<ToolClient>): ToolClient {
	return {
		run: async () => ({ text: '', errors: '', exitCode: 0 }),
		request: async () => ({ text: '', httpStatusCode: 200, headers: {} }),
		goTo: async () => undefined,
		getCurrentURL: async () => '/',
		readFileAsText: async () => '',
		writeFile: async () => undefined,
		listFiles: async () => [],
		mkdirTree: async () => undefined,
		unlink: async () => undefined,
		rmdir: async () => undefined,
		fileExists: async () => false,
		...overrides,
	};
}
