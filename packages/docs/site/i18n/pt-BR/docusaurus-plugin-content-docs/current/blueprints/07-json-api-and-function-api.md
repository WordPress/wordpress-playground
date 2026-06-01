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

<div class="callout callout-info">

**Blueprints versão 2**

<!-- Blueprint v2 declarations are supported by the Playground web app, client package, and CLI. Version 2 keeps the JSON declaration model but moves WordPress setup into higher-level sections such as plugins, themes, content, and media, with escape hatches in additionalStepsAfterExecution. -->

Declarações Blueprint v2 são compatíveis com o aplicativo web do Playground, o
pacote client e a CLI. A versão 2 mantém o modelo de declaração JSON, mas move a
configuração do WordPress para seções de nível mais alto, como `plugins`,
`themes`, `content` e `media`, com pontos de extensão em
`additionalStepsAfterExecution`.

<!-- The public Blueprint JSON schema validates both v1 and v2 declarations. To opt into v2, set "version": 2. -->

O [Blueprint JSON schema](https://playground.wordpress.net/blueprint-schema.json)
público valida declarações v1 e v2. Para usar v2, defina `"version": 2`.

</div>

## Diferenças entre APIs JSON e de Função

<!-- There are two main differences between the JSON and Function APIs: -->

Existem duas principais diferenças entre as APIs JSON e de Função:

<!-- 1. Blueprints handle the progress bar and error reporting for you. The function API requires you to handle these yourself. -->

1. Blueprints lidam com a barra de progresso e relatório de erros para você. A API de função requer que você lide com essas coisas por conta própria.

<!-- 2. The function API requires importing the API client library while Blueprints may be just pasted into the URL fragment. -->

2. A API de função requer importação da biblioteca de cliente da API, enquanto Blueprints pode ser apenas colado no fragmento de URL.

<div class="callout callout-info">

<!-- Check the Use the same structure for Blueprint JSON definitions and step handlers issue at wordpress-playground repo for more detailed info about this topic -->

Verifique o issue [Use a mesma estrutura para definições JSON de Blueprint e manipuladores de etapas](https://github.com/WordPress/wordpress-playground/pull/215) no repositório [wordpress-playground](https://github.com/WordPress/wordpress-playground) para obter informações mais detalhadas sobre este tópico

</div>
