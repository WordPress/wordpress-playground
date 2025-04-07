import { URL as NodeURL } from 'url';
import { Blob as BlobPolyfill } from 'node:buffer';
import { File as NodeFile } from 'node:buffer';
/**
 * We use JSDOM as the Vitest environment to polyfill Web APIs,
 * where JSDOM creates an environment that overrides existing
 * Node.js globals with its polyfills.
 */

/**
 * One of the globals it replaces is URL and it replaces it with whatwg-url.
 *
 * We currently use JSDOM 22.1.0, which doesn't support URL.canParse,
 * but Playground uses Node 20 which supports it, so we are setting
 * the NodeURL.canParse as the global URL.canParse value.
 */
globalThis.URL.canParse = NodeURL.canParse;

/**
 * JSDOM doesn't support Blob stream, arrayBuffer, and text methods,
 * so we are replacing the global Blob with the Node.js version.
 *
 * A File object is a specific kind of Blob, so it's affected by the
 * same issue as Blob and we need to replace it with the Node.js version.
 *
 * JSDOM issue: https://github.com/jsdom/jsdom/issues/2555
 */
globalThis.Blob = BlobPolyfill as any;
globalThis.File = NodeFile as any;
