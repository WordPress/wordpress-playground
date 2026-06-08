import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import css from './style.module.css';
import { DirectTunnelGuest } from '../../lib/desktop-access-direct-tunnel';

// @ts-ignore
import serviceWorkerPath from '../../../../remote/service-worker.ts?worker&url';

interface DesktopAccessViewerProps {
	sessionId: string;
}

type ConnectionStatus =
	| 'connecting'
	| 'connected'
	| 'error'
	| 'phone-disconnected';

interface SessionStatusResponse {
	hostAlive: boolean;
}

interface RelayDiagnostics {
	serviceWorker: string;
	dataChannel: string;
	iframe: string;
	requests: number;
	pending: number;
	lastPath: string;
	lastError: string;
}

const STATUS_POLL_INTERVAL_MS = 3000;
const GUEST_ID_STORAGE_KEY = 'personal-wp-desktop-access-guest-id';
const DESKTOP_RELAY_SCOPE = 'default';
const DESKTOP_RELAY_SCOPED_URL = `/scope:${DESKTOP_RELAY_SCOPE}/`;
const DESKTOP_RELAY_PROBE_URL = `${DESKTOP_RELAY_SCOPED_URL}?desktop-relay-probe=1`;
const SERVICE_WORKER_RELAY_TTL_MS = 5 * 60 * 1000;
const SERVICE_WORKER_RELAY_REFRESH_MS = 60 * 1000;

