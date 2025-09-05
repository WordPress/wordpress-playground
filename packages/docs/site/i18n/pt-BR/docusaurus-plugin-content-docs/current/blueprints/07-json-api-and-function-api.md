---
title: Consistência da API
slug: /blueprints/steps/api-consistency
description: Aprenda sobre a relação entre o formato JSON do Blueprint e a API de função JavaScript subjacente usada para executar passos.
---

<!-- # JSON API and Function API -->

# API JSON e API de Função

<!-- Blueprints are defined in JSON format, but the underlying implementation uses JavaScript functions to execute the steps. While JSON is the most convenient way of interacting with Blueprints, you can also use the underlying functions directly. -->

Blueprints são definidos em formato JSON, mas a implementação subjacente usa funções JavaScript para executar os passos. Embora JSON seja a forma mais conveniente de interagir com Blueprints, você também pode usar as funções subjacentes diretamente.

<!-- JSON is merely a wrapper around the functions. Whether you use the JSON steps or the exported functions, you'll have to provide the same parameters (except for the step name): -->

JSON é meramente um wrapper em torno das funções. Se você usar os passos JSON ou as funções exportadas, você terá que fornecer os mesmos parâmetros (exceto para o nome do passo):

<!-- You can use Blueprints both with the web and the node.js versions of WordPress Playground. -->

Você pode usar Blueprints tanto com as versões web quanto node.js do WordPress Playground.

<!-- :::info Blueprints version 2 -->

:::info Blueprints versão 2

<!-- The team is exploring ways to transition Blueprints from a TypeScript library to a PHP library. This would allow people to run Blueprints in any WordPress environments: Playground, a hosted site, or a local setup. -->

A equipe está explorando formas de fazer a transição dos Blueprints de uma biblioteca TypeScript para uma biblioteca PHP. Isso permitiria que as pessoas executem Blueprints em qualquer ambiente WordPress: Playground, um site hospedado ou uma configuração local.

<!-- The proposed [new specification](https://github.com/WordPress/blueprints-library/issues/6) is discussed on a separate [GitHub repository](https://github.com/WordPress/blueprints-library/), and you're more than welcome to join (there or on the [#playground](https://wordpress.slack.com/archives/C04EWKGDJ0K) Slack channel) and help shape the next generation of Playground. -->

A [nova especificação proposta](https://github.com/WordPress/blueprints-library/issues/6) é discutida em um [repositório GitHub separado](https://github.com/WordPress/blueprints-library/), e você é mais que bem-vindo para participar (lá ou no canal Slack [#playground](https://wordpress.slack.com/archives/C04EWKGDJ0K)) e ajudar a moldar a próxima geração do Playground.
:::

<!-- ## Differences between JSON and Function APIs -->

## Diferenças entre as APIs JSON e de Função

<!-- There are two main differences between the JSON and Function APIs: -->

Há duas principais diferenças entre as APIs JSON e de Função:

<!-- 1. Blueprints handle the progress bar and error reporting for you. The function API requires you to handle these yourself. -->
<!-- 2. The function API requires importing the API client library while Blueprints may be just pasted into the URL fragment. -->

1. Blueprints lidam com a barra de progresso e relatório de erros para você. A API de função requer que você lide com isso sozinho.
2. A API de função requer importar a biblioteca cliente da API enquanto Blueprints podem ser apenas colados no fragmento da URL.

<!-- :::note -->
<!-- Check the [Use the same structure for Blueprint JSON definitions and step handlers](https://github.com/WordPress/wordpress-playground/pull/215) issue at [wordpress-playground](https://github.com/WordPress/wordpress-playground) repo for more detailed info about this topic -->
<!-- ::: -->

:::note
Confira a issue [Use the same structure for Blueprint JSON definitions and step handlers](https://github.com/WordPress/wordpress-playground/pull/215) no repositório [wordpress-playground](https://github.com/WordPress/wordpress-playground) para informações mais detalhadas sobre este tópico
:::
