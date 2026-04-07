import { useEffect, useState, useCallback, useRef } from 'react';
import css from './style.module.css';
import type { SessionStatusResponse } from '../../lib/relay-server/types';

interface SharedPlaygroundViewerProps {
	sessionId: string;
}

/**
 * A stable per-tab UUID. We persist it on `sessionStorage` so a soft
 * reload keeps the same identity, but a brand new tab gets its own —
 * which is exactly the granularity the host wants for the collaborator
 * list ("Guest 1", "Guest 2", …).
 */
function getOrCreateGuestId(): string {
	const KEY = 'wp-playground-share-guest-id';
	try {
		const existing = sessionStorage.getItem(KEY);
		if (existing) {
			return existing;
		}
		const fresh = crypto.randomUUID();
		sessionStorage.setItem(KEY, fresh);
		return fresh;
	} catch {
		// sessionStorage may be unavailable (e.g. cookies blocked) — fall
		// back to an in-memory id, which is fine for the duration of the
		// page load.
		return crypto.randomUUID();
	}
}

type ConnectionStatus =
	| 'connecting'
	| 'connected'
	| 'error'
	| 'disconnected'
	// Host was reachable at least once but has since stopped polling.
	| 'host-disconnected';

export function SharedPlaygroundViewer({
	sessionId,
}: SharedPlaygroundViewerProps) {
	const [status, setStatus] = useState<ConnectionStatus>('connecting');
	const [error, setError] = useState<string | null>(null);
	const iframeRef = useRef<HTMLIFrameElement>(null);

	// The relay request URL for this session
	const relayBaseUrl = `${window.location.origin}/relay/${sessionId}/request`;
	// We tag every status fetch with our per-tab guest id so the relay
	// can build the host-side collaborator list. The status endpoint
	// doubles as the heartbeat — no separate ping needed.
	const guestId = useRef<string>(getOrCreateGuestId()).current;
	const statusUrl = `${window.location.origin}/relay/${sessionId}/status?gid=${encodeURIComponent(
		guestId
	)}`;

	// Check if the session is valid by making a test request
	useEffect(() => {
		const checkSession = async () => {
			try {
				// Try to reach the host through the relay
				const response = await fetch(`${relayBaseUrl}/`, {
					method: 'GET',
					headers: {
						Accept: 'text/html',
					},
				});

				if (response.ok) {
					setStatus('connected');
				} else if (response.status === 503) {
					setError('The host is not connected. Please try again later.');
					setStatus('error');
				} else if (response.status === 404) {
					setError('This sharing session has expired or does not exist.');
					setStatus('error');
				} else {
					setError(`Connection failed: ${response.statusText}`);
					setStatus('error');
				}
			} catch {
				setError(
					'Unable to connect to the shared Playground. Please check your connection.'
				);
				setStatus('error');
			}
		};

		checkSession();
	}, [relayBaseUrl]);

	// Poll the relay's session status endpoint so we can flip to a
	// "host disconnected" state as soon as the host stops polling,
	// instead of waiting for an iframe request to time out.
	useEffect(() => {
		let cancelled = false;
		let sawHostAlive = false;

		const tick = async () => {
			try {
				const res = await fetch(statusUrl);
				if (cancelled) return;
				if (res.status === 404) {
					setError(
						'This sharing session has expired or does not exist.'
					);
					setStatus('error');
					return;
				}
				if (!res.ok) return;
				const data = (await res.json()) as SessionStatusResponse;
				if (cancelled) return;
				if (data.hostAlive) {
					sawHostAlive = true;
				} else if (sawHostAlive) {
					// Host was reachable before, now it's gone. This is the
					// disconnect case we want to surface clearly.
					setStatus('host-disconnected');
				}
			} catch {
				// network hiccup — ignore, we'll retry on the next tick
			}
		};

		tick();
		const interval = setInterval(tick, 3000);
		return () => {
			cancelled = true;
			clearInterval(interval);
		};
	}, [statusUrl]);

	const handleIframeLoad = useCallback(() => {
		setStatus('connected');
	}, []);

	const handleRetry = () => {
		setStatus('connecting');
		setError(null);
		// Force iframe reload
		if (iframeRef.current) {
			iframeRef.current.src = `${relayBaseUrl}/`;
		}
	};

	return (
		<div className={css.sharedPlaygroundViewer}>
			<div className={css.banner}>
				<div className={css.bannerContent}>
					<span className={css.bannerIcon}>👁️</span>
					<span className={css.bannerText}>
						Viewing a shared Playground
					</span>
					{status === 'connected' && (
						<span className={css.statusConnected}>● Connected</span>
					)}
					{status === 'connecting' && (
						<span className={css.statusConnecting}>
							● Connecting...
						</span>
					)}
					{status === 'host-disconnected' && (
						<span className={css.statusDisconnected}>
							● Host disconnected
						</span>
					)}
				</div>
				<a
					href="/"
					className={css.createOwnButton}
				>
					Create your own Playground
				</a>
			</div>

			{status === 'error' && error && (
				<div className={css.errorContainer}>
					<div className={css.errorContent}>
						<h2>Unable to Connect</h2>
						<p>{error}</p>
						<div className={css.errorActions}>
							<button
								onClick={handleRetry}
								className={css.retryButton}
							>
								Try Again
							</button>
							<a href="/" className={css.homeLink}>
								Go to Playground
							</a>
						</div>
					</div>
				</div>
			)}

			{status === 'connecting' && (
				<div className={css.loadingContainer}>
					<div className={css.loadingContent}>
						<div className={css.spinner}></div>
						<p>Connecting to shared Playground...</p>
					</div>
				</div>
			)}

			{(status === 'connected' ||
				status === 'connecting' ||
				status === 'host-disconnected') && (
				<div className={css.iframeWrapper}>
					<iframe
						ref={iframeRef}
						src={`${relayBaseUrl}/`}
						className={css.iframe}
						onLoad={handleIframeLoad}
						title="Shared WordPress Playground"
						style={{
							opacity:
								status === 'connected' ||
								status === 'host-disconnected'
									? 1
									: 0,
						}}
					/>
					{status === 'host-disconnected' && (
						<div className={css.disconnectedOverlay}>
							<div className={css.disconnectedCard}>
								<h2>Host disconnected</h2>
								<p>
									The person sharing this Playground closed
									their tab. The session is frozen at its
									last state and new actions won't work
									until they come back.
								</p>
								<div className={css.errorActions}>
									<a href="/" className={css.retryButton}>
										Create your own Playground
									</a>
								</div>
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

/**
 * Check if the current URL contains a share parameter.
 */
export function getShareSessionId(): string | null {
	const params = new URLSearchParams(window.location.search);
	return params.get('share');
}
