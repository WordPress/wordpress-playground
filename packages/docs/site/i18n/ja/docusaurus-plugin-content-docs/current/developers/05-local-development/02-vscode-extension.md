---
slug: /developers/local-development/vscode-extension
---

# VS Code 拡張機能

<!--
# VS Code extension
-->

[VS Code 拡張機能](https://marketplace.visualstudio.com/items?itemName=WordPressPlayground.wordpress-playground) を使用してセットアップ不要の開発環境を開始し、Apache や MySQL をインストールせずにプラグインやテーマをローカルで開発します。

<!--
# VS Code extensionStart a zero-setup development environment using the [VS Code extension](https://marketplace.visualstudio.com/items?itemName=WordPressPlayground.wordpress-playground), and develop your plugin or theme locally without installing Apache or MySQL.
-->

主な機能:

<!--
Key Features:
-->

-   **統合開発**: VS Code 内で直接 WordPress サイトを開発できます。
-   **使いやすさ**: 統合ツールにより開発ワークフローが簡素化されます。

<!--
-   **Integrated Development**: Develop WordPress sites directly within VS Code.
-   **Ease of Use**: Simplifies the development workflow with integrated tools.
-->

:::info **ドキュメント**

VS Code 拡張機能は、別の GitHub リポジトリ[Playground Tools](https://github.com/WordPress/playground-tools/)で管理されています。最新のドキュメントは[専用の README ファイル](https://github.com/WordPress/playground-tools/blob/trunk/packages/vscode-extension/README.md)をご覧ください。

:::

<!--
:::info **Documentation**

The VS Code extension is maintained in a different GitHub repository, [Playground Tools](https://github.com/WordPress/playground-tools/). You can find the latest documentation in the [dedicated README file](https://github.com/WordPress/playground-tools/blob/trunk/packages/vscode-extension/README.md).

:::
-->

## インストールと使用方法:

<!--
## Installation and Usage:
-->

1. **拡張機能のインストール**: VS Code 拡張機能マーケットプレイスで「WordPress Playground」を検索してインストールします。
2. **セットアップ**: 拡張機能に記載されているセットアップ手順に従って、開発環境を構成します。
3. **開発とデバッグ**: 統合ツールを使用して、WordPress サイトの開発とデバッグを行います。

<!--
1.  **Install the Extension**: Search for “WordPress Playground” in the VS Code extensions marketplace and install it.
2.  **Setup**: Follow the setup instructions provided in the extension to configure your development environment.
3.  **Develop and Debug**: Use the integrated tools to develop and debug your WordPress site.
-->

この拡張機能には、ポータブルな WebAssembly 版の PHP が同梱されており、WordPress で SQLite を使用するようにセットアップします。インストールが完了したら、VS Code で**WordPress サーバーを開始**ボタンをクリックするだけです。

<!--
The extension ships with a portable WebAssembly version of PHP and sets up WordPress to use SQLite. Once installed, all you have to do is click the **Start WordPress Server** button in VS Code:
-->

import Image from '@theme/IdealImage';
import vsCodeScreenshot from '@site/static/img/start-wordpress-server.png';

<div style={{maxWidth:350}}><Image img={vsCodeScreenshot} /></div>
