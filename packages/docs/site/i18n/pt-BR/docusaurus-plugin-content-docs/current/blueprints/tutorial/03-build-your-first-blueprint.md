---
title: Crie seu primeiro Blueprint
slug: /blueprints/tutorial/build-your-first-blueprint
description: Um tutorial passo a passo para criar seu primeiro Blueprint. Aprenda a instalar temas, plugins e importar conteúdo do site.
---

# Construa seu primeiro Blueprint

Vamos construir um Blueprint elementar que

1. Cria um novo site WordPress
2. Define o título do site como "Meu primeiro Blueprint"
3. Instala o tema _Adventurer_
4. Instala o plugin _Hello Dolly_ do diretório de plugins do WordPress
5. Instala um plugin customizado
6. Altera o conteúdo do site

## 1. Crie um novo site WordPress

Comece criando um arquivo `blueprint.json` com o seguinte conteúdo:

```json
{}
```

Pode parecer que nada está acontecendo, mas este Blueprint já inicia um site WordPress com a versão principal mais recente.

[<kbd> &nbsp; Executar Blueprint &nbsp; </kbd>](https://playground.wordpress.net/#{})

:::tip **Autocompletar**

Se você usar uma IDE, como VS Code ou PHPStorm, pode usar o [Blueprint JSON Schema](https://playground.wordpress.net/blueprint-schema.json) para uma experiência de desenvolvimento Blueprint com autocompletar. Adicione a seguinte linha no topo do seu arquivo `blueprint.json`:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json"
}
```

:::

Veja como fica no VS Code:

![Autocompletar visualizado](@site/static/img/blueprints/schema-autocompletion.webp)

## 2. Defina o título do site como "Meu primeiro Blueprint"

Blueprints consistem em uma série de [etapas](/blueprints/steps) que definem como construir um site WordPress. Antes de escrever a primeira etapa, declare uma lista vazia de etapas:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"steps": []
}
```

Este Blueprint não é muito emocionante. Cria o mesmo site padrão que o Blueprint vazio acima. Vamos mudar isso!

O WordPress armazena o título do site na opção `blogname`. Adicione sua primeira etapa e defina essa opção como "Meu primeiro Blueprint":

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"steps": [
		{
			"step": "setSiteOptions",
			"options": {
				"blogname": "Meu primeiro Blueprint"
			}
		}
	]
}
```

[<kbd> &nbsp; Executar Blueprint &nbsp; </kbd>](https://playground.wordpress.net/#https://playground.wordpress.net/#eyIkc2NoZW1hIjoiaHR0cHM6Ly9wbGF5Z3JvdW5kLndvcmRwcmVzcy5uZXQvYmx1ZXByaW50LXNjaGVtYS5qc29uIiwic3RlcHMiOlt7InN0ZXAiOiJzZXRTaXRlT3B0aW9ucyIsIm9wdGlvbnMiOnsiYmxvZ25hbWUiOiJNeSBmaXJzdCBCbHVlcHJpbnQifX1dfQ==)

A etapa [`setSiteOptions`](/blueprints/steps#SetSiteOptionsStep) especifica as opções do site no banco de dados do WordPress. O objeto `options` contém os pares chave-valor a serem definidos. Neste caso, você alterou o valor da chave `blogname` para "Meu primeiro Blueprint". Você pode ler mais sobre todas as etapas disponíveis em [Blueprint Steps API Reference](/blueprints/steps).

### Atalhos

Você pode especificar algumas etapas usando uma sintaxe de atalho. Por exemplo, você poderia escrever a etapa `setSiteOptions` assim:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"siteOptions": {
		"blogname": "Meu primeiro Blueprint"
	}
}
```

A sintaxe de atalho e a sintaxe de etapa correspondem uma à outra. Cada etapa especificada com a sintaxe de atalho é automaticamente adicionada no início do array `steps` em ordem arbitrária. Qual você deve escolher? Use atalhos quando a brevidade for sua principal preocupação, use etapas quando precisar de mais controle sobre a ordem de execução.

## 3. Instale o tema _Adventurer_

