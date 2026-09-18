---
title: Cómo ejecutar Blueprints
slug: /blueprints/tutorial/how-to-load-run-blueprints
description: Aprende los distintos métodos para cargar y ejecutar Blueprints, incluso mediante un fragmento de URL o el parámetro blueprint-url.
---

<!--
title: How to run Blueprints
description: Learn the various methods for loading and running Blueprints, including using a URL fragment or the blueprint-url parameter.
-->

<!--
# How to load and run Blueprints
-->

# Cómo cargar y ejecutar Blueprints

<!--
## URL fragment
-->

## Fragmento de URL

<!--
The fastest way to run Blueprints is to paste one into the URL "fragment" of a WordPress Playground website. Just add a `#` after the `.net/`.
-->

La forma más rápida de ejecutar Blueprints es pegar uno en el "fragmento" de URL de un sitio de WordPress Playground. Solo añade un `#` después de `.net/`.

<!--
Let's say you want to create a Playground with specific versions of WordPress and PHP using the following Blueprint:
-->

Supongamos que quieres crear un Playground con versiones específicas de WordPress y PHP usando el siguiente Blueprint:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"preferredVersions": {
		"php": "8.3",
		"wp": "5.9"
	}
}
```

<!--
To run it, go to `https://playground.wordpress.net/#{"preferredVersions": {"php":"8.3", "wp":"5.9"}}`. You can also use the button below:
-->

Para ejecutarlo, ve a `https://playground.wordpress.net/#{"preferredVersions": {"php":"8.3", "wp":"5.9"}}`. También puedes usar el botón de abajo:

[<kbd> &nbsp; Ejecutar Blueprint &nbsp; </kbd>](https://playground.wordpress.net/#{"preferredVersions":{"php":"8.3","wp":"5.9"}})

<!--
Use this method to run the example code in the next chapter, [**Build your first Blueprint**](/blueprints/tutorial/build-your-first-blueprint).
-->

Usa este método para ejecutar el código de ejemplo del siguiente capítulo, [**Crea tu primer Blueprint**](/blueprints/tutorial/build-your-first-blueprint).

<!--
### Encoded Blueprint fragments
-->

### Fragmentos de Blueprint codificados

<!--
When you build a Playground link from JavaScript or an automation tool, encode the Blueprint JSON once with `encodeURIComponent(JSON.stringify(blueprint))` and append it after `#`.
-->

Cuando construyas un enlace de Playground desde JavaScript o una herramienta de automatización, codifica el JSON de Blueprint una sola vez con `encodeURIComponent(JSON.stringify(blueprint))` y añádelo después de `#`.

<!--
Playground also supports [Base64-encoded Blueprints](https://www.base64encode.org), which are useful when a platform modifies JSON fragments or when you want a compact, copyable link. For example, that's the above Blueprint in Base64 format: `eyJwcmVmZXJyZWRWZXJzaW9ucyI6IHsicGhwIjoiNy40IiwgIndwIjoiNS45In19`.
-->

Playground también admite [Blueprints codificados en Base64](https://www.base64encode.org), que son útiles cuando una plataforma modifica fragmentos JSON o cuando quieres un enlace compacto y fácil de copiar. Por ejemplo, este es el Blueprint anterior en formato Base64: `eyJwcmVmZXJyZWRWZXJzaW9ucyI6IHsicGhwIjoiNy40IiwgIndwIjoiNS45In19`.

<!--
To run it, go to [https://playground.wordpress.net/#eyJwcmVmZXJyZWRWZXJzaW9ucyI6IHsicGhwIjoiNy40IiwgIndwIjoiNS45In19](https://playground.wordpress.net/#eyJwcmVmZXJyZWRWZXJzaW9ucyI6IHsicGhwIjoiNy40IiwgIndwIjoiNS45In19)
-->

Para ejecutarlo, ve a [https://playground.wordpress.net/#eyJwcmVmZXJyZWRWZXJzaW9ucyI6IHsicGhwIjoiNy40IiwgIndwIjoiNS45In19](https://playground.wordpress.net/#eyJwcmVmZXJyZWRWZXJzaW9ucyI6IHsicGhwIjoiNy40IiwgIndwIjoiNS45In19)

<!--
### Load Blueprint from a URL
-->

### Cargar Blueprint desde una URL

<!--
When your Blueprint gets too wieldy, you can load it via the `?blueprint-url` query parameter in the URL, like this:
-->

Cuando tu Blueprint sea demasiado difícil de manejar, puedes cargarlo mediante el parámetro de consulta `?blueprint-url` en la URL, así:

[https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/latest-gutenberg/blueprint.json](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/latest-gutenberg/blueprint.json)

<!--
Note that the Blueprint must be publicly accessible and served with [the correct `Access-Control-Allow-Origin` header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Origin):
-->

Ten en cuenta que el Blueprint debe ser accesible públicamente y servirse con [el encabezado `Access-Control-Allow-Origin` correcto](https://developer.mozilla.org/es/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Origin):

```
Access-Control-Allow-Origin: *
```
