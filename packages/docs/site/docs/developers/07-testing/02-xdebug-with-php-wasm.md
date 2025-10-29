# Using Xdebug with PHP WASM

## Introduction

Xdebug is a powerful debugging and profiling extension for PHP that provides developers with essential tools for troubleshooting and optimizing their code. WordPress Playground integrates Xdebug into PHP WASM, bringing professional debugging capabilities to WebAssembly environments.

Key Xdebug features available in PHP WASM:

-   **Step debugging**: Pause execution with breakpoints and variable inspection
-   **Stack traces**: View detailed error information across the WASM boundary
-   **Code coverage**: Analyze testing for WordPress plugins and themes
-   **Profiling**: Identify performance bottlenecks in the WASM runtime
-   **Remote debugging**: Debug in browser-based and Node.js environments

## How Xdebug works with PHP WASM

Xdebug compiles directly into the PHP WASM binary and can be enabled with a simple `--xdebug` flag on Playground CLI. Once enabled, it provides full debugging capabilities in both browser and Node.js environments:

-   **Breakpoint debugging**: Pause execution at specific lines of code
-   **Variable inspection**: Examine variable values at runtime
-   **Step execution**: Step over, into, and out of functions
-   **Call stack analysis**: Trace function calls across your application
-   **Performance profiling**: Generate cachegrind files for analysis
-   **Code coverage**: Track which lines of code execute

The integration supports standard Xdebug protocols (DBGp), so you can use existing IDE configurations and debugging tools without modification.

## Xdebug benefits for PHP WASM

### The WebAssembly black box problem

WebAssembly code runs in a sandboxed environment with limited visibility. Without proper debugging tools, PHP WASM becomes a "black box" where errors don't surface clearly in the console, stack traces are difficult to interpret across the JavaScript-WASM boundary, and variable inspection requires manual logging. Performance bottlenecks become nearly impossible to identify.

### WordPress Playground benefits

For WordPress Playground development, Xdebug is essential for debugging complex interactions between WordPress, PHP WASM, and JavaScript layers. It enables plugin and theme testing in a sandboxed environment while providing educational value for students learning PHP in an accessible browser-based setup, with remote debugging capabilities for troubleshooting WordPress sites running entirely in the browser.

### WebAssembly performance insights

Xdebug helps identify WASM-specific performance issues:

-   Overhead from JavaScript-to-WASM calls and boundary crossings
-   I/O operations across the virtual filesystem
-   Network request handling through fetch proxies and API bridges

Without Xdebug, developers would rely on primitive debugging methods like echo statements—inadequate for modern development. Xdebug transforms PHP WASM from an experimental technology into a production-ready platform.

---

## Getting started

This guide covers three debugging approaches:

1. **Chrome DevTools integration** - Debug PHP directly in your browser using Chrome's built-in developer tools
2. **IDE integration** - Connect Xdebug to VSCode or PhpStorm for a full-featured debugging experience
3. **Installation methods** - Multiple ways to run PHP WASM with Xdebug enabled

Choose the debugging environment that best fits your workflow, or use both depending on your needs.

---

## Installation methods

There are four primary ways to run PHP WASM with Xdebug support:

### 1. Directly from the WordPress Playground repository

Clone and run from the WordPress Playground repository for development and testing.

Navigate to the repository:

```bash
cd wordpress-playground
```

**Local PHP WASM CLI:**

```bash
$ node --no-warnings=ExperimentalWarning \
  --experimental-strip-types \
  --experimental-transform-types \
  --import ./packages/meta/src/node-es-module-loader/register.mts \
  ./packages/php-wasm/cli/src/main.ts --xdebug
```

**Local Playground CLI:**

```bash
$ node --no-warnings=ExperimentalWarning \
  --experimental-strip-types \
  --experimental-transform-types \
  --import ./packages/meta/src/node-es-module-loader/register.mts \
  ./packages/playground/cli/src/cli.ts server --xdebug
```

### 2. Using local package repository

For testing local changes before publishing, run the local package repository script.

Navigate to the repository and start the local package server:

```bash
$ cd wordpress-playground
$ npm run local-package-repository
```

The script outputs local package URLs. Add these URLs to your project's `package.json` file and install. For example:

