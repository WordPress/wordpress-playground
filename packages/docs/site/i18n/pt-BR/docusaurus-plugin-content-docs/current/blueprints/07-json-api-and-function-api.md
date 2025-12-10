---
title: Consistência da API
slug: /blueprints/steps/api-consistency
description: Aprenda sobre a relação entre o formato JSON de Blueprint e a API de função JavaScript subjacente usada para executar etapas.
---

# API JSON e API de Função

Blueprints são definidos em formato JSON, mas a implementação subjacente usa funções JavaScript para executar as etapas. Embora JSON seja a maneira mais conveniente de interagir com Blueprints, você também pode usar as funções subjacentes diretamente.

JSON é apenas um invólucro ao redor das funções. Se você usar as etapas JSON ou as funções exportadas, terá que fornecer os mesmos parâmetros (exceto pelo nome da etapa):

Você pode usar Blueprints tanto com as versões web quanto com as versões node.js do WordPress Playground.

:::info Versão 2 do Blueprints

O time está explorando maneiras de fazer a transição do Blueprints de uma biblioteca TypeScript para uma biblioteca PHP. Isso permitiria que as pessoas executassem Blueprints em qualquer ambiente WordPress: Playground, um site hospedado ou uma configuração local.

A [nova especificação](https://github.com/WordPress/blueprints-library/issues/6) proposta é discutida em um [repositório GitHub](https://github.com/WordPress/blueprints-library/) separado, e você é bem-vindo para participar (lá ou no canal Slack [#playground](https://wordpress.slack.com/archives/C04EWKGDJ0K)) e ajudar a moldar a próxima geração do Playground.
:::

## Diferenças entre APIs JSON e de Função

Existem duas principais diferenças entre as APIs JSON e de Função:

1. Blueprints lidam com a barra de progresso e relatório de erros para você. A API de função requer que você lide com essas coisas por conta própria.
2. A API de função requer importação da biblioteca de cliente da API, enquanto Blueprints pode ser apenas colado no fragmento de URL.

:::note
Verifique o issue [Use a mesma estrutura para definições JSON de Blueprint e manipuladores de etapas](https://github.com/WordPress/wordpress-playground/pull/215) no repositório [wordpress-playground](https://github.com/WordPress/wordpress-playground) para obter informações mais detalhadas sobre este tópico
:::