Adventurer é um tema de código aberto [disponível no diretório de temas do WordPress](https://wordpress.org/themes/adventurer/). Vamos instalá-lo usando a etapa [`installTheme`](/blueprints/steps#InstallThemeStep):

```json
{
	"siteOptions": {
		"blogname": "Meu primeiro Blueprint"
	},
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "adventurer"
			}
		}
	]
}
```

[<kbd> &nbsp; Executar Blueprint &nbsp; </kbd>](https://playground.wordpress.net/#eyIkc2NoZW1hIjoiaHR0cHM6Ly9wbGF5Z3JvdW5kLndvcmRwcmVzcy5uZXQvYmx1ZXByaW50LXNjaGVtYS5qc29uIiwib3B0aW9ucyI6eyJibG9nbmFtZSI6Ik15IGZpcnN0IEJsdWVwcmludCJ9LCJzdGVwcyI6W3sic3RlcCI6Imluc3RhbGxUaGVtZSIsInRoZW1lWmlwRmlsZSI6eyJyZXNvdXJjZSI6IndvcmRwcmVzcy5vcmcvdGhlbWVzIiwic2x1ZyI6ImFkdmVudHVyZXIifX1dfQ==)

O site agora deve se parecer com a captura de tela abaixo:

![Site com o tema adventurer](@site/static/img/blueprints/installed-adventurer-theme.webp)

### Recursos

O `themeData` define um [recurso](/blueprints/steps/resources) e faz referência a um arquivo externo necessário para concluir a etapa. O Playground suporta diferentes tipos de recursos, incluindo

-   `url`,
-   `wordpress.org/themes`,
-   `wordpress.org/plugins`,
-   `vfs` (sistema de arquivos virtual), ou
-   `literal`.

O exemplo usa o recurso `wordpress.org/themes`, que requer um `slug` idêntico ao usado no diretório de temas do WordPress:

Neste caso, `https://wordpress.org/themes/<slug>/` se torna `https://wordpress.org/themes/adventurer/`.

:::note
Saiba mais sobre os recursos suportados em [Blueprint Resources API Reference](/blueprints/steps/resources/).
:::

## 4. Instale o plugin _Hello Dolly_

Um plugin clássico do WordPress que exibe letras aleatórias da música "Hello, Dolly!" no painel de administração. Vamos instalá-lo usando a etapa [`installPlugin`](/blueprints/steps#InstallPluginStep):

```json
{
	"siteOptions": {
		"blogname": "Meu primeiro Blueprint"
	},
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "adventurer"
			}
		},
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "wordpress.org/plugins",
				"slug": "hello-dolly"
			}
		}
	]
}
```

[<kbd> &nbsp; Executar Blueprint &nbsp; </kbd>](https://playground.wordpress.net/#eyJzaXRlT3B0aW9ucyI6eyJibG9nbmFtZSI6Ik15IGZpcnN0IEJsdWVwcmludCJ9LCJzdGVwcyI6W3sic3RlcCI6Imluc3RhbGxUaGVtZSIsInRoZW1lWmlwRmlsZSI6eyJyZXNvdXJjZSI6IndvcmRwcmVzcy5vcmcvdGhlbWVzIiwic2x1ZyI6ImFkdmVudHVyZXIifX0seyJzdGVwIjoiaW5zdGFsbFBsdWdpbiIsInBsdWdpblppcEZpbGUiOnsicmVzb3VyY2UiOiJ3b3JkcHJlc3Mub3JnL3BsdWdpbnMiLCJzbHVnIjoiaGVsbG8tZG9sbHkifX1dfQ==)

O plugin Hello Dolly agora está instalado e ativado.

Como o `themeData`, o `pluginData` define uma referência a um arquivo externo necessário para a etapa. O exemplo usa o recurso `wordpress.org/plugins` para instalar o plugin com o `slug` correspondente do diretório de plugins do WordPress.

## 5. Instale um plugin customizado

Vamos instalar um plugin customizado do WordPress que adiciona uma mensagem ao painel de administração:

```php
<?php
/*
Plugin Name: "Hello" no Painel
Description: Um plugin customizado para demonstrar WordPress Blueprints
Version: 1.0
Author: WordPress Contributors
*/

function my_custom_plugin() {
	echo '<h1>Olá do Meu Plugin Customizado!</h1>';
}

add_action('admin_notices', 'my_custom_plugin');
```

Você pode usar o [installPlugin](/blueprints/steps#InstallPluginStep), mas isso requer criar um arquivo ZIP. Vamos começar com algo diferente para ver se o plugin funciona:

1. Crie um diretório `wp-content/plugins/hello-from-the-dashboard` usando a etapa [`mkdir`](/blueprints/steps#MkdirStep).
2. Escreva um arquivo `plugin.php` usando a etapa [`writeFile`](/blueprints/steps#WriteFileStep).
3. Ative o plugin usando a etapa [`activatePlugin`](/blueprints/steps#ActivatePluginStep).

Veja como fica em um Blueprint:

```json
{
	// ...
	"steps": [
		// ...
		{
			"step": "mkdir",
			"path": "/wordpress/wp-content/plugins/hello-from-the-dashboard"
		},
		{
			"step": "writeFile",
			"path": "/wordpress/wp-content/plugins/hello-from-the-dashboard/plugin.php",
			"data": "<?php\n/*\nPlugin Name: \"Hello\" no Painel\nDescription: Um plugin customizado para demonstrar WordPress Blueprints\nVersion: 1.0\nAuthor: WordPress Contributors\n*/\n\nfunction my_custom_plugin() {\n    echo '<h1>Olá do Meu Plugin Customizado!</h1>';\n}\n\nadd_action('admin_notices', 'my_custom_plugin');"
		},
		{
			"step": "activatePlugin",
			"pluginPath": "hello-from-the-dashboard/plugin.php"
		}
	]
}
```

A última coisa a fazer é fazer o login do usuário como administrador. Você pode fazer isso com um atalho da etapa [`login`](/blueprints/steps#LoginStep):

```json
{
	"login": true,
	"steps": {
		// ...
	}
}
```

Aqui está o Blueprint completo:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"login": true,
	"siteOptions": {
		"blogname": "Meu primeiro Blueprint"
	},
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "adventurer"
			}
		},
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "wordpress.org/plugins",
				"slug": "hello-dolly"
			}
		},
		{
			"step": "mkdir",
			"path": "/wordpress/wp-content/plugins/hello-from-the-dashboard"
		},
		{
			"step": "writeFile",
			"path": "/wordpress/wp-content/plugins/hello-from-the-dashboard/plugin.php",
			"data": "<?php\n/*\nPlugin Name: \"Hello\" no Painel\nDescription: Um plugin customizado para demonstrar WordPress Blueprints\nVersion: 1.0\nAuthor: WordPress Contributors\n*/\n\nfunction my_custom_plugin() {\n    echo '<h1>Olá do Meu Plugin Customizado!</h1>';\n}\n\nadd_action('admin_notices', 'my_custom_plugin');"
		},
		{
			"step": "activatePlugin",
			"pluginPath": "hello-from-the-dashboard/plugin.php"
		}
	]
}
```

[<kbd> &nbsp; Executar Blueprint &nbsp; </kbd>](https://playground.wordpress.net/#eyJsb2dpbiI6dHJ1ZSwic2l0ZU9wdGlvbnMiOnsiYmxvZ25hbWUiOiJNeSBmaXJzdCBCbHVlcHJpbnQifSwic3RlcHMiOlt7InN0ZXAiOiJpbnN0YWxsVGhlbWUiLCJ0aGVtZVppcEZpbGUiOnsicmVzb3VyY2UiOiJ3b3JkcHJlc3Mub3JnL3RoZW1lcyIsInNsdWciOiJhZHZlbnR1cmVyIn19LHsic3RlcCI6Imluc3RhbGxQbHVnaW4iLCJwbHVnaW5aaXBGaWxlIjp7InJlc291cmNlIjoid29yZHByZXNzLm9yZy9wbHVnaW5zIiwic2x1ZyI6ImhlbGxvLWRvbGx5In19LHsic3RlcCI6Im1rZGlyIiwicGF0aCI6Ii93b3JkcHJlc3Mvd3AtY29udGVudC9wbHVnaW5zL2hlbGxvLW9uLXRoZS1kYXNoYm9hcmQifSx7InN0ZXAiOiJ3cml0ZUZpbGUiLCJwYXRoIjoiL3dvcmRwcmVzcy93cC1jb250ZW50L3BsdWdpbnMvaGVsbG8tb24tdGhlLWRhc2hib2FyZC9wbHVnaW4ucGhwIiwiZGF0YSI6Ijw/cGhwXG4vKlxuUGx1Z2luIE5hbWU6IFwiSGVsbG9cIiBvbiB0aGUgRGFzaGJvYXJkXG5EZXNjcmlwdGlvbjogQSBjdXN0b20gcGx1Z2luIHRvIHNob3djYXNlIFdvcmRQcmVzcyBCbHVlcHJpbnRzXG5WZXJzaW9uOiAxLjBcbkF1dGhvcjogV29yZFByZXNzIENvbnRyaWJ1dG9yc1xuKi9cblxuZnVuY3Rpb24gbXlfY3VzdG9tX3BsdWdpbigpIHtcbiAgICBlY2hvICc8aDE+SGVsbG8gZnJvbSBNeSBDdXN0b20gUGx1Z2luITwvaDE+Jztcbn1cblxuYWRkX2FjdGlvbignYWRtaW5fbm90aWNlcycsICdteV9jdXN0b21fcGx1Z2luJyk7In0seyJzdGVwIjoiYWN0aXZhdGVQbHVnaW4iLCJwbHVnaW5QYXRoIjoiaGVsbG8tb24tdGhlLWRhc2hib2FyZC9wbHVnaW4ucGhwIn1dfQ==)

Veja como fica quando você navega para o painel:

![Site com o plugin customizado](@site/static/img/blueprints/installed-custom-plugin.webp)

### Crie um plugin e compacte-o

Codificar arquivos PHP como `JSON` pode ser útil para testes rápidos, mas é inconveniente e difícil de ler. Em vez disso, crie um arquivo com o código do plugin, comprima-o e use o arquivo `ZIP` como `resource` na etapa [`installPlugin`](/blueprints/steps#InstallPluginStep) para instalá-lo (o caminho na `URL` deve corresponder ao do seu repositório GitHub):

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"login": true,
	"siteOptions": {
		"blogname": "Meu primeiro Blueprint"
	},
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "adventurer"
			}
		},
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "wordpress.org/plugins",
				"slug": "hello-dolly"
			}
		},
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "url",
				"url": "https://raw.githubusercontent.com/wordpress/blueprints/trunk/docs/assets/hello-from-the-dashboard.zip"
			}
		}
	]
}
```

Você pode encurtar ainda mais esse Blueprint usando a sintaxe de atalho:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"login": true,
	"siteOptions": {
		"blogname": "Meu primeiro Blueprint"
	},
	"plugins": ["hello-dolly", "https://raw.githubusercontent.com/wordpress/blueprints/trunk/docs/assets/hello-from-the-dashboard.zip"],
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "adventurer"
			}
		}
	]
}
```

[<kbd> &nbsp; Executar Blueprint &nbsp; </kbd>](https://playground.wordpress.net/#eyIkc2NoZW1hIjoiaHR0cHM6Ly9wbGF5Z3JvdW5kLndvcmRwcmVzcy5uZXQvYmx1ZXByaW50LXNjaGVtYS5qc29uIiwibG9naW4iOnRydWUsInNpdGVPcHRpb25zIjp7ImJsb2duYW1lIjoiTXkgZmlyc3QgQmx1ZXByaW50In0sInBsdWdpbnMiOlsiaGVsbG8tZG9sbHkiLCJodHRwczovL3Jhdy5naXRodWJ1c2VyY29udGVudC5jb20vYWRhbXppZWwvYmx1ZXByaW50cy90cnVuay9kb2NzL2hlbGxvLW9uLXRoZS1kYXNoYm9hcmQuemlwIl0sInN0ZXBzIjpbeyJzdGVwIjoiaW5zdGFsbFRoZW1lIiwidGhlbWVaaXBGaWxlIjp7InJlc291cmNlIjoid29yZHByZXNzLm9yZy90aGVtZXMiLCJzbHVnIjoiYWR2ZW50dXJlciJ9fV19)

## 6. Altere o conteúdo do site

Por fim, vamos excluir o conteúdo padrão do site e importar um novo de um arquivo de exportação do WordPress (WXR).

### Exclua o conteúdo antigo

Não há uma etapa Blueprint para excluir o conteúdo padrão, mas você pode fazer isso com um trecho de código PHP:

```php
<?php
require '/wordpress/wp-load.php';

