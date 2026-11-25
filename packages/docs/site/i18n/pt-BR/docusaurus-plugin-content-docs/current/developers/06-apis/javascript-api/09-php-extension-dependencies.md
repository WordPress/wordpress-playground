---
title: Dependências de extensões PHP
slug: /developers/apis/javascript-api/php-extension-dependencies
description: Vincule dependências WebAssembly ao compilar extensões personalizadas do PHP.wasm.
---

<!-- # PHP extension dependencies -->

# Dependências de extensões PHP

<!--
Custom PHP.wasm extensions can only link WebAssembly code built with the same
Emscripten toolchain and JSPI ABI as the PHP runtime. Native host libraries from
`/usr/lib`, Homebrew, apt, or npm packages cannot be linked into the final
`.so`.
-->

Extensões personalizadas do PHP.wasm só podem vincular código WebAssembly compilado com a mesma
toolchain do Emscripten e a mesma ABI JSPI do runtime do PHP. Bibliotecas nativas do sistema, vindas de
`/usr/lib`, do Homebrew, do apt ou de pacotes npm, não podem ser vinculadas ao `.so`
final.

<!--
Build dependencies as static WebAssembly archives and pass their headers and
archives to `@php-wasm/compile-extension`.
-->

Compile as dependências como arquivos estáticos WebAssembly e passe os headers e
os arquivos `.a` delas para o `@php-wasm/compile-extension`.

<!-- ## Playground-built dependencies -->

## Dependências compiladas pelo Playground {#playground-built-dependencies}

<!--
Some libraries already have recipes in `packages/php-wasm/compile`. Build the
JSPI target and pass the mounted path inside the helper container:
-->

Algumas bibliotecas já têm receitas em `packages/php-wasm/compile`. Compile o
alvo JSPI e passe o caminho montado dentro do contêiner da ferramenta:

```bash
make -C packages/php-wasm/compile libz_jspi

npx @php-wasm/compile-extension \
	--source ./zlib-probe \
	--name zlib_probe \
	--php-versions 8.4 \
	--extra-cflags "-I/php-wasm-compile/libz/jspi/dist/root/lib/include" \
	--extra-ldflags "/php-wasm-compile/libz/jspi/dist/root/lib/lib/libz.a"
```

<!--
Use the `jspi` archive for custom extension builds.
-->

Use o arquivo `jspi` nos builds de extensões personalizadas.

<!-- ## Vendored dependencies -->

## Dependências incluídas no projeto {#vendored-dependencies}

<!--
If the dependency is not built by Playground, vendor the source under your
extension directory and build it with Emscripten before the extension is linked.
Paths from `--source` are available under `/build` inside the helper container:
-->

Se a dependência não é compilada pelo Playground, copie o código-fonte dela para dentro do diretório
da sua extensão e compile-o com o Emscripten antes de vincular a extensão.
Os caminhos de `--source` ficam disponíveis em `/build` dentro do contêiner da ferramenta:

```bash
npx @php-wasm/compile-extension \
	--source ./external-lib-probe \
	--name external_lib_probe \
	--php-versions 8.4 \
	--extra-cflags "-I/build/vendor/string-score/install/include" \
	--extra-ldflags "/build/vendor/string-score/install/lib/libstring_score.a"
```

<!--
`--extra-cflags` is visible during `./configure`. `--extra-ldflags` is applied
to the final side-module link so dependency archives do not break Autoconf's
compiler smoke tests.
-->

O `--extra-cflags` fica visível durante o `./configure`. O `--extra-ldflags` só é aplicado
na vinculação final do side module, para que os arquivos das dependências não quebrem os
testes rápidos de compilador do Autoconf.

<!-- ## Prebuilt static archives -->

## Arquivos estáticos pré-compilados {#prebuilt-static-archives}

<!--
Use `--extra-ldflags` to link prebuilt static archives such as a Rust
`staticlib`. The helper detects `.a` entries in `--extra-ldflags` and
force-links them into the final side module with `--whole-archive`.
-->

Use o `--extra-ldflags` para vincular arquivos estáticos pré-compilados, como uma
`staticlib` do Rust. A ferramenta detecta as entradas `.a` no `--extra-ldflags` e
força a vinculação delas no side module final com `--whole-archive`.

```bash
npx @php-wasm/compile-extension \
	--source ./my-rust-extension \
	--name my_rust_extension \
	--php-versions 8.4 \
	--extra-cflags "-I/build/include" \
	--extra-ldflags "/build/target/wasm32-unknown-emscripten/release/libmy_rust_extension.a"
```

<!--
The extension still needs a small `phpize` wrapper. A common Rust pattern is:
-->

