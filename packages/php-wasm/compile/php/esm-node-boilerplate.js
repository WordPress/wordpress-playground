// Emscripten generates code for Node.js that uses the `require` function.
// We need to explicitly create a require function to avoid errors when running
// this code in Node.js as an ES module.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// Note: The path module is currently needed by code injected by the php-wasm Dockerfile.
import path from 'path';

