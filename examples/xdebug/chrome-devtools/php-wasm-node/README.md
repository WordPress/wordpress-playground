## About

Use PHP.wasm Node with Xdebug enabled

> [!WARNING]
> Debugging with Google Chrome DevTools is still experimental

<br>

## Installation

This directory shows how to use Xdebug with the Xdebug Bridge in multiple use cases :

- [How to start a bridge before running a script](#how-to-start-a-bridge-before-running-a-script)
- [How to run a script starting the bridge](#how-to-run-a-script-starting-the-bridge)

<br>

## <a id="how-to-start-a-bridge-before-running-a-script"></a>How to start a bridge before running a script

#### 1. Install dependencies

```bash
npm install
```

<br>

#### 2. Run Xdebug bridge in a separate terminal

```bash
node_modules/.bin/xdebug-bridge
```

```
Starting XDebug Bridge...
Connect Chrome DevTools to CDP at:
devtools://devtools/bundled/inspector.html?ws=127.0.0.1:9229
```

<br>

#### 3. Connect to Google Chrome Devtools and open the Devtools Console

```
🎉 Welcome to WordPress Playground DevTools! 🎉
   ‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾

1. Add breakpoints in your files to start step debugging.
2. Run your php file, project, plugin or theme using PHP.wasm or Playground CLI.
3. Witness the magic break.
```

<br>

#### 4. Run script

```bash
node src/script.js
```

```
Output!
Hello Xdebug World!
```

> [!NOTE]
> Nothing happens because no breakpoints have been set yet

<br>

#### 5. Set a breakpoint in `src/test.php` in Chrome Devtools

<br>

#### 6. Re-run the script

```bash
node src/script.js
```

<br>

#### 7. Witness the magic break

<br>
<br>

## <a id="how-to-run-a-script-starting-the-bridge"></a>How to run a script starting the bridge

#### 1. Install dependencies

```bash
npm install
```

<br>

#### 2. Run script

```bash
node src/script-with-bridge.js
```

```
Starting XDebug Bridge...
Connect Chrome DevTools to CDP at:
devtools://devtools/bundled/inspector.html?ws=127.0.0.1:9229
```

<br>

#### 3. Connect to Google Chrome Devtools and open the Devtools Console

```
🎉 Welcome to WordPress Playground DevTools! 🎉
   ‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾

1. Add breakpoints in your files to start step debugging.
2. Run your php file, project, plugin or theme using PHP.wasm or Playground CLI.
3. Witness the magic break.

Output!
Hello Xdebug World!
```

> [!NOTE]
> Nothing happens because no breakpoints have been set yet

<br>

#### 4. Set a breakpoint in `src/test.php` in Chrome Devtools

<br>

#### 5. Re-run the script and reconnect to Devtools

```bash
node src/script-with-bridge.js
```

```
Starting XDebug Bridge...
Connect Chrome DevTools to CDP at:
devtools://devtools/bundled/inspector.html?ws=127.0.0.1:9229
```

<br>

#### 6. Witness the magic break
