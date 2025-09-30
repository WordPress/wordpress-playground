---
slug: /developers/architecture/wasm-php-overview
---

<!-- # WebAssembly PHP -->

# WebAssembly PHP

<!-- WordPress Playground build [the PHP interpreter](https://github.com/php/php-src) to WebAssembly using [Emscripten](https://emscripten.org/docs/porting/networking.html) and a [dedicated pipeline](https://github.com/WordPress/wordpress-playground/blob/0d451c33936a8db5b7a158fa8aad288c19370a7d/packages/php-wasm/compile/Dockerfile). -->

O WordPress Playground constrói [o interpretador PHP](https://github.com/php/php-src) para WebAssembly usando [Emscripten](https://emscripten.org/docs/porting/networking.html) e um [pipeline dedicado](https://github.com/WordPress/wordpress-playground/blob/0d451c33936a8db5b7a158fa8aad288c19370a7d/packages/php-wasm/compile/Dockerfile).

![Building C programs to WebAssembly](@site/static/img/c-programs-general.png)

<!-- Building PHP to WebAssembly is very similar to building vanilla PHP. The wasm build required [adjusting a function signature here](https://github.com/WordPress/wordpress-playground/blob/0d451c33936a8db5b7a158fa8aad288c19370a7d/packages/php-wasm/compile/build-assets/php7.1.patch#L8-L9), [forcing a config variable there](https://github.com/WordPress/wordpress-playground/blob/0d451c33936a8db5b7a158fa8aad288c19370a7d/packages/php-wasm/compile/Dockerfile#L495), and applying [a few small patches](https://github.com/WordPress/wordpress-playground/tree/0d451c33936a8db5b7a158fa8aad288c19370a7d/packages/php-wasm/compile/build-assets), but there's relatively few adjustments involved. -->

Construir PHP para WebAssembly é muito similar a construir PHP vanilla. A build wasm exigiu [ajustar uma assinatura de função aqui](https://github.com/WordPress/wordpress-playground/blob/0d451c33936a8db5b7a158fa8aad288c19370a7d/packages/php-wasm/compile/build-assets/php7.1.patch#L8-L9), [forçar uma variável de configuração ali](https://github.com/WordPress/wordpress-playground/blob/0d451c33936a8db5b7a158fa8aad288c19370a7d/packages/php-wasm/compile/Dockerfile#L495), e aplicar [alguns pequenos patches](https://github.com/WordPress/wordpress-playground/tree/0d451c33936a8db5b7a158fa8aad288c19370a7d/packages/php-wasm/compile/build-assets), mas há relativamente poucos ajustes envolvidos.

![Building PHP to WebAssembly](@site/static/img/c-programs-php.png)

<!-- However, vanilla PHP builds aren't very useful in the browser. As a server software, PHP doesn't have a JavaScript API to pass the request body, upload files, or populate the `php://stdin` stream. WordPress Playground had to build one from scratch. The WebAssembly binary comes with a [dedicated PHP API module](https://github.com/WordPress/wordpress-playground/blob/0d451c33936a8db5b7a158fa8aad288c19370a7d/packages/php-wasm/compile/build-assets/php_wasm.c) written in C and a [JavaScript PHP class](https://github.com/WordPress/wordpress-playground/blob/da38192af57a95699d8731c855b82ac0222df61b/packages/php-wasm/common/src/lib/php.ts) that exposes methods like writeFile() or run(). -->

No entanto, builds PHP vanilla não são muito úteis no navegador. Como um software de servidor, o PHP não tem uma API JavaScript para passar o corpo da requisição, fazer upload de arquivos, ou popular o stream `php://stdin`. O WordPress Playground teve que construir uma do zero. O binário WebAssembly vem com um [módulo de API PHP dedicado](https://github.com/WordPress/wordpress-playground/blob/0d451c33936a8db5b7a158fa8aad288c19370a7d/packages/php-wasm/compile/build-assets/php_wasm.c) escrito em C e uma [classe PHP JavaScript](https://github.com/WordPress/wordpress-playground/blob/da38192af57a95699d8731c855b82ac0222df61b/packages/php-wasm/common/src/lib/php.ts) que expõe métodos como writeFile() ou run().

<!-- Because every PHP version is just a static .wasm file, the PHP version switcher is actually pretty boring. It simply tells the browser to download, for example, `php_7_3.wasm` instead of, say, `php_8_2.wasm`. -->

Como cada versão do PHP é apenas um arquivo .wasm estático, o seletor de versão do PHP é na verdade bem simples. Ele simplesmente diz ao navegador para baixar, por exemplo, `php_7_3.wasm` em vez de, digamos, `php_8_2.wasm`.

![Building different versions of PHP to WebAssembly](@site/static/img/c-programs-php-versions.png)

<!-- ### Networking support varies between platforms -->

### O suporte de rede varia entre plataformas

<!-- When it comes to networking, WebAssembly programs are limited to calling JavaScript APIs. It is a safety feature, but also presents a challenge. How do you support low-level, synchronous networking code used by PHP with the high-level asynchronous APIs available in JavaScript? -->

Quando se trata de rede, os programas WebAssembly são limitados a chamar APIs JavaScript. É um recurso de segurança, mas também apresenta um desafio. Como você suporta código de rede síncrono de baixo nível usado pelo PHP com as APIs assíncronas de alto nível disponíveis em JavaScript?

<!-- In Node.js, the answer involves a WebSocket to TCP socket proxy, [Asyncify](https://emscripten.org/docs/porting/asyncify.html), and patching deep PHP internals like php_select. It's complex, but there's a reward. The Node.js-targeted PHP build can request web APIs, install composer packages, and even connect to a MySQL server. -->

No Node.js, a resposta envolve um proxy de WebSocket para socket TCP, [Asyncify](https://emscripten.org/docs/porting/asyncify.html), e patchear internos profundos do PHP como php_select. É complexo, mas há uma recompensa. A build do PHP direcionada ao Node.js pode requisitar APIs web, instalar pacotes do composer, e até mesmo conectar a um servidor MySQL.

<!-- In the browser, networking is supported in two ways: -->

No navegador, a rede é suportada de duas maneiras:

<!-- -   A fast transport for `wp_safe_remote_get` to translate them into `fetch()` calls.
-   A slower transport for all other network calls that [parses the TLS transmission](https://github.com/WordPress/wordpress-playground/pull/1926) initiated by PHP and translates it to a `fetch()` call. -->

-   Um transporte rápido para `wp_safe_remote_get` para traduzi-los em chamadas `fetch()`.
-   Um transporte mais lento para todas as outras chamadas de rede que [analisa a transmissão TLS](https://github.com/WordPress/wordpress-playground/pull/1926) iniciada pelo PHP e a traduz para uma chamada `fetch()`.
