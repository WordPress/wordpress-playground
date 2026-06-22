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

To connect to Personal Playground, use the MyWP MCP package. It wraps the
generic Playground MCP server and adds MyWP-specific prompts and tools:

```json
{
	"mcpServers": {
		"mywp": {
			"type": "stdio",
			"command": "npx",
			"args": ["-y", "@wp-playground/personal-wp-mcp"]
		}
	}
}
```

The MyWP package defaults to `https://my.wordpress.net/`. Pass `--url=...` only
when connecting it to a different Personal Playground origin.

MCP clients that support prompts can then load `mywp-agent` for the recommended
MyWP operating instructions. The MyWP MCP server also ships focused skill
prompts:

- `mywp-skill-abilities`: discover REST routes and WordPress Abilities before
  falling back to raw PHP.
- `mywp-skill-file-editing`: inspect and edit files in the MyWP virtual
  filesystem.
- `mywp-skill-plugin-development`: create or modify WordPress plugins inside
  MyWP.
- `mywp-skill-create-app`: scaffold app-like plugins locally with
  `create-wp-app`, then sync them into MyWP.
- `mywp-skill-sync-local-changes`: copy local project changes into the
  `my.wordpress.net` sandbox.

To sync local changes into MyWP, run the MyWP MCP package connected to
`https://my.wordpress.net/`. Local files are not mounted automatically: your AI
client must read local files from your machine, create matching directories under
`/wordpress/wp-content/` with `playground_mkdir`, and write the changed file
contents with `playground_write_file`. Verify PHP changes with
`playground_execute_php` and check the affected route or admin page with
`playground_request` or `playground_navigate`.

The MyWP profile also exposes `mywp_get_plugin_guidance`, a read-only MCP tool
that applies AI Assistant filters on the connected site and returns structured
plugin ability guidance plus a prompt-ready `systemPrompt`. Plugins can hook
`ai_assistant_ability_domains` to map ability categories/domains to the topics
users ask about. MCP clients can parse the returned `entries` or merge the
returned `systemPrompt` into their instructions so they prefer the WordPress
Abilities API through `playground_request` before lower-level database, file, or
direct PHP inspection for those topics. The tool also reads
`ai_assistant_welcome_tips`. These filters are applied directly and do not
require the AI Assistant plugin to be installed.

For a staging deployment, use that origin instead:

```json
{
	"mcpServers": {
		"mywp": {
			"type": "stdio",
			"command": "npx",
			"args": ["-y", "@wp-playground/personal-wp-mcp", "--url=https://mywp.kirk.at/"]
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

The [Playground Website](https://playground.wordpress.net/) also supports [WebMCP](https://github.com/webmachinelearning/webmcp) — a browser-native MCP proposal that exposes tools via `navigator.modelContext`. When a Playground site loads, its tools are registered automatically with no CLI or WebSocket bridge needed.

> **Note:** WebMCP is still a draft proposal and not widely supported.

## Security

The MCP bridge runs locally and is only accessible from your machine — connections are origin-restricted and require a token generated at server startup, preventing other websites from hijacking it.

**Note:** A compromised WordPress site could attempt prompt injection by embedding instructions in its content (e.g. in a page, post, or PHP output). Use a capable model — larger models are generally better at detecting these attempts.

## Available tools

**Site management**: `playground_get_website_url`, `playground_list_sites`, `playground_open_site_in_new_tab`, `playground_rename_site`, `playground_save_in_browser`

**Code execution**: `playground_execute_php`, `playground_request`

**Navigation & info**: `playground_navigate`, `playground_get_current_url`, `playground_get_site_info`

**Filesystem**: `playground_read_file`, `playground_write_file`, `playground_list_files`, `playground_mkdir`, `playground_delete_file`, `playground_delete_directory`, `playground_file_exists`

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
