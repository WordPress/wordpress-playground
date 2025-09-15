---
title: wp-now
slug: /developers/local-development/wp-now
---

:::caution Pacote descontinuado

O pacote NPM @wp-now/wp-now está descontinuado e não receberá atualizações no futuro. Para usar uma ferramenta de linha de comando no seu fluxo de desenvolvimento, use o pacote NPM `@wp-playground/cli`.
:::

<!-- # wp-now NPM package -->

# Pacote NPM wp-now

<!-- [wp-now](https://www.npmjs.com/package/@wp-now/wp-now) is a command-line tool designed to simplify the process of running WordPress locally. It provides a quick and easy way to set up a local WordPress environment with minimal configuration. -->

[wp-now](https://www.npmjs.com/package/@wp-now/wp-now) é uma ferramenta de linha de comando projetada para simplificar o processo de executar WordPress localmente. Ela fornece uma maneira rápida e fácil de configurar um ambiente WordPress local com configuração mínima.

<!-- Key Features: -->

**Principais recursos:**

<!-- -   **Command-line Interface**: Easy to use for developers comfortable with CLI. -->
<!-- -   **Quick Setup**: Set up a local WordPress environment in seconds. -->
<!-- -   **Customizable**: Allows for configuration to suit specific development needs. -->

-   **Interface de Linha de Comando**: Fácil de usar para desenvolvedores confortáveis com CLI.
-   **Configuração Rápida**: Configure um ambiente WordPress local em segundos.
-   **Personalizável**: Permite configuração para atender às necessidades específicas de desenvolvimento.

<!-- [`@wp-now/wp-now`](https://www.npmjs.com/package/@wp-now/wp-now) is a CLI tool to spin up a WordPress site with a single command. Similarly to the [VS Code extension](/developers/local-development/vscode-extension), it uses a portable WebAssembly version of PHP and SQLite. No Docker, MySQL, or Apache are required. -->

[`@wp-now/wp-now`](https://www.npmjs.com/package/@wp-now/wp-now) é uma ferramenta CLI para iniciar um site WordPress com um único comando. Similar à [extensão do VS Code](/developers/local-development/vscode-extension), ela usa uma versão portátil WebAssembly do PHP e SQLite. Não são necessários Docker, MySQL ou Apache.

<!-- :::info **Documentation** -->

:::info **Documentação**

<!-- `wp-now` is maintained in a different GitHub repository, [Playground Tools](https://github.com/WordPress/playground-tools/). You can find the latest documentation in the [dedicated README file](https://github.com/WordPress/playground-tools/blob/trunk/packages/wp-now/README.md). -->

`wp-now` é mantido em um repositório GitHub diferente, [Playground Tools](https://github.com/WordPress/playground-tools/). Você pode encontrar a documentação mais recente no [arquivo README dedicado](https://github.com/WordPress/playground-tools/blob/trunk/packages/wp-now/README.md).

:::

<!-- ## Launch wp-now in a plugin or theme directory -->

## Iniciar wp-now em um diretório de plugin ou tema

<!-- Navigate to your plugin or theme directory and start `wp-now` with the following commands: -->

Navegue até o diretório do seu plugin ou tema e inicie `wp-now` com os seguintes comandos:

```bash
cd my-plugin-or-theme-directory
npx @wp-now/wp-now start
```

<!-- ## Launch wp-now in the `wp-content` directory with options -->

## Iniciar wp-now no diretório `wp-content` com opções

<!-- You can also start `wp-now` from any `wp-content` folder. The following example passes parameters for changing the PHP and WordPress versions and loading a blueprint file. -->

Você também pode iniciar `wp-now` de qualquer pasta `wp-content`. O exemplo a seguir passa parâmetros para alterar as versões do PHP e WordPress e carregar um arquivo blueprint.

```bash
cd my-wordpress-folder/wp-content
npx @wp-now/wp-now start --wp=6.4 --php=8.3 --blueprint=path/to/blueprint.json
```

<!-- ## Install wp-now globally -->

## Instalar wp-now globalmente

<!-- Alternatively, you can install `@wp-now/wp-now` globally to load it from any directory: -->

Alternativamente, você pode instalar `@wp-now/wp-now` globalmente para carregá-lo de qualquer diretório:

```bash
npm install -g @wp-now/wp-now
cd my-plugin-or-theme-directory
wp-now start
```
