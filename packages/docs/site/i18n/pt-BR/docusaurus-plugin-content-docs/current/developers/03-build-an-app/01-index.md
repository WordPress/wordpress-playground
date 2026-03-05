---
title: Guia rápido para desenvolvedores
slug: /developers/build-your-first-app
description: Guia prático para incorporar WordPress, instalar plugins, visualizar PRs e criar aplicativos com as APIs do Playground.
---

<!-- # Quick Start Guide for Developers -->

# Guia rápido para desenvolvedores

<!-- WordPress Playground was created as a programmable tool. Below you'll find a few examples of what you can do with it. Each discussed API is described in detail in the [APIs section](/developers/apis/): -->

WordPress Playground foi criado como uma ferramenta programável. Abaixo você encontrará alguns exemplos do que pode fazer com ele. Cada API discutida é descrita em detalhes na [seção de APIs](/developers/apis/):

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc} />

<!-- ## Embed WordPress on your website -->

## Incorporar WordPress no seu site

<!-- Playground can be embedded on your website using the HTML `<iframe>` tag as follows: -->

O Playground pode ser incorporado no seu site usando a tag HTML `<iframe>` da seguinte forma:

```html
<iframe src="https://playground.wordpress.net/"></iframe>
```

<!-- Every visitor will get their own private WordPress instance for free. You can then customize it using one of the [Playground APIs](/developers/apis/). -->

Cada visitante receberá sua própria instância privada do WordPress gratuitamente. Você pode então personalizá-la usando uma das [APIs do Playground](/developers/apis/).

import PlaygroundWpNetWarning from '@site/docs/\_fragments/\_playground_wp_net_may_stop_working.md';

<PlaygroundWpNetWarning />

<!-- ## Control the embedded website -->

## Controlar o site incorporado

<!-- WordPress Playground provides three APIs you can use to control the iframed website. All the examples in this section are built using one of these: -->

O WordPress Playground fornece três APIs que você pode usar para controlar o site incorporado em iframe. Todos os exemplos nesta seção são construídos usando uma delas:

import APIList from '@site/docs/\_fragments/\_api_list.mdx';

<APIList />

<!-- Learn more about each of these APIs in the [APIs overview section](/developers/apis/). -->

Saiba mais sobre cada uma dessas APIs na [seção de visão geral das APIs](/developers/apis/).

<!-- ## Showcase a plugin or theme from WordPress directory -->

## Apresentar um plugin ou tema do diretório WordPress

import ThisIsQueryApi from '@site/docs/\_fragments/\_this_is_query_api.md';

<!-- You can install plugins and themes from the WordPress directory with only URL parameters. This iframe preinstalls the `coblocks` and `friends` plugins and the `pendant` theme. -->

Você pode instalar plugins e temas do diretório WordPress apenas com parâmetros de URL. Este iframe pré-instala os plugins `coblocks` e `friends` e o tema `pendant`.

<ThisIsQueryApi />

```html
<iframe src="https://playground.wordpress.net/?plugin=coblocks"></iframe>
```

<!-- ## Showcase any plugin or theme -->

## Apresentar qualquer plugin ou tema

<!-- What if your plugin is not in the WordPress directory? -->

E se seu plugin não estiver no diretório WordPress?

<!-- You can still showcase it on Playground by using [JSON Blueprints](/blueprints). For example, this Blueprint would download and install a plugin and a theme from your website and also import some starter content: -->

Você ainda pode apresentá-lo no Playground usando [JSON Blueprints](/blueprints). Por exemplo, este Blueprint baixaria e instalaria um plugin e um tema do seu site e também importaria algum conteúdo inicial:

```json
{
	"steps": [
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "url",
				"url": "https://your-site.com/your-plugin.zip"
			}
		},
		{
			"step": "installTheme",
			"themeData": {
				"resource": "url",
				"url": "https://your-site.com/your-theme.zip"
			}
		},
		{
			"step": "importWxr",
			"file": {
				"resource": "url",
				"url": "https://your-site.com/starter-content.wxr"
			}
		}
	]
}
```