// Delete all posts and pages
$posts = get_posts(array(
	'numberposts' => -1,
	'post_type' => array('post', 'page'),
	'post_status' => 'any'
));

foreach ($posts as $post) {
	wp_delete_post($post->ID, true);
}
```

Para executar esse código durante a configuração do site, use a etapa [`runPHP`](/blueprints/steps#RunPHPStep):

```json
{
	// ...
	"steps": [
		// ...
		{
			"step": "runPHP",
			"code": "<?php\nrequire '/wordpress/wp-load.php';\n\n$posts = get_posts(array(\n    'numberposts' => -1,\n    'post_type' => array('post', 'page'),\n    'post_status' => 'any'\n));\n\nforeach ($posts as $post) {\n    wp_delete_post($post->ID, true);\n}"
		}
	]
}
```

### Importe o novo conteúdo

Vamos usar a etapa [`importWxr`](/blueprints/steps#ImportWXRStep) para importar um arquivo de exportação do WordPress (`WXR`) que ajuda a testar temas do WordPress. O arquivo está disponível no repositório [WordPress/theme-test-data](https://github.com/WordPress/theme-test-data), e você pode acessá-lo através de seu endereço `raw.githubusercontent.com`: [https://raw.githubusercontent.com/WordPress/theme-test-data/master/themeunittestdata.wordpress.xml](https://raw.githubusercontent.com/WordPress/theme-test-data/master/themeunittestdata.wordpress.xml).

Veja como fica o Blueprint final:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"login": true,
	"siteOptions": {
		"blogname": "Meu primeiro Blueprint"
	},
	"plugins": ["hello-dolly", "https://raw.githubusercontent.com/wordpress/blueprints/trunk/docs/assets/hello-from-the-dashboard.zip"],
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "adventurer"
			}
		},
		{
			"step": "runPHP",
			"code": "<?php\nrequire '/wordpress/wp-load.php';\n\n$posts = get_posts(array(\n    'numberposts' => -1,\n    'post_type' => array('post', 'page'),\n    'post_status' => 'any'\n));\n\nforeach ($posts as $post) {\n    wp_delete_post($post->ID, true);\n}"
		},
		{
			"step": "importWxr",
			"file": {
				"resource": "url",
				"url": "https://raw.githubusercontent.com/WordPress/theme-test-data/master/themeunittestdata.wordpress.xml"
			}
		}
	]
}
```

