/**
 * A wrapper file that polyfills global APIs for Node.js
 * and re-exports everything from the main PHP module.
 */

const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

export * from './php';
