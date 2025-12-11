---
title: Consistência da API
slug: /blueprints/steps/api-consistency
description: Aprenda sobre a relação entre o formato JSON de Blueprint e a API de função JavaScript subjacente usada para executar etapas.
---

# API JSON e API de Função

<!-- Blueprints are defined in JSON format, but the underlying implementation uses JavaScript functions to execute the steps. While JSON is the most convenient way of interacting with Blueprints, you can also use the underlying functions directly. -->

Blueprints são definidos em formato JSON, mas a implementação subjacente usa funções JavaScript para executar as etapas. Embora JSON seja a maneira mais conveniente de interagir com Blueprints, você também pode usar as funções subjacentes diretamente.

<!-- JSON is merely a wrapper around the functions. Whether you use the JSON steps or the exported functions, you'll have to provide the same parameters (except for the step name): -->

JSON é apenas um invólucro ao redor das funções. Se você usar as etapas JSON ou as funções exportadas, terá que fornecer os mesmos parâmetros (exceto pelo nome da etapa):

<!-- You can use Blueprints both with the web and the node.js versions of WordPress Playground. -->

Você pode usar Blueprints tanto com as versões web quanto com as versões node.js do WordPress Playground.

:::info Versão 2 do Blueprints

<!-- The team is exploring ways to transition Blueprints from a TypeScript library to a PHP library. This would allow people to run Blueprints in any WordPress environments: Playground, a hosted site, or a local setup. -->

O time está explorando maneiras de fazer a transição do Blueprints de uma biblioteca TypeScript para uma biblioteca PHP. Isso permitiria que as pessoas executassem Blueprints em qualquer ambiente WordPress: Playground, um site hospedado ou uma configuração local.

<!-- The proposed new specification is discussed on a separate GitHub repository, and you’re more than welcome to join (there or on the #playground Slack channel) and help shape the next generation of Playground. -->

A [nova especificação](https://github.com/WordPress/blueprints-library/issues/6) proposta é discutida em um [repositório GitHub](https://github.com/WordPress/blueprints-library/) separado, e você é bem-vindo para participar (lá ou no canal Slack [#playground](https://wordpress.slack.com/archives/C04EWKGDJ0K)) e ajudar a moldar a próxima geração do Playground.
:::

## Diferenças entre APIs JSON e de Função

<!-- There are two main differences between the JSON and Function APIs: -->

Existem duas principais diferenças entre as APIs JSON e de Função:

<!-- 1. Blueprints handle the progress bar and error reporting for you. The function API requires you to handle these yourself. -->

1. Blueprints lidam com a barra de progresso e relatório de erros para você. A API de função requer que você lide com essas coisas por conta própria.

<!-- 2. The function API requires importing the API client library while Blueprints may be just pasted into the URL fragment. -->

2. A API de função requer importação da biblioteca de cliente da API, enquanto Blueprints pode ser apenas colado no fragmento de URL.

:::note

<!-- Check the Use the same structure for Blueprint JSON definitions and step handlers issue at wordpress-playground repo for more detailed info about this topic -->

Verifique o issue [Use a mesma estrutura para definições JSON de Blueprint e manipuladores de etapas](https://github.com/WordPress/wordpress-playground/pull/215) no repositório [wordpress-playground](https://github.com/WordPress/wordpress-playground) para obter informações mais detalhadas sobre este tópico
:::
