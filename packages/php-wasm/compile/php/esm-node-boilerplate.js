// Emscripten generates code for Node.js that uses the `require` function.
// We need to explicitly create a require function to avoid errors when running
// this code in Node.js as an ES module.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { fileURLToPath } from 'url';

/**
 * __filename and __dirname are not available in ES modules, so we need to
 * polyfill them to ensure the debug command (npx nx debug playground-cli)
 * works.
 *
 * @see https://nodejs.org/api/esm.html#no-__filename-or-__dirname
 */
import path from 'path';
if (typeof __filename === 'undefined') {
	var __filename = fileURLToPath(import.meta.url);
}
if (typeof __dirname === 'undefined') {
	var __dirname = path.dirname(__filename);
}

