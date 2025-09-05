---
sidebar_position: 8
title: Exemplos
slug: /blueprints/examples
description: Uma galeria de exemplos práticos de Blueprint para várias tarefas, como instalar temas, executar PHP e habilitar recursos.
---

import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

<!-- # Blueprints Examples -->

# Exemplos de Blueprints

<!-- :::tip -->
<!-- Check the [Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) to explore real-world code examples of using WordPress Playground to launch a WordPress site with a variety of setups. -->
<!-- ::: -->

:::tip
Confira a [Galeria de Blueprints](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) para explorar exemplos de código do mundo real de como usar o WordPress Playground para lançar um site WordPress com uma variedade de configurações.
:::

<!-- Let's see some cool things you can do with Blueprints. -->

Vamos ver algumas coisas legais que você pode fazer com Blueprints.

<!-- ## Install a Theme and a Plugin -->

## Instalar um Tema e um Plugin

<BlueprintExample blueprint={{
	"steps": [
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "wordpress.org/plugins",
				"slug": "coblocks"
			}
		},
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "pendant"
			}
		}
	]
}} />

<!-- ## Run custom PHP code -->

## Executar código PHP personalizado

<BlueprintExample
display={`{
	"steps": [
		{
			"step": "runPHP",
			"code": "<?php include 'wordpress/wp-load.php'; wp_insert_post(array( 'post_title' => 'Post title', 'post_content' => 'Post content', 'post_status' => 'publish', 'post_author' => 1 )); "
		}
	]
}` }
blueprint={{
		"steps": [
			{
				"step": "runPHP",
				"code": `<?php
include 'wordpress/wp-load.php';
wp_insert_post(array(
'post_title' => 'Post title',
'post_content' => 'Post content',
'post_status' => 'publish',
'post_author' => 1
));
`
}
]
}} />

<!-- ## Enable an option on the Gutenberg Experiments page -->

## Habilitar uma opção na página de Experimentos do Gutenberg

<!-- Here: Switch on the "new admin views" feature. -->

Aqui: Ativar o recurso "novas visualizações de admin".

<BlueprintExample
display={`{
	"steps": [
		{
			"step": "runPHP",
			"code": "<?php require '/wordpress/wp-load.php'; update_option( 'gutenberg-experiments', array( 'gutenberg-dataviews' => true ) );"
		}
	]
}`}
blueprint={{
		"steps": [
			{
				"step": "runPHP",
				"code": "<?php require '/wordpress/wp-load.php'; update_option( 'gutenberg-experiments', array( 'gutenberg-dataviews' => true ) );"
			}
		]
}} />

<!-- ## Showcase a product demo -->

## Mostrar uma demonstração de produto

<BlueprintExample noButton blueprint={{
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
		},
		{
			"step": "setSiteOptions",
			"options": {
				"some_required_option_1": "your_favorite_values",
				"some_required_option_2": "your_favorite_values"
			}
		}
	]
}} />

<!-- ## Enable networking -->

## Habilitar rede

<BlueprintExample blueprint={{
	"landingPage": "/wp-admin/plugin-install.php",
	"features": {
		"networking": true
	},
	"steps": [
		{
			"step": "login"
		}
	]
}} />

<!-- ## Load PHP code on every request (mu-plugin) -->

## Carregar código PHP em cada requisição (mu-plugin)

<!-- Use the `writeFile` step to add code to a mu-plugin that runs on every request. -->

Use o passo `writeFile` para adicionar código a um mu-plugin que executa em cada requisição.

<BlueprintExample blueprint={{
	"landingPage": "/category/uncategorized/",
	"features": {
		"networking": true
	},
	"steps": [
		{
			"step": "login"
		},
		{
			"step": "writeFile",
			"path": "/wordpress/wp-content/mu-plugins/rewrite.php",
			"data": "<?php add_action( 'after_setup_theme', function() { global $wp_rewrite; $wp_rewrite->set_permalink_structure('/%postname%/'); $wp_rewrite->flush_rules(); } );"
		}
	]
}} />

<!-- ## Code editor (as a Gutenberg block) -->

## Editor de código (como um bloco Gutenberg)

<BlueprintExample blueprint={{
  "landingPage": "/wp-admin/post.php?post=4&action=edit",
  "steps": [
    {
      "step": "login",
      "username": "admin",
      "password": "password"
    },
    {
      "step": "installPlugin",
      "pluginData": {
        "resource": "wordpress.org/plugins",
        "slug": "interactive-code-block"
      }
    },
    {
      "step": "runPHP",
      "code": "<?php require '/wordpress/wp-load.php'; wp_insert_post(['post_title' => 'WordPress Playground block demo!','post_content' => '<!-- wp:wordpress-playground/playground /-->', 'post_status' => 'publish', 'post_type' => 'post',]);"
    }
  ]
}} />

