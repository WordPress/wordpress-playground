# Playground Remote

`@wp-playground/remote` implements the parent-page to iframe bridge used by
`@wp-playground/client`.

The remote endpoint provides the iframe runtime used after a Blueprint has been
resolved. Direct remote boots use the existing Blueprint v1 worker path. To run
Blueprint v2 declarations, use `@wp-playground/client` or
`@wp-playground/blueprints` so the native TypeScript v2 runner can validate and
lower the declaration before the remote runtime boots.

## Building

Run `nx build playground-remote` to build the library.

## Running unit tests

Run `nx test playground-remote` to execute the unit tests.
