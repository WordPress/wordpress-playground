import { getURLScope } from '@php-wasm/scopes';
import { portToStream, streamToPort } from '@php-wasm/universal';
import { responseTo } from '@php-wasm/web-service-worker';
import { playgroundOrigin, wordPressSiteUrl } from './config';

const PARTITION_PROBE_CHANNEL_NAME = 'playground-partition-probe';
const OPENER_PROBE_TIMEOUT_MS = 300;
const BROADCAST_ECHO_WAIT_MS = 50;
const BRIDGE_READY_TIMEOUT_MS = 15000;

type PartitionProbeResult = {
	openerRemote: Window | null;
	bridgeUrl: string | null;
	isSamePartition: boolean;
	hasLocalBridge: boolean;
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
 * mismatch via BroadcastChannel and attaches a local bridge that relays HTTP
 * requests back to the opener's remote.html over postMessage.
 *
 * Scoped app routes preserve the path, query, and fragment on the WordPress origin.
 * The explicit popup route supplies its destination in the hash. Accept only scoped URLs so this
 * wrapper cannot be used to load trusted app documents into the iframe.
 * Loopback delegation is off by default. Personal WP's own entry document opts in;
 * neither the hosting domain nor URL parameters enable it.
 */
export function bootWordPressPopup({ allowLoopbackNetwork = false } = {}) {
	const target = getURLScope(new URL(location.href))
		? new URL(
				location.pathname + location.search + location.hash,
				wordPressSiteUrl
			)
		: new URL(location.hash.substring(1), wordPressSiteUrl);
	const scope = getURLScope(target);
	if (target.origin !== wordPressSiteUrl || !scope) {
		throw new Error('The popup URL must name a scoped WordPress page.');
	}
	const frame = document.querySelector('#wp') as HTMLIFrameElement;
	// Only a trusted application entry point opts in; URL parameters cannot enable it.
	if (allowLoopbackNetwork) {
		frame.allow = `loopback-network ${wordPressSiteUrl}`;
	}
	const openerCandidates = getOpenerCandidates();
	if (openerCandidates.length === 0) {
		frame.src = target.href;
		return;
	}
	void connectCrossPartitionBridgeAndLoad(
		frame,
		target,
		scope,
		openerCandidates
	);
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
	target: URL,
	scope: string,
	openerCandidates: Window[]
) {
	try {
		const probe = await probeOpenerPartition(scope, openerCandidates);
		if (!probe.openerRemote || probe.isSamePartition) {
			return;
		}
		if (probe.hasLocalBridge) {
			watchForBridgeTakeover(probe.openerRemote, scope, probe.bridgeUrl);
			return;
		}
		await attachCrossPartitionBridge(
			probe.openerRemote,
			scope,
			probe.bridgeUrl
		);
	} catch {
		// Fall through to loading the frame so normal error handling applies.
	} finally {
		frame.src = target.href;
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
		let isSamePartition = false;
		let hasLocalBridge = false;
		let settled = false;
		let echoTimer: ReturnType<typeof setTimeout> | null = null;

		const channel =
			typeof BroadcastChannel === 'function'
				? new BroadcastChannel(PARTITION_PROBE_CHANNEL_NAME)
				: null;

		const finish = () => {
			if (settled) return;
			settled = true;
			clearTimeout(overallTimer);
			if (echoTimer !== null) {
				clearTimeout(echoTimer);
			}
			window.removeEventListener('message', onWindowMessage);
			channel?.close();
			resolve({
				openerRemote,
				bridgeUrl,
				isSamePartition,
				hasLocalBridge,
			});
		};

		const onWindowMessage = (event: MessageEvent) => {
			if (
				event.origin !== playgroundOrigin ||
				!event.source ||
				event.data?.type !== 'wordpress-popup-partition-probe-ack' ||
				event.data.scope !== scope ||
				event.data.probeId !== probeId
			) {
				return;
			}
			openerRemote = event.source as Window;
			bridgeUrl =
				typeof event.data.bridgeUrl === 'string'
					? event.data.bridgeUrl
					: null;
			if (isSamePartition || hasLocalBridge || !channel) {
				finish();
				return;
			}
			// Give same-partition BroadcastChannel messages a short window to arrive.
			echoTimer = setTimeout(finish, BROADCAST_ECHO_WAIT_MS);
		};

		if (channel) {
			channel.addEventListener('message', (event: MessageEvent) => {
				if (
					event.data?.scope !== scope ||
					event.data?.probeId !== probeId
				) {
					return;
				}
				if (
					event.data.type === 'wordpress-popup-partition-probe-echo'
				) {
					isSamePartition = true;
					if (openerRemote) finish();
				} else if (
					event.data.type === 'wordpress-popup-local-bridge-ack'
				) {
					hasLocalBridge = true;
					if (openerRemote) finish();
				}
			});
			channel.postMessage({
				type: 'wordpress-popup-local-bridge-probe',
				scope,
				probeId,
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

function watchForBridgeTakeover(
	openerRemote: Window,
	scope: string,
	bridgeUrl: string | null
) {
	if (typeof BroadcastChannel !== 'function') {
		return;
	}
	const channel = new BroadcastChannel(PARTITION_PROBE_CHANNEL_NAME);
	channel.addEventListener('message', async (event: MessageEvent) => {
		if (
			event.data?.type !== 'wordpress-popup-bridge-closed' ||
			event.data?.scope !== scope
		) {
			return;
		}
		if (openerRemote.closed) {
			channel.close();
			return;
		}
		channel.close();
		const probe = await probeOpenerPartition(scope, [openerRemote]);
		if (
			probe.openerRemote &&
			!probe.isSamePartition &&
			!probe.hasLocalBridge
		) {
			await attachCrossPartitionBridge(
				probe.openerRemote,
				scope,
				probe.bridgeUrl ?? bridgeUrl
			);
		}
	});
}

async function attachCrossPartitionBridge(
	openerRemote: Window,
	scope: string,
	bridgeUrl: string | null
) {
	if (wordPressSiteUrl !== playgroundOrigin) {
		if (!isValidBridgeUrl(bridgeUrl, scope)) {
			return;
		}
		await attachSplitOriginBridge(openerRemote, scope, bridgeUrl!);
	} else {
		await attachSingleOriginBridge(openerRemote, scope);
	}
	announceLocalBridge(scope);
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
				const { requestId, response } = event.data;
				if (response?.bodyPort) {
					response.bodyPort = streamToPort(
						portToStream(response.bodyPort)
					);
				}
				bridge.contentWindow?.postMessage(
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

async function attachSingleOriginBridge(openerRemote: Window, scope: string) {
	if (!navigator.serviceWorker) {
		return;
	}
	await navigator.serviceWorker.ready;
	const pendingSources = new Map<number, ServiceWorker>();

	navigator.serviceWorker.addEventListener('message', (event) => {
		if (
			event.data?.scope !== scope ||
			!event.source ||
			openerRemote.closed
		) {
			return;
		}
		pendingSources.set(event.data.requestId, event.source as ServiceWorker);
		openerRemote.postMessage(
			{
				...event.data,
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
		const source = pendingSources.get(requestId);
		if (!source) {
			return;
		}
		pendingSources.delete(requestId);
		if (response?.bodyPort) {
			response.bodyPort = streamToPort(portToStream(response.bodyPort));
		}
		source.postMessage(
			responseTo(requestId, response),
			response?.bodyPort ? [response.bodyPort] : []
		);
	});
}

function announceLocalBridge(scope: string) {
	if (typeof BroadcastChannel !== 'function') {
		return;
	}
	const channel = new BroadcastChannel(PARTITION_PROBE_CHANNEL_NAME);
	channel.addEventListener('message', (event: MessageEvent) => {
		if (
			event.data?.type === 'wordpress-popup-local-bridge-probe' &&
			event.data?.scope === scope &&
			typeof event.data?.probeId === 'string'
		) {
			channel.postMessage({
				type: 'wordpress-popup-local-bridge-ack',
				scope,
				probeId: event.data.probeId,
			});
		}
	});
	window.addEventListener('pagehide', () => {
		channel.postMessage({
			type: 'wordpress-popup-bridge-closed',
			scope,
		});
		channel.close();
	});
}