<!-- You can share your own Blueprint examples in [this dedicated wiki](https://github.com/WordPress/wordpress-playground/wiki/Blueprint-examples). -->

Você pode compartilhar seus próprios exemplos de Blueprint nesta [wiki dedicada](https://github.com/WordPress/wordpress-playground/wiki/Blueprint-examples).

<!-- ## Load an older WordPress version -->

## Carregar uma versão mais antiga do WordPress

<!-- Playground only ships with a few recent WordPress releases. If you need to use an older version, this Blueprint can help you: change the version number in `"url": "https://playground.wordpress.net/plugin-proxy.php?url=https://wordpress.org/wordpress-6.2.1.zip"` from `6.2.1` to the release you want to load. -->

O Playground só vem com algumas versões recentes do WordPress. Se você precisar usar uma versão mais antiga, este Blueprint pode ajudá-lo: altere o número da versão em `"url": "https://playground.wordpress.net/plugin-proxy.php?url=https://wordpress.org/wordpress-6.2.1.zip"` de `6.2.1` para a versão que você quer carregar.

<!-- **Note:** the oldest supported WordPress version is `6.2.1`, following the SQLite integration plugin. -->

**Nota:** a versão mais antiga do WordPress suportada é `6.2.1`, seguindo o plugin de integração SQLite.

<BlueprintExample blueprint={{
  "landingPage": "/wp-admin",
  "preferredVersions": {
    "wp": "https://playground.wordpress.net/plugin-proxy.php?url=https://wordpress.org/wordpress-6.2.1.zip",
    "php": "8.3"
  },
  "features": {
    "networking": true
  },
  "steps": [
    {
      "step": "login",
      "username": "admin",
      "password": "password"
    }
  ]
}} />

<!-- ## Run WordPress from trunk or a specific commit. -->

## Executar WordPress do trunk ou de um commit específico.

<!-- WordPress Playground can run `trunk` (the latest commit), the HEAD of a specific branch or a specific commit from the [WordPress/WordPress](https://github.com/WordPress/WordPress) GitHub repository. -->

O WordPress Playground pode executar `trunk` (o último commit), o HEAD de um branch específico ou um commit específico do repositório GitHub [WordPress/WordPress](https://github.com/WordPress/WordPress).

<!-- You can specify the reference in `"url": "https://playground.wordpress.net/plugin-proxy.php?build-ref=trunk"`. -->

Você pode especificar a referência em `"url": "https://playground.wordpress.net/plugin-proxy.php?build-ref=trunk"`.

<!-- To specify the latest commit of a particular branch, you can change the reference to the branch version number, eg `6.6`. To run a specific commit, you can use the commit hash from [WordPress/WordPress](https://github.com/WordPress/WordPress), eg `7d7a52367dee9925337e7d901886c2e9b21f70b6`. -->

Para especificar o último commit de um branch específico, você pode alterar a referência para o número da versão do branch, ex. `6.6`. Para executar um commit específico, você pode usar o hash do commit do [WordPress/WordPress](https://github.com/WordPress/WordPress), ex. `7d7a52367dee9925337e7d901886c2e9b21f70b6`.

<!-- **Note:** the oldest supported WordPress version is `6.2.1`, following the SQLite integration plugin. -->

**Nota:** a versão mais antiga do WordPress suportada é `6.2.1`, seguindo o plugin de integração SQLite.

<BlueprintExample blueprint={{
    "landingPage": "/wp-admin",
	"login" : true,
	"preferredVersions" : {
		"php": "8.3",
		"wp": "https://playground.wordpress.net/plugin-proxy.php?build-ref=trunk"
	}
}} />

<!-- ## Using Blueprint Bundles -->

## Usando Pacotes Blueprint

<!-- Here's an example of a Blueprint that uses bundled resources from a Blueprint bundle: -->

Aqui está um exemplo de um Blueprint que usa recursos empacotados de um pacote Blueprint:

```json
{
	"landingPage": "/",
	"preferredVersions": {
		"php": "8.3",
		"wp": "latest"
	},
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "bundled",
				"path": "/my-theme.zip"
			},
			"activate": true
		},
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "bundled",
				"path": "/my-plugin.zip"
			},
			"activate": true
		},
		{
			"step": "writeFile",
			"path": "/wordpress/custom-page.html",
			"data": {
				"resource": "bundled",
				"path": "/assets/custom-page.html"
			}
		}
	]
}
```

<!-- This Blueprint bundle would be zip file containing the following files: -->

Este pacote Blueprint seria um arquivo zip contendo os seguintes arquivos:

<!-- -   `/blueprint.json` - The blueprint declaration outlined above -->
<!-- -   `/my-theme.zip` - A theme package -->
<!-- -   `/my-plugin.zip` - A plugin package -->
<!-- -   `/assets/custom-page.html` - A custom HTML file -->

-   `/blueprint.json` - A declaração do blueprint descrita acima
-   `/my-theme.zip` - Um pacote de tema
-   `/my-plugin.zip` - Um pacote de plugin
-   `/assets/custom-page.html` - Um arquivo HTML personalizado

<!-- You can use this Blueprint bundle by: -->

Você pode usar este pacote Blueprint:

<!-- 1. Creating a ZIP file with these files and the blueprint.json -->
<!-- 2. Hosting the ZIP file on a server -->
<!-- 3. Loading it with `?blueprint-url=https://example.com/my-blueprint-bundle.zip` -->

1. Criando um arquivo ZIP com esses arquivos e o blueprint.json
2. Hospedando o arquivo ZIP em um servidor
3. Carregando-o com `?blueprint-url=https://example.com/my-blueprint-bundle.zip`

<!-- For more information on Blueprint bundles, see the [Blueprint Bundles](/blueprints/bundles) documentation. -->

Para mais informações sobre pacotes Blueprint, consulte a documentação [Pacotes Blueprint](/blueprints/bundles).
