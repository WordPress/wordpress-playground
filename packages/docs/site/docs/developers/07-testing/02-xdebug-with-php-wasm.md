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

Xdebug compiles directly into the PHP WASM binary and can be enabled with a simple `--xdebug` flag. Once enabled, it provides full debugging capabilities in both browser and Node.js environments:

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

1. **Chrome DevTools integration**: Debug PHP directly in your browser using Chrome's built-in developer tools
2. **IDE integration**: Connect Xdebug to VSCode or PhpStorm for a full-featured debugging experience
3. **Installation methods**: Multiple ways to run PHP WASM with Xdebug enabled

Choose the debugging environment that best fits your workflow, or use both depending on your needs.

---

## PHP WASM CLI vs Playground CLI

Choose the appropriate tool for your debugging needs:

### PHP WASM CLI

Use PHP WASM CLI (`@php-wasm/cli`) when you want to:

-   Debug standalone PHP scripts without WordPress
-   Test PHP code in isolation
-   Develop PHP libraries or utilities
-   Run quick PHP experiments with debugging enabled

Install the package:

```bash
$ npm install @php-wasm/cli
```

Execute a PHP script with debugging:

```bash
$ npx @php-wasm/cli@latest --xdebug script.php
```

### Playground CLI

Use Playground CLI (`@wp-playground/cli`) when you want to:

-   Debug full WordPress installations
-   Test WordPress plugins or themes
-   Debug WordPress core functionality
-   Work with the complete WordPress environment

Install the package:

```bash
$ npm install @wp-playground/cli
```

Start a WordPress server with debugging:

```bash
$ npx @wp-playground/cli@latest server --xdebug
```

---

## Installation methods

Choose one of the following installation methods based on your development workflow:

### Installing from NPM (recommended)

For production use or stable versions, install the published packages.

Install PHP WASM CLI:

```bash
$ npm install @php-wasm/cli
```

Install Playground CLI:

```bash
$ npm install @wp-playground/cli
```

### Running with npx

For quick testing without installation, use npx to run the CLI tools directly.

Run PHP WASM CLI:

```bash
$ npx @php-wasm/cli@latest --xdebug <var>SCRIPT_PATH</var>
```

Run Playground CLI:

```bash
$ npx @wp-playground/cli@latest server --xdebug
```

Where:

-   `<var>SCRIPT_PATH</var>`: Path to your PHP script file

### Installing from the WordPress Playground repository

For development and testing of Playground itself, clone and run from the repository.

Navigate to the repository:

```bash
$ cd wordpress-playground
```

Run PHP WASM CLI locally:

```bash
$ node --no-warnings=ExperimentalWarning \
  --experimental-strip-types \
  --experimental-transform-types \
  --import ./packages/meta/src/node-es-module-loader/register.mts \
  ./packages/php-wasm/cli/src/main.ts --xdebug
```

Run Playground CLI locally:

```bash
$ node --no-warnings=ExperimentalWarning \
  --experimental-strip-types \
  --experimental-transform-types \
  --import ./packages/meta/src/node-es-module-loader/register.mts \
  ./packages/playground/cli/src/cli.ts server --xdebug
```

### Using local package repository

For testing local changes before publishing, run the local package repository script.

Navigate to the repository and start the local package server:

```bash
$ cd wordpress-playground
$ npm run local-package-repository
```

The script outputs local package URLs. Add these URLs to your project's `package.json` file. Example configuration:

```json
{
	"type": "module",
	"dependencies": {
		"@php-wasm/node": "http://127.0.0.1:9724/<var>BUILD_ID</var>/v3.0.12/@php-wasm-node-3.0.12.tar.gz",
		"@php-wasm/cli": "http://127.0.0.1:9724/<var>BUILD_ID</var>/v3.0.12/@php-wasm-cli-3.0.12.tar.gz",
		"@wp-playground/cli": "http://127.0.0.1:9724/<var>BUILD_ID</var>/v3.0.12/@wp-playground-cli-3.0.12.tar.gz"
	}
}
```

Where:

-   `<var>BUILD_ID</var>`: Unique build identifier generated by the local package server

Then install the packages:

