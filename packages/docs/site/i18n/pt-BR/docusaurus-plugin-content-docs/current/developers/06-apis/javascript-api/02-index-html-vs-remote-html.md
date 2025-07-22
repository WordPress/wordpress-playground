---
slug: /developers/apis/javascript-api/-html-vs-remote-html
---

<!-- # `remote.html` vs `index.html` -->

# `remote.html` vs `index.html`

<!-- [playground.wordpress.net](https://playground.wordpress.net/) exposes two distinct APIs through two separate HTML files: `remote.html` and `index.html`. Here's an overview of their functions and differences: -->

[playground.wordpress.net](https://playground.wordpress.net/) expõe duas APIs distintas por meio de dois arquivos HTML separados: `remote.html` e `index.html`. Veja um resumo de suas funções e diferenças:

<!-- -   `index.html` uses WordPress Playground API client to control the "endpoint" that is `remote.html`.
-   The [Query API](../query-api/) is exclusively provided by `index.html`, independent of the WordPress Playground JavaScript API.
-   The [JavaScript API](../javascript-api/) is exclusively provided by `remote.html`. Only that file can be used as an "endpoint" for the `PlaygroundClient` class. -->

-   `index.html` usa o cliente da API do WordPress Playground para controlar o "endpoint" que é o `remote.html`.
-   A [Query API](../query-api/) é fornecida exclusivamente por `index.html`, independente da API JavaScript do WordPress Playground.
-   A [API JavaScript](../javascript-api/) é fornecida exclusivamente por `remote.html`. Apenas esse arquivo pode ser usado como "endpoint" para a classe `PlaygroundClient`.

<!-- Here's a bit more about each of these files: -->

Veja mais detalhes sobre cada um desses arquivos:

<!-- ## Remote.html -->

## Remote.html

<!-- `remote.html` runs and renders WordPress and also exposes an API for developers to control it. Importantly, `remote.html` does not render any UI elements, such as browser UI or version switchers. It's just WordPress. The primary functions of `remote.html` are: -->

O `remote.html` executa e renderiza o WordPress e também expõe uma API para que desenvolvedores possam controlá-lo. Importante: o `remote.html` não exibe elementos de interface, como UI de navegador ou seletores de versão. É apenas o WordPress. As funções principais do `remote.html` são:

<!-- -   Loading the suitable version of php.wasm, the WebAssembly build of PHP.
-   Loading the correct version of WordPress for user interaction.
-   Initiating PHP in a WebWorker and registering a ServiceWorker for HTTP requests.
-   Listening to the `message` event from the parent window and executing the appropriate code command. -->

-   Carregar a versão adequada do php.wasm, a build WebAssembly do PHP.
-   Carregar a versão correta do WordPress para interação do usuário.
-   Iniciar o PHP em um WebWorker e registrar um ServiceWorker para requisições HTTP.
-   Ouvir o evento `message` da janela pai e executar o comando de código apropriado.

<!-- That last part is how the public API works. The parent window (`index.html`) sends a message to the `iframe` (`remote.html`) with a command and arguments, and the `iframe` then executes that command and sends the result back with another message. -->

Essa última parte é como a API pública funciona. A janela pai (`index.html`) envia uma mensagem para o `iframe` (`remote.html`) com um comando e argumentos, e o `iframe` executa esse comando e retorna o resultado com outra mensagem.

<!-- Sending messages is cumbersome so the PlaygroundClient class provides an object-oriented API that handles the messages internally. -->

Enviar mensagens diretamente é trabalhoso, por isso a classe `PlaygroundClient` fornece uma API orientada a objetos que gerencia as mensagens internamente.

<!-- For quick testing and debugging, `remote.html` also exposes the JavaScript API client as `window.playground`. You can use it from your devtools as follows: -->

Para testes e depuração rápidos, o `remote.html` também expõe o cliente da API JavaScript como `window.playground`. Você pode usá-lo no console de desenvolvedor assim:

```javascript
> await playground.listFiles("/")
(6) ['tmp', 'home', 'dev', 'proc', 'internal', 'wordpress']
```

<!-- `playground` is a class instance in this context and you will benefit from browser's autocompletion. -->

Neste contexto, `playground` é uma instância de classe e você se beneficiará do autocompletar do navegador.

<!-- ## Index.html -->

## Index.html

<!-- `index.html` is an independent app built around `remote.html` using the WordPress Playground API client. -->

O `index.html` é um aplicativo independente construído em torno do `remote.html` usando o cliente da API do WordPress Playground.

<!-- It renders the browser UI, version selectors, and renders WordPress by embedding `remote.html` via an `iframe`. UI features, such as an address bar or a version selector, are implemented by communicating with `remote.html` using `PlaygroundClient`. -->

Ele exibe a interface do navegador, seletores de versão e renderiza o WordPress incorporando o `remote.html` via um `iframe`. Funcionalidades de UI como barra de endereços ou seletor de versão são implementadas comunicando-se com o `remote.html` usando o `PlaygroundClient`.

<!-- `index.html` monitors the query parameters it receives and triggers the appropriate `PlaygroundClient` methods. For instance, `?plugin=coblocks` triggers `installPluginsFromDirectory( client, ['coblocks'] )`. This mechanism forms the basis of the Query API. -->

O `index.html` monitora os parâmetros de consulta que recebe e aciona os métodos apropriados do `PlaygroundClient`. Por exemplo, `?plugin=coblocks` aciona `installPluginsFromDirectory( client, ['coblocks'] )`. Esse mecanismo é a base da Query API.

<!-- For quick testing and debugging, `index.html` also exposes the JavaScript API client as `window.playground`. You can use it from your devtools as follows: -->

Para testes e depuração rápidos, o `index.html` também expõe o cliente da API JavaScript como `window.playground`. Você pode usá-lo no console de desenvolvedor assim:

```javascript
> await playground.listFiles("/")
(6) ['tmp', 'home', 'dev', 'proc', 'internal', 'wordpress']
```

<!-- Note that `playground` is a Proxy object in this context and you won't get any autocompletion from the browser. -->

Note que `playground` é um objeto Proxy nesse contexto e você não terá autocompletar do navegador.