A extensão ainda precisa de um pequeno wrapper `phpize`. Um padrão comum em Rust é:

<!--
- `config.m4` declares the PHP extension and builds a tiny C shim with
  `PHP_NEW_EXTENSION`.
- `_shim.c` defines the PHP module entry and calls exported Rust functions over
  C ABI.
- `--extra-ldflags` points at the Rust `staticlib` archive under `/build`.
-->

- O `config.m4` declara a extensão PHP e compila um pequeno shim em C com
  `PHP_NEW_EXTENSION`.
- O `_shim.c` define a entrada do módulo PHP e chama as funções exportadas pelo Rust pela
  ABI do C.
- O `--extra-ldflags` aponta para o arquivo `staticlib` do Rust em `/build`.

<!--
Do not use `PHP_ADD_LIBRARY_WITH_PATH` for a sibling `.a` archive in
`config.m4`. PHP's libtool setup can look for a matching `.so`, fail to link
the archive into the side module, and still leave a build artifact behind. Pass
static archives through `--extra-ldflags` instead.
-->

Não use `PHP_ADD_LIBRARY_WITH_PATH` para um arquivo `.a` na mesma pasta no
`config.m4`. A configuração do libtool do PHP pode procurar um `.so` correspondente, não vincular
o arquivo ao side module e mesmo assim deixar um artefato de build para trás. Em vez disso, passe
os arquivos estáticos pelo `--extra-ldflags`.

<!-- ## CMake dependencies -->

## Dependências com CMake {#cmake-dependencies}

<!--
Build CMake dependencies as static archives with Emscripten and store the
install tree under the extension source directory:
-->

Compile as dependências que usam CMake como arquivos estáticos com o Emscripten e guarde a
árvore de instalação dentro do diretório de código-fonte da extensão:

```bash
source /root/emsdk/emsdk_env.sh

emcmake cmake \
	-S vendor/libfoo \
	-B vendor/libfoo/build \
	-DCMAKE_BUILD_TYPE=Release \
	-DCMAKE_INSTALL_PREFIX="$PWD/vendor/libfoo/install" \
	-DBUILD_SHARED_LIBS=OFF

emmake cmake --build vendor/libfoo/build --target install

npx @php-wasm/compile-extension \
	--source . \
	--name my_extension \
	--php-versions 8.4 \
	--extra-cflags "-I/build/vendor/libfoo/install/include" \
	--extra-ldflags "/build/vendor/libfoo/install/lib/libfoo.a"
```

<!-- ## Makefile dependencies -->

## Dependências com Makefile {#makefile-dependencies}

<!--
Force Makefile dependencies to use Emscripten tools:
-->

Force as dependências que usam Makefile a usar as ferramentas do Emscripten:

```bash
source /root/emsdk/emsdk_env.sh

emmake make -C vendor/libfoo \
	CC=emcc \
	CXX=em++ \
	AR=emar \
	RANLIB=emranlib \
	PREFIX="$PWD/vendor/libfoo/install" \
	install

npx @php-wasm/compile-extension \
	--source . \
	--name my_extension \
	--php-versions 8.4 \
	--extra-cflags "-I/build/vendor/libfoo/install/include" \
	--extra-ldflags "/build/vendor/libfoo/install/lib/libfoo.a"
```

<!--
The final PHP extension still needs a `phpize` build recipe. If the extension
itself is CMake-only or Makefile-only, add a thin `config.m4` wrapper that
builds the PHP extension and treats the CMake or Make output as dependency
code.
-->

A extensão PHP final ainda precisa de uma receita de build `phpize`. Se a própria extensão
só tem CMake ou só tem Makefile, adicione um `config.m4` simples como wrapper, que
compila a extensão PHP e trata a saída do CMake ou do Make como código de
dependência.

<!-- ## Rust build systems -->

## Sistemas de build do Rust {#rust-build-systems}

<!--
The helper image includes a host `php` CLI because `ext-php-rs` and similar
build systems often shell out to `php` for version detection. The host CLI is
only for build scripts. The compiled extension must still link against the
PHP.wasm headers and side-module ABI.
-->

A imagem da ferramenta inclui uma CLI `php` nativa, porque o `ext-php-rs` e sistemas de build
parecidos costumam chamar o `php` no shell para detectar a versão. Essa CLI nativa serve
só para os scripts de build. A extensão compilada ainda precisa ser vinculada aos headers do
PHP.wasm e à ABI de side module.

<!--
Rust extensions that use `bindgen` need the same target, sysroot, and Zend
defines as PHP.wasm. The helper exports `BINDGEN_EXTRA_CLANG_ARGS` with:
-->