```bash
$ npm install
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
-   Want to see browser-specific interactions

### When to use IDE integration

Choose IDE integration when you:

-   Have complex, multi-file debugging needs
-   Prefer debugging within your code editor
-   Want advanced features like conditional breakpoints
-   Need better code navigation and project awareness

---

## Chrome DevTools integration

### What is the DevTools integration?

The `--experimental-devtools` option enables debugging PHP code directly in Chrome DevTools using a bridge between Xdebug's DBGp protocol and Chrome's Chrome DevTools Protocol (CDP). This allows you to debug PHP WASM code in your browser just like you would debug JavaScript.

**[Image placeholder: Chrome DevTools connected to Xdebug showing PHP code with syntax highlighting]**  
_Alt text: DevTools Sources panel showing PHP files_

### How it works

The integration consists of three components:

1. **Xdebug DBGp server**: Runs on port 9003 (standard Xdebug 3 port)
2. **CDP server**: Runs on port 9229 (standard Chrome DevTools port)
3. **Bridge**: Translates between DBGp and CDP protocols in real-time

When you run PHP code with Xdebug enabled, the bridge automatically:

-   Forwards debugging commands from Chrome DevTools to Xdebug
-   Translates stack traces, variables, and breakpoints between protocols
-   Provides source code mapping for the Virtual File System

### Code syntax highlighting in DevTools

DevTools displays PHP code with full syntax highlighting using a specialized approach:

-   Uses the Network protocol instead of `Debugger.scriptParsed`
-   Provides proper MIME type (`application/x-httpd-php`) to enable CodeMirror highlighting
-   Maps file URIs correctly to the Virtual File System
-   Loads source files before PHP execution begins

This ensures you see color-coded PHP syntax just like JavaScript in the Sources panel.

**[Image placeholder: DevTools showing syntax-highlighted PHP code]**  
_Alt text: PHP code with syntax highlighting in DevTools_

### Setting up Chrome DevTools debugging

#### Prerequisites

-   Chrome, Chromium, or any Chromium-based browser (Edge, Brave, etc.)
-   Node.js with WebAssembly support

#### Basic setup

**Step 1: Start Playground CLI with DevTools**

Start the Playground CLI with both the `--xdebug` and `--experimental-devtools` flags:

```bash
$ npx @wp-playground/cli@latest server --xdebug --experimental-devtools
```

The terminal displays output confirming the server is running:

```
Starting a PHP server...
Setting up WordPress...
WordPress is running on http://127.0.0.1:9400

Connect Chrome DevTools to CDP at:
devtools://devtools/bundled/inspector.html?ws=localhost:9229

