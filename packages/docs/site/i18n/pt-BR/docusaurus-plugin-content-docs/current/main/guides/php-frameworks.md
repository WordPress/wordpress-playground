---
title: Executando frameworks PHP no Playground
slug: /guides/php-frameworks
description: Use o WordPress Playground como um ambiente de execução PHP no navegador para frameworks e aplicações que não são WordPress.
sidebar_class_name: navbar-build-item
---

import { PhpCodeSnippetExample } from '@site/src/components/PhpCodeSnippetLiveExample';

<!-- # Run PHP frameworks in Playground -->

# Executando frameworks PHP no Playground

<!--
WordPress Playground is also a browser-based PHP runtime. WordPress is the
most common app it boots, but a Blueprint can skip the WordPress download,
write any PHP files into the virtual filesystem, and run a framework such as
Symfony.
-->

O WordPress Playground também é um ambiente de execução PHP no navegador. O WordPress é a
aplicação mais comum que ele inicializa, mas um Blueprint pode pular o download do WordPress,
gravar quaisquer arquivos PHP no sistema de arquivos virtual e executar um framework como o
Symfony.

<!--
This guide shows the shape of that setup. Use it when you want a shareable demo,
a docs example, or a quick compatibility check for a PHP app that does not need
a server, database, Node.js, Sass, or a local Composer install.
-->

Este guia mostra como essa configuração funciona. Use-o quando quiser uma demonstração
compartilhável, um exemplo para documentação ou uma verificação rápida de compatibilidade de uma
aplicação PHP que não precisa de servidor, banco de dados, Node.js, Sass ou de uma instalação local
do Composer.

<!-- ## What changes when you skip WordPress -->

## O que muda quando você pula o WordPress

<!--
Set `preferredVersions.wp` to `false` in a Blueprint, or `wp="none"` on a
`<php-snippet>`. Playground still downloads PHP, mounts a writable filesystem,
runs Blueprint steps, and supports networking when `features.networking` is
`true`. It just does not download or boot WordPress.
-->

Defina `preferredVersions.wp` como `false` em um Blueprint, ou `wp="none"` em um
`<php-snippet>`. O Playground continua baixando o PHP, montando um sistema de arquivos gravável,
executando os passos do Blueprint e oferecendo acesso à rede quando `features.networking` é
`true`. Ele apenas não baixa nem inicializa o WordPress.

<!-- That makes Playground useful for generic PHP examples: -->

Isso torna o Playground útil para exemplos genéricos de PHP:

<!--
- PHP libraries that need a real filesystem.
- Framework demos that can run behind `public/index.php`.
- Documentation snippets that should execute in the browser.
- Reproducible bug reports for PHP code that is not WordPress-specific.
-->

- Bibliotecas PHP que precisam de um sistema de arquivos real.
- Demonstrações de frameworks que podem ser executadas a partir de `public/index.php`.
- Trechos de código da documentação que devem ser executados no navegador.
- Relatórios de bugs reproduzíveis para código PHP que não é específico do WordPress.

<!-- ## Try a Symfony app -->

## Experimente uma aplicação Symfony

<!--
The example below uses a Blueprint to download and unzip a bundled Symfony app
into `/app`. Then a `<php-snippet>` boots the Symfony kernel and renders the
dashboard route. The app's Composer dependencies include the WordPress HTML API,
so the snippet can read the `<h1>` with `WP_HTML_Processor` without installing or
booting WordPress.
-->

O exemplo abaixo usa um Blueprint para baixar e descompactar uma aplicação Symfony empacotada
em `/app`. Em seguida, um `<php-snippet>` inicializa o kernel do Symfony e renderiza a rota do
painel. As dependências do Composer da aplicação incluem a HTML API do WordPress, então o trecho
de código consegue ler o `<h1>` com `WP_HTML_Processor` sem instalar nem inicializar o WordPress.

<PhpCodeSnippetExample name="symfonyBlueprint" />

<!-- Here is the complete embed: -->

Aqui está o código de incorporação completo:

<!-- prettier-ignore-start -->

```html
<script type="module" src="https://playground.wordpress.net/php-code-snippet.js"></script>

<script id="symfony-blueprint" type="application/json">
{
  "features": {
    "networking": true
  },
  "steps": [
    {
      "step": "unzip",
      "zipFile": {
        "resource": "url",
        "url": "https://wordpress.github.io/blueprints/blueprints/symfony-package-radar/symfony-package-radar.zip?v=wp-php-toolkit-html-2026-06-09"
      },
      "extractToPath": "/app"
    }
  ]
}
</script>

<php-snippet name="run-symfony.php" wp="none" blueprint="symfony-blueprint">
  <script type="application/x-php">
<?php
require '/app/symfony-package-radar/vendor/autoload.php';

use App\Kernel;
use Symfony\Component\HttpFoundation\Request;

$kernel = new Kernel( 'prod', false );
$request = Request::create( '/' );
$response = $kernel->handle( $request );

$page_title = get_first_h1_text( $response->getContent() );

echo 'HTTP ' . $response->getStatusCode() . PHP_EOL;
echo 'Symfony page: ' . $page_title . PHP_EOL;
echo 'WordPress installed: ';
echo file_exists( '/wordpress/wp-load.php' ) ? 'yes' : 'no';

$kernel->terminate( $request, $response );

/**
 * The app's Composer dependencies include the WordPress HTML API, so the
 * snippet can read the <h1> with WP_HTML_Processor without installing or
 * booting WordPress.
 */
function get_first_h1_text( string $html ): string {
	$processor = WP_HTML_Processor::create_fragment( $html );
	if ( ! $processor->next_tag( 'H1' ) ) {
		return 'unknown';
	}

	$text = '';
	while ( $processor->next_token() ) {
		if ( 'H1' === $processor->get_tag() && $processor->is_tag_closer() ) {
			break;
		}
		if ( '#text' === $processor->get_token_type() ) {
			$text .= $processor->get_modifiable_text();
		}
	}

	return trim( $text );
}
  </script>
  <script type="text/expected-output">
HTTP 200
Symfony page: Symfony Playground
WordPress installed: no
  </script>
</php-snippet>
```

