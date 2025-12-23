## About

Use PHP.wasm with Xdebug in your IDE

<br>

## Appendix

Some IDEs need configuration to connect Xdebug with the IDE debugging server.

>  [!NOTE]
> PHP.wasm and Playground CLIs manage them out of the box by adding `--experimental-unsafe-ide-integration` option.

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
            "pathMappings": {
                ...
            }
        }
    ]
}
```

To run the debugging server in VSCode : Run > Start Debugging

> [!IMPORTANT]
> Path mappings are essential in WP Playground CLI

<br>

#### PHPStorm

PHPStorm has configured Xdebug port to 9003 by default

To run the debugging server in PHPStorm : Bug Icon or Start Listening for PHP Debug Connections

A file named `workspace.xml` should be in the `.idea` directory at the root of your project

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
  <component name="PhpDebugGeneral" notify_if_session_was_finished_without_being_paused="false" xdebug_force_break_when_no_path_mapping="false" xdebug_force_break_when_outside_project="false" />
  <component name="PhpServers">
    <servers>

      <server host="example.com:443" port="80" name="Listen for Xdebug" />

      // or [ Playground CLI ]

      <server host="127.0.0.1:9400" port="80" name="Listen for Xdebug" use_path_mappings="true">
        <path_mappings>
          <mapping local-root="$PROJECT_DIR$/plugin" remote-root="/wordpress/wp-content/plugins/plugin" />
        </path_mappings>
      </server>

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

## How to start

#### 1. Go to the specific directory you would like to try

- php-wasm-node
- php-wasm-cli
- wp-playground-cli

#### 2. Follow the dedicated README file instructions
