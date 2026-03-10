/**
 * Tool metadata and schema helpers for WordPress Playground.
 *
 * Pure data — no execution logic. Both the MCP server and
 * WebMCP import these for consistent descriptions, annotations,
 * and schema conversion.
 */

export interface ToolAnnotations {
	readOnlyHint?: boolean;
	destructiveHint?: boolean;
	idempotentHint?: boolean;
	openWorldHint?: boolean;
}

export type ToolParamType = 'string' | 'boolean' | 'object';

export interface ToolParam {
	name: string;
	type: ToolParamType;
	description: string;
	required: boolean;
	additionalProperties?: boolean;
	default?: unknown;
}

export interface ToolDefinition {
	title: string;
	description: string;
	errorPrefix: string;
	annotations: ToolAnnotations;
	params: ToolParam[];
}

const PLAYGROUND_BASE_URL = 'https://playground.wordpress.net/';

export function playgroundUrl(port: number): string {
	return `${PLAYGROUND_BASE_URL}?mcp=yes&mcp-port=${port}`;
}

// -- Per-site tool definitions --

export const toolDefinitions: Record<string, ToolDefinition> = {
	playground_execute_php: {
		title: 'Execute PHP Code',
		errorPrefix: 'Error executing PHP',
		description: `Run arbitrary PHP code in WordPress Playground
			and return the output.

			WordPress is NOT bootstrapped automatically. To use
			WordPress functions, start your code with:
			require("/wordpress/wp-load.php");
			Always include the opening <?php tag.

			The response JSON contains three fields:
			- "text": stdout output
			- "errors": PHP warnings, notices, and fatal error
			  messages from stderr
			- "exitCode": 0 on success, non-zero on fatal error
			Check both "errors" and "exitCode" to determine
			whether the call succeeded.

			WARNING: output is returned in full with no
			truncation — avoid queries that produce unbounded
			output (e.g. SELECT * without LIMIT). Keep output
			under 50 KB to avoid filling the context window.`,
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
				description: `PHP code to execute. Example:
					"<?php echo get_bloginfo('name');"`,
				required: true,
			},
		],
	},
	playground_request: {
		title: 'HTTP Request',
		errorPrefix: 'Error making request',
		description: `Make an HTTP request to the WordPress site
			running in Playground. Requests are authenticated
			automatically via the browser session's cookie
			store.

			Prefer playground_execute_php for reading WordPress
			data (posts, options, plugin state) — it is faster
			and returns only what you echo. Use this tool only
			when the HTTP layer itself is what you are testing,
			for example: verifying that a URL returns a 301
			redirect, that a form submission sets a cookie, or
			that a REST endpoint returns the correct status
			code.

			Note: full HTML responses can be very large and may
			fill the context window. To change the URL the user
			sees in their tab, use playground_navigate instead.`,
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
				description: `Request URL path, e.g.
					"/wp-json/wp/v2/posts" or
					"/wp-admin/plugins.php"`,
				required: true,
			},
			{
				name: 'method',
				type: 'string',
				description: `HTTP method (GET, POST, PUT,
					DELETE, etc.). Defaults to GET.`,
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
		title: 'Navigate to URL',
		errorPrefix: 'Error navigating',
		description: `Navigate to a URL path in WordPress
			Playground and return the final URL after any
			redirects. Examples: "/wp-admin/",
			"/wp-login.php", "/".

			On 404 or error pages, navigation still succeeds
			from the tool's perspective — check the returned
			URL or use playground_request to verify the HTTP
			status code if needed.`,
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
				description: `The URL path to navigate to,
					e.g. "/wp-admin/" or
					"/wp-login.php"`,
				required: true,
			},
		],
	},
	playground_get_current_url: {
		title: 'Get Current URL',
		errorPrefix: 'Error getting current URL',
		description: `Get the current URL path of the WordPress
			site displayed in Playground. For additional
			metadata (WordPress version, PHP version, document
			root), use playground_get_site_info instead.`,
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			openWorldHint: true,
		},
		params: [],
	},
	playground_get_site_info: {
		title: 'Get Site Info',
		errorPrefix: 'Error getting site info',
		description: `Get metadata about the running WordPress
			instance: current URL, document root, site URL,
			WordPress version, and PHP version. Use this when
			you need version information or the document root
			path. For just the current URL, prefer
			playground_get_current_url.`,
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			openWorldHint: true,
		},
		params: [],
	},
	playground_read_file: {
		title: 'Read File',
		errorPrefix: 'Error reading file',
		description: `Read a file from the WordPress virtual
			filesystem. Returns the file contents as text.`,
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			openWorldHint: true,
		},
		params: [
			{
				name: 'path',
				type: 'string',
				description: `Absolute path to the file, e.g.
					"/wordpress/wp-config.php"`,
				required: true,
			},
		],
	},
	playground_write_file: {
		title: 'Write File',
		errorPrefix: 'Error writing file',
		description: `Write content to a file in the WordPress
			virtual filesystem.

			WARNING: Overwrites the entire file — existing
			content is permanently lost. Read the file first
			with playground_read_file if you need to preserve
			any content.

			Creates the file if it does not exist. Parent
			directories are NOT created automatically — call
			playground_mkdir first if needed, otherwise the
			write will fail with a "no such file or directory"
			error.`,
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
				description: `Absolute path to write to, e.g.
					"/wordpress/wp-content/test.txt"`,
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
		title: 'List Files',
		errorPrefix: 'Error listing files',
		description: `List files and directories at a given path
			in the WordPress virtual filesystem. Returns a
			flat, non-recursive listing of the immediate
			contents. To explore subdirectories, call this tool
			again with the subdirectory path.`,
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			openWorldHint: true,
		},
		params: [
			{
				name: 'path',
				type: 'string',
				description: `Absolute path to list, e.g.
					"/wordpress/wp-content/plugins"`,
				required: true,
			},
		],
	},
	playground_mkdir: {
		title: 'Create Directory',
		errorPrefix: 'Error creating directory',
		description: `Create a directory (and all required parent
			directories) in the WordPress virtual filesystem.
			Call this before playground_write_file when writing
			to a path whose parent directories do not yet
			exist.`,
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
				description: `Absolute path of directory to
					create, e.g.
					"/wordpress/wp-content/my-plugin"`,
				required: true,
			},
		],
	},
	playground_delete_file: {
		title: 'Delete File',
		errorPrefix: 'Error deleting file',
		description: `Delete a file from the WordPress virtual
			filesystem.

			WARNING: Deletion is permanent and cannot be
			undone. Returns an error if the file does not
			exist — use playground_file_exists first if
			deletion is conditional.`,
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
		title: 'Delete Directory',
		errorPrefix: 'Error deleting directory',
		description: `Delete a directory from the WordPress
			virtual filesystem.

			WARNING: Deletion is permanent and cannot be
			undone. By default (recursive=false), the directory
			must be empty or the call will fail. Set
			recursive=true to delete a directory and all its
			contents — use with care.`,
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
				description: `If true, delete directory and
					all contents. If false (default), fails
					on non-empty directories.`,
				required: false,
				default: false,
			},
		],
	},
	playground_file_exists: {
		title: 'File Exists',
		errorPrefix: 'Error checking file existence',
		description: `Check whether a file or directory exists
			in the WordPress virtual filesystem.`,
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

export function getSiteToolDefinitions(
	port: number
): Record<string, ToolDefinition> {
	const url = playgroundUrl(port);
	return {
		playground_list_sites: {
			title: 'List Available Sites',
			errorPrefix: 'Error listing sites',
			description: `List all WordPress Playground sites
			available. Call this before any other playground
			tool — it returns the siteId required by every
			other operation.

			If this returns no sites, the user may need to
			open Playground at ${url} .

			Returns site names and storage type. "temporary"
			sites are lost on page reload, "opfs" sites persist
			across reloads. Call playground_save_site to persist
			a temporary site.`,
			annotations: {
				readOnlyHint: true,
				destructiveHint: false,
			},
			params: [],
		},
		playground_open_site: {
			title: 'Open Site in Browser',
			errorPrefix: 'Error opening site',
			description: `Open a WordPress Playground site in a new
			browser tab. The site must appear in
			playground_list_sites.

			Check playground_get_current_url first — if the
			site is already open in a tab, calling this tool
			will open a second tab rather than switching to
			the existing one.`,
			annotations: {
				readOnlyHint: false,
				destructiveHint: false,
			},
			params: [],
		},
		playground_rename_site: {
			title: 'Rename Site',
			errorPrefix: 'Error renaming site',
			description: `Rename a WordPress Playground site. Updates
			the display name shown in the browser UI.`,
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
			title: 'Save Site',
			errorPrefix: 'Error saving site',
			description: `Save a temporary WordPress Playground site
			to browser storage so it survives page reloads.
			Safe to call even if the site is already saved
			(no-op).

			Sites start as temporary by default and are lost
			when the browser tab is closed or the page is
			reloaded. Call this early in any multi-step
			workflow where losing progress would be costly.`,
			annotations: {
				readOnlyHint: false,
				destructiveHint: false,
			},
			params: [],
		},
	};
}

export function stringifyError(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	if (typeof error === 'string') {
		return error;
	}
	try {
		return JSON.stringify(error);
	} catch {
		return String(error);
	}
}

/**
 * Translate internal Playground storage types to user-facing names.
 */
export function presentStorage(raw: string): string {
	return raw === 'none' ? 'temporary' : raw;
}

/**
 * Convert ToolParam[] to a plain JSON Schema object.
 * Used by WebMCP which expects raw JSON Schema (not Zod).
 */
export function paramsToJsonSchema(
	params: ToolParam[]
): Record<string, unknown> {
	const properties: Record<string, Record<string, unknown>> = {};
	const required: string[] = [];

	for (const param of params) {
		const prop: Record<string, unknown> = {
			type: param.type,
			description: param.description,
		};
		if (param.additionalProperties !== undefined) {
			prop['additionalProperties'] = param.additionalProperties;
		}
		if (param.default !== undefined) {
			prop['default'] = param.default;
		}
		properties[param.name] = prop;
		if (param.required) {
			required.push(param.name);
		}
	}

	const schema: Record<string, unknown> = {
		type: 'object',
		properties,
	};
	if (required.length > 0) {
		schema['required'] = required;
	}
	return schema;
}
