## About

Use PHP.wasm CLI with Xdebug enabled

> [!WARNING]
> Debugging with Google Chrome DevTools is still experimental

<br>

## Installation

#### 1. Install dependencies

```bash
npm install
```

<br>

#### 2. Run script with CLI

```bash
node_modules/.bin/php-wasm-cli --xdebug --experimental-devtools src/test.php
```

```
Starting XDebug Bridge...
Connect Chrome DevTools to CDP at:
devtools://devtools/bundled/inspector.html?ws=127.0.0.1:9229
```

<br>

#### 3. Connect to Chrome Devtools and open the Devtools Console

```
🎉 Welcome to WordPress Playground DevTools! 🎉
   ‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾

1. Add breakpoints in your files to start step debugging.
2. Run your php file, project, plugin or theme using PHP.wasm or Playground CLI.
3. Witness the magic break.
```

<br>

#### 4. Witness the magic break

> [!NOTE]
> When using the PHP.wasm CLI with Xdebug enabled, execution will automatically break on the first line
