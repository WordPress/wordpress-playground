---
sidebar_position: 1
title: Formato de dados do Blueprint
slug: /blueprints/data-format
description_long: Uma visão geral do formato de dados do Blueprint. Saiba mais sobre propriedades-chave como landingPage, preferredVersions e as etapas.
---

<!--
# Blueprint data format

A Blueprint JSON file can have many different properties that will be used to define your Playground instance. The most important properties are detailed below.

Here's an example that uses many of them:
-->

# Formato de dados do Blueprint

Um arquivo JSON do Blueprint pode ter muitas propriedades diferentes que serão usadas para definir sua instância do Playground. As propriedades mais importantes estão detalhadas abaixo.

Aqui está um exemplo que usa muitas delas:

```js
import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

<BlueprintExample
	blueprint={{
		landingPage: '/wp-admin/',
		preferredVersions: {
			php: '8.3',
			wp: '6.5',
		},
		features: {
			networking: true,
		},
		steps: [
			{
				step: 'login',
				username: 'admin',
				password: 'password',
			},
		],
	}}
/>;
```

<!--
## JSON schema

JSON files can be tedious to write and easy to get wrong. To help with that, Playground provides a [JSON schema](https://playground.wordpress.net/blueprint-schema.json) file that you can use to get auto-completion and validation in your editor. Just set the `$schema` property to the following:
-->

## Esquema JSON

Arquivos JSON podem ser tediosos de escrever e fáceis de cometer erros. Para ajudar com isso, o Playground fornece um arquivo de [esquema JSON](https://playground.wordpress.net/blueprint-schema.json) que você pode usar para obter preenchimento automático e validação no seu editor. Basta definir a propriedade `$schema` para o seguinte:

```js
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
}
```

<!--
## Landing page

The `landingPage` property tells Playground which URL to navigate to after the Blueprint has been run. This is a great tool, especially when creating theme or plugin demos. Often, you will want to start Playground in the Site Editor or have a specific post open in the Post Editor. Make sure you use a relative path.
-->

## Página de destino

A propriedade `landingPage` diz ao Playground para qual URL navegar após o Blueprint ser executado. Esta é uma ótima ferramenta, especialmente ao criar demonstrações de temas ou plugins. Frequentemente, você desejará iniciar o Playground no Editor do Site ou ter uma postagem específica aberta no Editor de Postagens. Certifique-se de usar um caminho relativo.

```js
{
	"landingPage": "/wp-admin/site-editor.php",
}
```

<!--
## Preferred versions

The `preferredVersions` property declares your preferred PHP and WordPress versions. It can contain the following properties:
-->

## Versões preferidas

A propriedade `preferredVersions` declara suas versões preferidas de PHP e WordPress. Ela pode conter as seguintes propriedades:

<!--
- `php` (string): Loads the specified PHP version. Accepts `7.4`, `8.0`, `8.1`, `8.2`, `8.3`, `8.4`, `8.5`, or `latest`. Minor versions like `7.4.1` are not supported.
- `wp` (string): Loads the specified WordPress version. Accepts the last six major WordPress versions. As of September 1, 2025, that's `6.3`, `6.4`, `6.5`, `6.6`, `6.7` or `6.8`. You can also use the generic values `latest`, `nightly`, or `beta`. To use a pre-release version of WordPress, `beta` will load the latest beta or release candidate versions of a release cycle (Beta or RC).
-->

- `php` (string): Carrega a versão PHP especificada. Aceita `7.4`, `8.0`, `8.1`, `8.2`, `8.3`, `8.4`, `8.5` ou `latest`. Versões menores como `7.4.1` não são suportadas.
- `wp` (string): Carrega a versão WordPress especificada. Aceita as últimas seis versões principais do WordPress. A partir de 1º de setembro de 2025, são `6.3`, `6.4`, `6.5`, `6.6`, `6.7` ou `6.8`. Você também pode usar os valores genéricos `latest`, `nightly` ou `beta`. Para usar uma versão pré-lançamento do WordPress, `beta` carregará as versões mais recentes de beta ou candidato a lançamento de um ciclo de lançamento (Beta ou RC).

```js
{
	"preferredVersions": {
		"php": "8.3",
		"wp": "6.7"
	},
}
```

<!--
## Features

You can use the `features` property to turn on or off certain features of the Playground instance. It can contain the following properties:
-->

## Recursos

Você pode usar a propriedade `features` para ativar ou desativar certos recursos da instância do Playground. Ela pode conter as seguintes propriedades:

<!--
- `networking`: Defaults to `true`. Enables or disables the networking support for Playground. If enabled, [`wp_safe_remote_get`](https://developer.wordpress.org/reference/functions/wp_safe_remote_get/) and similar WordPress functions will actually use `fetch()` to make HTTP requests. If disabled, they will immediately fail instead. You will need this property enabled if you want the user to be able to install plugins or themes.
-->

- `networking`: Padrão `true`. Ativa ou desativa o suporte de rede para o Playground. Se habilitado, [`wp_safe_remote_get`](https://developer.wordpress.org/reference/functions/wp_safe_remote_get/) e funções WordPress similares usarão `fetch()` para fazer requisições HTTP. Se desabilitado, elas falharão imediatamente. Você precisará desta propriedade habilitada se quiser que o usuário possa instalar plugins ou temas.

```js
{
	"features": {
		"networking": false
	},
}
```

<!--
## Extra libraries

You can preload extra libraries into the Playground instance. The following libraries are supported:
-->

## Bibliotecas extras

Você pode pré-carregar bibliotecas extras na instância do Playground. As seguintes bibliotecas são suportadas:

<!--
- `wp-cli`: Enables WP-CLI support for Playground. If included, WP-CLI will be installed during boot. If not included, you will get an error message when trying to run WP-CLI commands using the JS API. WP-CLI will be installed by default if the blueprint contains any `wp-cli` steps.
-->

- `wp-cli`: Habilita o suporte WP-CLI para o Playground. Se incluído, WP-CLI será instalado durante a inicialização. Se não incluído, você receberá uma mensagem de erro ao tentar executar comandos WP-CLI usando a API JS. WP-CLI será instalado por padrão se o blueprint contiver algum step `wp-cli`.

```js
{
	"extraLibraries": [ "wp-cli" ],
}
```

<!--
## Steps

Arguably the most powerful property, `steps` allows you to configure the Playground instance with preinstalled themes, plugins, demo content, and more. The following example logs the user in with a dedicated username and password. It then installs and activates the Gutenberg plugin. [Learn more about steps](/blueprints/steps).
-->

## Etapas

Potencialmente a propriedade mais poderosa, `steps` permite que você configure a instância do Playground com temas, plugins, conteúdo de demonstração pré-instalados e muito mais. O exemplo a seguir faz login do usuário com um nome de usuário e senha dedicados. Em seguida, instala e ativa o plugin Gutenberg. [Saiba mais sobre steps](/blueprints/steps).

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
