---
title: Compilando PHP
slug: /developers/architecture/wasm-php-compiling
---

<!--
# Compiling PHP
-->

# Compilando PHP

<!--
The build pipeline lives in a [`Dockerfile`](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/compile/php/Dockerfile). It was originally forked from [seanmorris/php-wasm](https://github.com/seanmorris/php-wasm)
-->

O processo de compilação está em um [`Dockerfile`](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/compile/php/Dockerfile). Ele foi originalmente derivado de [seanmorris/php-wasm](https://github.com/seanmorris/php-wasm).

<!--
In broad strokes, that `Dockerfile`:
-->

Em linhas gerais, esse `Dockerfile`:

<!--
- Installs all the necessary linux packages (like `build-essential`)
- Downloads PHP and the required libraries, e.g. `sqlite3`.
- Applies a few patches.
- Compiles everything using [Emscripten](https://emscripten.org/), a drop-in replacement for the C compiler.
- Compiles `php_wasm.c` – a convenient API for JavaScript.
- Outputs a `php.wasm` file and one or more JavaScript loaders, depending on the configuration.
- Transforms the Emscripten's default `php.js` output into an ESM module with additional features.
-->

- Instala todos os pacotes Linux necessários (como `build-essential`).
- Baixa o PHP e as bibliotecas necessárias, como `sqlite3`.
- Aplica algumas correções.
- Compila tudo usando [Emscripten](https://emscripten.org/), um substituto direto para o compilador C.
- Compila `php_wasm.c` – uma API conveniente para JavaScript.
- Gera um arquivo `php.wasm` e um ou mais carregadores JavaScript, dependendo da configuração.
- Transforma a saída padrão `php.js` do Emscripten em um módulo ESM com recursos adicionais.

<!--
To find out more about each step, refer directly to the [Dockerfile](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/compile/php/Dockerfile).
-->

Para saber mais sobre cada etapa, consulte diretamente o [Dockerfile](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/compile/php/Dockerfile).

<!--
## Building
-->

## Compilação

<!--
With Docker running and the repository dependencies installed, run these commands from the repository root:
-->

Com o Docker em execução e as dependências do repositório instaladas, execute estes comandos na raiz do repositório:

<!--
```sh
# Build all supported PHP versions for the web, in both JSPI and Asyncify modes.
npx nx recompile-php:all php-wasm-web

# Build only PHP 8.4 for the web, in JSPI mode.
npx nx recompile-php:jspi php-wasm-web -- --PHP_VERSION=8.4
```
-->

```sh
# Compila todas as versões suportadas do PHP para a web, nos modos JSPI e Asyncify.
npx nx recompile-php:all php-wasm-web

# Compila apenas o PHP 8.4 para a web, no modo JSPI.
npx nx recompile-php:jspi php-wasm-web -- --PHP_VERSION=8.4
```

<!--
Replace `php-wasm-web` with `php-wasm-node` to build for Node.js, or `recompile-php:jspi` with `recompile-php:asyncify` to build the Asyncify variant. The output goes to `packages/php-wasm/web-builds/<major>-<minor>/<mode>/` or `packages/php-wasm/node-builds/<major>-<minor>/<mode>/`.
-->

Substitua `php-wasm-web` por `php-wasm-node` para compilar para Node.js, ou `recompile-php:jspi` por `recompile-php:asyncify` para compilar a variante Asyncify. A saída é gravada em `packages/php-wasm/web-builds/<major>-<minor>/<mode>/` ou `packages/php-wasm/node-builds/<major>-<minor>/<mode>/`.

<!--
## Debug builds
-->

## Compilações para depuração {#debug-builds}

<!--
Use `--WITH_DEBUG=yes` to build PHP.wasm with readable JavaScript output and DWARF debug information for stepping through C code in a WebAssembly debugger:
-->

Use `--WITH_DEBUG=yes` para compilar PHP.wasm com saída JavaScript legível e informações de depuração DWARF para executar o código C passo a passo em um depurador WebAssembly:

<!--
```sh
# Build PHP 8.4 for debugging in the browser.
npx nx recompile-php:jspi php-wasm-web -- --PHP_VERSION=8.4 --WITH_DEBUG=yes

# Build PHP 8.4 for debugging in Node.js.
npx nx recompile-php:jspi php-wasm-node -- --PHP_VERSION=8.4 --WITH_DEBUG=yes
```
-->

```sh
# Compila o PHP 8.4 para depuração no navegador.
npx nx recompile-php:jspi php-wasm-web -- --PHP_VERSION=8.4 --WITH_DEBUG=yes

# Compila o PHP 8.4 para depuração no Node.js.
npx nx recompile-php:jspi php-wasm-node -- --PHP_VERSION=8.4 --WITH_DEBUG=yes
```

<!--
The same option works with `recompile-php:asyncify`. Debug builds produce larger files and run more slowly than optimized builds. They replace the selected version's artifacts in the output directory described above. Rebuild with `--WITH_DEBUG=no --WITH_SOURCEMAPS=no` to restore an optimized build.
-->

A mesma opção funciona com `recompile-php:asyncify`. As compilações para depuração geram arquivos maiores e são mais lentas que as compilações otimizadas. Elas substituem os artefatos da versão selecionada no diretório de saída descrito acima. Compile novamente com `--WITH_DEBUG=no --WITH_SOURCEMAPS=no` para restaurar uma compilação otimizada.

<!--
For WebAssembly source maps, use `--WITH_SOURCEMAPS=yes`:
-->

Para gerar mapas de código-fonte WebAssembly, use `--WITH_SOURCEMAPS=yes`:

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

Isso gera um arquivo `php.wasm.map` e copia os arquivos de código-fonte necessários para depuração para o diretório de saída da compilação. Nas compilações para a web, o URL do mapa de código-fonte aponta para o servidor de desenvolvimento local em `http://127.0.0.1:5400`; execute `npm run dev` para disponibilizá-lo.

<!--
### Emscripten options
-->

### Opções do Emscripten

<!--
The build script translates these options into compiler flags in the [PHP Dockerfile](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/compile/php/Dockerfile):
-->

O script de compilação converte essas opções em sinalizadores do compilador no [Dockerfile do PHP](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/compile/php/Dockerfile):

<!--
| Flag           | Purpose                                                                                                | When Playground uses it                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `-O0`          | Disables optimization of the final WebAssembly and JavaScript output.                                  | `WITH_DEBUG=yes` or `WITH_SOURCEMAPS=yes`, replacing the default `-O3`. |
| `-g2`          | Keeps function names and readable JavaScript, without retaining DWARF information in the final module. | Node.js builds when neither debug option is enabled.                    |
| `-g3`          | Retains DWARF information for source-level debugging.                                                  | `WITH_DEBUG=yes` or `WITH_SOURCEMAPS=yes`.                              |
| `-gsource-map` | Generates a WebAssembly source map from compiler debug information.                                    | `WITH_SOURCEMAPS=yes`.                                                  |
-->

| Sinalizador    | Finalidade                                                                                       | Quando o Playground o usa                                                     |
| -------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `-O0`          | Desativa a otimização da saída final de WebAssembly e JavaScript.                                | `WITH_DEBUG=yes` ou `WITH_SOURCEMAPS=yes`, substituindo o padrão `-O3`.       |
| `-g2`          | Mantém os nomes das funções e o JavaScript legível, sem reter informações DWARF no módulo final. | Compilações para Node.js quando nenhuma das opções de depuração está ativada. |
| `-g3`          | Mantém informações DWARF para depuração no nível do código-fonte.                                | `WITH_DEBUG=yes` ou `WITH_SOURCEMAPS=yes`.                                    |
| `-gsource-map` | Gera um mapa de código-fonte WebAssembly a partir das informações de depuração do compilador.    | `WITH_SOURCEMAPS=yes`.                                                        |

<!--
See the [Emscripten compiler reference](https://emscripten.org/docs/tools_reference/emcc.html) for details on these flags.
-->

Consulte a [referência do compilador Emscripten](https://emscripten.org/docs/tools_reference/emcc.html) para saber mais sobre esses sinalizadores.

<!--
### Runtime assertions
-->

### Asserções em tempo de execução

<!--
Debug information and runtime assertions are separate settings. Playground explicitly passes `-s ASSERTIONS=0`, including in debug builds, so `--WITH_DEBUG=yes` does not enable extra runtime checks.
-->

As informações de depuração e as asserções em tempo de execução são configurações separadas. O Playground passa explicitamente `-s ASSERTIONS=0`, inclusive nas compilações para depuração, portanto `--WITH_DEBUG=yes` não ativa verificações adicionais em tempo de execução.

<!--
To investigate a runtime failure with assertions, change that setting in the PHP Dockerfile's final `emcc` command and rebuild. Emscripten documents `-s ASSERTIONS=1` for runtime checks and `-s ASSERTIONS=2` for additional, slower checks. There is no `WITH_ASSERTIONS` build option. See the [Emscripten assertions reference](https://emscripten.org/docs/tools_reference/settings_reference.html#assertions).
-->

Para investigar uma falha em tempo de execução com asserções, altere essa configuração no comando `emcc` final do Dockerfile do PHP e compile novamente. O Emscripten documenta `-s ASSERTIONS=1` para verificações em tempo de execução e `-s ASSERTIONS=2` para verificações adicionais, mais lentas. Não existe uma opção de compilação `WITH_ASSERTIONS`. Consulte a [referência de asserções do Emscripten](https://emscripten.org/docs/tools_reference/settings_reference.html#assertions).

<!--
## PHP next builds
-->

## Compilações do PHP next

<!--
Playground can also run the next PHP version from the php-src development branch in the web runtime. These builds are published separately from the main repository because the generated WebAssembly files are large and change often.
-->

O Playground também pode executar a próxima versão do PHP a partir do branch de desenvolvimento do php-src no ambiente web. Essas compilações são publicadas separadamente do repositório principal porque os arquivos WebAssembly gerados são grandes e mudam com frequência.

<!--
The nightly refresh workflow builds the php-src development branch, writes the web artifacts to the gitignored `packages/playground/website/public/php-next/` directory, and publishes the result to the `php-next-builds` branch. Website deploys and the local dev server sync that branch before serving `?php=next`.
-->

O fluxo de atualização noturno compila o branch de desenvolvimento do php-src, grava os artefatos para a web no diretório `packages/playground/website/public/php-next/`, ignorado pelo Git, e publica o resultado no branch `php-next-builds`. As implantações do site e o servidor de desenvolvimento local sincronizam esse branch antes de servir `?php=next`.

<!--
To refresh the local copy manually, run:
-->

Para atualizar a cópia local manualmente, execute:

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

Para recompilar localmente os artefatos para a web a partir do branch de desenvolvimento do php-src, execute:

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

Atualmente, `php=next` distribui apenas módulos principais para a web. Os módulos auxiliares de extensões correspondentes e o suporte à CLI do Playground serão tratados em trabalhos separados.

<!--
## PHP extensions
-->

## Extensões PHP

<!--
PHP is built with several extensions listed in the [`Dockerfile`](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/compile/php/Dockerfile).
-->

O PHP é compilado com várias extensões listadas no [`Dockerfile`](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/compile/php/Dockerfile).

<!--
Some extensions, like `zip`, can be turned on or off during the build. Others, like `sqlite3`, are hardcoded.
-->

Algumas extensões, como `zip`, podem ser ativadas ou desativadas durante a compilação. Outras, como `sqlite3`, são definidas diretamente no código.

<!--
If you need to turn off one of the hardcoded extensions, feel free to open an issue in this repo. Better yet, this project needs contributors. You are more than welcome to open a PR and author the change you need.
-->

Se você precisa desativar uma das extensões definidas diretamente no código, fique à vontade para abrir uma issue neste repositório. Melhor ainda: este projeto precisa de colaboradores. Você pode abrir um PR e implementar a alteração de que precisa.

<!--
PHP.wasm can also load dynamic `.so` extensions before PHP starts. Built-in
dynamic extensions such as `intl`, `xdebug`, `redis`, and `memcached` are
distributed with the Node package, and external extensions can be supplied with
a manifest that selects the artifact matching the active PHP version and async
mode. See [Loading PHP extensions](/developers/apis/javascript-api/php-extensions)
for the runtime API.
-->

PHP.wasm também pode carregar extensões dinâmicas `.so` antes de iniciar o PHP. Extensões dinâmicas integradas, como `intl`, `xdebug`, `redis` e `memcached`, são distribuídas com o pacote Node, e extensões externas podem ser fornecidas com um manifesto que seleciona o artefato correspondente à versão do PHP e ao modo assíncrono ativos. Consulte [Carregando extensões PHP](/developers/apis/javascript-api/php-extensions) para conhecer a API de execução.

<!--
## C API exposed to JavaScript
-->

## API C exposta ao JavaScript

<!--
The C API exposed to JavaScript lives in the [`php_wasm.c`](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/php-wasm/compile/build-assets/php_wasm.c) file. The most important functions are:
-->

A API C exposta ao JavaScript está no arquivo [`php_wasm.c`](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/php-wasm/compile/build-assets/php_wasm.c). As funções mais importantes são:

<!--
- `void phpwasm_init()` – It creates a new PHP context and must be called before running any PHP code.
- `int phpwasm_run(char *code)` – Runs a PHP script and writes the output to /tmp/stdout and /tmp/stderr. Returns the exit code.
- `void phpwasm_refresh()` – Destroy the current PHP context and starts a new one. Call it after running one PHP script and before running another.
-->

- `void phpwasm_init()` – Cria um novo contexto PHP e deve ser chamada antes de executar qualquer código PHP.
- `int phpwasm_run(char *code)` – Executa um script PHP e grava a saída em /tmp/stdout e /tmp/stderr. Retorna o código de saída.
- `void phpwasm_refresh()` – Destrói o contexto PHP atual e inicia um novo. Chame-a após executar um script PHP e antes de executar outro.

<!--
Refer to the inline documentation in [`php_wasm.c`](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/php-wasm/compile/build-assets/php_wasm.c) to learn more.
-->

Consulte a documentação no código de [`php_wasm.c`](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/php-wasm/compile/build-assets/php_wasm.c) para saber mais.

<!--
## Build configuration
-->

## Configuração da compilação

<!--
The build is configurable via the [Docker `--build-arg` feature](https://docs.docker.com/engine/reference/commandline/build/#set-build-time-variables---build-arg). You can set them up through the `build.js` script, just run this command to get the usage message:
-->

A compilação é configurável pelo [recurso `--build-arg` do Docker](https://docs.docker.com/engine/reference/commandline/build/#set-build-time-variables---build-arg). Você pode definir as opções pelo script `build.js`; execute este comando para ver as instruções de uso:

<!--
```sh
npx nx recompile-php:jspi php-wasm-web -- --help
```
-->

```sh
npx nx recompile-php:jspi php-wasm-web -- --help
```

<!--
**Selected build options:**

This list highlights debug and basic build settings. For the full set of options, run the help command above; see [the build script](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/compile/build.js) for platform-specific defaults.
-->

**Opções de compilação selecionadas:**

Esta lista destaca as configurações de depuração e compilação básicas. Para consultar todas as opções, execute o comando de ajuda acima; consulte [o script de compilação](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/compile/build.js) para ver os valores padrão de cada plataforma.

<!--
- `WITH_DEBUG` – `yes` or `no`. Build with DWARF debug information and disable final optimization. See [Debug builds](#debug-builds).
- `WITH_SOURCEMAPS` – `yes` or `no`. Generate WebAssembly source maps and disable final optimization. See [Debug builds](#debug-builds).
- `PHP_VERSION` – The PHP version to build. Use a major/minor version such as `8.4` to select its latest release from [the supported PHP versions](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/supported-php-versions.mjs), or an exact release such as `8.4.25`. The build clones the corresponding `php-<version>` tag from php-src.
- `EMSCRIPTEN_ENVIRONMENT` – `web` or `node`, default: `web`. The platform to build for. When building for `web`, two JavaScript loaders will be created: `php-web.js` and `php-webworker.js`. When building for Node.js, only one loader called `php-node.js` will be created.
- `WITH_LIBXML` – `yes` or `no`, default: `no`. Whether to build with `libxml2` and the `dom`, `xml`, and `simplexml` PHP extensions (`DOMDocument`, `SimpleXML`, ..).
- `WITH_LIBZIP` – `yes` or `no`, default: `yes`. Whether to build with `zlib`, `libzip`, and the `zip` PHP extension (`ZipArchive`).
- `WITH_NODEFS` – `yes` or `no`, default: `no`. Whether to include [the Emscripten's NODEFS JavaScript library](https://emscripten.org/docs/api_reference/Filesystem-API.html#filesystem-api-nodefs). It's useful for loading files and mounting directories from the local filesystem when running php.wasm from Node.js.
-->

- `WITH_DEBUG` – `yes` ou `no`. Compila com informações de depuração DWARF e desativa a otimização final. Consulte [Compilações para depuração](#debug-builds).
- `WITH_SOURCEMAPS` – `yes` ou `no`. Gera mapas de código-fonte WebAssembly e desativa a otimização final. Consulte [Compilações para depuração](#debug-builds).
- `PHP_VERSION` – A versão do PHP a compilar. Use uma versão principal/secundária como `8.4` para selecionar sua versão mais recente na [lista de versões do PHP compatíveis](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/supported-php-versions.mjs), ou uma versão exata como `8.4.25`. A compilação clona a tag `php-<version>` correspondente do php-src.
- `EMSCRIPTEN_ENVIRONMENT` – `web` ou `node`, padrão: `web`. A plataforma para a qual compilar. Ao compilar para `web`, dois carregadores JavaScript são criados: `php-web.js` e `php-webworker.js`. Ao compilar para Node.js, apenas um carregador chamado `php-node.js` é criado.
- `WITH_LIBXML` – `yes` ou `no`, padrão: `no`. Define se a compilação inclui `libxml2` e as extensões PHP `dom`, `xml` e `simplexml` (`DOMDocument`, `SimpleXML`, ...).
- `WITH_LIBZIP` – `yes` ou `no`, padrão: `yes`. Define se a compilação inclui `zlib`, `libzip` e a extensão PHP `zip` (`ZipArchive`).
- `WITH_NODEFS` – `yes` ou `no`, padrão: `no`. Define se a compilação inclui [a biblioteca JavaScript NODEFS do Emscripten](https://emscripten.org/docs/api_reference/Filesystem-API.html#filesystem-api-nodefs). Ela permite carregar arquivos e montar diretórios do sistema de arquivos local ao executar php.wasm no Node.js.
