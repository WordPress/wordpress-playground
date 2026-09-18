## About

Use PHP.wasm CLI with Xdebug enabled

<br>

## Installation

#### 1. Install dependencies

```bash
npm install
```

<br>

#### 2. Run script with CLI

```bash
node_modules/.bin/php-wasm-cli --xdebug --experimental-unsafe-ide-integration src/test.php
```

If no project settings directory was found :

```
Xdebug configuration failed.
No IDE-specific project settings directory was found in the current working directory.

Output!
Hello Xdebug World!
```

If `.vscode` directory exists :

```
Xdebug configured successfully
Updated IDE config: .vscode/launch.json

VS Code / Cursor instructions:
	1. Ensure you have installed an IDE extension for PHP Debugging
	   (The PHP Debug extension by Xdebug has been a solid option)
	2. Open the Run and Debug panel on the left sidebar
	3. Select "PHP.wasm CLI - Listen for Xdebug" from the dropdown
	3. Click "start debugging"
	5. Set a breakpoint.
	6. Run your command with PHP.wasm CLI.


Output!
Hello Xdebug World!
```

If `.idea` directory exists :

```
Xdebug configured successfully
Updated IDE config: .idea/workspace.xml

PhpStorm instructions:
	1. Choose "PHP.wasm CLI - Listen for Xdebug" debug configuration in the toolbar
	2. Click the debug button (bug icon)
	3. Set a breakpoint.
	4. Run your command with PHP.wasm CLI.

Output!
Hello Xdebug World!
```

> [!NOTE]
> Nothing happens because the debugging server is not running yet

<br>

#### 3. Start debugging in your IDE

<br>

#### 4. Set a breakpoint in `src/test.php`

<br>

#### 5. Re-run script with CLI

```bash
node_modules/.bin/php-wasm-cli --xdebug --experimental-unsafe-ide-integration src/test.php
```

<br>

#### 6. Witness the magic break

> [!NOTE]
> When using the PHP.wasm CLI with Xdebug enabled, execution will automatically break on the first line
