---
sidebar_position: 8
title: Exemplos
slug: /blueprints/examples
description: Uma galeria de exemplos práticos de Blueprint para várias tarefas, como instalar temas, executar PHP e ativar recursos.
---

<!-- title: Examples -->
<!-- description: A gallery of practical Blueprint examples for various tasks, such as installing themes, running PHP, and enabling features. -->

import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

# Exemplos de Blueprints

<!-- # Blueprints Examples -->

<div class="callout callout-tip">

Confira a [Galeria de Blueprints](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) para explorar exemplos de código do mundo real usando o WordPress Playground para lançar um site WordPress com uma variedade de configurações.

<!-- Check the [Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) to explore real-world code examples of using WordPress Playground to launch a WordPress site with a variety of setups. -->

</div>

Vamos ver algumas coisas legais que você pode fazer com Blueprints.

<!-- Let's see some cool things you can do with Blueprints. -->

## Instalar um Tema e um Plugin

<!-- ## Install a Theme and a Plugin -->

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

## O objeto `meta`

<!-- ## The `meta` object -->

O objeto opcional `meta` fornece informações descritivas sobre seu Blueprint. Embora não afete como o Blueprint é executado, essas informações são cruciais para fins de exibição em galerias, seletores de Blueprint e ferramentas integradas como [WordPress Studio](https://developer.wordpress.com/studio/) e [Galeria de Blueprints](https://wordpress.github.io/blueprints/).

<!-- The optional `meta` object provides descriptive information about your Blueprint. While it doesn't affect how the Blueprint executes, this information is crucial for display purposes in galleries, Blueprint selectors, and integrated tools like [WordPress Studio](https://developer.wordpress.com/studio/) and [Blueprints Gallery](https://wordpress.github.io/blueprints/). -->

### Propriedades

<!-- ### Properties -->

| Campo             | Tipo            | Descrição                                      |
| :---------------- | :-------------- | :--------------------------------------------- |
| **`title`**       | `string`        | Um nome curto e legível para o Blueprint.      |
| **`description`** | `string`        | Um breve resumo explicando a configuração.     |
| **`author`**      | `string`        | O nome ou identificador do criador.            |
| **`categories`**  | `array<string>` | Tags usadas para filtrar e agrupar Blueprints. |

<!-- | Field             | Type            | Description                                      |
| :---------------- | :-------------- | :----------------------------------------------- |
| **`title`**       | `string`        | A short, human-readable name for the Blueprint.  |
| **`description`** | `string`        | A brief summary explaining the setup.            |
| **`author`**      | `string`        | The name or handle of the creator.               |
| **`categories`**  | `array<string>` | Tags used for filtering and grouping Blueprints. | -->

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"meta": {
		"title": "Configuração Padrão do Playground",
		"description": "Uma configuração básica para um novo site WordPress com as versões mais recentes.",
		"author": "Equipe Playground",
		"categories": ["starter", "default"]
	},
	"landingPage": "/wp-admin/",
	"preferredVersions": {
		"php": "8.3",
		"wp": "latest"
	}
}
```

## Executar código PHP personalizado

<!-- ## Run custom PHP code -->

<BlueprintExample
display={`{
	"steps": [
		{
			"step": "runPHP",
			"code": "<?php require_once '/wordpress/wp-load.php'; wp_insert_post(array( 'post_title' => 'Post title', 'post_content' => 'Post content', 'post_status' => 'publish', 'post_author' => 1 )); "
		}
	]
}` }
blueprint={{
		"steps": [
			{
				"step": "runPHP",
				"code": `<?php
require_once '/wordpress/wp-load.php';
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

## Habilitar uma opção na página de Experimentos do Gutenberg

<!-- ## Enable an option on the Gutenberg Experiments page -->

Aqui: Ative o recurso "novas visualizações de administração".

<!-- Here: Switch on the "new admin views" feature. -->

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

## Como trabalhar com WP-CLI a partir do terminal e do Playground

<!-- ## How to work with WP-CLI from the terminal and Playground -->

Você pode executar comandos WP-CLI em uma instância do Playground tanto do seu terminal quanto diretamente dentro de um Blueprint.

<!-- You can run WP-CLI commands on a Playground instance either from your terminal or directly within a Blueprint. -->

Para usar seu terminal, você deve primeiro montar o diretório `/wordpress/` e garantir que a integração com o banco de dados SQLite esteja configurada. Isso ocorre porque o banco de dados interno do Playground não persiste em um site montado, então você deve instalar explicitamente o plugin de banco de dados via Blueprint. Isso permite que o WP-CLI reconheça a instalação do WordPress e se conecte ao seu banco de dados.

<!-- To use your terminal, you must first mount the `/wordpress/` directory and ensure the SQLite database integration is configured. This is because Playground's internal database doesn't persist on a mounted site, so you must explicitly install the database plugin via a Blueprint. This allows WP-CLI to recognize the WordPress installation and connect to its database. -->

<div class="callout callout-info">

Se você executar comandos WP-CLI como etapas dentro do seu arquivo Blueprint, essa configuração manual não é necessária.

<!-- If you run WP-CLI commands as steps within your Blueprint file, this manual setup is not needed. -->

</div>

O seguinte trecho de Blueprint lida com essa configuração:

<!-- The following Blueprint snippet handles this setup: -->

<BlueprintExample blueprint={{
    "plugins": [ "sqlite-database-integration" ]
}} />

