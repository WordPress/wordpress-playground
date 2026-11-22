---
title: Trechos de código PHP e incorporações
slug: /guides/php-code-snippets
description: Incorpore exemplos de PHP e WordPress editáveis e executáveis em qualquer página web usando o web component <php-snippet>.
sidebar_class_name: navbar-build-item
---

import PhpCodeSnippetLiveExample, { PhpCodeSnippetExample } from '@site/src/components/PhpCodeSnippetLiveExample';

<!-- # PHP code snippets and embeds -->

# Trechos de código PHP e incorporações

<!--
Use `<php-snippet>` when you want readers to run PHP or WordPress code directly
from a docs page, tutorial, blog post, or demo. It renders a syntax-highlighted
code block with a Run button and starts a real Playground runtime only when the
reader asks for it.
-->

Use `<php-snippet>` quando quiser que os leitores executem código PHP ou WordPress diretamente
de uma página de documentação, tutorial, post de blog ou demonstração. Ele renderiza um bloco de
código com destaque de sintaxe e um botão Run, e só inicia um ambiente de execução real do
Playground quando o leitor pede.

<!--
The runtime is shared across matching snippets on the same page, so a tutorial
can include several runnable examples without starting WordPress over and over.
-->

O ambiente de execução é compartilhado entre trechos compatíveis na mesma página, então um
tutorial pode incluir vários exemplos executáveis sem iniciar o WordPress repetidas vezes.

<!-- ## Try it -->

## Experimente {#try-it}

<!--
The example below is editable and runnable. It also uses a Blueprint to install
a small mu-plugin before the snippet runs, so the PHP code can call a helper
function that did not exist in the default WordPress install.
-->

O exemplo abaixo é editável e executável. Ele também usa um Blueprint para instalar um pequeno
mu-plugin antes de o trecho ser executado, de modo que o código PHP pode chamar uma função
auxiliar que não existe na instalação padrão do WordPress.

<PhpCodeSnippetLiveExample />

<!-- Here is the complete embed: -->

Aqui está o código de incorporação completo:

```html
<script type="module" src="https://playground.wordpress.net/php-code-snippet.js"></script>

<script id="product-card-blueprint" type="application/json">
	{
		"steps": [
			{
				"step": "writeFile",
				"path": "/wordpress/wp-content/mu-plugins/product-cards.php",
				"data": "<?php\nfunction docs_render_product_card( array $product ): string {\n\treturn sprintf(\n\t\t'<article class=\"product-card\"><h3>%s</h3><p>$%0.2f</p></article>',\n\t\tesc_html( $product['name'] ),\n\t\t$product['price']\n\t);\n}\n"
			}
		]
	}
</script>

<php-snippet name="product-card.php" blueprint="product-card-blueprint">
	<script type="application/x-php">
		<?php
		require '/wordpress/wp-load.php';

		$products = [
			[
				'name'  => 'Canvas Tote',
				'price' => 24,
			],
			[
				'name'  => 'Coffee & Code Mug',
				'price' => 16.5,
			],
		];

		foreach ( $products as $product ) {
			echo docs_render_product_card( $product ) . "\n";
		}
	</script>
	<script type="text/expected-output">
		<article class="product-card"><h3>Canvas Tote</h3><p>$24.00</p></article>
		<article class="product-card"><h3>Coffee &amp; Code Mug</h3><p>$16.50</p></article>
	</script>
</php-snippet>
```

<!--
Use this pattern when each example should start from the same prepared site:
helper functions, mu-plugins, options, themes, demo files, or sample content.
-->

Use esse padrão quando cada exemplo precisar partir do mesmo site preparado: funções auxiliares,
mu-plugins, opções, temas, arquivos de demonstração ou conteúdo de exemplo.

<!-- ## Start with one snippet -->

## Comece com um trecho {#start-with-one-snippet}

<!--
For a basic runnable example, add the component script once and place PHP inside
`<php-snippet>`:
-->

Para um exemplo executável básico, adicione o script do componente uma única vez e coloque o PHP
dentro de `<php-snippet>`:

