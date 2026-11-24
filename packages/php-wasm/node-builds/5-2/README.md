# @php-wasm/node-5-2

PHP 5.2 WebAssembly binaries for Node.js (legacy).

This package contains:

- JSPI and Asyncify variants of PHP 5.2 compiled to WebAssembly

No bundled extensions (intl, Xdebug, Redis, Memcached) — calling the
corresponding getter functions throws.

## Installation

```bash
npm install @php-wasm/node-5-2
```

## Usage

```typescript
import { getPHPLoaderModule } from '@php-wasm/node-5-2';

const loaderModule = await getPHPLoaderModule();
```

## Related Packages

- [@php-wasm/node](https://www.npmjs.com/package/@php-wasm/node) - Main package (requires version packages)
- [@php-wasm/universal](https://www.npmjs.com/package/@php-wasm/universal) - Universal PHP.wasm bindings

## License

GPL-2.0-or-later