export function DesktopAccessViewer({ sessionId }: DesktopAccessViewerProps) {
	const [status, setStatus] = useState<ConnectionStatus>('connecting');
	const [error, setError] = useState<string | null>(null);
	const [unsupportedMessage, setUnsupportedMessage] = useState<string | null>(
		null
	);
	const [serviceWorkerReady, setServiceWorkerReady] = useState(false);
	const [dataChannelReady, setDataChannelReady] = useState(false);
	const [iframeHasLoaded, setIframeHasLoaded] = useState(false);
	const [relayDiagnostics, setRelayDiagnostics] = useState<RelayDiagnostics>({
		serviceWorker: 'Waiting',
		dataChannel: 'Waiting',
		iframe: 'Waiting',
		requests: 0,
		pending: 0,
		lastPath: '-',
		lastError: '-',
	});
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const directTunnelRef = useRef<DirectTunnelGuest | null>(null);
	const guestId = useRef(getOrCreateGuestId()).current;
	const shouldLoadIframe =
		serviceWorkerReady && (dataChannelReady || iframeHasLoaded);

	const statusUrl = useMemo(
		() =>
			`${window.location.origin}/relay/${sessionId}/status?gid=${encodeURIComponent(
				guestId
			)}`,
		[guestId, sessionId]
	);

	useEffect(() => {
		const controller = new AbortController();
		let cancelled = false;
		let sawPhoneAlive = false;
		let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

		const scheduleNextPoll = () => {
			if (!cancelled) {
				timeoutHandle = setTimeout(pollOnce, STATUS_POLL_INTERVAL_MS);
			}
		};

		const pollOnce = async () => {
			if (cancelled) {
				return;
			}
			try {
				const res = await fetch(statusUrl, {
					signal: controller.signal,
				});
				if (cancelled) {
					return;
				}
				if (res.status === 404) {
					setError('This desktop access link has expired.');
					setStatus('error');
					return;
				}
				if (!res.ok) {
					scheduleNextPoll();
					return;
				}
				const data = (await res.json()) as SessionStatusResponse;
				if (data.hostAlive) {
					sawPhoneAlive = true;
				} else if (sawPhoneAlive) {
					setStatus('phone-disconnected');
					return;
				}
			} catch (err) {
				if ((err as { name?: string })?.name === 'AbortError') {
					return;
				}
			}
			scheduleNextPoll();
		};

		const directTunnel = new DirectTunnelGuest({
			sessionId,
			relayUrl: window.location.origin,
			guestId,
			onStatusChange(nextStatus, detail) {
				if (cancelled) {
					return;
				}
				if (nextStatus === 'connected') {
					sawPhoneAlive = true;
					setDataChannelReady(true);
					setRelayDiagnostics((current) => ({
						...current,
						dataChannel: `Connected ${detail}`,
					}));
					return;
				}
				if (nextStatus === 'error' && !sawPhoneAlive) {
					setDataChannelReady(false);
					setRelayDiagnostics((current) => ({
						...current,
						dataChannel: `Failed before connecting ${detail}`,
					}));
					setError(
						'Unable to connect directly to your phone. Keep both devices nearby and on the same network.'
					);
					setStatus('error');
					return;
				}
				setDataChannelReady(false);
				setRelayDiagnostics((current) => ({
					...current,
					dataChannel: `Reconnecting ${detail}`,
				}));
				setStatus('connecting');
			},
		});
		directTunnelRef.current = directTunnel;
		directTunnel.start();
		pollOnce();

		return () => {
			cancelled = true;
			controller.abort();
			setDataChannelReady(false);
			directTunnel.stop();
			if (directTunnelRef.current === directTunnel) {
				directTunnelRef.current = null;
			}
			setRelayDiagnostics((current) => ({
				...current,
				dataChannel: 'Stopped',
			}));
			if (timeoutHandle !== null) {
				clearTimeout(timeoutHandle);
			}
		};
	}, [guestId, sessionId, statusUrl]);

	useEffect(() => {
		if (!('serviceWorker' in navigator)) {
			return;
		}

		let cancelled = false;
		let interval: ReturnType<typeof setInterval> | null = null;

		const configureServiceWorker = async () => {
			const serviceWorkerUrl = new URL(
				serviceWorkerPath,
				window.location.origin
			);
			setRelayDiagnostics((current) => ({
				...current,
				serviceWorker: `Registering ${serviceWorkerUrl.pathname}`,
			}));
			const registration = await navigator.serviceWorker.register(
				serviceWorkerUrl,
				{
					type: 'module',
					updateViaCache: 'none',
					scope: '/',
				}
			);
			await navigator.serviceWorker.ready;

			if (cancelled) {
				return;
			}
			await postDesktopRelayMapping(registration);
			await verifyScopedRequestsAreControlled();
			if (cancelled) {
				return;
			}
			setServiceWorkerReady(true);
			interval = setInterval(
				() => postDesktopRelayMapping(registration),
				SERVICE_WORKER_RELAY_REFRESH_MS
			);
			registration.update().catch(() => {});
		};

		const postDesktopRelayMapping = (
			registration: ServiceWorkerRegistration
		): Promise<void> => {
			const worker =
				navigator.serviceWorker.controller || registration.active;
			if (!worker) {
				return Promise.reject(
					new Error('Desktop access service worker is not active.')
				);
			}
			return new Promise((resolve, reject) => {
				const channel = new MessageChannel();
				const timeout = setTimeout(() => {
					reject(
						new Error(
							'Desktop access service worker did not confirm setup.'
						)
					);
				}, 5000);
				channel.port1.onmessage = (event) => {
					clearTimeout(timeout);
					if (event.data?.type === 'desktop-relay-map-result') {
						setRelayDiagnostics((current) => ({
							...current,
							serviceWorker: event.data?.clientId
								? `Mapped client ${event.data.clientId}`
								: 'Mapped without client id',
						}));
						resolve();
						return;
					}
					reject(
						new Error(
							event.data?.error ||
								'Desktop access service worker setup failed.'
						)
					);
				};
				worker.postMessage(
					{
						type: 'desktop-relay-map',
						scope: DESKTOP_RELAY_SCOPE,
						sessionId,
						ttl: SERVICE_WORKER_RELAY_TTL_MS,
					},
					[channel.port2]
				);
			});
		};

		const verifyScopedRequestsAreControlled = async () => {
			const response = await fetch(DESKTOP_RELAY_PROBE_URL, {
				cache: 'no-store',
			});
			if (
				response.headers.get('X-Desktop-Relay-Service-Worker') !== '1'
			) {
				throw new Error(
					'Desktop access service worker is not controlling WordPress requests.'
				);
			}
			const data = await response.json();
			setRelayDiagnostics((current) => ({
				...current,
				serviceWorker: data.hasMapping
					? 'Controlling /scope:default/'
					: 'Probe reached worker without mapping',
			}));
		};

		configureServiceWorker().catch((error) => {
			setRelayDiagnostics((current) => ({
				...current,
				serviceWorker: `Error: ${(error as Error).message}`,
				lastError: (error as Error).message,
			}));
			setError((error as Error).message);
			setStatus('error');
		});

		window.addEventListener('pagehide', clearDesktopRelayMapping);
		return () => {
			cancelled = true;
			setServiceWorkerReady(false);
			if (interval !== null) {
				clearInterval(interval);
			}
			window.removeEventListener('pagehide', clearDesktopRelayMapping);
			clearDesktopRelayMapping();
		};
	}, [sessionId]);

	useEffect(() => {
		function handleServiceWorkerMessage(event: MessageEvent) {
			const data = event.data;
			if (
				typeof data !== 'object' ||
				data === null ||
				data.type !== 'desktop-relay-request' ||
				data.sessionId !== sessionId
			) {
				return;
			}
			const port = event.ports[0];
			if (!port) {
				return;
			}
			setRelayDiagnostics((current) => ({
				...current,
				requests: current.requests + 1,
				pending: current.pending + 1,
				lastPath: `${data.method || 'GET'} ${data.path || '/'}`,
				lastError: '-',
			}));
			const directTunnel = directTunnelRef.current;
			if (!directTunnel) {
				setRelayDiagnostics((current) => ({
					...current,
					pending: Math.max(0, current.pending - 1),
					lastError: 'Phone data channel is not connected yet.',
				}));
				port.postMessage({
					type: 'desktop-relay-error',
					error: 'Phone data channel is not connected yet.',
				});
				return;
			}
			directTunnel
				.request({
					requestId: data.requestId,
					method: data.method,
					path: data.path,
					headers: data.headers,
					body: data.body,
				})
				.then((response) => {
					setRelayDiagnostics((current) => ({
						...current,
						pending: Math.max(0, current.pending - 1),
					}));
					port.postMessage({
						type: 'desktop-relay-response',
						response,
					});
				})
				.catch((error) => {
					setRelayDiagnostics((current) => ({
						...current,
						pending: Math.max(0, current.pending - 1),
						lastError: (error as Error).message,
					}));
					port.postMessage({
						type: 'desktop-relay-error',
						error: (error as Error).message,
					});
				});
		}

		navigator.serviceWorker?.addEventListener(
			'message',
			handleServiceWorkerMessage
		);
		return () => {
			navigator.serviceWorker?.removeEventListener(
				'message',
				handleServiceWorkerMessage
			);
		};
	}, [sessionId]);

	useEffect(() => {
		function handleMessage(event: MessageEvent) {
			if (!isMessageFromIframeTree(event, iframeRef.current)) {
				return;
			}
			if (event.origin !== window.location.origin) {
				return;
			}
			if (
				typeof event.data !== 'object' ||
				event.data === null ||
				event.data.type !== 'relay' ||
				event.data.relayType !== 'install-blueprint'
			) {
				return;
			}

			setUnsupportedMessage(
				'Installing apps from desktop access is not available yet. Use Site Tools on your phone to install this app.'
			);
			postUnsupportedInstallBlueprintResult(event);
		}

		window.addEventListener('message', handleMessage);
		return () => window.removeEventListener('message', handleMessage);
	}, []);

	const handleIframeLoad = useCallback(() => {
		if (!iframeRef.current?.src.includes(DESKTOP_RELAY_SCOPED_URL)) {
			return;
		}
		setIframeHasLoaded(true);
		setRelayDiagnostics((current) => ({
			...current,
			iframe: 'Loaded /scope:default/',
		}));
		setStatus('connected');
	}, []);

	const retry = () => {
		setStatus('connecting');
		setError(null);
		if (iframeRef.current) {
			iframeRef.current.src = shouldLoadIframe
				? DESKTOP_RELAY_SCOPED_URL
				: 'about:blank';
		}
		setRelayDiagnostics((current) => ({
			...current,
			iframe: shouldLoadIframe ? 'Reloading' : 'Waiting',
			lastError: '-',
		}));
	};

	const disconnect = () => {
		clearDesktopRelayMapping();
		window.location.href = '/connect';
	};

	return (
		<div className={css.viewer}>
			<header className={css.banner}>
				<div>
					<strong>Using My WordPress from your phone</strong>
					<span>
						Keep my.wordpress.net open on your phone while you work
						here.
					</span>
				</div>
				<ConnectionPill status={status} onDisconnect={disconnect} />
			</header>
			<RelayDiagnosticsBar diagnostics={relayDiagnostics} />
			{unsupportedMessage ? (
				<div className={css.unsupportedNotice} role="status">
					<span>{unsupportedMessage}</span>
					<button
						type="button"
						onClick={() => setUnsupportedMessage(null)}
					>
						Dismiss
					</button>
				</div>
			) : null}

			{status === 'error' && error ? (
				<div className={css.centerNotice} role="alert">
					<h1>Could not connect</h1>
					<p>{error}</p>
					<button type="button" onClick={retry}>
						Try again
					</button>
				</div>
			) : null}

			{status === 'connecting' ||
			(status === 'connected' && !shouldLoadIframe) ? (
				<div className={css.centerNotice} role="status">
					<h1>Connecting to your phone</h1>
					<p>
						{dataChannelReady
							? 'Preparing the desktop viewer.'
							: 'This desktop window will show the WordPress that is running on your phone.'}
					</p>
				</div>
			) : null}

			{status !== 'error' ? (
				<div className={css.iframeWrapper}>
					<iframe
						ref={iframeRef}
						src={
							shouldLoadIframe
								? DESKTOP_RELAY_SCOPED_URL
								: 'about:blank'
						}
						className={css.iframe}
						onLoad={handleIframeLoad}
						title="My WordPress from phone"
						style={{
							opacity:
								(iframeHasLoaded && shouldLoadIframe) ||
								status === 'phone-disconnected'
									? 1
									: 0,
						}}
					/>
					{status === 'phone-disconnected' ? (
						<div className={css.disconnectedOverlay}>
							<div className={css.disconnectedCard}>
								<h1>Phone disconnected</h1>
								<p>
									The last page is preserved, but new actions
									need the phone tab to reconnect.
								</p>
								<button type="button" onClick={retry}>
									Try again
								</button>
							</div>
						</div>
					) : null}
				</div>
			) : null}
		</div>
	);
}

