---
title: Começando
slug: /blueprints/getting-started
description: Um guia rápido para Blueprints. Entenda quais problemas eles resolvem e as diferentes maneiras de começar a usá-los.
---

# Começando com Blueprints

Blueprints são arquivos JSON para configurar sua própria instância do WordPress Playground. Por exemplo:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/wp-admin/",
	"preferredVersions": {
		"php": "8.3",
		"wp": "latest"
	},
	"steps": [
		{
			"step": "login",
			"username": "admin",
			"password": "senha"
		}
	]
}
```

Existem três maneiras de usar Blueprints:

-   [Cole um Blueprint no "fragmento" da URL no site do WordPress Playground](/blueprints/using-blueprints#url-fragment).
-   [Use-os com a API JavaScript](/blueprints/using-blueprints#javascript-api).
-   [Referencie um arquivo JSON de blueprint via QueryParam blueprint-url](/developers/apis/query-api/)

## Quais problemas são resolvidos pelos Blueprints?

### Nenhuma habilidade de codificação necessária

Blueprints são apenas JSON. Você não precisa de um ambiente de desenvolvimento, bibliotecas ou mesmo conhecimento em JavaScript. Você pode escrevê-los em qualquer editor de texto.

No entanto, se você tiver um ambiente de desenvolvimento, isso é ótimo! Você pode usar o [esquema JSON do Blueprint](https://playground.wordpress.net/blueprint-schema.json) para obter autocompletar e validação.

### Requisições HTTP são gerenciadas para você

Blueprints buscam quaisquer recursos que você declarar para você. Você não precisa se preocupar em gerenciar várias chamadas `fetch()` ou esperar que elas terminem. Você pode apenas declarar alguns links e deixar os Blueprints lidarem e otimizarem o pipeline de download.

### Você pode vincular a um Playground pré-configurado por Blueprint

Como os Blueprints podem ser colados na URL, você pode incorporar ou vincular a um Playground com uma configuração específica. Por exemplo, clicar neste botão abrirá um Playground com PHP 8.3 e um tema pendant instalado:

import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

<BlueprintExample justButton={true} blueprint={{
	"preferredVersions": {
		"php": "8.3",
		"wp": "latest"
	},
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "pendant"
			},
			"options": {
				"activate": true
			}
		}
	]
}} />

### Confiável por padrão

Blueprints são apenas JSON. Executar Blueprints de outras pessoas não requer o elemento de confiança. Como os Blueprints não podem executar JavaScript arbitrário, eles são limitados no que podem fazer.

Com os Blueprints, o diretório de plugins do WordPress.org pode oferecer pré-visualizações ao vivo de plugins. Autores de plugins apenas escreverão um Blueprint personalizado para pré-configurar a instância do Playground com quaisquer opções de site ou conteúdo inicial que possam precisar.

### Escreva uma vez, use em qualquer lugar

Blueprints funcionam tanto na web quanto no node.js. Você pode executá-los tanto no mesmo processo JavaScript quanto através de um cliente Playground remoto. Eles são a linguagem universal de configuração. Onde você pode executar o Playground, pode usar Blueprints.
