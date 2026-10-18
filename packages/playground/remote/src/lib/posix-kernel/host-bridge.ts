/**
 * Browser counterpart to `playground/cli/src/posix-kernel/host-bridge.ts`.
 *
 * The CLI dynamic-imports `host/dist/index.js` from
 * `@wp-playground/posix-kernel-builds` because we don't want
 * Vite/esbuild to bundle Node-only paths. In the browser worker we
 * need actual `import` statements so Vite can follow them and emit a
 * proper worker bundle — so we import `BrowserKernel`,
 * `HttpBridgeHost`, and `KandeloImageFs` directly from the `kandelo/`
 * submodule through the `@kandelo/*` aliases.
 *
 * Indirection through this module isolates playground call sites from
 * the submodule layout. If the kernel project moves these modules,
 * only this file needs to change.
 *
 * The `@kernel-wasm` and `@kernel-binary/<rel>` aliases are resolved
 * by `resolveKernelBinariesPlugin` in `remote/vite.posix-kernel.config.ts`.
 */

export { BrowserKernel } from '@kandelo/host/src/browser-kernel-host';

export { HttpBridgeHost } from '@kandelo/apps/browser-demos/lib/http-bridge';
export type {
	HttpRequest,
	HttpResponse,
} from '@kandelo/apps/browser-demos/lib/http-bridge';

export { KandeloImageFs } from '@kandelo/images/vfs/lib/kandelo-image-fs';
