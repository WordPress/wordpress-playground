# WordPress Sandbox

[Live demo](https://wasm.wordpress.net/wordpress.html) | [Documentation and API Reference](https://wordpresswasm.readthedocs.io/en/latest/) 

[WordPress Sandbox](https://github.com/WordPress/wordpress-sandbox) is an in-browser WordPress that runs without a PHP server thanks to the magic of WebAssembly.

![](https://raw.githubusercontent.com/wordpress/wordpress-sandbox/trunk/demo.png)

## Why is WordPress Sandbox useful?

WordPress Sandbox can power:

-   Runnable code snippets in your documentation or course
-   Plugin and theme demos in a private WordPress instance where the user is already logged in as an admin
-   Easily switching PHP and WordPress version when testing
-   Replaying and fixing the failed CI tests right in the browser

And so much more! See
[the WordPress.org blog post](https://make.wordpress.org/core/2022/09/23/client-side-webassembly-wordpress-with-no-server/) to learn more about the vision.

Note that WordPress Sandbox provides a strong foundation for the above use-cases but does not implement them yet. This project is still in its early days and needs contributors. Become a contributor today and help us make these tools a reality!

## Getting started

You can run WordPress Sandbox as follows:

```bash
git clone https://github.com/WordPress/wordpress-sandbox
cd wordpress-sandbox
npm install
npm run dev
```

A browser should open and take you to your very own client-side WordPress at [http://127.0.0.1:8777/wordpress.html](http://127.0.0.1:8777/wordpress.html)!

Consult the [documentation](https://github.com/WordPress/wordpress-sandbox/tree/trunk/docs) to learn how WordPress Sandbox works and how it can help you build amazing things!
