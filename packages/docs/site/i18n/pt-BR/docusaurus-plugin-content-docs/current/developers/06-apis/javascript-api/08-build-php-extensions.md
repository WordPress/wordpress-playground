---
title: Compilando extensões PHP
slug: /developers/apis/javascript-api/build-php-extensions
description: Compile diretórios de código-fonte de extensões PHP em artefatos .so e manifestos para o PHP.wasm.
---

<!-- # Building PHP extensions -->

# Compilando extensões PHP

<!--
Use `@php-wasm/compile-extension` when you have a `phpize` extension source
directory and want a distributable PHP.wasm `.so` plus a manifest that
`loadNodeRuntime()` and `loadWebRuntime()` can load before PHP starts.
-->

Use o `@php-wasm/compile-extension` quando você tiver o diretório de código-fonte de uma extensão
`phpize` e quiser um `.so` do PHP.wasm para distribuir, junto com um manifesto que
`loadNodeRuntime()` e `loadWebRuntime()` possam carregar antes de o PHP iniciar.

<!--
The source directory must contain a normal PHP extension build recipe, usually
`config.m4` and the C or C++ files referenced from it.
-->

O diretório de código-fonte precisa conter uma receita de build normal de extensão PHP, geralmente
o `config.m4` e os arquivos C ou C++ referenciados por ele.

```bash
npx @php-wasm/compile-extension \
	--source ./wp-mysql-parser \
	--name wp_mysql_parser \
	--php-versions 8.4 \
	--out ./dist/wp_mysql_parser
```

<!--
Docker is required. The helper reuses the PHP.wasm compile image, builds a
matching PHP source tree, and runs `phpize`, `emconfigure`, and `emmake` with
the side-module flags expected by PHP.wasm.
-->

É preciso ter Docker. A ferramenta reaproveita a imagem de compilação do PHP.wasm, monta uma
árvore de código-fonte do PHP correspondente e executa `phpize`, `emconfigure` e `emmake` com
as flags de side module que o PHP.wasm espera.

<!--
Custom extensions are built for JSPI runtimes. The helper does not build
Asyncify side modules.
-->

As extensões personalizadas são compiladas para runtimes JSPI. A ferramenta não compila
side modules Asyncify.

<!-- ## Output -->

## Saída {#output}

<!--
The output directory contains one JSPI artifact for each PHP version plus
`manifest.json`:
-->

O diretório de saída contém um artefato JSPI para cada versão do PHP, além do
`manifest.json`:

```text
dist/wp_mysql_parser/
|-- manifest.json
`-- wp_mysql_parser-php8.4-jspi.so
```

<!--
The manifest matches the `PHPExtensionManifest` shape from
`@php-wasm/universal`. It records the extension name, the artifact matrix,
and a `sourcePath` for each artifact relative to the manifest URL:
-->

O manifesto segue o formato `PHPExtensionManifest` do
`@php-wasm/universal`. Ele registra o nome da extensão, a matriz de artefatos
e um `sourcePath` para cada artefato, relativo à URL do manifesto:

```json
{
	"name": "wp_mysql_parser",
	"version": "0.1.0",
	"artifacts": [
		{
			"phpVersion": "8.4",
			"sourcePath": "wp_mysql_parser-php8.4-jspi.so"
		}
	]
}
```

<!--
Host the whole output directory from the same static location. Relative
artifact paths are resolved from the manifest URL.
-->

Hospede o diretório de saída inteiro no mesmo local estático. Os caminhos relativos
dos artefatos são resolvidos a partir da URL do manifesto.

<!-- ### Sidecar files -->

### Arquivos auxiliares {#sidecar-files}

<!--
Pass `--extra-files <hostDir>:<vfsRoot>` to stage data directories, web UI
assets, ICU data, or anything else the extension needs at runtime. The host
directory is copied next to the manifest, and each entry is recorded under
`extraFiles.nodes` with a `vfsPath` relative to `vfsRoot` and a `sourcePath`
relative to the manifest URL:
-->

Passe `--extra-files <hostDir>:<vfsRoot>` para incluir diretórios de dados, arquivos de interface web,
dados do ICU ou qualquer outra coisa de que a extensão precise em tempo de execução. O diretório
do host é copiado ao lado do manifesto, e cada entrada é registrada em
`extraFiles.nodes` com um `vfsPath` relativo a `vfsRoot` e um `sourcePath`
relativo à URL do manifesto:

```bash
npx @php-wasm/compile-extension \
	--source ./spx-src \
	--name spx \
	--php-versions 8.2 \
	--extra-files ./web-ui:/internal/shared/spx \
	--out ./dist/spx
