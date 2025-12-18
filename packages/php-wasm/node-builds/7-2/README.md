# @php-wasm/node-7-2

PHP 7.2 WebAssembly binaries for Node.js.

This package contains:

- JSPI and Asyncify variants of PHP 7.2 compiled to WebAssembly
- intl extension for PHP 7.2
- xdebug extension for PHP 7.2

## Installation

```bash
npm install @php-wasm/node-7-2
```

## Usage

```typescript
import { getPHPLoaderModule, getIntlExtensionPath } from '@php-wasm/node-7-2';

const loaderModule = await getPHPLoaderModule();
const intlPath = await getIntlExtensionPath();
```

## Related Packages

- [@php-wasm/node](https://www.npmjs.com/package/@php-wasm/node) - Main package (requires version packages)
- [@php-wasm/universal](https://www.npmjs.com/package/@php-wasm/universal) - Universal PHP.wasm bindings

## License

GPL-2.0-or-later