Para uma explicação detalhada de por que isso é necessário, consulte a seção [Solucionar problemas e depurar Blueprints](/blueprints/troubleshoot-and-debug#wp-cli-error-establishing-a-database-connection-on-mounted-sites).

<!-- For a detailed explanation of why this is needed, refer to the [Troubleshoot and Debug Blueprints](/blueprints/troubleshoot-and-debug#wp-cli-error-establishing-a-database-connection-on-mounted-sites) section. -->

## Apresentar uma demonstração de produto

<!-- ## Showcase a product demo -->

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

## Habilitar rede

<!-- ## Enable networking -->

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

## Carregar código PHP em cada requisição (mu-plugin)

<!-- ## Load PHP code on every request (mu-plugin) -->

Use a etapa `writeFile` para adicionar código a um mu-plugin que é executado em cada requisição.

<!-- Use the `writeFile` step to add code to a mu-plugin that runs on every request. -->

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

## Editor de código (como um bloco Gutenberg)

<!-- ## Code editor (as a Gutenberg block) -->

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

Você pode compartilhar seus próprios exemplos de Blueprint nesta [wiki dedicada](https://github.com/WordPress/wordpress-playground/wiki/Blueprint-examples).

<!-- You can share your own Blueprint examples in [this dedicated wiki](https://github.com/WordPress/wordpress-playground/wiki/Blueprint-examples). -->

## Carregar uma versão antiga do WordPress

<!-- ## Load an older WordPress version -->

O Playground vem apenas com algumas versões recentes do WordPress. Se você precisar usar uma versão mais antiga, este Blueprint pode ajudá-lo: altere o número da versão em `"url": "https://playground.wordpress.net/plugin-proxy.php?url=https://wordpress.org/wordpress-6.2.1.zip"` de `6.2.1` para a versão que você deseja carregar.

<!-- Playground only ships with a few recent WordPress releases. If you need to use an older version, this Blueprint can help you: change the version number in `"url": "https://playground.wordpress.net/plugin-proxy.php?url=https://wordpress.org/wordpress-6.2.1.zip"` from `6.2.1` to the release you want to load. -->

**Nota:** a versão mais antiga suportada do WordPress é `6.2.1`, seguindo o plugin de integração SQLite.

<!-- **Note:** the oldest supported WordPress version is `6.2.1`, following the SQLite integration plugin. -->

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

## Executar WordPress do trunk ou de um commit específico

<!-- ## Run WordPress from trunk or a specific commit. -->

O WordPress Playground pode executar o `trunk` (o commit mais recente), o HEAD de um branch específico ou um commit específico do repositório GitHub [WordPress/WordPress](https://github.com/WordPress/WordPress).

<!-- WordPress Playground can run `trunk` (the latest commit), the HEAD of a specific branch or a specific commit from the [WordPress/WordPress](https://github.com/WordPress/WordPress) GitHub repository. -->

Você pode especificar a referência em `"url": "https://playground.wordpress.net/plugin-proxy.php?build-ref=trunk"`.

<!-- You can specify the reference in `"url": "https://playground.wordpress.net/plugin-proxy.php?build-ref=trunk"`. -->

Para especificar o commit mais recente de um branch específico, você pode alterar a referência para o número da versão do branch, por exemplo `6.6`. Para executar um commit específico, você pode usar o hash do commit de [WordPress/WordPress](https://github.com/WordPress/WordPress), por exemplo `7d7a52367dee9925337e7d901886c2e9b21f70b6`.

<!-- To specify the latest commit of a particular branch, you can change the reference to the branch version number, eg `6.6`. To run a specific commit, you can use the commit hash from [WordPress/WordPress](https://github.com/WordPress/WordPress), eg `7d7a52367dee9925337e7d901886c2e9b21f70b6`. -->

**Nota:** a versão mais antiga suportada do WordPress é `6.2.1`, seguindo o plugin de integração SQLite.

<!-- **Note:** the oldest supported WordPress version is `6.2.1`, following the SQLite integration plugin. -->

<BlueprintExample blueprint={{
    "landingPage": "/wp-admin",
	"login" : true,
	"preferredVersions" : {
		"php": "8.3",
		"wp": "https://playground.wordpress.net/plugin-proxy.php?build-ref=trunk"
	}
}} />

## Usando Bundles de Blueprint

<!-- ## Using Blueprint Bundles -->

Aqui está um exemplo de um Blueprint que usa recursos agrupados de um bundle de Blueprint:

<!-- Here's an example of a Blueprint that uses bundled resources from a Blueprint bundle: -->

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

Este bundle de Blueprint seria um arquivo zip contendo os seguintes arquivos:

<!-- This Blueprint bundle would be zip file containing the following files: -->

- `/blueprint.json` - A declaração do blueprint descrita acima
      <!-- - `/blueprint.json` - The blueprint declaration outlined above -->
- `/my-theme.zip` - Um pacote de tema
      <!-- - `/my-theme.zip` - A theme package -->
- `/my-plugin.zip` - Um pacote de plugin
      <!-- - `/my-plugin.zip` - A plugin package -->
- `/assets/custom-page.html` - Um arquivo HTML personalizado
      <!-- - `/assets/custom-page.html` - A custom HTML file -->

Você pode usar este bundle de Blueprint ao:

<!-- You can use this Blueprint bundle by: -->

1. Criar um arquivo ZIP com esses arquivos e o blueprint.json
 <!-- 1. Creating a ZIP file with these files and the blueprint.json -->
2. Hospedar o arquivo ZIP em um servidor
 <!-- 2. Hosting the ZIP file on a server -->
3. Carregá-lo com `?blueprint-url=https://example.com/my-blueprint-bundle.zip`
 <!-- 3. Loading it with `?blueprint-url=https://example.com/my-blueprint-bundle.zip` -->

Para mais informações sobre bundles de Blueprint, consulte a documentação de [Bundles de Blueprint](/blueprints/bundles).

<!-- For more information on Blueprint bundles, see the [Blueprint Bundles](/blueprints/bundles) documentation. -->
