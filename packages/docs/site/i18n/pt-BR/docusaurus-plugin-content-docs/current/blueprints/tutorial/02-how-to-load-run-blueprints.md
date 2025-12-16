---
title: How to run Blueprints
slug: /blueprints/tutorial/how-to-load-run-blueprints
description: Learn the various methods for loading and running Blueprints, including using a URL fragment or the blueprint-url parameter.
---

<!--
# How to load and run Blueprints
-->

# Como carregar e executar as Blueprints

<!-- URL fragment

The fastest way to run Blueprints is to paste one into the URL "fragment" of a WordPress Playground website. Just add a `#` after the `.net/`.

Let's say you want to create a Playground with specific versions of WordPress and PHP using the following Blueprint:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"preferredVersions": {
		"php": "8.3",
		"wp": "5.9"
	}
}
```

To run it, go to `https://playground.wordpress.net/#{"preferredVersions": {"php":"8.3", "wp":"5.9"}}`. You can also use the button below:

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/#{"preferredVersions":{"php":"8.3","wp":"5.9"}})

Use this method to run the example code in the next chapter, [**Build your first Blueprint**](/blueprints/tutorial/build-your-first-blueprint). -->

## Fragmento de URL

A maneira mais rápida de executar Blueprints é colar um no "fragmento" de URL de um site do WordPress Playground. Basta adicionar um `#` após o `.net/`.

<!-- Let's say you want to create a Playground with specific versions of WordPress and PHP using the following Blueprint: -->

Vamos supor que você queira criar um Playground com versões específicas do WordPress e PHP usando o seguinte Blueprint:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"preferredVersions": {
		"php": "8.3",
		"wp": "5.9"
	}
}
```

<!-- To run it, go to `https://playground.wordpress.net/#{"preferredVersions": {"php":"8.3", "wp":"5.9"}}`. You can also use the button below: -->

Para executá-lo, acesse `https://playground.wordpress.net/#{"preferredVersions": {"php":"8.3", "wp":"5.9"}}`. Você também pode usar o botão abaixo:

[<kbd> &nbsp; Executar Blueprint &nbsp; </kbd>](https://playground.wordpress.net/#{"preferredVersions":{"php":"8.3","wp":"5.9"}})

<!-- Use this method to run the example code in the next chapter, [**Build your first Blueprint**](/blueprints/tutorial/build-your-first-blueprint). -->

Use este método para executar o código de exemplo no próximo capítulo, [**Crie seu primeiro Blueprint**](/blueprints/tutorial/build-your-first-blueprint).

<!-- Base64 encoded Blueprints

Some tools, including GitHub, might not format the Blueprint correctly when pasted into the URL. In such cases, [encode your Blueprint in Base64](https://www.base64encode.org) and append it to the URL. For example, that's the above Blueprint in Base64 format: `eyJwcmVmZXJyZWRWZXJzaW9ucyI6IHsicGhwIjoiNy40IiwgIndwIjoiNS45In19`.

To run it, go to [https://playground.wordpress.net/#eyJwcmVmZXJyZWRWZXJzaW9ucyI6IHsicGhwIjoiNy40IiwgIndwIjoiNS45In19](https://playground.wordpress.net/#eyJwcmVmZXJyZWRWZXJzaW9ucyI6IHsicGhwIjoiNy40IiwgIndwIjoiNS45In19) -->

### Blueprints codificados em Base64

Algumas ferramentas, incluindo o GitHub, podem não formatar o Blueprint corretamente quando colado na URL. Nesses casos, [codifique seu Blueprint em Base64](https://www.base64encode.org) e anexe-o à URL. Por exemplo, esse é o Blueprint acima em formato Base64: `eyJwcmVmZXJyZWRWZXJzaW9ucyI6IHsicGhwIjoiNy40IiwgIndwIjoiNS45In19`.

Para executá-lo, acesse [https://playground.wordpress.net/#eyJwcmVmZXJyZWRWZXJzaW9ucyI6IHsicGhwIjoiNy40IiwgIndwIjoiNS45In19](https://playground.wordpress.net/#eyJwcmVmZXJyZWRWZXJzaW9ucyI6IHsicGhwIjoiNy40IiwgIndwIjoiNS45In19)

<!-- Load Blueprint from a URL

When your Blueprint gets too wieldy, you can load it via the `?blueprint-url` query parameter in the URL, like this:

[https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/latest-gutenberg/blueprint.json](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/latest-gutenberg/blueprint.json)

Note that the Blueprint must be publicly accessible and served with [the correct `Access-Control-Allow-Origin` header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Origin):

```
Access-Control-Allow-Origin: *
``` -->

### Carregar Blueprint de uma URL

Quando seu Blueprint se torna muito extenso, você pode carregá-lo através do parâmetro de consulta `?blueprint-url` na URL, assim:

[https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/latest-gutenberg/blueprint.json](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/latest-gutenberg/blueprint.json)

Observe que o Blueprint deve ser publicamente acessível e servido com [o cabeçalho `Access-Control-Allow-Origin` correto](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Origin):

```
Access-Control-Allow-Origin: *
```
