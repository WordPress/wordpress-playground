---
slug: /developers/architecture/browser-iframe-rendering
title: Renderização baseada em iframe
description: Por que o WordPress Playground renderiza as respostas do PHP em um iframe para não recarregar a aplicação principal.
---

<!-- # Iframe-based rendering -->

# Renderização baseada em iframe

<!--
To avoid page reloads, all the `PHPRequestHandler` responses must be rendered in an iframe. Remember, the entire setup only lives as long as the main `index.html`. We want to avoid reloading the main app at all costs.
-->

Para evitar recarregamentos da página, todas as respostas do `PHPRequestHandler` precisam ser renderizadas em um iframe. Lembre-se: toda a configuração só existe enquanto o `index.html` principal existir. Queremos evitar recarregar a aplicação principal a qualquer custo.

<!-- In our app example above, `index.php` renders the following HTML: -->

No exemplo de aplicação acima, o `index.php` renderiza o seguinte HTML:

```html
<a href="page.php">Go to page.php</a>
```

<!--
Imagine our `index.html` rendered it in a `<div>` instead of an `<iframe>`. As soon as you click on that link, the browser will try to navigate from `index.html` to `page.php`. However, `index.html` runs the entire PHP app, including the Worker Thread, the PHPRequestHandler, and the traffic control connecting them to the Service Worker. Navigating away from it would destroy the app.
-->

Imagine que o nosso `index.html` renderizasse isso em uma `<div>` em vez de um `<iframe>`. Assim que você clicasse nesse link, o navegador tentaria navegar do `index.html` para o `page.php`. Porém, o `index.html` executa toda a aplicação PHP, incluindo o Worker Thread, o PHPRequestHandler e o controle de tráfego que os conecta ao Service Worker. Sair dessa página destruiria a aplicação.

<!-- Now, consider an iframe with the same link in it: -->

Agora, considere um iframe com o mesmo link dentro dele:

```html
<iframe srcdoc='<a href="page.php">Go to page.php</a>'></iframe>
```

<!--
This time, click the link in the browser to load `page.php` **inside the iframe**. The top-level `index.html`, where the PHP application runs, remains unaffected. That's why iframes are crucial for the `@php-wasm/web` setup.
-->

Desta vez, clicar no link faz o navegador carregar o `page.php` **dentro do iframe**. O `index.html` de nível superior, onde a aplicação PHP é executada, não é afetado. É por isso que os iframes são essenciais para a configuração do `@php-wasm/web`.

<div class="callout callout-info">

<!-- **Crash reports** -->

**Relatórios de falha**

<!--
Playground doesn't collect crash reports automatically. Instead, it prompts users to submit a crash report when an instance fails to run in the browser.
-->

O Playground não coleta relatórios de falha automaticamente. Em vez disso, ele pede que os usuários enviem um relatório quando uma instância não consegue rodar no navegador.

<!-- The report includes a log, description, and a URL, and users can modify it before submitting it. -->

O relatório inclui um log, uma descrição e uma URL, e os usuários podem modificá-lo antes de enviá-lo.

<!--
The [Logger API](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/playground/website/public/logger.php) handles it from there. This simple REST API validates the data and sends it to the **Making WordPress** [#playground-logs Slack channel](https://wordpress.slack.com/archives/C06Q5DCKZ3L).
-->

A partir daí, a [Logger API](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/playground/website/public/logger.php) cuida do resto. Essa API REST simples valida os dados e os envia para o [canal #playground-logs do Slack](https://wordpress.slack.com/archives/C06Q5DCKZ3L) do **Making WordPress**.

</div>

<!-- ## Iframes caveats -->

## Limitações dos iframes {#iframes-caveats}

<!--
- `target="_top"` isn't handled yet, so clicking links with `target="_top"` will reload the page you’re working on.
- JavaScript popups originating in the `iframe` may not always display.
-->

- `target="_top"` ainda não é tratado, então clicar em links com `target="_top"` recarrega a página em que você está trabalhando.
- Pop-ups de JavaScript abertos a partir do `iframe` nem sempre aparecem.
