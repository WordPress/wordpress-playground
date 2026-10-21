import { consumeAPI } from '@php-wasm/web';
import type {
	PlaygroundWorkerEndpoint,
	WorkerBootOptions,
} from './playground-worker-endpoint';
import { RELOAD_REQUIRED, RUNTIME_CLOSED } from './shared-runtime';
// @ts-ignore -- Resolved by Vite.
import sharedWorkerUrl from './shared-playground-worker.ts?worker&url';

export type SharedRuntimeAPI = PlaygroundWorkerEndpoint & {
	shutdownSharedRuntime(): Promise<void>;
	beginSharedBoot(options: WorkerBootOptions): Promise<boolean>;
	finishSharedRuntimeInitialization(): Promise<void>;
};

export async function connectSharedRuntime(
	scope: string,
	version: string,
	clientVersion: string,
	onProgress: (caption: string) => void = () => {}
) {
	if (!('SharedWorker' in globalThis)) {
		throw new Error(
			'This WordPress runtime requires SharedWorker support.'
		);
	}
	const { worker, runtimeId } = await connectCurrentSharedWorker(
		scope,
		version,
		clientVersion,
		onProgress
	);
	let retired = false;
	let closed = false;
	const pendingCalls = new Set<(error: Error) => void>();
	const requireReload = () => {
		window.parent.postMessage(
			{ type: RELOAD_REQUIRED, ready: closed },
			location.origin
		);
		throw new Error(RELOAD_REQUIRED);
	};
	worker.port.addEventListener('message', ({ data }) => {
		if (data?.type === RUNTIME_CLOSED) {
			closed = true;
			window.parent.postMessage(
				{ type: RUNTIME_CLOSED },
				location.origin
			);
		} else if (data?.type === 'shared-runtime-retirement-error') {
			window.parent.postMessage(data, location.origin);
		} else if (data?.type === 'shared-runtime-retired') {
			retired = true;
			// Block interaction before a link can navigate the old WordPress document.
			// Firefox navigation fetches do not identify the document being replaced.
			window.parent.postMessage(
				{ type: RELOAD_REQUIRED, ready: closed },
				location.origin
			);
			for (const reject of pendingCalls)
				reject(new Error(RELOAD_REQUIRED));
			pendingCalls.clear();
		}
	});
	window.addEventListener('pagehide', () => {
		worker.port.postMessage({ type: 'shared-runtime-disconnect' });
		worker.port.close();
	});

	const raw = consumeAPI<SharedRuntimeAPI>(worker.port);
	const api = new Proxy(raw, {
		get(target, property) {
			if (retired) requireReload();
			const value = Reflect.get(target, property);
			if (typeof value !== 'function') return value;
			// Comlink property proxies are callable too; preserve their `then` behavior.
			return new Proxy(value, {
				apply(method, context, args) {
					if (retired) requireReload();
					const result = Promise.resolve(
						Reflect.apply(method, context, args)
					);
					const guarded =
						property === 'shutdownSharedRuntime'
							? result
							: new Promise((resolve, reject) => {
									pendingCalls.add(reject);
									void result
										.then(resolve, reject)
										.finally(() =>
											pendingCalls.delete(reject)
										);
								});
					return guarded.catch((error: Error) => {
						if (error.message === RELOAD_REQUIRED) requireReload();
						throw error;
					});
				},
			});
		},
	});

	const register = (serviceWorker: ServiceWorker) => {
		if (retired) {
			serviceWorker.postMessage({
				type: 'register-shared-runtime',
				scope,
				retired: true,
				closed,
				buildVersion: version,
				runtimeId,
			});
			return;
		}
		const channel = new MessageChannel();
		worker.port.postMessage({ type: 'shared-runtime-service-worker' }, [
			channel.port1,
		]);
		serviceWorker.postMessage(
			{
				type: 'register-shared-runtime',
				scope,
				buildVersion: version,
				runtimeId,
			},
			[channel.port2]
		);
	};
	navigator.serviceWorker.addEventListener('controllerchange', () => {
		if (navigator.serviceWorker.controller)
			register(navigator.serviceWorker.controller);
	});
	navigator.serviceWorker.addEventListener('message', (event) => {
		if (event.data?.type !== 'connect-shared-runtime') return;
		register(event.source as ServiceWorker);
	});
	window.addEventListener('message', (event) => {
		if (
			event.origin !== location.origin ||
			event.data?.type !== RELOAD_REQUIRED
		)
			return;
		window.parent.postMessage(event.data, location.origin);
	});

	return { api, register, isRetired: () => retired };
}

type SharedWorkerIdentity = { url: string; name: string; version: string };

