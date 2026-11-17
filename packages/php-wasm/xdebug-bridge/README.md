# @php-wasm/xdebug-bridge

A bridge server for XDebug and PHP.wasm that facilitates debugging connections between XDebug and Browser devtools.

## Installation

```bash
npm install @php-wasm/xdebug-bridge
```

## Usage

### Programmatic API

```typescript
import { startBridge } from '@php-wasm/xdebug-bridge';

// Start with default settings
const bridge = await startBridge({});
bridge.start();
```

Open the printed DevTools URL in Chrome on the same computer. By default, Chrome connects to the bridge at `127.0.0.1:9229` over CDP. Once Chrome connects, the bridge listens for Xdebug at `127.0.0.1:9003` over DBGp and `startBridge()` resolves.

To use a different Xdebug port, set `dbgpPort` and configure Xdebug's `xdebug.client_port` to match.

```typescript
import { startBridge } from '@php-wasm/xdebug-bridge';

const bridge = await startBridge({
	dbgpPort: 9000,
});
bridge.start();
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

- `port`: Xdebug port to listen on (default: 9003)
- `host`: Xdebug host to bind to (default: '127.0.0.1')
- `php-root`: Path to PHP root directory (default: './')
- `verbosity`: Output logs and progress messages (choices: "quiet", "normal", "debug") (default: "normal")
- `help`: Display help

## Configuration Options (API)

- `cdpHost`: Host to bind to (default: '127.0.0.1')
- `cdpPort`: Port to listen for CDP connections (default: 9229)
- `dbgpHost`: Host to bind the XDebug listener to (default: '127.0.0.1')
- `dbgpPort`: Port to listen for XDebug connections (default: 9003)
- `phpRoot`: Directory to scan for PHP files (default: the current working directory).
- `excludedPaths`: Files or directories to skip when scanning for PHP files (default: `[]`).
- `phpInstance`: PHP.wasm instance whose virtual filesystem the bridge scans and reads. Set `phpRoot` to the directory inside that filesystem.
- `getPHPFile`: Function that takes a file path and returns its source as a string or a promise for a string. Used when `phpInstance` is omitted. By default, the bridge reads from the local filesystem.
- `breakOnFirstLine`: Pause on the first breakable line (default: `false`).

## Events

The bridge listens to events for monitoring connection activity:

#### From Xdebug

- `connected`: Xdebug Server has started
- `disconnected`: Xdebug Server has stopped
- `message`: Raw XDebug data received
- `error`: Xdebug Server error occurred

#### To Devtools

- `clientConnected`: Devtools client connected
- `clientDisconnected`: Devtools client disconnected
- `message`: Raw Devtools data received
- `error`: Devtools client error occurred
