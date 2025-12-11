---
sidebar_position: 8
title: Exemplos
slug: /blueprints/examples
description: Uma galeria de exemplos práticos de Blueprint para várias tarefas, como instalar temas, executar PHP e habilitar recursos.
---

import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

# Exemplos de Blueprints

:::tip

<!-- Check the [Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) to explore real-world code examples of using WordPress Playground to launch a WordPress site with a variety of setups. -->

Confira a [Galeria de Blueprints](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) para explorar exemplos de código do mundo real de como usar o WordPress Playground para lançar um site WordPress com uma variedade de configurações.
:::

<!-- Let's see some cool things you can do with Blueprints. -->

Vamos ver algumas coisas legais que você pode fazer com Blueprints.

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

## Executar código PHP personalizado

<BlueprintExample
display={`{
	"steps": [
		{
			"step": "runPHP",
			"code": "<?php require_once '/wordpress/wp-load.php'; wp_insert_post(array( 'post_title' => 'Título do post', 'post_content' => 'Conteúdo do post', 'post_status' => 'publish', 'post_author' => 1 )); "
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
'post_title' => 'Título do post',
'post_content' => 'Conteúdo do post',
'post_status' => 'publish',
'post_author' => 1
));
`
}
]
}} />

## Habilitar uma opção na página de Experimentos do Gutenberg

<!-- Here: Switch on the "new admin views" feature. -->

Aqui: Ative o recurso "novas visualizações de administração".

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

<!-- You can run WP-CLI commands on a Playground instance either from your terminal or directly within a Blueprint. -->

Você pode executar comandos WP-CLI em uma instância do Playground tanto pelo seu terminal quanto diretamente dentro de um Blueprint.

<!-- To use your terminal, you must first mount the `/wordpress/` directory and ensure the SQLite database integration is configured. This is because Playground's internal database doesn't persist on a mounted site, so you must explicitly install the database plugin via a Blueprint. This allows WP-CLI to recognize the WordPress installation and connect to its database. -->

Para usar seu terminal, você deve primeiro montar o diretório `/wordpress/` e garantir que a integração do banco de dados SQLite esteja configurada. Isso ocorre porque o banco de dados interno do Playground não persiste em um site montado, então você deve explicitamente instalar o plugin de banco de dados via um Blueprint. Isso permite que o WP-CLI reconheça a instalação do WordPress e se conecte ao seu banco de dados.

:::note

<!-- If you run WP-CLI commands as steps within your Blueprint file, this manual setup is not needed. -->

Se você executar comandos WP-CLI como etapas dentro do seu arquivo Blueprint, essa configuração manual não é necessária.
:::

<!-- The following Blueprint snippet handles this setup: -->

O seguinte trecho de Blueprint lida com essa configuração:

<BlueprintExample blueprint={{
	"plugins": [ "sqlite-database-integration" ]
}} />

<!-- For a detailed explanation of why this is needed, refer to the [Troubleshoot and Debug Blueprints](/blueprints/troubleshoot-and-debug#wp-cli-error-establishing-a-database-connection-on-mounted-sites) section. -->

Para uma explicação detalhada do porquê isso é necessário, consulte a seção [Solução de Problemas e Depuração de Blueprints](/blueprints/troubleshoot-and-debug#wp-cli-error-establishing-a-database-connection-on-mounted-sites).

## Mostrar uma demonstração de produto

<BlueprintExample noButton blueprint={{
	"steps": [
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "url",
				"url": "https://seu-site.com/seu-plugin.zip"
			}
		},
		{
			"step": "installTheme",
			"themeData": {
				"resource": "url",
				"url": "https://seu-site.com/seu-tema.zip"
			}
		},
		{
			"step": "importWxr",
			"file": {
				"resource": "url",
				"url": "https://seu-site.com/conteudo-inicial.wxr"
			}
		},
		{
			"step": "setSiteOptions",
			"options": {
				"some_required_option_1": "seus_valores_favoritos",
				"some_required_option_2": "seus_valores_favoritos"
			}
		}
	]
}} />

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

## Carregar código PHP em cada requisição (mu-plugin)

<!-- Use the `writeFile` step to add code to a mu-plugin that runs on every request. -->

Use a etapa `writeFile` para adicionar código a um mu-plugin que é executado em cada requisição.

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

## Editor de código (como um bloco do Gutenberg)

<BlueprintExample blueprint={{
  "landingPage": "/wp-admin/post.php?post=4&action=edit",
  "steps": [
	{
	  "step": "login",
	  "username": "admin",
	  "password": "senha"
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
	  "code": "<?php require '/wordpress/wp-load.php'; wp_insert_post(['post_title' => 'Demonstração do bloco WordPress Playground!','post_content' => '<!-- wp:wordpress-playground/playground /-->', 'post_status' => 'publish', 'post_type' => 'post',]);"
	}
  ]
}} />

