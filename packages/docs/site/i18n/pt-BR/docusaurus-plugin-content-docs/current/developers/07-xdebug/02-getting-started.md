---
title: Primeiros Passos com Xdebug
slug: /developers/xdebug/getting-started
description: Antes de começar a depurar, você precisa executar o WordPress Playground com Xdebug habilitado. Este guia cobre o básico.
---

<!-- # Getting Started with Xdebug -->

# Primeiros Passos com Xdebug

<!-- This guide shows you how to enable Xdebug in WordPress Playground and start debugging your code. -->

Este guia mostra como habilitar o Xdebug no WordPress Playground e começar a depurar seu código.

<!-- ## PHP WASM CLI vs Playground CLI -->

## PHP WASM CLI vs Playground CLI

<!-- First, Xdebug is present in two different CLIs: -->

Primeiramente, o Xdebug está presente em dois CLI diferentes:

-   **`@php-wasm/cli`**: Execute scripts PHP independentes. Use isso quando estiver depurando código PHP, sem precisar de um ambiente WordPress.
-   **`@wp-playground/cli`**: Execute uma instalação completa do WordPress. Útil para depurar plugins WordPress, temas ou funcionalidades do núcleo.

<!-- For this guide, we'll use `@wp-playground/cli`. If you're not familiar with the tool, we recommend reading the [`@wp-playground/cli` guide](/developers/local-development/wp-playground-cli), but the same process can also be applied to debugging PHP applications with `@php-wasm/cli`. -->

Para este guia, vamos utilizar o `@wp-playground/cli`. Se você não estiver familiarizado com a ferramenta, recomendamos ler o guia do [`@wp-playground/cli`](/developers/local-development/wp-playground-cli), mas o mesmo processo também pode ser aplicado à depuração de aplicações PHP com o `@php-wasm/cli`.

<!-- ## Quick start with `npx` -->

## Início rápido com `npx`

<!-- The fastest way to get started is using npx, which doesn't require installation: -->

A forma mais rápida de começar é usando npx, que não requer instalação:

```bash
npx @wp-playground/cli@latest server --xdebug
```

<!-- This starts WordPress on `http://127.0.0.1:9400` with Xdebug enabled. Now you connect a debugger. -->

Isso inicia o WordPress em `http://127.0.0.1:9400` com Xdebug habilitado. Agora você conecta um depurador.

<!-- ## Starting with DevTools -->

## Iniciando com DevTools

<!-- To debug with Chrome DevTools, add the `--experimental-devtools` flag: -->

Para depurar com Chrome DevTools, adicione a flag `--experimental-devtools`:

```bash
npx @wp-playground/cli@latest server --xdebug --experimental-devtools
```

<!-- The terminal will display a URL to connect Chrome DevTools: -->

O terminal exibirá uma URL para conectar o Chrome DevTools:

```bash
Starting a PHP server...
Setting up WordPress latest
Resolved WordPress release URL: https://downloads.w.org/release/wordpress-6.8.3.zip
Fetching SQLite integration plugin...
Booting WordPress...
WordPress is running on http://127.0.0.1:9400 with 1 worker(s)
Starting XDebug Bridge...
Connect Chrome DevTools to CDP at:
devtools://devtools/bundled/inspector.html?ws=localhost:9229

Chrome connected! Initializing Xdebug receiver...
XDebug receiver running on port 9003
Running a PHP script with Xdebug enabled...
```

<!-- By clicking on the provided URL, for example, `devtools://devtools/bundled/inspector.html?ws=localhost:9229`, you can access DevTools connected to your application, with the ability to inspect all files of a WordPress instance. -->

Clicando na URL fornecida, por exemplo, `devtools://devtools/bundled/inspector.html?ws=localhost:9229`, você pode acessar o DevTools conectado à sua aplicação, com a possibilidade de inspecionar todos os arquivos de uma instância WordPress.

