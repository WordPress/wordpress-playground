import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import css from './style.module.css';
import type { SessionStatusResponse } from '../../lib/relay-server/types';

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

const STATUS_POLL_INTERVAL_MS = 3000;
const GUEST_ID_STORAGE_KEY = 'personal-wp-desktop-access-guest-id';
const DESKTOP_RELAY_SCOPE = 'default';
const DESKTOP_RELAY_SCOPED_URL = `/scope:${DESKTOP_RELAY_SCOPE}/`;
const SERVICE_WORKER_RELAY_TTL_MS = 5 * 60 * 1000;
const SERVICE_WORKER_RELAY_REFRESH_MS = 60 * 1000;

export function DesktopAccessViewer({ sessionId }: DesktopAccessViewerProps) {
	const [status, setStatus] = useState<ConnectionStatus>('connecting');
	const [error, setError] = useState<string | null>(null);
	const [unsupportedMessage, setUnsupportedMessage] = useState<string | null>(
		null
	);
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const guestId = useRef(getOrCreateGuestId()).current;

	const relayBaseUrl = useMemo(
		() => `${window.location.origin}/relay/${sessionId}/request`,
		[sessionId]
	);
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

		const probeSession = async () => {
			try {
				const response = await fetch(`${relayBaseUrl}/`, {
					method: 'GET',
					headers: { Accept: 'text/html' },
					signal: controller.signal,
				});
				if (cancelled) {
					return;
				}
				if (response.ok) {
					setStatus('connected');
					sawPhoneAlive = true;
				} else if (response.status === 503) {
					setError(
						'The phone is not connected. Keep my.wordpress.net open on your phone and try again.'
					);
					setStatus('error');
					return;
				} else if (response.status === 404) {
					setError('This desktop access link has expired.');
					setStatus('error');
					return;
				} else {
					setError(`Connection failed: ${response.statusText}`);
					setStatus('error');
					return;
				}
			} catch (err) {
				if ((err as { name?: string })?.name === 'AbortError') {
					return;
				}
				setError('Unable to connect to your phone.');
				setStatus('error');
				return;
			}
			pollOnce();
		};

		probeSession();

		return () => {
			cancelled = true;
			controller.abort();
			if (timeoutHandle !== null) {
				clearTimeout(timeoutHandle);
			}
		};
	}, [relayBaseUrl, statusUrl]);

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
			const registration = await navigator.serviceWorker.register(
				serviceWorkerUrl,
				{
					type: 'module',
					updateViaCache: 'none',
				}
			);
			await navigator.serviceWorker.ready;

			if (cancelled) {
				return;
			}
			postDesktopRelayMapping(registration);
			interval = setInterval(
				() => postDesktopRelayMapping(registration),
				SERVICE_WORKER_RELAY_REFRESH_MS
			);
			registration.update().catch(() => {});
		};

		const postDesktopRelayMapping = (
			registration: ServiceWorkerRegistration
		) => {
			const worker =
				navigator.serviceWorker.controller || registration.active;
			worker?.postMessage({
				type: 'desktop-relay-map',
				scope: DESKTOP_RELAY_SCOPE,
				relayBaseUrl,
				ttl: SERVICE_WORKER_RELAY_TTL_MS,
			});
		};

		configureServiceWorker().catch(() => {});

		window.addEventListener('pagehide', clearDesktopRelayMapping);
		return () => {
			cancelled = true;
			if (interval !== null) {
				clearInterval(interval);
			}
			window.removeEventListener('pagehide', clearDesktopRelayMapping);
			clearDesktopRelayMapping();
		};
	}, [relayBaseUrl]);

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
		setStatus('connected');
	}, []);

	const retry = () => {
		setStatus('connecting');
		setError(null);
		if (iframeRef.current) {
			iframeRef.current.src = DESKTOP_RELAY_SCOPED_URL;
		}
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

			{status === 'connecting' ? (
				<div className={css.centerNotice} role="status">
					<h1>Connecting to your phone</h1>
					<p>
						This desktop window will show the WordPress that is
						running on your phone.
					</p>
				</div>
			) : null}

			{status !== 'error' ? (
				<div className={css.iframeWrapper}>
					<iframe
						ref={iframeRef}
						src={DESKTOP_RELAY_SCOPED_URL}
						className={css.iframe}
						onLoad={handleIframeLoad}
						title="My WordPress from phone"
						style={{
							opacity:
								status === 'connected' ||
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
