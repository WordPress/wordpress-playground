/**
 * Sub-worker entry point for multi-worker PHP instances.
 *
 * Each sub-worker runs a fully independent PHP-WASM instance in its
 * own dedicated web worker thread. All sub-workers share the same
 * SABMEMFS-backed /wordpress filesystem via SharedArrayBuffer, giving
 * true parallelism for PHP request handling.
 *
 * The coordinator worker spawns these sub-workers via the
 * WorkerPoolInstanceManager and communicates with them through a
 * simple postMessage-based RPC protocol.
 *
 * Protocol:
 *   Coordinator → Sub-worker:
 *     { id: number, type: 'call', method: string, args: any[] }
 *
 *   Sub-worker → Coordinator:
 *     { id: number, type: 'result', value: any }
 *     { id: number, type: 'error', error: string }
 */

import {
	PHP,
	setPhpIniEntries,
	writeFiles,
	sabMemFSMount,
	sandboxedSpawnHandlerFactory,
} from '@php-wasm/universal';
import type {
	SupportedPHPVersion,
	FileTree,
	SABMemFSBuffers,
} from '@php-wasm/universal';
import { loadWebRuntime, generateCertificate, certificateToPEM } from '@php-wasm/web';
import type { TCPOverFetchOptions } from '@php-wasm/web';
import { WordPressFetchNetworkTransport } from './wordpress-fetch-network-transport';

/**
 * Configuration passed from the coordinator to initialize a sub-worker.
 * All values must be structured-cloneable.
 */
export interface SubWorkerInitConfig {
	phpVersion: SupportedPHPVersion;
	withIntl: boolean;
	sapiName: string;
	phpIniEntries: Record<string, string>;
	sabBuffers: SABMemFSBuffers;
	documentRoot: string;
	siteUrl: string;
	corsProxyUrl?: string;
	withNetworking: boolean;
	constants: Record<string, string | number | boolean | null>;
	internalFiles: FileTree;
}

let php: PHP | null = null;

const methods: Record<string, (...args: any[]) => Promise<any>> = {
	async initialize(config: SubWorkerInitConfig) {
		const {
			phpVersion,
			withIntl,
			sapiName,
			phpIniEntries,
			sabBuffers,
			documentRoot,
			constants,
			internalFiles,
			corsProxyUrl,
			withNetworking,
		} = config;

		// Generate TLS config for networking if needed. Each sub-worker
		// generates its own CA certificate since CryptoKey objects can't
		// be transferred across workers via postMessage.
		let tcpOverFetchConfig: TCPOverFetchOptions | undefined;
		if (withNetworking) {
			const CAroot = await generateCertificate({
				subject: {
					commonName: 'WordPressPlaygroundCA',
					organizationName: 'WordPressPlaygroundCA',
					countryName: 'US',
				},
				basicConstraints: { ca: true },
			});
			tcpOverFetchConfig = { CAroot, corsProxyUrl };
		}

		// Load the PHP WASM runtime
		const runtimeId = await loadWebRuntime(phpVersion, {
			withIntl,
			tcpOverFetch: tcpOverFetchConfig,
		});

		php = new PHP(runtimeId);
		php.setSapiName(sapiName);
		setPhpIniEntries(php, phpIniEntries);

		// Define constants
		for (const key in constants) {
			php.defineConstant(key, constants[key]);
		}

		// Write internal files locally (mu-plugins, ca-bundle, etc.)
		// These are small files that each worker needs its own copy of
		// since they live in the local MEMFS, not SABMEMFS.
		await writeFiles(php, '/', internalFiles);

		// Mount SABMEMFS at /wordpress with multi-worker locking enabled
		if (!php.fileExists(documentRoot)) {
			php.mkdir(documentRoot);
		}
		await php.mount(
			documentRoot,
			sabMemFSMount(sabBuffers, { multiWorker: true })
		);
		php.chdir(documentRoot);

		// Set up networking if enabled
		if (withNetworking) {
			const transport = new WordPressFetchNetworkTransport({
				corsProxyUrl,
			});
			await transport.setupMessageHandler(php);
			await transport.setEnabled(php, true);
		}

		// Set up the spawn handler. The getPHPInstance callback is
		// proxied back to the coordinator so spawned processes can
		// acquire PHP instances from the global pool.
		await php.setSpawnHandler(
			sandboxedSpawnHandlerFactory(
				createCoordinatorGetPHPInstance()
			)
		);

		// Enable runtime rotation so that memory leaks don't
		// accumulate across many requests.
		php.enableRuntimeRotation({
			recreateRuntime: () =>
				loadWebRuntime(phpVersion, {
					withIntl,
					tcpOverFetch: tcpOverFetchConfig,
				}),
			maxRequests: 400,
		});
	},

	async run(options: any) {
		assertInitialized();
		return await php!.run(options);
	},

	async cli(args: string[], options?: { env?: Record<string, string> }) {
		assertInitialized();
		return await php!.cli(args, options);
	},

	async chdir(path: string) {
		assertInitialized();
		php!.chdir(path);
	},

	async cwd(): Promise<string> {
		assertInitialized();
		return php!.cwd();
	},

	async listFiles(
		path: string,
		options?: { prependPath: boolean }
	): Promise<string[]> {
		assertInitialized();
		return php!.listFiles(path, options);
	},

	async setSapiName(name: string) {
		assertInitialized();
		php!.setSapiName(name);
	},

	async exit() {
		if (php) {
			php.exit();
			php = null;
		}
	},
};

