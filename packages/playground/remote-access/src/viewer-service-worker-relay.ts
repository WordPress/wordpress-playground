export interface RemoteAccessRelayMappingResult {
	clientId?: string;
}

export interface RemoteAccessRelayProbeResult {
	hasMapping: boolean;
	clientId?: string;
	interceptedRequests: number;
	lastInterceptedPath: string | null;
}

export interface RemoteAccessRelayRequestMessage {
	type: 'remote-access-relay-request';
	sessionId: string;
	requestId: string;
	method: string;
	path: string;
	headers: Record<string, string>;
	body?: Uint8Array;
}

export function getRemoteAccessRelayScopedUrl(scope: string): string {
	return `/scope:${scope}/`;
}

export function getRemoteAccessRelayProbeUrl(
	scope: string,
	sessionId: string
): string {
	return `${getRemoteAccessRelayScopedUrl(
		scope
	)}?remote-access-probe=${encodeURIComponent(sessionId)}`;
}

export async function registerRemoteAccessServiceWorker(
	serviceWorkerPath: string | URL,
	origin: string
): Promise<ServiceWorkerRegistration> {
	const serviceWorkerUrl =
		serviceWorkerPath instanceof URL
			? serviceWorkerPath
			: new URL(serviceWorkerPath, origin);
	const registration = await navigator.serviceWorker.register(
		serviceWorkerUrl,
		{
			type: 'module',
			updateViaCache: 'none',
			scope: '/',
		}
	);
	await navigator.serviceWorker.ready;
	return registration;
}

export function postRemoteAccessRelayMapping(
	registration: ServiceWorkerRegistration,
	{
		scope,
		sessionId,
		ttl,
	}: {
		scope: string;
		sessionId: string;
		ttl: number;
	}
): Promise<RemoteAccessRelayMappingResult> {
	const worker = navigator.serviceWorker.controller || registration.active;
	if (!worker) {
		return Promise.reject(
			new Error('Remote access service worker is not active.')
		);
	}
	return new Promise((resolve, reject) => {
		const channel = new MessageChannel();
		const cleanup = () => {
			clearTimeout(timeout);
			channel.port1.onmessage = null;
			channel.port1.close();
			channel.port2.close();
		};
		const resolveMapping = (value: RemoteAccessRelayMappingResult) => {
			cleanup();
			resolve(value);
		};
		const rejectMapping = (error: Error) => {
			cleanup();
			reject(error);
		};
		const timeout = setTimeout(() => {
			rejectMapping(
				new Error('Remote access service worker did not confirm setup.')
			);
		}, 5000);
		channel.port1.onmessage = (event) => {
			if (event.data?.type === 'remote-access-relay-map-result') {
				resolveMapping({ clientId: event.data?.clientId });
				return;
			}
			rejectMapping(
				new Error(
					event.data?.error ||
						'Remote access service worker setup failed.'
				)
			);
		};
		worker.postMessage(
			{
				type: 'remote-access-relay-map',
				scope,
				sessionId,
				ttl,
			},
			[channel.port2]
		);
	});
}

export async function fetchRemoteAccessRelayProbe(
	scope: string,
	sessionId: string
): Promise<RemoteAccessRelayProbeResult> {
	const response = await fetch(
		getRemoteAccessRelayProbeUrl(scope, sessionId),
		{
			cache: 'no-store',
		}
	);
	if (response.headers.get('X-Remote-Access-Service-Worker') !== '1') {
		throw new Error(
			'Remote access service worker is not controlling WordPress requests.'
		);
	}
	const data = await response.json();
	return {
		hasMapping: !!data.hasMapping,
		clientId: typeof data.clientId === 'string' ? data.clientId : undefined,
		interceptedRequests:
			typeof data.interceptedRequests === 'number'
				? data.interceptedRequests
				: 0,
		lastInterceptedPath:
			typeof data.lastInterceptedPath === 'string'
				? data.lastInterceptedPath
				: null,
	};
}

export function clearRemoteAccessRelayMapping(scope: string): void {
	navigator.serviceWorker?.controller?.postMessage({
		type: 'remote-access-relay-clear',
		scope,
	});
}

export function getRemoteAccessRelayRequestMessage(
	data: unknown,
	sessionId: string
): RemoteAccessRelayRequestMessage | null {
	if (
		typeof data !== 'object' ||
		data === null ||
		(data as { type?: unknown }).type !== 'remote-access-relay-request' ||
		(data as { sessionId?: unknown }).sessionId !== sessionId
	) {
		return null;
	}
	return data as RemoteAccessRelayRequestMessage;
}

export function postRemoteAccessRelayResponse(
	port: MessagePort,
	response: unknown
): void {
	port.postMessage({
		type: 'remote-access-relay-response',
		response,
	});
}

export function postRemoteAccessRelayError(
	port: MessagePort,
	error: string
): void {
	port.postMessage({
		type: 'remote-access-relay-error',
		error,
	});
}
