import { consumeAPI } from '@php-wasm/web';
import type {
	PlaygroundWorkerEndpoint,
	WorkerBootOptions,
} from './playground-worker-endpoint';
import { RELOAD_REQUIRED, RUNTIME_CLOSED } from './shared-runtime';
// @ts-ignore -- Resolved by Vite.
import sharedWorkerUrl from './personal-wp-shared-worker.ts?worker&url';

export type SharedRuntimeAPI = PlaygroundWorkerEndpoint & {
	shutdownSharedRuntime(): Promise<void>;
	beginSharedBoot(options: WorkerBootOptions): Promise<boolean>;
	finishSharedRuntimeInitialization(): Promise<void>;
};

export async function connectSharedRuntime(
	scope: string,
	version: string,
	clientVersion: string
) {
	if (!('SharedWorker' in globalThis)) {
		throw new Error(
			'This experimental WordPress runtime requires SharedWorker support.'
		);
	}
	const worker = new SharedWorker(sharedWorkerUrl, {
		type: 'module',
		name: `personal-wp:${scope}`,
	});
	let retired = false;
	let closed = false;
	let runtimeId = '';
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
			for (const reject of pendingCalls)
				reject(new Error(RELOAD_REQUIRED));
			pendingCalls.clear();
		}
	});
	window.addEventListener('pagehide', () => {
		worker.port.postMessage({ type: 'shared-runtime-disconnect' });
		worker.port.close();
	});
	worker.port.start();
	await new Promise<void>((resolve, reject) => {
		const timeout = setTimeout(
			() => reject(new Error('Shared runtime connection timed out.')),
			30000
		);
		const onMessage = ({ data }: MessageEvent) => {
			if (
				data?.type !== 'shared-runtime-connected' &&
				data?.type !== RELOAD_REQUIRED
			)
				return;
			clearTimeout(timeout);
			worker.port.removeEventListener('message', onMessage);
			if (data.type === RELOAD_REQUIRED) {
				retired = true;
				window.parent.postMessage(
					{ type: RELOAD_REQUIRED, ready: data.ready },
					location.origin
				);
				reject(new Error(RELOAD_REQUIRED));
			} else {
				runtimeId = data.runtimeId;
				resolve();
			}
		};
		worker.port.addEventListener('message', onMessage);
		worker.addEventListener(
			'error',
			() => {
				clearTimeout(timeout);
				reject(
					new Error('Failed to load the shared WordPress runtime.')
				);
			},
			{ once: true }
		);
		worker.port.postMessage({
			type: 'shared-runtime-connect',
			buildVersion: version,
			clientBuildVersion: clientVersion,
		});
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
