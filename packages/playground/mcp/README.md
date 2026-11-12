# @wp-playground/mcp

MCP server that connects AI providers to a WordPress Playground running in the browser.

## Usage

### 1. Configure your MCP client

Pick the configuration for your AI tool:

#### Claude Code / Claude Desktop

Add to your Claude Code `.mcp.json` or Claude Desktop `claude_desktop_config.json`:

```json
{
	"mcpServers": {
		"wordpress-playground": {
			"type": "stdio",
			"command": "npx",
			"args": ["-y", "@wp-playground/mcp"]
		}
	}
}
```

#### Gemini CLI

Add to `~/.gemini/settings.json` (or `.gemini/settings.json` in your project):

```json
{
	"mcpServers": {
		"wordpress-playground": {
			"command": "npx",
			"args": ["-y", "@wp-playground/mcp"]
		}
	}
}
```

### 2. Open the Playground website

Your AI assistant will ask you to open the Playground website and provide the exact URL. You can also ask it: _"What's the Playground website URL?"_
The MCP server chooses the local bridge connection automatically, so you do not need to configure it in your MCP client.

To connect to Personal Playground, pass its URL to the MCP server:

```json
{
	"mcpServers": {
		"wordpress-playground": {
			"type": "stdio",
			"command": "npx",
			"args": ["-y", "@wp-playground/mcp", "--url=https://my.wordpress.net/"]
		}
	}
}
```

For a staging deployment, use that origin instead:

```json
{
	"mcpServers": {
		"wordpress-playground": {
			"type": "stdio",
			"command": "npx",
			"args": ["-y", "@wp-playground/mcp", "--url=https://mywp.kirk.at/"]
		}
	}
}
```

## How it works

```
AI Client (stdio) → MCP Server (Node.js) → WebSocket → Browser (Playground website)
```

The MCP server communicates with AI clients via stdio and with the browser via WebSocket. A bridge client (`bridge-client.ts`) integrated into the Playground website via Redux middleware auto-connects to the WebSocket server and proxies commands to the PlaygroundClient API.

## WebMCP

