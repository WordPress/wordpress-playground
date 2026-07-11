/**
 * zstddec exposes this subpath's types through package.json `exports`.
 * The CLI typecheck still uses TypeScript's legacy `node` module resolution,
 * which does not read those conditional subpath types. Keep this shim local to
 * the WordPress package until the CLI project adopts the repo default bundler
 * resolution.
 */
declare module 'zstddec/stream' {
	export class ZSTDDecoder {
		init(): Promise<void>;
		decodeStreaming(chunks: Iterable<Uint8Array>): Generator<Uint8Array>;
	}
}