```json
{
	"type": "module",
	"dependencies": {
		"@php-wasm/node": "http://127.0.0.1:9724/7840495c41d5c5ae535da114/v3.0.12/@php-wasm-node-3.0.12.tar.gz",
		"@php-wasm/cli": "http://127.0.0.1:9724/7840495c41d5c5ae535da114/v3.0.12/@php-wasm-cli-3.0.12.tar.gz",
		"@wp-playground/cli": "http://127.0.0.1:9724/7840495c41d5c5ae535da114/v3.0.12/@wp-playground-cli-3.0.12.tar.gz"
	}
}
```

### 3. Installing from NPM

For production use or stable versions, install the published packages:

```bash
$ npm install @php-wasm/node @php-wasm/cli @wp-playground/cli
```

### 4. Running with NPX

For quick testing without installation (CLI tools only):

```bash
# PHP WASM CLI
$ npx @php-wasm/cli@latest --xdebug

# WordPress Playground CLI
$ npx @wp-playground/cli@latest server --xdebug
```

---

## Choose your debugging environment

### Debugging environment comparison

| Feature                 | Chrome DevTools          | IDE Integration         |
| ----------------------- | ------------------------ | ----------------------- |
| **Setup complexity**    | Simple                   | Moderate                |
| **Breakpoints**         | Set in DevTools UI       | Set in your code editor |
| **Code navigation**     | Limited to VFS structure | Full project navigation |
| **Variable inspection** | Full support             | Full support            |
| **Step debugging**      | Full support             | Full support            |
| **Call stack**          | Full support             | Full support            |
| **IDEs supported**      | Chrome/Chromium browsers | VSCode, PhpStorm        |

### When to use Chrome DevTools

Choose Chrome DevTools debugging when you:

-   Want to debug directly in your browser without IDE setup
-   Are doing quick debugging sessions
-   Prefer visual debugging in the browser

### When to use IDE integration

Choose IDE integration when you:

-   Have complex, multi-file debugging needs
-   Prefer debugging within your code editor
-   Need better code navigation and project awareness

## Chrome DevTools Integration

### What is the DevTools integration?

The `--experimental-devtools` option enables debugging PHP code directly in Chrome DevTools using a bridge between Xdebug's DBGp protocol and Chrome's Chrome DevTools Protocol (CDP). This allows you to debug PHP WASM code in your browser just like you would debug JavaScript.

[Image: Chrome DevTools connected to Xdebug bridge]

### How it works

The integration consists of:

1. **Xdebug DBGp server**: Runs on port 9003 (standard Xdebug 3 port)
2. **CDP server**: Runs on port 9229 (standard Chrome DevTools port)
3. **Bridge**: Translates between DBGp and CDP protocols in real-time

When you run PHP code with Xdebug enabled, the bridge automatically:

-   Forwards debugging commands from Chrome DevTools to Xdebug
-   Translates stack traces, variables, and breakpoints between protocols
-   Provides source code mapping for the Virtual File System

### Setting up Chrome DevTools debugging

#### Prerequisites

-   Chrome, Chromium, or any Chromium-based browser (Edge, Brave, etc.)
-   Node.js with WebAssembly support

#### Basic setup

**Step 1: Start Playground CLI with DevTools**

```bash
$ npx @wp-playground/cli@latest server --xdebug --experimental-devtools
```

You'll see output like:

```
Starting a PHP server...
Setting up WordPress...
WordPress is running on http://127.0.0.1:9400

Connect Chrome DevTools to CDP at:
devtools://devtools/bundled/inspector.html?ws=localhost:9229

Waiting for Chrome to connect...
```

[Image: Breakpoint in Chrome DevTools]

**Step 2: Connect Chrome DevTools**

Open Chrome and navigate to:

```
devtools://devtools/bundled/inspector.html?ws=localhost:9229
```

Or manually:

1. Open Chrome DevTools (F12)
2. Click the three dots menu → More tools → Remote devices
3. Click "Configure" and add `localhost:9229`
4. Click "Inspect"

You'll see confirmation in your terminal:

```
Chrome connected! Initializing Xdebug receiver...
XDebug receiver running on port 9003
```

**Step 3: Set breakpoints and debug**

1. In Chrome DevTools, navigate to the **Sources** tab
2. Browse the file tree to find your PHP files
3. Click on a line number to set a breakpoint
4. Visit your Playground site in the browser to trigger the breakpoint
5. Use the debugging controls to step through code, inspect variables, etc.

### Using DevTools programmatically

You can also use the DevTools integration from Node.js scripts:

