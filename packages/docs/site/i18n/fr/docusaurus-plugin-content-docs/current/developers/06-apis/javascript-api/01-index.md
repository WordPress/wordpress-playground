---
slug: /developers/apis/javascript-api
---

<!-- # JavaScript API -->

# API JavaScript

<!-- WordPress Playground comes with a JavaScript API client that grants you full control over your WordPress. -->

WordPress Playground propose un client API JavaScript qui vous permet de contrôler entièrement votre WordPress.

<div class="callout callout-info">

<!-- **API here doesn't mean "REST API"** -->

**API ne signifie pas ici « API REST »**

<!-- WordPress Playground is a browser-based application.
The term API here refers to a set of functions you can
call inside JavaScript. This is **not** a network-based REST API. -->

WordPress Playground est une application qui fonctionne dans le navigateur. Le terme API désigne ici un ensemble de fonctions que vous pouvez appeler en JavaScript. Il ne s’agit **pas** d’une API REST accessible par le réseau.

</div>

<!-- ## Quick start -->

## Démarrage rapide

<!-- To use the JavaScript API, you'll need: -->

Pour utiliser l’API JavaScript, vous aurez besoin de :

<!-- - An `<iframe>` element
- The Playground JavaScript client, loaded from `playground.wordpress.net` or installed from npm -->

- Un élément `<iframe>`
- Le client JavaScript de Playground, chargé depuis `playground.wordpress.net` ou installé avec npm

<!-- ### Load the client from playground.wordpress.net -->

### Charger le client depuis playground.wordpress.net

<!-- You can load the client directly from `https://playground.wordpress.net/client/index.js`. No npm installation or build step is required. Use a `<script type="module">` element so you can import the client and use `await`. -->

Vous pouvez charger le client directement depuis `https://playground.wordpress.net/client/index.js`. Aucune installation avec npm ni étape de compilation n’est nécessaire. Utilisez un élément `<script type="module">` pour importer le client et utiliser `await`.

<!-- Save the following example as `index.html` and serve it from a local web server, or paste it into an online HTML editor such as CodePen or JSFiddle: -->

Enregistrez l’exemple suivant dans un fichier `index.html` et ouvrez-le à l’aide d’un serveur web local, ou collez-le dans un éditeur HTML en ligne comme CodePen ou JSFiddle :

```html
<iframe id="wp" style="width: 100%; height: 300px; border: 1px solid #000;"></iframe>
<script type="module">
	const { startPlaygroundWeb } = await import('https://playground.wordpress.net/client/index.js');

	const client = await startPlaygroundWeb({
		iframe: document.getElementById('wp'),
		remoteUrl: 'https://playground.wordpress.net/remote.html',
	});
	// Attendez que Playground soit entièrement chargé
	await client.isReady();
</script>
```

<!-- The import loads the JavaScript client into your page. `startPlaygroundWeb()` then loads WordPress in the iframe using `remoteUrl` and returns a client you can use to control it. -->

L’importation charge le client JavaScript dans votre page. `startPlaygroundWeb()` charge ensuite WordPress dans l’iframe à l’aide de `remoteUrl` et renvoie un client qui permet de le contrôler.

<div class="callout callout-info">

<!-- **/remote.html is a special URL** -->

**/remote.html est une URL spéciale**

<!-- `/remote.html` is a special URL that loads the Playground
API endpoint instead of the demo app with the browser UI. Read more about [the difference between `/` and `/remote.html`](/developers/apis/javascript-api/-html-vs-remote-html). -->

`/remote.html` est une URL spéciale qui charge le point d’accès à l’API Playground au lieu de l’application de démonstration avec son interface de navigation. Découvrez [la différence entre `/` et `/remote.html`](/developers/apis/javascript-api/-html-vs-remote-html).

<!-- Use `https://playground.wordpress.net/remote.html` for `remoteUrl` to connect to Playground. WordPress pages load from `wpsandbox.wordpress.net` automatically. You don't need to configure that address. -->

Utilisez `https://playground.wordpress.net/remote.html` pour `remoteUrl` afin de vous connecter à Playground. Les pages WordPress se chargent automatiquement depuis `wpsandbox.wordpress.net`. Vous n’avez pas besoin de configurer cette adresse.

</div>

<!-- ### Install the client from npm -->

### Installer le client avec npm

<!-- If your application uses a bundler, install the client package: -->

Si votre application utilise un outil de regroupement de modules (bundler), installez le paquet du client :

```bash
npm install @wp-playground/client
```

<!-- Then replace the URL import in the example above with this import in your JavaScript module: -->

Remplacez ensuite l’importation par URL de l’exemple ci-dessus par cette importation dans votre module JavaScript :

```javascript
const { startPlaygroundWeb } = await import('@wp-playground/client');
```

<!-- Keep `remoteUrl` set to `https://playground.wordpress.net/remote.html` to use the hosted Playground runtime. -->

Gardez `remoteUrl` défini sur `https://playground.wordpress.net/remote.html` pour utiliser l’environnement Playground hébergé.

<!-- ## Controlling the website -->

## Contrôler le site web

<!-- Now that you have a `client` object, you can use it to control the website inside the iframe. There are three ways to do that: -->

Maintenant que vous disposez d’un objet `client`, vous pouvez l’utiliser pour contrôler le site web dans l’iframe. Il existe trois façons de le faire :

<!-- - [Playground API Client](/developers/apis/javascript-api/playground-api-client)
- [Blueprint JSON](/developers/apis/javascript-api/blueprint-json-in-api-client)
- [Blueprint functions](/developers/apis/javascript-api/blueprint-functions-in-api-client) -->

- [Client API Playground](/developers/apis/javascript-api/playground-api-client)
- [Blueprint JSON](/developers/apis/javascript-api/blueprint-json-in-api-client)
- [Fonctions Blueprint](/developers/apis/javascript-api/blueprint-functions-in-api-client)

<!-- ## Debugging and testing -->

## Débogage et tests

<!-- For quick testing and debugging, the JavaScript API client is exposed as `window.playground` by both `index.html` and `remote.html`. -->

Pour faciliter les tests et le débogage, le client API JavaScript est accessible via `window.playground` dans `index.html` et `remote.html`.

```javascript
> await playground.listFiles("/")
(6) ['tmp', 'home', 'dev', 'proc', 'internal', 'wordpress']
```

<!-- Note that in `index.html`, `playground` is a Proxy object and you won't get any autocompletion from the browser. In `remote.html`,
however, `playground` is a class instance and you will benefit from browser's autocompletion. -->

Dans `index.html`, `playground` est un objet Proxy et le navigateur ne propose pas de saisie semi-automatique. Dans `remote.html`, `playground` est une instance de classe et vous bénéficiez de la saisie semi-automatique du navigateur.
