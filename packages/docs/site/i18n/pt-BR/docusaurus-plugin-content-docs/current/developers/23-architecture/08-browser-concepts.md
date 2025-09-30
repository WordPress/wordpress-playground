---
slug: /developers/architecture/browser-concepts
---

# Executando aplicativos PHP no navegador com ServiceWorkers e Worker Threads

Em um nível alto, o WordPress Playground funciona em navegadores web da seguinte forma:

-   O arquivo `index.html` em playground.wordpress.net carrega o arquivo `remote.html` via um `<iframe src="/remote.html">`.
-   O `remote.html` inicia um Worker Thread e um ServiceWorker e envia de volta as informações de progresso do download.
-   O Worker Thread inicia o PHP e popula o sistema de arquivos com um WordPress modificado para executar no SQLite.
-   O ServiceWorker começa a interceptar todas as requisições HTTP e encaminhá-las para o Worker Thread.
-   O `remote.html` cria um `<iframe src="/index.php">`, e o Service Worker encaminha a requisição `index.php` para o Worker Thread onde a página inicial do WordPress é renderizada.

Visualmente, isso se parece com isto:

![Visão geral da arquitetura](@site/static/img/architecture-overview.png)

## Ideias de alto nível

O [`@php-wasm/web`](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/web/) é construído sobre as seguintes ideias:

-   [**A aba do navegador orquestra tudo**](/developers/architecture/browser-tab-orchestrates-execution) – A aba do navegador é o programa principal. Fechá-la ou recarregá-la significa destruir todo o ambiente de execução.
-   [**Renderização baseada em iframe**](/developers/architecture/browser-iframe-rendering) – Toda resposta produzida pelo servidor PHP deve ser renderizada em um iframe para evitar recarregar a aba do navegador quando o usuário clica em um link.
-   [**Worker Thread do PHP**](/developers/architecture/browser-php-worker-threads) – O servidor PHP é lento e deve executar em um web worker, caso contrário, lidar com requisições congela a UI do site.
-   [**Roteamento do Service Worker**](/developers/architecture/browser-service-workers) – Todas as requisições HTTP originadas nesse iframe devem ser interceptadas por um Service worker e passadas para o worker thread do PHP para renderização.
