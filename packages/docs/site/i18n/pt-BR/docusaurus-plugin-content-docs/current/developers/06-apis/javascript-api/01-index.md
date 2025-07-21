---
slug: /developers/apis/javascript-api
---

<!-- # JavaScript API -->

# API JavaScript

<!-- WordPress Playground comes with a JavaScript API client that grants you full control over your WordPress. -->

O WordPress Playground vem com um cliente de API JavaScript que oferece controle total sobre o seu WordPress.

<!-- WordPress Playground is a browser-based application.
The term API here refers to a set of functions you can
call inside JavaScript. This is **not** a network-based REST API. -->

:::info API aqui não significa "REST API"

O WordPress Playground é uma aplicação baseada em navegador.
O termo API aqui se refere a um conjunto de funções que você pode
chamar dentro do JavaScript. Isso **não** é uma API REST baseada em rede.

:::

<!-- ## Quick start -->

## Início rápido

<!-- To use the JavaScript API, you'll need: -->

Para usar a API JavaScript, você vai precisar de:

-   Um elemento `<iframe>`
-   O pacote `@wp-playground/client` (do npm ou de um CDN)

<!-- Here's the shortest example of how to use the JavaScript API in a HTML page: -->

Aqui está o exemplo mais curto de como usar a API JavaScript em uma página HTML:

import JSApiShortExample from '@site/docs/\_fragments/\_js_api_short_example.mdx';

<JSApiShortExample />

:::info /remote.html é uma URL especial

<!-- `/remote.html` is a special URL that loads the Playground
API endpoint instead of the demo app with the browser UI. Read more about the difference between `/` and `/remote.html` and [on this page](/developers/apis/javascript-api/-html-vs-remote-html). -->

`/remote.html` é uma URL especial que carrega o endpoint da API do Playground em vez do aplicativo de demonstração com a interface do navegador. Leia mais sobre a diferença entre `/` e `/remote.html` [nesta página](/developers/apis/javascript-api/-html-vs-remote-html).

:::

<!-- ## Controlling the website -->

## Controlando o site

<!-- Now that you have a `client` object, you can use it to control the website inside the iframe. There are three ways to do that: -->

Agora que você tem um objeto `client`, pode usá-lo para controlar o site dentro do iframe. Existem três maneiras de fazer isso:

-   [Cliente da API do Playground](/developers/apis/javascript-api/playground-api-client)
-   [Blueprint JSON](/developers/apis/javascript-api/blueprint-json-in-api-client)
-   [Funções Blueprint](/developers/apis/javascript-api/blueprint-functions-in-api-client)

<!-- ## Debugging and testing -->

## Depuração e testes

<!-- For quick testing and debugging, the JavaScript API client is exposed as `window.playground` by both `index.html` and `remote.html`. -->

Para testes e depuração rápidos, o cliente da API JavaScript é exposto como `window.playground` tanto em `index.html` quanto em `remote.html`.

```javascript
> await playground.listFiles("/")
(6) ['tmp', 'home', 'dev', 'proc', 'internal', 'wordpress']
```

<!-- Note that in `index.html`, `playground` is a Proxy object and you won't get any autocompletion from the browser. In `remote.html`,
however, `playground` is a class instance and you will benefit from browser's autocompletion. -->

Note que em `index.html`, `playground` é um objeto Proxy e você não terá autocompletar do navegador. Já em `remote.html`, porém, `playground` é uma instância de classe e você se beneficiará do autocompletar do navegador.
