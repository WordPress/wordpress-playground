/**
 * Shared tool executor functions.
 *
 * Both the MCP server and WebMCP call these executors so that tool
 * output shapes are defined in exactly one place.  Each transport
 * provides its own ToolClient implementation that normalises I/O
 * differences (e.g. byte decoding).
 */

import type { PlaygroundClient } from '@wp-playground/remote';
import type { PHPRequest } from '@php-wasm/universal';

/**
 * Minimal client interface consumed by tool executors.
 *
 * - WebMCP implements this by wrapping PlaygroundClient (decoding
 *   response bytes via TextDecoder).
 * - The MCP server implements this by wrapping bridge.sendCommand
 *   (bytes are already decoded at the bridge-client boundary).
 */
export interface ToolClient {
	run(options: {
		code: string;
	}): Promise<{ text: string; errors: string; exitCode: number }>;
	request(options: {
		url: string;
		method: string;
		headers?: Record<string, string>;
		body?: string;
	}): Promise<{
		text: string;
		httpStatusCode: number;
		headers: Record<string, string[]>;
	}>;
	goTo(path: string): Promise<void>;
	getCurrentURL(): Promise<string>;
	readFileAsText(path: string): Promise<string>;
	writeFile(path: string, contents: string): Promise<void>;
	listFiles(path: string): Promise<string[]>;
	mkdirTree(path: string): Promise<void>;
	unlink(path: string): Promise<void>;
	rmdir(path: string, options: { recursive: boolean }): Promise<void>;
	fileExists(path: string): Promise<boolean>;
}

export interface SiteInfo {
	url: string;
	documentRoot: string;
	siteUrl: string;
	wpVersion: string;
	phpVersion: string;
}

async function executeSiteInfo(client: ToolClient): Promise<SiteInfo> {
	const [url, infoText] = await Promise.all([
		client.getCurrentURL(),
		client
			.run({
				code: `<?php
			require_once "/wordpress/wp-load.php";
			echo json_encode([
				"documentRoot" => ABSPATH,
				"wpVersion" => get_bloginfo("version"),
				"siteUrl" => get_site_url(),
				"phpVersion" => phpversion(),
			]);`,
			})
			.then((resp) => resp.text),
	]);

	let info: Partial<Omit<SiteInfo, 'url'>>;
	try {
		info = JSON.parse(infoText);
	} catch {
		info = {};
	}

	return {
		url: String(url),
		documentRoot: info.documentRoot ?? '/wordpress',
		siteUrl: info.siteUrl ?? String(url),
		wpVersion: info.wpVersion ?? 'unknown',
		phpVersion: info.phpVersion ?? 'unknown',
	};
}

export const toolExecutors: Record<
	string,
	(client: ToolClient, input: Record<string, unknown>) => Promise<unknown>
> = {
	playground_execute_php: (client, input) =>
		client.run({ code: input['code'] as string }),

	playground_request: async (client, input) => {
		const options: {
			url: string;
			method: string;
			headers?: Record<string, string>;
			body?: string;
		} = {
			url: input['url'] as string,
			method: (input['method'] as string) ?? 'GET',
		};
		if (input['headers']) {
			options.headers = input['headers'] as Record<string, string>;
		}
		if (input['body']) {
			options.body = input['body'] as string;
		}
		return await client.request(options);
	},

	playground_navigate: async (client, input) => {
		await client.goTo(input['path'] as string);
		return { url: await client.getCurrentURL() };
	},

	playground_get_current_url: async (client) => ({
		url: await client.getCurrentURL(),
	}),

	playground_get_site_info: (client): Promise<SiteInfo> =>
		executeSiteInfo(client),

	playground_read_file: async (client, input) => ({
		contents: await client.readFileAsText(input['path'] as string),
	}),

	playground_write_file: async (client, input) => {
		await client.writeFile(
			input['path'] as string,
			input['contents'] as string
		);
		return { success: true };
	},

	playground_list_files: async (client, input) => ({
		files: await client.listFiles(input['path'] as string),
	}),

	playground_mkdir: async (client, input) => {
		await client.mkdirTree(input['path'] as string);
		return { success: true };
	},

	playground_delete_file: async (client, input) => {
		await client.unlink(input['path'] as string);
		return { success: true };
	},

	playground_delete_directory: async (client, input) => {
		await client.rmdir(input['path'] as string, {
			recursive: (input['recursive'] as boolean) ?? false,
		});
		return { success: true };
	},

	playground_file_exists: async (client, input) => ({
		exists: await client.fileExists(input['path'] as string),
	}),
};

/**
 * Wrap a PlaygroundClient as a ToolClient.
 *
 * Most methods pass through directly. Only `run` and `request`
 * are intercepted to decode PHP/HTTP response bytes into plain
 * strings via TextDecoder.
 */
export function createToolClient(client: PlaygroundClient): ToolClient {
	const decoder = new TextDecoder();
	const overrides: Partial<ToolClient> = {
		async run(options) {
			const resp = await client.run(options);
			return {
				text: decoder.decode(resp.bytes),
				errors: resp.errors,
				exitCode: resp.exitCode,
			};
		},
		async request(options) {
			const resp = await client.request({
				url: options.url,
				method: options.method as PHPRequest['method'],
				headers: options.headers,
				body: options.body,
			});
			return {
				text: decoder.decode(resp.bytes),
				httpStatusCode: resp.httpStatusCode,
				headers: resp.headers,
			};
		},
	};
	return new Proxy(client as unknown as ToolClient, {
		get: (target, prop: string) => {
			const override = (overrides as Record<string, unknown>)[prop];
			if (override !== undefined) {
				return override;
			}
			const val = (target as unknown as Record<string, unknown>)[prop];
			return typeof val === 'function' ? val.bind(target) : val;
		},
	});
}