Waiting for Chrome to connect...
```

**[Image placeholder: Terminal showing Playground CLI output with DevTools connection URL]**  
_Alt text: Terminal displaying Xdebug receiver running_

**Step 2: Connect Chrome DevTools**

Open Chrome and navigate to the DevTools URL:

```
devtools://devtools/bundled/inspector.html?ws=localhost:9229
```

Alternatively, connect manually:

1. Open Chrome DevTools (F12)
2. Click the three dots menu → More tools → Remote devices
3. Click "Configure" and add `localhost:9229`
4. Click "Inspect"

The terminal confirms the connection:

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

**[Image placeholder: Chrome DevTools with breakpoint set and execution paused]**  
_Alt text: Breakpoint set on PHP line in DevTools_

### DevTools debugging workflow

#### File navigation

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

#### Setting breakpoints

-   **Line breakpoints**: Click the line number in the gutter
-   **Conditional breakpoints**: Right-click the line number → "Add conditional breakpoint"
-   **Logpoints**: Right-click the line number → "Add logpoint"

#### Debugging controls

Once execution pauses at a breakpoint:

-   **Resume** (F8): Continue execution
-   **Step over** (F10): Execute the current line and move to the next
-   **Step into** (F11): Enter the function being called
-   **Step out** (Shift+F11): Exit the current function
-   **Step** (F9): Execute the next statement

#### Inspecting data

-   **Scope panel**: View local and global variables
-   **Watch panel**: Add expressions to watch
-   **Call stack**: See the full call stack
-   **Console**: Evaluate PHP expressions (limited support)

**[Image placeholder: DevTools Variables panel showing PHP variable values]**  
_Alt text: Variables panel showing PHP scope_

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

Configure the bridge to skip internal Playground files:

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

If the default ports are in use, specify custom ports:

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

**Symptoms**: Chrome DevTools shows "WebSocket disconnected" or fails to connect.

**Solutions**:

-   Verify the CDP server is running (check terminal output)
-   Ensure port 9229 is not blocked by a firewall
-   Try closing and reopening Chrome DevTools
-   Check that you're using the correct WebSocket URL

#### Breakpoints not being hit

**Symptoms**: Breakpoints appear but execution doesn't pause.

**Solutions**:

-   Make sure your PHP code is actually being executed
-   Verify the file path matches exactly (case-sensitive)
-   Check that Xdebug is enabled (look for terminal output confirming connection)
-   Try setting a breakpoint on a different line

#### Source files not appearing

**Symptoms**: The Sources panel doesn't show PHP files.

**Solutions**:

-   Trigger PHP execution first (visit the Playground site)
-   Refresh the DevTools sources tree
-   Check that files exist in the Virtual File System

#### Performance issues

**Symptoms**: Debugging is slow or unresponsive.

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

---

## IDE integration

### What is IDE integration?

The `--experimental-unsafe-ide-integration` flag automates IDE configuration for Xdebug debugging, enabling you to debug PHP WASM code directly in your IDE (VSCode or PhpStorm) with full breakpoint support, variable inspection, and call stack analysis.

**[Image placeholder: VSCode with Run and Debug panel showing Xdebug configuration]**  
_Alt text: VSCode debug panel with Xdebug config_

### Why two debugging options?

WordPress Playground offers both Chrome DevTools and IDE integration because they serve different use cases:

-   **DevTools**: Browser-based, no IDE required, great for quick debugging
-   **IDE integration**: Full IDE features, better for complex projects, professional workflows

You can use both simultaneously if needed.

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

## Setting up IDE integration

### Prerequisites

**For VSCode:**

Install the [PHP Debug extension](https://marketplace.visualstudio.com/items?itemName=xdebug.php-debug).

**For PhpStorm:**

No additional plugins required (built-in Xdebug support).

### Basic setup

**Step 1: Start Playground with IDE integration**

Start the Playground CLI with both flags enabled:

```bash
$ npx @wp-playground/cli@latest server \
  --xdebug \
  --experimental-unsafe-ide-integration
```

The terminal displays configuration information:

```
Starting a PHP server...
Xdebug configured successfully
Updated IDE config: .vscode/launch.json .idea/workspace.xml
Playground source root: .playground-xdebug-root

VS Code / Cursor instructions:
1. Open the Run and Debug panel on the left sidebar
2. Select "WP Playground CLI - Listen for Xdebug" from the dropdown
3. Click "Start Debugging"
4. Set a breakpoint in .playground-xdebug-root/wordpress/index.php
5. Visit Playground in your browser to hit the breakpoint
```

**Step 2: Configure your IDE**

The CLI automatically creates debug configurations. Start the debugger in your IDE.

**Step 3: Set breakpoints**

Set breakpoints in your PHP files—either in your local files or in the `.playground-xdebug-root/` directory to debug VFS files.

**Step 4: Trigger execution**

Visit your Playground site in the browser to trigger the breakpoints.

### VSCode setup

#### Detailed VSCode instructions

**Step 1: Start the CLI**

Start the Playground CLI with both flags:

```bash
$ npx @wp-playground/cli@latest server \
  --xdebug \
  --experimental-unsafe-ide-integration
```

**Step 2: Open VSCode's Run and Debug panel**

Open the debugging panel:

-   Press `Ctrl+Shift+D` (Windows/Linux) or `Cmd+Shift+D` (Mac)
-   Or click the Run and Debug icon in the left sidebar

**Step 3: Select the debug configuration**

Select the configuration:

-   Click the dropdown at the top of the panel
-   Select "WP Playground CLI - Listen for Xdebug"

**Step 4: Start the debugger**

Start debugging:

-   Click the green play button or press `F5`
-   You should see "Listening on port 9003" in the debug console

**Step 5: Set breakpoints**

Set breakpoints in your code:

-   Open any PHP file
-   Click in the gutter (left of line numbers) to set breakpoints
-   Red dots appear where breakpoints are set

**Step 6: Trigger the breakpoint**

Trigger execution:

-   Visit `http://127.0.0.1:9400` (or your configured port) in your browser
-   VSCode should pause at your breakpoint

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

