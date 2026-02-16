# Blueprints

Blueprints are declarative JSON configurations that define WordPress site states.
This package provides the step implementations, the V1 TypeScript runner, and the
experimental V2 PHP runner.

## Adding a New Blueprint Step

A step requires changes in four places:

### 1. Create the step file (`src/lib/steps/<step-name>.ts`)

Define an interface and a handler function:

```typescript
import type { StepHandler } from '.';

export interface MyNewStep {
    step: 'myNew';
    // Step-specific properties...
    someOption: string;
}

export const myNew: StepHandler<MyNewStep> = async (
    playground,
    { someOption },
    progress
) => {
    progress?.tracker.setCaption('Doing the thing...');
    // Implementation using playground (UniversalPHP instance)
};
```

The handler function name must match the `step` field value (camelCase).

### 2. Register in `src/lib/steps/handlers.ts`

Add a re-export:

```typescript
export { myNew } from './my-new';
```

### 3. Register in `src/lib/steps/index.ts`

- Import the type
- Add it to the `GenericStep` union type
- Add it to the type exports

### 4. Create tests (`src/lib/steps/<step-name>.spec.ts`)

Tests bootstrap a full WordPress environment:

```typescript
import { bootWordPressAndRequestHandler } from '@wp-playground/wordpress';
import { loadNodeRuntime } from '@php-wasm/node';
import { RecommendedPHPVersion } from '@wp-playground/common';

describe('Blueprint step myNew()', () => {
    let php: PHP;
    let handler: PHPRequestHandler;

    beforeEach(async () => {
        handler = await bootWordPressAndRequestHandler({
            createPhpRuntime: async () =>
                await loadNodeRuntime(RecommendedPHPVersion),
            siteUrl: 'http://playground-domain/',
            wordPressZip: await getWordPressModule(),
            sqliteIntegrationPluginZip: await getSqliteDriverModule(),
        });
        php = await handler.getPrimaryPhp();
    }, 30_000);

    afterEach(async () => {
        php.exit();
        await handler[Symbol.asyncDispose]();
    });

    it('should do the thing', async () => {
        await myNew(php, { someOption: 'value' });
        // assertions...
    });
});
```

## Step Invocation (V1)

Steps are invoked via `src/lib/v1/compile.ts`. It imports all handlers from
`handlers.ts` as `allStepHandlers` and builds a `keyedStepHandlers` map that
maps step names to handler functions:

```
keyedStepHandlers[step.step](playground, args, progressOptions)
```

Two special mappings exist: `'wp-cli'` → `wpCLI`, `'importFile'` → `importWxr`.

## V1 vs V2

- **V1** (`src/lib/v1/`): TypeScript runner. Steps execute as TypeScript functions.
  Handles resource resolution (files, URLs, git repos), progress tracking, and
  JSON schema validation.
- **V2** (`src/lib/v2/`): Experimental PHP runner. Delegates execution to a
  `blueprints.phar` file via CLI. Communicates via message protocol
  (`blueprint.progress`, `blueprint.error`, `blueprint.completion`).

## Schema Generation

Blueprint JSON schemas are auto-generated from TypeScript types. After modifying
step interfaces, rebuild with:

```bash
npx nx build playground-blueprints
```

The schema is NOT auto-rebuilt in `npm run dev` mode because the `dts-bundle-generator`
utility used for type rollups does not support watching.

## Testing

```bash
npx nx test playground-blueprints
npx nx test playground-blueprints --testFile=activate-plugin.spec.ts
```

Tests require the `@php-wasm/node` runtime and `@wp-playground/wordpress-builds`
modules, which bootstrap a real WordPress instance with SQLite.