```javascript
import { runCLI } from '@wp-playground/cli';

const script = `
<?php
$test = 42;
echo "Output!\\n";

function test() {
    echo "Hello Xdebug World!\\n";
}

test();
`;

// Start server with Xdebug and DevTools
const cliServer = await runCLI({
	command: 'server',
	xdebug: true,
	experimentalDevtools: true,
});

// Write and execute PHP code
await cliServer.playground.writeFile('xdebug.php', script);
const result = await cliServer.playground.run({ scriptPath: 'xdebug.php' });

console.log(result.text);
```

Run with:

```bash
$ node --experimental-wasm-stack-switching --experimental-wasm-jspi script.js
```

### DevTools debugging workflow

#### 1. File navigation

The Sources panel shows the Virtual File System structure:

```
file://
├── internal/shared/
│   └── auto_prepend_file.php
└── wordpress/
    ├── index.php
    ├── wp-config.php
    └── wp-content/
        └── plugins/
            └── your-plugin/
                └── your-plugin.php
```

#### 2. Setting breakpoints

-   **Line breakpoints**: Click the line number in the gutter
-   **Conditional breakpoints**: Right-click the line number → "Add conditional breakpoint"
-   **Logpoints**: Right-click the line number → "Add logpoint"

#### 3. Debugging controls

Once execution pauses at a breakpoint:

-   **Resume** (F8): Continue execution
-   **Step over** (F10): Execute the current line and move to the next
-   **Step into** (F11): Enter the function being called
-   **Step out** (Shift+F11): Exit the current function
-   **Step** (F9): Execute the next statement

#### 4. Inspecting data

-   **Scope panel**: View local and global variables
-   **Watch panel**: Add expressions to watch
-   **Call stack**: See the full call stack
-   **Console**: Evaluate PHP expressions (limited support)

### Understanding the auto_prepend_file

When you first connect to Chrome DevTools and trigger PHP execution, you may notice the debugger stops in `/internal/shared/auto_prepend_file.php`. This is WordPress Playground's initialization file that runs before your code.

**Why this happens:**

-   Xdebug's "break on first line" feature stops at the very first PHP code executed
-   The `auto_prepend_file.php` sets up the environment before your code runs
-   This requires stepping over approximately 23 lines before reaching your code

**Workaround:**
Instead of stepping through the internal file:

1. Don't use "break on first line" mode
2. Set breakpoints directly in your PHP files before triggering execution
3. Or use the path exclusion feature (see Advanced DevTools features below)

### Advanced DevTools features

#### Excluding internal files from debugging

You can configure the bridge to skip internal Playground files:

```javascript
const cliServer = await runCLI({
	command: 'server',
	xdebug: true,
	experimentalDevtools: true,
	xdebugExcludePaths: ['/internal/'], // Skip internal files
});
```

This prevents the debugger from stopping in Playground's internal files, taking you directly to your code.

#### Custom ports

If the default ports are in use, you can specify custom ports:

```javascript
const cliServer = await runCLI({
	command: 'server',
	xdebug: true,
	experimentalDevtools: true,
	xdebugPort: 9003, // DBGp port
	cdpPort: 9229, // Chrome DevTools Protocol port
});
```

### DevTools troubleshooting

#### Chrome won't connect

**Problem**: Chrome DevTools shows "WebSocket disconnected" or fails to connect.

**Solutions**:

-   Verify the CDP server is running (check terminal output)
-   Ensure port 9229 is not blocked by a firewall
-   Try closing and reopening Chrome DevTools
-   Check that you're using the correct WebSocket URL

#### Breakpoints not being hit

**Problem**: Breakpoints appear but execution doesn't pause.

**Solutions**:

-   Make sure your PHP code is actually being executed
-   Verify the file path matches exactly (case-sensitive)
-   Check that Xdebug is enabled (look for terminal output confirming connection)
-   Try setting a breakpoint on a different line

#### Source files not appearing

**Problem**: The Sources panel doesn't show PHP files.

**Solutions**:

-   Trigger PHP execution first (visit the Playground site)
-   Refresh the DevTools sources tree
-   Check that files exist in the Virtual File System

#### Performance issues

**Problem**: Debugging is slow or unresponsive.

**Solutions**:

-   Disable "break on first line" if enabled
-   Use fewer breakpoints
-   Exclude internal paths from debugging
-   Close other Chrome tabs