**Step 1: Start the CLI**

Start the Playground CLI with both flags:

```bash
$ npx @wp-playground/cli@latest server \
  --xdebug \
  --experimental-unsafe-ide-integration
```

**Step 2: Select the debug configuration**

Select the configuration:

-   Find the debug configurations dropdown in the toolbar (top right)
-   Select "WP Playground CLI - Listen for Xdebug"

**Step 3: Start the debugger**

Start debugging:

-   Click the debug button (bug icon) next to the dropdown
-   Or press `Shift+F9`
-   The debug button should turn green

**Step 4: Set breakpoints**

Set breakpoints in your code:

-   Open any PHP file
-   Click in the gutter (left of line numbers) to set breakpoints

**Step 5: Trigger the breakpoint**

Trigger execution:

-   Visit your Playground site in the browser
-   PhpStorm should pause at your breakpoint

#### PhpStorm configuration details

The CLI automatically creates a server configuration in `.idea/workspace.xml`:

-   **Server name**: WP Playground CLI - Listen for Xdebug
-   **Host**: `127.0.0.1:9400` (combined host:port)
-   **IDE Key**: `PLAYGROUNDCLI`
-   **Path mappings**: Automatic mappings for all mounted directories

**Note**: PhpStorm requires the full host:port in the `host` field. The separate `port` field is ignored, so the configuration uses `host: "host:port"`.

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

**[Image placeholder: File explorer showing .playground-xdebug-root symlink]**  
_Alt text: Playground symlink in project directory_

### Why do we need it?

Without this symlink, your IDE cannot see files that exist only in the VFS (like WordPress core files, uploaded plugins, or theme files). The symlink makes these files accessible to your IDE so you can:

-   Set breakpoints in VFS files
-   Navigate the VFS structure
-   Debug WordPress core code
-   Inspect mounted plugins and themes

### Structure example

```
your-project/
├── .playground-xdebug-root -> /tmp/playground-cli-<var>TEMP_ID</var>/
│   ├── wordpress/
│   │   ├── index.php
│   │   ├── wp-config.php
│   │   └── wp-content/
│   │       └── plugins/
│   └── your-mounted-files/
├── your-local-code/
└── .vscode/ or .idea/
```

Where:

-   `<var>TEMP_ID</var>`: Unique temporary directory identifier

### Browsing the VFS

Browse the `.playground-xdebug-root` directory directly in your IDE:

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

Add to your `.gitignore` file:

```gitignore
# Playground Xdebug integration
.playground-xdebug-root
```

---

## Configuration management

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

## Advanced usage

### Combining DevTools and IDE integration

Use both debugging methods simultaneously:

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

Debug specific PHP files using one of these methods.

**Direct execution with PHP WASM CLI:**

```bash
$ npx @php-wasm/cli@latest --xdebug <var>SCRIPT_PATH</var>
```

**Programmatic execution:**

```javascript
const result = await playground.run({
	scriptPath: '<var>FILE_PATH</var>',
});
```

Where:

-   `<var>SCRIPT_PATH</var>`: Path to your PHP script file
-   `<var>FILE_PATH</var>`: Path to the file within the VFS

### Debugging WordPress plugins

**Setup:**

Navigate to your plugin directory and start the Playground CLI:

```bash
$ cd <var>PLUGIN_PATH</var>
$ npx @wp-playground/cli@latest server \
  --auto-mount=. \
  --xdebug \
  --experimental-unsafe-ide-integration
```

Where:

-   `<var>PLUGIN_PATH</var>`: Path to your WordPress plugin directory

**Workflow:**

1. Your plugin code is automatically mounted to `/wordpress/wp-content/plugins/<var>PLUGIN_NAME</var>`
2. Set breakpoints in your local plugin files
3. Visit the Playground site to trigger execution
4. Debug as normal

Where:

-   `<var>PLUGIN_NAME</var>`: Your plugin's directory name

### Debugging during Blueprint execution

