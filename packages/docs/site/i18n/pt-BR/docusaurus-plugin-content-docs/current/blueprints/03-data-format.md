---
sidebar_position: 1
title: Formato de dados do Blueprint
slug: /blueprints/data-format
description: Uma visão geral do formato de dados do Blueprint. Saiba mais sobre propriedades principais como landingPage, preferredVersions e steps.
---

# Formato de dados do Blueprint

Um arquivo JSON do Blueprint pode ter muitas propriedades diferentes que serão usadas para definir sua instância do Playground. As propriedades mais importantes estão detalhadas abaixo.

Aqui está um exemplo que usa muitas delas:

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

## Esquema JSON

Arquivos JSON podem ser tediosos de escrever e fáceis de cometer erros. Para ajudar com isso, o Playground fornece um arquivo de [esquema JSON](https://playground.wordpress.net/blueprint-schema.json) que você pode usar para obter preenchimento automático e validação no seu editor. Basta definir a propriedade `$schema` para o seguinte:

```js
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
}
```

## Página de destino

A propriedade `landingPage` diz ao Playground para qual URL navegar após o Blueprint ser executado. Esta é uma ótima ferramenta, especialmente ao criar demonstrações de temas ou plugins. Frequentemente, você desejará iniciar o Playground no Editor do Site ou ter uma postagem específica aberta no Editor de Postagens. Certifique-se de usar um caminho relativo.

```js
{
	"landingPage": "/wp-admin/site-editor.php",
}
```

## Versões preferidas

A propriedade `preferredVersions` declara suas versões preferidas de PHP e WordPress. Ela pode conter as seguintes propriedades:

- `php` (string): Carrega a versão PHP especificada. Aceita `7.0`, `7.1`, `7.2`, `7.3`, `7.4`, `8.0`, `8.1`, `8.2`, `8.3`, `8.4`, `8.5` ou `latest`. Versões menores como `7.4.1` não são suportadas.
- `wp` (string): Carrega a versão WordPress especificada. Aceita as últimas seis versões principais do WordPress. A partir de 1º de setembro de 2025, são `6.3`, `6.4`, `6.5`, `6.6`, `6.7` ou `6.8`. Você também pode usar os valores genéricos `latest`, `nightly` ou `beta`. Para usar uma versão pré-lançamento do WordPress, `beta` carregará as versões mais recentes de beta ou candidato a lançamento de um ciclo de lançamento (Beta ou RC).

```js
{
	"preferredVersions": {
		"php": "8.3",
		"wp": "6.7"
	},
}
```

## Recursos

Você pode usar a propriedade `features` para ativar ou desativar certos recursos da instância do Playground. Ela pode conter as seguintes propriedades:

- `networking`: Padrão `true`. Ativa ou desativa o suporte de rede para o Playground. Se habilitado, [`wp_safe_remote_get`](https://developer.wordpress.org/reference/functions/wp_safe_remote_get/) e funções WordPress similares usarão `fetch()` para fazer requisições HTTP. Se desabilitado, elas falharão imediatamente. Você precisará desta propriedade habilitada se quiser que o usuário possa instalar plugins ou temas.

```js
{
	"features": {
		"networking": false
	},
}
```

## Bibliotecas extras

Você pode pré-carregar bibliotecas extras na instância do Playground. As seguintes bibliotecas são suportadas:

- `wp-cli`: Habilita o suporte WP-CLI para o Playground. Se incluído, WP-CLI será instalado durante a inicialização. Se não incluído, você receberá uma mensagem de erro ao tentar executar comandos WP-CLI usando a API JS. WP-CLI será instalado por padrão se o blueprint contiver algum step `wp-cli`.

```js
{
	"extraLibraries": [ "wp-cli" ],
}
```

## Steps

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