<PhpCodeSnippetExample name="hello" />

```html
<script type="module" src="https://playground.wordpress.net/php-code-snippet.js"></script>

<php-snippet name="hello.php">
	<script type="application/x-php">
		<?php
		echo 'Hello from PHP ' . phpversion();
	</script>
	<script type="text/expected-output">
		Hello from PHP 8.4.x
	</script>
</php-snippet>
```

<!--
The script itself is small. PHP, WordPress, and the WASM runtime are fetched
later, after the first Run click. The expected output appears before Run and is
replaced with the exact PHP version after execution.
-->

O script em si é pequeno. O PHP, o WordPress e o ambiente de execução WASM só são baixados
depois, após o primeiro clique em Run. A saída esperada aparece antes do Run e é substituída pela
versão exata do PHP após a execução.

<!-- ## Write PHP safely in HTML -->

## Escreva PHP com segurança no HTML {#write-php-safely-in-html}

<!--
Put inline PHP in a `<script type="application/x-php">` child. Browsers ignore
script tags with unknown types, which means PHP strings can contain HTML without
escaping every `<` character.
-->

Coloque o PHP inline em um elemento filho `<script type="application/x-php">`. Os navegadores
ignoram tags script com tipos desconhecidos, o que significa que strings PHP podem conter HTML sem
precisar escapar cada caractere `<`.

<PhpCodeSnippetExample name="htmlApi" />

```html
<php-snippet name="html-api.php">
	<script type="application/x-php">
		<?php
		require '/wordpress/wp-load.php';

		$html = '<img src="hero.jpg" alt="Hero">';
		$tags = new WP_HTML_Tag_Processor( $html );

		if ( $tags->next_tag( 'img' ) ) {
			$tags->set_attribute( 'loading', 'lazy' );
		}

		echo $tags->get_updated_html();
	</script>
	<script type="text/expected-output">
		<img src="hero.jpg" alt="Hero" loading="lazy">
	</script>
</php-snippet>
```

<!--
A literal `</script>` still closes the child script element, even when it is
inside a PHP string. Use JSON-encoded child payloads when the PHP source or
expected output contains that sequence:
-->

Um `</script>` literal ainda fecha o elemento script filho, mesmo quando está dentro de uma string
PHP. Use conteúdos filhos codificados em JSON quando o código PHP ou a saída esperada contiver essa
sequência:

```html
<php-snippet name="example.php">
	<script type="application/x-php+json">
		"\u003C?php\necho '\u003C/script\u003E';"
	</script>
	<script type="text/expected-output+json">
		"\u003C/script\u003E"
	</script>
</php-snippet>
```

<!--
Both payloads are parsed as JSON and must decode to strings; other JSON values
are rejected. Encode `<` as `\u003C` so the HTML parser never sees a literal
`</script>`. `JSON.stringify()` does not escape `<` by itself. The unencoded
`application/x-php` and `text/expected-output` types remain supported.
-->

Os dois conteúdos são interpretados como JSON e precisam resultar em strings; outros valores JSON
são rejeitados. Codifique `<` como `\u003C` para que o parser de HTML nunca veja um `</script>`
literal. O `JSON.stringify()` não escapa `<` por conta própria. Os tipos sem codificação
`application/x-php` e `text/expected-output` continuam sendo suportados.

<!--
Very short snippets can also be written as text, as long as PHP opening tags are
escaped:
-->

Trechos muito curtos também podem ser escritos como texto, desde que as tags de abertura do PHP
estejam escapadas:

<PhpCodeSnippetExample name="sum" />

```html
<php-snippet name="sum.php" expected-output="42"> &lt;?php echo 20 + 22; </php-snippet>
```

<!-- ## Use WordPress APIs -->

## Use as APIs do WordPress {#use-wordpress-apis}

<!--
Snippets run in a real WordPress installation by default. Load WordPress with
`require '/wordpress/wp-load.php'`, then call core APIs as usual.
-->

Por padrão, os trechos são executados em uma instalação real do WordPress. Carregue o WordPress
com `require '/wordpress/wp-load.php'` e depois chame as APIs do core normalmente.

