---
slug: /developers/apis/javascript-api
---

<!-- # JavaScript API -->

# API de JavaScript

<!-- WordPress Playground comes with a JavaScript API client that grants you full control over your WordPress. -->

WordPress Playground incluye un cliente de API de JavaScript que te permite controlar por completo tu WordPress.

<div class="callout callout-info">

<!-- **API here doesn't mean "REST API"** -->

**Aquí, API no significa «API REST»**

<!-- WordPress Playground is a browser-based application.
The term API here refers to a set of functions you can
call inside JavaScript. This is **not** a network-based REST API. -->

WordPress Playground es una aplicación que funciona en el navegador. Aquí, el término API se refiere a un conjunto de funciones que puedes llamar desde JavaScript. **No** es una API REST accesible a través de la red.

</div>

<!-- ## Quick start -->

## Inicio rápido

<!-- To use the JavaScript API, you'll need: -->

Para usar la API de JavaScript, necesitarás:

<!-- - An `<iframe>` element
- The Playground JavaScript client, loaded from `playground.wordpress.net` or installed from npm -->

- Un elemento `<iframe>`
- El cliente de JavaScript de Playground, cargado desde `playground.wordpress.net` o instalado con npm

<!-- ### Load the client from playground.wordpress.net -->

### Cargar el cliente desde playground.wordpress.net

<!-- You can load the client directly from `https://playground.wordpress.net/client/index.js`. No npm installation or build step is required. Use a `<script type="module">` element so you can import the client and use `await`. -->

Puedes cargar el cliente directamente desde `https://playground.wordpress.net/client/index.js`. No necesitas instalar paquetes con npm ni compilar el proyecto. Usa un elemento `<script type="module">` para importar el cliente y usar `await`.

<!-- Save the following example as `index.html` and serve it from a local web server, or paste it into an online HTML editor such as CodePen or JSFiddle: -->

Guarda el siguiente ejemplo como `index.html` y ábrelo mediante un servidor web local, o pégalo en un editor HTML en línea como CodePen o JSFiddle:

```html
<iframe id="wp" style="width: 100%; height: 300px; border: 1px solid #000;"></iframe>
<script type="module">
	const { startPlaygroundWeb } = await import('https://playground.wordpress.net/client/index.js');

	const client = await startPlaygroundWeb({
		iframe: document.getElementById('wp'),
		remoteUrl: 'https://playground.wordpress.net/remote.html',
	});
	// Espera a que Playground termine de cargar
	await client.isReady();
</script>
```

<!-- The import loads the JavaScript client into your page. `startPlaygroundWeb()` then loads WordPress in the iframe using `remoteUrl` and returns a client you can use to control it. -->

La importación carga el cliente de JavaScript en tu página. A continuación, `startPlaygroundWeb()` carga WordPress en el iframe mediante `remoteUrl` y devuelve un cliente que permite controlarlo.

<div class="callout callout-info">

<!-- **/remote.html is a special URL** -->

**/remote.html es una URL especial**

<!-- `/remote.html` is a special URL that loads the Playground
API endpoint instead of the demo app with the browser UI. Read more about [the difference between `/` and `/remote.html`](/developers/apis/javascript-api/-html-vs-remote-html). -->

`/remote.html` es una URL especial que carga el punto de acceso a la API de Playground en lugar de la aplicación de demostración con su interfaz de navegación. Consulta [la diferencia entre `/` y `/remote.html`](/developers/apis/javascript-api/-html-vs-remote-html).

<!-- Use `https://playground.wordpress.net/remote.html` for `remoteUrl` to connect to Playground. WordPress pages load from `wpsandbox.wordpress.net` automatically. You don't need to configure that address. -->

Usa `https://playground.wordpress.net/remote.html` en `remoteUrl` para conectarte a Playground. Las páginas de WordPress se cargan desde `wpsandbox.wordpress.net` automáticamente. No necesitas configurar esa dirección.

</div>

<!-- ### Install the client from npm -->

### Instalar el cliente con npm

<!-- If your application uses a bundler, install the client package: -->

Si tu aplicación usa un empaquetador de módulos (bundler), instala el paquete del cliente:

```bash
npm install @wp-playground/client
```

<!-- Then replace the URL import in the example above with this import in your JavaScript module: -->

Después, sustituye la importación por URL del ejemplo anterior por esta importación en tu módulo de JavaScript:

```javascript
const { startPlaygroundWeb } = await import('@wp-playground/client');
```

<!-- Keep `remoteUrl` set to `https://playground.wordpress.net/remote.html` to use the hosted Playground runtime. -->

Mantén `remoteUrl` configurado como `https://playground.wordpress.net/remote.html` para usar el entorno alojado de Playground.

<!-- ## Controlling the website -->

## Controlar el sitio web

<!-- Now that you have a `client` object, you can use it to control the website inside the iframe. There are three ways to do that: -->

Ahora que tienes un objeto `client`, puedes usarlo para controlar el sitio web dentro del iframe. Hay tres formas de hacerlo:

<!-- - [Playground API Client](/developers/apis/javascript-api/playground-api-client)
- [Blueprint JSON](/developers/apis/javascript-api/blueprint-json-in-api-client)
- [Blueprint functions](/developers/apis/javascript-api/blueprint-functions-in-api-client) -->

- [Cliente de API de Playground](/developers/apis/javascript-api/playground-api-client)
- [Blueprint JSON](/developers/apis/javascript-api/blueprint-json-in-api-client)
- [Funciones Blueprint](/developers/apis/javascript-api/blueprint-functions-in-api-client)

<!-- ## Debugging and testing -->

## Depuración y pruebas

<!-- For quick testing and debugging, the JavaScript API client is exposed as `window.playground` by both `index.html` and `remote.html`. -->

Para realizar pruebas y depurar rápidamente, el cliente de API de JavaScript está disponible como `window.playground` tanto en `index.html` como en `remote.html`.

```javascript
> await playground.listFiles("/")
(6) ['tmp', 'home', 'dev', 'proc', 'internal', 'wordpress']
```

<!-- Note that in `index.html`, `playground` is a Proxy object and you won't get any autocompletion from the browser. In `remote.html`,
however, `playground` is a class instance and you will benefit from browser's autocompletion. -->

En `index.html`, `playground` es un objeto Proxy y el navegador no ofrece autocompletado. En `remote.html`, `playground` es una instancia de clase y puedes usar el autocompletado del navegador.