The [Playground Website](https://playground.wordpress.net/) also supports [WebMCP](https://github.com/webmachinelearning/webmcp) — a browser-native MCP proposal that exposes tools via `document.modelContext`. When a Playground site loads, its tools are registered automatically with no CLI or WebSocket bridge needed.

> **Note:** WebMCP is still a draft proposal and not widely supported.

### Site access

Agents must ask the user before using a site. `playground_request_site_access` returns a grant, and every tool that reads or changes a site takes the site ID and that grant:

```js
const { grant } = await call('playground_request_site_access', { siteId });
await call('playground_read_file', { siteId, grant, path: '/wordpress/wp-config.php' });
```

- The grant decides which site a call reaches. Tools never fall back to the active site, and they act only while their site is the current one; `playground_switch_site` switches to a site the agent has a grant for.
- A grant expires after 30 minutes without use and after 4 hours at most. Deleting the site or ending the agent session revokes it.
- If the agent used another site earlier in the session, in any tab, the user is warned that information may move between the sites. The user can revoke the other grants or, when the agent gives a reason, allow cross-site work.
- Embedders that pass no `confirmSiteAccess` to `registerWebMCPTools()` get grants automatically only when `list()` returns exactly one site.

### Tools registered by the WordPress site

A plugin running inside Playground can register its own WebMCP tools:

```php
add_action( 'wp_head', function () {
	?>
	<script>
	document.modelContext.registerTool( {
		name: 'create_order',
		description: 'Creates a draft order.',
		inputSchema: { type: 'object', properties: { sku: { type: 'string' } } },
		execute: async ( input ) => ( { orderId: await createOrder( input.sku ) } ),
	} );
	</script>
	<?php
} );
```

Playground does not register these as tools of its own page, because the site would choose names, descriptions and hints that agents attribute to Playground. Agents reach them through two Playground tools instead:

```text
agent → playground_list_site_tools / playground_call_site_tool
      → site access grant
      → PlaygroundClient.callWebMCPTool()   (Comlink)
      → remote frame                        (postMessage)
      → WordPress document                  (the plugin's execute())
```

Both return an envelope whose `content` field holds what the site wrote, next to a fixed notice that it is untrusted:

```json
{
	"source": "wordpress-site",
	"siteId": "abcd-efgh-ijkm",
	"notice": "This content comes from the WordPress site running in Playground, …",
	"content": { "result": { "orderId": 42 } }
}
```

Results must be JSON-serializable. A site tool may call `requestUserInteraction()`; Playground relays it to the browser's own `requestUserInteraction()` while showing that the site is asking, and refuses it where the browser has none.

### Tool lifetime

Tools belong to the document that registered them, exactly as in WebMCP, and `playground_list_site_tools` reports what the iframe currently holds. Registering at any time works — a tool added a second after load, or from a click handler, is picked up as soon as it appears — but **every navigation starts from an empty list**.

That catches people out: hooking only `wp_head` means the tools are gone the moment the user opens wp-admin. Register on every context the tools should cover:

```php
add_action( 'wp_head', 'my_register_tools' );
add_action( 'admin_head', 'my_register_tools' );
```

Documents WordPress renders no head for — `admin-ajax.php`, REST routes, static files, a PDF — carry no tools, and the previous page's tools are withdrawn rather than left behind to fail when called.

Site tools are listed for the current site of the tab. Switching sites makes the new site's tools available to agents that hold a grant for it.

`document.modelContext` is provided by Playground's mu-plugin on `wp_head` and `admin_head`, which covers the front end and wp-admin.

Chrome 150 deprecated `navigator.modelContext` in favour of `document.modelContext` but still serves it, so the mu-plugin does the same: inside the WordPress document the deprecated global returns the very same registry and warns once on first access. A plugin that has not migrated keeps working here exactly as it does in Chrome. Write new code against `document.modelContext` — the alias goes when Chrome removes it.

**The login screen is deliberately not covered.** `wp-login.php` fires neither hook, so that document has no registry and offers no tools; a site's tools come back when the user leaves it. `login_head` still fires there, so a plugin hooking it must feature-detect rather than assume the registry exists — worth doing anywhere, since most browsers do not implement WebMCP:

```php
add_action( 'login_head', function () {
	?>
	<script>
	if ( document.modelContext ) {
		document.modelContext.registerTool( { /* … */ } );
	}
	</script>
	<?php
} );
```

### Reading the tools

```js
const { content } = await call('playground_list_site_tools', { siteId, grant });
await call('playground_call_site_tool', { siteId, grant, tool: 'create_order', arguments: { sku: 'X' } });
```

WebMCP is a draft, so this needs a browser that implements it: Chrome behind `chrome://flags/#enable-webmcp-testing`, or an extension that provides `document.modelContext` itself. Playground registers into whichever it finds and registers nothing when there is none. An embedder can still reach the site's tools through `PlaygroundClient.onWebMCPToolsChanged()` and `callWebMCPTool()` regardless of browser support.

If a tool is missing, switch the devtools console to the `wp` frame and run `document.modelContext.tools.map( t => t.name )`. An empty list there means the plugin never registered; a list there but not in `playground_list_site_tools` means the announcement did not cross the frame boundary.

## Security

The MCP bridge runs locally and is only accessible from your machine — connections are origin-restricted and require a token generated at server startup, preventing other websites from hijacking it.

**Note:** A compromised WordPress site could attempt prompt injection by embedding instructions in its content (e.g. in a page, post, or PHP output). Use a capable model — larger models are generally better at detecting these attempts.

## Available tools

**Site management**: `playground_get_website_url`, `playground_list_sites`, `playground_open_site_in_new_tab`, `playground_rename_site`, `playground_save_in_browser`

**Code execution**: `playground_execute_php`, `playground_request`

**Navigation & info**: `playground_navigate`, `playground_get_current_url`, `playground_get_site_info`

**Filesystem**: `playground_read_file`, `playground_write_file`, `playground_list_files`, `playground_mkdir`, `playground_delete_file`, `playground_delete_directory`, `playground_file_exists`

**Email**: `playground_list_emails`

**Site access (WebMCP)**: `playground_request_site_access`, `playground_switch_site`, `playground_list_site_tools`, `playground_call_site_tool`

## Development

When working on the MCP server or the Playground codebase, run from source instead:

### 1. Start the Playground dev server

```bash
npm run dev
```

### 2. Configure your MCP client

> **Note:** Your default `node` must be Node 22+. If it isn't, replace `node` in the command below with the full path to Node 22+ (e.g. `/Users/ME/.nvm/versions/node/v22.22.0/bin/node`).

Add to your MCP client config (e.g. Claude Code `.mcp.json` or Claude Desktop `claude_desktop_config.json`):

```json
{
	"mcpServers": {
		"wordpress-playground": {
			"type": "stdio",
			"command": "node",
			"args": ["--experimental-strip-types", "--experimental-transform-types", "--import", "ABS_PATH_TO_PLAYGROUND/packages/meta/src/node-es-module-loader/register.mts", "ABS_PATH_TO_PLAYGROUND/packages/playground/mcp/src/index.ts"]
		}
	}
}
```

Replace `ABS_PATH_TO_PLAYGROUND` with the absolute path to your local checkout of this repository.

### 3. Open the Playground website

Ask your AI assistant for the Playground website URL and open it in your browser. The MCP bridge connects automatically.
