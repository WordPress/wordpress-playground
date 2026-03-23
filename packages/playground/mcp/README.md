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

## How it works

```
AI Client (stdio) → MCP Server (Node.js) → WebSocket (port 7999) → Browser (Playground website)
```

The MCP server communicates with AI clients via stdio and with the browser via WebSocket. A bridge client (`bridge-client.ts`) integrated into the Playground website via Redux middleware auto-connects to the WebSocket server and proxies commands to the PlaygroundClient API.

## Security

The MCP bridge runs locally and is only accessible from your machine — connections are origin-restricted and require a token generated at server startup, preventing other websites from hijacking it.

**Note:** A compromised WordPress site could attempt prompt injection by embedding instructions in its content (e.g. in a page, post, or PHP output). Use a capable model — larger models are generally better at detecting these attempts.

## Available tools

**Site management**: `playground_get_website_url`, `playground_list_sites`, `playground_open_site`, `playground_rename_site`, `playground_save_site`

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

Navigate to http://127.0.0.1:5400/website-server/?mcp=yes in your browser. The MCP bridge connects automatically.
