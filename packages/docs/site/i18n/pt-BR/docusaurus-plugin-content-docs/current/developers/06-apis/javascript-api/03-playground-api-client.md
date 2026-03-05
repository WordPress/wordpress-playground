---
slug: /developers/apis/javascript-api/playground-api-client
---

<!-- # Playground API Client -->

# Cliente da API do Playground

<!-- The `PlaygroundClient` object implements the `UniversalPHP` interface. All the methods from that interface are also available in Node.js and same-process PHP instances (Playground runs PHP in a web worker). -->

O objeto `PlaygroundClient` implementa a interface `UniversalPHP`. Todos os métodos dessa interface também estão disponíveis em Node.js e em instâncias PHP no mesmo processo (o Playground executa o PHP em um web worker).

<!-- Broadly speaking, you can use the client to perform three types of operations: -->

De modo geral, você pode usar o cliente para realizar três tipos de operações:

-   Executar código PHP
-   Personalizar o `PHP.ini`
-   Gerenciar arquivos e diretórios

<!-- ## Running PHP code -->

## Executando código PHP

<!-- The two methods you can use to run PHP code are: -->

Os dois métodos que você pode usar para executar código PHP são:

-   [`run()`](#the-run-method) – executa código PHP e retorna a saída
-   [`request()`](#the-request-method) – faz uma requisição HTTP para o site

<!-- In Node.js, you can also use the [`cli()`](#the-cli-method) method to run PHP in a CLI mode. -->

No Node.js, você também pode usar o método [`cli()`](#the-cli-method) para executar o PHP no modo CLI.

<!-- ### The run() method -->

### O método `run()`

import TSDocstring from '@site/src/components/TSDocstring';

<TSDocstring path={[ "@wp-playground/client", "PlaygroundClient", "run" ]} />

<!-- ### The request() method -->

### O método `request()`

<TSDocstring path={[ "@wp-playground/client", "PlaygroundClient", "request" ]} />

<!-- ## Customizing PHP.ini -->

## Personalizando o `PHP.ini`

<!-- The API client also allows you to change the php.ini file: -->

O cliente da API também permite alterar o arquivo `php.ini`:

```ts
await setPhpIniEntries(client, {
	display_errors: 'On',
	error_reporting: 'E_ALL',
});
```

<!-- ## Managing files and directories -->

## Gerenciando arquivos e diretórios

<!-- The `client` object provides you with a low-level API for managing files and directories in the PHP filesystem: -->

O objeto `client` oferece uma API de baixo nível para gerenciar arquivos e diretórios no sistema de arquivos do PHP:

```ts
await client.mkdirTree('/wordpress/test');
// Cria um novo arquivo PHP
await client.writeFile(
	'/wordpress/test/index.php',
	`<?php
     echo "Hello, world!<br/>";
     // Lista todos os arquivos no diretório atual
     print_r(glob(__DIR__ . '/*'));
  `
);
// Cria arquivos chamados 1, 2 e 3
await client.writeFile('/wordpress/test/1', '');
await client.writeFile('/wordpress/test/2', '');
await client.writeFile('/wordpress/test/3', '');
// Remove o arquivo chamado 1
await client.unlink('/wordpress/test/1');
// Navega até nosso arquivo PHP
await client.goTo('/test/index.php');
```

<!-- For a full list of these methods, consult the PlaygroundClient interface. -->

Para uma lista completa desses métodos, consulte a interface `PlaygroundClient`.

<!-- ## Sending messages to JavaScript -->

## Enviando mensagens para o JavaScript

<!-- You can pass messages from PHP to JavaScript using the `post_message_to_js()` function. It accepts one argument: -->

Você pode enviar mensagens do PHP para o JavaScript usando a função `post_message_to_js()`. Ela aceita um argumento:

<!-- -   `$data` (string) – Data to pass to JavaScript. -->

-   `$data` (string) – Dados a serem enviados para o JavaScript.

<!-- For example, here's how you would send a message with a JSON-encoded post ID and title: -->

Por exemplo, veja como enviar uma mensagem com um ID e título de post codificados em JSON:

```TypeScript
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.3'));

php.onMessage(
	// Os dados são sempre passados como string
	function (data: string) {
		// Vamos decodificar e exibir os dados:
		console.log(JSON.parse(data));
	}
);

// Agora que temos um listener, vamos
//enviar uma mensagem:
await php.runStream({
	code: `<?php
        post_message_to_js(
            json_encode([
                'post_id' => '15',
                'post_title' => 'This is a blog post!'
            ])
        );
    `,
});

// Você verá a seguinte saída no console:
// { post_id: '15', post_title: 'This is a blog post!' }
```

<!-- ## The cli() method -->

## O método `cli()`

<!-- In Node.js, you also have access to the `cli()` method that runs PHP in a CLI mode: -->

No Node.js, você também tem acesso ao método `cli()`, que executa o PHP no modo CLI:

```ts
// Executa o PHP no modo CLI
client.cli(['-r', 'echo "Hello, world!";']);
// Exibe "Hello, world!"
```

<!-- Once cli() method finishes running, the PHP instance is no* longer usable and should be discarded. This is because PHP internally cleans up all the resources and calls exit(). -->

Depois que o método `cli()` termina de rodar, a instância do PHP não pode mais ser usada e deve ser descartada. Isso ocorre porque o PHP limpa todos os recursos internamente e chama `exit()`.
