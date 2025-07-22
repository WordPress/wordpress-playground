---
slug: /contributing/code
---

<!--
# Code contributions
-->

# Contribuições de código

<!--
Like all WordPress projects, Playground uses GitHub to manage code and track issues. The main repository is at [https://github.com/WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) and the Playground Tools repository is at [https://github.com/WordPress/playground-tools/](https://github.com/WordPress/playground-tools/).
-->

Como todos os projetos WordPress, o Playground usa o GitHub para gerenciar o código e rastrear problemas. O repositório principal está em [https://github.com/WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) e o repositório de Ferramentas do Playground está em [https://github.com/WordPress/playground-tools/](https://github.com/WordPress/playground-tools/).

<!--
:::info Contribute to Playground Tools

This guide includes links to the main repository, but all the steps and options apply for both. If you're interested in the plugins or local development tools—start there.

:::
-->

:::info Contribua para as Ferramentas do Playground

Este guia inclui links para o repositório principal, mas todos os passos e opções se aplicam a ambos. Se você estiver interessado nos plugins ou nas ferramentas de desenvolvimento local, comece por aí.

:::

<!--
Browse [the list of open issues](https://github.com/wordpress/wordpress-playground/issues) to find what to work on. The [`Good First Issue`](https://github.com/wordpress/wordpress-playground/issues?q=is%3Aopen+is%3Aissue+label%3A%22Good+First+Issue%22) label is a recommended starting point for first-time contributors.
-->

Navegue pela [lista de issues abertas](https://github.com/wordpress/wordpress-playground/issues) para encontrar no que trabalhar. A etiqueta [`Good First Issue`](https://github.com/wordpress/wordpress-playground/issues?q=is%3Aopen+is%3Aissue+label%3A%22Good+First+Issue%22) é um ponto de partida recomendado para contribuidores de primeira viagem.

<!--
Be sure to review the following resources before you begin:
-->

Certifique-se de revisar os seguintes recursos antes de começar:

<!--
-   [Coding principles](/contributing/coding-standards)
-   [Architecture](/developers/architecture)
-   [Vision and Philosophy](https://github.com/WordPress/wordpress-playground/issues/472)
-   [WordPress Playground Roadmap](https://github.com/WordPress/wordpress-playground/issues/525)
-->

-   [Princípios de codificação](/contributing/coding-standards)
-   [Arquitetura](/developers/architecture)
-   [Visão e Filosofia](https://github.com/WordPress/wordpress-playground/issues/472)
-   [Roteiro do WordPress Playground](https://github.com/WordPress/wordpress-playground/issues/525)

<!--
## Contribute Pull Requests
-->

## Contribuir com Pull Requests

<!--
[Fork the Playground repository](https://github.com/WordPress/wordpress-playground/fork) and clone it to your local machine. To do that, copy and paste these commands into your terminal:
-->

[Faça um fork do repositório do Playground](https://github.com/WordPress/wordpress-playground/fork) e clone-o para sua máquina local. Para fazer isso, copie e cole estes comandos em seu terminal:

```bash
git clone -b trunk --single-branch --depth 1 --recurse-submodules

# substitua `SEU-NOME-DE-USUARIO-GITHUB` pelo seu nome de usuário do GitHub:
git@github.com:SEU-NOME-DE-USUARIO-GITHUB/wordpress-playground.git
cd wordpress-playground
npm install
```

<!--
Create a branch, make changes, and test it locally by running the following command:
-->

Crie uma branch, faça as alterações e teste-a localmente executando o seguinte comando:

```bash
npm run dev
```

<!--
Playground will open in a new browser tab and refresh automatically with each change.
-->

O Playground será aberto em uma nova aba do navegador e será atualizado automaticamente a cada alteração.

<!--
When your'e ready, commit the changes and submit a Pull Request.
-->

Quando estiver pronto, faça o commit das alterações e envie um Pull Request.

<!--
:::info Formatting

We handle code formatting and linting automatically. Relax, type away, and let the machines do the work.

:::
-->

:::info Formatação

Nós lidamos com a formatação de código e o linting automaticamente. Relaxe, digite e deixe as máquinas fazerem o trabalho.

:::

<!--
### Running a local Multisite
-->

### Executando um Multisite local

<!--
WordPress Multisite has a few [restrictions when run locally](https://developer.wordpress.org/advanced-administration/multisite/prepare-network/#restrictions). If you plan to test a Multisite network using Playground's `enableMultisite` step, make sure you either change `wp-now`'s default port or set a local test domain running via HTTPS.
-->

O WordPress Multisite tem algumas [restrições quando executado localmente](https://developer.wordpress.org/advanced-administration/multisite/prepare-network/#restrictions). Se você planeja testar uma rede Multisite usando o passo `enableMultisite` do Playground, certifique-se de alterar a porta padrão do `wp-now` ou definir um domínio de teste local executado via HTTPS.

<!--
To change `wp-now`'s default port to the one supported by WordPress Multisite, run it using the `--port=80` flag:
-->

Para alterar a porta padrão do `wp-now` para a suportada pelo WordPress Multisite, execute-o usando a flag `--port=80`:

```bash
npx @wp-now/wp-now start --port=80
```

<!--
There are a few ways to set up a local test domain, including editing your `hosts` file. If you're unsure how to do that, we suggest installing [Laravel Valet](https://laravel.com/docs/11.x/valet) and then running the following command:
-->

Existem algumas maneiras de configurar um domínio de teste local, incluindo a edição do seu arquivo `hosts`. Se você não tiver certeza de como fazer isso, sugerimos instalar o [Laravel Valet](https://laravel.com/docs/11.x/valet) e, em seguida, executar o seguinte comando:

```bash
valet proxy playground.test http://127.0.0.1:5400 --secure
```

<!--
Your dev server is now available on https://playground.test.
-->

Seu servidor de desenvolvimento agora está disponível em https://playground.test.

<!--
## Debugging
-->

## Depuração

<!--
### Use VS Code and Chrome
-->

### Use o VS Code e o Chrome

<!--
If you're using VS Code and have Chrome installed, you can debug Playground in the code editor:
-->

Se você estiver usando o VS Code e tiver o Chrome instalado, poderá depurar o Playground no editor de código:

<!--
-   Open the project folder in VS Code.
-   Select Run > Start Debugging from the main menu or press `F5`/`fn`+`F5`.
-->

-   Abra a pasta do projeto no VS Code.
-   Selecione Executar > Iniciar Depuração no menu principal ou pressione `F5`/`fn`+`F5`.

<!--
### Debugging PHP
-->

### Depurando o PHP

<!--
Playground logs PHP errors in the browser console after every PHP request.
-->

O Playground registra os erros do PHP no console do navegador após cada solicitação PHP.
