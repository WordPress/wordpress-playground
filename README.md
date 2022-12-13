# WordPress Playground

[Live demo](https://wasm.wordpress.net/wordpress.html) | [Documentation and API Reference](https://wordpresswasm.readthedocs.io/en/latest/) 

[WordPress Playground](https://github.com/WordPress/wordpress-playground) is an in-browser WordPress that runs without a PHP server thanks to the magic of WebAssembly.

![](https://raw.githubusercontent.com/wordpress/wordpress-playground/trunk/demo.png)

## Why is WordPress Playground useful?

WordPress Playground is a foundation you can build on top of. Here's a few ideas what you could build:

-   Runnable code snippets in your documentation or course
-   Plugin and theme demos in a private WordPress instance where the user is already logged in as an admin
-   Easily switching PHP and WordPress version when testing
-   Replaying and fixing the failed CI tests right in the browser

See
[the WordPress.org blog post](https://make.wordpress.org/core/2022/09/23/client-side-webassembly-wordpress-with-no-server/) to learn more about the vision.

## Getting started

WordPress Playground has a [live demo](https://developer.wordpress.org/playground/demo/) available.

You can embed WordPress Playground in your project via an `<iframe>` – find out how in the [documentation](https://wordpresswasm.readthedocs.io/en/latest/).

You also can run WordPress Playground locally as follows:

```bash
git clone https://github.com/WordPress/wordpress-playground
cd wordpress-playground
npm install
npm run dev
```

A browser should open and take you to your very own client-side WordPress at [http://127.0.0.1:8777/wordpress.html](http://127.0.0.1:8777/wordpress.html)!

From here, the [documentation](https://github.com/WordPress/wordpress-playground/tree/trunk/docs) will help you learn how WordPress Playground works and how to use it to build amazing things!

## Contributing

WordPress Playground is an ambitious project in its early days. If the feature you need is missing, you are more than welcome to start a discussion, open an issue, and even propose a Pull Request to implement it.