[<kbd> &nbsp; Executar Blueprint &nbsp; </kbd>](https://playground.wordpress.net/#eyIkc2NoZW1hIjoiaHR0cHM6Ly9wbGF5Z3JvdW5kLndvcmRwcmVzcy5uZXQvYmx1ZXByaW50LXNjaGVtYS5qc29uIiwibG9naW4iOnRydWUsInNpdGVPcHRpb25zIjp7ImJsb2duYW1lIjoiTXkgZmlyc3QgQmx1ZXByaW50In0sInBsdWdpbnMiOlsiaGVsbG8tZG9sbHkiLCJodHRwczovL3Jhdy5naXRodWJ1c2VyY29udGVudC5jb20vYWRhbXppZWwvYmx1ZXByaW50cy90cnVuay9kb2NzL2Fzc2V0cy9oZWxsby1mcm9tLXRoZS1kYXNoYm9hcmQuemlwIl0sInN0ZXBzIjpbeyJzdGVwIjoiaW5zdGFsbFRoZW1lIiwidGhlbWVaaXBGaWxlIjp7InJlc291cmNlIjoid29yZHByZXNzLm9yZy90aGVtZXMiLCJzbHVnIjoiYWR2ZW50dXJlciJ9fSx7InN0ZXAiOiJydW5QSFAiLCJjb2RlIjoiPD9waHBcbnJlcXVpcmUgJy93b3JkcHJlc3Mvd3AtbG9hZC5waHAnO1xuXG4kcG9zdHMgPSBnZXRfcG9zdHMoYXJyYXkoXG4gICAgJ251bWJlcnBvc3RzJyA9PiAtMSxcbiAgICAncG9zdF90eXBlJyA9PiBhcnJheSgncG9zdCcsICdwYWdlJyksXG4gICAgJ3Bvc3Rfc3RhdHVzJyA9PiAnYW55J1xuKSk7XG5cbmZvcmVhY2ggKCRwb3N0cyBhcyAkcG9zdCkge1xuICAgIHdwX2RlbGV0ZV9wb3N0KCRwb3N0LT5JRCwgdHJ1ZSk7XG59In0seyJzdGVwIjoiaW1wb3J0V3hyIiwiZmlsZSI6eyJyZXNvdXJjZSI6InVybCIsInVybCI6Imh0dHBzOi8vcmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbS9Xb3JkUHJlc3MvdGhlbWUtdGVzdC1kYXRhL21hc3Rlci90aGVtZXVuaXR0ZXN0ZGF0YS53b3JkcHJlc3MueG1sIn19XX0=)

E pronto. Parabéns por criar seu primeiro Blueprint! 🥳
