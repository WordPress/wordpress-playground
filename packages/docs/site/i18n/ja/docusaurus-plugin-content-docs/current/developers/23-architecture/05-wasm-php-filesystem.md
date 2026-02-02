---
slug: /developers/architecture/wasm-php-filesystem
---

# PHP ファイルシステム

<!--
# PHP Filesystem
-->

PHPモジュールには、お使いのコンピュータのファイルシステムとは別に、独自のファイルシステムがあります。これは[Emscripten のFSライブラリ](https://emscripten.org/docs/api_reference/Filesystem-API.html)によって提供されており、デフォルトの API は低レベルで使いにくいです。WordPress Playground に同梱されている `PHP` JavaScript クラスは、より使いやすい高レベル API でそれをラップしています。

<!--
The PHP module has its own filesystem separate from your computer's filesystem. It is provided by [Emscripten's FS library](https://emscripten.org/docs/api_reference/Filesystem-API.html) and the default APIs is low-level and cumbersome to use. The `PHP` JavaScript class shipped with WordPress Playground wraps it with a more convenient higher-level API.
-->

一般的に、WordPress Playground はインメモリの仮想ファイルシステムを使用します。

<!--
In general, WordPress Playground uses an in-memory virtual filesystem.
-->

ただし、Node.jsでは、ホストファイルシステムの実際のディレクトリをPHPファイルシステムにマウントすることもできます。

<!--
However, in Node.js, you can also mount a real directory from the host filesystem into the PHP filesystem.
-->

WordPress Playgroundでファイルシステムを操作する方法は次のとおりです。

<!--
Here's how to interact with the filesystem in WordPress Playground:
-->

```js
// /var/wwwディレクトリを再帰的に作成する
php.mkdirTree('/var/www');

console.log(php.fileExists('/var/www/file.txt'));
// false

php.writeFile('/var/www/file.txt', 'Hello from the filesystem!');

console.log(php.fileExists('/var/www/file.txt'));
// true

console.log(php.readFile('/var/www/file.txt'));
// "Hello from the filesystem!

// ファイルを削除します:
php.unlink('/var/www/file.txt');
```

<!--
```js
// Recursively create a /var/www directory
php.mkdirTree('/var/www');

console.log(php.fileExists('/var/www/file.txt'));
// false

php.writeFile('/var/www/file.txt', 'Hello from the filesystem!');

console.log(php.fileExists('/var/www/file.txt'));
// true

console.log(php.readFile('/var/www/file.txt'));
// "Hello from the filesystem!

// Delete the file:
php.unlink('/var/www/file.txt');
```
-->

詳細については、BasePHP クラスを直接参照してください。優れたドキュメント文字列がいくつかあります。

<!--
For more details consult the BasePHP class directly – it has some great documentation strings.
-->
