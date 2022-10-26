# WordPress in the browser!

WordPress.wasm is a client-side WordPress that runs without a PHP server thanks to the magic of WebAssembly. 

[See the live demo!](https://wasm.wordpress.net/wordpress.html)

![](demo.gif)

Table of contents:

- [Why is this useful?](#what-is-this-useful)
- [Getting started](#getting-started)
- [Project structure](#project-structure)

## Why is this useful?

I'm glad you asked – WordPress.wasm is a big deal!

WordPress.wasm can power:

* Runeditable code examples in your documentation or course
* Plugin and theme demos in a private WordPress instance where the user is already logged in as admin
* Easily switching PHP and WordPress version when testing
* Replaying and fixing the failed CI tests right in the browser

WordPress.wasm provides a strong foundation for the above use-cases but does not implement them just yet. This project is still in its early days and needs contributors. Become a contributor today and help us make these tools a reality!

See 
[the WordPress.org blog post](https://make.wordpress.org/core/2022/09/23/client-side-webassembly-wordpress-with-no-server/) to learn about the vision, other use-cases, and the visuals.

### Getting started

You can run WordPress.wasm as follows:

```js
git clone https://github.com/WordPress/wordpress-wasm
cd wordpress-wasm
npm install
npm run dev
```

A browser should open and take you to your very own client-side WordPress at http://127.0.0.1:8777/wordpress.html! 

As of today, the best way to play with WordPress.wasm is to directly modify the cloned files. [src/web/](https://github.com/WordPress/wordpress-wasm/tree/trunk/src) is a good place to start.

Why aren't there any npm packages? This is a new project and didn't get there yet – all the efforts were focused on getting it to work. If you'd like to see public npm packages sooner than later, you are more than welcome to contribute.

## Project structure

WordPress.wasm consists of the following building blocks:

* [php-wasm](./packages/php-wasm) – a configurable PHP->WebAssembly build pipeline, convenient JavaScript bindings, and a PHP server implemented in JavaScript.
* [php-wasm-browser](./packages/php-wasm) – tools to run real PHP apps in the browser via `php-wasm`, like a Service Worker implementation or Worker Threads to run the PHP runtime concurrently.
* [wordpress-wasm](./packages/php-wasm) – runs WordPress in the browser using the other two packages.

Consult the README.md in each of these packages to learn more.