![Chrome Devtools integrated with Xdebug](@site/static/img/developers/xdebug/playground-xdebug-on-devtools.webp)

<!-- For a more practical example, let's debug a plugin that has the following code: -->

Para um exemplo mais prático, vamos debugar um plugin que possui o seguinte código:

```PHP
<?php
/**
 * Plugin Name: Simple Admin Message
 * Description: Displays a simple message in the WordPress admin
 * Version: 1.0
 * Author: Playground Team
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Display admin notice
function sam_display_admin_message() {
    $message = 'Hello! This is a simple admin message.';
    ?>
    <div class="notice notice-info is-dismissible">
        <p><?php _e($message, 'simple-admin-message'); ?></p>
    </div>
    <?php
}
add_action('admin_notices', 'sam_display_admin_message');
```

<!-- In the folder where the plugin is located, let's run the command in our terminal: -->

Na pasta onde o plugin está localizado, vamos executar o comando em nosso terminal:

```bash
npx @wp-playground/cli@latest server --xdebug --experimental-devtools --auto-mount
```

<!-- The Playground CLI(`@wp-playground/cli`) will automatically detect the plugin folder and mount it. Opening the project in your browser and DevTools, you'll be able to add breakpoints in your plugin's code and test it line by line. -->

O Playground CLI (`@wp-playground/cli`) detectará automaticamente a pasta do plugin e a montará. Abrindo o projeto em seu navegador e DevTools, você poderá adicionar breakpoints no código do seu plugin e testá-lo linha por linha.

![Chrome Devtools integrated with Xdebug](@site/static/img/developers/xdebug/playground-cli-running-xdebug-on-devtools.webp)

<!-- ## Starting with IDE integration -->

## Iniciando com integração IDE

<!-- Similar to the process with DevTools, let's use the same plugin code from before to debug with VSCode, add the `--experimental-unsafe-ide-integration=vscode` flag. This flag will optimize the setup process for VSCode. If you're working with PhpStorm, just add the `--experimental-unsafe-ide-integration=phpstorm` flag. -->

Similar ao processo com DevTools, vamos utilizar o mesmo código do plugin anterior para depurar com VSCode, adicione a flag `--experimental-unsafe-ide-integration=vscode`. Esta flag otimizará o processo de configuração para VSCode. Se você trabalha com PhpStorm, apenas adicione a flag `--experimental-unsafe-ide-integration=phpstorm`.

<!-- To debug in VSCode you'll need the following prerequisites: -->

Para depurar no VSCode você precisará dos seguintes pré-requisitos:

1. Uma extensão para adicionar suporte a PHP profiling, por exemplo, [PHP Profiler](https://open-vsx.org/extension/devsense/profiler-php-vscode)
2. Uma pasta `.vscode/`. Se o arquivo `launch.json` não existir, não se preocupe, o `@wp-playground/cli` o criará.
3. Habilite os pontos de interrupção (breakpoints) em seu IDE. Alguns IDEs vêm com este recurso desativado, então preste atenção a este detalhe.

<!-- If everything is ready, you run the command: -->

Se tudo estiver pronto, execute o comando:

```bash
npx @wp-playground/cli@latest server --xdebug --experimental-unsafe-ide-integration=vscode --auto-mount
```

<!-- Now, go to your code, add the breakpoints and happy testing. -->

Agora, vá para o seu código, adicione os breakpoints e bons testes.

![Xdebug em execução no VSCode](@site/static/img/developers/xdebug/xdebug-in-action-on-vscode.webp)

<!-- This feature is in experimental mode. Until it is completed, we will need your feedback. Please connect with us in the [#playground Slack channel](https://wordpress.slack.com/archives/C04EWKGDJ0K) and share your thoughts. -->

Esta funcionalidade está em modo experimental. Até que seja concluída, precisaremos do seu feedback. Por favor, conecte-se conosco no [canal Slack #playground](https://wordpress.slack.com/archives/C04EWKGDJ0K) e compartilhe seus pensamentos.
