---
title: Primeiros Passos com Xdebug
slug: /developers/xdebug/getting-started
description: Antes de começar a depurar, você precisa executar o WordPress Playground com Xdebug habilitado. Este guia cobre o básico.
---

# Primeiros Passos com Xdebug

Este guia irá fazer uma introdução sobre como habilitar este recurso e testar sua aplicação via passo a passo.

## PHP WASM CLI vs Playground CLI

Primeirament, o Xdebug pode ser utilizado em dois CLI diferentes::

-   **`@php-wasm/cli`**: Execute scripts PHP independentes. Use isso quando estiver depurando código PHP, sem precisar de um ambiente WordPress.
-   **`@wp-playground/cli`**: Execute uma instalação completa do WordPress. Útil para depurar plugins WordPress, temas ou funcionalidades do núcleo.

Para este guia, vamos utilizar o Playground CLI, caso não esteja familiarizado com a ferramenta recomendamos ler o guia do [Playground CLI](/developers/local-development/wp-playground-cli) mas o mesmo processo também pode ser aplicado à depuração de aplicações PHP com o `@php-wasm/cli`.

## Início rápido com `npx`

A forma mais rápida de começar é usando npx, que não requer instalação:

```bash
npx @wp-playground/cli@latest server --xdebug
```

Isso inicia o WordPress em `http://127.0.0.1:9400` com Xdebug habilitado. Agora você pode conectar um depurador.

## Iniciando com DevTools

Para depurar com Chrome DevTools, adicione a flag `--experimental-devtools`:

```bash
npx @wp-playground/cli@latest server --xdebug --experimental-devtools
```

O terminal exibirá uma URL para conectar o Chrome DevTools:

```bash
Starting a PHP server...
Setting up WordPress latest
Resolved WordPress release URL: https://downloads.w.org/release/wordpress-6.8.3.zip
Fetching SQLite integration plugin...
Booting WordPress...
Booted!
Running the Blueprint...
Running the Blueprint – 100%
Finished running the blueprint
WordPress is running on http://127.0.0.1:9400 with 1 worker(s)
Starting XDebug Bridge...
Connect Chrome DevTools to CDP at:
devtools://devtools/bundled/inspector.html?ws=localhost:9229

Chrome connected! Initializing Xdebug receiver...
XDebug receiver running on port 9003
Running a PHP script with Xdebug enabled...
```

Clicando na URL disponibilizada, por exemplo, `devtools://devtools/bundled/inspector.html?ws=localhost:9229` você terá acesso ao DevTools conectado com sua aplicação. Com a possibilidade de inspecionar todos os arquivos de uma instância WordPress.

![Chrome Devtools integrated with Xdebug](@site/static/img/developers/xdebug/playground-xdebug-on-devtools.webp)

Para um exemplo mais prático, vamos debugar um plugin que possui o seguinte código abaixo:

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

Na pasta a qual o plugin se encontra, vamos executar o comando em nosso terminal:

```bash
npx @wp-playground/cli@latest server --xdebug --experimental-devtools --auto-mount
```

O Playground CLI irá reconhecer que estamos a trabalhar com um plugin e montar uma estrutura preparada para testar nosso plugin. Abrindo o projeto em seu navegador e o DevTools, você irá conseguir adicionar breakpoints no código do seu plugin e testá-lo executando linha a linha.

![Chrome Devtools integrated with Xdebug](@site/static/img/developers/xdebug/playground-cli-running-xdebug-on-devtools.webp)

## Iniciando com integração IDE

Similar ao processo com uma IDE, vamos utilizar o mesmo código do plugin anterior para depurar com VSCode ou PhpStorm, adicione a flag `--experimental-unsafe-ide-integration`:

1. install php debugger
2. needs the file .vscode/launch.json
3. enable breakingpoints
4. run the debbuger

```bash
npx @wp-playground/cli@latest server --xdebug --experimental-unsafe-ide-integration --auto-mount
```