Extensões em Rust que usam o `bindgen` precisam do mesmo alvo, do mesmo sysroot e dos mesmos defines
do Zend que o PHP.wasm. A ferramenta exporta `BINDGEN_EXTRA_CLANG_ARGS` com:

```bash
--target=wasm32-unknown-emscripten \
--sysroot=$EMSDK_SYSROOT \
-DZEND_ENABLE_ZVAL_LONG64 \
-D__x86_64__
```

<!--
If you build the Rust archive outside the helper container, set the same value
before running `cargo`.
-->

Se você compila o arquivo Rust fora do contêiner da ferramenta, defina o mesmo valor
antes de rodar o `cargo`.

<!--
Rust `cc-rs` build scripts also need position-independent objects for side
module linking. The helper exports target-specific compiler variables including
`CFLAGS_wasm32_unknown_emscripten=-fPIC` and
`CXXFLAGS_wasm32_unknown_emscripten=-fPIC`. Without `-fPIC`, the final link can
fail with an error like:
-->

Os scripts de build `cc-rs` do Rust também precisam de objetos independentes de posição para a
vinculação do side module. A ferramenta exporta variáveis de compilador específicas do alvo, entre elas
`CFLAGS_wasm32_unknown_emscripten=-fPIC` e
`CXXFLAGS_wasm32_unknown_emscripten=-fPIC`. Sem `-fPIC`, a vinculação final pode
falhar com um erro como:

```text
R_WASM_MEMORY_ADDR_SLEB cannot be used against symbol ...; recompile with -fPIC
```

<!--
Rust's precompiled `std` for `wasm32-unknown-emscripten` is built with
unwinding support. That imports a `__cpp_exception` WebAssembly tag that
PHP.wasm does not export. Build Rust static libraries with `panic=abort` and a
nightly rebuilt standard library:
-->

A `std` pré-compilada do Rust para `wasm32-unknown-emscripten` é compilada com
suporte a unwinding. Isso importa uma tag WebAssembly `__cpp_exception` que o
PHP.wasm não exporta. Compile as bibliotecas estáticas do Rust com `panic=abort` e uma
biblioteca padrão recompilada no nightly:

```bash
RUSTFLAGS="-C panic=abort" cargo +nightly build \
	--release \
	--target wasm32-unknown-emscripten \
	-Zbuild-std=std,panic_abort
```

<!--
Link the resulting `lib*.a` with `--extra-ldflags`.
-->

Vincule o `lib*.a` resultante com `--extra-ldflags`.

<!-- ### PHP version support for `ext-php-rs` -->

### Versões do PHP suportadas pelo `ext-php-rs` {#php-version-support-for-ext-php-rs}

<!--
`ext-php-rs` `0.15` depends on PHP 8 Zend APIs and does not compile against
PHP `7.4` headers. Rust extensions built on top of `ext-php-rs` `0.15` should
restrict the PHP matrix to `8.0` through `8.5`:
-->

O `ext-php-rs` `0.15` depende das APIs do Zend do PHP 8 e não compila com os
headers do PHP `7.4`. Extensões em Rust construídas sobre o `ext-php-rs` `0.15` devem
limitar a matriz do PHP às versões de `8.0` a `8.5`:

```bash
npx @php-wasm/compile-extension \
	--source ./my-rust-extension \
	--name my_rust_extension \
	--php-versions 8.0,8.1,8.2,8.3,8.4,8.5 \
	--extra-ldflags "/build/target/wasm32-unknown-emscripten/release/libmy_rust_extension.a"
```

<!--
The helper itself still supports PHP `7.4`. The limitation is in the Rust
binding layer, not in the WebAssembly side-module ABI. Hand-written Rust
extensions that bind Zend directly through `bindgen` can target PHP `7.4` if
the C ABI shim does the same.
-->

A ferramenta em si continua suportando o PHP `7.4`. A limitação está na camada de bindings
do Rust, não na ABI de side module do WebAssembly. Extensões em Rust escritas à mão que fazem
bindings diretos com o Zend pelo `bindgen` podem ter o PHP `7.4` como alvo, se
o shim da ABI do C fizer o mesmo.

<!--
`ext-php-rs` also generates bindings for one PHP version at a time. When you
build the same Rust crate for several PHP versions, rebuild the staticlib for
each PHP version with that version's Zend API number visible to the build
script, and link the matching archive into each `--php-versions` lane.
-->

O `ext-php-rs` também gera bindings para uma versão do PHP por vez. Ao compilar
o mesmo crate Rust para várias versões do PHP, recompile a staticlib para
cada versão do PHP com o número da API do Zend dessa versão visível para o script
de build, e vincule o arquivo correspondente em cada versão de `--php-versions`.

