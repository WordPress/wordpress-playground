---
title: Playground CLI
slug: /developers/local-development/wp-playground-cli
---

<!--
# Playground CLI
-->

# Playground CLI

<!--
[@wp-playground/cli](https://www.npmjs.com/package/@wp-playground/cli) is a command-line tool that simplifies the WordPress development and testing flow.
Playground CLI supports auto-mounting a directory with a plugin, theme, or WordPress installation. But if you need flexibility, the CLI supports mounting commands to personalize your local environment.
-->

[@wp-playground/cli](https://www.npmjs.com/package/@wp-playground/cli) é uma ferramenta de linha de comando que simplifica o fluxo de desenvolvimento e teste do WordPress.
O Playground CLI suporta a montagem automática de um diretório com um plugin, tema ou instalação WordPress. Mas se você precisa de flexibilidade, o CLI suporta comandos de montagem para personalizar seu ambiente local.

<!--
**Key features:**
-->

**Principais recursos:**

<!--
- **Quick Setup**: Set up a local WordPress environment in seconds.
- **Flexibility**: Allows for configuration to adapt to different scenarios.
- **Simple Environment**: No extra configuration, just a compatible Node version, and you are ready to use it.
-->

- **Configuração rápida**: Configure um ambiente WordPress local em segundos.
- **Flexibilidade**: Permite configuração para se adaptar a diferentes cenários.
- **Ambiente simples**: Sem configuração extra, apenas uma versão Node compatível e você está pronto para usar.

<!--
The Playground CLI includes two main commands for running WordPress locally:

- **`start`** (Simplified): Auto-detects your project type, persists sites between sessions, and opens a browser automatically.
- **`server`** (Advanced): Provides full manual control over configuration. Best for custom setups, CI/CD pipelines, or when you need fine-grained control.
-->

O Playground CLI inclui dois comandos principais para executar WordPress localmente:

- **`start`** (Simplificado): Detecta automaticamente o tipo do seu projeto, persiste sites entre sessões e abre o navegador automaticamente.
- **`server`** (Avançado): Oferece controle manual completo sobre a configuração. Ideal para setups personalizados, pipelines de CI/CD ou quando você precisa de controle refinado.

<!--
## Requirements
-->

## Requisitos

<!--
The Playground CLI requires Node.js 20.18 or higher, which is the recommended Long-Term Support (LTS) version. You can download it from the [Node.js website](https://nodejs.org/en/download).
-->

O Playground CLI requer Node.js 20.18 ou superior, que é a versão recomendada de Suporte de Longo Prazo (LTS). Você pode baixá-la no [site do Node.js](https://nodejs.org/en/download).

<!--
## Quickstart
-->

## Início rápido

<!--
To run the Playground CLI, open a command line and use one of the following commands:
-->

Para executar o Playground CLI, abra uma linha de comando e use um dos seguintes comandos:

<!--
### Using `start` (Simplified)
-->

### Usando `start` (Simplificado)

<!--
The `start` command is the easiest way to get started. It automatically detects your project type, persists your site, and opens the browser:
-->

O comando `start` é a forma mais fácil de começar. Ele detecta automaticamente o tipo do seu projeto, persiste seu site e abre o navegador:

```bash
npx @wp-playground/cli@latest start
```

<!--
When run inside a plugin or theme directory, `start` automatically mounts your project:
-->

Quando executado dentro de um diretório de plugin ou tema, `start` monta seu projeto automaticamente:

```bash
cd my-plugin
npx @wp-playground/cli@latest start
```

<!--
**Key differences from `server`:**

- Auto-login is enabled by default
- Opens browser automatically
- Auto-mounts the project by default
-->

**Principais diferenças em relação ao `server`:**

- Login automático habilitado por padrão
- Abre o navegador automaticamente
- Monta o projeto automaticamente por padrão

<!--
### Using `server` (Advanced)
-->

### Usando `server` (Avançado)

<!--
The `server` command provides full control over configuration:
-->

O comando `server` oferece controle total sobre a configuração:

```bash
npx @wp-playground/cli@latest server
```

![Playground CLI em ação](@site/static/img/developers/npx-wp-playground-server.gif)

<!--
**Automatic site persistence:** By default, the `start` command keeps your WordPress site persistent across sessions. Your files and database are stored in `~/.wordpress-playground/sites/<path-hash>/`, where `<path-hash>` is derived from your project directory. This means you can stop and restart the CLI without losing your work.
-->

**Persistência automática do site:** Por padrão, o comando `start` mantém seu site WordPress persistente entre sessões. Seus arquivos e banco de dados são armazenados em `~/.wordpress-playground/sites/<path-hash>/`, onde `<path-hash>` é derivado do diretório do seu projeto. Assim você pode parar e reiniciar o CLI sem perder seu trabalho.

<!--
This is useful when:

- You want a clean WordPress installation
- Testing fresh installation scenarios
- Your site data became corrupted or inconsistent
-->

Isso é útil quando:

- Você quer uma instalação WordPress limpa
- Está testando cenários de instalação nova
- Os dados do seu site ficaram corrompidos ou inconsistentes

<!--
:::info
The `--reset` flag works only with `start`. For `server`, manually delete the persisted site directory at `~/.wordpress-playground/sites/<path-hash>/`.
:::
-->

:::info
A flag `--reset` funciona apenas com `start`. Para `server`, exclua manualmente o diretório do site persistido em `~/.wordpress-playground/sites/<path-hash>/`.
:::

<!--
### Choosing a WordPress and PHP Version
-->

### Escolhendo uma versão do WordPress e do PHP

<!--
By default, the CLI loads the latest stable version of WordPress and PHP 8.3 due to its improved performance. To specify your preferred versions, you can use the flag `--wp=<version>` and `--php=<version>`:
-->

Por padrão, o CLI carrega a última versão estável do WordPress e PHP 8.3 devido ao desempenho melhorado. Para especificar suas versões preferidas, use as flags `--wp=<version>` e `--php=<version>`:

```bash
npx @wp-playground/cli@latest server --wp=6.8 --php=8.3
```

<!--
### Loading Blueprints
-->

### Carregando blueprints

<!--
One way to take your Playground CLI development experience to the next level is to integrate with [Blueprints](/blueprints/getting-started/). For those unfamiliar with this technology, it allows developers to configure the initial state for their WordPress Playground instances.
-->

Uma forma de levar sua experiência de desenvolvimento com o Playground CLI ao próximo nível é integrar com [Blueprints](/blueprints/getting-started/). Para quem não conhece essa tecnologia, ela permite que desenvolvedores configurem o estado inicial de suas instâncias WordPress Playground.

<!--
Using the `--blueprint=<blueprint-address>` flag, developers can run a Playground with a custom initial state. We'll use the example below to do this.
-->

Usando a flag `--blueprint=<blueprint-address>`, desenvolvedores podem executar um Playground com um estado inicial personalizado. Usaremos o exemplo abaixo para isso.

**(my-blueprint.json)**

```bash
{
  "landingPage": "/wp-admin/options-general.php?page=akismet-key-config",
  "login": true,
  "plugins": [
    "hello-dolly",
    "https://raw.githubusercontent.com/adamziel/blueprints/trunk/docs/assets/hello-from-the-dashboard.zip"
  ]
}
```

<!--
CLI command loading a blueprint:
-->

Comando CLI carregando um blueprint:

```bash
npx @wp-playground/cli@latest server --blueprint=my-blueprint.json
```

<!--
### Mounting folders manually
-->

### Montando pastas manualmente

<!--
Some projects have a specific structure that requires a custom configuration; for example, your repository contains all the files in the `/wp-content/` folder. So in this scenario, you can specify to the Playground CLI that it will mount your project from that folder using the `--mount` flag.
-->

Alguns projetos têm uma estrutura específica que exige configuração personalizada; por exemplo, seu repositório contém todos os arquivos na pasta `/wp-content/`. Nesse cenário, você pode indicar ao Playground CLI que ele montará seu projeto a partir dessa pasta usando a flag `--mount`.

```bash
npx @wp-playground/cli@latest server --mount=.:/wordpress/wp-content/plugins/MY-PLUGIN-DIRECTORY
```

<!--
### Mounting before WordPress installation
-->

### Montando antes da instalação do WordPress

<!--
Consider mounting your WordPress project files before the WordPress installation begins. This approach is beneficial if you want to override the Playground boot process, as it can help connect Playground with `WP-CLI`. The `--mount-before-install` flag supports this process.
-->

Considere montar os arquivos do seu projeto WordPress antes do início da instalação do WordPress. Essa abordagem é útil se você quiser sobrescrever o processo de inicialização do Playground, pois pode ajudar a conectar o Playground ao `WP-CLI`. A flag `--mount-before-install` suporta esse processo.

```bash
npx @wp-playground/cli@latest server --mount-before-install=.:/wordpress/
```

<!--
:::info
On Windows, the path format `/host/path:/vfs/path` can cause issues. To resolve this, use the flags `--mount-dir` and `--mount-dir-before-install`. These flags let you specify host and virtual file system paths in an alternative format: `"/host/path"` `"/vfs/path"`.
:::
-->

:::info
No Windows, o formato de caminho `/host/path:/vfs/path` pode causar problemas. Para resolver, use as flags `--mount-dir` e `--mount-dir-before-install`. Essas flags permitem especificar os caminhos do host e do sistema de arquivos virtual em um formato alternativo: `"/host/path"` `"/vfs/path"`.
:::

<!--
### Understanding Data Persistence and SQLite Location in `server` mode
-->

### Entendendo persistência de dados e local do SQLite no modo `server`

<!--
By default, Playground CLI stores WordPress files and the SQLite database in **temporary directories on your operating system**:
-->

Por padrão, o Playground CLI armazena os arquivos do WordPress e o banco SQLite em **diretórios temporários do seu sistema operacional**:

```
<OS-TEMP-DIR>/playground-<random-id>/
├── wordpress/          # Instalação WordPress
├── internal/           # Config do runtime do Playground
└── tmp/                # Arquivos temporários PHP
```

<!--
**Finding Your Temp Directory:**

The actual location depends on your OS (these are examples or common possibilities):

- **macOS/Linux**: May be under `/tmp/` or `/private/var/folders/` (varies by system)
- **Windows**: `C:\Users\<username>\AppData\Local\Temp\`

To see the exact temp directory path being used, run the CLI with the `--verbosity=debug` flag:
-->

**Encontrando seu diretório temporário:**

A localização real depende do seu SO (estes são exemplos ou possibilidades comuns):

- **macOS/Linux**: Pode estar em `/tmp/` ou `/private/var/folders/` (varia conforme o sistema)
- **Windows**: `C:\Users\<username>\AppData\Local\Temp\`

Para ver o caminho exato do diretório temporário em uso, execute o CLI com a flag `--verbosity=debug`:

```bash
npx @wp-playground/cli@latest server --verbosity=debug
```

<!--
This will output something like:
-->

Isso exibirá algo como:

```
Native temp dir for VFS root:
/private/var/folders/c8/mwz12ycx4s509056kby3hk180000gn/T/node-playground-cli-site-62926--62926-yQNOdvJVIgYC
Mount before WP install: /home ->
/private/var/folders/c8/mwz12ycx4s509056kby3hk180000gn/T/node-playground-cli-site-62926--62926-yQNOdvJVIgYC/home
Mount before WP install: /tmp ->
/private/var/folders/c8/mwz12ycx4s509056kby3hk180000gn/T/node-playground-cli-site-62926--62926-yQNOdvJVIgYC/tmp
Mount before WP install: /wordpress ->
/private/var/folders/c8/mwz12ycx4s509056kby3hk180000gn/T/node-playground-cli-site-62926--62926-yQNOdvJVIgYC/wordpress
```

<!--
**Where is the SQLite Database Stored?**

The database location depends on what you mount:

- **Auto-mounting wp-content or full WordPress**:
    - Database: `<your-local-project>/wp-content/database/.ht.sqlite`
    - ✅ **Persisted locally** in your project folder

- **Auto-mounting plugin/theme only**:
    - Database: `<OS-TEMP-DIR>/playground-<id>/wordpress/wp-content/database/.ht.sqlite`
    - ⚠️ **Lost when server stops** (temp directories are cleaned up)

- **Custom mounts**: Database location follows your mount configuration

**Automatic Cleanup:**
Playground CLI automatically removes temp directories that are:

- Older than 2 days
- No longer associated with a running process

**Recommendation:** To persist both your code and database when developing plugins or themes, mount the entire `wp-content` directory instead of just the plugin/theme folder.
-->

**Onde fica o banco de dados SQLite?**

A localização do banco depende do que você monta:

- **Montagem automática de wp-content ou WordPress completo**:
    - Banco: `<seu-projeto-local>/wp-content/database/.ht.sqlite`
    - ✅ **Persistido localmente** na pasta do seu projeto

- **Montagem automática só de plugin/tema**:
    - Banco: `<OS-TEMP-DIR>/playground-<id>/wordpress/wp-content/database/.ht.sqlite`
    - ⚠️ **Perdido quando o servidor para** (diretórios temporários são removidos)

- **Montagens customizadas**: A localização do banco segue sua configuração de montagem

**Limpeza automática:**
O Playground CLI remove automaticamente diretórios temporários que:

- Tenham mais de 2 dias
- Não estejam mais associados a um processo em execução

**Recomendação:** Para persistir tanto seu código quanto o banco ao desenvolver plugins ou temas, monte o diretório `wp-content` inteiro em vez de só a pasta do plugin/tema.

<!--
**Example: Mounting wp-content for persistence**
-->

**Exemplo: Montando wp-content para persistência**

```bash
# Mount your entire wp-content directory
cd my-wordpress-project
npx @wp-playground/cli@latest server --mount=./wp-content:/wordpress/wp-content
```

<!--
### Data Persistence in `start` mode
-->

### Persistência de dados no modo `start`

<!--
Running in `start` mode, Playground CLI **automatically persists** your WordPress site in a dedicated directory:
-->

No modo `start`, o Playground CLI **persiste automaticamente** seu site WordPress em um diretório dedicado:

```
~/.wordpress-playground/sites/<path-hash>/
├── wordpress/          # Instalação WordPress
├── internal/          # Config do runtime do Playground
└── tmp/                # Arquivos temporários PHP
```

<!--
The `<path-hash>` is derived from your project directory path. This ensures isolation between different projects while persisting changes automatically.
-->

O `<path-hash>` é derivado do caminho do diretório do seu projeto. Isso garante isolamento entre projetos diferentes e persiste as alterações automaticamente.

<!--
#### Persistence behavior

- **Default (no explicit mount)**: WordPress files and database persist in `~/.wordpress-playground/sites/<path-hash>/`. Changes survive between CLI restarts.
- **Explicit `/wordpress` mount**: If you provide a mount path for `/wordpress`, automatic persistence is skipped. Your mount configuration takes precedence.

The database location depends on your configuration:

- **Default (automatic persistence)**:
    - Database: `~/.wordpress-playground/sites/<path-hash>/wordpress/wp-content/database/.ht.sqlite`
    - **Persisted automatically** between sessions
-->

#### Comportamento da persistência

- **Padrão (sem montagem explícita)**: Arquivos e banco do WordPress persistem em `~/.wordpress-playground/sites/<path-hash>/`. As alterações sobrevivem entre reinícios do CLI.
- **Montagem explícita de `/wordpress`**: Se você informar um caminho de montagem para `/wordpress`, a persistência automática é ignorada. Sua configuração de montagem tem precedência.

A localização do banco depende da sua configuração:

- **Padrão (persistência automática)**:
    - Banco: `~/.wordpress-playground/sites/<path-hash>/wordpress/wp-content/database/.ht.sqlite`
    - **Persistido automaticamente** entre sessões

<!--
#### Resetting a persisted site
-->

#### Redefinindo um site persistido

<!--
To start fresh, use the `--reset` flag with the `start` command:
-->

Para começar do zero, use a flag `--reset` com o comando `start`:

```bash
npx @wp-playground/cli@latest start --reset
```

<!--
## Command and Arguments
-->

## Comando e argumentos

<!--
Playground CLI is simple, configurable, and unopinionated. You can set it up according
to your unique WordPress setup. With the Playground CLI, you can use the following top-level commands:

- **`start`**: (Simplified) Starts a local WordPress server with automatic project detection, site persistence, and browser opening.
- **`server`**: (Advanced) Starts a local WordPress server with full manual control over configuration.
- **`run-blueprint`**: Executes a Blueprint file without starting a web server.
- **`build-snapshot`**: Builds a ZIP snapshot of a WordPress site based on a Blueprint.

The `start` command has a dedicated argument:

- `--reset`: Delete the stored site and start fresh. Defaults to false.

The `server` command supports the following optional arguments:
-->

O Playground CLI é simples, configurável e sem opiniões rígidas. Você pode configurá-lo de acordo com seu ambiente WordPress. Com o Playground CLI, você pode usar os seguintes comandos de nível superior:

- **`start`**: (Simplificado) Inicia um servidor WordPress local com detecção automática de projeto, persistência de site e abertura do navegador.
- **`server`**: (Avançado) Inicia um servidor WordPress local com controle manual completo da configuração.
- **`run-blueprint`**: Executa um arquivo Blueprint sem iniciar um servidor web.
- **`build-snapshot`**: Cria um snapshot ZIP de um site WordPress com base em um Blueprint.

O comando `start` tem um argumento dedicado:

- `--reset`: Exclui o site armazenado e começa do zero. Padrão: false.

O comando `server` suporta os seguintes argumentos opcionais:

<!--
- `--port=<port>`: The port number for the server to listen on. Defaults to 9400.
- `--version`: Show version number.
- `--outfile`: When building, write to this output file.
- `--site-url=<url>`: Site URL to use for WordPress. Defaults to `http://127.0.0.1:{port}`.
- `--wp=<version>`: The version of WordPress to use. Defaults to the latest.
- `--php=<version>`: PHP version to use. Choices: `8.5`, `8.4`, `8.3`, `8.2`, `8.1`, `8.0`, `7.4`. Defaults to `8.5`.
- `--auto-mount[=<path>]`: Automatically mount a directory. If no path is provided, mounts the current working directory. You can mount a WordPress directory, a plugin directory, a theme directory, a wp-content directory, or any directory containing PHP and HTML files.
- `--mount=<mapping>`: Manually mount a directory (can be used multiple times). Format: `"/host/path:/vfs/path"`.
- `--mount-before-install`: Mount a directory to the PHP runtime before WordPress installation (can be used multiple times). Format: `"/host/path:/vfs/path"`.
- `--mount-dir`: Mount a directory to the PHP runtime (can be used multiple times). Format: `"/host/path"` `"/vfs/path"`.
- `--mount-dir-before-install`: Mount a directory before WordPress installation (can be used multiple times). Format: `"/host/path"` `"/vfs/path"`
- `--blueprint=<path>`: The path to a JSON Blueprint file to execute.
- `--blueprint-may-read-adjacent-files`: Consent flag: Allow "bundled" resources in a local blueprint to read files in the same directory as the blueprint file.
- `--login`: Automatically log the user in as an administrator.
- `--wordpress-install-mode <mode>`: Control how Playground prepares WordPress before booting. Defaults to `download-and-install`. Other options: `install-from-existing-files` (install using files you've mounted), `install-from-existing-files-if-needed` (skip setup when an existing site is detected), and `do-not-attempt-installing` (never download or install WordPress).
- `--skip-sqlite-setup`: Do not set up the SQLite database integration.
- `--verbosity=<level>`: Output logs and progress messages. Choices: `quiet`, `normal`, `debug`. Defaults to `normal`.
- `--debug`: Print the PHP error log if an error occurs during boot.
- `--follow-symlinks`: Allow Playground to follow symlinks by automatically mounting symlinked directories and files encountered in mounted directories.
- `--internal-cookie-store`: Enable internal cookie handling. When enabled, Playground will manage cookies internally using an HttpCookieStore that persists cookies across requests. When disabled, cookies are handled externally (e.g., by a browser in Node.js environments). Defaults to false.
- `--phpmyadmin[=<path>]`: Install phpMyAdmin for database management. The phpMyAdmin URL will be printed after boot. Optionally specify a custom URL path (default: `/phpmyadmin`).
- `--xdebug`: Enable Xdebug. Defaults to false.
- `--experimental-devtools`: Enable experimental browser development tools. Defaults to false.
- `--experimental-unsafe-ide-integration=<ide>`: Set up the Xdebug integration on VS Code (`vscode`) and PhpStorm (`phpstorm`).
- `--experimental-multi-worker=<number>`: Enable experimental multi-worker support which requires a `/wordpress` directory backed by a real filesystem. Pass a positive number to specify the number of workers to use. Otherwise, defaults to the number of CPUs minus 1.
-->

- `--port=<port>`: Número da porta em que o servidor escuta. Padrão: 9400.
- `--version`: Exibe o número da versão.
- `--outfile`: Ao construir, grava neste arquivo de saída.
- `--site-url=<url>`: URL do site para o WordPress. Padrão: `http://127.0.0.1:{port}`.
- `--wp=<version>`: Versão do WordPress a usar. Padrão: a mais recente.
- `--php=<version>`: Versão do PHP. Opções: `8.5`, `8.4`, `8.3`, `8.2`, `8.1`, `8.0`, `7.4`. Padrão: `8.5`.
- `--auto-mount[=<path>]`: Monta um diretório automaticamente. Sem path, monta o diretório de trabalho atual. Você pode montar um diretório WordPress, de plugin, de tema, wp-content ou qualquer diretório com arquivos PHP e HTML.
- `--mount=<mapping>`: Monta um diretório manualmente (pode ser usado várias vezes). Formato: `"/host/path:/vfs/path"`.
- `--mount-before-install`: Monta um diretório no runtime PHP antes da instalação do WordPress (pode ser usado várias vezes). Formato: `"/host/path:/vfs/path"`.
- `--mount-dir`: Monta um diretório no runtime PHP (pode ser usado várias vezes). Formato: `"/host/path"` `"/vfs/path"`.
- `--mount-dir-before-install`: Monta um diretório antes da instalação do WordPress (pode ser usado várias vezes). Formato: `"/host/path"` `"/vfs/path"`.
- `--blueprint=<path>`: Caminho do arquivo JSON Blueprint a executar.
- `--blueprint-may-read-adjacent-files`: Flag de consentimento: permite que recursos "empacotados" em um blueprint local leiam arquivos no mesmo diretório do blueprint.
- `--login`: Faz login automático do usuário como administrador.
- `--wordpress-install-mode <mode>`: Controla como o Playground prepara o WordPress antes da inicialização. Padrão: `download-and-install`. Outras opções: `install-from-existing-files`, `install-from-existing-files-if-needed`, `do-not-attempt-installing`.
- `--skip-sqlite-setup`: Não configurar a integração do banco SQLite.
- `--verbosity=<level>`: Saída de logs e mensagens de progresso. Opções: `quiet`, `normal`, `debug`. Padrão: `normal`.
- `--debug`: Exibe o log de erros do PHP se ocorrer erro na inicialização.
- `--follow-symlinks`: Permite que o Playground siga symlinks montando automaticamente diretórios e arquivos com symlink encontrados nos diretórios montados.
- `--internal-cookie-store`: Habilita o gerenciamento interno de cookies. Quando habilitado, o Playground gerencia cookies internamente com HttpCookieStore que persiste cookies entre requisições. Quando desabilitado, os cookies são tratados externamente (ex.: pelo navegador em ambientes Node.js). Padrão: false.
- `--phpmyadmin[=<path>]`: Instala phpMyAdmin para gerenciamento do banco. A URL do phpMyAdmin será exibida após a inicialização. Opcionalmente especifique um caminho de URL customizado (padrão: `/phpmyadmin`).
- `--xdebug`: Habilita Xdebug. Padrão: false.
- `--experimental-devtools`: Habilita ferramentas de desenvolvimento experimentais no navegador. Padrão: false.
- `--experimental-unsafe-ide-integration=<ide>`: Configura a integração Xdebug no VS Code (`vscode`) e PhpStorm (`phpstorm`).
- `--experimental-multi-worker=<number>`: Habilita suporte experimental a múltiplos workers, que exige um diretório `/wordpress` em um sistema de arquivos real. Passe um número positivo para o número de workers; caso contrário, padrão é número de CPUs menos 1.

<!--
:::caution
With the flag `--follow-symlinks`, the following symlinks will expose files outside mounted directories to Playground and could be a security risk.
:::
-->

:::caution
Com a flag `--follow-symlinks`, symlinks podem expor arquivos fora dos diretórios montados ao Playground e podem representar risco de segurança.
:::

<!--
## Need some help with the CLI?
-->

## Precisa de ajuda com o CLI?

<!--
With the Playground CLI, you can use the `--help` flag to get the full list of available commands and arguments.
-->

Com o Playground CLI, você pode usar a flag `--help` para ver a lista completa de comandos e argumentos disponíveis.

```bash
npx @wp-playground/cli@latest --help
```

<!--
## Programmatic usage
-->

## Uso programático

<!--
The Playground CLI can also be controlled programmatically from JavaScript/TypeScript
using the `runCLI` function. See the [Programmatic Usage guide](/guides/programmatic-playground-cli)
for details on automation and testing.
-->

O Playground CLI também pode ser controlado de forma programática a partir de JavaScript/TypeScript usando a função `runCLI`. Consulte o [guia de uso programático](/guides/programmatic-playground-cli) para detalhes sobre automação e testes.
