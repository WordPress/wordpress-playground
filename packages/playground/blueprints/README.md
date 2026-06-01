# Playground Blueprints

`@wp-playground/blueprints` validates and compiles Blueprint declarations for
WordPress Playground.

The package supports both Blueprint v1 declarations and Blueprint v2
declarations. The public schema and standalone validator published in
`public/blueprint-schema.json` and `public/blueprint-schema-validator.js` accept
the combined `BlueprintDeclaration` union. The v1 compiler uses the internal
`public/blueprint-v1-schema-validator.js` validator so existing v1 validation
behavior remains isolated from v2.

Blueprint v2 declarations are compiled by the native TypeScript compiler in this
package. It supports v2 runtime configuration, Playground application options,
plugins, themes, site options, constants, content imports, media, fonts, and
imperative steps. Unsupported v1 features fail during v1-to-v2 migration instead
of being silently dropped.

## Building

Run `nx build playground-blueprints` to build the library.

Run `nx run playground-blueprints:build:blueprint-schema` after changing
Blueprint public types or schema generation. Commit the regenerated files under
`packages/playground/blueprints/public/`.

## Running unit tests

Run `nx test playground-blueprints` to execute the Vitest suite.
