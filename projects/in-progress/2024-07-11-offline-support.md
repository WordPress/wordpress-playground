### Problem we are solving

Playground can't be used while offline.

### Solution

We can make Playground available offline after visiting the Playground.WordPress.net website or installing it as a PWA.

### Project Goal

Allow anyone to use WordPress while offline without a complicated setup.

### Use Cases

This will enable building offline first WordPress apps.

Apps like SPAs and mobile apps that use WordPress as a backend will be able to embed the entire backend in the app and not rely on a server.

### Limitations

We will need to limit the switching of PHP and WordPress versions while offline to ensure users don't download too much data on the first load.

## Project plan

We plan to start by adding PWA support to Playground which will allow users to install it as an app and use it while online.

After that, we need to ensure all assets are available after the first load which will make Playground available offline.

Once Playground works offline we need to restrict some features like version switching while offline and add tests to ensure offline keeps working long-term.

## Development

-   [x] [PWA support](https://github.com/WordPress/wordpress-playground/pull/1086)
-   [ ] [Backfill remote WordPress assets](https://github.com/WordPress/wordpress-playground/pull/1532)
-   [ ] Backfill Playground assets
    -   [ ] [Generate a list of assets to cache](https://github.com/WordPress/wordpress-playground/pull/1573)
    -   [ ] [Cache Playground assets to enable offline support ](https://github.com/WordPress/wordpress-playground/pull/1535)
    -   [x] [Add cache version number](https://github.com/WordPress/wordpress-playground/pull/1541)
    -   [x] [Set web worker startup options with messages instead of query strings](https://github.com/WordPress/wordpress-playground/pull/1574)
    -   [ ] Cache Playground static fetch requests
-   [ ] Offline e2e tests
    -   [ ] Ensure tests run on a preview version of Playground
-   [ ] [Limit features while offline](https://github.com/WordPress/wordpress-playground/pull/1607/files)

## Notes

-   [Prototype](https://github.com/WordPress/wordpress-playground/pull/1483)
-   [Project issue](https://github.com/WordPress/wordpress-playground/issues/133)
