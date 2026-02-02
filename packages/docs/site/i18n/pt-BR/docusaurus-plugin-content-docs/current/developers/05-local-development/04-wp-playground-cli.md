---
title: Playground CLI
slug: /developers/local-development/wp-playground-cli
---

<!-- # Playground CLI -->

# Playground CLI

<!-- [@wp-playground/cli](https://www.npmjs.com/package/@wp-playground/cli) is a command-line tool that simplifies the WordPress development and testing flow.
Playground CLI supports auto-mounting a directory with a plugin, theme, or WordPress installation. But if you need flexibility, the CLI supports mounting commands to personalize your local environment. -->

[@wp-playground/cli](https://www.npmjs.com/package/@wp-playground/cli) é uma ferramenta de linha de comando que simplifica o fluxo de desenvolvimento e teste do WordPress.
O Playground CLI suporta auto-montagem de um diretório com um plugin, tema ou instalação WordPress. Mas se você precisa de flexibilidade, o CLI suporta comandos de montagem para personalizar seu ambiente local.

<!-- **Key features:** -->

**Principais recursos:**

<!-- -   **Quick Setup**: Set up a local WordPress environment in seconds. -->
<!-- -   **Flexibility**: Allows for configuration to adapt to different scenarios. -->
<!-- -   **Simple Environment**: No extra configuration, just a compatible Node version, and you are ready to use it. -->

- **Configuração Rápida**: Configure um ambiente WordPress local em segundos.
- **Flexibilidade**: Permite configuração para se adaptar a diferentes cenários.
- **Ambiente Simples**: Sem configuração extra, apenas uma versão Node compatível, e você está pronto para usar.

<!-- ## Requirements -->

## Requisitos

<!-- The Playground CLI requires Node.js 20.18 or higher, which is the recommended Long-Term Support (LTS) version. You can download it from the [Node.js website](https://nodejs.org/en/download). -->

O Playground CLI requer Node.js 20.18 ou superior, que é a versão recomendada de Suporte de Longo Prazo (LTS). Você pode baixá-la no [site do Node.js](https://nodejs.org/en/download).

<!-- ## Quickstart -->

## Início Rápido

<!-- Running the Playground CLI is as simple as go to a command-line and run: -->

Executar o Playground CLI é tão simples quanto ir para uma linha de comando e executar:

```bash
npx @wp-playground/cli@latest server
```

<!-- ![Playground CLI in Action](@site/static/img/developers/npx-wp-playground-server.gif) -->

![Playground CLI em Ação](@site/static/img/developers/npx-wp-playground-server.gif)

<!-- With the previous command, you only get a fresh WordPress instance to test. Most of the developers want to see their work running. If this is your case, test a plugin or a theme. You can run the CLI on your project folder and run the Playground CLI with the `--auto-mount` flag: -->

Com o comando anterior, você obtém apenas uma instância WordPress fresca para testar. A maioria dos desenvolvedores quer ver seu trabalho rodando. Se este é o seu caso, teste um plugin ou tema. Você pode executar o CLI na pasta do seu projeto e executar o Playground CLI com a flag `--auto-mount`:

```bash
cd my-plugin-or-theme-directory
npx @wp-playground/cli@latest server --auto-mount
```

<!-- ### Choosing a WordPress and PHP Version -->

### Escolhendo uma Versão do WordPress e PHP

<!-- By default, the CLI loads the latest stable version of WordPress and PHP 8.3 due to its improved performance. To specify your preferred versions, you can use the flag `--wp=<version>` and `--php=<version>`: -->

Por padrão, o CLI carrega a versão estável mais recente do WordPress e PHP 8.3 devido ao seu desempenho melhorado. Para especificar suas versões preferidas, você pode usar as flags `--wp=<version>` e `--php=<version>`:

```bash
npx @wp-playground/cli@latest server --wp=6.8 --php=8.4
```

<!-- ### Loading Blueprints -->

### Carregando Blueprints

<!-- One way to take your Playground CLI development experience to the next level is to integrate with [Blueprints](/blueprints/getting-started/). For those unfamiliar with this technology, it allows developers to configure the initial state for their WordPress Playground instances. -->

Uma maneira de levar sua experiência de desenvolvimento do Playground CLI para o próximo nível é integrar com [Blueprints](/blueprints/getting-started/). Para aqueles não familiarizados com esta tecnologia, ela permite que desenvolvedores configurem o estado inicial para suas instâncias WordPress Playground.

<!-- Using the `--blueprint=<blueprint-address>` flag, developers can run a Playground with a custom initial state. We'll use the example below to do this. -->

Usando a flag `--blueprint=<blueprint-address>`, desenvolvedores podem executar um Playground com um estado inicial personalizado. Usaremos o exemplo abaixo para fazer isso.

<!-- **(my-blueprint.json)** -->

**(meu-blueprint.json)**

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

<!-- CLI command loading a blueprint: -->

Comando CLI carregando um blueprint:

```bash
npx @wp-playground/cli@latest server --blueprint=my-blueprint.json
```

<!-- ### Mounting folders manually -->

### Montando pastas manualmente

<!-- Some projects have a specific structure that requires a custom configuration; for example, your repository contains all the files in the `/wp-content/` folder. So in this scenario, you can specify to the Playground CLI that it will mount your project from that folder using the `--mount` flag. -->

Alguns projetos têm uma estrutura específica que requer uma configuração personalizada; por exemplo, seu repositório contém todos os arquivos na pasta `/wp-content/`. Então neste cenário, você pode especificar ao Playground CLI que ele montará seu projeto a partir dessa pasta usando a flag `--mount`.

```bash
npx @wp-playground/cli@latest server --mount=.:/wordpress/wp-content/plugins/MY-PLUGIN-DIRECTORY
```

<!-- ### Mounting before WordPress installation -->

### Montando antes da instalação do WordPress

<!-- Consider mounting your WordPress project files before the WordPress installation begins. This approach is beneficial if you want to override the Playground boot process, as it can help connect Playground with `WP-CLI`. The `--mount-before-install` flag supports this process. -->

Considere montar seus arquivos de projeto WordPress antes da instalação do WordPress começar. Esta abordagem é benéfica se você quer sobrescrever o processo de inicialização do Playground, pois pode ajudar a conectar o Playground com `WP-CLI`. A flag `--mount-before-install` suporta este processo.

```bash
npx @wp-playground/cli@latest server --mount-before-install=.:/wordpress/
```

<!-- :::info -->
<!-- On Windows, the path format `/host/path:/vfs/path` can cause issues. To resolve this, use the flags `--mount-dir` and `--mount-dir-before-install`. These flags let you specify host and virtual file system paths in an alternative format`"/host/path"` `"/vfs/path"`. -->
<!-- ::: -->

:::info
No Windows, o formato de caminho `/host/path:/vfs/path` pode causar problemas. Para resolver isso, use as flags `--mount-dir` e `--mount-dir-before-install`. Estas flags permitem que você especifique caminhos do host e do sistema de arquivos virtual em um formato alternativo `"/host/path"` `"/vfs/path"`.
:::

<!-- ### Understanding Data Persistence and SQLite Location -->

### Entendendo a Persistência de Dados e Localização do SQLite

<!-- By default, Playground CLI stores WordPress files and the SQLite database in **temporary directories on your operating system**: -->

Por padrão, o Playground CLI armazena arquivos WordPress e o banco de dados SQLite em **diretórios temporários no seu sistema operacional**:

```
<OS-TEMP-DIR>/playground-<random-id>/
├── wordpress/          # Instalação WordPress
├── internal/          # Configuração do runtime do Playground
└── tmp/              # Arquivos temporários PHP
```

<!-- **Finding Your Temp Directory:** -->

**Encontrando Seu Diretório Temporário:**

<!-- The actual location depends on your OS (these are examples or common possibilities): -->

A localização real depende do seu SO (estes são exemplos ou possibilidades comuns):

<!-- -   **macOS/Linux**: May be under `/tmp/` or `/private/var/folders/` (varies by system) -->
<!-- -   **Windows**: `C:\Users\<username>\AppData\Local\Temp\` -->

- **macOS/Linux**: Pode estar em `/tmp/` ou `/private/var/folders/` (varia por sistema)
- **Windows**: `C:\Users\<username>\AppData\Local\Temp\`

<!-- To see the exact temp directory path being used, run the CLI with the `--verbosity=debug` flag: -->

Para ver o caminho exato do diretório temporário sendo usado, execute o CLI com a flag `--verbosity=debug`:

```bash
npx @wp-playground/cli@latest server --verbosity=debug
```

<!-- This will output something like: -->

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

<!-- **Where is the SQLite Database Stored?** -->

**Onde o Banco de Dados SQLite é Armazenado?**

<!-- The database location depends on what you mount: -->

A localização do banco de dados depende do que você montar:

<!-- -   **Auto-mounting wp-content or full WordPress**: -->

- **Auto-montagem de wp-content ou WordPress completo**:

    <!-- -   Database: `<your-local-project>/wp-content/database/.ht.sqlite` -->
    <!-- -   ✅ **Persisted locally** in your project folder -->
    - Banco de dados: `<seu-projeto-local>/wp-content/database/.ht.sqlite`
    - ✅ **Persistido localmente** na pasta do seu projeto

<!-- -   **Auto-mounting plugin/theme only**: -->

- **Auto-montagem apenas de plugin/tema**:

    <!-- -   Database: `<OS-TEMP-DIR>/playground-<id>/wordpress/wp-content/database/.ht.sqlite` -->
    <!-- -   ⚠️ **Lost when server stops** (temp directories are cleaned up) -->
    - Banco de dados: `<OS-TEMP-DIR>/playground-<id>/wordpress/wp-content/database/.ht.sqlite`
    - ⚠️ **Perdido quando o servidor para** (diretórios temporários são limpos)

<!-- -   **Custom mounts**: Database location follows your mount configuration -->

- **Montagens personalizadas**: A localização do banco de dados segue sua configuração de montagem

<!-- **Automatic Cleanup:** -->

**Limpeza Automática:**

<!-- Playground CLI automatically removes temp directories that are: -->

O Playground CLI remove automaticamente diretórios temporários que são:

<!-- -   Older than 2 days -->
<!-- -   No longer associated with a running process -->

- Mais antigos que 2 dias
- Não mais associados com um processo em execução

<!-- **Recommendation:** To persist both your code and database when developing plugins or themes, mount the entire `wp-content` directory instead of just the plugin/theme folder. -->

**Recomendação:** Para persistir tanto seu código quanto o banco de dados ao desenvolver plugins ou temas, monte o diretório `wp-content` inteiro em vez de apenas a pasta do plugin/tema.

<!-- **Example: Mounting wp-content for persistence** -->

**Exemplo: Montando wp-content para persistência**

```bash
# Mount your entire wp-content directory
cd my-wordpress-project
npx @wp-playground/cli@latest server --mount=./wp-content:/wordpress/wp-content
```

<!-- ## Command and Arguments -->

## Comandos e Argumentos

<!-- Playground CLI is simple, configurable, and unopinionated. You can set it up according
to your unique WordPress setup. With the Playground CLI, you can use the following top-level commands: -->

O Playground CLI é simples, configurável e sem opiniões. Você pode configurá-lo de acordo
com sua configuração WordPress única. Com o Playground CLI, você pode usar os seguintes comandos de nível superior:

<!-- -   **`server`**: (Default) Starts a local WordPress server. -->
<!-- -   **`run-blueprint`**: Executes a Blueprint file without starting a web server. -->
<!-- -   **`build-snapshot`**: Builds a ZIP snapshot of a WordPress site based on a Blueprint. -->

- **`server`**: (Padrão) Inicia um servidor WordPress local.
- **`run-blueprint`**: Executa um arquivo Blueprint sem iniciar um servidor web.
- **`build-snapshot`**: Constrói um snapshot ZIP de um site WordPress baseado em um Blueprint.

<!-- The `server` command supports the following optional arguments: -->

O comando `server` suporta os seguintes argumentos opcionais:

- `--port=<port>`: O número da porta para o servidor escutar. Padrão é 9400.
- `--version`: Mostrar número da versão.
- `--outfile`: Ao construir, escrever neste arquivo de saída.
- `--site-url=<url>`: URL do site a usar para WordPress. Padrão é `http://127.0.0.1:{port}`.
- `--wp=<version>`: A versão do WordPress a usar. Padrão é a mais recente.
- `--php=<version>`: Versão do PHP a usar. Opções: `8.4`, `8.3`, `8.2`, `8.1`, `8.0`, `7.4`. Padrão é `8.3`.
- `--auto-mount[=<path>]`: Montar automaticamente um diretório. Se nenhum caminho for fornecido, monta o diretório de trabalho atual. Você pode montar um diretório WordPress, um diretório de plugin, um diretório de tema, um diretório wp-content, ou qualquer diretório contendo arquivos PHP e HTML.
- `--mount=<mapping>`: Montar manualmente um diretório (pode ser usado múltiplas vezes). Formato: `"/host/path:/vfs/path"`.
- `--mount-before-install`: Montar um diretório no runtime PHP antes da instalação do WordPress (pode ser usado múltiplas vezes). Formato: `"/host/path:/vfs/path"`.
- `--mount-dir`: Montar um diretório no runtime PHP (pode ser usado múltiplas vezes). Formato: `"/host/path"` `"/vfs/path"`.
- `--mount-dir-before-install`: Montar um diretório antes da instalação do WordPress (pode ser usado múltiplas vezes). Formato: `"/host/path"` `"/vfs/path"`
- `--blueprint=<path>`: O caminho para um arquivo JSON Blueprint para executar.
- `--blueprint-may-read-adjacent-files`: Flag de consentimento: Permitir que recursos "empacotados" em um blueprint local leiam arquivos no mesmo diretório do arquivo blueprint.
- `--login`: Fazer login automaticamente do usuário como administrador.
- `--wordpress-install-mode <mode>`: Controla como o Playground prepara o WordPress antes de inicializar. O padrão é `download-and-install`. Outras opções: `install-from-existing-files` (instala usando os arquivos montados), `install-from-existing-files-if-needed` (ignora a configuração quando detecta um site existente) e `do-not-attempt-installing` (nunca baixa ou instala o WordPress).
- `--skip-sqlite-setup`: Não configurar a integração do banco de dados SQLite.
- `--verbosity=<level>`: Saída de logs e mensagens de progresso. Opções: `quiet`, `normal`, `debug`. Padrão é `normal`.
- `--debug`: Imprimir o log de erro do PHP se um erro ocorrer durante a inicialização.
- `--follow-symlinks`: Permitir que o Playground siga links simbólicos montando automaticamente diretórios e arquivos vinculados simbolicamente encontrados em diretórios montados.
- `--internal-cookie-store`: Habilitar tratamento interno de cookies. Quando habilitado, o Playground gerenciará cookies internamente usando um HttpCookieStore que persiste cookies entre requisições. Quando desabilitado, cookies são tratados externamente (por exemplo, por um navegador em ambientes Node.js). Padrão é false.
- `--xdebug`: Habilitar Xdebug. Padrão é false.
- `--experimental-devtools`: Habilitar ferramentas de desenvolvimento experimentais do navegador. Padrão é false.
- `--experimental-multi-worker=<number>`: Habilitar suporte experimental multi-worker que requer um diretório `/wordpress` apoiado por um sistema de arquivos real. Passe um número positivo para especificar o número de workers a usar. Caso contrário, padrão é o número de CPUs menos 1.

:::caution
Com a flag `--follow-symlinks`, os seguintes links simbólicos irão expor arquivos fora dos diretórios montados ao Playground e podem ser um risco de segurança.
:::

<!-- ## Need some help with the CLI? -->

## Precisa de ajuda com o CLI?

<!-- With the Playground CLI, you can use the `--help` flag to get the full list of available commands and arguments. -->

Com o Playground CLI, você pode usar a flag `--help` para obter a lista completa de comandos e argumentos disponíveis.

```bash
npx @wp-playground/cli@latest --help
```

<!-- ## Programmatic Usage with JavaScript -->

## Uso Programático com JavaScript

<!-- The Playground CLI can also be controlled programmatically from your JavaScript/TypeScript code using the `runCLI` function. This gives you direct access to all CLI functionalities within your code, which is useful for automating end-to-end tests. Let's cover the basics of using `runCLI`. -->

O Playground CLI também pode ser controlado programaticamente a partir do seu código JavaScript/TypeScript usando a função `runCLI`. Isso fornece acesso direto a todas as funcionalidades do CLI dentro do seu código, o que é útil para automatizar testes end-to-end. Vamos cobrir o básico do uso de `runCLI`.

<!-- ### Running a WordPress instance with a specific version -->

### Executando uma instância WordPress com uma versão específica

<!-- Using the `runCLI` function, you can specify options like the PHP and WordPress versions. In the example below, we request PHP 8.3, the latest version of WordPress, and to be automatically logged in. All supported arguments are defined in the `RunCLIArgs` type. -->

Usando a função `runCLI`, você pode especificar opções como as versões do PHP e WordPress. No exemplo abaixo, solicitamos PHP 8.3, a versão mais recente do WordPress, e para fazer login automaticamente. Todos os argumentos suportados são definidos no tipo `RunCLIArgs`.

```TypeScript
import { runCLI, RunCLIArgs, RunCLIServer } from "@wp-playground/cli";

let cliServer: RunCLIServer;

cliServer = await runCLI({
    command: 'server',
    php: '8.3',
    wp: 'latest',
    login: true
} as RunCLIArgs);
```

<!-- To execute the code above, the developer can set their preferred method. A simple way to execute this code is to save it as a `.ts` file and run it with a tool like `tsx`. For example: `tsx my-script.ts` -->

Para executar o código acima, o desenvolvedor pode definir seu método preferido. Uma maneira simples de executar este código é salvá-lo como um arquivo `.ts` e executá-lo com uma ferramenta como `tsx`. Por exemplo: `tsx meu-script.ts`

<!-- ### Setting a Blueprint -->

### Definindo um Blueprint

<!-- You can provide a blueprint in two ways: either as an object literal directly passed to the `blueprint` property, or as a string containing the path to an external `.json` file. -->

Você pode fornecer um blueprint de duas maneiras: como um objeto literal passado diretamente para a propriedade `blueprint`, ou como uma string contendo o caminho para um arquivo `.json` externo.

```TypeScript
import { runCLI, RunCLIServer } from "@wp-playground/cli";

let cliServer: RunCLIServer;

cliServer = await runCLI({
  command: 'server',
  wp: 'latest',
  blueprint: {
    steps: [
        {
          "step": "setSiteOptions",
          "options": {
              "blogname": "Blueprint Title",
              "blogdescription": "A great blog description"
          }
        }
    ],
  },
});
```

<!-- For full type-safety when defining your blueprint object, you can import and use the `BlueprintDeclaration` type from the `@wp-playground/blueprints` package: -->

Para total segurança de tipo ao definir seu objeto blueprint, você pode importar e usar o tipo `BlueprintDeclaration` do pacote `@wp-playground/blueprints`:

```TypeScript
import type { BlueprintDeclaration } from '@wp-playground/blueprints';

const myBlueprint: BlueprintDeclaration = {
  landingPage: "/wp-admin/",
  steps: [
    {
      "step": "installTheme",
      "themeData": {
        "resource": "wordpress.org/themes",
        "slug": "twentytwentyone"
      },
      "options": {
        "activate": true
      }
    }
  ]
};
```

<!-- ### Mounting a plugin programmatically -->

### Montando um plugin programaticamente

<!-- It is possible to mount local directories programmatically using `runCLI`. The options `mount` and `mount-before-install` are available. The `hostPath` property expects a path to a directory on your local machine. This path should be relative to where your script is being executed. -->

É possível montar diretórios locais programaticamente usando `runCLI`. As opções `mount` e `mount-before-install` estão disponíveis. A propriedade `hostPath` espera um caminho para um diretório na sua máquina local. Este caminho deve ser relativo a onde seu script está sendo executado.

```TypeScript
	cliServer = await runCLI({
      command: 'server',
      login: true,
      'mount-before-install': [
        {
          hostPath: './[my-plugin-local-path]',
          vfsPath: '/wordpress/wp-content/plugins/my-plugin',
        },
      ],
    });
```

<!-- With those options we can combine mounting parts of the project with blueprints, for example: -->

Com essas opções podemos combinar a montagem de partes do projeto com blueprints, por exemplo:

```TypeScript

import { runCLI, RunCLIArgs, RunCLIServer } from "@wp-playground/cli";

let cliServer: RunCLIServer;

cliServer = await runCLI({
    command: 'server',
    php: '8.3',
    wp: 'latest',
    login: true,
    mount: [
        {
            "hostPath": "./plugin/",
            "vfsPath": "/wordpress/wp-content/plugins/playwright-test"
        }
    ],
    blueprint: {
        steps: [
            {
                "step": "activatePlugin",
                "pluginPath": "/wordpress/wp-content/plugins/playwright-test/plugin-playwright.php"
            }
        ]
    }
} as RunCLIArgs);
```
