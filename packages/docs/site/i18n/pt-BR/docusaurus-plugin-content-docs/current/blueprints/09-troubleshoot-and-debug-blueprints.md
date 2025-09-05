---
title: Solucionar problemas e depurar
slug: /blueprints/troubleshoot-and-debug
description: Um guia com dicas e ferramentas para ajudá-lo a solucionar problemas e depurar seus Blueprints, desde problemas comuns até ferramentas do navegador.
---

<!-- # Troubleshoot and debug Blueprints -->

# Solucionar problemas e depurar Blueprints

<!-- When you build Blueprints, you might run into issues. Here are tips and tools to help you debug them: -->

Quando você constrói Blueprints, você pode encontrar problemas. Aqui estão dicas e ferramentas para ajudá-lo a depurá-los:

<!-- ## Review Common gotchas -->

## Revisar pegadinhas comuns

<!-- -   Require `wp-load`: to run a WordPress PHP function using the `runPHP` step, you'd need to require [wp-load.php](https://github.com/WordPress/WordPress/blob/master/wp-load.php). So, the value of the `code` key should start with `"<?php require_once('wordpress/wp-load.php'); REST_OF_YOUR_CODE"`. -->
<!-- -   Enable `networking`: to access wp.org assets (themes, plugins, blocks, or patterns), or load a stylesheet using [add_editor_style()](https://developer.wordpress.org/reference/functions/add_editor_style/) (say, when [creating a custom block style](https://developer.wordpress.org/news/2023/02/creating-custom-block-styles-in-wordpress-themes)), you'd need to enable the `networking` option: `"features": {"networking": true}`. -->

-   Requerir `wp-load`: para executar uma função PHP do WordPress usando o passo `runPHP`, você precisaria requerer [wp-load.php](https://github.com/WordPress/WordPress/blob/master/wp-load.php). Então, o valor da chave `code` deve começar com `"<?php require_once('wordpress/wp-load.php'); REST_OF_YOUR_CODE"`.
-   Habilitar `networking`: para acessar recursos do wp.org (temas, plugins, blocos ou padrões), ou carregar uma folha de estilo usando [add_editor_style()](https://developer.wordpress.org/reference/functions/add_editor_style/) (digamos, ao [criar um estilo de bloco personalizado](https://developer.wordpress.org/news/2023/02/creating-custom-block-styles-in-wordpress-themes)), você precisaria habilitar a opção `networking`: `"features": {"networking": true}`.

<!-- ## Blueprints Builder -->

## Construtor de Blueprints

<!-- You can use an in-browser [Blueprints editor](https://playground.wordpress.net/builder/builder.html) to build, validate, and preview your Blueprints in the browser. -->

Você pode usar um [editor de Blueprints no navegador](https://playground.wordpress.net/builder/builder.html) para construir, validar e visualizar seus Blueprints no navegador.

<!-- :::danger Caution -->

:::danger Cuidado

<!-- The editor is under development and the embedded Playground sometimes fails to load. To get around it, refresh the page. We're aware of that, and are working to improve the experience. -->

O editor está em desenvolvimento e o Playground incorporado às vezes falha ao carregar. Para contornar isso, atualize a página. Estamos cientes disso e estamos trabalhando para melhorar a experiência.

:::

<!-- ## Check for the Filesystem and Database -->

## Verificar o Sistema de Arquivos e Banco de Dados

<!-- Some blueprint steps (such as [`writeFile`](/blueprints/steps#WriteFileStep)) alter the internal Filesystem structure of the Playground instance and some others (such as [`runSql`](/blueprints/steps#runSql)) alter the internal WordPress database. -->

Alguns passos de blueprint (como [`writeFile`](/blueprints/steps#WriteFileStep)) alteram a estrutura interna do Sistema de Arquivos da instância do Playground e outros (como [`runSql`](/blueprints/steps#runSql)) alteram o banco de dados interno do WordPress.

<!-- To check the final internal filesystem structure and database (after the blueprint steps have been applied) we can leverage some WordPress plugins that provide a SQL manager and a file explorer such as [`SQL Buddy`](https://wordpress.org/plugins/sql-buddy/) and [`WPide`](https://wordpress.org/plugins/wpide/) (you can see them in action from https://playground.wordpress.net/?plugin=sql-buddy&plugin=wpide) -->

Para verificar a estrutura final do sistema de arquivos interno e banco de dados (após os passos do blueprint terem sido aplicados) podemos aproveitar alguns plugins WordPress que fornecem um gerenciador SQL e um explorador de arquivos como [`SQL Buddy`](https://wordpress.org/plugins/sql-buddy/) e [`WPide`](https://wordpress.org/plugins/wpide/) (você pode vê-los em ação em https://playground.wordpress.net/?plugin=sql-buddy&plugin=wpide)

<!-- :::tip -->

:::tip

<!-- There are a bunch of methods we can launch from the console of any WordPress Playground instance to inspect the internals of that instance. They're exposed as part of `window.playground` object (see [Developers > JavaScript API > Debugging and testing](/developers/apis/javascript-api/#debugging-and-testing)). Some examples: -->

Há vários métodos que podemos executar do console de qualquer instância do WordPress Playground para inspecionar os internos dessa instância. Eles são expostos como parte do objeto `window.playground` (veja [Desenvolvedores > API JavaScript > Depuração e teste](/developers/apis/javascript-api/#debugging-and-testing)). Alguns exemplos:

```
> await playground.isDir("/wordpress/wp-content/plugins")
true
> await playground.listFiles("/wordpress/wp-content/plugins")
(3) ['hello.php', 'index.php', 'WordPress-Importer-master']
```

<!-- Full list of methods we can use is available [here](/api/client/interface/PlaygroundClient) -->

Lista completa de métodos que podemos usar está disponível [aqui](/api/client/interface/PlaygroundClient)

:::

<!-- ## Check for errors in the browser console -->

## Verificar erros no console do navegador

<!-- If your Blueprint isn't running as expected, open the browser developer tools to see if there are any errors. -->

Se seu Blueprint não está executando como esperado, abra as ferramentas de desenvolvedor do navegador para ver se há algum erro.

<!-- To open the developer tools in Chrome, Firefox, Safari\*, and Edge: press `Ctrl + Shift + I` on Windows/Linux or `Cmd + Option + I` on macOS. -->

Para abrir as ferramentas de desenvolvedor no Chrome, Firefox, Safari\* e Edge: pressione `Ctrl + Shift + I` no Windows/Linux ou `Cmd + Option + I` no macOS.

<!-- :::caution -->

:::caution

<!-- If you haven't yet, enable the Develop menu: go to **Safari > Settings... > Advanced** and check **Show features for web developers**. -->

Se você ainda não fez isso, habilite o menu Desenvolver: vá para **Safari > Configurações... > Avançado** e marque **Mostrar recursos para desenvolvedores web**.

:::

<!-- The developer tools window allows you to inspect network requests, view console logs, debug JavaScript, and examine the DOM and CSS styles applied to your webpage. This is crucial for diagnosing and fixing issues with Blueprints. -->

A janela de ferramentas de desenvolvedor permite que você inspecione requisições de rede, visualize logs do console, depure JavaScript e examine o DOM e estilos CSS aplicados à sua página web. Isso é crucial para diagnosticar e corrigir problemas com Blueprints.

<!-- ## Log your own error messages -->

## Registrar suas próprias mensagens de erro

<!-- You can `error_log` your own error messages through [`runPHP` step](/blueprints/steps#RunPHPStep) (see [blueprint example](https://github.com/wordpress/blueprints/blob/trunk/blueprints/reset-data-and-import-content/blueprint.json) and [live demo](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/reset-data-and-import-content/blueprint.json)) and check them from the ["View Logs" option](/web-instance#playground-options-menu) or from the browser's console. -->

Você pode `error_log` suas próprias mensagens de erro através do passo [`runPHP`](/blueprints/steps#RunPHPStep) (veja [exemplo de blueprint](https://github.com/wordpress/blueprints/blob/trunk/blueprints/reset-data-and-import-content/blueprint.json) e [demo ao vivo](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/reset-data-and-import-content/blueprint.json)) e verificá-las da opção ["Ver Logs"](/web-instance#playground-options-menu) ou do console do navegador.

![Log errors snapshot](@site/static/img/blueprints/log-errors.webp)

<!-- :::info -->
<!-- When you download your Playground instance as a `zip` through the ["Download as zip" option](/web-instance#playground-options-menu) you'll also download the `debug.log` file containing all the logs from your Playground instance. -->
<!-- ::: -->

:::info
Quando você baixa sua instância do Playground como um `zip` através da opção ["Baixar como zip"](/web-instance#playground-options-menu) você também baixará o arquivo `debug.log` contendo todos os logs da sua instância do Playground.
:::

<!-- ## Ask for help -->

## Pedir ajuda

<!-- The community is here to help! If you have questions or comments, [open a new issue](https://github.com/adamziel/blueprints/issues) in this repository. Remember to include the following details: -->

A comunidade está aqui para ajudar! Se você tem perguntas ou comentários, [abra uma nova issue](https://github.com/adamziel/blueprints/issues) neste repositório. Lembre-se de incluir os seguintes detalhes:

<!-- -   The Blueprint you're trying to run. -->
<!-- -   The error message you're seeing, if any. -->
<!-- -   The full output from the browser developer tools. -->
<!-- -   Any other relevant information that might help us understand the issue: OS, browser version, etc. -->

-   O Blueprint que você está tentando executar.
-   A mensagem de erro que você está vendo, se houver.
-   A saída completa das ferramentas de desenvolvedor do navegador.
-   Qualquer outra informação relevante que possa nos ajudar a entender o problema: SO, versão do navegador, etc.