<!-- See [getting started with Blueprints](/blueprints/getting-started) to learn more. -->

Veja [começando com Blueprints](/blueprints/getting-started) para saber mais.

<!-- ## Preview pull requests from your repository -->

## Visualizar pull requests do seu repositório

<!-- You can preview repository code two ways: directly with `git:directory`, or by pointing to a `.zip` from your CI pipeline. Here's the `git:directory` approach using [Blueprints](/blueprints): -->

Você pode visualizar código do repositório de duas maneiras: diretamente com `git:directory`, ou apontando para um `.zip` do seu pipeline de CI. Aqui está a abordagem `git:directory` usando [Blueprints](/blueprints):

```json
{
	"steps": [
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "git:directory",
				"url": "https://github.com/my-user/my-repo",
				"ref": "refs/pull/1/head",
				"refType": "refname"
			},
			"options": {
				"activate": true
			},
			"progress": {
				"caption": "Installing plugin from my-user/my-repo PR #1"
			}
		}
	]
}
```

No código acima, será instalado um plugin de um repositório localizado na `url`, e a referência para encontrar o branch é `refType`; neste caso, será usado `refname`, mas também pode ser usado `branch`, `tag` e `commit`.

:::tip
Você pode automatizar esse processo usando a [Ação do GitHub para gerar links de pré-visualização](/guides/github-action-pr-preview), o que ajudará a agilizar o processo.
:::

<!-- Loading a `.zip` file is another alternative for previewing your project. See the [live example of Gutenberg PR previewer](https://playground.wordpress.net/gutenberg.html). -->

Carregar um arquivo `.zip` é outra alternativa para visualizar seu projeto. Veja o [exemplo ao vivo do visualizador de PR do Gutenberg](https://playground.wordpress.net/gutenberg.html).

<!-- To use Playground as a PR previewer, you need: -->

Para usar o Playground como um visualizador de PR, você precisa:

<!-- -   A CI pipeline that bundles your plugin or theme -->
<!-- -   Public access to the generated `.zip` file -->

- Um pipeline de CI que empacote seu plugin ou tema
- Acesso público ao arquivo `.zip` gerado

<!-- Those zip bundles aren't any different from regular WordPress Plugins, which means you can install them in Playground using the [JSON Blueprints](/blueprints) API. Once you expose an endpoint like https://your-site.com/pull-request-1234.zip, the following Blueprint will do the rest: -->

Esses pacotes zip não são diferentes dos plugins WordPress regulares, o que significa que você pode instalá-los no Playground usando a API [JSON Blueprints](/blueprints). Depois que você expuser um endpoint como https://your-site.com/pull-request-1234.zip, o seguinte Blueprint fará o resto:

```json
{
	"steps": [
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "url",
				"url": "https://your-site.com/pull-request-1234.zip"
			}
		}
	]
}
```

<!-- The official Playground demo uses this technique to preview pull requests from the Gutenberg repository: -->

A demonstração oficial do Playground usa esta técnica para visualizar pull requests do repositório Gutenberg:

import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

<BlueprintExample
blueprint={{
	"landingPage": "/wp-admin/plugins.php?test=42test",
	"steps": [
		{
			"step": "login",
			"username": "admin",
			"password": "password"
		},
		{
			"step": "mkdir",
			"path": "/wordpress/pr"
		},
		{
			"step": "writeFile",
			"path": "/wordpress/pr/pr.zip",
			"data": {
				"resource": "url",
				"url": "/plugin-proxy.php?org=WordPress&repo=gutenberg&workflow=Build%20Gutenberg%20Plugin%20Zip&artifact=gutenberg-plugin&pr=60819",
				"caption": "Downloading Gutenberg PR 47739"
			},
			"progress": {
				"weight": 2,
				"caption": "Applying Gutenberg PR 47739"
			}
		},
		{
			"step": "unzip",
			"zipPath": "/wordpress/pr/pr.zip",
			"extractToPath": "/wordpress/pr"
		},
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "vfs",
				"path": "/wordpress/pr/gutenberg.zip"
			}
		}
	]
	}} />

