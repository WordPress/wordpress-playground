---
title: Compilare PHP
slug: /developers/architecture/wasm-php-compiling
---

<!--
# Compiling PHP
-->

# Compilare PHP

<!--
The build pipeline lives in a [`Dockerfile`](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/compile/php/Dockerfile). It was originally forked from [seanmorris/php-wasm](https://github.com/seanmorris/php-wasm)
-->

Il processo di compilazione si trova in un [`Dockerfile`](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/compile/php/Dockerfile). In origine è stato derivato da [seanmorris/php-wasm](https://github.com/seanmorris/php-wasm).

<!--
In broad strokes, that `Dockerfile`:
-->

A grandi linee, questo `Dockerfile`:

<!--
- Installs all the necessary linux packages (like `build-essential`)
- Downloads PHP and the required libraries, e.g. `sqlite3`.
- Applies a few patches.
- Compiles everything using [Emscripten](https://emscripten.org/), a drop-in replacement for the C compiler.
- Compiles `php_wasm.c` – a convenient API for JavaScript.
- Outputs a `php.wasm` file and one or more JavaScript loaders, depending on the configuration.
- Transforms the Emscripten's default `php.js` output into an ESM module with additional features.
-->

- Installa tutti i pacchetti Linux necessari (come `build-essential`).
- Scarica PHP e le librerie necessarie, come `sqlite3`.
- Applica alcune patch.
- Compila tutto con [Emscripten](https://emscripten.org/), un sostituto diretto del compilatore C.
- Compila `php_wasm.c`, una comoda API per JavaScript.
- Genera un file `php.wasm` e uno o più loader JavaScript, a seconda della configurazione.
- Trasforma l'output predefinito `php.js` di Emscripten in un modulo ESM con funzionalità aggiuntive.

<!--
To find out more about each step, refer directly to the [Dockerfile](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/compile/php/Dockerfile).
-->

Per saperne di più su ogni passaggio, consulta direttamente il [Dockerfile](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/compile/php/Dockerfile).

<!--
### Building
-->

### Compilazione

<!--
With Docker running and the repository dependencies installed, run these commands from the repository root:
-->

Con Docker in esecuzione e le dipendenze del repository installate, esegui questi comandi dalla directory principale del repository:

<!--
```sh
# Build all supported PHP versions for the web, in both JSPI and Asyncify modes.
npx nx recompile-php:all php-wasm-web

# Build only PHP 8.4 for the web, in JSPI mode.
npx nx recompile-php:jspi php-wasm-web -- --PHP_VERSION=8.4
```
-->

```sh
# Compila tutte le versioni PHP supportate per il web, nelle modalità JSPI e Asyncify.
npx nx recompile-php:all php-wasm-web

# Compila solo PHP 8.4 per il web, in modalità JSPI.
npx nx recompile-php:jspi php-wasm-web -- --PHP_VERSION=8.4
```

<!--
Replace `php-wasm-web` with `php-wasm-node` to build for Node.js, or `recompile-php:jspi` with `recompile-php:asyncify` to build the Asyncify variant. The output goes to `packages/php-wasm/web-builds/<major>-<minor>/<mode>/` or `packages/php-wasm/node-builds/<major>-<minor>/<mode>/`.
-->

Sostituisci `php-wasm-web` con `php-wasm-node` per compilare per Node.js, oppure `recompile-php:jspi` con `recompile-php:asyncify` per compilare la variante Asyncify. L'output viene salvato in `packages/php-wasm/web-builds/<major>-<minor>/<mode>/` oppure `packages/php-wasm/node-builds/<major>-<minor>/<mode>/`.

<!--
### Debug builds
-->

### Build di debug {#debug-builds}

<!--
Use `--WITH_DEBUG=yes` to build PHP.wasm with readable JavaScript output and DWARF debug information for stepping through C code in a WebAssembly debugger:
-->

Usa `--WITH_DEBUG=yes` per compilare PHP.wasm con un output JavaScript leggibile e informazioni di debug DWARF che consentono di eseguire il codice C passo per passo in un debugger WebAssembly:

<!--
```sh
# Build PHP 8.4 for debugging in the browser.
npx nx recompile-php:jspi php-wasm-web -- --PHP_VERSION=8.4 --WITH_DEBUG=yes

# Build PHP 8.4 for debugging in Node.js.
npx nx recompile-php:jspi php-wasm-node -- --PHP_VERSION=8.4 --WITH_DEBUG=yes
```
-->

```sh
# Compila PHP 8.4 per il debug nel browser.
npx nx recompile-php:jspi php-wasm-web -- --PHP_VERSION=8.4 --WITH_DEBUG=yes

# Compila PHP 8.4 per il debug in Node.js.
npx nx recompile-php:jspi php-wasm-node -- --PHP_VERSION=8.4 --WITH_DEBUG=yes
```

<!--
The same option works with `recompile-php:asyncify`. Debug builds produce larger files and run more slowly than optimized builds. They replace the selected version's artifacts in the output directory described above. Rebuild with `--WITH_DEBUG=no --WITH_SOURCEMAPS=no` to restore an optimized build.
-->

La stessa opzione funziona con `recompile-php:asyncify`. Le build di debug generano file più grandi e vengono eseguite più lentamente delle build ottimizzate. Sostituiscono gli artefatti della versione selezionata nella directory di output descritta sopra. Ricompila con `--WITH_DEBUG=no --WITH_SOURCEMAPS=no` per ripristinare una build ottimizzata.

<!--
For WebAssembly source maps, use `--WITH_SOURCEMAPS=yes`:
-->

Per generare le mappe dei sorgenti WebAssembly, usa `--WITH_SOURCEMAPS=yes`:

<!--
```sh
npx nx recompile-php:jspi php-wasm-web -- --PHP_VERSION=8.4 --WITH_SOURCEMAPS=yes
```
-->

```sh
npx nx recompile-php:jspi php-wasm-web -- --PHP_VERSION=8.4 --WITH_SOURCEMAPS=yes
```

<!--
This generates a `php.wasm.map` file and copies the source files needed for debugging into the build output. For web builds, the source map URL points to the local development server at `http://127.0.0.1:5400`; run `npm run dev` to serve it.
-->

Questo genera un file `php.wasm.map` e copia i file sorgente necessari per il debug nella directory di output della build. Per le build web, l'URL della mappa dei sorgenti punta al server di sviluppo locale all'indirizzo `http://127.0.0.1:5400`; esegui `npm run dev` per renderla disponibile.

<!--
#### Emscripten options
-->

#### Opzioni di Emscripten

<!--
The build script translates these options into compiler flags in the [PHP Dockerfile](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/compile/php/Dockerfile):
-->

Lo script di compilazione converte queste opzioni in flag del compilatore nel [Dockerfile di PHP](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/compile/php/Dockerfile):

<!--
| Flag           | Purpose                                                                                                | When Playground uses it                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `-O0`          | Disables optimization of the final WebAssembly and JavaScript output.                                  | `WITH_DEBUG=yes` or `WITH_SOURCEMAPS=yes`, replacing the default `-O3`. |
| `-g2`          | Keeps function names and readable JavaScript, without retaining DWARF information in the final module. | Node.js builds when neither debug option is enabled.                    |
| `-g3`          | Retains DWARF information for source-level debugging.                                                  | `WITH_DEBUG=yes` or `WITH_SOURCEMAPS=yes`.                              |
| `-gsource-map` | Generates a WebAssembly source map from compiler debug information.                                    | `WITH_SOURCEMAPS=yes`.                                                  |
-->

| Flag           | Scopo                                                                                                               | Quando viene usato da Playground                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `-O0`          | Disabilita l'ottimizzazione dell'output finale WebAssembly e JavaScript.                                            | `WITH_DEBUG=yes` oppure `WITH_SOURCEMAPS=yes`, al posto del valore predefinito `-O3`. |
| `-g2`          | Mantiene i nomi delle funzioni e il JavaScript leggibile, senza conservare le informazioni DWARF nel modulo finale. | Build per Node.js quando nessuna delle opzioni di debug è attiva.                     |
| `-g3`          | Conserva le informazioni DWARF per il debug a livello di codice sorgente.                                           | `WITH_DEBUG=yes` oppure `WITH_SOURCEMAPS=yes`.                                        |
| `-gsource-map` | Genera una mappa dei sorgenti WebAssembly a partire dalle informazioni di debug del compilatore.                    | `WITH_SOURCEMAPS=yes`.                                                                |

<!--
See the [Emscripten compiler reference](https://emscripten.org/docs/tools_reference/emcc.html) for details on these flags.
-->

Consulta la [documentazione di riferimento del compilatore Emscripten](https://emscripten.org/docs/tools_reference/emcc.html) per maggiori dettagli su questi flag.

<!--
#### Runtime assertions
-->

#### Asserzioni a runtime

<!--
Debug information and runtime assertions are separate settings. Playground explicitly passes `-s ASSERTIONS=0`, including in debug builds, so `--WITH_DEBUG=yes` does not enable extra runtime checks.
-->

Le informazioni di debug e le asserzioni a runtime sono impostazioni separate. Playground passa esplicitamente `-s ASSERTIONS=0`, anche nelle build di debug, quindi `--WITH_DEBUG=yes` non abilita controlli aggiuntivi a runtime.

<!--
To investigate a runtime failure with assertions, change that setting in the PHP Dockerfile's final `emcc` command and rebuild. Emscripten documents `-s ASSERTIONS=1` for runtime checks and `-s ASSERTIONS=2` for additional, slower checks. There is no `WITH_ASSERTIONS` build option. See the [Emscripten assertions reference](https://emscripten.org/docs/tools_reference/settings_reference.html#assertions).
-->

Per analizzare un errore a runtime con le asserzioni, modifica questa impostazione nel comando `emcc` finale del Dockerfile di PHP e ricompila. Emscripten documenta `-s ASSERTIONS=1` per i controlli a runtime e `-s ASSERTIONS=2` per controlli aggiuntivi, più lenti. Non esiste un’opzione di compilazione `WITH_ASSERTIONS`. Consulta la [documentazione di riferimento sulle asserzioni di Emscripten](https://emscripten.org/docs/tools_reference/settings_reference.html#assertions).

<!--
Assertions can also report an environment mismatch between `web` and `worker`. Check the build's `ENVIRONMENT` setting and the JavaScript loader's execution context when investigating those errors; see the [discussion in issue #176](https://github.com/WordPress/wordpress-playground/issues/176#issuecomment-1483754022).
-->

Le asserzioni possono anche segnalare una mancata corrispondenza dell'ambiente tra `web` e `worker`. Controlla l'impostazione `ENVIRONMENT` della build e il contesto di esecuzione del loader JavaScript quando analizzi questi errori; consulta la [discussione nell'issue #176](https://github.com/WordPress/wordpress-playground/issues/176#issuecomment-1483754022).

<!--
### PHP next builds
-->

### Build di PHP next

<!--
Playground can also run the next PHP version from the php-src development branch in the web runtime. These builds are published separately from the main repository because the generated WebAssembly files are large and change often.
-->

Playground può anche eseguire nel runtime web la prossima versione di PHP dal branch di sviluppo di php-src. Queste build vengono pubblicate separatamente dal repository principale perché i file WebAssembly generati sono grandi e cambiano spesso.

<!--
The nightly refresh workflow builds the php-src development branch, writes the web artifacts to the gitignored `packages/playground/website/public/php-next/` directory, and publishes the result to the `php-next-builds` branch. Website deploys and the local dev server sync that branch before serving `?php=next`.
-->

Il workflow di aggiornamento notturno compila il branch di sviluppo di php-src, scrive gli artefatti web nella directory `packages/playground/website/public/php-next/`, ignorata da Git, e pubblica il risultato nel branch `php-next-builds`. Le distribuzioni del sito web e il server di sviluppo locale sincronizzano questo branch prima di servire `?php=next`.

<!--
To refresh the local copy manually, run:
-->

Per aggiornare manualmente la copia locale, esegui:

<!--
```sh
npm run sync:php-next
```
-->

```sh
npm run sync:php-next
```

<!--
To rebuild the web artifacts locally from the php-src development branch, run:
-->

Per ricompilare localmente gli artefatti web dal branch di sviluppo di php-src, esegui:

<!--
```sh
npm run recompile:php:web:next
```
-->

```sh
npm run recompile:php:web:next
```

<!--
`php=next` currently ships web main modules only. Matching extension side modules and Playground CLI support are separate follow-up work.
-->

Attualmente `php=next` distribuisce solo i moduli principali per il web. I moduli secondari delle estensioni corrispondenti e il supporto per la CLI di Playground saranno affrontati in attività successive separate.

<!--
### PHP extensions
-->

### Estensioni PHP

<!--
PHP is built with several extensions listed in the [`Dockerfile`](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/compile/php/Dockerfile).
-->

PHP viene compilato con diverse estensioni elencate nel [`Dockerfile`](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/compile/php/Dockerfile).

<!--
Some extensions, like `zip`, can be turned on or off during the build. Others, like `sqlite3`, are hardcoded.
-->

Alcune estensioni, come `zip`, possono essere abilitate o disabilitate durante la compilazione. Altre, come `sqlite3`, sono definite direttamente nel codice.

<!--
If you need to turn off one of the hardcoded extensions, feel free to open an issue in this repo. Better yet, this project needs contributors. You are more than welcome to open a PR and author the change you need.
-->

Se hai bisogno di disabilitare una delle estensioni definite direttamente nel codice, puoi aprire un'issue in questo repository. Ancora meglio: questo progetto ha bisogno di collaboratori. Puoi aprire una PR e implementare la modifica di cui hai bisogno.

<!--
PHP.wasm can also load dynamic `.so` extensions before PHP starts. Built-in
dynamic extensions such as `intl`, `xdebug`, `redis`, and `memcached` are
distributed with the Node package, and external extensions can be supplied with
a manifest that selects the artifact matching the active PHP version and async
mode. See [Loading PHP extensions](/developers/apis/javascript-api/php-extensions)
for the runtime API.
-->

PHP.wasm può anche caricare estensioni dinamiche `.so` prima dell'avvio di PHP. Le estensioni dinamiche integrate, come `intl`, `xdebug`, `redis` e `memcached`, vengono distribuite con il pacchetto Node, mentre le estensioni esterne possono essere fornite con un manifest che seleziona l'artefatto corrispondente alla versione di PHP e alla modalità asincrona attive. Consulta [Caricare estensioni PHP](/developers/apis/javascript-api/php-extensions) per l'API di runtime.

<!--
### C API exposed to JavaScript
-->

### API C esposta a JavaScript

<!--
The C API exposed to JavaScript lives in the [`php_wasm.c`](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/php-wasm/compile/build-assets/php_wasm.c) file. The most important functions are:
-->

L'API C esposta a JavaScript si trova nel file [`php_wasm.c`](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/php-wasm/compile/build-assets/php_wasm.c). Le funzioni più importanti sono:

<!--
- `void phpwasm_init()` – It creates a new PHP context and must be called before running any PHP code.
- `int phpwasm_run(char *code)` – Runs a PHP script and writes the output to /tmp/stdout and /tmp/stderr. Returns the exit code.
- `void phpwasm_refresh()` – Destroy the current PHP context and starts a new one. Call it after running one PHP script and before running another.
-->

- `void phpwasm_init()` – Crea un nuovo contesto PHP e deve essere chiamata prima di eseguire qualsiasi codice PHP.
- `int phpwasm_run(char *code)` – Esegue uno script PHP e scrive l'output in /tmp/stdout e /tmp/stderr. Restituisce il codice di uscita.
- `void phpwasm_refresh()` – Elimina il contesto PHP corrente e ne avvia uno nuovo. Chiamala dopo aver eseguito uno script PHP e prima di eseguirne un altro.

<!--
Refer to the inline documentation in [`php_wasm.c`](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/php-wasm/compile/build-assets/php_wasm.c) to learn more.
-->

Consulta la documentazione nel codice di [`php_wasm.c`](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/php-wasm/compile/build-assets/php_wasm.c) per saperne di più.

<!--
### Build configuration
-->

### Configurazione della build

<!--
The build is configurable via the [Docker `--build-arg` feature](https://docs.docker.com/engine/reference/commandline/build/#set-build-time-variables---build-arg). You can set them up through the `build.js` script, just run this command to get the usage message:
-->

La build è configurabile tramite la [funzionalità `--build-arg` di Docker](https://docs.docker.com/engine/reference/commandline/build/#set-build-time-variables---build-arg). Puoi impostare le opzioni tramite lo script `build.js`; esegui questo comando per visualizzare le istruzioni di utilizzo:

<!--
```sh
npx nx recompile-php:jspi php-wasm-web -- --help
```
-->

```sh
npx nx recompile-php:jspi php-wasm-web -- --help
```

<!--
**Supported build options:**
-->

**Opzioni di compilazione supportate:**

<!--
- `WITH_DEBUG` – `yes` or `no`. Build with DWARF debug information and disable final optimization. See [Debug builds](#debug-builds).
- `WITH_SOURCEMAPS` – `yes` or `no`. Generate WebAssembly source maps and disable final optimization. See [Debug builds](#debug-builds).
- `PHP_VERSION` – The PHP version to build, default: `8.0.24`. This value must point to an existing branch of the https://github.com/php/php-src.git repository when prefixed with `PHP-`. For example, `7.4.0` is valid because the branch `PHP-7.4.0` exists, but just `7` is invalid because there's no branch `PHP-7`. The PHP versions that are known to work are `7.4.*` and `8.0.*`. Others likely work as well but they haven't been tried.
- `EMSCRIPTEN_ENVIRONMENT` – `web` or `node`, default: `web`. The platform to build for. When building for `web`, two JavaScript loaders will be created: `php-web.js` and `php-webworker.js`. When building for Node.js, only one loader called `php-node.js` will be created.
- `WITH_LIBXML` – `yes` or `no`, default: `no`. Whether to build with `libxml2` and the `dom`, `xml`, and `simplexml` PHP extensions (`DOMDocument`, `SimpleXML`, ..).
- `WITH_LIBZIP` – `yes` or `no`, default: `yes`. Whether to build with `zlib`, `libzip`, and the `zip` PHP extension (`ZipArchive`).
- `WITH_NODEFS` – `yes` or `no`, default: `no`. Whether to include [the Emscripten's NODEFS JavaScript library](https://emscripten.org/docs/api_reference/Filesystem-API.html#filesystem-api-nodefs). It's useful for loading files and mounting directories from the local filesystem when running php.wasm from Node.js.
-->

- `WITH_DEBUG` – `yes` oppure `no`. Compila con informazioni di debug DWARF e disabilita l'ottimizzazione finale. Consulta [Build di debug](#debug-builds).
- `WITH_SOURCEMAPS` – `yes` oppure `no`. Genera mappe dei sorgenti WebAssembly e disabilita l'ottimizzazione finale. Consulta [Build di debug](#debug-builds).
- `PHP_VERSION` – La versione di PHP da compilare, predefinita: `8.0.24`. Questo valore deve corrispondere a un branch esistente del repository https://github.com/php/php-src.git quando preceduto da `PHP-`. Ad esempio, `7.4.0` è valido perché il branch `PHP-7.4.0` esiste, mentre solo `7` non è valido perché non esiste un branch `PHP-7`. Le versioni di PHP note per funzionare sono `7.4.*` e `8.0.*`. È probabile che anche le altre funzionino, ma non sono state provate.
- `EMSCRIPTEN_ENVIRONMENT` – `web` oppure `node`, predefinito: `web`. La piattaforma di destinazione della compilazione. Per `web` vengono creati due loader JavaScript: `php-web.js` e `php-webworker.js`. Per Node.js viene creato un solo loader, chiamato `php-node.js`.
- `WITH_LIBXML` – `yes` oppure `no`, predefinito: `no`. Indica se compilare con `libxml2` e le estensioni PHP `dom`, `xml` e `simplexml` (`DOMDocument`, `SimpleXML`, ...).
- `WITH_LIBZIP` – `yes` oppure `no`, predefinito: `yes`. Indica se compilare con `zlib`, `libzip` e l'estensione PHP `zip` (`ZipArchive`).
- `WITH_NODEFS` – `yes` oppure `no`, predefinito: `no`. Indica se includere [la libreria JavaScript NODEFS di Emscripten](https://emscripten.org/docs/api_reference/Filesystem-API.html#filesystem-api-nodefs). È utile per caricare file e montare directory del filesystem locale quando si esegue php.wasm da Node.js.
