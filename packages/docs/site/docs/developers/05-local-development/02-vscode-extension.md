# VS Code extension

Start a zero-setup development environment using the [VS Code extension](https://marketplace.visualstudio.com/items?itemName=WordPressPlayground.wordpress-playground), and develop your plugin or theme locally without installing Apache or MySQL.

Key Features:

-   **Integrated Development**: Develop WordPress sites directly within VS Code.
-   **Ease of Use**: Simplifies the development workflow with integrated tools.

:::info **Documentation**

The VS Code extension is maintained in a different GitHub repository, [Playground Tools](https://github.com/WordPress/playground-tools/). You can find the latest documentation in the [dedicated README file](https://github.com/WordPress/playground-tools/blob/trunk/packages/vscode-extension/README.md).

:::

## Installation and Usage:

1.  **Install the Extension**: Search for “WordPress Playground” in the VS Code extensions marketplace and install it.
2.  **Setup**: Follow the setup instructions provided in the extension to configure your development environment.
3.  **Develop and Debug**: Use the integrated tools to develop and debug your WordPress site.

The extension ships with a portable WebAssembly version of PHP and sets up WordPress to use SQLite. Once installed, all you have to do is click the **Start WordPress Server** button in VS Code:

import Image from '@theme/IdealImage';
import vsCodeScreenshot from '@site/static/img/start-wordpress-server.png';

<div style={{maxWidth:350}}><Image img={vsCodeScreenshot} /></div>
