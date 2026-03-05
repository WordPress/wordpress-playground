---
slug: /developers/architecture/wasm-php-compiling
---

<!-- # Compiling PHP -->

# Compilando PHP

<!-- The build pipeline lives in a [`Dockerfile`](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/php-wasm/compile/Dockerfile). It was originally forked from [seanmorris/php-wasm](https://github.com/seanmorris/php-wasm) -->

O pipeline de build está em um [`Dockerfile`](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/php-wasm/compile/Dockerfile). Originalmente foi um fork de [seanmorris/php-wasm](https://github.com/seanmorris/php-wasm)

<!-- In broad strokes, that `Dockerfile`: -->

Em linhas gerais, esse `Dockerfile`:

<!-- -   Installs all the necessary linux packages (like `build-essential`)
-   Downloads PHP and the required libraries, e.g. `sqlite3`.
-   Applies a few patches.
-   Compiles everything using [Emscripten](https://emscripten.org/), a drop-in replacement for the C compiler.
-   Compiles `php_wasm.c` – a convenient API for JavaScript.
-   Outputs a `php.wasm` file and one or more JavaScript loaders, depending on the configuration.
-   Transforms the Emscripten's default `php.js` output into an ESM module with additional features. -->

-   Instala todos os pacotes linux necessários (como `build-essential`)
-   Baixa o PHP e as bibliotecas necessárias, por exemplo `sqlite3`.
-   Aplica alguns patches.
-   Compila tudo usando [Emscripten](https://emscripten.org/), um substituto direto para o compilador C.
-   Compila `php_wasm.c` – uma API conveniente para JavaScript.
-   Produz um arquivo `php.wasm` e um ou mais carregadores JavaScript, dependendo da configuração.
-   Transforma a saída padrão `php.js` do Emscripten em um módulo ESM com recursos adicionais.

<!-- To find out more about each step, refer directly to the [Dockerfile](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/php-wasm/compile/Dockerfile). -->

Para descobrir mais sobre cada etapa, consulte diretamente o [Dockerfile](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/php-wasm/compile/Dockerfile).

<!-- ### Building -->

### Compilando

<!-- To build all PHP versions, run `nx recompile-php:all php-wasm-web` (or `php-wasm-node`) in the repository root. You'll find the output files in `packages/php-wasm/php-web/public`. To build a specific version, run `nx recompile-php:all php-wasm-node --PHP_VERSION=8.0 --WITH_JSPI=yes` (and repeat with `--WITH_JSPI=no`). -->

Para compilar todas as versões do PHP, execute `nx recompile-php:all php-wasm-web` (ou `php-wasm-node`) na raiz do repositório. Você encontrará os arquivos de saída em `packages/php-wasm/php-web/public`. Para compilar uma versão específica, execute `nx recompile-php:all php-wasm-node --PHP_VERSION=8.0 --WITH_JSPI=yes` (e repita com `--WITH_JSPI=no`).

<!-- ### PHP extensions -->

### Extensões PHP

<!-- PHP is built with several extensions listed in the [`Dockerfile`](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/php-wasm/compile/Dockerfile). -->

O PHP é compilado com várias extensões listadas no [`Dockerfile`](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/php-wasm/compile/Dockerfile).

<!-- Some extensions, like `zip`, can be turned on or off during the build. Others, like `sqlite3`, are hardcoded. -->

Algumas extensões, como `zip`, podem ser ligadas ou desligadas durante a compilação. Outras, como `sqlite3`, estão hardcoded.

<!-- If you need to turn off one of the hardcoded extensions, feel free to open an issue in this repo. Better yet, this project needs contributors. You are more than welcome to open a PR and author the change you need. -->

Se você precisa desligar uma das extensões hardcoded, sinta-se à vontade para abrir uma issue neste repositório. Melhor ainda, este projeto precisa de contribuidores. Você é mais que bem-vindo para abrir um PR e criar a mudança que você precisa.

<!-- ### C API exposed to JavaScript -->

### API C exposta ao JavaScript

<!-- The C API exposed to JavaScript lives in the [`php_wasm.c`](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/php-wasm/compile/build-assets/php_wasm.c) file. The most important functions are: -->

A API C exposta ao JavaScript está no arquivo [`php_wasm.c`](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/php-wasm/compile/build-assets/php_wasm.c). As funções mais importantes são:

<!-- -   `void phpwasm_init()` – It creates a new PHP context and must be called before running any PHP code.
-   `int phpwasm_run(char *code)` – Runs a PHP script and writes the output to /tmp/stdout and /tmp/stderr. Returns the exit code.
-   `void phpwasm_refresh()` – Destroy the current PHP context and starts a new one. Call it after running one PHP script and before running another. -->

-   `void phpwasm_init()` – Cria um novo contexto PHP e deve ser chamada antes de executar qualquer código PHP.
-   `int phpwasm_run(char *code)` – Executa um script PHP e escreve a saída em /tmp/stdout e /tmp/stderr. Retorna o código de saída.
-   `void phpwasm_refresh()` – Destrói o contexto PHP atual e inicia um novo. Chame-a após executar um script PHP e antes de executar outro.

<!-- Refer to the inline documentation in [`php_wasm.c`](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/php-wasm/compile/build-assets/php_wasm.c) to learn more. -->

Consulte a documentação inline em [`php_wasm.c`](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/php-wasm/compile/build-assets/php_wasm.c) para saber mais.

<!-- ### Build configuration -->

### Configuração de build

<!-- The build is configurable via the [Docker `--build-arg` feature](https://docs.docker.com/engine/reference/commandline/build/#set-build-time-variables---build-arg). You can set them up through the `build.js` script, just run this command to get the usage message: -->

A build é configurável através do [recurso `--build-arg` do Docker](https://docs.docker.com/engine/reference/commandline/build/#set-build-time-variables---build-arg). Você pode configurá-las através do script `build.js`, apenas execute este comando para obter a mensagem de uso:

```sh
nx recompile-php php-wasm-web
```

<!-- **Supported build options:** -->

**Opções de build suportadas:**

<!-- -   `PHP_VERSION` – The PHP version to build, default: `8.0.24`. This value must point to an existing branch of the https://github.com/php/php-src.git repository when prefixed with `PHP-`. For example, `7.4.0` is valid because the branch `PHP-7.4.0` exists, but just `7` is invalid because there's no branch `PHP-7`. The PHP versions that are known to work are `7.4.*` and `8.0.*`. Others likely work as well but they haven't been tried.
-   `EMSCRIPTEN_ENVIRONMENT` – `web` or `node`, default: `web`. The platform to build for. When building for `web`, two JavaScript loaders will be created: `php-web.js` and `php-webworker.js`. When building for Node.js, only one loader called `php-node.js` will be created.
-   `WITH_LIBXML` – `yes` or `no`, default: `no`. Whether to build with `libxml2` and the `dom`, `xml`, and `simplexml` PHP extensions (`DOMDocument`, `SimpleXML`, ..).
-   `WITH_LIBZIP` – `yes` or `no`, default: `yes`. Whether to build with `zlib`, `libzip`, and the `zip` PHP extension (`ZipArchive`).
-   `WITH_NODEFS` – `yes` or `no`, default: `no`. Whether to include [the Emscripten's NODEFS JavaScript library](https://emscripten.org/docs/api_reference/Filesystem-API.html#filesystem-api-nodefs). It's useful for loading files and mounting directories from the local filesystem when running php.wasm from Node.js. -->

-   `PHP_VERSION` – A versão do PHP para compilar, padrão: `8.0.24`. Este valor deve apontar para uma branch existente do repositório https://github.com/php/php-src.git quando prefixado com `PHP-`. Por exemplo, `7.4.0` é válido porque a branch `PHP-7.4.0` existe, mas apenas `7` é inválido porque não há branch `PHP-7`. As versões do PHP que sabemos que funcionam são `7.4.*` e `8.0.*`. Outras provavelmente também funcionam, mas não foram testadas.
-   `EMSCRIPTEN_ENVIRONMENT` – `web` ou `node`, padrão: `web`. A plataforma para a qual compilar. Ao compilar para `web`, dois carregadores JavaScript serão criados: `php-web.js` e `php-webworker.js`. Ao compilar para Node.js, apenas um carregador chamado `php-node.js` será criado.
-   `WITH_LIBXML` – `yes` ou `no`, padrão: `no`. Se deve compilar com `libxml2` e as extensões PHP `dom`, `xml`, e `simplexml` (`DOMDocument`, `SimpleXML`, ..).
-   `WITH_LIBZIP` – `yes` ou `no`, padrão: `yes`. Se deve compilar com `zlib`, `libzip`, e a extensão PHP `zip` (`ZipArchive`).
-   `WITH_NODEFS` – `yes` ou `no`, padrão: `no`. Se deve incluir [a biblioteca JavaScript NODEFS do Emscripten](https://emscripten.org/docs/api_reference/Filesystem-API.html#filesystem-api-nodefs). É útil para carregar arquivos e montar diretórios do sistema de arquivos local ao executar php.wasm do Node.js.
