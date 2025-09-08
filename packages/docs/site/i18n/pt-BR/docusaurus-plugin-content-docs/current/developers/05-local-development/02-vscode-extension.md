---
slug: /developers/local-development/vscode-extension
---

<!-- # VS Code extension -->

# Extensão do VS Code

<!-- Start a zero-setup development environment using the [VS Code extension](https://marketplace.visualstudio.com/items?itemName=WordPressPlayground.wordpress-playground), and develop your plugin or theme locally without installing Apache or MySQL. -->

Inicie um ambiente de desenvolvimento sem configuração usando a [extensão do VS Code](https://marketplace.visualstudio.com/items?itemName=WordPressPlayground.wordpress-playground), e desenvolva seu plugin ou tema localmente sem instalar Apache ou MySQL.

<!-- Key Features: -->

**Principais recursos:**

<!-- -   **Integrated Development**: Develop WordPress sites directly within VS Code. -->
<!-- -   **Ease of Use**: Simplifies the development workflow with integrated tools. -->

-   **Desenvolvimento Integrado**: Desenvolva sites WordPress diretamente dentro do VS Code.
-   **Facilidade de Uso**: Simplifica o fluxo de trabalho de desenvolvimento com ferramentas integradas.

<!-- :::info **Documentation** -->

:::info **Documentação**

<!-- The VS Code extension is maintained in a different GitHub repository, [Playground Tools](https://github.com/WordPress/playground-tools/). You can find the latest documentation in the [dedicated README file](https://github.com/WordPress/playground-tools/blob/trunk/packages/vscode-extension/README.md). -->

A extensão do VS Code é mantida em um repositório GitHub diferente, [Playground Tools](https://github.com/WordPress/playground-tools/). Você pode encontrar a documentação mais recente no [arquivo README dedicado](https://github.com/WordPress/playground-tools/blob/trunk/packages/vscode-extension/README.md).

:::

<!-- ## Installation and Usage: -->

## Instalação e Uso:

<!-- 1.  **Install the Extension**: Search for "WordPress Playground" in the VS Code extensions marketplace and install it. -->
<!-- 2.  **Setup**: Follow the setup instructions provided in the extension to configure your development environment. -->
<!-- 3.  **Develop and Debug**: Use the integrated tools to develop and debug your WordPress site. -->

1.  **Instalar a Extensão**: Procure por "WordPress Playground" na loja de extensões do VS Code e instale-a.
2.  **Configuração**: Siga as instruções de configuração fornecidas na extensão para configurar seu ambiente de desenvolvimento.
3.  **Desenvolver e Depurar**: Use as ferramentas integradas para desenvolver e depurar seu site WordPress.

<!-- The extension ships with a portable WebAssembly version of PHP and sets up WordPress to use SQLite. Once installed, all you have to do is click the **Start WordPress Server** button in VS Code: -->

A extensão vem com uma versão portátil WebAssembly do PHP e configura o WordPress para usar SQLite. Uma vez instalada, tudo que você precisa fazer é clicar no botão **Start WordPress Server** no VS Code:

import Image from '@theme/IdealImage';
import vsCodeScreenshot from '@site/static/img/start-wordpress-server.png';

<div style={{maxWidth:350}}><Image img={vsCodeScreenshot} /></div>
