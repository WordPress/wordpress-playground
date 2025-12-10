---
sidebar_position: 8
title: Exemplos
slug: /blueprints/exemplos
description: Uma galeria de exemplos práticos de Blueprint para várias tarefas, como instalar temas, executar PHP e habilitar recursos.
---

import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

# Exemplos de Blueprints

:::tip
Confira a [Galeria de Blueprints](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) para explorar exemplos de código do mundo real de como usar o WordPress Playground para lançar um site WordPress com uma variedade de configurações.
:::

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

Você pode executar comandos WP-CLI em uma instância do Playground tanto pelo seu terminal quanto diretamente dentro de um Blueprint.

Para usar seu terminal, você deve primeiro montar o diretório `/wordpress/` e garantir que a integração do banco de dados SQLite esteja configurada. Isso ocorre porque o banco de dados interno do Playground não persiste em um site montado, então você deve explicitamente instalar o plugin de banco de dados via um Blueprint. Isso permite que o WP-CLI reconheça a instalação do WordPress e se conecte ao seu banco de dados.

:::note
Se você executar comandos WP-CLI como etapas dentro do seu arquivo Blueprint, essa configuração manual não é necessária.
:::

O seguinte trecho de Blueprint lida com essa configuração:

<BlueprintExample blueprint={{
	"plugins": [ "sqlite-database-integration" ]
}} />

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

Você pode compartilhar seus próprios exemplos de Blueprint nesta [wiki dedicada](https://github.com/WordPress/wordpress-playground/wiki/Blueprint-examples).

## Carregar uma versão mais antiga do WordPress

O Playground só vem com algumas versões recentes do WordPress. Se você precisar usar uma versão mais antiga, este Blueprint pode ajudar: mude o número da versão em `"url": "https://playground.wordpress.net/plugin-proxy.php?url=https://wordpress.org/wordpress-6.2.1.zip"` de `6.2.1` para a versão que você deseja carregar.

**Nota:** a versão mais antiga suportada do WordPress é `6.2.1`, seguindo o plugin de integração do SQLite.

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

O WordPress Playground pode executar `trunk` (o último commit), o HEAD de um branch específico ou um commit específico do repositório [WordPress/WordPress](https://github.com/WordPress/WordPress).

Você pode especificar a referência em `"url": "https://playground.wordpress.net/plugin-proxy.php?build-ref=trunk"`.

Para especificar o último commit de um branch específico, você pode mudar a referência para o número da versão do branch, por exemplo, `6.6`. Para executar um commit específico, você pode usar o hash do commit do [WordPress/WordPress](https://github.com/WordPress/WordPress), por exemplo, `7d7a52367dee9925337e7d901886c2e9b21f70b6`.

**Nota:** a versão mais antiga suportada do WordPress é `6.2.1`, seguindo o plugin de integração do SQLite.

<BlueprintExample blueprint={{
	"landingPage": "/wp-admin",
	"login" : true,
	"preferredVersions" : {
		"php": "8.3",
		"wp": "https://playground.wordpress.net/plugin-proxy.php?build-ref=trunk"
	}
}} />

## Usando Pacotes de Blueprint

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

Este pacote de Blueprint seria um arquivo zip contendo os seguintes arquivos:

-   `/blueprint.json` - A declaração do blueprint descrita acima
-   `/meu-tema.zip` - Um pacote de tema
-   `/meu-plugin.zip` - Um pacote de plugin
-   `/assets/pagina-personalizada.html` - Um arquivo HTML personalizado

Você pode usar este pacote de Blueprint para:

1. Criar um arquivo ZIP com esses arquivos e o blueprint.json
2. Hospedar o arquivo ZIP em um servidor
3. Carregá-lo com `?blueprint-url=https://exemplo.com/meu-pacote-blueprint.zip`

Para mais informações sobre pacotes de Blueprint, consulte a documentação sobre [Pacotes de Blueprint](/blueprints/bundles).

```
