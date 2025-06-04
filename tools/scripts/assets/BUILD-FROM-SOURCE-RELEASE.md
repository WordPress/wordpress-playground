# Building Playground Packages from a Source Release

Here is how to build Playground packages from a Source release.

## Setup

-   Unpack the tarball in a directory and `cd` into that directory
-   Run `npm install` to install NPM dependencies

## php-wasm

To compile PHP WebAssembly builds run:
`npm run recompile:php`

## Playground minified WordPress builds

-   Run `npx nx bundle-wordpress:major-and-beta --force` to rebuild the major and beta WP versions.
-   Run `npx nx bundle-wordpress:nightly --force` to rebuild the nightly WP version.

## Other packages

To rebuild other packages:

-   Locate the package's `project.json` file nested below the `packages/` directory
-   Note the project's "name" from the top of `project.json`.
-   From the project root, run: `npx nx build <project-name>`
