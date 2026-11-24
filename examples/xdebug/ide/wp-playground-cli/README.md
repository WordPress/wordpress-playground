## About

Use WP Playground CLI with Xdebug enabled

<br>

## Appendix

This directory shows how to use Xdebug with WP Playground CLI in multiple use cases :

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

If no project settings directory was found :

```
WordPress Playground CLI

PHP 8.4  WordPress latest
Extensions intl, xdebug
Mount ./src → /wordpress


Xdebug configuration failed.
No IDE-specific project settings directory was found in the current working directory.


Running Blueprint 100%

Ready! WordPress is running on http://127.0.0.1:9400 (6 workers)


Output!
Hello Xdebug World!
```

If `.vscode` directory exists :

```
WordPress Playground CLI

PHP 8.4  WordPress latest
Extensions intl, xdebug
Mount ./src → /wordpress


Xdebug configured successfully
Updated IDE config: .vscode/launch.json
Playground source root: .playground-xdebug-root – you can set breakpoints and preview Playground's VFS structure in there.

VS Code / Cursor instructions:
  1. Ensure you have installed an IDE extension for PHP Debugging
     (The PHP Debug extension by Xdebug has been a solid option)
  2. Open the Run and Debug panel on the left sidebar
  3. Select "WP Playground CLI - Listen for Xdebug" from the dropdown
  3. Click "start debugging"
  5. Set a breakpoint. For example, in .playground-xdebug-root/wordpress/index.php
  6. Visit Playground in your browser to hit the breakpoint


Running Blueprint 100%

Ready! WordPress is running on http://127.0.0.1:9400 (6 workers)


Output!
Hello Xdebug World!
```

If `.idea` directory exists :

```
WordPress Playground CLI

PHP 8.4  WordPress latest
Extensions intl, xdebug
Mount ./src → /wordpress


Xdebug configured successfully
Updated IDE config: .idea/workspace.xml .idea/php.xml
Playground source root: .playground-xdebug-root – you can set breakpoints and preview Playground's VFS structure in there.

PhpStorm instructions:
  1. Choose "WP Playground CLI - Listen for Xdebug" debug configuration in the toolbar
  2. Click the debug button (bug icon)`
  3. Set a breakpoint. For example, in .playground-xdebug-root/wordpress/index.php
  4. Visit Playground in your browser to hit the breakpoint

Running Blueprint 100%

Ready! WordPress is running on http://127.0.0.1:9400 (6 workers)


Output!
Hello Xdebug World!
```

> [!NOTE]
> Nothing happens because the debugging server is not running yet

##### Optional - Add path mappings and skippings using Xdebug in PHP.wasm 8.5

```typescript
const cliServer = await runCLI({
	php: '8.5',
	command: 'server',
	xdebug: {
		pathMappings: [ { hostPath: './src', vfsPath: '/wordpress' } ],
		pathSkippings: [ '/wordpress/foo.php', '/wordpress/bar' ] }
	},
	...
});
```

<br>

#### 3. Start debugging in your IDE

<br>

#### 4. Set a breakpoint in `src/test.php`

<br>

#### 5. Re-run script

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
node_modules/.bin/wp-playground-cli server --login --xdebug --experimental-unsafe-ide-integration --mount=./plugin:/wordpress/wp-content/plugins/plugin
```

If no project settings directory was found :

```
WordPress Playground CLI

PHP 8.3  WordPress latest
Extensions intl, redis, memcached, xdebug
Mount ./plugin → /wordpress/wp-content/plugins/plugin


Xdebug configuration failed.
No IDE-specific project settings directory was found in the current working directory.


Logging in 100%

Ready! WordPress is running on http://127.0.0.1:9400 (6 workers)
```

If `.vscode` directory exists :

```
WordPress Playground CLI

PHP 8.3  WordPress latest
Extensions intl, redis, memcached, xdebug
Mount ./plugin → /wordpress/wp-content/plugins/plugin


Xdebug configured successfully
Updated IDE config: .vscode/launch.json
Playground source root: .playground-xdebug-root – you can set breakpoints and preview Playground's VFS structure in there.

VS Code / Cursor instructions:
  1. Ensure you have installed an IDE extension for PHP Debugging
     (The PHP Debug extension by Xdebug has been a solid option)
  2. Open the Run and Debug panel on the left sidebar
  3. Select "WP Playground CLI - Listen for Xdebug" from the dropdown
  3. Click "start debugging"
  5. Set a breakpoint. For example, in .playground-xdebug-root/wordpress/index.php
  6. Visit Playground in your browser to hit the breakpoint


Logging in 100%

Ready! WordPress is running on http://127.0.0.1:9400 (6 workers)
```

If `.idea` directory exists :

```
WordPress Playground CLI

PHP 8.3  WordPress latest
Extensions intl, redis, memcached, xdebug
Mount ./plugin → /wordpress/wp-content/plugins/plugin


Xdebug configured successfully
Updated IDE config: .idea/workspace.xml .idea/php.xml
Playground source root: .playground-xdebug-root – you can set breakpoints and preview Playground's VFS structure in there.

PhpStorm instructions:
  1. Choose "WP Playground CLI - Listen for Xdebug" debug configuration in the toolbar
  2. Click the debug button (bug icon)`
  3. Set a breakpoint. For example, in .playground-xdebug-root/wordpress/index.php
  4. Visit Playground in your browser to hit the breakpoint

Logging in 100%

Ready! WordPress is running on http://127.0.0.1:9400 (6 workers)
```

<br>

#### 3. Activate the `Simple Admin Message` plugin in WP admin's plugins section

> [!NOTE]
> You should see the message being displayed, but nothing else happens because the debugging server is not running yet

<br>

#### 4. Start debugging in your IDE

<br>

#### 5. Set a breakpoint in `plugin/index.php` on the `$message` variable line

<br>

#### 6. Deactivate and reactivate the `Simple Admin Message` plugin

<br>

#### 7. Witness the magic break
