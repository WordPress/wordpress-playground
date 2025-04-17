// Emscripten generates code for Node.js that uses the `require` function.
// We need to explicitly create a require function to avoid errors when running
// this code in Node.js as an ES module.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const __dirname = new URL('.', import.meta.url).pathname;
