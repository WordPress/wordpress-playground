import { getURLScope } from '@php-wasm/scopes';
import { portToStream, streamToPort } from '@php-wasm/universal';
import { responseTo } from '@php-wasm/web-service-worker';
import { playgroundOrigin, wordPressSiteUrl } from './config';

const PARTITION_PROBE_CHANNEL_NAME = 'playground-partition-probe';
const RUNTIME_PARTITION_LOCK_PREFIX = 'playground-runtime-partition:';
const OPENER_PROBE_TIMEOUT_MS = 150;
const BRIDGE_READY_TIMEOUT_MS = 15000;
const PENDING_REQUEST_TIMEOUT_MS = 30000;

type PartitionProbeResult = {
	openerRemote: Window | null;
	bridgeUrl: string | null;
	serviceWorkerUrl: string | null;
	isSamePartition: boolean;
};

/**
 * Opens a WordPress tool in a popup with the same frame layout as the main app:
 * an app-origin top-level page containing a WordPress-origin iframe.
 *
 * Browsers can select service-worker registrations using both the WordPress
 * origin and the top-level site. Opening WordPress directly can then miss the
 * worker serving it inside the main app. This app-origin wrapper preserves
 * that top-level site, so #wp can use the existing worker and PHP instance.
 *
 * When Playground itself runs inside a cross-site iframe, Chrome partitions
 * the iframe's service worker separately from top-level tabs. If window.opener
 * points back to that partitioned runtime, this popup detects the partition
 * mismatch and attaches a local bridge that relays HTTP requests back to the
 * opener's remote.html over postMessage.
 *
 * Scoped app routes preserve the path, query, and fragment on the WordPress origin.
 * The explicit popup route supplies its destination in the hash. Accept only scoped URLs so this
 * wrapper cannot be used to load trusted app documents into the iframe.
 * Loopback delegation is off by default. Personal WP's own entry document opts in;
 * neither the hosting domain nor URL parameters enable it.
 */
export function bootWordPressPopup({ allowLoopbackNetwork = false } = {}) {
	const isHashPopupRoute = !getURLScope(new URL(location.href));
	const initialTarget = resolvePopupTarget();
	const scope = getURLScope(initialTarget)!;
	let latestTarget = initialTarget;
	let startupComplete = false;

	const frame = document.querySelector('#wp') as HTMLIFrameElement;
	// Only a trusted application entry point opts in; URL parameters cannot enable it.
	if (allowLoopbackNetwork) {
		frame.allow = `loopback-network ${wordPressSiteUrl}`;
	}
	if (isHashPopupRoute && typeof window !== 'undefined') {
		window.addEventListener('hashchange', () => {
			try {
				const nextTarget = resolvePopupTarget();
				if (getURLScope(nextTarget) === scope) {
					latestTarget = nextTarget;
					if (startupComplete) {
						frame.src = latestTarget.href;
					}
				}
			} catch {
				// Ignore invalid hash updates.
			}
		});
	}
	const openerCandidates = getOpenerCandidates();
	if (openerCandidates.length === 0) {
		startupComplete = true;
		frame.src = latestTarget.href;
		return;
	}
	void connectCrossPartitionBridgeAndLoad(
		frame,
		() => latestTarget,
		() => {
			startupComplete = true;
		},
		scope,
		openerCandidates
	);
}

function resolvePopupTarget(): URL {
	const target = getURLScope(new URL(location.href))
		? new URL(
				location.pathname + location.search + location.hash,
				wordPressSiteUrl
			)
		: new URL(location.hash.substring(1), wordPressSiteUrl);
	if (target.origin !== wordPressSiteUrl || !getURLScope(target)) {
		throw new Error('The popup URL must name a scoped WordPress page.');
	}
	return target;
}

function getOpenerCandidates(): Window[] {
	if (typeof window === 'undefined') {
		return [];
	}
	let opener: Window | null = null;
	try {
		opener = window.opener;
		if (!opener || opener.closed) {
			return [];
		}
	} catch {
		return [];
	}
	const candidates: Window[] = [];
	try {
		if (opener.parent && opener.parent !== opener) {
			candidates.push(opener.parent);
		}
	} catch {
		// Ignore cross-origin access errors if the browser restricts parent.
	}
	candidates.push(opener);
	return candidates;
}

