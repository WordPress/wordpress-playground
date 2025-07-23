# @php-wasm/xdebug-bridge

XDebug bridge server for PHP.wasm that enables debugging connections between XDebug and debugging clients.

## Installation

```bash
npm install @php-wasm/xdebug-bridge
```

## Usage

### Programmatic API

```typescript
import { startXDebugBridge } from '@php-wasm/xdebug-bridge';

// Start with default settings
const server = startXDebugBridge();
await server.start();

// Start with custom configuration
const server = startXDebugBridge({
	protocol: 'cdp', // or 'dap'
	xdebugServerPort: 9003, // XDebug connection port
	xdebugServerHost: 'localhost',
	verbose: false, // Silent mode
});

await server.start();

// Stop the server
await server.stop();
```

### CLI Usage

```bash
# Start with default settings
npx xdebug-bridge

# Custom port and verbose logging
npx xdebug-bridge --port 9000 --verbose

# DAP protocol, bind to all interfaces
npx xdebug-bridge --protocol dap --host 0.0.0.0

# Show help
npx xdebug-bridge --help
```

## Configuration Options

-   `protocol`: Protocol to use ('cdp' or 'dap', default: 'cdp')
-   `xdebugServerPort`: Port to listen for XDebug connections (default: 9003)
-   `xdebugServerHost`: Host to bind to (default: 'localhost')
-   `verbose`: Enable verbose logging (default: false for API, true for CLI)
-   `logger`: Custom logger function

## Events

The server emits events for monitoring connection activity:

-   `started`: Server has started
-   `stopped`: Server has stopped
-   `connection`: New XDebug connection established
-   `disconnection`: XDebug connection closed
-   `xdebugData`: Raw XDebug data received
-   `error`: Server error occurred
-   `socketError`: Socket-level error occurred
