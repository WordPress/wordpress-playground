// Emscripten generates code for Node.js that uses the `require` function.
// We need to explicitly create a require function to avoid errors when running
// this code in Node.js as an ES module.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// Note: The path and url modules are currently needed by code injected by the php-wasm Dockerfile.
import path from 'path';
import { fileURLToPath } from 'url';

// Determine the current directory path. In CJS mode, __dirname is available.
// In ESM mode, we derive it from import.meta.url.
const currentDirPath =
	typeof __dirname !== 'undefined'
		? __dirname
		: path.dirname(fileURLToPath(import.meta.url));