<!-- ### Preview WordPress Core and Gutenberg Branches or PRs -->

### Visualizar Branches ou PRs do WordPress Core e Gutenberg

<!-- You can preview specific pull requests from WordPress Core and Gutenberg repositories using Query API parameters. Gutenberg branches also have an alternative to preview them with the parameter `gutenberg-branch`. This is useful for testing the latest trunk changes or specific feature branches without creating a PR. -->

Você pode visualizar pull requests específicos dos repositórios WordPress Core e Gutenberg usando parâmetros da Query API. Os branches do Gutenberg também têm uma alternativa para visualizá-los com o parâmetro `gutenberg-branch`. Isso é útil para testar as últimas alterações do trunk ou branches de recursos específicos sem criar um PR.

<!-- -   Preview a specific WordPress Core PR: `https://playground.wordpress.net/?core-pr=9500` -->
<!-- -   Preview a specific Gutenberg PR: `https://playground.wordpress.net/?gutenberg-pr=73010` -->
<!-- -   Preview the Gutenberg trunk branch: `https://playground.wordpress.net/?gutenberg-branch=trunk` -->

- Visualizar um PR específico do WordPress Core: `https://playground.wordpress.net/?core-pr=9500`
- Visualizar um PR específico do Gutenberg: `https://playground.wordpress.net/?gutenberg-pr=73010`
- Visualizar o branch trunk do Gutenberg: `https://playground.wordpress.net/?gutenberg-branch=trunk`

<!-- ## Build a compatibility testing environment -->

## Construir um ambiente de teste de compatibilidade

<!-- Test your plugin across PHP and WordPress versions by configuring them in Playground. This helps you verify compatibility before release. -->

Teste seu plugin em diferentes versões do PHP e WordPress configurando-as no Playground. Isso ajuda você a verificar a compatibilidade antes do lançamento.

<!-- With the Query API, you'd simply add the `php` and `wp` query parameters to the URL: -->

Com a API de Query, você simplesmente adicionaria os parâmetros de consulta `php` e `wp` à URL:

```html
<iframe src="https://playground.wordpress.net/?php=8.3&wp=6.1"></iframe>
```

<!-- With JSON Blueprints, you'd use the `preferredVersions` property: -->

Com JSON Blueprints, você usaria a propriedade `preferredVersions`:

```json
{
	"preferredVersions": {
		"php": "8.3",
		"wp": "6.1"
	}
}
```

<!-- ## Run PHP code in the browser -->

## Executar código PHP no navegador

<!-- The JavaScript API provides the `run()` method which you can use to run PHP code in the browser: -->

A API JavaScript fornece o método `run()` que você pode usar para executar código PHP no navegador:

```html
<iframe id="wp"></iframe>
<script type="module">
	const client = await startPlaygroundWeb({
		iframe: document.getElementById('wp'),
		remoteUrl: 'https://playground.wordpress.net/remote.html',
	});
	await client.isReady;
	await client.run({
		code: `<?php
		require("/wordpress/wp-load.php");

		update_option("blogname", "Playground is really cool!");
		echo "Site title updated!";
		`,
	});
	client.goTo('/');
</script>
```

<!-- Combine that with a code editor like Monaco or CodeMirror, and you'll get live code snippets like in [this article](https://adamadam.blog/2023/02/16/how-to-modify-html-in-a-php-wordpress-plugin-using-the-new-tag-processor-api/)! -->

Combine isso com um editor de código como Monaco ou CodeMirror, e você terá snippets de código ao vivo como neste [artigo](https://adamadam.blog/2023/02/16/how-to-modify-html-in-a-php-wordpress-plugin-using-the-new-tag-processor-api/)!
