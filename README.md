# WordPress Sandbox

[Live demo](https://wasm.wordpress.net/wordpress.html) | [Documentation and API Reference](https://wordpresswasm.readthedocs.io/en/latest/) | [GitHub Repository](https://github.com/WordPress/wordpress-sandbox)

[WordPress Sandbox](https://github.com/WordPress/wordpress-sandbox) is an in-browser WordPress that runs without a PHP server thanks to the magic of WebAssembly.

![](https://raw.githubusercontent.com/wordpress/wordpress-sandbox/trunk/demo.gif)

## Why is WordPress Sandbox useful?

I'm glad you asked – WordPress Sandbox is a big deal!

It can power:

-   Run editable code examples in your documentation or course
-   Plugin and theme demos in a private WordPress instance where the user is already logged in as admin
-   Easily switching PHP and WordPress version when testing
-   Replaying and fixing the failed CI tests right in the browser

WordPress Sandbox provides a strong foundation for the above use-cases but does not implement them just yet. This project is still in its early days and needs contributors. Become a contributor today and help us make these tools a reality!

See
[the WordPress.org blog post](https://make.wordpress.org/core/2022/09/23/client-side-webassembly-wordpress-with-no-server/) to learn about the vision, other use-cases, and the visuals.

## Getting started

You can run WordPress Sandbox as follows:

```bash
git clone https://github.com/WordPress/wordpress-sandbox
cd wordpress-sandbox
npm install
npm run dev
```

A browser should open and take you to your very own client-side WordPress at [http://127.0.0.1:8777/wordpress.html](http://127.0.0.1:8777/wordpress.html)!

As of today, the best way to play with WordPress Sandbox is to directly modify the cloned files – [packages/wordpress-sandbox/](./packages/wordpress-sandbox) is a good place to start.

Why aren't there any npm packages? This is a new project and didn't get there yet – all the efforts were focused on getting it to work. If you'd like to see public npm packages sooner than later, you are more than welcome to contribute.

## Next steps

Consult the [documentation](https://github.com/WordPress/wordpress-sandbox/tree/trunk/docs) to learn how WordPress Sandbox works and how you can help you build amazing things!
