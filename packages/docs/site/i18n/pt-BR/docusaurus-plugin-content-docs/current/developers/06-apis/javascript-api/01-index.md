---
slug: /developers/apis/javascript-api
---

<!-- # JavaScript API -->

# API JavaScript

<!-- WordPress Playground comes with a JavaScript API client that grants you full control over your WordPress. -->

O WordPress Playground vem com um cliente de API JavaScript que oferece controle total sobre o seu WordPress.

<div class="callout callout-info">

<!-- **API here doesn't mean "REST API"** -->

**API aqui não significa "REST API"**

<!-- WordPress Playground is a browser-based application.
The term API here refers to a set of functions you can
call inside JavaScript. This is **not** a network-based REST API. -->

O WordPress Playground é uma aplicação que funciona no navegador. O termo API aqui se refere a um conjunto de funções que você pode chamar no JavaScript. Isso **não** é uma API REST baseada em rede.

</div>

<!-- ## Quick start -->

## Início rápido

<!-- To use the JavaScript API, you'll need: -->

Para usar a API JavaScript, você vai precisar de:

<!-- - An `<iframe>` element
- The Playground JavaScript client, loaded from `playground.wordpress.net` or installed from npm -->

- Um elemento `<iframe>`
- O cliente JavaScript do Playground, carregado de `playground.wordpress.net` ou instalado pelo npm

<!-- ### Load the client from playground.wordpress.net -->

### Carregar o cliente de playground.wordpress.net

<!-- You can load the client directly from `https://playground.wordpress.net/client/index.js`. No npm installation or build step is required. Use a `<script type="module">` element so you can import the client and use `await`. -->

Você pode carregar o cliente diretamente de `https://playground.wordpress.net/client/index.js`. Não é necessário instalar pacotes pelo npm nem compilar o projeto. Use um elemento `<script type="module">` para importar o cliente e usar `await`.

<!-- Save the following example as `index.html` and serve it from a local web server, or paste it into an online HTML editor such as CodePen or JSFiddle: -->

Salve o exemplo a seguir como `index.html` e use um servidor web local para abri-lo, ou cole o código em um editor HTML on-line, como CodePen ou JSFiddle:

```html
<iframe id="wp" style="width: 100%; height: 300px; border: 1px solid #000;"></iframe>
<script type="module">
	const { startPlaygroundWeb } = await import('https://playground.wordpress.net/client/index.js');

	const client = await startPlaygroundWeb({
		iframe: document.getElementById('wp'),
		remoteUrl: 'https://playground.wordpress.net/remote.html',
	});
	// Aguarde até que o Playground esteja totalmente carregado
	await client.isReady();
</script>
```

<!-- The import loads the JavaScript client into your page. `startPlaygroundWeb()` then loads WordPress in the iframe using `remoteUrl` and returns a client you can use to control it. -->

A importação carrega o cliente JavaScript na sua página. Em seguida, `startPlaygroundWeb()` carrega o WordPress no iframe usando `remoteUrl` e retorna um cliente que permite controlá-lo.

<div class="callout callout-info">

<!-- **/remote.html is a special URL** -->

**/remote.html é uma URL especial**

<!-- `/remote.html` is a special URL that loads the Playground
API endpoint instead of the demo app with the browser UI. Read more about [the difference between `/` and `/remote.html`](/developers/apis/javascript-api/-html-vs-remote-html). -->

`/remote.html` é uma URL especial que carrega o endpoint da API do Playground em vez do aplicativo de demonstração com a interface do navegador. Leia mais sobre [a diferença entre `/` e `/remote.html`](/developers/apis/javascript-api/-html-vs-remote-html).

<!-- Use `https://playground.wordpress.net/remote.html` for `remoteUrl` to connect to Playground. WordPress pages load from `wpsandbox.wordpress.net` automatically. You don't need to configure that address. -->

Use `https://playground.wordpress.net/remote.html` em `remoteUrl` para se conectar ao Playground. As páginas do WordPress são carregadas de `wpsandbox.wordpress.net` automaticamente. Você não precisa configurar esse endereço.

</div>

<!-- ### Install the client from npm -->

### Instalar o cliente pelo npm

<!-- If your application uses a bundler, install the client package: -->

Se sua aplicação usa um empacotador de módulos (bundler), instale o pacote do cliente:

```bash
npm install @wp-playground/client
```

<!-- Then replace the URL import in the example above with this import in your JavaScript module: -->

Em seguida, substitua a importação por URL do exemplo acima por esta importação no seu módulo JavaScript:

```javascript
const { startPlaygroundWeb } = await import('@wp-playground/client');
```

<!-- Keep `remoteUrl` set to `https://playground.wordpress.net/remote.html` to use the hosted Playground runtime. -->

Mantenha `remoteUrl` definido como `https://playground.wordpress.net/remote.html` para usar o ambiente hospedado do Playground.

<!-- ## Controlling the website -->

## Controlando o site

<!-- Now that you have a `client` object, you can use it to control the website inside the iframe. There are three ways to do that: -->

Agora que você tem um objeto `client`, pode usá-lo para controlar o site dentro do iframe. Existem três maneiras de fazer isso:

<!-- - [Playground API Client](/developers/apis/javascript-api/playground-api-client)
- [Blueprint JSON](/developers/apis/javascript-api/blueprint-json-in-api-client)
- [Blueprint functions](/developers/apis/javascript-api/blueprint-functions-in-api-client) -->

- [Cliente da API do Playground](/developers/apis/javascript-api/playground-api-client)
- [Blueprint JSON](/developers/apis/javascript-api/blueprint-json-in-api-client)
- [Funções Blueprint](/developers/apis/javascript-api/blueprint-functions-in-api-client)

<!-- ## Debugging and testing -->

## Depuração e testes

<!-- For quick testing and debugging, the JavaScript API client is exposed as `window.playground` by both `index.html` and `remote.html`. -->

Para testes e depuração rápidos, o cliente da API JavaScript é exposto como `window.playground` tanto em `index.html` quanto em `remote.html`.

```javascript
> await playground.listFiles("/")
(6) ['tmp', 'home', 'dev', 'proc', 'internal', 'wordpress']
```

<!-- Note that in `index.html`, `playground` is a Proxy object and you won't get any autocompletion from the browser. In `remote.html`,
however, `playground` is a class instance and you will benefit from browser's autocompletion. -->

Em `index.html`, `playground` é um objeto Proxy e você não terá preenchimento automático no navegador. Já em `remote.html`, `playground` é uma instância de classe e oferece preenchimento automático.
