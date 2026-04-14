---
title: Asyncify y JSPI – Cambio de pila en PHP WebAssembly
description: Cómo WordPress Playground usa Asyncify y JSPI para que el código PHP síncrono interactúe con JavaScript asíncrono, incluyendo la resolución de fallos y optimizaciones del tamaño del binario.
slug: /developers/architecture/wasm-asyncify
---

# Asyncify y JSPI: cambio de pila en PHP WebAssembly

<!--
# Asyncify
-->

[Asyncify](https://emscripten.org/docs/porting/asyncify.html) permite que el código C o C++ síncrono interactúe con JavaScript asíncrono. Técnicamente, guarda toda la pila de llamadas de C antes de ceder el control a JavaScript y luego la restaura cuando termina la llamada asíncrona. Esto se denomina **cambio de pila**.

<!--
[Asyncify](https://emscripten.org/docs/porting/asyncify.html) lets synchronous C or C++ code interact with asynchronous JavaScript. Technically, it saves the entire C call stack before yielding control back to JavaScript, and then restores it when the asynchronous call is finished. This is called **stack switching**.
-->

La compatibilidad de red en la compilación WebAssembly de PHP se implementa con Asyncify. Cuando PHP realiza una solicitud de red, cede el control a JavaScript, que ejecuta la solicitud y reanuda PHP cuando la respuesta está lista. Funciona lo bastante bien como para que la compilación de PHP pueda solicitar APIs web, instalar paquetes de Composer e incluso conectarse a un servidor MySQL.

<!--
Networking support in the WebAssembly PHP build is implemented using Asyncify. When PHP makes a network request, it yields control back to JavaScript, which makes the request, and then resumes PHP when the response is ready. It works well enough that PHP build can request web APIs, install composer packages, and even connect to a MySQL server.
-->

## Fallos de Asyncify

<!--
## Asyncify crashes
-->

El cambio de pila exige envolver todas las funciones C que puedan encontrarse en la pila de llamadas en el momento de una llamada asíncrona. Envolver por completo cada función C añade una sobrecarga **considerable**, por eso mantenemos una lista de nombres de funciones concretas:

<!--
Stack switching requires wrapping all C functions that may be found at a call stack at a time of making an asynchronous call. Blanket-wrapping of every single C function adds a **significant** overhead, which is why we maintain a list of specific function names:
-->

https://github.com/WordPress/wordpress-playground/blob/15a660940ee9b4a332965ba2a987f6fda0c159b1/packages/php-wasm/compile/Dockerfile#L624-L632

Por desgracia, omitir un solo elemento de esa lista provoca un fallo de WebAssembly siempre que esa función forme parte de la pila de llamadas cuando se hace una llamada asíncrona. Se ve así:

<!--
Unfortunately, missing even a single item from that list results in a WebAssembly crash whenever that function is a part of the call stack when an asynchronous call is made. It looks like this:
-->

![Captura de pantalla de un error de asyncify en la terminal](@site/static/img/developers/asyncify-error.webp)

<!--
![A screenshot of an asyncify error in the terminal](@site/static/img/developers/asyncify-error.webp)
-->

Asyncify puede listar automáticamente todas las funciones C necesarias cuando se compila sin `ASYNCIFY_ONLY`, pero esa detección automática es demasiado agresiva y acaba listando unas 70.000 funciones C, lo que aumenta el tiempo de arranque a 4,5 s. Por eso mantenemos la lista a mano.

<!--
Asyncify can auto-list all the required C functions when built without `ASYNCIFY_ONLY`, but that auto-detection is overeager and ends up listing about 70,000 C functions which increases the startup time to 4.5s. That's why we maintain the list manually.
-->

Si quieres más detalles, consulta la [issue 251 en GitHub](https://github.com/WordPress/wordpress-playground/issues/251).

<!--
If you are interested in more details, [see GitHub issue 251](https://github.com/WordPress/wordpress-playground/issues/251).
-->

## Corregir fallos de Asyncify

<!--
## Fixing Asyncify crashes
-->

El [pull request 253](https://github.com/WordPress/wordpress-playground/pull/253) añade un comando `fix-asyncify` que ejecuta una batería de pruebas especializada y añade automáticamente a la lista `ASYNCIFY_ONLY` las funciones C faltantes identificadas.

<!--
[Pull Request 253](https://github.com/WordPress/wordpress-playground/pull/253) adds a `fix-asyncify` command that runs a specialized test suite and automatically adds any identified missing C functions to the `ASYNCIFY_ONLY` list.
-->

Si te encuentras con un fallo como el anterior, puedes solucionarlo así:

<!--
If you run into a crash like the one above, you can fix it by:
-->

1. Identificar una ruta de código PHP que provoque el fallo: el rastreo de pila en la terminal debería ayudar.
2. Añadir un caso de prueba que reproduzca el fallo en `packages/php-wasm/node/src/test/php-asyncify.spec.ts`
3. Ejecutar: `npm run fix-asyncify`
4. Hacer commit del caso de prueba, del Dockerfile actualizado y del PHP.wasm reconstruido

<!--
1. Identifying a PHP code path that triggers the crash – the stack trace in the terminal should help with that.
2. Adding a test case that triggers a crash to `packages/php-wasm/node/src/test/php-asyncify.spec.ts`
3. Running: `npm run fix-asyncify`
4. Committing the test case, the updated Dockerfile, and the rebuilt PHP.wasm
-->

## JSPI: la alternativa moderna a Asyncify

<!--
## JSPI: The Modern Alternative to Asyncify
-->

La API [JavaScript Promise Integration (JSPI)](https://v8.dev/blog/jspi) gestiona el cambio de pila de forma nativa en V8, eliminando la necesidad de envolver funciones como en Asyncify. WordPress Playground ahora incluye compilaciones JSPI junto con las de Asyncify para todas las versiones de PHP (7.4–8.5).

<!--
The [JavaScript Promise Integration (JSPI)](https://v8.dev/blog/jspi) API handles stack switching natively in V8, eliminating the need for Asyncify's function wrapping. WordPress Playground now ships JSPI builds alongside Asyncify builds for all PHP versions (7.4–8.5).
-->

**Estado actual:**

<!--
**Current status:**
-->

- El CLI de Playground **detecta automáticamente el soporte JSPI** y lo activa: no hace falta usar flags manualmente
- Node.js 23+ admite JSPI de forma nativa; Node.js 22 requiere el flag `--experimental-wasm-jspi` (el CLI lo gestiona automáticamente)
- Se espera que Node.js 24+ tenga JSPI sin flag
- El soporte en navegadores varía: JSPI está disponible en Chrome y navegadores basados en Chromium detrás de flags

<!--
- The Playground CLI **auto-detects JSPI support** and enables it automatically — no manual flags needed
- Node.js 23+ supports JSPI natively; Node.js 22 requires the `--experimental-wasm-jspi` flag (handled automatically by the CLI)
- Node.js 24+ is expected to have JSPI unflagged
- Browser support varies: JSPI is available in Chrome/Chromium-based browsers behind flags
-->

## Optimización del tamaño del binario con MAIN_MODULE=2

<!--
## Binary Size Optimization with MAIN_MODULE=2
-->

Las compilaciones Asyncify y JSPI se construyen con el flag `MAIN_MODULE=2` de Emscripten, que elimina código muerto en los símbolos exportados. Solo se exportan los símbolos que las extensiones dinámicas necesitan de verdad.

<!--
Both Asyncify and JSPI builds are compiled with Emscripten's `MAIN_MODULE=2` flag, which performs dead code elimination on exported symbols. Only symbols that dynamic extensions actually need are exported.
-->

**Impacto:**

<!--
**Impact:**
-->

- Tamaño total de binarios reducido en **122 MB** (13,7 %)
- Archivos `.wasm` reducidos en **109 MB** (16 %)
- Código glue en JavaScript reducido en **14,5 MB** (63 %)

<!--
- Total binary size reduced by **122 MB** (13.7%)
- `.wasm` files reduced by **109 MB** (16%)
- JavaScript glue code reduced by **14.5 MB** (63%)
-->

Esta optimización aplica a todas las versiones de PHP (7.4–8.5) tanto para Node.js como para Web. La lista de símbolos exportados se gestiona de forma centralizada en el Dockerfile, con exportaciones condicionales para extensiones concretas (p. ej., `__c_longjmp` para Xdebug, `_wasm_recv` para Memcached).

<!--
This optimization applies across all PHP versions (7.4–8.5) for both Node.js and Web targets. The exported symbol list is centrally managed in the Dockerfile, with conditional exports for specific extensions (e.g., `__c_longjmp` for Xdebug, `_wasm_recv` for Memcached).
-->
