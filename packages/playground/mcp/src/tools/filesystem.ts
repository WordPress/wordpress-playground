import { z } from 'zod/v3';
import { siteIdSchema, errorResult } from './utils';
import type { ToolRegistrar } from './utils';

export const registerFilesystemTools: ToolRegistrar = (server, bridge) => {
	const sendCommand = bridge.sendCommand.bind(bridge);

	server.registerTool(
		'playground_read_file',
		{
			title: 'Read File',
			description:
				'Read a file from the WordPress virtual filesystem. ' +
				'Returns the file contents as text.',
			inputSchema: {
				siteId: siteIdSchema,
				path: z
					.string()
					.describe(
						'Absolute path to the file, e.g. ' +
							'"/wordpress/wp-config.php"'
					),
			},
			annotations: {
				readOnlyHint: true,
				destructiveHint: false,
				openWorldHint: false,
			},
		},
		async ({ siteId, path }) => {
			try {
				const contents = await sendCommand(siteId, 'readFileAsText', [
					path,
				]);
				return {
					content: [
						{
							type: 'text' as const,
							text: JSON.stringify({
								contents: String(contents),
							}),
						},
					],
				};
			} catch (error) {
				return errorResult('Error reading file', error);
			}
		}
	);

	server.registerTool(
		'playground_write_file',
		{
			title: 'Write File',
			description:
				'Write content to a file in the WordPress virtual ' +
				'filesystem. Creates the file if it does not exist. ' +
				'If the file already exists, its entire contents are ' +
				'replaced — existing data is permanently lost. ' +
				'Parent directories are NOT created automatically — ' +
				'call playground_mkdir first if needed.',
			inputSchema: {
				siteId: siteIdSchema,
				path: z
					.string()
					.describe(
						'Absolute path to write to, e.g. ' +
							'"/wordpress/wp-content/test.txt"'
					),
				contents: z.string().describe('File contents to write'),
			},
			annotations: {
				readOnlyHint: false,
				destructiveHint: true,
				idempotentHint: false,
				openWorldHint: false,
			},
		},
		async ({ siteId, path, contents }) => {
			try {
				await sendCommand(siteId, 'writeFile', [path, contents]);
				return {
					content: [
						{
							type: 'text' as const,
							text: JSON.stringify({ success: true }),
						},
					],
				};
			} catch (error) {
				return errorResult('Error writing file', error);
			}
		}
	);

	server.registerTool(
		'playground_list_files',
		{
			title: 'List Files',
			description:
				'List files and directories at a given path in the ' +
				'WordPress virtual filesystem.',
			inputSchema: {
				siteId: siteIdSchema,
				path: z
					.string()
					.describe(
						'Absolute path to list, e.g. ' +
							'"/wordpress/wp-content/plugins"'
					),
			},
			annotations: {
				readOnlyHint: true,
				destructiveHint: false,
				openWorldHint: false,
			},
		},
		async ({ siteId, path }) => {
			try {
				const files = await sendCommand(siteId, 'listFiles', [path]);
				return {
					content: [
						{
							type: 'text' as const,
							text: JSON.stringify({
								files: files as string[],
							}),
						},
					],
				};
			} catch (error) {
				return errorResult('Error listing files', error);
			}
		}
	);

	server.registerTool(
		'playground_mkdir',
		{
			title: 'Create Directory',
			description:
				'Create a directory (and parent directories) in the ' +
				'WordPress virtual filesystem.',
			inputSchema: {
				siteId: siteIdSchema,
				path: z
					.string()
					.describe(
						'Absolute path of directory to create, e.g. ' +
							'"/wordpress/wp-content/my-plugin"'
					),
			},
			annotations: {
				readOnlyHint: false,
				destructiveHint: false,
				idempotentHint: true,
				openWorldHint: false,
			},
		},
		async ({ siteId, path }) => {
			try {
				await sendCommand(siteId, 'mkdirTree', [path]);
				return {
					content: [
						{
							type: 'text' as const,
							text: JSON.stringify({ success: true }),
						},
					],
				};
			} catch (error) {
				return errorResult('Error creating directory', error);
			}
		}
	);

	server.registerTool(
		'playground_delete_file',
		{
			title: 'Delete File',
			description: 'Delete a file from the WordPress virtual filesystem.',
			inputSchema: {
				siteId: siteIdSchema,
				path: z.string().describe('Absolute path of file to delete'),
			},
			annotations: {
				readOnlyHint: false,
				destructiveHint: true,
				idempotentHint: false,
				openWorldHint: false,
			},
		},
		async ({ siteId, path }) => {
			try {
				await sendCommand(siteId, 'unlink', [path]);
				return {
					content: [
						{
							type: 'text' as const,
							text: JSON.stringify({ success: true }),
						},
					],
				};
			} catch (error) {
				return errorResult('Error deleting file', error);
			}
		}
	);

	server.registerTool(
		'playground_delete_directory',
		{
			title: 'Delete Directory',
			description:
				'Delete a directory from the WordPress virtual ' +
				'filesystem. When recursive is false (the default), ' +
				'the directory must be empty or the call will fail ' +
				'with an error. Set recursive=true to delete a ' +
				'directory and all its contents.',
			inputSchema: {
				siteId: siteIdSchema,
				path: z
					.string()
					.describe('Absolute path of directory to delete'),
				recursive: z
					.boolean()
					.optional()
					.default(false)
					.describe(
						'If true, delete directory and all contents. ' +
							'If false (default), fails on non-empty ' +
							'directories.'
					),
			},
			annotations: {
				readOnlyHint: false,
				destructiveHint: true,
				idempotentHint: false,
				openWorldHint: false,
			},
		},
		async ({ siteId, path, recursive }) => {
			try {
				await sendCommand(siteId, 'rmdir', [path, { recursive }]);
				return {
					content: [
						{
							type: 'text' as const,
							text: JSON.stringify({ success: true }),
						},
					],
				};
			} catch (error) {
				return errorResult('Error deleting directory', error);
			}
		}
	);
};
