import { z } from 'zod/v3';
import {
	siteIdSchema,
	errorResult,
	decodeResponseBytes,
	paramsToZodSchema,
} from './utils';
import type { SerializedPHPResponse, ToolRegistrar } from './utils';
import {
	toolDefinitions,
	siteToolDefinitions,
	presentStorage,
	executeSiteInfo,
} from './tool-definitions';

export const registerMcpServerTools: ToolRegistrar = (server, bridge) => {
	const sendCommand = bridge.sendCommand.bind(bridge);

	// -- Site management tools --
	// These operate on the bridge itself, not on a PlaygroundClient.
	// Definitions are shared with WebMCP via siteToolDefinitions.

	const listSites = siteToolDefinitions['playground_list_sites'];
	server.registerTool(
		listSites.name,
		{
			title: listSites.title,
			description: listSites.description,
			inputSchema: z.object({}),
			annotations: listSites.annotations,
		},
		async () => {
			const tabCount = bridge.getTabCount();
			const sites = bridge.listSites();
			if (sites.length === 0) {
				return {
					content: [
						{
							type: 'text' as const,
							text: JSON.stringify({
								connectedTabs: tabCount,
								sites: [],
								message: bridge.isConnected()
									? 'No sites are loaded.'
									: 'No browser connected. Open the Playground website at https://playground.wordpress.net to connect.',
							}),
						},
					],
				};
			}
			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify({
							connectedTabs: tabCount,
							sites: sites.map((s) => ({
								siteId: s.siteId,
								name: s.name,
								storage: s.storage,
								isActive: s.isActive,
							})),
						}),
					},
				],
			};
		}
	);

	const openSite = siteToolDefinitions['playground_open_site'];
	server.registerTool(
		openSite.name,
		{
			title: openSite.title,
			description: openSite.description,
			inputSchema: {
				siteId: siteIdSchema,
			},
			annotations: openSite.annotations,
		},
		async ({ siteId }) => {
			try {
				await bridge.sendCommand(siteId, '__open_site');
				const site = await bridge.waitForSiteActive(siteId, 30000);
				return {
					content: [
						{
							type: 'text' as const,
							text: JSON.stringify({
								siteId,
								name: site.siteName,
								isActive: true,
							}),
						},
					],
				};
			} catch (error) {
				return errorResult('Error opening site', error);
			}
		}
	);

	const renameSite = siteToolDefinitions['playground_rename_site'];
	server.registerTool(
		renameSite.name,
		{
			title: renameSite.title,
			description: renameSite.description,
			inputSchema: paramsToZodSchema(renameSite.params),
			annotations: renameSite.annotations,
		},
		async ({ siteId, newName }) => {
			try {
				await bridge.sendCommand(siteId, '__rename_site', [newName]);
				return {
					content: [
						{
							type: 'text' as const,
							text: JSON.stringify({
								success: true,
								siteId,
								newName,
							}),
						},
					],
				};
			} catch (error) {
				return errorResult('Error renaming site', error);
			}
		}
	);

	const saveSite = siteToolDefinitions['playground_save_site'];
	server.registerTool(
		saveSite.name,
		{
			title: saveSite.title,
			description: saveSite.description,
			inputSchema: {
				siteId: siteIdSchema,
			},
			annotations: saveSite.annotations,
		},
		async ({ siteId }) => {
			try {
				const sites = bridge.listSites();
				const site = sites.find((s) => s.siteId === siteId);
				if (!site) {
					return errorResult(
						'Error saving site',
						new Error(`Unknown site: ${siteId}`)
					);
				}
				if (site.storage !== 'temporary') {
					return {
						content: [
							{
								type: 'text' as const,
								text: JSON.stringify({
									success: true,
									alreadySaved: true,
									siteId,
									name: site.name,
									storage: site.storage,
								}),
							},
						],
					};
				}
				const result = (await bridge.sendCommand(
					siteId,
					'__save_site'
				)) as { slug: string; storage: string };
				return {
					content: [
						{
							type: 'text' as const,
							text: JSON.stringify({
								success: true,
								alreadySaved: false,
								siteId,
								name: site.name,
								storage: presentStorage(result.storage),
							}),
						},
					],
				};
			} catch (error) {
				return errorResult('Error saving site', error);
			}
		}
	);

	// -- Filesystem tools --

	const readFile = toolDefinitions['playground_read_file'];
	server.registerTool(
		readFile.name,
		{
			title: readFile.title,
			description: readFile.description,
			inputSchema: paramsToZodSchema(readFile.params),
			annotations: readFile.annotations,
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

	const writeFile = toolDefinitions['playground_write_file'];
	server.registerTool(
		writeFile.name,
		{
			title: writeFile.title,
			description: writeFile.description,
			inputSchema: paramsToZodSchema(writeFile.params),
			annotations: writeFile.annotations,
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

	const listFiles = toolDefinitions['playground_list_files'];
	server.registerTool(
		listFiles.name,
		{
			title: listFiles.title,
			description: listFiles.description,
			inputSchema: paramsToZodSchema(listFiles.params),
			annotations: listFiles.annotations,
		},
		async ({ siteId, path }) => {
			try {
				const files = await sendCommand(siteId, 'listFiles', [path]);
				return {
					content: [
						{
							type: 'text' as const,
							text: JSON.stringify({ files }),
						},
					],
				};
			} catch (error) {
				return errorResult('Error listing files', error);
			}
		}
	);

	const mkdirTool = toolDefinitions['playground_mkdir'];
	server.registerTool(
		mkdirTool.name,
		{
			title: mkdirTool.title,
			description: mkdirTool.description,
			inputSchema: paramsToZodSchema(mkdirTool.params),
			annotations: mkdirTool.annotations,
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

	const deleteFile = toolDefinitions['playground_delete_file'];
	server.registerTool(
		deleteFile.name,
		{
			title: deleteFile.title,
			description: deleteFile.description,
			inputSchema: paramsToZodSchema(deleteFile.params),
			annotations: deleteFile.annotations,
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

	const deleteDirectory = toolDefinitions['playground_delete_directory'];
	server.registerTool(
		deleteDirectory.name,
		{
			title: deleteDirectory.title,
			description: deleteDirectory.description,
			inputSchema: paramsToZodSchema(deleteDirectory.params),
			annotations: deleteDirectory.annotations,
		},
		async ({ siteId, path, recursive }) => {
			try {
				await sendCommand(siteId, 'rmdir', [
					path,
					{ recursive: recursive ?? false },
				]);
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

	const fileExists = toolDefinitions['playground_file_exists'];
	server.registerTool(
		fileExists.name,
		{
			title: fileExists.title,
			description: fileExists.description,
			inputSchema: paramsToZodSchema(fileExists.params),
			annotations: fileExists.annotations,
		},
		async ({ siteId, path }) => {
			try {
				const exists = await sendCommand(siteId, 'fileExists', [path]);
				return {
					content: [
						{
							type: 'text' as const,
							text: JSON.stringify({ exists }),
						},
					],
				};
			} catch (error) {
				return errorResult('Error checking file existence', error);
			}
		}
	);

	// -- Code execution tools --

	const executePHP = toolDefinitions['playground_execute_php'];
	const request = toolDefinitions['playground_request'];

	server.registerTool(
		executePHP.name,
		{
			title: executePHP.title,
			description: executePHP.description,
			inputSchema: paramsToZodSchema(executePHP.params),
			annotations: executePHP.annotations,
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
		request.name,
		{
			title: request.title,
			description: request.description,
			inputSchema: paramsToZodSchema(request.params),
			annotations: request.annotations,
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

	// -- Navigation tools --

	const navigateTool = toolDefinitions['playground_navigate'];
	const getCurrentUrlTool = toolDefinitions['playground_get_current_url'];
	const siteInfoTool = toolDefinitions['playground_get_site_info'];

	server.registerTool(
		navigateTool.name,
		{
			title: navigateTool.title,
			description: navigateTool.description,
			inputSchema: paramsToZodSchema(navigateTool.params),
			annotations: navigateTool.annotations,
		},
		async ({ siteId, path }) => {
			try {
				await sendCommand(siteId, 'goTo', [path]);
				const url = await sendCommand(siteId, 'getCurrentURL');
				return {
					content: [
						{
							type: 'text' as const,
							text: JSON.stringify({ url }),
						},
					],
				};
			} catch (error) {
				return errorResult('Error navigating', error);
			}
		}
	);

	server.registerTool(
		getCurrentUrlTool.name,
		{
			title: getCurrentUrlTool.title,
			description: getCurrentUrlTool.description,
			inputSchema: paramsToZodSchema(getCurrentUrlTool.params),
			annotations: getCurrentUrlTool.annotations,
		},
		async ({ siteId }) => {
			try {
				const url = await sendCommand(siteId, 'getCurrentURL');
				return {
					content: [
						{
							type: 'text' as const,
							text: JSON.stringify({ url }),
						},
					],
				};
			} catch (error) {
				return errorResult('Error getting current URL', error);
			}
		}
	);

	server.registerTool(
		siteInfoTool.name,
		{
			title: siteInfoTool.title,
			description: siteInfoTool.description,
			inputSchema: paramsToZodSchema(siteInfoTool.params),
			annotations: siteInfoTool.annotations,
		},
		async ({ siteId }) => {
			try {
				const info = await executeSiteInfo(
					async (code) => {
						const resp = (await sendCommand(siteId, 'run', [
							{ code },
						])) as SerializedPHPResponse;
						return decodeResponseBytes(resp.bytes);
					},
					() =>
						sendCommand(siteId, 'getCurrentURL') as Promise<string>
				);
				return {
					content: [
						{
							type: 'text' as const,
							text: JSON.stringify(info),
						},
					],
				};
			} catch (error) {
				return errorResult('Error getting site info', error);
			}
		}
	);
};
