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

## Getting started

This guide covers:

1. Multiple installation methods for running PHP WASM with Xdebug enabled
2. How to choose the right debugging environment for your workflow
3. Environment-specific setup instructions for Chrome DevTools and IDEs

Whether you're debugging WordPress plugins, developing browser-based PHP applications, or building educational tools, this guide provides the foundation you need to start debugging effectively.

---

## Installation methods

There are 4 primary ways to run PHP WASM with Xdebug support:

### 1. Directly from the WordPress Playground repository

Clone and run from the WordPress Playground repository for development and testing.

Navigate to the repository:

```bash
cd wordpress-playground
```

**PHP WASM CLI:**

Run the following command:

```bash
$ node \
  --no-warnings=ExperimentalWarning \
  --experimental-strip-types \
  --experimental-transform-types \
  --import ./packages/meta/src/node-es-module-loader/register.mts \
  ./packages/php-wasm/cli/src/main.ts --xdebug
```

**Playground CLI:**

Run the following command:

```bash
$ node \
  --no-warnings=ExperimentalWarning \
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

The script outputs local package URLs:

```
http://127.0.0.1:9724/7840495c41d5c5ae535da114/v3.0.12/@php-wasm-universal-3.0.12.tar.gz
http://127.0.0.1:9724/7840495c41d5c5ae535da114/v3.0.12/@php-wasm-node-3.0.12.tar.gz
http://127.0.0.1:9724/7840495c41d5c5ae535da114/v3.0.12/@php-wasm-cli-3.0.12.tar.gz
http://127.0.0.1:9724/7840495c41d5c5ae535da114/v3.0.12/@wp-playground-cli-3.0.12.tar.gz
```

Add these URLs to your project's `package.json` file:

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

Install the packages:

```bash
$ npm install
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

### Step 1: Select your debugging environment

Select the debugging environment that best fits your workflow:

#### Option A: Chrome DevTools

Debug directly in the Chrome browser using built-in developer tools. This is ideal for:

-   Quick debugging sessions
-   Visual debugging in the browser
-   Frontend developers familiar with Chrome DevTools
-   Situations where you don't want to configure an IDE

#### Option B: IDE integration

Connect Xdebug to your preferred IDE (VSCode, PhpStorm, etc.) for a full-featured debugging experience. This is best for:

-   Complex debugging sessions
-   Professional PHP development workflows
-   Projects requiring advanced debugging features
-   Teams already using PHP-capable IDEs

### Step 2: Follow environment-specific instructions

Depending on your choice, refer to the appropriate setup guide:

-   **Chrome DevTools**: See the [Chrome DevTools debugging guide](#) for configuration details
-   **IDE integration**: See the [IDE setup guide](#) for your preferred editor

These guides cover:

-   Configuration details for your chosen environment
-   Setting up breakpoints and watches
-   Connecting the debugger
-   Troubleshooting common issues
-   Best practices for debugging PHP WASM applications

---

## Additional resources

-   [PHP WASM architecture overview](https://wordpress.github.io/wordpress-playground/developers/architecture/wasm-php-overview)
-   [Compiling PHP to WebAssembly](https://wordpress.github.io/wordpress-playground/developers/architecture/wasm-php-compiling)
-   [PHP WASM web API documentation](https://wordpress.github.io/wordpress-playground/api/web)
-   [Xdebug official documentation](https://xdebug.org/docs/)
-   [WordPress Playground GitHub repository](https://github.com/WordPress/wordpress-playground)

---

## Troubleshooting

If you encounter issues:

1. **Verify Xdebug is enabled**: Check that you're using the `--xdebug` flag when starting PHP WASM
2. **Check Node.js version**: Ensure you're using a compatible Node.js version that supports the experimental features
3. **Port conflicts**: If debugging ports are in use, configure alternative ports in your Xdebug settings
4. **Browser compatibility**: For browser-based debugging, ensure you're using a modern browser with WebAssembly support
5. **Review logs**: Check console output for Xdebug initialization messages and error details

For more help, consult the environment-specific guides or open an issue in the WordPress Playground repository.