### DevTools limitations

Current limitations of the DevTools integration:

1. **Console evaluation**: Limited PHP expression evaluation in the console
2. **Hot reload**: Code changes require restarting the server
3. **Async operations**: Some async patterns may not debug cleanly
4. **Memory profiling**: Not yet supported (Xdebug profiling features coming)

### DevTools examples

#### Example 1: Debugging a WordPress plugin

```javascript
import { runCLI } from '@wp-playground/cli';

const pluginCode = `
<?php
/**
 * Plugin Name: Debug Test
 */

add_action('init', function() {
    $user = wp_get_current_user();
    $data = [
        'user_id' => $user->ID,
        'user_login' => $user->user_login
    ];
    
    // Set a breakpoint on this line in DevTools
    error_log(print_r($data, true));
});
`;

const server = await runCLI({
	command: 'server',
	xdebug: true,
	experimentalDevtools: true,
});

await server.playground.writeFile('/wordpress/wp-content/plugins/debug-test.php', pluginCode);

console.log('Server running. Open Chrome DevTools and visit the site.');
```

#### Example 2: Debugging with conditional breakpoints

1. Set a regular breakpoint in your PHP file
2. Right-click the breakpoint → Edit breakpoint
3. Enter a condition like: `$user->ID === 1`
4. The debugger will only pause when the condition is true

---

## IDE Integration

### What is IDE integration?

The `--experimental-unsafe-ide-integration` flag automates IDE configuration for Xdebug debugging, enabling you to debug PHP WASM code directly in your IDE (VSCode or PhpStorm) with full breakpoint support, variable inspection, and call stack analysis.

[Image: VSCode Run and Debug panel]

### Why two debugging options?

WordPress Playground offers both Chrome DevTools and IDE integration because they serve different use cases:

-   **DevTools**: Browser-based, no IDE required, great for quick debugging
-   **IDE integration**: Full IDE features, better for complex projects, professional workflows

You can use both simultaneously if needed!

### What does --experimental-unsafe-ide-integration do?

The flag automates IDE configuration by:

1. **Creating a symlink**: Creates `.playground-xdebug-root` in your working directory that points to the temporary Playground CLI directory, giving your IDE visibility into the Virtual File System (VFS)

2. **Configuring path mappings**: Automatically generates IDE-specific configuration files with proper path mappings between your local files and the VFS

3. **Setting up debug configurations**: Creates ready-to-use debug configurations in your IDE

### Why is it "unsafe"?

The flag is marked as "experimental-unsafe" because:

-   It modifies IDE configuration files (`.vscode/launch.json` and `.idea/workspace.xml`)
-   It creates symlinks in your working directory
-   The feature is still under active development

### Supported IDEs

Currently supports:

-   **VSCode**: Adds configuration to `.vscode/launch.json`
-   **PhpStorm**: Adds configuration to `.idea/workspace.xml`

---

## Setting up IDE Integration

### Prerequisites

**For VSCode:**

