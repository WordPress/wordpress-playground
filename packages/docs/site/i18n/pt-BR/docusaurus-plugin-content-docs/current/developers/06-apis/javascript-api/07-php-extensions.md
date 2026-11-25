---
title: Carregando extensões PHP
slug: /developers/apis/javascript-api/php-extensions
description: Carregue extensões do PHP.wasm incluídas nos pacotes e externas nos runtimes do Node.js e do navegador.
---

<!-- # Loading PHP extensions -->

# Carregando extensões PHP

<!--
PHP reads extension declarations while it starts. In PHP.wasm, that means
extensions must be declared before `loadNodeRuntime()` or `loadWebRuntime()`
creates the runtime.
-->

O PHP lê as declarações de extensões durante a inicialização. No PHP.wasm, isso significa que
as extensões precisam ser declaradas antes de `loadNodeRuntime()` ou `loadWebRuntime()`
criar o runtime.

<!--
Use the `extensions` array for both bundled extensions and external `.so`
artifacts.
-->

Use o array `extensions` tanto para as extensões incluídas nos pacotes quanto para artefatos `.so`
externos.

<!--
Use external PHP.wasm extensions when the code that must be fast or native-like
is too hot for PHP userland, but you still want to ship it with a Playground
demo, CLI workflow, or embedded app. The same manifest can be loaded by the
JavaScript API, the Playground web Query API, and Playground CLI.
-->

Use extensões externas do PHP.wasm quando um código que precisa ser rápido ou parecido com o nativo
é executado com frequência demais para ficar em PHP comum, mas você ainda quer distribuí-lo com uma
demonstração do Playground, um fluxo de trabalho na CLI ou um app incorporado. O mesmo manifesto pode ser
carregado pela API JavaScript, pela Query API do Playground web e pelo Playground CLI.

<!--
External extensions are JSPI side modules. If the browser or Node.js build does
not expose JSPI, PHP.wasm rejects the extension request instead of starting
with a partially loaded runtime.
-->

As extensões externas são side modules JSPI. Se o navegador ou o build do Node.js
não expõe JSPI, o PHP.wasm rejeita o pedido da extensão em vez de iniciar
com um runtime carregado pela metade.

<!-- ## Bundled extensions -->

## Extensões incluídas {#bundled-extensions}

<!--
`@php-wasm/node` ships `intl`, `xdebug`, `redis`, and `memcached`:
-->

O `@php-wasm/node` inclui `intl`, `xdebug`, `redis` e `memcached`:

```ts
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(
	await loadNodeRuntime('8.4', {
		extensions: ['intl', 'redis', 'memcached', { name: 'xdebug', options: { ideKey: 'PLAYGROUND' } }],
	})
);
```

<!--
`@php-wasm/web` currently ships `intl`:
-->

O `@php-wasm/web` inclui atualmente o `intl`:

```ts
import { PHP } from '@php-wasm/universal';
import { loadWebRuntime } from '@php-wasm/web';

const php = new PHP(
	await loadWebRuntime('8.4', {
		extensions: ['intl'],
	})
);
```

<!--
The old `withIntl`, `withXdebug`, `withRedis`, and `withMemcached` options are
still accepted where they already existed. New code should use `extensions`
because it also supports external extensions.
-->

As opções antigas `withIntl`, `withXdebug`, `withRedis` e `withMemcached`
continuam aceitas onde já existiam. Código novo deve usar `extensions`,
porque essa opção também suporta extensões externas.

<!--
Each extension ships its own ini file, which PHP reads after `php.ini`. To
change a setting an extension sets itself, such as `xdebug.mode`, pass the
extension's ini file path to `setPhpIniEntries()` — see
[Tracing and Profiling with Xdebug](/developers/xdebug/trace-and-profile).
-->

Cada extensão vem com o próprio arquivo ini, que o PHP lê depois do `php.ini`. Para
alterar uma configuração que a própria extensão define, como `xdebug.mode`, passe o caminho do
arquivo ini da extensão para `setPhpIniEntries()`. Consulte
[Trace e profiling com Xdebug](/developers/xdebug/trace-and-profile).

<!-- ## External extensions -->

## Extensões externas {#external-extensions}

<!--
An external extension needs a WebAssembly `.so` built for the same PHP version
as the PHP.wasm JSPI runtime. Publish the artifact with a manifest:
-->

Uma extensão externa precisa de um `.so` WebAssembly compilado para a mesma versão do PHP
do runtime JSPI do PHP.wasm. Publique o artefato com um manifesto:

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
`sourcePath` may be an absolute URL or a path relative to the manifest URL. If
the manifest lives at
`https://cdn.example.com/extensions/wp_mysql_parser/manifest.json`, the
`sourcePath` above resolves to
`https://cdn.example.com/extensions/wp_mysql_parser/wp_mysql_parser-php8.4-jspi.so`.
-->