function assertInitialized() {
	if (!php) {
		throw new Error('Sub-worker PHP not initialized');
	}
}

/**
 * Creates a getPHPInstance callback that sends a request back to the
 * coordinator worker to acquire a PHP instance from the global pool.
 * This enables proc_open / spawn handler to work across workers.
 */
function createCoordinatorGetPHPInstance() {
	return async () => {
		// Ask the coordinator to acquire a PHP instance from the pool
		const responsePromise = waitForMessage('acquirePHPInstanceResponse');
		self.postMessage({ type: 'acquirePHPInstance' });
		const response = await responsePromise;
		const instanceId = response.instanceId;

		// Return a proxy that forwards calls to the coordinator,
		// which in turn forwards them to the actual PHP instance.
		return {
			php: {
				async cli(
					args: string[],
					options?: { env?: Record<string, string> }
				) {
					return await callCoordinator('proxyCliCall', {
						instanceId,
						args,
						options,
					});
				},
				async chdir(path: string) {
					await callCoordinator('proxyChdir', { instanceId, path });
				},
				async cwd() {
					return await callCoordinator('proxyCwd', { instanceId });
				},
				async listFiles(
					path: string,
					options?: { prependPath?: boolean }
				) {
					return await callCoordinator('proxyListFiles', {
						instanceId,
						path,
						options,
					});
				},
			} as any,
			reap: () => {
				self.postMessage({
					type: 'reapPHPInstance',
					instanceId,
				});
			},
		};
	};
}

let messageIdCounter = 0;
function callCoordinator(method: string, args: any): Promise<any> {
	const id = messageIdCounter++;
	return new Promise((resolve, reject) => {
		const handler = (event: MessageEvent) => {
			if (
				event.data &&
				event.data.type === 'coordinatorResponse' &&
				event.data.id === id
			) {
				self.removeEventListener('message', handler);
				if (event.data.error) {
					reject(new Error(event.data.error));
				} else {
					resolve(event.data.value);
				}
			}
		};
		self.addEventListener('message', handler);
		self.postMessage({ type: 'coordinatorCall', id, method, args });
	});
}

function waitForMessage(type: string): Promise<any> {
	return new Promise((resolve) => {
		const handler = (event: MessageEvent) => {
			if (event.data && event.data.type === type) {
				self.removeEventListener('message', handler);
				resolve(event.data);
			}
		};
		self.addEventListener('message', handler);
	});
}

// ─────────── Message handler for RPC calls from coordinator ───────────

self.addEventListener('message', async (event: MessageEvent) => {
	const msg = event.data;
	if (!msg || msg.type !== 'call') return;

	const { id, method, args } = msg;
	try {
		if (!(method in methods)) {
			throw new Error(`Unknown method: ${method}`);
		}
		const result = await methods[method](...(args || []));
		// PHPResponse objects need special serialization since they
		// contain Uint8Array which is transferable.
		const transferables: Transferable[] = [];
		if (result && result.bytes instanceof Uint8Array) {
			transferables.push(result.bytes.buffer);
		}
		self.postMessage(
			{ id, type: 'result', value: serializeResult(result) },
			{ transfer: transferables }
		);
	} catch (e: any) {
		self.postMessage({
			id,
			type: 'error',
			error: e?.message || String(e),
		});
	}
});

/**
 * Serialize a result for postMessage transfer. PHPResponse objects
 * contain a Uint8Array `bytes` field and structured clone handles
 * that naturally. We convert it to a plain object to avoid class
 * identity issues across worker boundaries.
 */
function serializeResult(result: any): any {
	if (result === null || result === undefined) return result;
	if (typeof result !== 'object') return result;

	// PHPResponse: convert to a plain object
	if (result.httpStatusCode !== undefined && result.bytes !== undefined) {
		return {
			httpStatusCode: result.httpStatusCode,
			headers: result.headers,
			bytes: result.bytes,
			errors: result.errors,
			exitCode: result.exitCode,
		};
	}

	return result;
}

// Signal that this worker script has loaded
self.postMessage({ type: 'worker-script-started' });
