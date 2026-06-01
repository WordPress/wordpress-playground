# Playground Remote

`@wp-playground/remote` implements the parent-page to iframe bridge used by
`@wp-playground/client`.

The remote endpoint can boot Playground from Blueprint v1 and v2 declarations.
Blueprint v2 declarations are handled by the native TypeScript runner in
`@wp-playground/blueprints`, while v1 declarations keep the existing v1 path.

## Building

Run `nx build playground-remote` to build the library.

## Running unit tests

Run `nx test playground-remote` to execute the unit tests.
