import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import css from './style.module.css';
import {
	buildConnectUrlFromScopedIframeUrl,
	buildRemoteAccessRelayEndpointUrl,
	buildRemoteAccessScopedIframeUrl,
	clearRemoteAccessRelayMapping,
	DirectTunnelGuest,
	fetchRemoteAccessRelayProbe,
	getRemoteAccessPathFromConnectUrl,
	getRemoteAccessRelayRequestMessage,
	getRemoteAccessSessionId as getRemoteAccessSessionIdFromUrl,
	postRemoteAccessRelayError,
	postRemoteAccessRelayMapping,
	postRemoteAccessRelayResponse,
	registerRemoteAccessServiceWorker,
	stripRemoteAccessSessionId,
} from '@wp-playground/remote-access';
import saveAs from 'file-saver';

import serviceWorkerPath from '@wp-playground/remote/service-worker?worker&url';
import remoteAccessFrameUrl from './remote-access-frame.html?url';

interface RemoteAccessViewerProps {
	sessionId: string;
}

type ConnectionStatus =
	| 'connecting'
	| 'connected'
	| 'error'
	| 'host-disconnected';

interface SessionStatusResponse {
	hostAlive: boolean;
}

interface RelayDiagnostics {
	serviceWorker: string;
	dataChannel: string;
	iframe: string;
	requests: number;
	intercepted: number;
	pending: number;
	lastPath: string;
	lastError: string;
}

interface RemoteAccessFrameMessage {
	type: 'remote-access-frame-message';
	payload: unknown;
}

const STATUS_POLL_INTERVAL_MS = 3000;
const GUEST_ID_STORAGE_KEY = 'personal-wp-remote-access-guest-id';
const REMOTE_ACCESS_RELAY_SCOPE = 'default';
const SERVICE_WORKER_RELAY_TTL_MS = 5 * 60 * 1000;
const SERVICE_WORKER_RELAY_REFRESH_MS = 60 * 1000;