<!-- You can share your own Blueprint examples in [this dedicated wiki](https://github.com/WordPress/wordpress-playground/wiki/Blueprint-examples). -->

Você pode compartilhar seus próprios exemplos de Blueprint nesta [wiki dedicada](https://github.com/WordPress/wordpress-playground/wiki/Blueprint-examples).

## Carregar uma versão mais antiga do WordPress

<!-- Playground only ships with a few recent WordPress releases. If you need to use an older version, this Blueprint can help you: change the version number in `"url": "https://playground.wordpress.net/plugin-proxy.php?url=https://wordpress.org/wordpress-6.2.1.zip"` from `6.2.1` to the release you want to load. -->

O Playground só vem com algumas versões recentes do WordPress. Se você precisar usar uma versão mais antiga, este Blueprint pode ajudar: mude o número da versão em `"url": "https://playground.wordpress.net/plugin-proxy.php?url=https://wordpress.org/wordpress-6.2.1.zip"` de `6.2.1` para a versão que você deseja carregar.

**Nota:** <!-- the oldest supported WordPress version is `6.2.1`, following the SQLite integration plugin. -->
a versão mais antiga suportada do WordPress é `6.2.1`, seguindo o plugin de integração do SQLite.

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
	  "password": "senha"
	}
  ]
}} />

## Executar o WordPress a partir do trunk ou de um commit específico.

<!-- WordPress Playground can run `trunk` (the latest commit), the HEAD of a specific branch or a specific commit from the [WordPress/WordPress](https://github.com/WordPress/WordPress) GitHub repository. -->

O WordPress Playground pode executar `trunk` (o último commit), o HEAD de um branch específico ou um commit específico do repositório [WordPress/WordPress](https://github.com/WordPress/WordPress).

<!-- You can specify the reference in `"url": "https://playground.wordpress.net/plugin-proxy.php?build-ref=trunk"`. -->

Você pode especificar a referência em `"url": "https://playground.wordpress.net/plugin-proxy.php?build-ref=trunk"`.

<!-- To specify the latest commit of a particular branch, you can change the reference to the branch version number, eg `6.6`. To run a specific commit, you can use the commit hash from [WordPress/WordPress](https://github.com/WordPress/WordPress), eg `7d7a52367dee9925337e7d901886c2e9b21f70b6`. -->

Para especificar o último commit de um branch específico, você pode mudar a referência para o número da versão do branch, por exemplo, `6.6`. Para executar um commit específico, você pode usar o hash do commit do [WordPress/WordPress](https://github.com/WordPress/WordPress), por exemplo, `7d7a52367dee9925337e7d901886c2e9b21f70b6`.

**Nota:** <!-- the oldest supported WordPress version is `6.2.1`, following the SQLite integration plugin. -->
a versão mais antiga suportada do WordPress é `6.2.1`, seguindo o plugin de integração do SQLite.

<BlueprintExample blueprint={{
	"landingPage": "/wp-admin",
	"login" : true,
	"preferredVersions" : {
		"php": "8.3",
		"wp": "https://playground.wordpress.net/plugin-proxy.php?build-ref=trunk"
	}
}} />

## Usando Pacotes de Blueprint

<!-- Here's an example of a Blueprint that uses bundled resources from a Blueprint bundle: -->

Aqui está um exemplo de um Blueprint que usa recursos agrupados de um pacote de Blueprint:

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
				"path": "/meu-tema.zip"
			},
			"activate": true
		},
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "bundled",
				"path": "/meu-plugin.zip"
			},
			"activate": true
		},
		{
			"step": "writeFile",
			"path": "/wordpress/pagina-personalizada.html",
			"data": {
				"resource": "bundled",
				"path": "/assets/pagina-personalizada.html"
			}
		}
	]
}
```

<!-- This Blueprint bundle would be zip file containing the following files: -->

Este pacote de Blueprint seria um arquivo zip contendo os seguintes arquivos:

- `/blueprint.json` - A declaração do blueprint descrita acima
- `/meu-tema.zip` - Um pacote de tema
- `/meu-plugin.zip` - Um pacote de plugin
- `/assets/pagina-personalizada.html` - Um arquivo HTML personalizado

<!-- You can use this Blueprint bundle by: -->

Você pode usar este pacote de Blueprint para:

<!-- Creating a ZIP file with these files and the blueprint.json -->

1. Criar um arquivo ZIP com esses arquivos e o blueprint.json
 <!-- Hosting the ZIP file on a server -->
2. Hospedar o arquivo ZIP em um servidor
 <!-- Loading it with `?blueprint-url=https://example.com/meu-pacote-blueprint.zip` -->
3. Carregá-lo com `?blueprint-url=https://exemplo.com/meu-pacote-blueprint.zip`

<!-- For more information on Blueprint bundles, see the [Blueprint Bundles](/blueprints/bundles) documentation. -->

Para mais informações sobre pacotes de Blueprint, consulte a documentação sobre [Pacotes de Blueprint](/blueprints/bundles).
