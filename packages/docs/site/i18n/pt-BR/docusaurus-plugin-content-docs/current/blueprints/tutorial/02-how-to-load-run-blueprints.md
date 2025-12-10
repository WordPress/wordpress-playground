---
title: Como executar Blueprints
slug: /blueprints/tutorial/how-to-load-run-blueprints
description: Aprenda os vários métodos para carregar e executar Blueprints, incluindo o uso de um fragmento de URL ou o parâmetro blueprint-url.
---

# Como carregar e executar Blueprints

## Fragmento de URL

A maneira mais rápida de executar Blueprints é colar um no "fragmento" de URL de um site do WordPress Playground. Basta adicionar um `#` após o `.net/`.

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

Para executá-lo, acesse `https://playground.wordpress.net/#{"preferredVersions": {"php":"8.3", "wp":"5.9"}}`. Você também pode usar o botão abaixo:

[<kbd> &nbsp; Executar Blueprint &nbsp; </kbd>](https://playground.wordpress.net/#{"preferredVersions":{"php":"8.3","wp":"5.9"}})

Use este método para executar o código de exemplo no próximo capítulo, [**Crie seu primeiro Blueprint**](/blueprints/tutorial/build-your-first-blueprint).

### Blueprints codificados em Base64

Algumas ferramentas, incluindo o GitHub, podem não formatar o Blueprint corretamente quando colado na URL. Nesses casos, [codifique seu Blueprint em Base64](https://www.base64encode.org) e anexe-o à URL. Por exemplo, esse é o Blueprint acima em formato Base64: `eyJwcmVmZXJyZWRWZXJzaW9ucyI6IHsicGhwIjoiNy40IiwgIndwIjoiNS45In19`.

Para executá-lo, acesse [https://playground.wordpress.net/#eyJwcmVmZXJyZWRWZXJzaW9ucyI6IHsicGhwIjoiNy40IiwgIndwIjoiNS45In19](https://playground.wordpress.net/#eyJwcmVmZXJyZWRWZXJzaW9ucyI6IHsicGhwIjoiNy40IiwgIndwIjoiNS45In19)

### Carregar Blueprint de uma URL

Quando seu Blueprint se torna muito extenso, você pode carregá-lo através do parâmetro de consulta `?blueprint-url` na URL, assim:

[https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/latest-gutenberg/blueprint.json](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/latest-gutenberg/blueprint.json)

Observe que o Blueprint deve ser publicamente acessível e servido com [o cabeçalho `Access-Control-Allow-Origin` correto](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Origin):

```
Access-Control-Allow-Origin: *
```