O `sourcePath` pode ser uma URL absoluta ou um caminho relativo à URL do manifesto. Se
o manifesto estiver em
`https://cdn.example.com/extensions/wp_mysql_parser/manifest.json`, o
`sourcePath` acima aponta para
`https://cdn.example.com/extensions/wp_mysql_parser/wp_mysql_parser-php8.4-jspi.so`.

<!--
If the extension ships sidecar assets (UI files, data, empty directories), list
them under `extraFiles`. Each `node` declares its final VFS path as
`vfsRoot + vfsPath`:
-->

Se a extensão vem com arquivos auxiliares (arquivos de interface, dados, diretórios vazios), liste-os
em `extraFiles`. Cada `node` declara seu caminho final no VFS como
`vfsRoot + vfsPath`:

```json
{
	"name": "spx",
	"artifacts": [
		{
			"phpVersion": "8.4",
			"sourcePath": "spx-php8.4-jspi.so",
			"extraFiles": {
				"vfsRoot": "/internal/shared/spx",
				"nodes": [
					{ "vfsPath": "data", "type": "directory" },
					{ "vfsPath": "ui/index.html", "sourcePath": "ui/index.html" }
				]
			}
		}
	]
}
```

<!--
In Node.js, `manifestUrl` may be a local path, a `file:` URL, or an HTTP(S)
URL. Relative local paths are resolved from the current working directory:
-->

No Node.js, o `manifestUrl` pode ser um caminho local, uma URL `file:` ou uma URL
HTTP(S). Caminhos locais relativos são resolvidos a partir do diretório de trabalho atual:

```ts
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
Node.js applies the same local-path support to direct artifact URLs and inline
manifest `baseUrl` values.
-->

O Node.js aceita caminhos locais da mesma forma nas URLs diretas de artefatos e nos valores de
`baseUrl` de manifestos passados diretamente no código.

<!--
External extensions are only supported when JSPI is available. Asyncify support
is limited to the bundled extensions shipped with the PHP.wasm packages, such
as `intl`, `xdebug`, `redis`, and `memcached`.
-->

As extensões externas só são suportadas quando o JSPI está disponível. O suporte a Asyncify
se limita às extensões incluídas nos pacotes do PHP.wasm, como
`intl`, `xdebug`, `redis` e `memcached`.

<!--
In the browser, pass an absolute URL or construct one with the base URL you want:
-->

No navegador, passe uma URL absoluta ou monte uma com a URL base que você quiser:

```ts
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
If you already have the manifest object in memory, pass `baseUrl` so relative
artifact files can still be resolved:
-->

Se você já tem o objeto do manifesto em memória, passe `baseUrl` para que os arquivos de
artefato relativos ainda possam ser resolvidos:

```ts
await loadNodeRuntime('8.4', {
	extensions: [
		{
			source: {
				format: 'manifest',
				manifest,
				baseUrl: 'https://cdn.example.com/extensions/wp_mysql_parser/',
			},
		},
	],
});
```

<!--
If you already have the `.so` bytes, skip the manifest:
-->

Se você já tem os bytes do `.so`, dispense o manifesto:

```ts
await loadNodeRuntime('8.4', {
	extensions: [
		{
			name: 'wp_mysql_parser',
			source: {
				format: 'so',
				bytes,
			},
		},
	],
});
```

<!--
Use a direct artifact URL when the caller, not a manifest, chooses the artifact:
-->

Use uma URL direta de artefato quando quem escolhe o artefato é o código que chama, e não um manifesto:

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

<!-- ## Try published PHP.wasm extensions -->

## Experimente extensões do PHP.wasm já publicadas {#try-published-phpwasm-extensions}

<!--
Two projects publish ready-to-use manifests you can inspect before building
your own:
-->

Dois projetos publicam manifestos prontos para uso que você pode examinar antes de criar
o seu:

