/**
 * Tool metadata for WordPress Playground.
 *
 * Pure data — no execution logic, no schema conversion.
 * Both the MCP server and WebMCP import these for consistent
 * names, descriptions, and annotations.
 */

export interface ToolAnnotations {
	readOnlyHint?: boolean;
	destructiveHint?: boolean;
	idempotentHint?: boolean;
	openWorldHint?: boolean;
}

export interface ToolParam {
	name: string;
	type: string;
	description: string;
	required: boolean;
	additionalProperties?: boolean;
	default?: unknown;
}

export interface ToolDefinition {
	name: string;
	title: string;
	description: string;
	annotations: ToolAnnotations;
	params: ToolParam[];
}

// -- Per-site tool definitions --

export const toolDefinitions: Record<string, ToolDefinition> = {
	playground_execute_php: {
		name: 'playground_execute_php',
		title: 'Execute PHP Code',
		description:
			'Run arbitrary PHP code in WordPress Playground and ' +
			'return the output. WordPress is NOT bootstrapped ' +
			'automatically \u2014 to use WP functions, start your ' +
			'code with: require("/wordpress/wp-load.php"); ' +
			'Always include the opening <?php tag. ' +
			'The response JSON contains three fields: "text" ' +
			'(stdout output), "errors" (PHP warnings, notices, ' +
			'and fatal error messages from stderr), and ' +
			'"exitCode" (0 on success, non-zero on fatal error). ' +
			'Check both "errors" and "exitCode" to determine ' +
			'whether the call succeeded. ' +
			'Warning: output is returned in full with no ' +
			'truncation \u2014 avoid queries that produce unbounded ' +
			'output (e.g. SELECT * without LIMIT). Keep output ' +
			'under 50 KB to avoid filling the context window.',
		annotations: {
			readOnlyHint: false,
			destructiveHint: true,
			idempotentHint: false,
			openWorldHint: true,
		},
		params: [
			{
				name: 'code',
				type: 'string',
				description:
					'PHP code to execute. ' +
					'Example: "<?php echo get_bloginfo(\'name\');"',
				required: true,
			},
		],
	},
	playground_request: {
		name: 'playground_request',
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
			'posts, etc.) \u2014 it returns only what you echo and ' +
			'is much leaner. To change the URL the user sees ' +
			'in their tab, use playground_navigate instead.',
		annotations: {
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: false,
			openWorldHint: true,
		},
		params: [
			{
				name: 'url',
				type: 'string',
				description:
					'Request URL path, e.g. ' +
					'"/wp-json/wp/v2/posts" ' +
					'or "/wp-admin/plugins.php"',
				required: true,
			},
			{
				name: 'method',
				type: 'string',
				description:
					'HTTP method (GET, POST, PUT, DELETE, etc.). ' +
					'Defaults to GET.',
				required: false,
				default: 'GET',
			},
			{
				name: 'headers',
				type: 'object',
				description: 'Request headers as key-value pairs',
				required: false,
				additionalProperties: true,
			},
			{
				name: 'body',
				type: 'string',
				description: 'Request body (for POST/PUT requests)',
				required: false,
			},
		],
	},
	playground_navigate: {
		name: 'playground_navigate',
		title: 'Navigate to URL',
		description:
			'Navigate the WordPress Playground browser to a URL ' +
			'path and return the resulting URL. Examples: ' +
			'"/wp-admin/", "/wp-login.php", "/".',
		annotations: {
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: false,
			openWorldHint: true,
		},
		params: [
			{
				name: 'path',
				type: 'string',
				description:
					'The URL path to navigate to, e.g. ' +
					'"/wp-admin/" or "/wp-login.php"',
				required: true,
			},
		],
	},
	playground_get_current_url: {
		name: 'playground_get_current_url',
		title: 'Get Current URL',
		description:
			'Get the current URL path of the WordPress site ' +
			'displayed in Playground.',
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			openWorldHint: true,
		},
		params: [],
	},
	playground_get_site_info: {
		name: 'playground_get_site_info',
		title: 'Get Site Info',
		description:
			'Get information about the running WordPress ' +
			'instance: current URL, document root, site URL, ' +
			'WordPress version, and PHP version.',
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			openWorldHint: true,
		},
		params: [],
	},
	playground_read_file: {
		name: 'playground_read_file',
		title: 'Read File',
		description:
			'Read a file from the WordPress virtual filesystem. ' +
			'Returns the file contents as text.',
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			openWorldHint: true,
		},
		params: [
			{
				name: 'path',
				type: 'string',
				description:
					'Absolute path to the file, e.g. ' +
					'"/wordpress/wp-config.php"',
				required: true,
			},
		],
	},
	playground_write_file: {
		name: 'playground_write_file',
		title: 'Write File',
		description:
			'Write content to a file in the WordPress virtual ' +
			'filesystem. Creates the file if it does not exist. ' +
			'If the file already exists, its entire contents are ' +
			'replaced \u2014 existing data is permanently lost. ' +
			'Parent directories are NOT created automatically ' +
			'\u2014 call playground_mkdir first if needed.',
		annotations: {
			readOnlyHint: false,
			destructiveHint: true,
			idempotentHint: false,
			openWorldHint: true,
		},
		params: [
			{
				name: 'path',
				type: 'string',
				description:
					'Absolute path to write to, e.g. ' +
					'"/wordpress/wp-content/test.txt"',
				required: true,
			},
			{
				name: 'contents',
				type: 'string',
				description: 'File contents to write',
				required: true,
			},
		],
	},
	playground_list_files: {
		name: 'playground_list_files',
		title: 'List Files',
		description:
			'List files and directories at a given path in the ' +
			'WordPress virtual filesystem.',
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			openWorldHint: true,
		},
		params: [
			{
				name: 'path',
				type: 'string',
				description:
					'Absolute path to list, e.g. ' +
					'"/wordpress/wp-content/plugins"',
				required: true,
			},
		],
	},
	playground_mkdir: {
		name: 'playground_mkdir',
		title: 'Create Directory',
		description:
			'Create a directory (and parent directories) in the ' +
			'WordPress virtual filesystem.',
		annotations: {
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: true,
		},
		params: [
			{
				name: 'path',
				type: 'string',
				description:
					'Absolute path of directory to create, e.g. ' +
					'"/wordpress/wp-content/my-plugin"',
				required: true,
			},
		],
	},
	playground_delete_file: {
		name: 'playground_delete_file',
		title: 'Delete File',
		description: 'Delete a file from the WordPress virtual filesystem.',
		annotations: {
			readOnlyHint: false,
			destructiveHint: true,
			idempotentHint: false,
			openWorldHint: true,
		},
		params: [
			{
				name: 'path',
				type: 'string',
				description: 'Absolute path of file to delete',
				required: true,
			},
		],
	},
	playground_delete_directory: {
		name: 'playground_delete_directory',
		title: 'Delete Directory',
		description:
			'Delete a directory from the WordPress virtual ' +
			'filesystem. When recursive is false (the default), ' +
			'the directory must be empty or the call will fail ' +
			'with an error. Set recursive=true to delete a ' +
			'directory and all its contents.',
		annotations: {
			readOnlyHint: false,
			destructiveHint: true,
			idempotentHint: false,
			openWorldHint: true,
		},
		params: [
			{
				name: 'path',
				type: 'string',
				description: 'Absolute path of directory to delete',
				required: true,
			},
			{
				name: 'recursive',
				type: 'boolean',
				description:
					'If true, delete directory and all contents. ' +
					'If false (default), fails on non-empty ' +
					'directories.',
				required: false,
				default: false,
			},
		],
	},
	playground_file_exists: {
		name: 'playground_file_exists',
		title: 'File Exists',
		description:
			'Check whether a file or directory exists in the ' +
			'WordPress virtual filesystem.',
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			openWorldHint: true,
		},
		params: [
			{
				name: 'path',
				type: 'string',
				description: 'Absolute path to check',
				required: true,
			},
		],
	},
};

