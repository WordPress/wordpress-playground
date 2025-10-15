# Using Xdebug with PHP WASM

## Introduction

### What is Xdebug?

Xdebug is a powerful debugging and profiling extension for PHP that provides developers with essential tools for troubleshooting and optimizing their code. Originally designed for traditional PHP installations, Xdebug has been successfully integrated into PHP WASM, bringing professional debugging capabilities to WebAssembly environments.

Key Xdebug features available in PHP WASM:

-   **Step debugging** with breakpoints and variable inspection
-   **Stack traces** with detailed error information across the WASM boundary
-   **Code coverage** analysis for testing WordPress plugins and themes
-   **Profiling** to identify performance bottlenecks in the WASM runtime
-   **Remote debugging** capabilities for browser-based and Node.js environments

### Why Xdebug is Important for PHP WASM

Debugging PHP WASM presents unique challenges that make Xdebug integration crucial:

**The WebAssembly Black Box Problem**
WebAssembly code runs in a sandboxed environment with limited visibility. Without proper debugging tools, PHP WASM becomes a "black box" where:

-   Errors may not surface clearly in browser/Node.js console
-   Stack traces can be difficult to interpret across the JavaScript-WASM boundary
-   Variable inspection requires manual logging
-   Performance bottlenecks are hard to identify

**Bridging Traditional PHP Development**
Developers coming from traditional PHP environments expect familiar debugging workflows. Xdebug provides:

-   **Seamless transition**: Use the same debugging tools and techniques you know
-   **IDE integration**: Connect to VSCode, PhpStorm, and other popular IDEs
-   **Step debugging**: Set breakpoints, step through code, and inspect variables just like native PHP
-   **Profiling data**: Identify performance issues specific to the WASM environment

**WordPress Playground-Specific Benefits**
For WordPress Playground development, Xdebug is essential because:

-   **Complex interactions**: Debug the interplay between WordPress, PHP WASM, and JavaScript
-   **Plugin/theme development**: Test and troubleshoot extensions in a sandboxed environment
-   **Educational value**: Students can learn PHP debugging in an accessible browser environment
-   **Remote debugging**: Debug WordPress sites running entirely in the browser

**WebAssembly Performance Insights**
Xdebug helps identify WASM-specific issues:

-   Overhead from JavaScript-to-WASM calls
-   Memory management in the sandboxed environment
-   I/O operations across the virtual filesystem
-   Network request handling through fetch proxies

Without Xdebug, developers working with PHP WASM would need to rely on primitive debugging methods (echo statements, error_log) that are inadequate for modern application development. Xdebug transforms PHP WASM from an experimental technology into a production-ready development platform.

### How Xdebug Works with PHP WASM

Xdebug is compiled directly into the PHP WASM binary and can be enabled with a simple `--xdebug` flag. Once enabled, it provides full debugging capabilities in both browser and Node.js environments:

-   **Breakpoint debugging**: Pause execution at specific lines of code
-   **Variable inspection**: Examine variable values at runtime
-   **Step execution**: Step over, into, and out of functions
-   **Call stack analysis**: Trace function calls across your application
-   **Performance profiling**: Generate cachegrind files for analysis
-   **Code coverage**: Track which lines of code are executed

The integration works seamlessly with standard Xdebug protocols (DBGp), meaning you can use existing IDE configurations and debugging tools without modification.

---

## About This Guide

This guide will help you set up and use Xdebug with PHP WASM in WordPress Playground. You'll learn:

1. Multiple installation methods for running PHP WASM with Xdebug enabled
2. How to choose the right debugging environment for your workflow
3. Environment-specific setup instructions for Chrome DevTools and IDEs

Whether you're debugging WordPress plugins, developing browser-based PHP applications, or building educational tools, this guide provides the foundation you need to start debugging effectively.

---

## Installation Methods

There are four primary ways to run PHP WASM with Xdebug support:

### 1. Directly from the WordPress Playground Repository

Clone and run from the WordPress Playground repository for development and testing:

```bash
cd wordpress-playground
```

**PHP WASM CLI:**