/** localStorage records the previous runtime so a new build can retire it before booting. */
async function connectCurrentSharedWorker(
	scope: string,
	version: string,
	clientVersion: string,
	onProgress: (caption: string) => void
) {
	if (clientVersion !== version) {
		window.parent.postMessage(
			{ type: RELOAD_REQUIRED, ready: true },
			location.origin
		);
		throw new Error(RELOAD_REQUIRED);
	}
	const storageKey = `playground:shared-worker:${scope}`;
	const url = new URL(sharedWorkerUrl, location.href);
	url.searchParams.set('build', version);
	const current = {
		url: url.href,
		name: `playground:${scope}:${version}`,
		version,
	};
	const previous = readSharedWorkerIdentity(storageKey, scope);
	if (
		!previous ||
		previous.url !== current.url ||
		previous.name !== current.name
	) {
		// Without a recorded identity, probe the unversioned worker URL and name.
		const retiring = previous ?? {
			url: new URL(sharedWorkerUrl, location.href).href,
			name: `playground:${scope}`,
			version: 'legacy',
		};
		await handshakeSharedWorker(retiring, version, 'retire', onProgress);
	}
	const connected = await handshakeSharedWorker(
		current,
		version,
		'connect',
		onProgress
	);
	if (!connected)
		throw new Error(
			'Shared runtime closed during startup. Reload this tab.'
		);
	try {
		localStorage.setItem(storageKey, JSON.stringify(current));
	} catch {
		// Without storage, a later build may not discover this runtime to retire it.
	}
	return connected;
}

function readSharedWorkerIdentity(
	key: string,
	scope: string
): SharedWorkerIdentity | undefined {
	try {
		const value = JSON.parse(localStorage.getItem(key) ?? 'null');
		if (
			!value ||
			typeof value.url !== 'string' ||
			typeof value.version !== 'string' ||
			value.name !== `playground:${scope}:${value.version}`
		)
			return;
		const url = new URL(value.url);
		const entrypoint = new URL(sharedWorkerUrl, location.href);
		if (
			url.origin !== entrypoint.origin ||
			url.pathname !== entrypoint.pathname
		)
			return;
		return value;
	} catch {
		return;
	}
}

async function handshakeSharedWorker(
	identity: SharedWorkerIdentity,
	version: string,
	mode: 'connect' | 'retire',
	onProgress: (caption: string) => void
) {
	let worker: SharedWorker | undefined;
	let replied = false;
	const label = mode === 'retire' ? 'Previous worker' : 'Current worker';
	try {
		worker = new SharedWorker(identity.url, {
			type: 'module',
			name: identity.name,
		});
		const port = worker.port;
		const target = worker;
		const runtimeId = await new Promise<string | undefined>(
			(resolve, reject) => {
				onProgress(
					mode === 'retire'
						? 'Checking previous WordPress runtime'
						: 'Connecting to WordPress runtime'
				);
				const timedOut = () =>
					finish(new Error(`${label} connection timed out.`));
				let timeout = setTimeout(
					timedOut,
					mode === 'retire' ? 5000 : 30000
				);
				const finish = (error?: Error, id?: string) => {
					clearTimeout(timeout);
					port.removeEventListener('message', onMessage);
					target.removeEventListener('error', onError);
					if (error) {
						onProgress(error.message);
						reject(error);
					} else resolve(id);
				};
				const onMessage = ({ data }: MessageEvent) => {
					if (data?.type === 'shared-runtime-connected') {
						replied = true;
						if (mode === 'retire') {
							finish(
								new Error(
									'Previous worker did not accept shutdown.'
								)
							);
						} else {
							finish(undefined, data.runtimeId);
						}
					} else if (data?.type === RELOAD_REQUIRED) {
						replied = true;
						if (mode === 'connect') {
							window.parent.postMessage(data, location.origin);
							finish(new Error(RELOAD_REQUIRED));
						} else if (data.ready) {
							finish();
						} else {
							onProgress('Saving WordPress before updating');
							clearTimeout(timeout);
							timeout = setTimeout(timedOut, 30000);
						}
					} else if (data?.type === RUNTIME_CLOSED) {
						replied = true;
						finish();
					} else if (
						data?.type === 'shared-runtime-retirement-error'
					) {
						replied = true;
						window.parent.postMessage(data, location.origin);
						window.parent.postMessage(
							{ type: RELOAD_REQUIRED, ready: false },
							location.origin
						);
						finish(new Error(data.error));
					}
				};
				const onError = () =>
					finish(
						new Error(
							`Failed to load ${label.toLowerCase()} (${identity.url}).`
						)
					);
				port.addEventListener('message', onMessage);
				target.addEventListener('error', onError);
				port.start();
				// A deliberately mismatching version uses the shutdown protocol supported by old builds.
				port.postMessage({
					type: 'shared-runtime-connect',
					buildVersion:
						mode === 'retire' ? `retire:${version}` : version,
					clientBuildVersion: version,
				});
			}
		);
		if (runtimeId && mode === 'connect') return { worker, runtimeId };
		worker.port.close();
	} catch (error) {
		worker?.port.close();
		// A stale hint may point to deleted assets or an exited worker.
		// Once a worker replies, require confirmation that its shutdown completed.
		if (mode === 'connect' || replied) throw error;
	}
	return undefined;
}