<PhpCodeSnippetExample name="siteTitle" />

```html
<php-snippet name="site-title.php">
	<script type="application/x-php">
		<?php
		require '/wordpress/wp-load.php';

		update_option( 'blogname', 'Snippet Docs' );
		echo get_bloginfo( 'name' );
	</script>
	<script type="text/expected-output">
		Snippet Docs
	</script>
</php-snippet>
```

<!--
If your example is pure PHP and does not need WordPress, use `wp="none"` to skip
the WordPress download and boot step:
-->

Se o seu exemplo for PHP puro e não precisar do WordPress, use `wp="none"` para pular o download e
a inicialização do WordPress:

<PhpCodeSnippetExample name="purePhp" />

```html
<php-snippet name="pure-php.php" wp="none">
	<script type="application/x-php">
		<?php
		echo 'WordPress installed: ';
		echo file_exists( '/wordpress/wp-load.php' ) ? 'yes' : 'no';
	</script>
	<script type="text/expected-output">
		WordPress installed: no
	</script>
</php-snippet>
```

<!-- ### Automatically prepend a hidden PHP script -->

### Execute automaticamente um script PHP oculto antes do trecho {#automatically-prepend-a-hidden-php-script}

<!--
`auto-prepend-script` mirrors PHP's
[`auto_prepend_file`](https://www.php.net/manual/en/ini.core.php#ini.auto-prepend-file)
`php.ini` directive: the referenced PHP script runs before the snippet's main
file on every request. Unlike the PHP directive, the attribute takes the id or
CSS selector of an inert PHP `<script>` element. Use it when setup code should
not appear in the editable example:
-->

O atributo `auto-prepend-script` espelha a diretiva
[`auto_prepend_file`](https://www.php.net/manual/en/ini.core.php#ini.auto-prepend-file)
do `php.ini`: o script PHP referenciado é executado antes do arquivo principal do trecho em cada
requisição. Diferente da diretiva do PHP, o atributo recebe o id ou o seletor CSS de um elemento
PHP `<script>` inerte. Use-o quando o código de configuração não deve aparecer no exemplo
editável:

```html
<script id="load-wordpress" type="application/x-php">
	<?php
	require_once '/wordpress/wp-load.php';
</script>

<php-snippet name="site-title.php" auto-prepend-script="#load-wordpress" implicit-php-open-tag>
	<script type="application/x-php">
		echo get_bloginfo( 'name' );
	</script>
</php-snippet>
```

<!--
The referenced script must start with `<?php`. It remains outside the visible
editor and runs before every click, including after the reader edits the
snippet. Snippets with different auto-prepended scripts can still share one
runtime.
-->

O script referenciado precisa começar com `<?php`. Ele fica fora do editor visível e é executado
antes de cada clique, inclusive depois que o leitor edita o trecho. Trechos com scripts
auto-prepended diferentes ainda podem compartilhar o mesmo ambiente de execução.

<!--
`implicit-php-open-tag` adds the PHP opening tag omitted from the visible
source. Playground adds it on the first line of the execution file, so PHP
errors still point to the displayed line. Diagnostics use a filesystem-safe
form of the `name` attribute as the filename. Code starting with any PHP
opening tag (`<?php`, `<?=`, or `<?`) is rejected; remove
`implicit-php-open-tag` when the source is already a complete PHP file.
-->

O atributo `implicit-php-open-tag` adiciona a tag de abertura do PHP omitida do código visível. O
Playground a adiciona na primeira linha do arquivo executado, então os erros do PHP continuam
apontando para a linha exibida. As mensagens de diagnóstico usam como nome de arquivo uma versão
do atributo `name` segura para o sistema de arquivos. Códigos que começam com qualquer tag de
abertura do PHP (`<?php`, `<?=` ou `<?`) são rejeitados; remova `implicit-php-open-tag` quando o
código já for um arquivo PHP completo.

<!--
Without `implicit-php-open-tag`, snippets using `auto-prepend-script` must
include their own PHP opening tag. The two attributes are independent, so an
implicit opening tag also works without an auto-prepended script.
-->

Sem `implicit-php-open-tag`, os trechos que usam `auto-prepend-script` precisam incluir sua própria
tag de abertura do PHP. Os dois atributos são independentes, então a tag de abertura implícita
também funciona sem um script auto-prepended.

<!-- ## Edit examples in place -->

## Edite os exemplos na própria página {#edit-examples-in-place}

<!--
Runnable snippets are editable by default. The edited code is kept only in the
current page session; refreshing restores the original snippet.
-->

Os trechos executáveis são editáveis por padrão. O código editado é mantido apenas na sessão atual
da página; recarregar a página restaura o trecho original.

<PhpCodeSnippetExample name="scratch" />

```html
<php-snippet name="scratch.php">
	<script type="application/x-php">
		<?php
		$numbers = range( 1, 5 );
		echo array_sum( $numbers );
	</script>
	<script type="text/expected-output">
		15
	</script>
</php-snippet>
```

<!--
Editable snippets also run with `Ctrl+Enter` or `Cmd+Enter` while the editor is
focused.
-->

Os trechos editáveis também podem ser executados com `Ctrl+Enter` ou `Cmd+Enter` enquanto o editor
estiver em foco.

<!-- Use `readonly` for runnable examples that should be copied or run as-is: -->

Use `readonly` para exemplos executáveis que devem ser copiados ou executados sem alterações:

<PhpCodeSnippetExample name="readOnly" />

```html
<php-snippet name="reference.php" readonly>
	<script type="application/x-php">
		<?php
		echo 'This example can run, but the code is locked.';
	</script>
	<script type="text/expected-output">
		This example can run, but the code is locked.
	</script>
</php-snippet>
```

<!-- `editable="false"` works as a compatibility alias for `readonly`. -->

`editable="false"` funciona como um alias de compatibilidade para `readonly`.

<!-- ## Show output before Run -->

## Mostre a saída antes do Run {#show-output-before-run}

<!--
Use expected output when you want the result visible immediately. The placeholder
is replaced with real runtime output after the reader clicks Run.
-->

Use a saída esperada quando quiser que o resultado fique visível imediatamente. O conteúdo
provisório é substituído pela saída real da execução depois que o leitor clica em Run.

<PhpCodeSnippetExample name="precomputed" />

```html
<php-snippet name="precomputed.php">
	<script type="application/x-php">
		<?php
		echo '2 + 2 = ' . ( 2 + 2 );
	</script>
	<script type="text/expected-output">
		2 + 2 = 4
	</script>
</php-snippet>
```

<!-- For one-line output, use the `expected-output` attribute: -->

Para uma saída de uma linha, use o atributo `expected-output`:

<PhpCodeSnippetExample name="oneLine" />

```html
<php-snippet name="one-line.php" expected-output="Ready">
	<script type="application/x-php">
		<?php
		echo 'Ready';
	</script>
</php-snippet>
```

<!-- ## Prepare a site with a Blueprint -->

## Prepare um site com um Blueprint {#prepare-a-site-with-a-blueprint}

<!--
Use `blueprint` when snippets need setup before the PHP code runs. Put a JSON
[Blueprint](/blueprints/) in the page and point snippets at it by id or CSS
selector.
-->

Use `blueprint` quando os trechos precisarem de configuração antes de o código PHP ser executado.
Coloque um [Blueprint](/blueprints/) em JSON na página e aponte os trechos para ele pelo id ou por
um seletor CSS.

<PhpCodeSnippetExample name="greeting" />

```html
<script id="setup-blueprint" type="application/json">
	{
		"steps": [
			{
				"step": "writeFile",
				"path": "/wordpress/wp-content/mu-plugins/helpers.php",
				"data": "<?php\nfunction docs_greet( $name ) {\n\treturn 'Hello, ' . $name;\n}\n"
			}
		]
	}
</script>

<php-snippet name="greeting.php" blueprint="setup-blueprint">
	<script type="application/x-php">
		<?php
		require '/wordpress/wp-load.php';
		echo docs_greet( 'Ada' );
	</script>
	<script type="text/expected-output">
		Hello, Ada
	</script>
</php-snippet>
```

<!-- The selector form is useful when generated markup cannot guarantee simple ids: -->

A forma com seletor é útil quando o HTML gerado não consegue garantir ids simples:

<PhpCodeSnippetExample name="withSelector" />

```html
<php-snippet blueprint="#setup-blueprint" name="with-selector.php">
	<script type="application/x-php">
		<?php
		require '/wordpress/wp-load.php';
		echo docs_greet( 'Grace' );
	</script>
	<script type="text/expected-output">
		Hello, Grace
	</script>
</php-snippet>
```

<!--
Prefer `<script type="application/json">` for Blueprints. Its contents are raw
text, so embedded PHP strings such as `<?php` are safe. A `<template>` can work,
but its contents are parsed as HTML; if you use one, escape `<` in embedded PHP
strings as `\u003c`.
-->

Prefira `<script type="application/json">` para Blueprints. O conteúdo dele é texto puro, então
strings PHP embutidas, como `<?php`, são seguras. Um `<template>` também pode funcionar, mas o
conteúdo dele é interpretado como HTML; se usar um, escape o `<` nas strings PHP embutidas como
`\u003c`.

<!-- ## Load PHP from another file -->

## Carregue o PHP de outro arquivo {#load-php-from-another-file}

<!-- Use `src` when the PHP source should live in a separate file: -->

Use `src` quando o código PHP precisar ficar em um arquivo separado:

```html
<php-snippet name="external-example.php" src="/snippets/external-example.php" expected-output="Loaded from an external file"></php-snippet>
```

<!--
The URL resolves from the page that contains the snippet. If the file is hosted
on another origin, serve it with an `Access-Control-Allow-Origin` header that
allows the documentation page.
-->

A URL é resolvida a partir da página que contém o trecho. Se o arquivo estiver hospedado em outra
origem, sirva-o com um cabeçalho `Access-Control-Allow-Origin` que permita a página de
documentação.

<!--
`src` loads only the snippet body. Use a Blueprint when you need support files,
plugins, options, or other setup before the snippet runs. The `expected-output`
attribute is still useful with `src` when you already know what the external PHP
file prints.
-->

O `src` carrega apenas o corpo do trecho. Use um Blueprint quando precisar de arquivos de apoio,
plugins, opções ou outra configuração antes de o trecho ser executado. O atributo
`expected-output` continua útil com `src` quando você já sabe o que o arquivo PHP externo imprime.

<!-- ## Pin PHP or WordPress versions -->

## Fixe as versões do PHP ou do WordPress {#pin-php-or-wordpress-versions}

<!--
The default PHP version is `8.4`, and the default WordPress version is `latest`.
Set `php` or `wp` when the example depends on a specific version.
-->

A versão padrão do PHP é `8.4`, e a versão padrão do WordPress é `latest`. Defina `php` ou `wp`
quando o exemplo depender de uma versão específica.

<PhpCodeSnippetExample name="enum" />

```html
<php-snippet name="enum.php" php="8.4">
	<script type="application/x-php">
		<?php
		enum Status {
			case Draft;
			case Published;
		}

		echo Status::Published->name;
	</script>
	<script type="text/expected-output">
		Published
	</script>
</php-snippet>
```

<PhpCodeSnippetExample name="wpVersion" />

```html
<php-snippet name="wp-version.php" wp="6.8">
	<script type="application/x-php">
		<?php
		require '/wordpress/wp-load.php';
		echo get_bloginfo( 'version' );
	</script>
	<script type="text/expected-output">
		6.8
	</script>
</php-snippet>
```

<!--
See the [Query API reference](/developers/apis/query-api/#available-options)
for available PHP and WordPress versions.
-->

Consulte a [referência da Query API](/developers/apis/query-api/#available-options) para ver as
versões disponíveis do PHP e do WordPress.

<!-- ## Show code without running it -->

## Mostre código sem executá-lo {#show-code-without-running-it}

<!--
Set `runnable="false"` for fragments that should be highlighted but not
executed, such as incomplete examples or code that depends on external services.
-->

Defina `runnable="false"` para fragmentos que devem ter destaque de sintaxe, mas não devem ser
executados, como exemplos incompletos ou códigos que dependem de serviços externos.

<PhpCodeSnippetExample name="illustration" />

```html
<php-snippet name="illustration.php" runnable="false">
	<script type="application/x-php">
		<?php
		// This fragment is shown for discussion, not execution.
		add_filter( 'the_content', 'docs_filter_content' );
	</script>
</php-snippet>
```

<!-- ## Self-host the runtime -->

## Hospede o ambiente de execução por conta própria {#self-host-the-runtime}

<!--
Most pages should use the hosted runtime from [playground.wordpress.net](https://playground.wordpress.net).
Set `playground-origin` when developing Playground itself, testing a self-hosted
deployment, or pinning examples to infrastructure you control.
-->

A maioria das páginas deve usar o ambiente de execução hospedado em
[playground.wordpress.net](https://playground.wordpress.net). Defina `playground-origin` quando
estiver desenvolvendo o próprio Playground, testando uma instalação auto-hospedada ou fixando os
exemplos em uma infraestrutura que você controla.

```html
<php-snippet name="local-runtime.php" playground-origin="http://localhost:5400">
	<script type="application/x-php">
		<?php
		echo phpversion();
	</script>
	<script type="text/expected-output">
		8.4.x
	</script>
</php-snippet>
```

<!-- ## Runtime sharing -->

## Compartilhamento do ambiente de execução {#runtime-sharing}

<!-- The first Run click on a page: -->

O primeiro clique em Run em uma página:

<!--
1. Loads the Playground client.
2. Creates a hidden iframe pointed at `remote.html`.
3. Boots PHP, and WordPress unless the snippet uses `wp="none"`.
4. Runs the snippet code and writes stdout into the output panel.
-->

1. Carrega o cliente do Playground.
2. Cria um iframe oculto apontando para `remote.html`.
3. Inicializa o PHP e, se o trecho não usar `wp="none"`, também inicializa o WordPress.
4. Executa o código do trecho e escreve o stdout no painel de saída.

<!--
Later runs reuse an existing runtime when `playground-origin`, `php`, `wp`, and
the resolved Blueprint JSON all match. This keeps related snippets fast while
still isolating examples that need different setup.
-->

As execuções seguintes reutilizam um ambiente de execução existente quando `playground-origin`,
`php`, `wp` e o JSON do Blueprint resolvido são todos iguais. Isso mantém os trechos relacionados
rápidos e, ao mesmo tempo, isola os exemplos que precisam de configurações diferentes.

<!-- ## Security and CSP -->

## Segurança e CSP {#security-and-csp}

<!--
Snippet PHP runs inside the Playground runtime iframe, not in the parent page.
The parent page still loads the web component script and creates the hidden
runtime iframe.
-->

O PHP dos trechos é executado dentro do iframe do ambiente de execução do Playground, e não na
página principal. A página principal ainda carrega o script do web component e cria o iframe
oculto do ambiente de execução.

<!-- If your site has a Content Security Policy, allow: -->

Se o seu site tiver uma Content Security Policy (CSP), permita:

<!--
- The module script from `https://playground.wordpress.net`.
- The hidden iframe from the same origin.
- Network requests for the PHP, WordPress, and Playground runtime assets.
-->

- O script do módulo vindo de `https://playground.wordpress.net`.
- O iframe oculto da mesma origem.
- As requisições de rede para os arquivos do PHP, do WordPress e do ambiente de execução do
  Playground.

<!--
For stricter environments, self-host the snippet script and use
`playground-origin` to point snippets at your deployment.
-->

Para ambientes mais restritos, hospede você mesmo o script dos trechos e use `playground-origin`
para apontar os trechos para a sua instalação.

<!-- ## Standalone PHP Playground -->

## PHP Playground independente {#standalone-php-playground}

<!--
Use the standalone PHP Playground when you want a full-page editor, a shareable
URL, or an iframe instead of inline examples:
-->

Use o PHP Playground independente quando quiser um editor em página inteira, uma URL
compartilhável ou um iframe em vez de exemplos inline:

> [playground.wordpress.net/php-playground.html](https://playground.wordpress.net/php-playground.html)

<!-- You can embed it directly: -->

Você pode incorporá-lo diretamente:

```html
<iframe src="https://playground.wordpress.net/php-playground.html#eyJjb2RlIjoiPD9waHBcblxuZWNobyBcIkkgYW0gYSBjb2RlIHNuaXBwZXQhXCI7XG4iLCJwaHAiOiI4LjQifQ==" width="100%" height="600"></iframe>
```

<!--
The URL fragment is a base64-encoded JSON payload with `code`, `php`, and `wp`
fields.
-->

O fragmento da URL é um JSON codificado em base64 com os campos `code`, `php` e `wp`.

<!-- ## Which embed should you use? -->

## Qual incorporação você deve usar? {#which-embed-should-you-use}

<!--
| Use case                                              | Use                                       |
| ----------------------------------------------------- | ----------------------------------------- |
| Several runnable examples in one article              | `<php-snippet>`                           |
| A tutorial step where readers should edit code inline | `<php-snippet>`                           |
| Shared setup across examples                          | `<php-snippet blueprint="...">`           |
| Hidden PHP setup before every run                     | `<php-snippet auto-prepend-script="...">` |
| PHP source without an opening tag                     | `<php-snippet implicit-php-open-tag>`     |
| A pure PHP language example                           | `<php-snippet wp="none">`                 |
| A runnable example that should not be edited          | `<php-snippet readonly>`                  |
| A single full-page editor with a shareable URL        | Standalone PHP Playground                 |
| A complete WordPress site preview                     | Standard Playground iframe                |
-->

| Caso de uso                                                     | Use                                       |
| --------------------------------------------------------------- | ----------------------------------------- |
| Vários exemplos executáveis em um artigo                        | `<php-snippet>`                           |
| Um passo de tutorial em que os leitores devem editar o código   | `<php-snippet>`                           |
| Configuração compartilhada entre exemplos                       | `<php-snippet blueprint="...">`           |
| Configuração PHP oculta antes de cada execução                  | `<php-snippet auto-prepend-script="...">` |
| Código PHP sem tag de abertura                                  | `<php-snippet implicit-php-open-tag>`     |
| Um exemplo da linguagem PHP pura                                | `<php-snippet wp="none">`                 |
| Um exemplo executável que não deve ser editado                  | `<php-snippet readonly>`                  |
| Um editor único em página inteira com URL compartilhável        | PHP Playground independente               |
| A pré-visualização de um site WordPress completo                | Iframe padrão do Playground               |

<!-- ## Troubleshooting -->

## Solução de problemas {#troubleshooting}

<!--
If the snippet does not render, check that the module script loaded and that the
browser supports custom elements.
-->

Se o trecho não for renderizado, verifique se o script do módulo foi carregado e se o navegador
oferece suporte a custom elements.

<!--
If Run never finishes, open DevTools and check failed requests for `remote.html`,
PHP `.wasm` files, WordPress zip files, Blueprint resources, or cross-origin
`src` files.
-->

Se o Run nunca terminar, abra o DevTools e verifique se há requisições com falha para
`remote.html`, arquivos `.wasm` do PHP, arquivos zip do WordPress, recursos do Blueprint ou
arquivos `src` de outra origem.

<!--
If a Blueprint-backed snippet cannot find helper functions, confirm the
`blueprint` attribute points to the right element and that the JSON is valid.
-->

Se um trecho que usa um Blueprint não encontrar as funções auxiliares, confirme se o atributo
`blueprint` aponta para o elemento correto e se o JSON é válido.

<!--
If output differs from the expected placeholder, trust the runtime output. The
placeholder is static documentation; Run executes the current code against the
selected PHP, WordPress, and Blueprint setup.
-->

Se a saída for diferente do conteúdo provisório esperado, confie na saída da execução. O conteúdo
provisório é documentação estática; o Run executa o código atual com a configuração de PHP,
WordPress e Blueprint selecionada.
