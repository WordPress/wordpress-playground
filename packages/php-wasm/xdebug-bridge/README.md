# @php-wasm/xdebug-bridge

XDebug bridge server for PHP.wasm that enables debugging connections between XDebug and debugging clients.

## Installation

```bash
npm install @php-wasm/xdebug-bridge
```

## Usage

### Programmatic API

```typescript
import { startBridge } from './xdebug-bridge/src/start-bridge';

// Start with default settings
const server = startBridge();
await server.start();

// Start with custom configuration
const server = startBridge({
	cdpHost: 'localhost', // CDP connection host
	cdpPort: 9229, // CDP connection port
	dbgpPort: 9003, // XDebug connection port
	phpRoot: './', // Root to directory
});

await server.start();
```

### CLI Usage

```bash
# Start with default settings
npx xdebug-bridge

# Custom port and verbose logging
npx xdebug-bridge --port 9000 --verbose

# Show help
npx xdebug-bridge --help
```

## Configuration Options

-   `cdpPort`: Port to listen for CDP connections (default: 9229)
-   `cdpHost`: Host to bind to (default: 'localhost')
-   `dbgpPort`: Port to listen for XDebug connections (default: 9003)
-   `phpRoot`: Root path for php files;
-   `remoteRoot`: Remote root path for php files;
-   `localRoot`: Local root path for php files;
-   `phpInstance`: PHP instance
-   `getPHPFile`: Custom file listing function

## Events

The bridge listens to events for monitoring connection activity:

-   `connected`: Xdebug Server has started
-   `close`: Xdebug Server has stopped
-   `message`: Raw XDebug data received
-   `error`: Xdebug Server error occurred

-   `clientConnected`: Devtools client connected
-   `clientDisconnected`: Devtools client disconnected
-   `message`: Raw Devtools data received
-   `error`: Devtools client error occurred
