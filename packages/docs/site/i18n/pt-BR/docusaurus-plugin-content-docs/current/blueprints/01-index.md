---
title: Começando
slug: /blueprints/getting-started
description: Um guia rápido para Blueprints. Entenda quais problemas eles resolvem e as diferentes maneiras de começar a usá-los.
---

<!--
# Getting started with Blueprints
-->

# Começando com Blueprints

<!-- Blueprints are JSON files for setting up your very own WordPress Playground instance. For example: -->

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

<!-- There are three ways to use Blueprints: -->

Existem três maneiras de usar Blueprints:

- [Cole um Blueprint no "fragmento" da URL no site do WordPress Playground](/blueprints/using-blueprints#url-fragment).
- [Use-os com a API JavaScript](/blueprints/using-blueprints#javascript-api).
- [Referencie um arquivo JSON de blueprint via QueryParam blueprint-url](/developers/apis/query-api/)

## Quais problemas são resolvidos pelos Blueprints?

### Nenhuma habilidade de codificação necessária

<!-- Blueprints are just JSON. You don't need a development environment, any libraries, or even JavaScript knowledge. You can write them in any text editor. -->

Blueprints são apenas JSON. Você não precisa de um ambiente de desenvolvimento, bibliotecas ou mesmo conhecimento em JavaScript. Você pode escrevê-los em qualquer editor de texto.

<!-- However, if you do have a development environment, that's great! You can use the Blueprint JSON schema to get autocompletion and validation. -->

No entanto, se você tiver um ambiente de desenvolvimento, isso é ótimo! Você pode usar o [esquema JSON do Blueprint](https://playground.wordpress.net/blueprint-schema.json) para obter autocompletar e validação.

### Requisições HTTP são gerenciadas para você

<!-- Blueprints fetch any resources you declare for you. You don't have to worry about managing multiple fetch() calls or waiting for them to finish. You can just declare a few links and let Blueprints handle and optimize the downloading pipeline. -->

Blueprints buscam quaisquer recursos que você declarar para você. Você não precisa se preocupar em gerenciar várias chamadas `fetch()` ou esperar que elas terminem. Você pode apenas declarar alguns links e deixar os Blueprints lidarem e otimizarem o pipeline de download.

### Você pode vincular a um Playground pré-configurado por Blueprint

<!-- Because Blueprints can be pasted in the URL, you can embed or link to a Playground with a specific configuration. For example, clicking this button will open a Playground with PHP 8.3 and a pendant theme installed: -->

Como os Blueprints podem ser colados na URL, você pode incorporar ou vincular a um Playground com uma configuração específica. Por exemplo, clicar neste botão abrirá um Playground com PHP 8.3 e um tema pendant instalado:

```javascript
import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

<BlueprintExample
	justButton={true}
	blueprint={{
		preferredVersions: {
			php: '8.3',
			wp: 'latest',
		},
		steps: [
			{
				step: 'installTheme',
				themeData: {
					resource: 'wordpress.org/themes',
					slug: 'pendant',
				},
				options: {
					activate: true,
				},
			},
		],
	}}
/>;
```

### Confiável por padrão

<!-- Blueprints are just JSON. Running other people's Blueprints doesn't require the element of trust. Since Blueprints cannot execute arbitrary JavaScript, they are limited in what they can do. -->

Blueprints são apenas JSON. Executar Blueprints de outras pessoas não requer o elemento de confiança. Como os Blueprints não podem executar JavaScript arbitrário, eles são limitados no que podem fazer.

<!-- With Blueprints, WordPress.org plugin directory may be able to offer live previews of plugins. Plugin authors will just write a custom Blueprint to preconfigure the Playground instance with any site options or starter content they may need. -->

Com os Blueprints, o diretório de plugins do WordPress.org pode oferecer pré-visualizações ao vivo de plugins. Autores de plugins apenas escreverão um Blueprint personalizado para pré-configurar a instância do Playground com quaisquer opções de site ou conteúdo inicial que possam precisar.

### Escreva uma vez, use em qualquer lugar

<!-- Blueprints work both on the web and in node.js. You can run them both in the same JavaScript process, and through a remote Playground Client. They are the universal language of configuration. Where you can run Playground, you can use Blueprints. -->

Blueprints funcionam tanto na web quanto no node.js. Você pode executá-los tanto no mesmo processo JavaScript quanto através de um cliente Playground remoto. Eles são a linguagem universal de configuração. Onde você pode executar o Playground, pode usar Blueprints.
