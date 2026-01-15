import type {
	SupportedPHPVersion,
	EmscriptenOptions,
	PHPRuntime,
	PHPLoaderModule,
} from '@php-wasm/universal';
import { loadPHPRuntime } from '@php-wasm/universal';
import { getPHPLoaderModule } from './get-php-loader-module';
import type { TCPOverFetchOptions } from './tcp-over-fetch-websocket';
import { tcpOverFetchWebsocket } from './tcp-over-fetch-websocket';
import { withIntl } from './extensions/intl/with-intl';

export interface LoaderOptions {
	emscriptenOptions?: EmscriptenOptions;
	onPhpLoaderModuleLoaded?: (module: PHPLoaderModule) => void;
	tcpOverFetch?: TCPOverFetchOptions;
	withIntl?: boolean;
}

/**
 * Fake a websocket connection to prevent errors in the web app
 * from cascading and breaking the Playground.
 */
const fakeWebsocket = () => {
	return {
		websocket: {
			decorator: (WebSocketConstructor: any) => {
				return class FakeWebsocketConstructor extends WebSocketConstructor {
					constructor() {
						try {
							super();
						} catch {
							// pass
						}
					}

					send() {
						return null;
					}
				};
			},
		},
	};
};

interface PHPWorkerGlobalScope extends WorkerGlobalScope {
	setImmediate: (fn: () => void) => void;
}

export async function loadWebRuntime(
	phpVersion: SupportedPHPVersion,
	loaderOptions: LoaderOptions = {}
) {
	/*
	 * Provide `setImmediate` so Emscripten doesn’t install its message-based
	 * polyfill, which retains references to the Wasm HEAP and prevents the
	 * PHP instance from being garbage-collected.
	 *
	 * https://github.com/emscripten-core/emscripten/blob/6d61ffd7076309cb08af37aba496f25c23cdb5a4/src/lib/libeventloop.js#L57
	 */
	if (!('setImmediate' in globalThis)) {
		(globalThis as unknown as PHPWorkerGlobalScope).setImmediate = (
			fn: () => void
		) => setTimeout(fn, 0);
	}

	let emscriptenOptions: EmscriptenOptions | Promise<EmscriptenOptions> = {
		...fakeWebsocket(),
		...(loaderOptions.emscriptenOptions || {}),
		onRuntimeInitialized: (phpRuntime: PHPRuntime) => {
			/**
			 * Emscripten's PROXYFS does not support real kernel-backed mmap().
			 * However, some native code relies on mmap() to obtain a contiguous
			 * read-only view of a file. This implementation emulates mmap by
			 * allocating memory in the Wasm heap and eagerly reading the file
			 * contents into it.
			 *
			 * This preserves expected mmap behavior (read-only, offset-based access)
			 * while remaining compatible with virtual filesystem backends.
			 */
			phpRuntime.FS.filesystems.PROXYFS.stream_ops.mmap = (
				stream: any,
				length: number,
				position: number
			) => {
				if (
					phpRuntime.phpVersion.major === 7 &&
					phpRuntime.phpVersion.minor <= 3
				) {
					const path = phpRuntime.FS.getPath(stream.node);

					if (!path.endsWith('.dat')) {
						const fs = stream.node.mount.opts.fs;
						const stat = fs.fstat(stream.nfd);
						length = stat.size >>> 0;
					}
				}
				if (position !== 0) return -22;

				const ptr = phpRuntime.malloc(length);

				if (!ptr) return -12;

				const heap = phpRuntime.HEAPU8.subarray(ptr, ptr + length);

				let total = 0;

				while (total < length) {
					const n = phpRuntime.FS.filesystems.PROXYFS.stream_ops.read(
						stream,
						heap,
						total,
						length - total,
						total
					);

					if (n <= 0) break;
					total += n;
				}

				if (total !== length) {
					phpRuntime.free(ptr);
					return -5;
				}

				return {
					ptr,
					allocated: true,
				};
			};
		},
	};

	if (loaderOptions.tcpOverFetch) {
		emscriptenOptions = tcpOverFetchWebsocket(
			emscriptenOptions,
			loaderOptions.tcpOverFetch
		);
	}

	if (loaderOptions.withIntl) {
		emscriptenOptions = withIntl(phpVersion, emscriptenOptions);
	}

	const [phpLoaderModule, options] = await Promise.all([
		getPHPLoaderModule(phpVersion),
		emscriptenOptions,
	]);

	loaderOptions.onPhpLoaderModuleLoaded?.(phpLoaderModule);

	return await loadPHPRuntime(phpLoaderModule, options);
}