async function connectCrossPartitionBridgeAndLoad(
	frame: HTMLIFrameElement,
	getTarget: () => URL,
	markStartupComplete: () => void,
	scope: string,
	openerCandidates: Window[]
) {
	try {
		const probe = await probeOpenerPartition(scope, openerCandidates);
		if (!probe.openerRemote || probe.isSamePartition) {
			return;
		}
		await acquireBridgeOrQueueTakeover(
			probe.openerRemote,
			scope,
			probe.bridgeUrl,
			probe.serviceWorkerUrl
		);
	} catch {
		// Fall through to loading the frame so normal error handling applies.
	} finally {
		markStartupComplete();
		frame.src = getTarget().href;
	}
}

function probeOpenerPartition(
	scope: string,
	openerCandidates: Window[]
): Promise<PartitionProbeResult> {
	return new Promise((resolve) => {
		const probeId =
			typeof crypto !== 'undefined' &&
			typeof crypto.randomUUID === 'function'
				? crypto.randomUUID()
				: `${Date.now()}-${Math.random().toString(36).slice(2)}`;
		let openerRemote: Window | null = null;
		let bridgeUrl: string | null = null;
		let serviceWorkerUrl: string | null = null;
		let isSamePartition = false;
		let settled = false;

		const channel =
			typeof BroadcastChannel === 'function'
				? new BroadcastChannel(PARTITION_PROBE_CHANNEL_NAME)
				: null;

		const finish = () => {
			if (settled) return;
			settled = true;
			clearTimeout(overallTimer);
			window.removeEventListener('message', onWindowMessage);
			channel?.close();
			resolve({
				openerRemote,
				bridgeUrl,
				serviceWorkerUrl,
				isSamePartition,
			});
		};

		const runtimeLockPromise = isSamePartitionByRuntimeLock(scope);

		const onWindowMessage = async (event: MessageEvent) => {
			if (
				event.origin !== playgroundOrigin ||
				!event.source ||
				event.data?.type !== 'wordpress-popup-partition-probe-ack' ||
				event.data.scope !== scope ||
				event.data.probeId !== probeId
			) {
				return;
			}
			clearTimeout(overallTimer);
			openerRemote = event.source as Window;
			bridgeUrl =
				typeof event.data.bridgeUrl === 'string'
					? event.data.bridgeUrl
					: null;
			serviceWorkerUrl =
				typeof event.data.serviceWorkerUrl === 'string'
					? event.data.serviceWorkerUrl
					: null;
			if (!isSamePartition && (await runtimeLockPromise)) {
				isSamePartition = true;
			}
			finish();
		};

		if (channel) {
			channel.addEventListener('message', (event: MessageEvent) => {
				if (
					event.data?.type ===
						'wordpress-popup-partition-probe-echo' &&
					event.data?.scope === scope &&
					event.data?.probeId === probeId
				) {
					isSamePartition = true;
					if (openerRemote) finish();
				}
			});
		}

		window.addEventListener('message', onWindowMessage);
		const overallTimer = setTimeout(finish, OPENER_PROBE_TIMEOUT_MS);

		for (const candidate of openerCandidates) {
			try {
				candidate.postMessage(
					{
						type: 'wordpress-popup-partition-probe',
						scope,
						probeId,
					},
					playgroundOrigin
				);
			} catch {
				// Ignore unreachable candidates.
			}
		}
	});
}

async function isSamePartitionByRuntimeLock(scope: string): Promise<boolean> {
	const locks = typeof navigator !== 'undefined' ? navigator.locks : null;
	if (!locks || typeof locks.request !== 'function') {
		return false;
	}
	try {
		return await locks.request(
			`${RUNTIME_PARTITION_LOCK_PREFIX}${scope}`,
			{ ifAvailable: true },
			(lock) => lock === null
		);
	} catch {
		return false;
	}
}

/**
 * Ensure at most one popup tab per (partition, scope) attaches a bridge, and
 * wait until a bridge in this partition is ready before navigating #wp.
 *
 * Web Locks are partitioned identically to Service Workers and are released
 * automatically by the browser if the holding tab closes or crashes. If
 * another popup tab already holds the lock, this tab waits for the owner's
 * bridge-ready broadcast (or takes over if the owner exits before becoming
 * ready) before navigating #wp.
 */