// -- Site management tool definitions --

export const siteToolDefinitions: Record<string, ToolDefinition> = {
	playground_list_sites: {
		name: 'playground_list_sites',
		title: 'List Available Sites',
		description:
			'List all WordPress Playground sites available. ' +
			'Returns site IDs/slugs, names, and storage type. ' +
			'Always call this first to discover available sites. ' +
			'Each site includes a storage field \u2014 "temporary" ' +
			'sites are lost on page reload, "opfs" sites ' +
			'persist. Call playground_save_site if needed.',
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
		},
		params: [],
	},
	playground_open_site: {
		name: 'playground_open_site',
		title: 'Open Site in Browser',
		description:
			'Open a WordPress Playground site in a new browser ' +
			'tab. Use this when a site exists but is not active ' +
			'in any tab. The site must appear in list_sites.',
		annotations: {
			readOnlyHint: false,
			destructiveHint: false,
		},
		params: [],
	},
	playground_rename_site: {
		name: 'playground_rename_site',
		title: 'Rename Site',
		description:
			'Rename a WordPress Playground site. Updates the ' +
			'display name shown in the browser UI.',
		annotations: {
			readOnlyHint: false,
			destructiveHint: false,
		},
		params: [
			{
				name: 'newName',
				type: 'string',
				description: 'The new display name for the site',
				required: true,
			},
		],
	},
	playground_save_site: {
		name: 'playground_save_site',
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
		annotations: {
			readOnlyHint: false,
			destructiveHint: false,
		},
		params: [],
	},
};

/**
 * Translate internal Playground storage types to user-facing names.
 */
export function presentStorage(raw: string): string {
	return raw === 'none' ? 'temporary' : raw;
}

// -- Shared utilities --

export interface SiteInfo {
	url: string;
	documentRoot: string;
	siteUrl: string;
	wpVersion: string;
	phpVersion: string;
}

/**
 * Execute the site-info composite tool.
 *
 * Transport-agnostic: callers provide thin callbacks that
 * abstract over PlaygroundClient vs bridge.sendCommand.
 */
export async function executeSiteInfo(
	runPhp: (code: string) => Promise<string>,
	getCurrentURL: () => Promise<string>
): Promise<SiteInfo> {
	const [url, infoText] = await Promise.all([
		getCurrentURL(),
		runPhp(
			`<?php
			require_once "/wordpress/wp-load.php";
			echo json_encode([
				"documentRoot" => ABSPATH,
				"wpVersion" => get_bloginfo("version"),
				"siteUrl" => get_site_url(),
				"phpVersion" => phpversion(),
			]);`
		),
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
