---
slug: /developers/architecture/wasm-php-filesystem
---

<!-- # PHP Filesystem -->

# Sistema de Arquivos PHP

<!-- The PHP module has its own filesystem separate from your computer's filesystem. It is provided by [Emscripten's FS library](https://emscripten.org/docs/api_reference/Filesystem-API.html) and the default APIs is low-level and cumbersome to use. The `PHP` JavaScript class shipped with WordPress Playground wraps it with a more convenient higher-level API. -->

O módulo PHP tem seu próprio sistema de arquivos separado do sistema de arquivos do seu computador. Ele é fornecido pela [biblioteca FS do Emscripten](https://emscripten.org/docs/api_reference/Filesystem-API.html) e as APIs padrão são de baixo nível e incômodas de usar. A classe JavaScript `PHP` enviada com o WordPress Playground a envolve com uma API de alto nível mais conveniente.

<!-- In general, WordPress Playground uses an in-memory virtual filesystem. -->

Em geral, o WordPress Playground usa um sistema de arquivos virtual na memória.

<!-- However, in Node.js, you can also mount a real directory from the host filesystem into the PHP filesystem. -->

No entanto, no Node.js, você também pode montar um diretório real do sistema de arquivos host no sistema de arquivos PHP.

<!-- Here's how to interact with the filesystem in WordPress Playground: -->

Aqui está como interagir com o sistema de arquivos no WordPress Playground:

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

<!-- For more details consult the BasePHP class directly – it has some great documentation strings. -->

Para mais detalhes, consulte a classe BasePHP diretamente – ela tem algumas strings de documentação excelentes.
