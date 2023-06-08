# WordPress Playground Resources

### Start Here

-   [Demo](https://playground.wordpress.net/)

-   [Github Repository](https://github.com/WordPress/wordpress-playground)

-   [Documentation](https://wordpress.github.io/wordpress-playground/)

-   [WordPress Playground at State of the Word](https://youtu.be/VeigCZuxnfY?t=2912)

### Reading material and videos

-   [Developer Hours Video Americas Region (May 23,2023)](https://wordpress.tv/2023/05/23/developer-hours-wordpress-playground-americas/)

-   [Developer Hours Video APAC/EMEA Region (May 24,2023)](https://wordpress.tv/2023/05/24/developer-hours-wordpress-playground-apac-emea/)

-   [Build in-browser WordPress experiences with WordPress Playground and WebAssembly](https://web.dev/wordpress-playground/)

-   [WordPress Playground on developer.wordpress.org](https://developer.wordpress.org/playground)

-   [In-Browser WordPress Tech Demos: WordPress Development with WordPress Playground](https://make.wordpress.org/core/2023/04/13/in-browser-wordpress-tech-demos-wordpress-development-with-wordpress-playground/)

-   [Initial announcement on make.wordpress.org](https://make.wordpress.org/core/2022/09/23/client-side-webassembly-wordpress-with-no-server/)

-   [Hackernews discussion](https://news.ycombinator.com/item?id=32960560)

### Apps built with WordPress Playground

-   [Official demo](https://playground.wordpress.net/) and the [showcase](https://developer.wordpress.org/playground) app – install a theme, try out a plugin, create a few pages, download everything

-   [WordPress Playground for VS Code](https://marketplace.visualstudio.com/items?itemName=WordPressPlayground.wordpress-playground)

-   [GlotPress Translation Playground](https://make.wordpress.org/polyglots/2023/04/19/wp-translation-playground/) – help translate WordPress

-   [Interactive tutorial: HTML Tag Processor](https://adamadam.blog/2023/02/16/how-to-modify-html-in-a-php-wordpress-plugin-using-the-new-tag-processor-api/)

-   [Interactive tutorial: Playground JS API](https://adamadam.blog/2023/04/12/interactive-intro-to-wordpress-playground-public-api/)

-   [wp-now](https://www.npmjs.com/package/%40wp-now/wp-now)– CLI tool for instant WordPress dev env

-   [Preview Gutenberg Pull Requests](https://playground.wordpress.net/?gutenberg-pr%3D47739%26php%3D7.4%26url%3D%2Fwp-admin%2Fplugins.php%3Ftest%3D42test) by updating the `?gutenberg-pr` query parameter

-   [Notifications plugin demo](https://johnhooks.io/playground-experiment/) by John Hooks

### Build your first app

-   [Query String API](https://wordpress.github.io/wordpress-playground/pages/embedding-wordpress-playground-on-other-websites.html) – Customize Playground by changing the URL, e.g. `?plugin=coblocks&theme=pendant`, them embed it with an `<iframe />`

    -   Apps built with is API:

        -   [Official showcase](https://developer.wordpress.org/playground)

-   [Blueprints API](https://github.com/WordPress/wordpress-playground/pull/211) – Setup Playground with a JSON file

    -   [Blueprints Editor](https://codesandbox.io/embed/monaco-editor-json-validation-example-forked-r16gpe?fontsize%3D14%26hidenavigation%3D1%26theme%3Ddark%26view%3Dpreview) with autocompletion (via JSON schema)

    -   Apps built with this API:

        -   [GlotPress Translation Playground](https://make.wordpress.org/polyglots/2023/04/19/wp-translation-playground/)

        -   [Preview Gutenberg Pull Requests](https://playground.wordpress.net/?gutenberg-pr%3D47739%26php%3D7.4%26url%3D%2Fwp-admin%2Fplugins.php%3Ftest%3D42test)

        -   [Notifications plugin demo](https://johnhooks.io/playground-experiment/)

-   [JavaScript API tutorial](https://adamadam.blog/2023/04/12/interactive-intro-to-wordpress-playground-public-api/) – Full control, more difficult API

    -   [Official demo](https://playground.wordpress.net/)

    -   [Interactive tutorial: Playground JS API](https://adamadam.blog/2023/04/12/interactive-intro-to-wordpress-playground-public-api/)

### Start contributing

Pick any [open issue](https://github.com/WordPress/wordpress-playground/issues) or propose a new one, clone the repo, and give it a try! If it seems like a big scary project – don’t worry, the onboarding experience is pretty decent. If you ping me on [Twitter](https://twitter.com/adamzielin), I’ll give you a private tour of the project.

### What we can build together in the future

-   [Testable, interactive documentation](https://github.com/WordPress/Documentation-Issue-Tracker/issues/730)

-   Trying out WordPress right on WordPress.org

-   Previewing plugins and themes on WordPress.org

-   Decentralized WordPress on Edge and without central servers

### FAQ

> Is WordPress Playground available in another language?
> Yes! Although it requires some work at the moment. You need to tell Playground to download and install the translation files and one way to do it is using [the Blueprints API](https://wordpress.github.io/wordpress-playground/pages/blueprints-getting-started.html). There is no step-by-step tutorial yet, but you can learn by reading the source of [Playground+Translations plugin](https://translate.wordpress.org/projects/wp-plugins/friends/dev/en-gb/default/playground/) [(GitHub link)](https://github.com/akirk/wp-glotpress-playground/blob/main/index.php).

> Will wp-cli be supported?
> Yes! Some commands already work if you include `wp-cli.phar` in the executed PHP code, and support for others is work in progress. The documentation will be progressively updated to reflect the progress.
