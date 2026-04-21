## About

Use PHP.wasm Node with Xdebug enabled

<br>

## Installation

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
Output!
Hello Xdebug World!
```

> [!NOTE]
> Nothing happens because the debugging server is not running yet

<br>

#### 3. Add IDE configuration

> [!IMPORTANT]
> PHP.wasm 8.5 handles path mapping and path skipping inside Xdebug. If you're running a PHP.wasm version below, you'll need to add these inside IDE configurations.

#### VSCode

A file named `launch.json` should be in the `.vscode` directory at the root of your project

```json
{
	"version": "0.2.0",
	"configurations": [
		{
			"name": "Listen for XDebug",
			"type": "php",
			"request": "launch",
			"port": 9003,
			"skipFiles": [
				...
			],
			"pathMappings": {
				...
			}
		}
	]
}
```

#### PHPStorm

A file named `workspace.xml` should be in the `.idea` directory at the root of your project

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
	<component name="PhpDebugGeneral" notify_if_session_was_finished_without_being_paused="false" xdebug_force_break_when_no_path_mapping="false" xdebug_force_break_when_outside_project="false" />
	<component name="PhpServers">
		<servers>
			<server host="example.com:443" port="80" name="Listen for Xdebug" />
		</servers>
	</component>
</project>
```

If you need to skip files from Xdebug, a file named `php.xml` should be in the `.idea` directory at the root of your project

```xml
<component name="PhpStepFilterConfiguration">
	<skipped_files>
		<skipped_file file="$PROJECT_DIR$/foo.php" />
		<skipped_file file="$PROJECT_DIR$/baz" />
	</skipped_files>
</component>
```

To stop breaking at first line in PHPStorm : Settings > PHP > Debug > Xdebug :

- Disable > Force break at first line when no path mapping specified
- Disable > Force break at first line when a script is outside the project

To remove warning debug session finished without being paused in PHPStorm : Settings > PHP > Debug > Settings :

- Disable > Notify if debug session was finished without being paused

<br>

##### Optional - Add path mappings and skippings using Xdebug in PHP.wasm 8.5

```typescript
const php = new PHP(
	await loadNodeRuntime('8.5', {
		withXdebug: {
			pathMappings: [{ hostPath: process.cwd(), vfsPath: '/' }],
			pathSkippings: ['/foo.php', '/bar'],
		},
	})
);
```

<br>

#### 4. Start debugging in your IDE

<br>

#### 5. Set a breakpoint in `src/test.php`

<br>

#### 6. Re-run the script

```bash
node src/script.js
```

<br>

#### 7. Witness the magic break
