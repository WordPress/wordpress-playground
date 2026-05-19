import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
	// Host was reachable at least once but has since stopped polling.
	| 'host-disconnected';

const STATUS_POLL_INTERVAL_MS = 3000;

export function SharedPlaygroundViewer({
	sessionId,
}: SharedPlaygroundViewerProps) {
	const [status, setStatus] = useState<ConnectionStatus>('connecting');
	const [error, setError] = useState<string | null>(null);
	const iframeRef = useRef<HTMLIFrameElement>(null);

	// We tag every status fetch with our per-tab guest id so the relay
	// can build the host-side collaborator list. The status endpoint
	// doubles as the heartbeat — no separate ping needed.
	const guestId = useRef<string>(getOrCreateGuestId()).current;

	// Memoise the URLs so they keep referential identity across
	// renders. Otherwise the polling effect's dependency would change
	// on every state update, the effect would tear down and re-run,
	// and a fresh tick would fire on top of every state change —
	// stacking up overlapping /status fetches that never get awaited.
	const relayBaseUrl = useMemo(
		() => `${window.location.origin}/relay/${sessionId}/request`,
		[sessionId]
	);
	const statusUrl = useMemo(
		() =>
			`${window.location.origin}/relay/${sessionId}/status?gid=${encodeURIComponent(
				guestId
			)}`,
		[sessionId, guestId]
	);

	// One self-scheduling loop drives the entire connection lifecycle.
	// We do an initial /request/ probe to confirm the session is real
	// and the host is reachable, then poll /status with a strict
	// "wait for the previous fetch before scheduling the next one"
	// rhythm so requests can never overlap or stack up. Both phases
	// share a single AbortController so unmounting cleanly cancels
	// any in-flight fetch instead of leaving it to the network layer.
	useEffect(() => {
		const controller = new AbortController();
		let cancelled = false;
		let sawHostAlive = false;
		let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

		const scheduleNextPoll = () => {
			if (cancelled) {
				return;
			}
			timeoutHandle = setTimeout(pollOnce, STATUS_POLL_INTERVAL_MS);
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
					setError(
						'This sharing session has expired or does not exist.'
					);
					setStatus('error');
					return;
				}
				if (!res.ok) {
					scheduleNextPoll();
					return;
				}
				const data = (await res.json()) as SessionStatusResponse;
				if (cancelled) {
					return;
				}
				if (data.hostAlive) {
					sawHostAlive = true;
				} else if (sawHostAlive) {
					// Host was reachable before, now it's gone. This is
					// the disconnect case we want to surface clearly.
					setStatus('host-disconnected');
					return;
				}
			} catch (err) {
				if ((err as { name?: string })?.name === 'AbortError') {
					return;
				}
				// Transient network hiccup — try again on the next tick.
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
					sawHostAlive = true;
				} else if (response.status === 503) {
					setError(
						'The host is not connected. Please try again later.'
					);
					setStatus('error');
					return;
				} else if (response.status === 404) {
					setError(
						'This sharing session has expired or does not exist.'
					);
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
				setError(
					'Unable to connect to the shared Playground. Please check your connection.'
				);
				setStatus('error');
				return;
			}
			// Probe finished successfully — start polling /status.
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
