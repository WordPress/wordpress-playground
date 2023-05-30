# PHP Filesystem

The PHP module has its own filesystem separate from your computer's filesystem. It is provided by [Emscripten's FS library](https://emscripten.org/docs/api_reference/Filesystem-API.html) and the default APIs is low-level and cumbersome to use. The `PHP` JavaScript class shipped with WordPress Playground wraps it with a more convenient higher-level API.

In general, WordPress Playground uses an in-memory virtual filesystem.

However, in Node.js, you can also mount a real directory from the host filesystem into the PHP filesystem.

Here's how to interact with the filesystem in WordPress Playground:

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

For more details consult the BasePHP class directly – it has some great documentation strings.