export function RemoteAccessViewer({ sessionId }: RemoteAccessViewerProps) {
	const [status, setStatus] = useState<ConnectionStatus>('connecting');
	const [error, setError] = useState<string | null>(null);
	const [unsupportedMessage, setUnsupportedMessage] = useState<string | null>(
		null
	);
	const [noticeCanRetry, setNoticeCanRetry] = useState(false);
	const [serviceWorkerReady, setServiceWorkerReady] = useState(false);
	const [dataChannelReady, setDataChannelReady] = useState(false);
	const [isDownloadingBackup, setIsDownloadingBackup] = useState(false);
	const [approvalPending, setApprovalPending] = useState(false);
	const [iframeHasLoaded, setIframeHasLoaded] = useState(false);
	const [iframeSrc, setIframeSrc] = useState('about:blank');
	const [connectionAttempt, setConnectionAttempt] = useState(0);
	const [relayDiagnostics, setRelayDiagnostics] = useState<RelayDiagnostics>({
		serviceWorker: 'Waiting',
		dataChannel: 'Waiting',
		iframe: 'Waiting',
		requests: 0,
		intercepted: 0,
		pending: 0,
		lastPath: '-',
		lastError: '-',
	});
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const directTunnelRef = useRef<DirectTunnelGuest | null>(null);
	const guestId = useRef(getOrCreateGuestId()).current;
	const verificationCode = useRef(generateVerificationCode()).current;
	const shouldLoadIframe =
		serviceWorkerReady && (dataChannelReady || iframeHasLoaded);
	const remoteAccessRelayIframeUrl = useMemo(
		() =>
			buildRemoteAccessScopedIframeUrl(
				getRemoteAccessPathFromConnectUrl(window.location.href),
				sessionId,
				{ scope: REMOTE_ACCESS_RELAY_SCOPE }
			),
		[sessionId]
	);
	const remoteAccessViewerFrameUrl = useMemo(() => {
		return buildRemoteAccessViewerFrameUrl(remoteAccessRelayIframeUrl);
	}, [remoteAccessRelayIframeUrl]);
	const relayDiagnosticsTitle = useMemo(
		() => formatRelayDiagnosticsTitle(relayDiagnostics),
		[relayDiagnostics]
	);

	const statusUrl = useMemo(
		() =>
			buildRemoteAccessRelayEndpointUrl(
				window.location.origin,
				'status',
				{
					sessionId,
					gid: guestId,
				}
			),
		[guestId, sessionId]
	);

	useEffect(() => {
		const url = new URL(window.location.href);
		if (!url.searchParams.has('share')) {
			return;
		}
		window.history.replaceState(
			{},
			'',
			stripRemoteAccessSessionId(window.location.href)
		);
	}, []);

	useEffect(() => {
		const controller = new AbortController();
		let cancelled = false;
		let sawHostAlive = false;
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
					setError('This remote access link has expired.');
					setStatus('error');
					return;
				}
				if (!res.ok) {
					scheduleNextPoll();
					return;
				}
				const data = (await res.json()) as SessionStatusResponse;
				if (data.hostAlive) {
					sawHostAlive = true;
				} else if (sawHostAlive) {
					setStatus('host-disconnected');
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
			verificationCode,
			onStatusChange(nextStatus, detail) {
				if (cancelled) {
					return;
				}
				if (nextStatus === 'connected') {
					sawHostAlive = true;
					setDataChannelReady(true);
					setApprovalPending(false);
					setStatus('connected');
					setRelayDiagnostics((current) => ({
						...current,
						dataChannel: `Connected ${detail}`,
					}));
					return;
				}
				setApprovalPending(
					detail.includes('waiting for host approval')
				);
				if (nextStatus === 'error') {
					setDataChannelReady(false);
					setRelayDiagnostics((current) => ({
						...current,
						dataChannel: sawHostAlive
							? `Connection failed ${detail}`
							: `Failed before connecting ${detail}`,
					}));
					setError(
						'Unable to connect directly to the host device. Keep both devices nearby and on the same network.'
					);
					setNoticeCanRetry(true);
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
	}, [connectionAttempt, guestId, sessionId, statusUrl]);

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
			const registration = await registerRemoteAccessServiceWorker(
				serviceWorkerUrl,
				window.location.origin
			);

			if (cancelled) {
				return;
			}
			await refreshRemoteAccessRelayMapping(registration);
			if (cancelled) {
				return;
			}
			setServiceWorkerReady(true);
			refreshServiceWorkerProbe().catch(() => {});
			interval = setInterval(
				() => refreshRemoteAccessRelayMapping(registration),
				SERVICE_WORKER_RELAY_REFRESH_MS
			);
			registration.update().catch(() => {});
		};

		const refreshRemoteAccessRelayMapping = (
			registration: ServiceWorkerRegistration
		): Promise<void> => {
			return postRemoteAccessRelayMapping(registration, {
				scope: REMOTE_ACCESS_RELAY_SCOPE,
				sessionId,
				ttl: SERVICE_WORKER_RELAY_TTL_MS,
			}).then(({ clientId }) => {
				setRelayDiagnostics((current) => ({
					...current,
					serviceWorker: clientId
						? `Mapped client ${clientId}`
						: 'Mapped without client id',
				}));
			});
		};

		const refreshServiceWorkerProbe = async () => {
			const data = await fetchRemoteAccessRelayProbe(
				REMOTE_ACCESS_RELAY_SCOPE,
				sessionId
			);
			setRelayDiagnostics((current) => ({
				...current,
				serviceWorker: data.hasMapping
					? `Controlling /scope:default/ · intercepted ${data.interceptedRequests}`
					: 'Probe reached worker without mapping',
				intercepted: data.interceptedRequests,
				lastPath:
					current.lastPath === '-' &&
					data.lastInterceptedPath !== null
						? data.lastInterceptedPath
						: current.lastPath,
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

		window.addEventListener('pagehide', clearRemoteAccessRelay);
		return () => {
			cancelled = true;
			setServiceWorkerReady(false);
			if (interval !== null) {
				clearInterval(interval);
			}
			window.removeEventListener('pagehide', clearRemoteAccessRelay);
			clearRemoteAccessRelay();
		};
	}, [sessionId]);

	useEffect(() => {
		function handleServiceWorkerMessage(event: MessageEvent) {
			const data = getRemoteAccessRelayRequestMessage(
				event.data,
				sessionId
			);
			if (!data) {
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
					lastError:
						'Remote access data channel is not connected yet.',
				}));
				postRemoteAccessRelayError(
					port,
					'Remote access data channel is not connected yet.'
				);
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
					setIframeHasLoaded(true);
					setStatus('connected');
					setRelayDiagnostics((current) => ({
						...current,
						pending: Math.max(0, current.pending - 1),
					}));
					postRemoteAccessRelayResponse(port, response);
				})
				.catch((error) => {
					const message = (error as Error).message;
					setRelayDiagnostics((current) => ({
						...current,
						pending: Math.max(0, current.pending - 1),
						lastError: message,
					}));
					setUnsupportedMessage(
						`Remote access request failed: ${message}`
					);
					setNoticeCanRetry(true);
					postRemoteAccessRelayError(port, message);
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
		if (!shouldLoadIframe || iframeSrc !== 'about:blank') {
			return;
		}
		setIframeSrc(remoteAccessViewerFrameUrl);
		setRelayDiagnostics((current) => ({
			...current,
			iframe: 'Loading /scope:default/',
		}));
	}, [remoteAccessViewerFrameUrl, iframeSrc, shouldLoadIframe]);

	useEffect(() => {
		function handleMessage(event: MessageEvent) {
			if (isRemoteAccessFrameLoad(event, iframeRef.current)) {
				const loadedUrl = new URL(event.data.href);
				setIframeHasLoaded(true);
				syncDesktopUrlFromScopedUrl(event.data.href);
				setRelayDiagnostics((current) => ({
					...current,
					iframe:
						current.requests > 0 || current.intercepted > 0
							? `Loaded ${loadedUrl.pathname}`
							: 'Load event before relay request',
					lastPath: event.data.href,
				}));
				setStatus('connected');
				return;
			}
			if (!isMessageFromIframeTree(event, iframeRef.current)) {
				return;
			}
			if (event.origin !== window.location.origin) {
				return;
			}
			const frameMessage = unwrapRemoteAccessFrameMessage(event);
			const data = frameMessage?.payload ?? event.data;
			if (
				typeof data !== 'object' ||
				data === null ||
				data.type !== 'relay' ||
				data.relayType !== 'install-blueprint'
			) {
				return;
			}

			setUnsupportedMessage(
				'Installing apps from remote access is not available yet. Use Site Tools on the host device to install this app.'
			);
			setNoticeCanRetry(false);
			postUnsupportedInstallBlueprintResult(event, data, frameMessage);
		}

		window.addEventListener('message', handleMessage);
		return () => window.removeEventListener('message', handleMessage);
	}, []);

	const handleIframeLoad = useCallback(() => {
		if (!iframeRef.current?.src.includes(remoteAccessFrameUrl)) {
			return;
		}
		setRelayDiagnostics((current) => ({
			...current,
			iframe: 'Frame loaded',
		}));
	}, []);

	const restartConnection = useCallback(
		(label: string) => {
			setStatus('connecting');
			setError(null);
			setUnsupportedMessage(null);
			setNoticeCanRetry(false);
			setApprovalPending(false);
			setDataChannelReady(false);
			setIframeHasLoaded(false);
			setIframeSrc('about:blank');
			setConnectionAttempt((current) => current + 1);
			setTimeout(() => {
				if (shouldLoadIframe) {
					setIframeSrc(
						buildRemoteAccessViewerFrameUrl(
							buildRemoteAccessScopedIframeUrl(
								getRemoteAccessPathFromConnectUrl(
									window.location.href
								),
								sessionId,
								{ scope: REMOTE_ACCESS_RELAY_SCOPE }
							)
						)
					);
				}
			}, 0);
			setRelayDiagnostics((current) => ({
				...current,
				dataChannel: label,
				iframe: shouldLoadIframe ? 'Reloading' : 'Waiting',
				lastError: '-',
			}));
		},
		[sessionId, shouldLoadIframe]
	);

	const retry = () => {
		restartConnection('Retrying');
	};

	const disconnect = () => {
		clearRemoteAccessRelay();
		window.location.href = '/connect';
	};

	const downloadBackup = async () => {
		const directTunnel = directTunnelRef.current;
		if (!directTunnel || isDownloadingBackup) {
			return;
		}
		setIsDownloadingBackup(true);
		setUnsupportedMessage(null);
		setNoticeCanRetry(false);
		try {
			const backup = await directTunnel.downloadBackup();
			saveAs(new File([backup.bytes], backup.filename));
		} catch (error) {
			setUnsupportedMessage(
				`Could not download backup: ${
					error instanceof Error ? error.message : String(error)
				}`
			);
			setNoticeCanRetry(true);
		} finally {
			setIsDownloadingBackup(false);
		}
	};

	return (
		<div className={css.viewer}>
			<header className={css.banner}>
				<div className={css.bannerTitle}>
					<strong>Using My WordPress from the host device</strong>
				</div>
				<div className={css.bannerActions}>
					<button
						type="button"
						className={css.backupButton}
						onClick={downloadBackup}
						disabled={status !== 'connected' || isDownloadingBackup}
					>
						{isDownloadingBackup
							? 'Downloading backup...'
							: 'Download backup'}
					</button>
					<ConnectionPill
						status={status}
						title={relayDiagnosticsTitle}
						onDisconnect={disconnect}
					/>
				</div>
			</header>
			{unsupportedMessage ? (
				<div className={css.unsupportedNotice} role="status">
					<span>{unsupportedMessage}</span>
					<div className={css.unsupportedNoticeActions}>
						{noticeCanRetry ? (
							<button type="button" onClick={retry}>
								Retry connection
							</button>
						) : null}
						<button
							type="button"
							onClick={() => {
								setUnsupportedMessage(null);
								setNoticeCanRetry(false);
							}}
						>
							Dismiss
						</button>
					</div>
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

			{(status === 'connecting' && !iframeHasLoaded) ||
			(status === 'connected' && !shouldLoadIframe) ? (
				<div className={css.centerNotice} role="status">
					<h1>Connecting to the host device</h1>
					<p>
						{approvalPending
							? 'Enter this code on the host device to approve remote access.'
							: dataChannelReady
								? 'Preparing remote access.'
								: 'This window will show the WordPress that is running on the host device.'}
					</p>
					{approvalPending ? (
						<div className={css.verificationCode}>
							{formatVerificationCode(verificationCode)}
						</div>
					) : null}
				</div>
			) : null}

			{status !== 'error' ? (
				<div className={css.iframeWrapper}>
					<iframe
						ref={iframeRef}
						src={iframeSrc}
						className={css.iframe}
						onLoad={handleIframeLoad}
						title="My WordPress from host device"
						style={{
							opacity:
								(iframeHasLoaded && shouldLoadIframe) ||
								status === 'host-disconnected'
									? 1
									: 0,
						}}
					/>
					{status === 'host-disconnected' ? (
						<div className={css.disconnectedOverlay}>
							<div className={css.disconnectedCard}>
								<h1>Host device disconnected</h1>
								<p>
									The last page is preserved, but new actions
									need the host device to reconnect.
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

function buildRemoteAccessViewerFrameUrl(scopedUrl: string): string {
	const url = new URL(remoteAccessFrameUrl, window.location.href);
	url.searchParams.set('src', scopedUrl);
	return url.toString();
}

function postUnsupportedInstallBlueprintResult(
	event: MessageEvent,
	data: { blueprintUrl?: unknown; requestId?: unknown },
	frameMessage: RemoteAccessFrameMessage | null
) {
	if (!event.source) {
		return;
	}
	const result = {
		type: 'relay',
		relayType: 'install-blueprint-result',
		blueprintUrl:
			typeof data.blueprintUrl === 'string' ? data.blueprintUrl : '',
		requestId:
			typeof data.requestId === 'string' ? data.requestId : undefined,
		status: 'error',
		error: 'Installing apps from remote access is not available yet.',
	};
	(event.source as Window).postMessage(
		frameMessage
			? {
					type: 'remote-access-frame-forward',
					payload: result,
				}
			: result,
		event.origin
	);
}

function isRemoteAccessFrameLoad(
	event: MessageEvent,
	iframe: HTMLIFrameElement | null
): event is MessageEvent<{ type: 'remote-access-frame-load'; href: string }> {
	return (
		event.origin === window.location.origin &&
		event.source === iframe?.contentWindow &&
		typeof event.data === 'object' &&
		event.data !== null &&
		event.data.type === 'remote-access-frame-load' &&
		typeof event.data.href === 'string'
	);
}

function unwrapRemoteAccessFrameMessage(
	event: MessageEvent
): RemoteAccessFrameMessage | null {
	if (
		typeof event.data !== 'object' ||
		event.data === null ||
		event.data.type !== 'remote-access-frame-message'
	) {
		return null;
	}
	return event.data as RemoteAccessFrameMessage;
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

export function getRemoteAccessSessionId(): string | null {
	return getRemoteAccessSessionIdFromUrl(window.location.href);
}

function clearRemoteAccessRelay() {
	clearRemoteAccessRelayMapping(REMOTE_ACCESS_RELAY_SCOPE);
}

function syncDesktopUrlFromScopedUrl(scopedUrl: string) {
	try {
		const nextUrl = buildConnectUrlFromScopedIframeUrl(
			scopedUrl,
			window.location.href,
			{ scope: REMOTE_ACCESS_RELAY_SCOPE }
		);
		if (!nextUrl) {
			return;
		}
		if (nextUrl !== window.location.href) {
			window.history.replaceState({}, '', nextUrl);
		}
	} catch {
		// Ignore cross-document timing gaps while the iframe is navigating.
	}
}

function formatRelayDiagnosticsTitle(diagnostics: RelayDiagnostics) {
	return [
		`SW: ${diagnostics.serviceWorker}`,
		`Channel: ${diagnostics.dataChannel}`,
		`Frame: ${diagnostics.iframe}`,
		`Requests: ${diagnostics.requests}`,
		`Intercepted: ${diagnostics.intercepted}`,
		`Pending: ${diagnostics.pending}`,
		`Last: ${diagnostics.lastPath}`,
		`Error: ${diagnostics.lastError}`,
	].join('\n');
}

function ConnectionPill({
	status,
	title,
	onDisconnect,
}: {
	status: ConnectionStatus;
	title: string;
	onDisconnect: () => void;
}) {
	const label =
		status === 'connected'
			? 'Connected'
			: status === 'host-disconnected'
				? 'Host device disconnected'
				: status === 'error'
					? 'Connection error'
					: 'Connecting';

	if (status === 'connected') {
		return (
			<button
				type="button"
				className={`${css.statusPill} ${css.statusPillButton}`}
				onClick={onDisconnect}
				title={title}
				aria-label="Disconnect remote access"
			>
				<span className={css.statusPillLabel}>{label}</span>
				<span className={css.statusPillHoverLabel}>Disconnect</span>
			</button>
		);
	}

	return (
		<span className={css.statusPill} title={title}>
			{label}
		</span>
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

function generateVerificationCode(): string {
	const value = crypto.getRandomValues(new Uint32Array(1))[0] % 100;
	return value.toString().padStart(2, '0');
}

function formatVerificationCode(value: string): string {
	return value;
}