```bash
node \
  --no-warnings=ExperimentalWarning \
  --experimental-strip-types \
  --experimental-transform-types \
  --import ./packages/meta/src/node-es-module-loader/register.mts \
  ./packages/php-wasm/cli/src/main.ts --xdebug
```

**Playground CLI:**

```bash
node \
  --no-warnings=ExperimentalWarning \
  --experimental-strip-types \
  --experimental-transform-types \
  --import ./packages/meta/src/node-es-module-loader/register.mts \
  ./packages/playground/cli/src/cli.ts server --xdebug
```

### 2. Using Local Package Repository

For testing local changes before publishing, run the local package repository script:

```bash
cd wordpress-playground
npm run local-package-repository
```

This will output local package URLs:

```
http://127.0.0.1:9724/7840495c41d5c5ae535da114/v3.0.12/@php-wasm-universal-3.0.12.tar.gz
http://127.0.0.1:9724/7840495c41d5c5ae535da114/v3.0.12/@php-wasm-node-3.0.12.tar.gz
http://127.0.0.1:9724/7840495c41d5c5ae535da114/v3.0.12/@php-wasm-cli-3.0.12.tar.gz
http://127.0.0.1:9724/7840495c41d5c5ae535da114/v3.0.12/@wp-playground-cli-3.0.12.tar.gz
```

Add these URLs to your project's `package.json`:

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

Then install:

```bash
npm install
```

### 3. Installing from NPM

For production use or stable versions, install the published packages:

```bash
npm install @php-wasm/node @php-wasm/cli @wp-playground/cli
```

### 4. Running with NPX

For quick testing without installation (CLI tools only):

```bash
# PHP WASM CLI
npx @php-wasm/cli --xdebug

# WordPress Playground CLI
npx @wp-playground/cli server --xdebug
```

---

## Getting Started with Xdebug

### Step 1: Choose Your Debugging Environment

Select the debugging environment that best fits your workflow:

#### Option A: Chrome DevTools

Debug directly in the Chrome browser using built-in developer tools. This is ideal for:

-   Quick debugging sessions
-   Visual debugging in the browser
-   Frontend developers familiar with Chrome DevTools
-   Situations where you don't want to configure an IDE

#### Option B: IDE Integration

Connect Xdebug to your preferred IDE (VSCode, PhpStorm, etc.) for a full-featured debugging experience. This is best for:

-   Complex debugging sessions
-   Professional PHP development workflows
-   Projects requiring advanced debugging features
-   Teams already using PHP-capable IDEs

### Step 2: Follow Environment-Specific Instructions

Depending on your choice, refer to the appropriate setup guide:

-   **Chrome DevTools**: Follow the instructions in the dedicated Chrome DevTools README
-   **IDE Integration**: Follow the instructions in the dedicated IDE setup README

These guides will cover:

-   Configuration details for your chosen environment
-   Setting up breakpoints and watches
-   Connecting the debugger
-   Troubleshooting common issues
-   Best practices for debugging PHP WASM applications

---

## Additional Resources

-   [PHP WASM Architecture Overview](https://wordpress.github.io/wordpress-playground/developers/architecture/wasm-php-overview)
-   [Compiling PHP to WebAssembly](https://wordpress.github.io/wordpress-playground/developers/architecture/wasm-php-compiling)
-   [PHP WASM Web API Documentation](https://wordpress.github.io/wordpress-playground/api/web)
-   [Xdebug Official Documentation](https://xdebug.org/docs/)
-   [WordPress Playground GitHub Repository](https://github.com/WordPress/wordpress-playground)

---

## Troubleshooting

If you encounter issues:

1. **Verify Xdebug is enabled**: Check that you're using the `--xdebug` flag when starting PHP WASM
2. **Check Node.js version**: Ensure you're using a compatible Node.js version that supports the experimental features
3. **Port conflicts**: If debugging ports are in use, configure alternative ports in your Xdebug settings
4. **Browser compatibility**: For browser-based debugging, ensure you're using a modern browser with WebAssembly support
5. **Review logs**: Check console output for Xdebug initialization messages and error details

For more help, consult the environment-specific README files or open an issue in the WordPress Playground repository.
