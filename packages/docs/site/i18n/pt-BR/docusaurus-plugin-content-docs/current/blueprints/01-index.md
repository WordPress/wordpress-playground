---
title: Começando
slug: /blueprints/getting-started
description: Um guia de início rápido para Blueprints. Entenda quais problemas eles resolvem e as diferentes maneiras de começar a usá-los.
---

<!-- # Getting started with Blueprints -->

# Começando com Blueprints

<!-- Blueprints are JSON files for setting up your very own WordPress Playground instance. For example: -->

Blueprints são arquivos JSON para configurar sua própria instância WordPress Playground. Por exemplo:

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
			"password": "password"
		}
	]
}
```

<!-- There are three ways to use Blueprints: -->

Existem três maneiras de usar Blueprints:

<!-- -   [Paste a Blueprint into the URL "fragment" on WordPress Playground website](/blueprints/using-blueprints#url-fragment). -->
<!-- -   [Use them with the JavaScript API](/blueprints/using-blueprints#javascript-api). -->
<!-- -   [Reference a blueprint JSON file via QueryParam blueprint-url](/developers/apis/query-api/) -->

-   [Cole um Blueprint no "fragmento" da URL no site WordPress Playground](/blueprints/using-blueprints#url-fragment).
-   [Use-os com a API JavaScript](/blueprints/using-blueprints#javascript-api).
-   [Referencie um arquivo JSON blueprint via QueryParam blueprint-url](/developers/apis/query-api/)

<!-- ## What problems are solved by Blueprints? -->

## Quais problemas são resolvidos pelos Blueprints?

<!-- ### No coding skills required -->

### Nenhuma habilidade de programação necessária

<!-- Blueprints are just JSON. You don't need a development environment, any libraries, or even JavaScript knowledge. You can write them in any text editor. -->

Blueprints são apenas JSON. Você não precisa de um ambiente de desenvolvimento, nenhuma biblioteca, ou mesmo conhecimento de JavaScript. Você pode escrevê-los em qualquer editor de texto.

<!-- However, if you do have a development environment, that's great! You can use the [Blueprint JSON schema](https://playground.wordpress.net/blueprint-schema.json) to get autocompletion and validation. -->

No entanto, se você tem um ambiente de desenvolvimento, isso é ótimo! Você pode usar o [esquema JSON do Blueprint](https://playground.wordpress.net/blueprint-schema.json) para obter autocompletar e validação.

<!-- ### HTTP Requests are managed for you -->

### Requisições HTTP são gerenciadas para você

<!-- Blueprints fetch any resources you declare for you. You don't have to worry about managing multiple `fetch()` calls or waiting for them to finish. You can just declare a few links and let Blueprints handle and optimize the downloading pipeline. -->

Blueprints buscam quaisquer recursos que você declarar para você. Você não precisa se preocupar em gerenciar múltiplas chamadas `fetch()` ou esperar que elas terminem. Você pode apenas declarar alguns links e deixar os Blueprints lidarem e otimizarem o pipeline de download.

<!-- ### You can link to a Blueprint-preconfigured Playground -->

### Você pode linkar para um Playground pré-configurado com Blueprint

<!-- Because Blueprints can be pasted in the URL, you can embed or link to a Playground with a specific configuration. For example, clicking this button will open a Playground with PHP 8.3 and a pendant theme installed: -->

Como Blueprints podem ser colados na URL, você pode incorporar ou linkar para um Playground com uma configuração específica. Por exemplo, clicar neste botão abrirá um Playground com PHP 8.3 e um tema pendant instalado:

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

<!-- ### Trusted by default -->

### Confiável por padrão

<!-- Blueprints are just JSON. Running other people's Blueprints doesn't require the element of trust. Since Blueprints cannot execute arbitrary JavaScript, they are limited in what they can do. -->

Blueprints são apenas JSON. Executar Blueprints de outras pessoas não requer o elemento de confiança. Como Blueprints não podem executar JavaScript arbitrário, eles são limitados no que podem fazer.

<!-- With Blueprints, WordPress.org plugin directory may be able to offer live previews of plugins. Plugin authors will just write a custom Blueprint to preconfigure the Playground instance with any site options or starter content they may need. -->

Com Blueprints, o diretório de plugins WordPress.org pode ser capaz de oferecer visualizações ao vivo de plugins. Autores de plugins apenas escreverão um Blueprint personalizado para pré-configurar a instância Playground com quaisquer opções de site ou conteúdo inicial que possam precisar.

<!-- ### Write it once, use it anywhere -->

### Escreva uma vez, use em qualquer lugar

<!-- Blueprints work both on the web and in node.js. You can run them both in the same JavaScript process, and through a remote Playground Client. They are the universal language of configuration. Where you can run Playground, you can use Blueprints. -->

Blueprints funcionam tanto na web quanto no node.js. Você pode executá-los tanto no mesmo processo JavaScript, quanto através de um Cliente Playground remoto. Eles são a linguagem universal de configuração. Onde você pode executar Playground, você pode usar Blueprints.
