/**
 * zstddec exposes this subpath's types through package.json `exports`.
 * Some TypeScript project contexts in this monorepo still use module
 * resolution settings that do not read those conditional subpath types. Keep a
 * local shim so tests can import the streaming decoder without `@ts-ignore`.
 */
declare module 'zstddec/stream' {
	export class ZSTDDecoder {
		init(): Promise<void>;
		decodeStreaming(chunks: Iterable<Uint8Array>): Generator<Uint8Array>;
	}
}