-   Install the [PHP Debug extension](https://marketplace.visualstudio.com/items?itemName=xdebug.php-debug)

**For PhpStorm:**

-   No additional plugins required (built-in Xdebug support)

### Basic setup

**Step 1: Start Playground with IDE integration**

```bash
$ npx @wp-playground/cli@latest server \
  --xdebug \
  --experimental-unsafe-ide-integration
```

You'll see output like:

```
Starting a PHP server...
Xdebug configured successfully
Updated IDE config: .vscode/launch.json .idea/workspace.xml
Playground source root: .playground-xdebug-root

VS Code / Cursor instructions:
1. Open the Run and Debug panel on the left sidebar
2. Select "WP Playground CLI - Listen for Xdebug" from the dropdown
3. Click "Start Debugging"
4. Set a breakpoint. For example, in .playground-xdebug-root/wordpress/index.php
5. Visit Playground in your browser to hit the breakpoint

PhpStorm instructions:
1. Choose "WP Playground CLI - Listen for Xdebug" debug configuration in the toolbar
2. Click the debug button (bug icon)
3. Set a breakpoint. For example, in .playground-xdebug-root/wordpress/index.php
4. Visit Playground in your browser to hit the breakpoint
```

**Step 2: Configure your IDE**

The CLI automatically creates debug configurations, but you need to start the debugger.

**Step 3: Set breakpoints**

Set breakpoints in your PHP files - either in your local files or in the `.playground-xdebug-root/` directory to debug VFS files.

**Step 4: Trigger execution**

Visit your Playground site in the browser to trigger the breakpoints.

### VSCode setup

#### Detailed VSCode instructions

1. **Start the CLI with both flags:**

```bash
$ npx @wp-playground/cli@latest server \
  --xdebug \
  --experimental-unsafe-ide-integration
```

2. **Open VSCode's Run and Debug panel**

    - Press `Ctrl+Shift+D` (Windows/Linux) or `Cmd+Shift+D` (Mac)
    - Or click the Run and Debug icon in the left sidebar

3. **Select the debug configuration**

    - Click the dropdown at the top of the panel
    - Select "WP Playground CLI - Listen for Xdebug"

4. **Start the debugger**

    - Click the green play button or press `F5`
    - You should see "Listening on port 9003" in the debug console

5. **Set breakpoints**

    - Open any PHP file
    - Click in the gutter (left of line numbers) to set breakpoints
    - Red dots appear where breakpoints are set

6. **Trigger the breakpoint**
    - Visit `http://127.0.0.1:9400` (or your configured port) in your browser
    - VSCode should pause at your breakpoint

#### VSCode configuration details

The CLI automatically creates this configuration in `.vscode/launch.json`:

```json
{
	"configurations": [
		{
			"name": "WP Playground CLI - Listen for Xdebug",
			"type": "php",
			"request": "launch",
			"port": 9003,
			"pathMappings": {
				"/wordpress": "${workspaceFolder}/.playground-xdebug-root/wordpress",
				"/": "${workspaceFolder}/.playground-xdebug-root/"
			}
		}
	]
}
```

#### VSCode debugging features

Once paused at a breakpoint, you can:

-   **Variables panel**: View all variables in scope
-   **Watch panel**: Add expressions to monitor
-   **Call Stack panel**: See the execution path
-   **Debug Console**: Evaluate PHP expressions
-   **Breakpoint panel**: Manage all breakpoints

#### VSCode troubleshooting

**"Unknown sourceReference 0" error:**

-   Update the PHP Debug extension to the latest version
-   Check the [VSCode PHP Debug issue tracker](https://github.com/xdebug/vscode-php-debug/issues/1020)
-   Try restarting VSCode

**Debugger not connecting:**

-   Verify the PHP Debug extension is installed and enabled
-   Check that port 9003 is not in use by another application
-   Restart the CLI and VSCode

---

### PhpStorm setup

#### Detailed PhpStorm instructions

1. **Start the CLI with both flags:**

```bash
$ npx @wp-playground/cli@latest server \
  --xdebug \
  --experimental-unsafe-ide-integration
```

2. **Select the debug configuration**

    - Find the debug configurations dropdown in the toolbar (top right)
    - Select "WP Playground CLI - Listen for Xdebug"

3. **Start the debugger**

    - Click the debug button (bug icon) next to the dropdown
    - Or press `Shift+F9`
    - The debug button should turn green

4. **Optional: Enable "Break at first line"**

    - In the Run menu → "Break at first line in PHP scripts"
    - This helps verify the connection works

5. **Set breakpoints**

    - Open any PHP file
    - Click in the gutter (left of line numbers) to set breakpoints

6. **Trigger the breakpoint**
    - Visit your Playground site in the browser
    - PhpStorm should pause at your breakpoint

#### PhpStorm configuration details

The CLI automatically creates a server configuration in `.idea/workspace.xml`:

-   **Server name**: WP Playground CLI - Listen for Xdebug
-   **Host**: `127.0.0.1:9400` (combined host:port)
-   **IDE Key**: `PLAYGROUNDCLI`
-   **Path mappings**: Automatic mappings for all mounted directories

**Important PhpStorm Quirk**: PhpStorm requires the full host:port in the `host` field. The separate `port` field is ignored, so the configuration uses `host: "host:port"`.

#### PhpStorm debugging features

Once paused at a breakpoint:

-   **Variables view**: Inspect all variables in scope
-   **Watches**: Monitor specific expressions
-   **Frames**: Navigate the call stack
-   **Console**: Execute PHP code in context
-   **Evaluate Expression**: Quick expression evaluation (Alt+F8)

#### PhpStorm troubleshooting

**"Can't find a source position" error:**

-   Verify path mappings in Settings → PHP → Servers
-   Check that `.playground-xdebug-root` symlink exists and is valid
-   Restart PhpStorm

**Server configuration not found:**

-   Manually verify the server exists in Settings → PHP → Servers
-   The CLI should have created "WP Playground CLI - Listen for Xdebug"
-   Re-run the CLI with the flag to recreate the configuration

---

## Understanding .playground-xdebug-root

### What is it?

The `.playground-xdebug-root` symlink is a symbolic link created in your working directory that points to the temporary Playground CLI directory. This gives your IDE visibility into files that exist only in the Virtual File System (VFS).

### Why do we need it?

Without this symlink, your IDE cannot see files that exist only in the VFS (like WordPress core files, uploaded plugins, or theme files). The symlink makes these files accessible to your IDE so you can:

-   Set breakpoints in VFS files
-   Navigate the VFS structure
-   Debug WordPress core code
-   Inspect mounted plugins and themes

### Structure example

```
your-project/
├── .playground-xdebug-root -> /tmp/playground-cli-abc123/
│   ├── wordpress/
│   │   ├── index.php
│   │   ├── wp-config.php
│   │   └── wp-content/
│   │       └── plugins/
│   └── your-mounted-files/
├── your-local-code/
└── .vscode/ or .idea/
```

### Browsing the VFS

You can browse the `.playground-xdebug-root` directory directly in your IDE:

**In VSCode:**

-   The symlink appears in the Explorer panel
-   Click to expand and browse the VFS structure
-   Set breakpoints in any file

**In PhpStorm:**

-   The symlink appears in the Project view
-   Navigate through folders normally
-   All VFS files are readable and debuggable

### Safety considerations

-   The symlink is automatically removed and recreated each time you run the CLI with the flag
-   It's safe to delete manually if needed
-   Add `.playground-xdebug-root` to your `.gitignore`

```bash
# Add to .gitignore
.playground-xdebug-root
```

---

## Configuration Management

### How configurations are managed

When you use `--experimental-unsafe-ide-integration`:

1. **Cleanup**: The CLI first removes any existing "WP Playground CLI - Listen for Xdebug" configurations
2. **Creation**: Creates new configurations with current settings
3. **Preservation**: Leaves other configurations intact

### Automatic configuration

The CLI uses JSONC (JSON with Comments) parser for VSCode configurations to preserve comments and formatting. This means your existing `.vscode/launch.json` comments and structure remain intact.

### Manual configuration cleanup

If you want to remove Playground configurations without running the CLI:

**VSCode**:

1. Open `.vscode/launch.json`
2. Remove the configuration object named "WP Playground CLI - Listen for Xdebug"
3. Save the file

**PhpStorm**:

1. Open Settings → PHP → Servers
2. Select "WP Playground CLI - Listen for Xdebug"
3. Click the minus button to remove
4. Or edit `.idea/workspace.xml` directly

### Configuration file locations

**VSCode:**

-   `.vscode/launch.json` - Debug configurations
-   Created automatically if it doesn't exist

**PhpStorm:**

-   `.idea/workspace.xml` - IDE workspace settings including server configurations
-   Must already exist (created when you open a project in PhpStorm)

---

## Advanced Usage

### Combining DevTools and IDE integration

You can use both debugging methods simultaneously:

```bash
$ npx @wp-playground/cli@latest server \
  --xdebug \
  --experimental-devtools \
  --experimental-unsafe-ide-integration
```

This allows you to:

-   Debug in Chrome DevTools for quick inspection
-   Switch to your IDE for complex debugging sessions
-   Use whichever tool is most convenient at the moment

### Custom Xdebug settings

The CLI uses these default Xdebug settings:

-   **IDE Key**: `PLAYGROUNDCLI`
-   **Port**: `9003` (standard Xdebug 3 port)
-   **Host**: Based on CLI's host setting (default `127.0.0.1`)

### Debugging specific files

To debug specific PHP files:

1. **Direct execution**:

```bash
$ npx @php-wasm/cli@latest --xdebug myscript.php
```

2. **Programmatic execution**:

```javascript
const result = await playground.run({
	scriptPath: 'path/to/file.php',
});
```

### Debugging WordPress plugins

**Setup:**

```bash
$ cd my-wordpress-plugin
$ npx @wp-playground/cli@latest server \
  --auto-mount=. \
  --xdebug \
  --experimental-unsafe-ide-integration
```

**Workflow:**

1. Your plugin code is automatically mounted to `/wordpress/wp-content/plugins/my-plugin`
2. Set breakpoints in your local plugin files
3. Visit the Playground site to trigger execution
4. Debug as normal

### Debugging during Blueprint execution

**Note**: Xdebug is active even during Blueprint execution. This may not be desirable for most users as it can slow down the initial setup.

**Current behavior**: The debugger may pause during WordPress installation and plugin activation.

**Future improvement**: A future update will add an option to disable Xdebug until WordPress fully boots.

---

## Complete Debugging Workflows

### Workflow 1: Quick debugging with Chrome DevTools

**Use case**: Quickly debug a PHP script without setting up an IDE.

```bash
# 1. Create a test script
cat > test.php << 'EOF'
<?php
function calculateTotal($items) {
    $total = 0;
    foreach ($items as $item) {
        $total += $item['price'] * $item['quantity'];
    }
    return $total;
}

$cart = [
    ['name' => 'Widget', 'price' => 10, 'quantity' => 2],
    ['name' => 'Gadget', 'price' => 25, 'quantity' => 1]
];

$total = calculateTotal($cart);
echo "Total: $" . $total . "\n";
EOF

# 2. Start with DevTools
$ npx @php-wasm/cli@latest --xdebug --experimental-devtools

# 3. In another terminal, execute the script
$ npx @php-wasm/cli@latest --xdebug test.php

# 4. Open Chrome DevTools at: devtools://devtools/bundled/inspector.html?ws=localhost:9229

# 5. Set breakpoints in test.php and debug
```

### Workflow 2: Debugging with VSCode

**Use case**: Debug a WordPress plugin with full IDE features.

```bash
# 1. Navigate to your plugin directory
$ cd ~/projects/my-wp-plugin

# 2. Start Playground with IDE integration
$ npx @wp-playground/cli@latest server \
  --auto-mount=. \
  --xdebug \
  --experimental-unsafe-ide-integration

# Output:
# WordPress is running on http://127.0.0.1:9400
# Updated IDE config: .vscode/launch.json
# Playground source root: .playground-xdebug-root

# 3. Open VSCode in the current directory
$ code .

# 4. Press F5 to start debugging
# 5. Set breakpoints in your plugin files
# 6. Visit http://127.0.0.1:9400 in your browser
# 7. Debugger pauses at your breakpoints
# 8. Inspect variables, step through code, etc.
```

## Troubleshooting

### General issues

#### Xdebug not starting

**Symptoms**: No debugging output, breakpoints don't work

**Solutions**:

1. Verify you're using the `--xdebug` flag
2. Check Node.js version supports experimental features
3. Look for error messages in terminal output
4. Try `--verbosity=debug` for more information

#### Port conflicts

**Symptoms**: "Port already in use" errors

**Solutions**:

-   **Xdebug port 9003**: Another Xdebug session is running
    -   Stop other PHP servers or IDEs
    -   Change the port (future feature)
-   **CDP port 9229**: Another DevTools session is active
    -   Close other debugging sessions
    -   Kill processes using the port: `lsof -ti:9229 | xargs kill`

#### Breakpoints work in one environment but not the other

**Symptoms**: Breakpoints work in DevTools but not IDE (or vice versa)

**Solutions**:

-   Verify both debuggers are actually listening
-   Check path mappings in IDE configuration
-   Ensure `.playground-xdebug-root` symlink exists (for IDE)
-   Restart both the CLI and your debugging tool

### DevTools-specific issues

See the "DevTools troubleshooting" section above for:

-   Chrome connection issues
-   Source files not appearing
-   Performance problems

### IDE-specific issues

See the VSCode and PhpStorm troubleshooting sections above for:

-   IDE-specific connection issues
-   Configuration problems
-   Path mapping errors

### Symlink issues on Windows

**Symptoms**: `.playground-xdebug-root` symlink fails to create

**Solutions**:

-   Run your terminal as Administrator
-   Enable Developer Mode in Windows Settings
-   Consider using WSL2 for development
-   Alternatively, use DevTools integration which doesn't require symlinks

---

## Best Practices

### 1. Use .gitignore

Always add Playground-generated files to `.gitignore`:

```gitignore
# Playground Xdebug integration
.playground-xdebug-root

# IDE-specific (optional, some teams commit these)
.vscode/launch.json
.idea/workspace.xml
```

### 2. Choose the right tool for the job

-   **Quick fixes**: Use Chrome DevTools
-   **Complex debugging**: Use IDE integration
-   **Learning/teaching**: DevTools is more visual

### 3. Set strategic breakpoints

Don't over-use breakpoints:

-   Focus on problem areas
-   Use conditional breakpoints for specific conditions
-   Remove breakpoints when done debugging

### 4. Leverage the VFS symlink

The `.playground-xdebug-root` symlink gives you visibility:

-   Browse WordPress core code
-   Understand plugin interactions
-   Debug third-party code

### 5. Clean up after debugging

When done debugging:

-   Stop the debugger in your IDE
-   Close DevTools tabs
-   Stop the Playground CLI
-   Consider removing the `.playground-xdebug-root` symlink

---

## Roadmap and Future Improvements

Based on ongoing development, upcoming improvements may include:

### DevTools improvements

1. **Better path filtering**: More granular control over which files to debug
2. **Performance profiling**: Integration with Xdebug's profiling features
3. **Console evaluation**: Better PHP expression evaluation in DevTools console
4. **Hot reload**: Reload PHP code without restarting the server

### IDE improvements

1. **Selective IDE configuration**: Choose which IDE to configure with `--experimental-unsafe-ide-integration=vscode`
2. **Delayed Xdebug activation**: Disable Xdebug during Blueprint execution
3. **Better error handling**: More informative error messages and recovery
4. **Configuration preservation**: Smarter handling of existing IDE configurations
5. **Additional IDE support**: Support for more IDEs beyond VSCode and PhpStorm

### General improvements

1. **Documentation**: More examples and use cases
2. **Performance**: Faster debugging with less overhead
3. **Stability**: Move features out of experimental status
4. **Integration**: Better integration with WordPress Playground Studio

---

## Additional Resources

### Documentation

-   [PHP WASM architecture overview](/developers/architecture/wasm-php-overview)
-   [Compiling PHP to WebAssembly](/developers/architecture/wasm-php-compiling)
-   [PHP WASM web API documentation](/api/web)
-   [WordPress Playground CLI documentation](/developers/apis/cli)

### External resources

-   [Xdebug official documentation](https://xdebug.org/docs/)
-   [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)
-   [DBGp Protocol Specification](https://xdebug.org/docs/dbgp)

### Related GitHub resources

-   [WordPress Playground repository](https://github.com/WordPress/wordpress-playground)
-   [PR #2411 - DevTools implementation](https://github.com/WordPress/wordpress-playground/pull/2411)
-   [PR #2777 - IDE integration implementation](https://github.com/WordPress/wordpress-playground/pull/2777)
-   [Issue #2763 - IDE integration motivation](https://github.com/WordPress/wordpress-playground/issues/2763)
-   [Issue #2288 - DevTools bridge](https://github.com/WordPress/wordpress-playground/issues/2288)
-   [Issue #2315 - Xdebug follow-up tasks](https://github.com/WordPress/wordpress-playground/issues/2315)

---

## Credits

These features were developed through collaboration between the WordPress Playground team:

**DevTools Integration (PR #2411)**:

-   [@mho22](https://github.com/mho22) - Implementation of Xdebug-to-CDP bridge
-   [@adamziel](https://github.com/adamziel) - Architecture and review
-   [@brandonpayton](https://github.com/brandonpayton) - Technical guidance
-   [@wojtekn](https://github.com/wojtekn) - Testing and feedback

**IDE Integration (PR #2777)**:

-   [@mho22](https://github.com/mho22) - Initial implementation
-   [@adamziel](https://github.com/adamziel) - Code review and enhancements
-   [@brandonpayton](https://github.com/brandonpayton) - Testing, refinements, and test coverage

---

## Getting Help

If you encounter issues not covered in this guide:

1. **Check the console**: Look for error messages when starting the CLI
2. **Enable verbose logging**: Use `--verbosity=debug` for detailed output
3. **Search existing issues**: Check the [WordPress Playground issues](https://github.com/WordPress/wordpress-playground/issues)
4. **Open a new issue**: Include:
    - Your OS and versions (Node.js, Chrome, IDE)
    - The exact command you're running
    - Console output and error messages
    - Steps to reproduce the problem

For quick questions, you can also reach the team through the [WordPress Playground discussions](https://github.com/WordPress/wordpress-playground/discussions).
