/**
 * Dynamic stdin support for `PHP.cli()`.
 *
 * The WASM PHP runtime reads stdin through an Emscripten `Module.stdin`
 * callback. That callback is captured when the runtime initializes and
 * cannot be replaced afterwards — but the closure body can consult a
 * mutable reference. This module gives consumers a safe API for doing
 * that without poking Emscripten internals directly.
 *
 * Typical flow:
 *
 *   1. `loadPHPRuntime` creates a `CliStdinState` and installs a
 *      `Module.stdin` shim that consults it on every character read.
 *   2. `PHP.cli(argv, { stdin })` populates the state with bytes before
 *      invoking `run_cli`, so `php://stdin` inside PHP reads those bytes.
 *
 * The runtime is single-use for `cli()` (PHP exits on completion), so
 * the state does not need to be restored between calls.
 *
 * Consumers that want to forward host stdin must do so explicitly — see
 * `@php-wasm/cli` for an example that drains `process.stdin` when
 * non-TTY and passes the bytes via `PHP.cli({ stdin })`.
 */
export interface CliStdinState {
	/**
	 * Bytes to serve to PHP's stdin. `null` means no explicit bytes
	 * were provided; the shim returns `null` (EOF) in that case so PHP
	 * sees an empty stdin.
	 */
	bytes: Uint8Array | null;

	/**
	 * Current read cursor into `bytes`.
	 */
	cursor: number;
}

/**
 * Create a fresh `CliStdinState`.
 */
export function createCliStdinState(): CliStdinState {
	return { bytes: null, cursor: 0 };
}

/**
 * Coerce a `PHP.cli()` `stdin` option into a `Uint8Array`.
 *
 * Accepts strings (UTF-8 encoded), `Uint8Array` / `Buffer`, and
 * `ReadableStream<Uint8Array>` (collected to a single buffer).
 */
export async function coerceCliStdin(
	input: string | Uint8Array | ReadableStream<Uint8Array>
): Promise<Uint8Array> {
	if (typeof input === 'string') {
		return new TextEncoder().encode(input);
	}
	if (input instanceof Uint8Array) {
		return input;
	}
	const chunks: Uint8Array[] = [];
	const reader = input.getReader();
	let total = 0;
	try {
		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			if (value) {
				chunks.push(value);
				total += value.byteLength;
			}
		}
	} finally {
		// Release the lock even if the stream errors, so the caller
		// isn't left holding an unusable locked stream. Good Web
		// Streams citizenship.
		reader.releaseLock();
	}
	const out = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		out.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return out;
}

/**
 * Build the Emscripten-compatible `stdin` callback backed by a
 * `CliStdinState`. The callback returns a single byte per call, or
 * `null` at EOF.
 */
export function createCliStdinCallback(
	state: CliStdinState
): () => number | null {
	return () => {
		if (state.bytes === null) {
			return null;
		}
		if (state.cursor >= state.bytes.length) {
			return null;
		}
		return state.bytes[state.cursor++];
	};
}
