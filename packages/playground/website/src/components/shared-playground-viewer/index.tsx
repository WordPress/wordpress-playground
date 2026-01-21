import { useEffect, useState, useCallback, useRef } from 'react';
import css from './style.module.css';

interface SharedPlaygroundViewerProps {
	sessionId: string;
}

type ConnectionStatus = 'connecting' | 'connected' | 'error' | 'disconnected';

export function SharedPlaygroundViewer({
	sessionId,
}: SharedPlaygroundViewerProps) {
	const [status, setStatus] = useState<ConnectionStatus>('connecting');
	const [error, setError] = useState<string | null>(null);
	const iframeRef = useRef<HTMLIFrameElement>(null);

	// The relay request URL for this session
	const relayBaseUrl = `${window.location.origin}/relay/${sessionId}/request`;

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
			} catch (err) {
				setError(
					'Unable to connect to the shared Playground. Please check your connection.'
				);
				setStatus('error');
			}
		};

		checkSession();
	}, [relayBaseUrl]);

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

			{(status === 'connected' || status === 'connecting') && (
				<iframe
					ref={iframeRef}
					src={`${relayBaseUrl}/`}
					className={css.iframe}
					onLoad={handleIframeLoad}
					title="Shared WordPress Playground"
					style={{
						opacity: status === 'connected' ? 1 : 0,
					}}
				/>
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
