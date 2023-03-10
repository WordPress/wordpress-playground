# WordPress Playground

[Project Page](https://developer.wordpress.org/playground/) | [Live demo](https://wasm.wordpress.net/wordpress.html) | [Documentation and API Reference](https://wordpresswasm.readthedocs.io/en/latest/) 

[WordPress Playground](https://github.com/WordPress/wordpress-playground) is an experimental in-browser WordPress that runs without a PHP server thanks to the magic of WebAssembly.

![](https://raw.githubusercontent.com/wordpress/wordpress-playground/trunk/demo.png)

## Why is WordPress Playground useful?

WordPress Playground is a building block that can power apps like:

-   Runnable code snippets in your documentation or course
-   Plugin and theme demos in a private WordPress instance where the user is already logged in as an admin
-   Easily switching PHP and WordPress version when testing
-   Replaying and fixing the failed CI tests right in the browser

See
[the WordPress.org announcement post](https://make.wordpress.org/core/2022/09/23/client-side-webassembly-wordpress-with-no-server/) to learn more about the vision.

## Getting started

WordPress Playground has a [live demo](https://developer.wordpress.org/playground/demo/) available.

You can embed WordPress Playground in your project via an `<iframe>` – find out how in the [documentation](https://wordpresswasm.readthedocs.io/en/latest/). **Note the embed is experimental and may break or change without a warning.**

You also can run WordPress Playground locally as follows:

```bash
git clone https://github.com/WordPress/wordpress-playground
cd wordpress-playground
yarn install
yarn run build
yarn run dev
```

A browser should open and take you to your very own client-side WordPress at [http://127.0.0.1:8777/wordpress.html](http://127.0.0.1:8777/wordpress.html)!

Any changes you make to `.ts` files will be live-reloaded. Changes to `Dockerfile` require a full rebuild.

From here, the [documentation](https://wordpresswasm.readthedocs.io/en/latest/) will help you learn how WordPress Playground works and how to use it to build amazing things!

## Backwards compatibility

This experimental software may break or change without a warning. Releasing a stable API is an important future milestone that will be reached once the codebase is mature enough.

## Prior art

WordPress Playground forked the original PHP to WebAssembly build published in https://github.com/oraoto/pib and modified later in https://github.com/seanmorris/php-wasm.

Another strong inspiration was the [Drupal in the browser demo](https://seanmorris.github.io/php-wasm/?autorun=0&persist=0&single-expression=0&code=%253C%253Fphp%250Aini_set%28%27session.save_path%27%252C%2520%27%252Fhome%252Fweb_user%27%29%253B%250A%250A%2524stdErr%2520%253D%2520fopen%28%27php%253A%252F%252Fstderr%27%252C%2520%27w%27%29%253B%250A%2524errors%2520%253D%2520%255B%255D%253B%250A%250Aregister_shutdown_function%28function%28%29%2520use%28%2524stdErr%252C%2520%2526%2524errors%29%257B%250A%2520%2520%2520%2520fwrite%28%2524stdErr%252C%2520json_encode%28%255B%27session_id%27%2520%253D%253E%2520session_id%28%29%255D%29%2520.%2520%2522%255Cn%2522%29%253B%250A%2520%2520%2520%2520fwrite%28%2524stdErr%252C%2520json_encode%28%255B%27headers%27%253D%253Eheaders_list%28%29%255D%29%2520.%2520%2522%255Cn%2522%29%253B%250A%2520%2520%2520%2520fwrite%28%2524stdErr%252C%2520json_encode%28%255B%27errors%27%2520%253D%253E%2520error_get_last%28%29%255D%29%2520.%2520%2522%255Cn%2522%29%253B%250A%257D%29%253B%250A%250Aset_error_handler%28function%28...%2524args%29%2520use%28%2524stdErr%252C%2520%2526%2524errors%29%257B%250A%2509fwrite%28%2524stdErr%252C%2520print_r%28%2524args%252C1%29%29%253B%250A%257D%29%253B%250A%250A%2524docroot%2520%253D%2520%27%252Fpreload%252Fdrupal-7.59%27%253B%250A%2524path%2520%2520%2520%2520%253D%2520%27%252F%27%253B%250A%2524script%2520%2520%253D%2520%27index.php%27%253B%250A%250A%2524_SERVER%255B%27REQUEST_URI%27%255D%2520%2520%2520%2520%2520%253D%2520%2524docroot%2520.%2520%2524path%253B%250A%2524_SERVER%255B%27REMOTE_ADDR%27%255D%2520%2520%2520%2520%2520%253D%2520%27127.0.0.1%27%253B%250A%2524_SERVER%255B%27SERVER_NAME%27%255D%2520%2520%2520%2520%2520%253D%2520%27localhost%27%253B%250A%2524_SERVER%255B%27SERVER_PORT%27%255D%2520%2520%2520%2520%2520%253D%25203333%253B%250A%2524_SERVER%255B%27REQUEST_METHOD%27%255D%2520%2520%253D%2520%27GET%27%253B%250A%2524_SERVER%255B%27SCRIPT_FILENAME%27%255D%2520%253D%2520%2524docroot%2520.%2520%27%252F%27%2520.%2520%2524script%253B%250A%2524_SERVER%255B%27SCRIPT_NAME%27%255D%2520%2520%2520%2520%2520%253D%2520%2524docroot%2520.%2520%27%252F%27%2520.%2520%2524script%253B%250A%2524_SERVER%255B%27PHP_SELF%27%255D%2520%2520%2520%2520%2520%2520%2520%2520%253D%2520%2524docroot%2520.%2520%27%252F%27%2520.%2520%2524script%253B%250A%250Achdir%28%2524docroot%29%253B%250A%250Aob_start%28%29%253B%250A%250Adefine%28%27DRUPAL_ROOT%27%252C%2520getcwd%28%29%29%253B%250A%250Arequire_once%2520DRUPAL_ROOT%2520.%2520%27%252Fincludes%252Fbootstrap.inc%27%253B%250Adrupal_bootstrap%28DRUPAL_BOOTSTRAP_FULL%29%253B%250A%250A%2524uid%2520%2520%2520%2520%2520%253D%25201%253B%250A%2524user%2520%2520%2520%2520%253D%2520user_load%28%2524uid%29%253B%250A%2524account%2520%253D%2520array%28%27uid%27%2520%253D%253E%2520%2524user-%253Euid%29%253B%250Auser_login_submit%28array%28%29%252C%2520%2524account%29%253B%250A%250A%2524itemPath%2520%253D%2520%2524path%253B%250A%2524itemPath%2520%253D%2520preg_replace%28%27%252F%255E%255C%255C%252Fpreload%252F%27%252C%2520%27%27%252C%2520%2524itemPath%29%253B%250A%2524itemPath%2520%253D%2520preg_replace%28%27%252F%255E%255C%255C%252Fdrupal-7.59%252F%27%252C%2520%27%27%252C%2520%2524itemPath%29%253B%250A%2524itemPath%2520%253D%2520preg_replace%28%27%252F%255E%255C%252F%252F%27%252C%2520%27%27%252C%2520%2524itemPath%29%253B%250A%250Aif%28%2524itemPath%29%250A%257B%250A%2520%2520%2520%2520%250A%2520%2520%2520%2520%2524router_item%2520%253D%2520menu_get_item%28%2524itemPath%29%253B%250A%2520%2520%2520%2520%2524router_item%255B%27access_callback%27%255D%2520%253D%2520true%253B%250A%2520%2520%2520%2520%2524router_item%255B%27access%27%255D%2520%253D%2520true%253B%250A%2520%2520%2520%2520%250A%2520%2520%2520%2520if%2520%28%2524router_item%255B%27include_file%27%255D%29%2520%257B%250A%2520%2520%2520%2520%2520%2520require_once%2520DRUPAL_ROOT%2520.%2520%27%252F%27%2520.%2520%2524router_item%255B%27include_file%27%255D%253B%250A%2520%2520%2520%2520%257D%250A%2520%2520%2520%2520%250A%2520%2520%2520%2520%2524page_callback_result%2520%253D%2520call_user_func_array%28%2524router_item%255B%27page_callback%27%255D%252C%2520unserialize%28%2524router_item%255B%27page_arguments%27%255D%29%29%253B%250A%2520%2520%2520%2520%250A%2520%2520%2520%2520drupal_deliver_page%28%2524page_callback_result%29%253B%250A%257D%250Aelse%250A%257B%250A%2520%2520%2520%2520menu_execute_active_handler%28%29%253B%250A%257D&render-as=html) which proved you can run non-trivial PHP software in the browser.

A worthy mention is Wasm Labs’s closed-source [WordPress in the browser](https://wordpress.wasmlabs.dev/) shared before this project was first published. There is no public repository available, but their [technical overview](https://wasmlabs.dev/articles/wordpress-in-the-browser/) gives a breakdown of the technical decisions that project took. WordPress Playground draws inspiration from the same PHP in the browser projects and makes similar technical choices.

## Contributing

WordPress Playground is an ambitious project in its early days. If the feature you need is missing, you are more than welcome to start a discussion, open an issue, and even propose a Pull Request to implement it.