**Note**: Xdebug is active even during Blueprint execution. This may not be desirable as it can slow down the initial setup.

**Current behavior**: The debugger may pause during WordPress installation and plugin activation.

**Future improvement**: A future update will add an option to disable Xdebug until WordPress fully boots.

---

## Complete debugging workflow

### Workflow: Debugging with Chrome DevTools

This workflow demonstrates quick debugging of a PHP script without setting up an IDE.

**Step 1: Create a test script**

Create a simple PHP script to debug:

```bash
$ cat > test.php << 'EOF'
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
```

**Step 2: Start PHP WASM CLI with DevTools**

Start the CLI with Xdebug and DevTools enabled:

```bash
$ npx @php-wasm/cli@latest --xdebug --experimental-devtools
```

**Step 3: Execute the script**

In another terminal, execute the script:

```bash
$ npx @php-wasm/cli@latest --xdebug test.php
```

**Step 4: Connect Chrome DevTools**

Open Chrome and navigate to:

```
devtools://devtools/bundled/inspector.html?ws=localhost:9229
```

**Step 5: Set breakpoints and debug**

Set breakpoints in `test.php` and debug your code using the DevTools interface.

### Workflow: Debugging with VSCode

This workflow demonstrates debugging a WordPress plugin with full IDE features.

**Step 1: Navigate to your plugin directory**

Change to your plugin directory:

```bash
$ cd <var>PLUGIN_PATH</var>
```

**Step 2: Start Playground with IDE integration**

Start the Playground CLI with IDE integration:

```bash
$ npx @wp-playground/cli@latest server \
  --auto-mount=. \
  --xdebug \
  --experimental-unsafe-ide-integration
```

The terminal confirms configuration:

```
WordPress is running on http://127.0.0.1:9400
Updated IDE config: .vscode/launch.json
Playground source root: .playground-xdebug-root
```

**Step 3: Open VSCode**

Open VSCode in the current directory:

```bash
$ code .
```

**Step 4: Start debugging**

Press `F5` to start debugging.

**Step 5: Set breakpoints**

Set breakpoints in your plugin files.

**Step 6: Trigger execution**

Visit `http://127.0.0.1:9400` in your browser.

**Step 7: Debug**

The debugger pauses at your breakpoints. Inspect variables and step through code.

---

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

### Symlink issues on Windows

**Symptoms**: `.playground-xdebug-root` symlink fails to create

**Solutions**:

-   Run your terminal as Administrator
-   Enable Developer Mode in Windows Settings
-   Consider using WSL2 for development
-   Alternatively, use DevTools integration which doesn't require symlinks

---

## Best practices

### Use .gitignore

Always add Playground-generated files to `.gitignore`:

```gitignore
# Playground Xdebug integration
.playground-xdebug-root

# IDE-specific (optional, some teams commit these)
.vscode/launch.json
.idea/workspace.xml
```

### Choose the right tool

Select the appropriate debugging tool based on your needs:

-   **Quick fixes**: Use Chrome DevTools
-   **Complex debugging**: Use IDE integration
-   **Learning/teaching**: DevTools is more visual
-   **Professional development**: IDE integration

### Set strategic breakpoints

Use breakpoints effectively:

-   Focus on problem areas
-   Use conditional breakpoints for specific conditions
-   Remove breakpoints when done debugging

### Leverage the VFS symlink

The `.playground-xdebug-root` symlink gives you visibility:

-   Browse WordPress core code
-   Understand plugin interactions
-   Debug third-party code

### Clean up after debugging

When done debugging:

-   Stop the debugger in your IDE
-   Close DevTools tabs
-   Stop the Playground CLI
-   Consider removing the `.playground-xdebug-root` symlink

---

## Roadmap and future improvements

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

## Additional resources

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

## Getting help

If you encounter issues not covered in this guide:

1. **Check the console**: Look for error messages when starting the CLI
2. **Enable verbose logging**: Use `--verbosity=debug` for detailed output
3. **Search existing issues**: Check the [WordPress Playground issues](https://github.com/WordPress/wordpress-playground/issues)
4. **Open a new issue**: Include:
    - Your OS and versions (Node.js, Chrome, IDE)
    - The exact command you're running
    - Console output and error messages
    - Steps to reproduce the problem