async function acquireBridgeOrQueueTakeover(
	openerRemote: Window,
	scope: string,
	bridgeUrl: string | null,
	serviceWorkerUrl: string | null
) {
	const locks = typeof navigator !== 'undefined' ? navigator.locks : null;
	if (!locks || typeof locks.request !== 'function') {
		await attachCrossPartitionBridge(
			openerRemote,
			scope,
			bridgeUrl,
			serviceWorkerUrl
		);
		return;
	}

	const lockName = `playground-popup-bridge:${scope}`;
	let acquiredNow = false;
	await new Promise<void>((resolve, reject) => {
		void locks
			.request(lockName, { ifAvailable: true }, async (lock) => {
				if (!lock) {
					resolve();
					return;
				}
				acquiredNow = true;
				try {
					await attachCrossPartitionBridgeWithReadySignal(
						openerRemote,
						scope,
						bridgeUrl,
						serviceWorkerUrl
					);
					resolve();
				} catch (error) {
					reject(error);
					return;
				}
				// Hold the exclusive lock for the lifetime of this popup tab.
				await new Promise<void>(() => {});
			})
			.catch(reject);
	});

	if (acquiredNow) {
		return;
	}

	// Another popup tab in this partition holds the lock. Wait until its bridge
	// signals readiness, or take over and complete setup if that owner exits.
	await new Promise<void>((resolve, reject) => {
		let settled = false;
		const channel =
			typeof BroadcastChannel === 'function'
				? new BroadcastChannel(PARTITION_PROBE_CHANNEL_NAME)
				: null;

		const finishReady = () => {
			if (settled) return;
			settled = true;
			channel?.close();
			resolve();
		};

		const finishError = (error: unknown) => {
			if (settled) return;
			settled = true;
			channel?.close();
			reject(error);
		};

		if (channel) {
			channel.addEventListener('message', (event: MessageEvent) => {
				if (
					event.data?.type === 'wordpress-popup-bridge-ready' &&
					event.data?.scope === scope
				) {
					finishReady();
				}
			});
			channel.postMessage({
				type: 'wordpress-popup-bridge-wait',
				scope,
			});
		}

		// Queue for atomic takeover if the current lock owner exits (ither
		// before signaling readiness or later while this tab stays open).
		void locks
			.request(lockName, async () => {
				if (openerRemote.closed) {
					finishReady();
					return;
				}
				try {
					await attachCrossPartitionBridgeWithReadySignal(
						openerRemote,
						scope,
						bridgeUrl,
						serviceWorkerUrl
					);
					finishReady();
				} catch (error) {
					finishError(error);
					return;
				}
				await new Promise<void>(() => {});
			})
			.catch(finishError);
	});
}

async function attachCrossPartitionBridgeWithReadySignal(
	openerRemote: Window,
	scope: string,
	bridgeUrl: string | null,
	serviceWorkerUrl: string | null
) {
	await attachCrossPartitionBridge(
		openerRemote,
		scope,
		bridgeUrl,
		serviceWorkerUrl
	);
	if (typeof BroadcastChannel !== 'function') {
		return;
	}
	const channel = new BroadcastChannel(PARTITION_PROBE_CHANNEL_NAME);
	channel.addEventListener('message', (event: MessageEvent) => {
		if (
			event.data?.type === 'wordpress-popup-bridge-wait' &&
			event.data?.scope === scope
		) {
			channel.postMessage({
				type: 'wordpress-popup-bridge-ready',
				scope,
			});
		}
	});
	channel.postMessage({
		type: 'wordpress-popup-bridge-ready',
		scope,
	});
	window.addEventListener('pagehide', () => {
		channel.close();
	});
}

async function attachCrossPartitionBridge(
	openerRemote: Window,
	scope: string,
	bridgeUrl: string | null,
	serviceWorkerUrl: string | null
) {
	if (wordPressSiteUrl !== playgroundOrigin) {
		if (!isValidBridgeUrl(bridgeUrl, scope)) {
			return;
		}
		await attachSplitOriginBridge(openerRemote, scope, bridgeUrl!);
	} else {
		await attachSingleOriginBridge(openerRemote, scope, serviceWorkerUrl);
	}
}

function isValidBridgeUrl(bridgeUrl: string | null, scope: string): boolean {
	if (!bridgeUrl) {
		return false;
	}
	try {
		const parsed = new URL(bridgeUrl);
		return (
			parsed.origin === wordPressSiteUrl &&
			parsed.searchParams.get('scope') === scope
		);
	} catch {
		return false;
	}
}

function resolveSingleOriginServiceWorkerUrl(
	serviceWorkerUrl: string | null
): URL {
	if (serviceWorkerUrl) {
		try {
			const parsed = new URL(serviceWorkerUrl, playgroundOrigin);
			if (parsed.origin === playgroundOrigin) {
				return parsed;
			}
		} catch {
			// Fall back to default root worker path.
		}
	}
	return new URL('/sw.js', location.origin);
}

function closedOpenerResponse() {
	return {
		httpStatusCode: 503,
		headers: { 'content-type': ['text/plain; charset=utf-8'] },
		bytes: new TextEncoder().encode(
			'This Playground session has been closed.'
		),
	};
}

