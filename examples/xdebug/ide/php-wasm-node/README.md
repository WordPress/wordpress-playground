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
			"port": 9003
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

To stop breaking at first line in PHPStorm : Settings > PHP > Debug > Xdebug :

- Disable > Force break at first line when no path mapping specified
- Disable > Force break at first line when a script is outside the project

To remove warning debug session finished without being paused in PHPStorm : Settings > PHP > Debug > Settings :

- Disable > Notify if debug session was finished without being paused

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
