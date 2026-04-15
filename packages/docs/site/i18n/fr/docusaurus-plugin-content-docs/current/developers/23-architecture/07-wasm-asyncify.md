---
title: Asyncify et JSPI – Changement de pile dans PHP WebAssembly
description: Comment WordPress Playground utilise Asyncify et JSPI pour permettre au code PHP synchrone d'interagir avec du JavaScript asynchrone, y compris le dépannage des plantages et les optimisations de taille des binaires.
slug: /developers/architecture/wasm-asyncify
---

# Asyncify et JSPI : changement de pile dans PHP WebAssembly

<!--
# Asyncify
-->

[Asyncify](https://emscripten.org/docs/porting/asyncify.html) permet au code C ou C++ synchrone d’interagir avec du JavaScript asynchrone. Techniquement, il enregistre toute la pile d’appels C avant de rendre la main au JavaScript, puis la restaure lorsque l’appel asynchrone est terminé. On parle de **changement de pile**.

<!--
[Asyncify](https://emscripten.org/docs/porting/asyncify.html) lets synchronous C or C++ code interact with asynchronous JavaScript. Technically, it saves the entire C call stack before yielding control back to JavaScript, and then restores it when the asynchronous call is finished. This is called **stack switching**.
-->

La prise en charge du réseau dans la compilation WebAssembly de PHP est implémentée avec Asyncify. Lorsque PHP effectue une requête réseau, il rend la main au JavaScript, qui exécute la requête, puis reprend PHP lorsque la réponse est prête. Cela fonctionne suffisamment bien pour que la compilation PHP puisse appeler des API web, installer des dépendances Composer et même se connecter à un serveur MySQL.

<!--
Networking support in the WebAssembly PHP build is implemented using Asyncify. When PHP makes a network request, it yields control back to JavaScript, which makes the request, and then resumes PHP when the response is ready. It works well enough that PHP build can request web APIs, install composer packages, and even connect to a MySQL server.
-->

## Plantages Asyncify

<!--
## Asyncify crashes
-->

Le changement de pile impose d’envelopper toutes les fonctions C susceptibles de figurer sur la pile d’appels au moment d’un appel asynchrone. Envelopper systématiquement chaque fonction C ajoute une surcharge **importante**, d’où le maintien d’une liste de noms de fonctions précis :

<!--
Stack switching requires wrapping all C functions that may be found at a call stack at a time of making an asynchronous call. Blanket-wrapping of every single C function adds a **significant** overhead, which is why we maintain a list of specific function names:
-->

https://github.com/WordPress/wordpress-playground/blob/15a660940ee9b4a332965ba2a987f6fda0c159b1/packages/php-wasm/compile/Dockerfile#L624-L632

Malheureusement, l’absence d’un seul élément de cette liste provoque un plantage WebAssembly dès que cette fonction fait partie de la pile lors d’un appel asynchrone. Voici à quoi cela ressemble :

<!--
Unfortunately, missing even a single item from that list results in a WebAssembly crash whenever that function is a part of the call stack when an asynchronous call is made. It looks like this:
-->

![Capture d’écran d’une erreur Asyncify dans le terminal](@site/static/img/developers/asyncify-error.webp)

<!--
![A screenshot of an asyncify error in the terminal](@site/static/img/developers/asyncify-error.webp)
-->

Asyncify peut lister automatiquement toutes les fonctions C requises lorsqu’il est compilé sans `ASYNCIFY_ONLY`, mais cette détection automatique est trop agressive et finit par lister environ 70 000 fonctions C, ce qui porte le temps de démarrage à 4,5 secondes. C’est pourquoi nous maintenons la liste à la main.

<!--
Asyncify can auto-list all the required C functions when built without `ASYNCIFY_ONLY`, but that auto-detection is overeager and ends up listing about 70,000 C functions which increases the startup time to 4.5s. That's why we maintain the list manually.
-->

Pour en savoir plus, consultez [l’issue GitHub 251](https://github.com/WordPress/wordpress-playground/issues/251).

<!--
If you are interested in more details, [see GitHub issue 251](https://github.com/WordPress/wordpress-playground/issues/251).
-->

## Corriger les plantages Asyncify

<!--
## Fixing Asyncify crashes
-->

La [pull request 253](https://github.com/WordPress/wordpress-playground/pull/253) ajoute une commande `fix-asyncify` qui exécute une suite de tests dédiée et ajoute automatiquement à la liste `ASYNCIFY_ONLY` les fonctions C manquantes identifiées.

<!--
[Pull Request 253](https://github.com/WordPress/wordpress-playground/pull/253) adds a `fix-asyncify` command that runs a specialized test suite and automatically adds any identified missing C functions to the `ASYNCIFY_ONLY` list.
-->

En cas de plantage comme ci-dessus, vous pouvez le corriger ainsi :

<!--
If you run into a crash like the one above, you can fix it by:
-->

1. Identifier un chemin de code PHP qui déclenche le plantage — la trace de pile dans le terminal devrait aider.
2. Ajouter un cas de test qui reproduit le plantage dans `packages/php-wasm/node/src/test/php-asyncify.spec.ts`
3. Exécuter : `npm run fix-asyncify`
4. Commiter le cas de test, le fichier `Dockerfile` mis à jour et le fichier `PHP.wasm` reconstruit

<!--
1. Identifying a PHP code path that triggers the crash – the stack trace in the terminal should help with that.
2. Adding a test case that triggers a crash to `packages/php-wasm/node/src/test/php-asyncify.spec.ts`
3. Running: `npm run fix-asyncify`
4. Committing the test case, the updated Dockerfile, and the rebuilt PHP.wasm
-->

## JSPI : l’alternative moderne à Asyncify

<!--
## JSPI: The Modern Alternative to Asyncify
-->

L’API [JavaScript Promise Integration (JSPI)](https://v8.dev/blog/jspi) gère le changement de pile nativement dans V8, ce qui supprime le besoin d’envelopper les fonctions comme avec Asyncify. WordPress Playground propose désormais des builds JSPI en plus des builds Asyncify pour toutes les versions de PHP (7.4–8.5).

<!--
The [JavaScript Promise Integration (JSPI)](https://v8.dev/blog/jspi) API handles stack switching natively in V8, eliminating the need for Asyncify's function wrapping. WordPress Playground now ships JSPI builds alongside Asyncify builds for all PHP versions (7.4–8.5).
-->

**État actuel :**

<!--
**Current status:**
-->

- Le CLI Playground **détecte automatiquement le support JSPI** et l’active — aucun drapeau manuel n’est nécessaire
- Node.js 23+ prend en charge JSPI nativement ; Node.js 22 exige le drapeau `--experimental-wasm-jspi` (géré automatiquement par le CLI)
- Node.js 24+ devrait proposer JSPI sans drapeau
- Le support navigateur varie : JSPI est disponible dans Chrome et les navigateurs basés sur Chromium derrière des drapeaux

<!--
- The Playground CLI **auto-detects JSPI support** and enables it automatically — no manual flags needed
- Node.js 23+ supports JSPI natively; Node.js 22 requires the `--experimental-wasm-jspi` flag (handled automatically by the CLI)
- Node.js 24+ is expected to have JSPI unflagged
- Browser support varies: JSPI is available in Chrome/Chromium-based browsers behind flags
-->

## Optimisation de la taille des binaires avec MAIN_MODULE=2

<!--
## Binary Size Optimization with MAIN_MODULE=2
-->

Les builds Asyncify et JSPI sont compilées avec le drapeau `MAIN_MODULE=2` d’Emscripten, qui applique une élimination de code mort sur les symboles exportés. Seuls les symboles dont les extensions dynamiques ont réellement besoin sont exportés.

<!--
Both Asyncify and JSPI builds are compiled with Emscripten's `MAIN_MODULE=2` flag, which performs dead code elimination on exported symbols. Only symbols that dynamic extensions actually need are exported.
-->

**Impact :**

<!--
**Impact:**
-->

- Taille totale des binaires réduite de **122 Mo** (13,7 %)
- Fichiers `.wasm` réduits de **109 Mo** (16 %)
- Code glue JavaScript réduit de **14,5 Mo** (63 %)

<!--
- Total binary size reduced by **122 MB** (13.7%)
- `.wasm` files reduced by **109 MB** (16%)
- JavaScript glue code reduced by **14.5 MB** (63%)
-->

Cette optimisation s’applique à toutes les versions de PHP (7.4–8.5) pour les cibles Node.js et Web. La liste des symboles exportés est centralisée dans le fichier `Dockerfile`, avec des exports conditionnels pour certaines extensions (par ex. `__c_longjmp` pour Xdebug, `_wasm_recv` pour Memcached).

<!--
This optimization applies across all PHP versions (7.4–8.5) for both Node.js and Web targets. The exported symbol list is centrally managed in the Dockerfile, with conditional exports for specific extensions (e.g., `__c_longjmp` for Xdebug, `_wasm_recv` for Memcached).
-->
