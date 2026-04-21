---
title: Asyncify e JSPI – Troca de pilha no PHP WebAssembly
description: Como o WordPress Playground usa Asyncify e JSPI para permitir que código PHP síncrono interaja com JavaScript assíncrono, incluindo a solução de falhas e otimizações no tamanho do binário.
slug: /developers/architecture/wasm-asyncify
---

# Asyncify e JSPI: troca de pilha no PHP WebAssembly

<!--
# Asyncify
-->

O [Asyncify](https://emscripten.org/docs/porting/asyncify.html) permite que código C ou C++ síncrono interaja com JavaScript assíncrono. Tecnicamente, ele salva toda a pilha de chamadas C antes de devolver o controle ao JavaScript e, em seguida, a restaura quando a chamada assíncrona termina. Isso é chamado de **troca de pilha**.

<!--
[Asyncify](https://emscripten.org/docs/porting/asyncify.html) lets synchronous C or C++ code interact with asynchronous JavaScript. Technically, it saves the entire C call stack before yielding control back to JavaScript, and then restores it when the asynchronous call is finished. This is called **stack switching**.
-->

O suporte a rede na build WebAssembly do PHP é implementado com Asyncify. Quando o PHP faz uma requisição de rede, ele devolve o controle ao JavaScript, que executa a requisição e retoma o PHP quando a resposta está pronta. Funciona bem o suficiente para que a build PHP possa chamar APIs web, instalar pacotes do Composer e até conectar a um servidor MySQL.

<!--
Networking support in the WebAssembly PHP build is implemented using Asyncify. When PHP makes a network request, it yields control back to JavaScript, which makes the request, and then resumes PHP when the response is ready. It works well enough that PHP build can request web APIs, install composer packages, and even connect to a MySQL server.
-->

## Falhas do Asyncify

<!--
## Asyncify crashes
-->

A troca de pilha exige envolver todas as funções C que possam estar na pilha de chamadas no momento de uma chamada assíncrona. Envolver indiscriminadamente cada função C adiciona uma sobrecarga **significativa**, por isso mantemos uma lista de nomes de funções específicas:

<!--
Stack switching requires wrapping all C functions that may be found at a call stack at a time of making an asynchronous call. Blanket-wrapping of every single C function adds a **significant** overhead, which is why we maintain a list of specific function names:
-->

https://github.com/WordPress/wordpress-playground/blob/15a660940ee9b4a332965ba2a987f6fda0c159b1/packages/php-wasm/compile/Dockerfile#L624-L632

Infelizmente, omitir um único item dessa lista resulta em falha do WebAssembly sempre que essa função faz parte da pilha de chamadas quando uma chamada assíncrona é feita. O erro se parece com isto:

<!--
Unfortunately, missing even a single item from that list results in a WebAssembly crash whenever that function is a part of the call stack when an asynchronous call is made. It looks like this:
-->

![Uma captura de tela de um erro de asyncify no terminal](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/developers/asyncify-error.webp)

<!--
![A screenshot of an asyncify error in the terminal](@site/static/img/developers/asyncify-error.webp)
-->

O Asyncify pode listar automaticamente todas as funções C necessárias quando compilado sem `ASYNCIFY_ONLY`, mas essa detecção automática é excessiva e acaba listando cerca de 70.000 funções C, o que aumenta o tempo de inicialização para 4,5 s. Por isso mantemos a lista manualmente.

<!--
Asyncify can auto-list all the required C functions when built without `ASYNCIFY_ONLY`, but that auto-detection is overeager and ends up listing about 70,000 C functions which increases the startup time to 4.5s. That's why we maintain the list manually.
-->

Se quiser mais detalhes, veja a [issue 251 no GitHub](https://github.com/WordPress/wordpress-playground/issues/251).

<!--
If you are interested in more details, [see GitHub issue 251](https://github.com/WordPress/wordpress-playground/issues/251).
-->

## Corrigindo falhas do Asyncify

<!--
## Fixing Asyncify crashes
-->

O [Pull Request 253](https://github.com/WordPress/wordpress-playground/pull/253) adiciona um comando `fix-asyncify` que executa uma suíte de testes especializada e adiciona automaticamente à lista `ASYNCIFY_ONLY` quaisquer funções C em falta identificadas.

<!--
[Pull Request 253](https://github.com/WordPress/wordpress-playground/pull/253) adds a `fix-asyncify` command that runs a specialized test suite and automatically adds any identified missing C functions to the `ASYNCIFY_ONLY` list.
-->

Se você encontrar uma falha como a acima, pode corrigi-la assim:

<!--
If you run into a crash like the one above, you can fix it by:
-->

1. Identificar um caminho de código PHP que dispara a falha — o rastreamento de pilha no terminal deve ajudar.
2. Adicionar um caso de teste que dispara a falha em `packages/php-wasm/node/src/test/php-asyncify.spec.ts`
3. Executar: `npm run fix-asyncify`
4. Fazer commit do caso de teste, do Dockerfile atualizado e do PHP.wasm reconstruído

<!--
1. Identifying a PHP code path that triggers the crash – the stack trace in the terminal should help with that.
2. Adding a test case that triggers a crash to `packages/php-wasm/node/src/test/php-asyncify.spec.ts`
3. Running: `npm run fix-asyncify`
4. Committing the test case, the updated Dockerfile, and the rebuilt PHP.wasm
-->

## JSPI: a alternativa moderna ao Asyncify

<!--
## JSPI: The Modern Alternative to Asyncify
-->

A API [JavaScript Promise Integration (JSPI)](https://v8.dev/blog/jspi) trata a troca de pilha nativamente no V8, eliminando a necessidade do envolvimento de funções do Asyncify. O WordPress Playground agora distribui builds JSPI junto com builds Asyncify para todas as versões do PHP (7.4–8.5).

<!--
The [JavaScript Promise Integration (JSPI)](https://v8.dev/blog/jspi) API handles stack switching natively in V8, eliminating the need for Asyncify's function wrapping. WordPress Playground now ships JSPI builds alongside Asyncify builds for all PHP versions (7.4–8.5).
-->

**Estado atual:**

<!--
**Current status:**
-->

- O Playground CLI **detecta suporte a JSPI automaticamente** e o ativa — sem flags manuais
- Node.js 23+ oferece JSPI nativamente; Node.js 22 exige a flag `--experimental-wasm-jspi` (tratada automaticamente pelo CLI)
- Espera-se que Node.js 24+ tenha JSPI sem flag
- O suporte nos navegadores varia: o JSPI está disponível no Chrome e em navegadores baseados em Chromium atrás de flags

<!--
- The Playground CLI **auto-detects JSPI support** and enables it automatically — no manual flags needed
- Node.js 23+ supports JSPI natively; Node.js 22 requires the `--experimental-wasm-jspi` flag (handled automatically by the CLI)
- Node.js 24+ is expected to have JSPI unflagged
- Browser support varies: JSPI is available in Chrome/Chromium-based browsers behind flags
-->

## Otimização do tamanho do binário com MAIN_MODULE=2

<!--
## Binary Size Optimization with MAIN_MODULE=2
-->

As builds Asyncify e JSPI são compiladas com a flag `MAIN_MODULE=2` do Emscripten, que elimina código morto nos símbolos exportados. Apenas os símbolos de que as extensões dinâmicas realmente precisam são exportados.

<!--
Both Asyncify and JSPI builds are compiled with Emscripten's `MAIN_MODULE=2` flag, which performs dead code elimination on exported symbols. Only symbols that dynamic extensions actually need are exported.
-->

**Impacto:**

<!--
**Impact:**
-->

- Tamanho total dos binários reduzido em **122 MB** (13,7%)
- Arquivos `.wasm` reduzidos em **109 MB** (16%)
- Código cola JavaScript reduzido em **14,5 MB** (63%)

<!--
- Total binary size reduced by **122 MB** (13.7%)
- `.wasm` files reduced by **109 MB** (16%)
- JavaScript glue code reduced by **14.5 MB** (63%)
-->

Essa otimização vale para todas as versões do PHP (7.4–8.5) nos alvos Node.js e Web. A lista de símbolos exportados é gerenciada centralmente no Dockerfile, com exportações condicionais para extensões específicas (por exemplo, `__c_longjmp` para Xdebug, `_wasm_recv` para Memcached).

<!--
This optimization applies across all PHP versions (7.4–8.5) for both Node.js and Web targets. The exported symbol list is centrally managed in the Dockerfile, with conditional exports for specific extensions (e.g., `__c_longjmp` for Xdebug, `_wasm_recv` for Memcached).
-->
