---
title: Solucionar problemas e depurar
slug: /blueprints/troubleshoot-and-debug
description: Um guia com dicas e ferramentas para ajudar você a solucionar problemas e depurar seus Blueprints, desde problemas comuns até ferramentas do navegador.
---

<!-- Review Common gotchas -->

## Revise os erros comuns

<!-- Require `wp-load`: to run a WordPress PHP function using the `runPHP` step, you'd need to require [wp-load.php](https://github.com/WordPress/WordPress/blob/master/wp-load.php). So, the value of the `code` key should start with `"<?php require_once('wordpress/wp-load.php'); REST_OF_YOUR_CODE"`. -->

- Exija `wp-load`: para executar uma função PHP do WordPress usando a etapa `runPHP`, você precisará exigir [wp-load.php](https://github.com/WordPress/WordPress/blob/master/wp-load.php). Portanto, o valor da chave `code` deve começar com `"<?php require_once('wordpress/wp-load.php'); RESTO_DO_SEU_CÓDIGO"`.

<!-- Common Issues and Solutions -->

## Problemas e Soluções Comuns

<!-- WP-CLI: Error Establishing a Database Connection on Mounted Sites -->

### WP-CLI: Erro ao Estabelecer Conexão com Banco de Dados em Sites Montados

<!-- When using `wp-cli` with a mounted Playground site (e.g., via `--mount-before-install`), you might encounter an "Error establishing a database connection." This happens because WordPress Playground loads the SQLite database integration plugin from its internal files by default, not from the mounted directory, meaning it's not persisted for external `wp-cli` calls. -->

Ao usar `wp-cli` com um site Playground montado (por exemplo, via `--mount-before-install`), você pode encontrar um erro "Erro ao estabelecer conexão com banco de dados". Isso acontece porque o WordPress Playground carrega o plugin de integração do banco de dados SQLite a partir de seus arquivos internos por padrão, não do diretório montado, significando que não é persistido para chamadas externas de `wp-cli`.

<!-- To resolve this, you need to explicitly install and configure the SQLite database integration plugin within your Blueprint. -->

Para resolver isso, você precisa instalar e configurar explicitamente o plugin de integração do banco de dados SQLite dentro de seu Blueprint.

<!-- **Solution:** Add the following steps to your Blueprint: -->

**Solução:** Adicione as seguintes etapas ao seu Blueprint:

<!-- **Example Usage:** To test this locally, combine the Blueprint with your Playground CLI command: -->

**Exemplo de Uso:**

Para testar isso localmente, combine o Blueprint com seu comando Playground CLI:

<!-- This will ensure the SQLite plugin is installed correctly and configured in your mounted WordPress site, allowing `wp-cli` commands to function correctly. -->

Isso garantirá que o plugin SQLite seja instalado corretamente e configurado em seu site WordPress montado, permitindo que comandos `wp-cli` funcionem corretamente.

<!-- Blueprints Builder -->

## Construtor de Blueprints

<!-- You can use an in-browser [Blueprints editor](https://playground.wordpress.net/builder/builder.html) to build, validate, and preview your Blueprints in the browser. -->

Você pode usar um [editor de Blueprints](https://playground.wordpress.net/builder/builder.html) no navegador para criar, validar e visualizar seus Blueprints.

<!-- :::danger Caution The editor is under development and the embedded Playground sometimes fails to load. To get around it, refresh the page. We're aware of that, and are working to improve the experience. ::: -->

:::danger Aviso

O editor está em desenvolvimento e o Playground incorporado às vezes falha ao carregar. Para contornar isso, atualize a página. Estamos cientes disso e trabalhando para melhorar a experiência.

:::

<!-- Check for the Filesystem and Database -->

## Verificar o Sistema de Arquivos e Banco de Dados

<!-- Some blueprint steps (such as [`writeFile`](/blueprints/steps#WriteFileStep)) alter the internal Filesystem structure of the Playground instance and some others (such as [`runSql`](/blueprints/steps#runSql)) alter the internal WordPress database. -->

Algumas etapas de blueprint (como [`writeFile`](/blueprints/steps#WriteFileStep)) alteram a estrutura interna do Sistema de Arquivos da instância Playground e outras (como [`runSql`](/blueprints/steps#runSql)) alteram o banco de dados interno do WordPress.

<!-- To check the final internal filesystem structure and database (after the blueprint steps have been applied) we can leverage some WordPress plugins that provide a SQL manager and a file explorer such as [`SQL Buddy`](https://wordpress.org/plugins/sql-buddy/) and [`WPide`](https://wordpress.org/plugins/wpide/) (you can see them in action from https://playground.wordpress.net/?plugin=sql-buddy&plugin=wpide) -->

Para verificar a estrutura final do sistema de arquivos interno e do banco de dados (após as etapas do blueprint terem sido aplicadas), podemos aproveitar alguns plugins WordPress que fornecem um gerenciador SQL e um explorador de arquivos como [`SQL Buddy`](https://wordpress.org/plugins/sql-buddy/) e [`WPide`](https://wordpress.org/plugins/wpide/) (você pode vê-los em ação em https://playground.wordpress.net/?plugin=sql-buddy&plugin=wpide)

<!-- :::tip There are a bunch of methods we can launch from the console of any WordPress Playground instance to inspect the internals of that instance. They're exposed as part of `window.playground` object (see [Developers > JavaScript API > Debugging and testing](/developers/apis/javascript-api/#debugging-and-testing)). Some examples: Full list of methods we can use is available [here](/api/client/interface/PlaygroundClient) ::: -->

:::tip

Há vários métodos que podemos lançar a partir do console de qualquer instância do WordPress Playground para inspecionar os internos dessa instância. Eles são expostos como parte do objeto `window.playground` (veja [Desenvolvedores > API JavaScript > Depuração e teste](/developers/apis/javascript-api/#debugging-and-testing)). Alguns exemplos:

A lista completa de métodos que podemos usar está disponível [aqui](/api/client/interface/PlaygroundClient)

:::

<!-- Check for errors in the browser console -->

## Verificar erros no console do navegador

<!-- If your Blueprint isn't running as expected, open the browser developer tools to check for any errors. -->

Se seu Blueprint não está sendo executado conforme esperado, abra as ferramentas de desenvolvedor do navegador para verificar se há erros.

<!-- To open the developer tools in Chrome, Firefox, Safari*, and Edge: press `Ctrl + Shift + I` on Windows/Linux or `Cmd + Option + I` on macOS. -->

Para abrir as ferramentas de desenvolvedor no Chrome, Firefox, Safari\* e Edge: pressione `Ctrl + Shift + I` no Windows/Linux ou `Cmd + Option + I` no macOS.

<!-- :::caution If you haven't yet, enable the Develop menu: go to **Safari > Settings... > Advanced** and check **Show features for web developers**. ::: -->

:::caution

Se você ainda não fez isso, ative o menu Desenvolvimento: vá para **Safari > Configurações... > Avançado** e marque **Mostrar recursos para desenvolvedores da web**.

:::

<!-- The developer tools window allows you to inspect network requests, view console logs, debug JavaScript, and examine the DOM and CSS styles applied to your webpage. This is crucial for diagnosing and fixing issues with Blueprints. -->

A janela de ferramentas de desenvolvedor permite inspecionar requisições de rede, visualizar logs do console, depurar JavaScript e examinar o DOM e estilos CSS aplicados à sua página. Isso é crucial para diagnosticar e corrigir problemas com Blueprints.

<!-- Log your own error messages -->

## Registre suas próprias mensagens de erro

<!-- You can `error_log` your own error messages through [`runPHP` step](/blueprints/steps#RunPHPStep) (see [blueprint example](https://github.com/wordpress/blueprints/blob/trunk/blueprints/reset-data-and-import-content/blueprint.json) and [live demo](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/reset-data-and-import-content/blueprint.json)) and check them from the ["View Logs" option](/web-instance#playground-options-menu) or from the browser's console. -->

Você pode usar `error_log` para suas próprias mensagens de erro através da [etapa `runPHP`](/blueprints/steps#RunPHPStep) (veja [exemplo de blueprint](https://github.com/wordpress/blueprints/blob/trunk/blueprints/reset-data-and-import-content/blueprint.json) e [demo ao vivo](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/reset-data-and-import-content/blueprint.json)) e verifique-os através da opção ["Ver Logs"](/web-instance#playground-options-menu) ou do console do navegador.

<!-- Log errors snapshot -->

![Captura de tela de erros de log](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/blueprints/log-errors.webp)

<!-- :::info When you download your Playground instance as a `zip` through the ["Download as zip" option](/web-instance#playground-options-menu) you'll also download the `debug.log` file containing all the logs from your Playground instance. ::: -->

<div class="callout callout-info">

Quando você baixa sua instância do Playground como um `zip` através da opção ["Baixar como zip"](/web-instance#playground-options-menu), você também baixa o arquivo `debug.log` contendo todos os logs de sua instância do Playground.

</div>

<!-- Ask for help -->

## Peça ajuda

<!-- The community is here to help! If you have questions or comments, [open a new issue](https://github.com/adamziel/blueprints/issues) in this repository. Remember to include the following details: -->

A comunidade está aqui para ajudar! Se você tem perguntas ou comentários, [abra uma nova issue](https://github.com/adamziel/blueprints/issues) neste repositório. Lembre-se de incluir os seguintes detalhes:

<!--
-   The Blueprint you’re trying to run.
-   The error message you’re seeing, if any.
-   The full output from the browser developer tools.
-   Any other relevant information that might help us understand the issue: OS, browser version, etc.
-->

- O Blueprint que você está tentando executar.
- A mensagem de erro que você está vendo, se houver.
- A saída completa das ferramentas de desenvolvedor do navegador.
- Qualquer outra informação relevante que possa nos ajudar a entender o problema: SO, versão do navegador, etc.
