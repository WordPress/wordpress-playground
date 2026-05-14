/**
 * Browser counterpart to `playground/cli/src/posix-kernel/host-bridge.ts`.
 *
 * The CLI dynamic-imports `host/dist/index.js` from `WASM_POSIX_KERNEL_DIR`
 * because the kernel isn't an npm dependency and we don't want
 * Vite/esbuild to bundle Node-only paths. In the browser worker we
 * need actual `import` statements so Vite can follow them and emit a
 * proper worker bundle — so we import the demo-level `BrowserKernel`
 * and the nested kernel-worker entry directly from the bundled
 * `wasm-posix-kernel/` submodule via relative paths.
 *
 * Indirection through this module isolates playground call sites from
 * the submodule layout. If the kernel project moves `BrowserKernel`
 * into its published `host` package later, only this file needs to
 * change.
 *
 * The `@kernel-wasm` and `@kernel-binary/<rel>` aliases are resolved
 * by `resolveKernelBinariesPlugin` in `remote/vite.posix-kernel.config.ts`.
 */

export { BrowserKernel } from '@wasm-posix-kernel/examples/browser/lib/browser-kernel';

export { HttpBridgeHost } from '@wasm-posix-kernel/examples/browser/lib/http-bridge';
export type {
	HttpRequest,
	HttpResponse,
} from '@wasm-posix-kernel/examples/browser/lib/http-bridge';

export { MemoryFileSystem } from '@wasm-posix-kernel/host/src/vfs/memory-fs';
