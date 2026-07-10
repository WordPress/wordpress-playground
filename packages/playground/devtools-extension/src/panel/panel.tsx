import { useEffect, useMemo, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { PlaygroundFileEditor } from '@wp-playground/components';
import {
	createMethodDispatcher,
	createPlaygroundFilesystem,
	type MethodDispatcher,
} from './playground-filesystem';
import styles from './panel.module.css';

interface PlaygroundFrame {
	frameId: number;
	documentId: string;
	tabId: number;
	url: string;
	hasPlayground: boolean;
	documentRoot?: string;
	playgroundGeneration: string;
}

function PlaygroundPanel() {
	const [frames, setFrames] = useState<PlaygroundFrame[]>([]);
	const [selectedFrameId, setSelectedFrameId] = useState<number | null>(null);
	const [isConnected, setIsConnected] = useState(false);
	const dispatcherRef = useRef<MethodDispatcher | null>(null);
	const framesRef = useRef<PlaygroundFrame[]>([]);
	const refreshIntervalRef = useRef<number | null>(null);
	const selectedFrame =
		frames.find((frame) => frame.frameId === selectedFrameId) ?? null;
	const filesystem = useMemo(() => {
		if (!selectedFrame || !dispatcherRef.current) {
			return null;
		}
		return createPlaygroundFilesystem(dispatcherRef.current, {
			frameId: selectedFrame.frameId,
			documentId: selectedFrame.documentId,
			playgroundGeneration: selectedFrame.playgroundGeneration,
		});
	}, [
		selectedFrame?.frameId,
		selectedFrame?.documentId,
		selectedFrame?.playgroundGeneration,
	]);

	// Connect to the background script and set up frame detection
	useEffect(() => {
		const port = chrome.runtime.connect({ name: 'playground-devtools' });
		const dispatcher = createMethodDispatcher(port);
		dispatcherRef.current = dispatcher;

		// Initialize with the current tab ID
		const tabId = chrome.devtools.inspectedWindow.tabId;
		port.postMessage({ type: 'INIT', tabId });
		setIsConnected(true);

		// Handle messages from the background script
		port.onMessage.addListener((message) => {
			if (message.type === 'FRAMES_UPDATED') {
				const nextFrames = message.frames as PlaygroundFrame[];
				for (const currentFrame of framesRef.current) {
					const nextFrame = nextFrames.find(
						(frame) => frame.frameId === currentFrame.frameId
					);
					if (
						!nextFrame ||
						nextFrame.documentId !== currentFrame.documentId ||
						nextFrame.playgroundGeneration !==
							currentFrame.playgroundGeneration
					) {
						dispatcher.invalidateTarget({
							frameId: currentFrame.frameId,
							documentId: currentFrame.documentId,
							playgroundGeneration:
								currentFrame.playgroundGeneration,
						});
					}
				}
				framesRef.current = nextFrames;
				setFrames(nextFrames);
				// Preserve selection across refreshes and auto-select the only frame.
				setSelectedFrameId((currentFrameId) => {
					if (
						currentFrameId !== null &&
						nextFrames.some(
							(frame) => frame.frameId === currentFrameId
						)
					) {
						return currentFrameId;
					}
					return nextFrames.length === 1
						? nextFrames[0].frameId
						: null;
				});
			}
		});

		// Request initial frame refresh
		port.postMessage({ type: 'REFRESH_FRAMES' });

		// Set up periodic refresh every second
		refreshIntervalRef.current = window.setInterval(() => {
			port.postMessage({ type: 'REFRESH_FRAMES' });
		}, 1000);

		port.onDisconnect.addListener(() => {
			dispatcher.dispose();
			setIsConnected(false);
			if (refreshIntervalRef.current) {
				clearInterval(refreshIntervalRef.current);
			}
		});

		return () => {
			if (refreshIntervalRef.current) {
				clearInterval(refreshIntervalRef.current);
			}
			dispatcher.dispose();
			port.disconnect();
		};
	}, []);

	// Handle frame selection change
	const handleFrameSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const frameId = parseInt(e.target.value, 10);
		const frame = frames.find((f) => f.frameId === frameId);
		setSelectedFrameId(frame?.frameId ?? null);
	};

	// If not connected, show error
	if (!isConnected) {
		return (
			<div className={styles.container}>
				<div className={styles.message}>
					<h2>Connection Lost</h2>
					<p>
						The connection to the page was lost. Please refresh the
						DevTools panel.
					</p>
				</div>
			</div>
		);
	}

	// If no playground frames found
	if (frames.length === 0) {
		return (
			<div className={styles.container}>
				<div className={styles.message}>
					<h2>No WordPress Playground Found</h2>
					<p>
						No <code>window.playground</code> instances were
						detected on this page.
					</p>
					<p>
						Make sure you're viewing a page that contains a
						WordPress Playground instance.
					</p>
					<p className={styles.hint}>
						Scanning for playground instances...
					</p>
				</div>
			</div>
		);
	}

	const documentRoot = selectedFrame?.documentRoot || '/wordpress';

	return (
		<div className={styles.container}>
			{frames.length > 1 && (
				<div className={styles.frameSelector}>
					<label htmlFor="frame-select">Playground instance:</label>
					<select
						id="frame-select"
						value={selectedFrame?.frameId ?? ''}
						onChange={handleFrameSelect}
					>
						<option value="">Select a playground...</option>
						{frames.map((frame) => (
							<option key={frame.frameId} value={frame.frameId}>
								{frame.url.length > 60
									? frame.url.substring(0, 60) + '...'
									: frame.url}
								{frame.frameId === 0
									? ' (main frame)'
									: ` (frame ${frame.frameId})`}
							</option>
						))}
					</select>
				</div>
			)}
			{selectedFrame ? (
				<div className={styles.browserContainer}>
					<PlaygroundFileEditor
						filesystem={filesystem}
						documentRoot={documentRoot}
						placeholderText="Select a file to view or edit."
					/>
				</div>
			) : (
				<div className={styles.message}>
					<p>
						Select a playground instance above to browse its files.
					</p>
				</div>
			)}
		</div>
	);
}

// Mount the React app
const container = document.getElementById('root');
if (container) {
	const root = createRoot(container);
	root.render(<PlaygroundPanel />);
}
