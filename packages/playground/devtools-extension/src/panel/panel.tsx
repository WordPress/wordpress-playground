import { useEffect, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { PlaygroundFileEditor } from '@wp-playground/components';
import type { AsyncWritableFilesystem } from '@wp-playground/storage';
import styles from './panel.module.css';

interface PlaygroundFrame {
	frameId: number;
	tabId: number;
	url: string;
	hasPlayground: boolean;
	documentRoot?: string;
}

/**
 * Creates an AsyncWritableFilesystem that proxies calls through the
 * Chrome extension messaging system to the content script.
 */
function createPlaygroundFilesystem(
	port: chrome.runtime.Port,
	frameId: number
): AsyncWritableFilesystem {
	let requestId = 0;
	const pendingRequests = new Map<
		number,
		{ resolve: (value: unknown) => void; reject: (error: Error) => void }
	>();

	// Handle responses from the background script
	port.onMessage.addListener((message) => {
		if (message.type === 'METHOD_RESULT') {
			const pending = pendingRequests.get(message.requestId);
			if (pending) {
				pendingRequests.delete(message.requestId);
				if (message.error) {
					pending.reject(new Error(message.error));
				} else {
					// Handle Uint8Array reconstruction
					let result = message.result;
					if (result && result.__type === 'Uint8Array') {
						result = new Uint8Array(result.data);
					}
					pending.resolve(result);
				}
			}
		}
	});

	function callMethod<T>(method: string, args: unknown[]): Promise<T> {
		return new Promise((resolve, reject) => {
			const id = requestId++;
			pendingRequests.set(id, {
				resolve: resolve as (value: unknown) => void,
				reject,
			});
			port.postMessage({
				type: 'EXECUTE_METHOD',
				frameId,
				method,
				args,
				requestId: id,
			});
		});
	}

	// Create the filesystem proxy object that implements AsyncWritableFilesystem
	const filesystem: AsyncWritableFilesystem = {
		// EventTarget methods (no-op for now, could be implemented if needed)
		addEventListener: () => {},
		removeEventListener: () => {},
		dispatchEvent: () => true,

		// Filesystem methods
		isDir: (path: string) => callMethod<boolean>('isDir', [path]),

		fileExists: (path: string) => callMethod<boolean>('fileExists', [path]),

		listFiles: (path: string) => callMethod<string[]>('listFiles', [path]),

		read: async (path: string) => {
			const result = await callMethod<Uint8Array>('readFileAsBuffer', [
				path,
			]);
			return {
				arrayBuffer: async () => result.buffer,
			};
		},

		readFileAsText: (path: string) =>
			callMethod<string>('readFileAsText', [path]),

		writeFile: (path: string, data: string | Uint8Array) => {
			// Convert Uint8Array to array for JSON serialization
			const serializedData =
				data instanceof Uint8Array ? Array.from(data) : data;
			return callMethod<void>('writeFile', [path, serializedData]);
		},

		mkdir: (path: string, options?: { recursive?: boolean }) =>
			callMethod<void>('mkdir', [path, options]),

		rmdir: (path: string, options?: { recursive?: boolean }) =>
			callMethod<void>('rmdir', [path, options]),

		mv: (source: string, destination: string) =>
			callMethod<void>('mv', [source, destination]),

		unlink: (path: string) => callMethod<void>('unlink', [path]),
	};

	return filesystem;
}

function PlaygroundPanel() {
	const [frames, setFrames] = useState<PlaygroundFrame[]>([]);
	const [selectedFrame, setSelectedFrame] = useState<PlaygroundFrame | null>(
		null
	);
	const [filesystem, setFilesystem] =
		useState<AsyncWritableFilesystem | null>(null);
	const [isConnected, setIsConnected] = useState(false);
	const portRef = useRef<chrome.runtime.Port | null>(null);
	const refreshIntervalRef = useRef<number | null>(null);

	// Connect to the background script and set up frame detection
	useEffect(() => {
		const port = chrome.runtime.connect({ name: 'playground-devtools' });
		portRef.current = port;

		// Initialize with the current tab ID
		const tabId = chrome.devtools.inspectedWindow.tabId;
		port.postMessage({ type: 'INIT', tabId });
		setIsConnected(true);

		// Handle messages from the background script
		port.onMessage.addListener((message) => {
			if (message.type === 'FRAMES_UPDATED') {
				setFrames(message.frames);

				// Auto-select if there's only one playground frame
				if (message.frames.length === 1 && !selectedFrame) {
					setSelectedFrame(message.frames[0]);
				}
			}
		});

		// Request initial frame refresh
		port.postMessage({ type: 'REFRESH_FRAMES' });

		// Set up periodic refresh every second
		refreshIntervalRef.current = window.setInterval(() => {
			port.postMessage({ type: 'REFRESH_FRAMES' });
		}, 1000);

		port.onDisconnect.addListener(() => {
			setIsConnected(false);
			if (refreshIntervalRef.current) {
				clearInterval(refreshIntervalRef.current);
			}
		});

		return () => {
			if (refreshIntervalRef.current) {
				clearInterval(refreshIntervalRef.current);
			}
			port.disconnect();
		};
	}, []);

	// Create filesystem when a frame is selected
	useEffect(() => {
		if (!selectedFrame || !portRef.current) {
			setFilesystem(null);
			return;
		}

		const fs = createPlaygroundFilesystem(
			portRef.current,
			selectedFrame.frameId
		);
		setFilesystem(fs);
	}, [selectedFrame]);

	// Handle frame selection change
	const handleFrameSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const frameId = parseInt(e.target.value, 10);
		const frame = frames.find((f) => f.frameId === frameId);
		setSelectedFrame(frame ?? null);
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
