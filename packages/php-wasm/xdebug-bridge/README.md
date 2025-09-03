# @php-wasm/xdebug-bridge

A bridge server for XDebug and PHP.wasm that facilitates debugging connections between XDebug and Browser devtools.

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
```

```typescript
import { startBridge } from './xdebug-bridge/src/start-bridge';

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
npx xdebug-bridge --port 9000 --verbosity debug

# Show help
npx xdebug-bridge --help
```

## Configuration Options (CLI)

-   `port`: Xdebug port to listen on (default: 9003)
-   `host`: Xdebug host to bind to (default: 'localhost')
-   `php-root`: Path to PHP root directory (default: './')
-   `verbosity`: Output logs and progress messages (choices: "quiet", "normal", "debug") (default: "normal")
-   `help`: Display help

## Configuration Options (API)

-   `cdpPort`: Port to listen for CDP connections (default: 9229)
-   `cdpHost`: Host to bind to (default: 'localhost')
-   `dbgpPort`: Port to listen for XDebug connections (default: 9003)
-   `phpRoot`: Root path for php files
-   `verbosity`: Output logs and progress messages (choices: "quiet", "normal", "debug") (default: "normal")
-   `phpInstance`: PHP instance
-   `getPHPFile`: Custom file listing function
-   `breakOnFirstLine`: Breaks on the first breakable line

## Events

The bridge listens to events for monitoring connection activity:

#### From Xdebug

-   `connected`: Xdebug Server has started
-   `disconnected`: Xdebug Server has stopped
-   `message`: Raw XDebug data received
-   `error`: Xdebug Server error occurred

#### To Devtools

-   `clientConnected`: Devtools client connected
-   `clientDisconnected`: Devtools client disconnected
-   `message`: Raw Devtools data received
-   `error`: Devtools client error occurred
