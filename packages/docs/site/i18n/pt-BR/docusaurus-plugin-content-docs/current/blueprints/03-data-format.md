---
sidebar_position: 1
title: Formato de dados do Blueprint
slug: /blueprints/data-format
description: Uma visão geral do formato de dados do Blueprint. Aprenda sobre propriedades importantes como landingPage, preferredVersions e steps.
---

<!-- title: Blueprint data Format -->

<!-- description: An overview of the Blueprint data format. Learn about key properties like landingPage, preferredVersions, and steps. -->

<!-- # Blueprint data format -->

# Formato de dados do Blueprint

<!-- A Blueprint JSON file can have many different properties that will be used to define your Playground instance. The most important properties are detailed below. -->

Um arquivo JSON de Blueprint pode ter várias propriedades diferentes que serão
usadas para definir sua instância do Playground. As propriedades mais
importantes são detalhadas abaixo.

<!-- Here's an example that uses many of them: -->

Este é um exemplo que usa várias delas:

import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

<BlueprintExample blueprint={{
	"landingPage": "/wp-admin/",
	"preferredVersions": {
		"php": "8.3",
		"wp": "6.5"
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

<!-- ## JSON schema -->

## Esquema JSON

<!-- JSON files can be tedious to write and easy to get wrong. To help with that, Playground provides a [JSON schema](https://playground.wordpress.net/blueprint-schema.json) file that you can use to get auto-completion and validation in your editor. Just set the `$schema` property to the following: -->

Arquivos JSON podem ser tediosos de escrever e fáceis de errar. Para ajudar
com isso, o Playground fornece um arquivo de
[esquema JSON](https://playground.wordpress.net/blueprint-schema.json) que você
pode usar para ter preenchimento automático e validação no editor. Basta definir
a propriedade `$schema` assim:

```js
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
}
```

<!-- ## Landing page -->

## Página inicial

<!-- The `landingPage` property tells Playground which URL to navigate to after the Blueprint has been run. This is a great tool, especially when creating theme or plugin demos. Often, you will want to start Playground in the Site Editor or have a specific post open in the Post Editor. Make sure you use a relative path. -->

A propriedade `landingPage` informa ao Playground para qual URL navegar depois
que o Blueprint for executado. Ela é uma ótima ferramenta, especialmente ao
criar demonstrações de temas ou plugins. Muitas vezes, você vai querer iniciar
o Playground no Editor do site ou abrir um post específico no Editor de posts.
Use sempre um caminho relativo.

```js
{
	"landingPage": "/wp-admin/site-editor.php",
}
```

<!-- ## Preferred versions -->

## Versões preferenciais

<!-- The `preferredVersions` property declares your preferred PHP and WordPress versions. It can contain the following properties: -->

A propriedade `preferredVersions` declara suas versões preferenciais do PHP e
do WordPress. Ela pode conter as seguintes propriedades:

<!--
- `php` (string): Loads the specified PHP version. Accepts `7.4`, `8.0`, `8.1`, `8.2`, `8.3`, `8.4`, `8.5`, or `latest`. Minor versions like `7.4.1` are not supported.
- `wp` (string): Loads the specified WordPress version. Accepts the last seven major WordPress versions. As of April 28, 2026, that's `6.3`, `6.4`, `6.5`, `6.6`, `6.7`, `6.8`, or `6.9`. You can also use the generic values `latest`, `beta`, or `nightly` (alias `trunk`). `beta` resolves to the most recent Beta or Release Candidate of an active release cycle; `nightly`/`trunk` builds straight from the WordPress development branch.
-->

- `php` (string): Carrega a versão especificada do PHP. Aceita `7.4`, `8.0`, `8.1`, `8.2`, `8.3`, `8.4`, `8.5` ou `latest`. Versões menores como `7.4.1` não são compatíveis.
- `wp` (string): Carrega a versão especificada do WordPress. Aceita as últimas sete versões principais do WordPress. Em 28 de abril de 2026, são `6.3`, `6.4`, `6.5`, `6.6`, `6.7`, `6.8` ou `6.9`. Você também pode usar os valores genéricos `latest`, `beta` ou `nightly` (alias `trunk`). `beta` resolve para a versão Beta ou Release Candidate mais recente de um ciclo de lançamento ativo; `nightly`/`trunk` é criado diretamente a partir do branch de desenvolvimento do WordPress.

```js
{
	"preferredVersions": {
		"php": "8.3",
		"wp": "6.7"
	},
}
```

<!-- ## Features -->

## Recursos

<!-- You can use the `features` property to turn on or off certain features of the Playground instance. It can contain the following properties: -->

Você pode usar a propriedade `features` para ativar ou desativar determinados
recursos da instância do Playground. Ela pode conter as seguintes propriedades:

<!-- - `networking`: Defaults to `true`. Enables or disables the networking support for Playground. If enabled, [`wp_safe_remote_get`](https://developer.wordpress.org/reference/functions/wp_safe_remote_get/) and similar WordPress functions will actually use `fetch()` to make HTTP requests. If disabled, they will immediately fail instead. You will need this property enabled if you want the user to be able to install plugins or themes. -->

- `networking`: O padrão é `true`. Ativa ou desativa o suporte a rede no Playground. Se ativado, [`wp_safe_remote_get`](https://developer.wordpress.org/reference/functions/wp_safe_remote_get/) e funções semelhantes do WordPress usarão `fetch()` para fazer requisições HTTP. Se desativado, elas falharão imediatamente. Você precisará ativar essa propriedade se quiser que a pessoa usuária possa instalar plugins ou temas.

```js
{
	"features": {
		"networking": false
	},
}
```

<!-- ## Extra libraries -->

## Bibliotecas extras

<!-- You can preload extra libraries into the Playground instance. The following libraries are supported: -->

Você pode pré-carregar bibliotecas extras na instância do Playground. As
seguintes bibliotecas são compatíveis:

<!-- - `wp-cli`: Enables WP-CLI support for Playground. If included, WP-CLI will be installed during boot. If not included, you will get an error message when trying to run WP-CLI commands using the JS API. WP-CLI will be installed by default if the blueprint contains any `wp-cli` steps. -->

- `wp-cli`: Ativa o suporte a WP-CLI no Playground. Se incluída, a WP-CLI será instalada durante a inicialização. Se não for incluída, você receberá uma mensagem de erro ao tentar executar comandos WP-CLI usando a API JS. A WP-CLI será instalada por padrão se o Blueprint contiver qualquer etapa `wp-cli`.

```js
{
	"extraLibraries": [ "wp-cli" ],
}
```

<!-- ## Steps -->

## Etapas

<!-- Arguably the most powerful property, `steps` allows you to configure the Playground instance with preinstalled themes, plugins, demo content, and more. The following example logs the user in with a dedicated username and password. It then installs and activates the Gutenberg plugin. [Learn more about steps](/blueprints/steps). -->

Provavelmente a propriedade mais poderosa, `steps` permite configurar a
instância do Playground com temas, plugins, conteúdo de demonstração e muito
mais pré-instalados. O exemplo a seguir autentica o usuário com um nome de
usuário e senha dedicados. Em seguida, instala e ativa o plugin Gutenberg.
[Saiba mais sobre etapas](/blueprints/steps).

```js
{
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
				"slug": "gutenberg"
			}
		},
	]
}
```

<!-- ## Common property placement mistakes -->

## Erros comuns de posicionamento de propriedades

<!--
Blueprint validation errors often come from putting a valid property in the
wrong object.
-->

Erros de validação de Blueprint geralmente acontecem quando uma propriedade
válida é colocada no objeto errado.

<!-- ### Activate a plugin or theme -->

### Ativar um plugin ou tema

<!--
`activate` belongs inside `options`, not inside `pluginData`, `themeData`, or
directly on the step.
-->

`activate` deve ficar dentro de `options`, não dentro de `pluginData`,
`themeData` nem diretamente na etapa.

```json
{
	"step": "installPlugin",
	"pluginData": {
		"resource": "wordpress.org/plugins",
		"slug": "gutenberg"
	},
	"options": {
		"activate": true
	}
}
```

<!-- ### Install plugins with the shorthand -->

### Instalar plugins com o atalho

<!--
The `plugins` shorthand is a top-level Blueprint property. Do not put it inside
`preferredVersions`.
-->

O atalho `plugins` é uma propriedade de nível superior do Blueprint. Não o
coloque dentro de `preferredVersions`.

```json
{
	"preferredVersions": {
		"php": "8.3",
		"wp": "latest"
	},
	"plugins": ["gutenberg"]
}
```

<!-- ### Use one plugin install shape -->

### Usar um único formato de instalação de plugin

<!--
For an `installPlugin` step, use `pluginData`. Do not mix `pluginData` with
older examples or custom objects such as `pluginZipFile`.
-->

Para uma etapa `installPlugin`, use `pluginData`. Não misture `pluginData` com
exemplos antigos ou objetos personalizados como `pluginZipFile`.

```json
{
	"step": "installPlugin",
	"pluginData": {
		"resource": "wordpress.org/plugins",
		"slug": "woocommerce"
	},
	"options": {
		"activate": true
	}
}
```

<!--
The `wordpress.org/plugins` resource needs a separate `slug`. Do not write the
slug into the `resource` value, such as `"wordpress.org/plugins/woocommerce"`.
-->

O recurso `wordpress.org/plugins` precisa de um `slug` separado. Não escreva o
slug no valor de `resource`, como `"wordpress.org/plugins/woocommerce"`.

<!-- ### Keep `preferredVersions` limited to versions -->

### Manter `preferredVersions` limitado a versões

<!--
`preferredVersions` only accepts `php` and `wp`. Use `features` for networking,
`plugins` or `installPlugin` for plugins, and `steps` for ordered setup tasks.
-->

`preferredVersions` aceita somente `php` e `wp`. Use `features` para rede,
`plugins` ou `installPlugin` para plugins, e `steps` para tarefas de
configuração ordenadas.

<!-- ### Use explicit steps when order matters -->

### Usar etapas explícitas quando a ordem importa

<!--
Shorthands such as `plugins`, `login`, `siteOptions`, and `constants` are
expanded before the `steps` array. If one action must happen before another,
write both actions as explicit steps in the order you need.
-->

Atalhos como `plugins`, `login`, `siteOptions` e `constants` são expandidos
antes do array `steps`. Se uma ação precisa acontecer antes de outra, escreva
ambas como etapas explícitas na ordem necessária.
