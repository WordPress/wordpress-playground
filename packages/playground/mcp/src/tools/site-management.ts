import { z } from 'zod';
import { presentStorage } from '../bridge-server';
import { siteIdSchema, errorResult, decodeResponseBytes } from './utils';
import type { SerializedPHPResponse, ToolRegistrar } from './utils';

export const registerSiteManagementTools: ToolRegistrar = (server, bridge) => {
	const sendCommand = bridge.sendCommand.bind(bridge);
	server.registerTool(
		'playground_list_sites',
		{
			title: 'List Available Sites',
			description:
				'List all WordPress Playground sites available ' +
				'across all connected browsers. Returns site IDs ' +
				'needed by all other tools. Always call this first ' +
				'to discover site IDs and check connectivity. ' +
				'Each site includes a storage field — "temporary" ' +
				'sites are lost on page reload, "opfs" sites ' +
				'persist in the browser. Check this field before ' +
				'doing significant work and call ' +
				'playground_save_site if needed.',
			inputSchema: {},
			annotations: {
				readOnlyHint: true,
				destructiveHint: false,
				openWorldHint: false,
			},
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

	server.registerTool(
		'playground_open_site',
		{
			title: 'Open Site in Browser',
			description:
				'Open a WordPress Playground site in a new browser ' +
				'tab. Use this when a site exists but is not active ' +
				'in any tab. The site must appear in list_sites.',
			inputSchema: {
				siteId: siteIdSchema,
			},
			annotations: {
				readOnlyHint: false,
				destructiveHint: false,
				idempotentHint: false,
				openWorldHint: false,
			},
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

	server.registerTool(
		'playground_rename_site',
		{
			title: 'Rename Site',
			description:
				'Rename a WordPress Playground site. Updates the ' +
				'display name shown in the browser UI.',
			inputSchema: {
				siteId: siteIdSchema,
				newName: z
					.string()
					.describe('The new display name for the site'),
			},
			annotations: {
				readOnlyHint: false,
				destructiveHint: false,
				idempotentHint: true,
				openWorldHint: false,
			},
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

	server.registerTool(
		'playground_save_site',
		{
			title: 'Save Site',
			description:
				'Save a temporary WordPress Playground site to ' +
				'browser storage so it survives page reloads. ' +
				'Sites start as temporary by default and are lost ' +
				'when the browser tab is closed or the page is ' +
				'reloaded. Call this tool to persist a site before ' +
				'doing significant work, or early in any multi-step ' +
				'workflow where losing progress would be costly. ' +
				'If the site is already saved, this is a no-op and ' +
				'safe to call again.',
			inputSchema: {
				siteId: siteIdSchema,
			},
			annotations: {
				readOnlyHint: false,
				destructiveHint: false,
				idempotentHint: true,
				openWorldHint: false,
			},
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

	server.registerTool(
		'playground_get_site_info',
		{
			title: 'Get Site Info',
			description:
				'Get information about the running WordPress ' +
				'instance: current URL, document root, site URL, ' +
				'WordPress version, and PHP version.',
			inputSchema: {
				siteId: siteIdSchema,
			},
			annotations: {
				readOnlyHint: true,
				destructiveHint: false,
				openWorldHint: false,
			},
		},
		async ({ siteId }) => {
			try {
				const [url, phpInfoResponse] = await Promise.all([
					sendCommand(siteId, 'getCurrentURL'),
					sendCommand(siteId, 'run', [
						{
							code: [
								'<?php',
								'require_once "/wordpress/wp-load.php";',
								'echo json_encode([',
								'  "documentRoot" => ABSPATH,',
								'  "wpVersion" => get_bloginfo("version"),',
								'  "siteUrl" => get_site_url(),',
								'  "phpVersion" => phpversion(),',
								']);',
							].join('\n'),
						},
					]) as Promise<SerializedPHPResponse>,
				]);
				const infoText = decodeResponseBytes(phpInfoResponse.bytes);
				let info: {
					documentRoot?: string;
					wpVersion?: string;
					siteUrl?: string;
					phpVersion?: string;
				};
				try {
					info = JSON.parse(infoText);
				} catch {
					info = {};
				}
				return {
					content: [
						{
							type: 'text' as const,
							text: JSON.stringify({
								url,
								documentRoot: info.documentRoot ?? '/wordpress',
								siteUrl: info.siteUrl ?? String(url),
								wpVersion: info.wpVersion ?? 'unknown',
								phpVersion: info.phpVersion ?? 'unknown',
							}),
						},
					],
				};
			} catch (error) {
				return errorResult('Error getting site info', error);
			}
		}
	);

	server.registerTool(
		'playground_navigate',
		{
			title: 'Navigate to URL',
			description:
				'Navigate the WordPress Playground browser to a URL ' +
				'path and return the resulting URL. Examples: ' +
				'"/wp-admin/", "/wp-login.php", "/".',
			inputSchema: {
				siteId: siteIdSchema,
				path: z
					.string()
					.describe(
						'The URL path to navigate to, e.g. ' +
							'"/wp-admin/" or "/wp-login.php"'
					),
			},
			annotations: {
				readOnlyHint: false,
				destructiveHint: false,
				idempotentHint: false,
				openWorldHint: false,
			},
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
};