function postUnsupportedInstallBlueprintResult(event: MessageEvent) {
	if (!event.source) {
		return;
	}
	const data = event.data as {
		blueprintUrl?: unknown;
		requestId?: unknown;
	};
	(event.source as Window).postMessage(
		{
			type: 'relay',
			relayType: 'install-blueprint-result',
			blueprintUrl:
				typeof data.blueprintUrl === 'string' ? data.blueprintUrl : '',
			requestId:
				typeof data.requestId === 'string' ? data.requestId : undefined,
			status: 'error',
			error: 'Installing apps from desktop access is not available yet.',
		},
		event.origin
	);
}

function isMessageFromIframeTree(
	event: MessageEvent,
	iframe: HTMLIFrameElement | null
): boolean {
	if (!iframe?.contentWindow || !event.source) {
		return false;
	}
	if (event.source === iframe.contentWindow) {
		return true;
	}
	return isDescendantWindow(iframe.contentWindow, event.source);
}

function isDescendantWindow(
	root: Window,
	candidate: MessageEventSource
): boolean {
	try {
		for (let i = 0; i < root.frames.length; i++) {
			const child = root.frames[i];
			if (child === candidate || isDescendantWindow(child, candidate)) {
				return true;
			}
		}
	} catch {
		return false;
	}
	return false;
}