<!--
- [SQLite Database Integration native extension](https://wordpress.github.io/sqlite-database-integration/native-extension/)
  publishes `wp_mysql_parser`, a native lexer/parser used by the SQLite
  Database Integration plugin.
- [PHP Toolkit Native APIs WASM releases](https://wordpress.github.io/php-toolkit/wp_native_apis-wasm-extension/)
  publishes `wp_native_apis`, an experimental extension for WordPress native
  APIs.
-->

- A [extensão nativa do SQLite Database Integration](https://wordpress.github.io/sqlite-database-integration/native-extension/)
  publica o `wp_mysql_parser`, um lexer/parser nativo usado pelo plugin SQLite
  Database Integration.
- As [releases WASM das Native APIs do PHP Toolkit](https://wordpress.github.io/php-toolkit/wp_native_apis-wasm-extension/)
  publicam o `wp_native_apis`, uma extensão experimental para APIs nativas do
  WordPress.

<!--
To try a published extension in Playground web, pass its manifest URL with the
`php-extension` Query API parameter. This loads the extension before PHP starts,
without writing any JavaScript:
-->

Para experimentar uma extensão publicada no Playground web, passe a URL do manifesto dela no
parâmetro `php-extension` da Query API. Isso carrega a extensão antes de o PHP iniciar,
sem escrever nenhum JavaScript:

```text
https://playground.wordpress.net/?php=8.5&php-extension=https://wordpress.github.io/sqlite-database-integration/wp_mysql_parser-wasm-extension/latest/manifest.json
```

<!--
Use `/latest/manifest.json` for a quick demo. Use one of the pinned manifest
URLs from the extension release page for reproducible demos, tests, and
documentation links.
-->

Use `/latest/manifest.json` para uma demonstração rápida. Para demonstrações, testes e links
de documentação reproduzíveis, use uma das URLs de manifesto fixadas em uma versão,
listadas na página de releases da extensão.

<!--
Repeat the parameter to load more than one extension:
-->

Repita o parâmetro para carregar mais de uma extensão:

```text
https://playground.wordpress.net/?php=8.5&php-extension=https://example.com/one/manifest.json&php-extension=https://example.com/two/manifest.json
```

<!--
The Query API accepts absolute, root-relative, and page-relative manifest URLs.
After resolution, the manifest URL must use HTTP(S). For example, if your
Playground page is served from `https://example.com/tools/`, these are valid:
-->

A Query API aceita URLs de manifesto absolutas, relativas à raiz e relativas à página.
Depois de resolvida, a URL do manifesto precisa usar HTTP(S). Por exemplo, se a sua
página do Playground é servida a partir de `https://example.com/tools/`, estas são válidas:

```text
?php-extension=https://cdn.example.com/wp_mysql_parser/manifest.json
?php-extension=/extensions/wp_mysql_parser/manifest.json
?php-extension=./extensions/wp_mysql_parser/manifest.json
```

<!--
The same manifest-loading path is documented in the
[Query API reference](/developers/apis/query-api).
-->

O mesmo caminho de carregamento por manifesto está documentado na
[referência da Query API](/developers/apis/query-api).

<!--
The same manifest works in Playground CLI:
-->

O mesmo manifesto funciona no Playground CLI:

```bash
npx @wp-playground/cli@latest server \
	--php=8.5 \
	--php-extension=https://wordpress.github.io/sqlite-database-integration/wp_mysql_parser-wasm-extension/latest/manifest.json \
	--blueprint=https://wordpress.github.io/sqlite-database-integration/blueprint.json
```

<!--
When you embed Playground with `@wp-playground/client`, pass the same manifest
through the `extensions` option:
-->

Ao incorporar o Playground com o `@wp-playground/client`, passe o mesmo manifesto
pela opção `extensions`:

```html
<iframe id="wp"></iframe>
<script type="module">
	import { startPlaygroundWeb } from 'https://playground.wordpress.net/client/index.js';

	const client = await startPlaygroundWeb({
		iframe: document.getElementById('wp'),
		remoteUrl: 'https://playground.wordpress.net/remote.html',
		extensions: [
			{
				source: {
					format: 'manifest',
					manifestUrl: 'https://wordpress.github.io/sqlite-database-integration/wp_mysql_parser-wasm-extension/latest/manifest.json',
				},
			},
		],
	});

	await client.isReady();
</script>
```

<!--
Use the lower-level runtime API when you are building directly on
`@php-wasm/node` or `@php-wasm/web`:
-->

Use a API de runtime de nível mais baixo quando estiver construindo diretamente sobre o
`@php-wasm/node` ou o `@php-wasm/web`:

```ts
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(
	await loadNodeRuntime('8.5', {
		extensions: [
			{
				source: {
					format: 'manifest',
					manifestUrl: 'https://wordpress.github.io/sqlite-database-integration/wp_mysql_parser-wasm-extension/latest/manifest.json',
				},
			},
		],
	})
);
```

<!-- ## Build your own extension -->

## Compile a sua própria extensão {#build-your-own-extension}

<!--
`@php-wasm/compile-extension` turns a normal `phpize` extension directory into
JSPI `.so` artifacts and a loadable manifest:
-->

O `@php-wasm/compile-extension` transforma um diretório normal de extensão `phpize` em
artefatos `.so` JSPI e em um manifesto pronto para carregar:

```bash
npx @php-wasm/compile-extension \
	--source ./wp-mysql-parser \
	--name wp_mysql_parser \
	--php-versions 8.0,8.1,8.2,8.3,8.4,8.5 \
	--out ./dist/wp_mysql_parser
```

<!--
Host the whole output directory from one static location. The manifest lets the
runtime select the artifact that matches the active PHP version and load it
before PHP starts.
-->

Hospede todo o diretório de saída em um único local estático. O manifesto permite que o
runtime escolha o artefato que corresponde à versão do PHP em uso e o carregue
antes de o PHP iniciar.

<!-- ## Startup files -->

## Arquivos de inicialização {#startup-files}

<!--
PHP loads extensions from `.ini` files it reads during startup. PHP.wasm builds
those files from the extension request before the runtime starts:
-->

O PHP carrega as extensões a partir dos arquivos `.ini` que lê durante a inicialização. O PHP.wasm gera
esses arquivos a partir do pedido da extensão antes de o runtime iniciar:

```ini
extension=/internal/shared/extensions/my_extension.so
my_extension.option=value
```

<!--
`loadWithIniDirective` chooses the first line of that generated `.ini` file.
Regular PHP extensions use `extension`. Zend extensions such as Xdebug use
`zend_extension`:
-->

O `loadWithIniDirective` define a primeira linha desse arquivo `.ini` gerado.
Extensões PHP comuns usam `extension`. Extensões Zend, como o Xdebug, usam
`zend_extension`:

```ini
zend_extension=/internal/shared/extensions/xdebug.so
xdebug.mode=debug,develop
```

<!--
The remaining startup options describe what PHP.wasm writes before PHP starts:
-->

As demais opções de inicialização descrevem o que o PHP.wasm grava antes de o PHP iniciar:

<!--
- `iniEntries`: extra lines in the generated extension `.ini` file.
- `extraFiles`: sidecar files staged in the PHP virtual filesystem.
- `env`: environment variables set before PHP starts.
- `extensionDir`: the virtual directory for the `.so` and generated `.ini`
  files.
-->

- `iniEntries`: linhas extras no arquivo `.ini` gerado para a extensão.
- `extraFiles`: arquivos auxiliares colocados no sistema de arquivos virtual do PHP.
- `env`: variáveis de ambiente definidas antes de o PHP iniciar.
- `extensionDir`: o diretório virtual do `.so` e dos arquivos `.ini`
  gerados.

<!--
A Zend extension needs `zend_extension` and usually several `.ini` entries:
-->

Uma extensão Zend precisa de `zend_extension` e normalmente de várias entradas `.ini`:

```ts
await loadNodeRuntime('8.4', {
	extensions: [
		{
			name: 'my_debugger',
			loadWithIniDirective: 'zend_extension',
			iniEntries: {
				'my_debugger.mode': 'debug',
				'my_debugger.start_with_request': 'yes',
			},
			source: { format: 'so', bytes },
		},
	],
});
```

<!--
An extension with data files can stage them before PHP starts and point the
extension at their virtual path. `extraFiles` keys are absolute VFS paths:
-->

Uma extensão com arquivos de dados pode colocá-los no sistema de arquivos antes de o PHP iniciar e indicar
à extensão o caminho virtual deles. As chaves de `extraFiles` são caminhos absolutos no VFS:

```ts
await loadNodeRuntime('8.4', {
	extensions: [
		{
			name: 'my_text_extension',
			source: { format: 'so', bytes },
			env: {
				MY_TEXT_DATA: '/internal/shared/my_text_extension',
			},
			extraFiles: {
				files: {
					'/internal/shared/my_text_extension/data.bin': dataBytes,
				},
			},
		},
	],
});
```

<!-- ## Limits -->

## Limites {#limits}

<!--
Extension loading is startup-only. PHP.wasm writes a generated `.ini` file for
each extension, stages the `.so` and any sidecar files, updates
`PHP_INI_SCAN_DIR`, and then starts PHP. Loading an extension into an already
running PHP runtime with `dl()` is not supported by this API.
-->

As extensões só são carregadas na inicialização. O PHP.wasm grava um arquivo `.ini` gerado para
cada extensão, coloca no lugar o `.so` e os arquivos auxiliares, atualiza o
`PHP_INI_SCAN_DIR` e só então inicia o PHP. Esta API não permite carregar uma extensão em um
runtime PHP que já está em execução usando `dl()`.

<!--
Legacy PHP builds do not support extension loading. The runtime will reject
extension requests for those PHP versions instead of starting with a partially
loaded configuration.
-->

Os builds legados do PHP não suportam o carregamento de extensões. O runtime rejeita
pedidos de extensões para essas versões do PHP em vez de iniciar com uma configuração
carregada pela metade.
