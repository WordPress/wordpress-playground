## About

Use WP Playground CLI with Xdebug enabled

> [!WARNING]
> Debugging with Google Chrome DevTools is still experimental

<br>

## Appendix

This directory shows how to use Xdebug with WP Playground CLI in Chrome Devtools in multiple use cases :

- [How to debug a file](#how-to-debug-a-file)
- [How to mount and debug a plugin](#how-to-mount-and-debug-a-plugin)

<br>

## <a id="how-to-debug-a-file"></a>How to debug a file

#### 1. Install dependencies

```bash
npm install
```

<br>

#### 2. Run script

```bash
node src/script.js
```

```
WordPress Playground CLI

PHP 8.4  WordPress latest
Extensions intl, xdebug
Mount ./src → /wordpress

Running Blueprint 100%

Ready! WordPress is running on http://127.0.0.1:9400 (6 workers)

Starting XDebug Bridge...
Connect Chrome DevTools to CDP at:
devtools://devtools/bundled/inspector.html?ws=localhost:9229
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

#### 4. Set a breakpoint in `PHP.wasm/wordpress/test.php` in Chrome Devtools

<br>

#### 5. Re-run script and reconnect to Chrome Devtools

```bash
node src/script.js
```

<br>

#### 6. Witness the magic break

<br>
<br>

## <a id="how-to-mount-and-debug-a-plugin"></a>How to mount and debug a plugin

#### 1. Install dependencies

```bash
npm install
```

#### 2. Run CLI command

```bash
node_modules/.bin/wp-playground-cli server --login --xdebug --experimental-devtools --mount=./plugin:/wordpress/wp-content/plugins/plugin
```

```
Starting a PHP server...
Setting up WordPress latest
Resolved WordPress release URL: https://downloads.w.org/release/wordpress-6.8.3.zip
Fetching SQLite integration plugin...
Booting WordPress...
PHP.request() is deprecated. Please use new PHPRequestHandler() instead.
Booted!
Running the Blueprint...
Logging in – 100%
Finished running the blueprint
WordPress is running on http://127.0.0.1:9400 with 1 worker(s)
Starting XDebug Bridge...
Connect Chrome DevTools to CDP at:
devtools://devtools/bundled/inspector.html?ws=127.0.0.1:9229
```

<br>

#### 3. Activate the `Simple Admin Message` plugin in WP admin's plugins section

> [!NOTE]
> You should see the message being displayed, but nothing else happens because the debugging server is not running yet

<br>

#### 4. Deactivate the `Simple Admin Message` plugin in WP admin's plugins section

<br>

#### 5. Connect to Google Chrome Devtools and open the Devtools Console

```
🎉 Welcome to WordPress Playground DevTools! 🎉
   ‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾

1. Add breakpoints in your files to start step debugging.
2. Run your php file, project, plugin or theme using PHP.wasm or Playground CLI.
3. Witness the magic break.
```

<br>

#### 6. Set a breakpoint in `PHP.wasm/wordpress/wp-content/plugins/plugin/index.php` on the `$message` variable line

<br>

#### 7. Reactivate the `Simple Admin Message` plugin

<br>

#### 8. Witness the magic break

> [!INFO]
> You may need to click the ⏸️ button in the right sidebar of DevTools to resume the process if it appears paused