export function getDesktopAccessSessionId(): string | null {
	const params = new URLSearchParams(window.location.search);
	return params.get('share');
}

function clearDesktopRelayMapping() {
	navigator.serviceWorker?.controller?.postMessage({
		type: 'desktop-relay-clear',
		scope: DESKTOP_RELAY_SCOPE,
	});
}

function ConnectionPill({
	status,
	onDisconnect,
}: {
	status: ConnectionStatus;
	onDisconnect: () => void;
}) {
	const label =
		status === 'connected'
			? 'Connected'
			: status === 'phone-disconnected'
				? 'Phone disconnected'
				: status === 'error'
					? 'Connection error'
					: 'Connecting';

	if (status === 'connected') {
		return (
			<button
				type="button"
				className={`${css.statusPill} ${css.statusPillButton}`}
				onClick={onDisconnect}
				aria-label="Disconnect desktop access"
			>
				<span className={css.statusPillLabel}>{label}</span>
				<span className={css.statusPillHoverLabel}>Disconnect</span>
			</button>
		);
	}

	return <span className={css.statusPill}>{label}</span>;
}

function RelayDiagnosticsBar({
	diagnostics,
}: {
	diagnostics: RelayDiagnostics;
}) {
	return (
		<div className={css.relayDiagnostics} aria-live="polite">
			<span>SW: {diagnostics.serviceWorker}</span>
			<span>Channel: {diagnostics.dataChannel}</span>
			<span>Frame: {diagnostics.iframe}</span>
			<span>Requests: {diagnostics.requests}</span>
			<span>Pending: {diagnostics.pending}</span>
			<span>Last: {diagnostics.lastPath}</span>
			<span>Error: {diagnostics.lastError}</span>
		</div>
	);
}

function getOrCreateGuestId(): string {
	try {
		const existing = sessionStorage.getItem(GUEST_ID_STORAGE_KEY);
		if (existing) {
			return existing;
		}
		const fresh = crypto.randomUUID();
		sessionStorage.setItem(GUEST_ID_STORAGE_KEY, fresh);
		return fresh;
	} catch {
		return crypto.randomUUID();
	}
}
