# @wp-playground/mcp

MCP server that connects AI providers to a WordPress Playground running in the browser.

## Usage

### 1. Configure your MCP client

Add to your Claude Code `.mcp.json` or Claude Desktop `claude_desktop_config.json`:

```json
{
	"mcpServers": {
		"wordpress-playground": {
			"type": "stdio",
			"command": "npx",
			"args": ["@wp-playground/mcp"]
		}
	}
}
```

Restart your client to pick up the configuration.

### 2. Open the Playground website

Navigate to https://playground.wordpress.net in your browser. The MCP bridge connects automatically — check the browser console for:

```
[MCP Bridge] Connected to MCP server
```

## Development

When working on the MCP server or the Playground codebase, run from source instead:

### 1. Start the Playground dev server

```bash
npm run dev
```

### 2. Configure your MCP client

The repo includes a `.mcp.json` that runs the MCP server from source:

```json
{
	"mcpServers": {
		"wordpress-playground": {
			"type": "stdio",
			"command": "node",
			"args": ["--experimental-strip-types", "--experimental-transform-types", "--import", "./packages/meta/src/node-es-module-loader/register.mts", "./packages/playground/mcp/src/index.ts"]
		}
	}
}
```

The relative paths work with Claude Code's `.mcp.json` (resolved from the project root). For Claude Desktop's `claude_desktop_config.json`, use absolute paths.

### 3. Open the Playground website

Navigate to http://127.0.0.1:5400/website-server/ in your browser. The MCP bridge connects automatically — check the browser console for:

```
[MCP Bridge] Connected to MCP server
```

## How it works

```
Claude (stdio) → MCP Server (Node.js, port 7999 WebSocket)
                       ↕
                 Browser (Playground website)
                   └── mcp-bridge.ts → window.playground (PlaygroundClient)
```

The MCP server communicates with Claude via stdio and with the browser via WebSocket. A bridge script in `remote.html` auto-connects to the MCP WebSocket server and proxies commands to the PlaygroundClient API.

## Available tools

- `playground_list_sites` — List all connected sites, check connectivity, and discover site IDs required by all other tools.