```

<!--
Empty directories are recorded as `type: "directory"` nodes so the loader
creates them before PHP starts. Multiple `--extra-files` entries are
allowed, but they must agree on `vfsRoot` — the manifest format stores a
single root per group.
-->

Diretórios vazios são registrados como nós `type: "directory"`, para que o carregador
os crie antes de o PHP iniciar. É possível passar várias entradas `--extra-files`,
mas todas precisam usar o mesmo `vfsRoot`, porque o formato do manifesto guarda
uma única raiz por grupo.

<!-- ## Loading in Node.js -->

## Carregando no Node.js {#loading-in-nodejs}

<!-- Pass the manifest to the startup-time `extensions` option: -->

Passe o manifesto para a opção `extensions`, usada na inicialização:

```ts
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(
	await loadNodeRuntime('8.4', {
		extensions: [
			{
				source: {
					format: 'manifest',
					manifestUrl: './dist/wp_mysql_parser/manifest.json',
				},
			},
		],
	})
);
```

<!--
Node.js accepts local paths, `file:` URLs, and HTTP(S) URLs for `manifestUrl`.
The loader selects the artifact whose `phpVersion` matches the runtime,
stages the `.so`, copies any `extraFiles` declared in the manifest, writes a
generated `.ini` file, and starts PHP with the extension scan directory
configured.
-->

O Node.js aceita caminhos locais, URLs `file:` e URLs HTTP(S) em `manifestUrl`.
O carregador escolhe o artefato cujo `phpVersion` corresponde ao runtime,
prepara o `.so`, copia os `extraFiles` declarados no manifesto, grava um
arquivo `.ini` gerado e inicia o PHP com o diretório de busca de extensões
configurado.

<!-- ## Loading in the browser -->

## Carregando no navegador {#loading-in-the-browser}

<!-- In the browser, host the output directory and pass an absolute URL: -->

No navegador, hospede o diretório de saída e passe uma URL absoluta:

```ts
import { PHP } from '@php-wasm/universal';
import { loadWebRuntime } from '@php-wasm/web';

const php = new PHP(
	await loadWebRuntime('8.4', {
		extensions: [
			{
				source: {
					format: 'manifest',
					manifestUrl: new URL('/extensions/wp_mysql_parser/manifest.json', location.href),
				},
			},
		],
	})
);
```

<!--
Serve the `.so` artifacts with a static-file server that permits cross-origin
requests from the page that creates the runtime.
-->

Sirva os artefatos `.so` com um servidor de arquivos estáticos que permita requisições
de outra origem vindas da página que cria o runtime.

<!-- ## Direct artifacts -->

## Artefatos diretos {#direct-artifacts}

<!--
Use a manifest when you publish a matrix. If the caller already picked the
artifact, use `format: 'url'` instead:
-->

Use um manifesto quando publicar uma matriz. Se quem chama já escolheu o
artefato, use `format: 'url'`:

```ts
await loadWebRuntime('8.4', {
	extensions: [
		{
			source: {
				format: 'url',
				name: 'wp_mysql_parser',
				url: new URL('https://cdn.example.com/wp_mysql_parser-php8.4-jspi.so'),
			},
		},
	],
});
```

<!-- ## Compatibility -->

## Compatibilidade {#compatibility}

<!--
Build every PHP version you plan to support. A `.so` built for PHP 8.4 cannot
be loaded into PHP 8.3. Custom extension artifacts are JSPI-only and must be
loaded by a JSPI runtime.
-->

Compile para cada versão do PHP que você pretende suportar. Um `.so` compilado para o PHP 8.4 não pode
ser carregado no PHP 8.3. Os artefatos de extensões personalizadas são só JSPI e precisam ser
carregados por um runtime JSPI.

<!--
The helper supports PHP `7.4` and `8.0` through `8.5`. Pass the matrix as a
comma-separated list:
-->

A ferramenta suporta o PHP `7.4` e do `8.0` ao `8.5`. Passe a matriz como uma
lista separada por vírgulas:

```bash
npx @php-wasm/compile-extension \
	--source ./wp-mysql-parser \
	--name wp_mysql_parser \
	--php-versions 8.0,8.1,8.2,8.3,8.4,8.5 \
	--out ./dist/wp_mysql_parser
```

<!--
Extension loading is startup-only. Declare custom extensions in the
`extensions` option before the runtime is created.
-->

As extensões só são carregadas na inicialização. Declare as extensões personalizadas na
opção `extensions` antes de criar o runtime.

<!-- ## Running the helper in CI -->

## Rodando a ferramenta na CI {#running-the-helper-in-ci}

<!--
The helper is published as `@php-wasm/compile-extension` on npm and only
needs Docker and Node. A typical GitHub Actions job:
-->

A ferramenta é publicada no npm como `@php-wasm/compile-extension` e só
precisa de Docker e Node. Um job típico do GitHub Actions:

```yaml
- uses: actions/checkout@v4

- uses: actions/setup-node@v4
  with:
    node-version: '24'

- name: Build the extension matrix
  run: |
    npx --yes @php-wasm/compile-extension \
      --source ./my-extension \
      --name my_extension \
      --php-versions 8.0,8.1,8.2,8.3,8.4,8.5 \
      --out ./dist/my-extension
```

<!--
When you build the matrix in GitHub Actions, set `strategy.max-parallel: 1`
on the WASM job. Parallel Docker builds on hosted runners frequently hit
apt-mirror flakes during the base image build.
-->

Ao compilar a matriz no GitHub Actions, defina `strategy.max-parallel: 1`
no job do WASM. Builds Docker em paralelo nos runners hospedados costumam falhar
de forma intermitente nos espelhos do apt durante o build da imagem base.

<!--
For native dependencies, see
[PHP extension dependencies](/developers/apis/javascript-api/php-extension-dependencies).
-->

Para dependências nativas, consulte
[Dependências de extensões PHP](/developers/apis/javascript-api/php-extension-dependencies).