async function attachSplitOriginBridge(
	openerRemote: Window,
	scope: string,
	bridgeUrl: string
) {
	const bridge = document.createElement('iframe');
	bridge.hidden = true;
	bridge.title = 'WordPress bridge';
	bridge.src = bridgeUrl;

	await new Promise<void>((resolve, reject) => {
		const timeout = setTimeout(() => {
			window.removeEventListener('message', onMessage);
			bridge.remove();
			reject(new Error('WordPress popup bridge did not start.'));
		}, BRIDGE_READY_TIMEOUT_MS);

		function onMessage(event: MessageEvent) {
			if (
				event.source === bridge.contentWindow &&
				event.origin === wordPressSiteUrl &&
				event.data?.scope === scope
			) {
				if (event.data.type === 'wordpress-bridge-ready') {
					clearTimeout(timeout);
					resolve();
					return;
				}
				if (event.data.type !== 'wordpress-bridge-request') {
					return;
				}
				if (openerRemote.closed) {
					bridge.contentWindow?.postMessage(
						{
							type: 'wordpress-bridge-response',
							scope,
							requestId: event.data.requestId,
							response: closedOpenerResponse(),
						},
						wordPressSiteUrl
					);
					return;
				}
				openerRemote.postMessage(
					{
						...event.data,
						type: 'wordpress-popup-bridge-request',
					},
					playgroundOrigin
				);
				return;
			}

			if (
				event.source === openerRemote &&
				event.origin === playgroundOrigin &&
				event.data?.type === 'wordpress-popup-bridge-response' &&
				event.data.scope === scope
			) {
				if (!bridge.contentWindow) {
					return;
				}
				const { requestId, response } = event.data;
				if (response?.bodyPort) {
					response.bodyPort = streamToPort(
						portToStream(response.bodyPort)
					);
				}
				bridge.contentWindow.postMessage(
					{
						type: 'wordpress-bridge-response',
						scope,
						requestId,
						response,
					},
					wordPressSiteUrl,
					response?.bodyPort ? [response.bodyPort] : []
				);
			}
		}

		window.addEventListener('message', onMessage);
		document.body.append(bridge);
	});
}

async function attachSingleOriginBridge(
	openerRemote: Window,
	scope: string,
	serviceWorkerUrl: string | null
) {
	if (!navigator.serviceWorker) {
		return;
	}
	try {
		await navigator.serviceWorker.register(
			resolveSingleOriginServiceWorkerUrl(serviceWorkerUrl),
			{
				type: 'module',
				updateViaCache: 'none',
			}
		);
	} catch {
		// Fall through to waiting for an already-installed worker.
	}
	await Promise.race([
		navigator.serviceWorker.ready,
		new Promise<never>((_, reject) =>
			setTimeout(
				() =>
					reject(
						new Error(
							'WordPress popup service worker did not start.'
						)
					),
				BRIDGE_READY_TIMEOUT_MS
			)
		),
	]);
	let nextRelayRequestId = 0;
	const pendingSources = new Map<
		number,
		{
			source: ServiceWorker;
			workerRequestId: number;
			timeout: ReturnType<typeof setTimeout>;
		}
	>();

	navigator.serviceWorker.addEventListener('message', (event) => {
		if (event.data?.scope !== scope || !event.source) {
			return;
		}
		const source = event.source as ServiceWorker;
		const workerRequestId = event.data.requestId as number;
		if (openerRemote.closed) {
			source.postMessage(
				responseTo(workerRequestId, closedOpenerResponse())
			);
			return;
		}
		const relayRequestId = ++nextRelayRequestId;
		const timeout = setTimeout(() => {
			pendingSources.delete(relayRequestId);
		}, PENDING_REQUEST_TIMEOUT_MS);
		pendingSources.set(relayRequestId, {
			source,
			workerRequestId,
			timeout,
		});
		openerRemote.postMessage(
			{
				...event.data,
				requestId: relayRequestId,
				type: 'wordpress-popup-bridge-request',
			},
			playgroundOrigin
		);
	});

	window.addEventListener('message', (event) => {
		if (
			event.source !== openerRemote ||
			event.origin !== playgroundOrigin ||
			event.data?.type !== 'wordpress-popup-bridge-response' ||
			event.data.scope !== scope
		) {
			return;
		}
		const { requestId, response } = event.data;
		const pending = pendingSources.get(requestId);
		if (!pending) {
			return;
		}
		clearTimeout(pending.timeout);
		pendingSources.delete(requestId);
		if (response?.bodyPort) {
			response.bodyPort = streamToPort(portToStream(response.bodyPort));
		}
		pending.source.postMessage(
			responseTo(pending.workerRequestId, response),
			response?.bodyPort ? [response.bodyPort] : []
		);
	});
}
