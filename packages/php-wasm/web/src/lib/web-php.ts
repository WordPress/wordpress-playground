import {
	BasePHP,
	DataModule,
	EmscriptenOptions,
	loadPHPRuntime,
	PHPRequestHandlerConfiguration,
	SupportedPHPVersion,
} from '@php-wasm/universal';
import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import { getPHPLoaderModule } from './get-php-loader-module';
import * as tls from './tls-proxy';

export interface PHPWebLoaderOptions {
	emscriptenOptions?: EmscriptenOptions;
	downloadMonitor?: EmscriptenDownloadMonitor;
	requestHandler?: PHPRequestHandlerConfiguration;
	dataModules?: Array<DataModule | Promise<DataModule>>;
	/** @deprecated To be replaced with `extensions` in the future */
	loadAllExtensions?: boolean;
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
						console.log('Called constructor()!');
						try {
							super();
						} catch (e) {
							// pass
						}
					}

					send() {
						console.log('Called send()!');
						return null;
					}
				};
			},
		},
	};
};

export function httpRequestToFetch(
	host: string,
	port: number,
	httpRequest: string,
	onData: (data: ArrayBuffer) => void,
	onDone: () => void
) {
	const firstLine = httpRequest.split('\n')[0];
	const [method, path] = firstLine.split(' ');

	const headers = new Headers();
	for (const line of httpRequest.split('\r\n').slice(1)) {
		if (line === '') {
			break;
		}
		const [name, value] = line.split(': ');
		console.log({ name, value });
		headers.set(name, value);
	}
	// This is a naive implementation that doesn't handle
	// PHP writing arbitrary Host headers to IP addresses,
	// but it's the best we can do in the browser.
	const protocol = port === 443 ? 'https' : 'http';
	// @TODO: Decide which host to use. The header is less reliable,
	//        but in some cases it's more useful. E.g. the Host header
	//        may be `localhost` when `host` is 127.0.0.1, and, to
	//        run the fetch() request, we need to use the former since
	//        the latter may not respond to requests. Similarly,
	//        PHP may run requests to arbitrary IP addresses with
	//        the Host header set to a domain name, and we need to
	//        pass a valid domain to fetch().
	const hostname = headers.get('Host')
		? headers.get('Host')
		: [80, 443].includes(port)
		? host
		: `${host}:${port}`;
	const url = new URL(path, protocol + '://' + hostname).toString();
	console.log({ httpRequest, method, url });

	return fetch(url, {
		method,
		headers,
	})
		.then((response) => {
			console.log('====> Got fetch() response!', response);
			const reader = response.body?.getReader();
			if (reader) {
				const responseHeader = new TextEncoder().encode(
					`HTTP/1.1 ${response.status} ${response.statusText}\r\n${[
						...response.headers,
					]
						.map(([name, value]) => `${name}: ${value}`)
						.join('\r\n')}\r\n\r\n`
				);

				// @TODO: calling onData() and waiting for more reader chunks
				//        passes the control back to PHP.wasm and never yields
				//        the control back to JavaScript. It's likely a polling
				//        issue, or perhaps something specific to a Symfony HTTP
				//        client. Either way, PHP blocks the thread and the
				//        read().then() callback is never called.
				//        We should find a way to yield the control back to
				//        JavaScript after each onData() call.
				//
				//        One clue is PHP runs out of memory when onData() blocks
				//        the event loop. Then it fails with a regular PHP fatal error
				//        message. Perhaps there's an infinite loop somewhere that
				//        fails to correctly poll and increases the memory usage indefinitely.
				const buffer = [responseHeader.buffer];
				const read = () => {
					console.log('Attempt to read the response stream');
					reader
						.read()
						.then(({ done, value }) => {
							// console.log("got some data", value);
							if (done) {
								// @TODO let's stream the chunks as they
								//       arrive without buffering them
								for (const chunk of buffer) {
									onData(chunk);
								}
								onDone();
								return;
							}
							buffer.push(value.buffer);
							read();
						})
						.catch((e) => {
							console.error(e);
						});
				};
				read();
			}
		})
		.catch((e) => {
			console.log('Could not fetch ', url);
			console.error(e);
			throw e;
		});
}

export class WebPHP extends BasePHP {
	/**
	 * Creates a new PHP instance.
	 *
	 * Dynamically imports the PHP module, initializes the runtime,
	 * and sets up networking. It's a shorthand for the lower-level
	 * functions like `getPHPLoaderModule`, `loadPHPRuntime`, and
	 * `PHP.initializeRuntime`
	 *
	 * @param phpVersion The PHP Version to load
	 * @param options The options to use when loading PHP
	 * @returns A new PHP instance
	 */
	static async load(
		phpVersion: SupportedPHPVersion,
		options: PHPWebLoaderOptions = {}
	) {
		return new WebPHP(
			await WebPHP.loadRuntime(phpVersion, options),
			options.requestHandler
		);
	}

	static async loadRuntime(
		phpVersion: SupportedPHPVersion,
		options: PHPWebLoaderOptions = {}
	) {
		// Determine which variant to load based on the requested extensions
		const variant = options.loadAllExtensions ? 'kitchen-sink' : 'light';

		const phpLoaderModule = await getPHPLoaderModule(phpVersion, variant);
		options.downloadMonitor?.expectAssets({
			[phpLoaderModule.dependencyFilename]:
				phpLoaderModule.dependenciesTotalSize,
		});
		return await loadPHPRuntime(phpLoaderModule, {
			...(options.emscriptenOptions || {}),
			...tls.fetchingWebsocket(),
		});
	}
}
