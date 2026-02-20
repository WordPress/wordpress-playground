import { z } from 'zod/v3';
import { siteIdSchema, errorResult, decodeResponseBytes } from './utils';
import type { SerializedPHPResponse, ToolRegistrar } from './utils';

export const registerCodeExecutionTools: ToolRegistrar = (server, bridge) => {
	const sendCommand = bridge.sendCommand.bind(bridge);

	server.registerTool(
		'playground_execute_php',
		{
			title: 'Execute PHP Code',
			description:
				'Run arbitrary PHP code in WordPress Playground and ' +
				'return the output. WordPress is NOT bootstrapped ' +
				'automatically — to use WP functions, start your ' +
				'code with: require("/wordpress/wp-load.php"); ' +
				'Always include the opening <?php tag. ' +
				'The response JSON contains three fields: "text" ' +
				'(stdout output), "errors" (PHP warnings, notices, ' +
				'and fatal error messages from stderr), and ' +
				'"exitCode" (0 on success, non-zero on fatal error). ' +
				'Check both "errors" and "exitCode" to determine ' +
				'whether the call succeeded. ' +
				'Warning: output is returned in full with no ' +
				'truncation — avoid queries that produce unbounded ' +
				'output (e.g. SELECT * without LIMIT). Keep output ' +
				'under 50 KB to avoid filling the context window.',
			inputSchema: {
				siteId: siteIdSchema,
				code: z
					.string()
					.describe(
						'PHP code to execute. ' +
							'Example: "<?php echo get_bloginfo(\'name\');"'
					),
			},
			annotations: {
				readOnlyHint: false,
				destructiveHint: true,
				idempotentHint: false,
				openWorldHint: true,
			},
		},
		async ({ siteId, code }) => {
			try {
				const response = (await sendCommand(siteId, 'run', [
					{ code },
				])) as SerializedPHPResponse;
				const text = decodeResponseBytes(response.bytes);
				return {
					content: [
						{
							type: 'text' as const,
							text: JSON.stringify({
								text,
								errors: response.errors,
								exitCode: response.exitCode,
							}),
						},
					],
				};
			} catch (error) {
				return errorResult('Error executing PHP', error);
			}
		}
	);

	server.registerTool(
		'playground_request',
		{
			title: 'HTTP Request',
			description:
				'Make an HTTP request to the WordPress site running ' +
				'in Playground. Requests are authenticated ' +
				"automatically via the browser session's cookie " +
				'store. Use this only when testing HTTP-level ' +
				'behavior: response codes, redirects, cookies, or ' +
				'form submissions. Note that full HTML responses ' +
				'can be very large. Prefer playground_execute_php ' +
				'for inspecting WordPress data (options, plugins, ' +
				'posts, etc.) — it returns only what you echo and ' +
				'is much leaner. To change the URL the user sees ' +
				'in their tab, use playground_navigate instead.',
			inputSchema: {
				siteId: siteIdSchema,
				url: z
					.string()
					.describe(
						'Request URL path, e.g. "/wp-json/wp/v2/posts" ' +
							'or "/wp-admin/plugins.php"'
					),
				method: z
					.string()
					.optional()
					.default('GET')
					.describe(
						'HTTP method (GET, POST, PUT, DELETE, etc.). Defaults to GET.'
					),
				headers: z
					.record(z.string(), z.string())
					.optional()
					.describe('Request headers as key-value pairs'),
				body: z
					.string()
					.optional()
					.describe('Request body (for POST/PUT requests)'),
			},
			annotations: {
				readOnlyHint: false,
				destructiveHint: false,
				idempotentHint: false,
				openWorldHint: true,
			},
		},
		async ({ siteId, url, method, headers, body }) => {
			try {
				const requestOptions: Record<string, unknown> = {
					url,
					method,
				};
				if (headers) {
					requestOptions['headers'] = headers;
				}
				if (body) {
					requestOptions['body'] = body;
				}
				const response = (await sendCommand(siteId, 'request', [
					requestOptions,
				])) as SerializedPHPResponse;
				const text = decodeResponseBytes(response.bytes);
				return {
					content: [
						{
							type: 'text' as const,
							text: JSON.stringify({
								text,
								httpStatusCode: response.httpStatusCode,
								headers: response.headers,
							}),
						},
					],
				};
			} catch (error) {
				return errorResult('Error making request', error);
			}
		}
	);
};