<!-- prettier-ignore-end -->

<!-- The same app is also available as a full Playground page: -->

A mesma aplicação também está disponível como uma página completa do Playground:

<!-- [Open the Symfony Package Radar demo](https://playground.wordpress.net/?blueprint-url=https%3A%2F%2Fwordpress.github.io%2Fblueprints%2Fblueprints%2Fsymfony-package-radar%2Fblueprint.json) -->

[Abrir a demonstração Symfony Package Radar](https://playground.wordpress.net/?blueprint-url=https%3A%2F%2Fwordpress.github.io%2Fblueprints%2Fblueprints%2Fsymfony-package-radar%2Fblueprint.json)

<!-- ## Package the app as a ZIP -->

## Empacote a aplicação como um ZIP

<!--
For framework demos, prefer a ZIP that already contains `vendor/`. That keeps
the Playground startup path short and avoids asking every visitor to wait for
Composer, Git, and package registry downloads. The Symfony demo uses that path to
bundle both Symfony and a Composer-installed copy of the WordPress HTML API; it
still does not include a WordPress install.
-->

Para demonstrações de frameworks, prefira um ZIP que já contenha a pasta `vendor/`. Isso mantém a
inicialização do Playground rápida e evita que cada visitante precise esperar por downloads do
Composer, do Git e de registros de pacotes. A demonstração do Symfony usa essa abordagem para
empacotar tanto o Symfony quanto uma cópia da HTML API do WordPress instalada via Composer; ainda
assim, ela não inclui uma instalação do WordPress.

<!--
For snippets or CLI runs, a small Blueprint can install the app into `/app` with
one step:
-->

Para trechos de código ou execuções pela CLI, um pequeno Blueprint pode instalar a aplicação em
`/app` com um único passo:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/symfony-package-radar/public/index.php",
	"preferredVersions": {
		"php": "8.4",
		"wp": false
	},
	"features": {
		"networking": true
	},
	"steps": [
		{
			"step": "unzip",
			"zipFile": {
				"resource": "bundled",
				"path": "./symfony-package-radar.zip"
			},
			"extractToPath": "/app"
		}
	]
}
```

<!--
Use `bundled` resources when the ZIP ships next to `blueprint.json`, or use a
`url` resource when the ZIP is hosted separately. See [Blueprint bundles](/blueprints/bundles)
for packaging details.
-->

Use recursos `bundled` quando o ZIP for distribuído junto ao `blueprint.json`, ou use um recurso
`url` quando o ZIP estiver hospedado separadamente. Consulte [Pacotes de Blueprint](/blueprints/bundles)
para mais detalhes sobre empacotamento.

<!--
For a full-page Playground website, use a Blueprint like the gallery demo. It
adds a tiny router at the Playground document root so the Symfony `public/`
directory can respond to browser requests.
-->

Para um site do Playground em página inteira, use um Blueprint como o da demonstração da galeria.
Ele adiciona um pequeno roteador na raiz de documentos do Playground para que o diretório `public/`
do Symfony possa responder às requisições do navegador.

<!-- ## Keep the demo browser-friendly -->

## Mantenha a demonstração compatível com o navegador

<!-- A Playground-hosted framework demo works best when it: -->

Uma demonstração de framework hospedada no Playground funciona melhor quando:

<!--
- Does not require a long-running background process.
- Stores generated files under the virtual filesystem.
- Avoids native extensions that are not compiled into PHP.wasm.
- Avoids frontend build steps at runtime.
- Keeps network calls optional or resilient, because browsers may require CORS
  proxying for third-party services.
-->

- Não exige um processo em segundo plano de longa duração.
- Armazena os arquivos gerados no sistema de arquivos virtual.
- Evita extensões nativas que não estão compiladas no PHP.wasm.
- Evita etapas de build do frontend em tempo de execução.
- Mantém as chamadas de rede opcionais ou resilientes, pois os navegadores podem exigir um proxy
  CORS para serviços de terceiros.

<!--
Those constraints still leave plenty of room for real framework behavior:
controllers, routing, dependency injection, templates, forms, HTTP clients, and
plain PHP libraries all work when their PHP dependencies are available.
-->

Essas restrições ainda deixam bastante espaço para o comportamento real de um framework:
controllers, roteamento, injeção de dependências, templates, formulários, clientes HTTP e
bibliotecas PHP comuns funcionam quando suas dependências PHP estão disponíveis.
