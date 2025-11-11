---
slug: /developers/apis/javascript-api/playground-api-client
---

# Playground API クライアント

<!--
# Playground API Client
 -->

`PlaygroundClient` オブジェクトは `UniversalPHP` インターフェースを実装しています。このインターフェースのすべてのメソッドは、Node.js および同一プロセス内の PHP インスタンスでも利用可能です（ Playground は Web Worker 内で PHP を実行します）。

<!--
The `PlaygroundClient` object implements the `UniversalPHP` interface. All the methods from that interface are also available in Node.js and same-process PHP instances (Playground runs PHP in a web worker).
 -->

大まかに言うと、クライアントを使用して 3 種類の操作を実行できます。

<!--
Broadly speaking, you can use the client to perform three types of operations:
 -->

-   PHP コードの実行
-   `PHP.ini`のカスタマイズ
-   ファイルとディレクトリの管理

<!--
-   Running PHP code
-   Customizing `PHP.ini`
-   Managing files and directories
 -->

## PHP コードの実行

<!--
## Running PHP code
 -->

PHP コードを実行するには、以下の 2 つの方法があります。

<!--
The two methods you can use to run PHP code are:
 -->

-   [`run()`](#the-run-method) - PHP コードを実行し、その出力を返します。
-   [`request()`](#the-request-method) - ウェブサイトに HTTP リクエストを送信します。

<!--
-   [`run()`](#the-run-method) - runs PHP code and returns the output
-   [`request()`](#the-request-method) - makes an HTTP request to the website
 -->

Node.js では、[`cli()`](#the-cli-method)メソッドを使用して PHP を CLI モードで実行することもできます。

<!--
In Node.js, you can also use the [`cli()`](#the-cli-method) method to run PHP in a CLI mode.
 -->

### `run()` メソッド

<!--
### The `run()` method
 -->

import TSDocstring from '@site/src/components/TSDocstring';

<TSDocstring path={[ "@wp-playground/client", "PlaygroundClient", "run" ]} />

### `request()` メソッド

<!--
### The `request()` method
 -->

<TSDocstring path={[ "@wp-playground/client", "PlaygroundClient", "request" ]} />

## `PHP.ini`のカスタマイズ

<!--
## Customizing `PHP.ini`
 -->

この API クライアントを使用すると、`p​​hp.ini`ファイルを変更することもできます。

<!--
The API client also allows you to change the `php.ini` file:
 -->

```ts
await setPhpIniEntries(client, {
	display_errors: 'On',
	error_reporting: 'E_ALL',
});
```

## ファイルとディレクトリの管理

<!--
## Managing files and directories
 -->

`client` オブジェクトは、PHP ファイルシステム内のファイルとディレクトリを管理するための低レベル API を提供します。

<!--
The `client` object provides you with a low-level API for managing files and directories in the PHP filesystem:
 -->

```ts
await client.mkdirTree('/wordpress/test');
// Create a new PHP file
await client.writeFile(
	'/wordpress/test/index.php',
	`<?php
     echo "Hello, world!<br/>";
     // List all the files in current directory
     print_r(glob(__DIR__ . '/*'));
  `
);
// Create files named 1, 2, and 3
await client.writeFile('/wordpress/test/1', '');
await client.writeFile('/wordpress/test/2', '');
await client.writeFile('/wordpress/test/3', '');
// Remove the file named 1
await client.unlink('/wordpress/test/1');
// Navigate to our PHP file
await client.goTo('/test/index.php');
```

これらのメソッドの完全なリストについては、`PlaygroundClient` インターフェースを参照してください。

<!--
For a complete list of these methods, refer to the `PlaygroundClient` interface.
 -->

## JavaScript にメッセージを送信する

<!--
## Sending messages to JavaScript
 -->

PHP から JavaScript にメッセージを渡すには、`post_message_to_js()` 関数を使用します。この関数は引数を 1 つ取ります。

<!--
You can pass messages from PHP to JavaScript using the `post_message_to_js()` function. It accepts one argument:
 -->

-   `$data` (文字列) – JavaScript に渡すデータ。

<!--
-   `$data` (string) – Data to pass to JavaScript.
 -->

例えば、JSON 形式でエンコードされた投稿 ID とタイトルを含むメッセージを送信するには、次のようにします。

<!--
For example, here's how you would send a message with a JSON-encoded post ID and title:
 -->

```TypeScript
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.3'));

php.onMessage(
	// The data is always passed as a string
	function (data: string) {
		// Let's decode and log the data:
		console.log(JSON.parse(data));
	}
);

// Now that we have a listener in place, let's
// dispatch a message:
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

// You will see the following output in the console:
// { post_id: '15', post_title: 'This is a blog post!' }
```

## `cli()` メソッド

<!--
## The `cli()` method
 -->

Node.js では、PHP を CLI モードで実行する `cli()` メソッドにもアクセスできます。

<!--
In Node.js, you also have access to the `cli()` method that runs PHP in a CLI mode:
 -->

```ts
// Run PHP in a CLI mode
client.cli(['-r', 'echo "Hello, world!";']);
// Outputs "Hello, world!"
```

`cli()` メソッドの実行が完了すると、PHP インスタンスは使用できなくなるため、破棄する必要があります。これは、PHP が内部的にすべてのリソースを解放し、`exit()`を呼び出すためです。

<!--
Once `cli()` method finishes running, the PHP instance is no longer usable and should be discarded. This is because PHP internally cleans up all the resources and calls `exit()`.
 -->
