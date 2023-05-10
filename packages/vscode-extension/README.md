# WordPress Playground for VS Code

Run WordPress development server without any dependencies. Yes, you read that right!

This extension bundles [WordPress Playground](https://github.com/WordPress/wordpress-playground), a WebAssembly-based WordPress runtime, and starts a local WordPress development server with a click of a button. That's it! No need to install PHP, MySQL, Apache, or anything else.

Just install this extension, open the WordPress sidebar, and click the "Start WordPress Server" button.

## Known Issues

-   The extension has only been tested on macOS. It may not work on Windows.
-   The extension currently only takes into account plugins, not themes.
-   The extension currently expects that the command is run while within a file in the root directory of the plugin. A WordPress playground will still be created and mounted, but the plugin will not be functional if the command is run from an unintended directory.
-   Some requests may not succeed. This is likely due to the fact that we have a minimally implemented server translation layer.

## Development

1. Clone the WordPress Playground repository at https://github.com/WordPress/wordpress-playground
2. Make a change in `packages/vscode-extension`
3. Go to the Debug tab is your VS Code and run the "Debug Playground for VS Code" configuration. It will build the extension and start a new VS Code window with your changes reflected.

[vscode-webview-ui-toolkit](https://github.com/microsoft/vscode-webview-ui-toolkit/blob/main/docs/getting-started.md) is used for UI.

## Debugging

1. Follow the three steps above.
2. Open the "Debug Console" tab in the original VS Code window for errors and console.log() outputs.
3. Run the `Developer: Toggle Developer Tools` command in the child window to debug UI elements and WebView errors.

## Publishing

1. Generate a Personal Access Token on https://dev.azure.com/wordpress-playground/_usersSettings/tokens
1. Login with `vsce login WordPressPlayground` and the token you generated
1. Build and publish the extension with `vsce publish`.

## Release Notes

### 0.0.17

-   Restore this README.md file.
-   Add the ability to switch between WordPress and PHP versions.

### 0.0.16

-   Rewrite the extension to use the new WordPress Playground API.
-   Add a UI sidebar.

### 0.0.2

Hopefully fix the bug.

### 0.0.1

Initial release of WordPress Playground for VS Code.