<!-- ## Troubleshooting -->

## Solução de problemas {#troubleshooting}

`configure: error: ... not found`

<!--
The dependency headers or libraries are not visible inside the container. Use
paths under `/build` for files copied from `--source`, or
`/php-wasm-compile/<dependency>/<mode>/dist/root/lib` for Playground-built
dependencies.
-->

Os headers ou as bibliotecas da dependência não estão visíveis dentro do contêiner. Use
caminhos em `/build` para os arquivos copiados de `--source`, ou
`/php-wasm-compile/<dependency>/<mode>/dist/root/lib` para as dependências compiladas
pelo Playground.

<!--
`undefined symbol` when loading the extension
-->

`undefined symbol` ao carregar a extensão

<!--
The extension references a function that is not exported by the PHP main module
or was not linked from a WebAssembly dependency archive. Add the dependency
archive to `--extra-ldflags`, or rebuild the main PHP.wasm runtime if the
symbol must come from PHP core.
-->

A extensão faz referência a uma função que não é exportada pelo módulo principal do PHP
ou que não foi vinculada a partir do arquivo de uma dependência WebAssembly. Adicione o arquivo
da dependência ao `--extra-ldflags`, ou recompile o runtime principal do PHP.wasm se o
símbolo precisa vir do núcleo do PHP.

<!--
`WebAssembly.LinkError` or startup crashes
-->

`WebAssembly.LinkError` ou falhas na inicialização

<!--
Check that the extension loads in a JSPI runtime. The custom extension helper
does not build Asyncify artifacts.
-->

Confira se a extensão é carregada em um runtime JSPI. A ferramenta de extensões personalizadas
não compila artefatos Asyncify.

<!--
`wasm-ld: unknown file type` or `file not recognized`
-->

`wasm-ld: unknown file type` ou `file not recognized`

<!--
One of the linked libraries is a native host library. Rebuild that dependency
with Emscripten and link the resulting `.a` file.
-->

Uma das bibliotecas vinculadas é uma biblioteca nativa do sistema. Recompile essa dependência
com o Emscripten e vincule o arquivo `.a` resultante.

`R_WASM_MEMORY_ADDR_SLEB cannot be used against symbol`

<!--
A C or C++ object in a static archive was not compiled as position-independent
code. Rebuild it with `-fPIC`, or make sure Rust `cc-rs` sees
`CFLAGS_wasm32_unknown_emscripten=-fPIC`.
-->

Um objeto C ou C++ em um arquivo estático não foi compilado como código independente
de posição. Recompile-o com `-fPIC` ou garanta que o `cc-rs` do Rust enxergue
`CFLAGS_wasm32_unknown_emscripten=-fPIC`.

<!--
`__cpp_exception` is undefined when loading a Rust extension
-->

`__cpp_exception` indefinido ao carregar uma extensão em Rust

<!--
The Rust archive was built against an unwinding `std`. Rebuild it with
`RUSTFLAGS="-C panic=abort"` and
`cargo +nightly build -Zbuild-std=std,panic_abort`.
-->

O arquivo Rust foi compilado com uma `std` que usa unwinding. Recompile-o com
`RUSTFLAGS="-C panic=abort"` e
`cargo +nightly build -Zbuild-std=std,panic_abort`.

<!--
`bad export type for 'stdin'` or another C runtime global
-->

`bad export type for 'stdin'` ou outra variável global do runtime do C

<!--
The side module pulled in a dependency object that expects a mutable C runtime
global the main PHP.wasm module does not export. Rebuild the dependency with
the unused feature disabled, link a smaller archive that excludes that object,
or move the dependency into the main PHP.wasm build so the global is provided
by the runtime.
-->

O side module trouxe um objeto de dependência que espera uma variável global mutável do runtime do C
que o módulo principal do PHP.wasm não exporta. Recompile a dependência com
o recurso não usado desativado, vincule um arquivo menor que não inclua esse objeto
ou mova a dependência para o build principal do PHP.wasm, para que a variável global seja fornecida
pelo runtime.

<!--
`phpize` cannot find headers
-->

`phpize` não encontra os headers

<!--
The helper image builds and installs a minimal matching PHP source tree before
running `phpize`. If an extension includes headers from optional PHP
extensions, copy or generate those headers in the Docker layer or include them
in the extension source.
-->

A imagem da ferramenta compila e instala uma árvore mínima de código-fonte do PHP correspondente antes
de rodar o `phpize`. Se uma extensão inclui headers de extensões PHP opcionais,
copie ou gere esses headers na camada do Docker ou inclua-os
no código-fonte da extensão.
