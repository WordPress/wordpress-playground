---
title: Debugging with Xdebug in PHP WASM CLI
slug: /developers/xdebug/xdebug-on-php-wasm
description: Debug PHP in WebAssembly with Xdebug using VS Code, Cursor, or PhpStorm. Set breakpoints and inspect variables.
---

# Debugging with Xdebug in PHP WASM CLI

The **php-wasm CLI** supports Xdebug, allowing developers to debug PHP code running within the WebAssembly environment. Set breakpoints, step through code execution, inspect variables, and modify them at runtime.

PHP WASM CLI debugs any PHP code—you don't need WordPress. This works for all PHP developers.

## Prerequisites

You need an IDE that supports Xdebug and its configuration file.

-   **A configuration file:** For example, `.vscode/launch.json` for VS Code-based IDEs and `.idea/workspace.xml` for PhpStorm
-   **VS Code / Cursor:** We recommend the official [PHP Debug extension](https://marketplace.visualstudio.com/items?itemName=xdebug.php-debug).
-   **PhpStorm:** supports Xdebug natively.

## Usage Guide

### 1. Create or select your PHP file

This example demonstrates Xdebug debugging:

```php
<?php

$test = 42; // Set a breakpoint on this line

echo "Output!\n";

function test( $output ) {
    echo "Hello Xdebug World!\n" . $output . "\n";
}

test($test);
```

### 2. Configure your IDE

Before running the script, prepare your IDE to listen for the Xdebug connection.

#### **VS Code / Cursor Instructions**

1.  Ensure you have installed the **PHP Debug** extension.
2.  Open the **Run and Debug** panel on the left sidebar.
3.  Click **"Listen for Xdebug"** from the configuration dropdown.
4.  Click the **Start Debugging** (play button) icon.

#### **PhpStorm Instructions**

1.  Choose the **"PHP.wasm CLI - Listen for Xdebug"** debug configuration in the toolbar.
2.  Click the **Debug** button (bug icon).

### 3. Set a Breakpoint

Open your target file (e.g., `src/test.php`) and set a breakpoint on the desired line.

### 4. Run the CLI Command

Execute the script using the CLI. You must include the `--xdebug` flag to enable the connection.

```bash
npx @php-wasm/cli@latest --xdebug src/test.php
```

> **Note:** Start your IDE's debug listener before running this command. Otherwise, Xdebug waits indefinitely for the connection.

![PhpStorm running Xdebug with PHP WASM](@site/static/img/developers/xdebug/xdebug-with-php-wasm.webp)

If you don't have the IDE set up, you can use the experimental flag `--experimental-unsafe-ide-integration`, passing the IDE that you would like to set, `vscode` or `phpstorm`. The flag is also set as unsafe because it can overwrite the previous configuration of your IDE.

```bash
npx @php-wasm/cli@latest --xdebug --experimental-unsafe-ide-integration=phpstorm src/test.php
```

### 5. Start Debugging

Once the command is running and your IDE is listening:

1.  The execution will pause at your defined breakpoint.
2.  If no breakpoint is set, execution will automatically break on the first line.
3.  You can now inspect variables, call stacks, and step through the code.

**Example Output:**

```text
Output!
Hello Xdebug World!
42
```

---

## Command Reference

| Flag                                    | Description                                                               |
| :-------------------------------------- | :------------------------------------------------------------------------ |
| `--xdebug`                              | Enables the Xdebug extension within the WASM environment.                 |
| `--experimental-unsafe-ide-integration` | Allows the WASM instance to communicate with the IDE on the host machine. |
