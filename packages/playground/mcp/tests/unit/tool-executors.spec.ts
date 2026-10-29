import { describe, expect, it, vi } from 'vitest';
import type { PlaygroundClient } from '@wp-playground/remote';
import {
	createToolClient,
	toolExecutors,
} from '../../src/tools/tool-executors';
import type { ToolClient } from '../../src/tools/tool-executors';

describe('toolExecutors', () => {
	// Contract: cancellation during nonce preparation prevents the later REST
	// mutation and still removes the temporary file. The nonce helper and final
	// request are independent asynchronous stages that could ignore the signal.
	it('stops a cancelled REST request after nonce preparation and cleans up', async () => {
		const controller = new AbortController();
		let finishNonce!: (response: {
			text: string;
			httpStatusCode: number;
			headers: Record<string, string[]>;
		}) => void;
		let nonceStarted!: () => void;
		const started = new Promise<void>((resolve) => {
			nonceStarted = resolve;
		});
		const request = vi.fn<ToolClient['request']>(
			() =>
				new Promise<{
					text: string;
					httpStatusCode: number;
					headers: Record<string, string[]>;
				}>((resolve) => {
					finishNonce = resolve;
					nonceStarted();
				})
		);
		const unlink = vi.fn(async () => undefined);
		const result = toolExecutors['playground_request'](
			createStubToolClient({ request, unlink }),
			{ url: '/wp-json/wp/v2/posts/123', method: 'DELETE' },
			controller.signal
		);
		await started;
		controller.abort();
		finishNonce({ text: 'nonce', httpStatusCode: 200, headers: {} });

		await expect(result).rejects.toMatchObject({ name: 'AbortError' });
		expect(request).toHaveBeenCalledTimes(1);
		expect(request.mock.calls[0][0]).toMatchObject({ method: 'GET' });
		expect(unlink).toHaveBeenCalledTimes(1);
	});

	it('serializes object request bodies', async () => {
		const requests: Array<{
			url: string;
			method: string;
			headers?: Record<string, string>;
			body?: string;
		}> = [];
		const client = createStubToolClient({
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

describe('createToolClient listEmails', () => {
	// The MCP bridge relays tool results as JSON over a WebSocket, so
	// captured emails must be condensed browser-side: attachment bytes
	// dropped, addresses flattened to strings.
	it('summarizes captured emails into JSON-serializable data', async () => {
		const playgroundClient = {
			email: async () => [
				{
					headers: [],
					headerLines: [],
					from: {
						name: 'WordPress',
						address: 'wordpress@playground.test',
					},
					to: [{ name: '', address: 'admin@playground.test' }],
					subject: 'Password Reset',
					date: '2026-09-16T00:00:00.000Z',
					text: 'Click the link.',
					attachments: [
						{
							filename: 'logo.png',
							mimeType: 'image/png',
							disposition: 'attachment',
							content: new ArrayBuffer(1024),
						},
					],
				},
			],
		} as unknown as PlaygroundClient;

		const result = await toolExecutors['playground_list_emails'](
			createToolClient(playgroundClient),
			{}
		);

		expect(result).toEqual({
			emails: [
				{
					from: 'WordPress <wordpress@playground.test>',
					to: ['admin@playground.test'],
					cc: undefined,
					subject: 'Password Reset',
					date: '2026-09-16T00:00:00.000Z',
					text: 'Click the link.',
					html: undefined,
					attachments: [
						{
							filename: 'logo.png',
							mimeType: 'image/png',
							size: 1024,
						},
					],
				},
			],
		});
		expect(() => JSON.stringify(result)).not.toThrow();
	});
});

function createStubToolClient(overrides: Partial<ToolClient>): ToolClient {
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
		listEmails: async () => [],
		...overrides,
	};
}
