import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type MutableRefObject,
} from 'react';
import classNames from 'classnames';
import { Button, Notice } from '@wordpress/components';
import type { SiteInfo } from '../../../lib/state/redux/slice-sites';
import { usePlaygroundClient } from '../../../lib/use-playground-client';
import type { AsyncWritableFilesystem } from '@wp-playground/components';
import type { PlaygroundClient } from '@wp-playground/remote';
import { FileExplorerSidebar } from './file-explorer-sidebar';
import { CodeEditor, type CodeEditorHandle } from './code-editor';
import styles from './style.module.css';
import { DEFAULT_WORKSPACE_DIR, WORDPRESS_ROOT_DIR } from './constants';

const SAVE_DEBOUNCE_MS = 1500;

type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export function SiteFileBrowser({ site }: { site: SiteInfo }) {
	const client = usePlaygroundClient(site.slug);
	const filesystem = useFilesystem(client);

	const [selectedDirPath, setSelectedDirPath] = useState<string | null>(
		DEFAULT_WORKSPACE_DIR
	);
	const [currentPath, setCurrentPath] = useState<string | null>(null);
	const [code, setCode] = useState<string>('');
	const [readOnly, setReadOnly] = useState<boolean>(true);
	const [saveState, setSaveState] = useState<SaveState>('idle');
	const [saveError, setSaveError] = useState<string | null>(null);
	const [showExplorerOnMobile, setShowExplorerOnMobile] =
		useState<boolean>(false);

	const editorRef = useRef<CodeEditorHandle | null>(null);
	const saveTimeoutRef = useRef<number | null>(null);
	const skipNextSaveRef = useRef<boolean>(false);
	const codeRef = useRef<string>(code);
	const currentPathRef = useRef<string | null>(currentPath);
	const clientRef = useRef<PlaygroundClient | null>(client);
	const previousClientRef = useRef<PlaygroundClient | null>(client);

	useEffect(() => {
		codeRef.current = code;
	}, [code]);

	useEffect(() => {
		currentPathRef.current = currentPath;
	}, [currentPath]);

	useEffect(() => {
		clientRef.current = client ?? null;
	}, [client]);

	useEffect(() => {
		if (previousClientRef.current && previousClientRef.current !== client) {
			void flushPendingSave(previousClientRef.current, {
				saveTimeoutRef,
				currentPathRef,
				codeRef,
				setSaveState,
				setSaveError,
			});
		}
		previousClientRef.current = client ?? null;
	}, [client]);

	useEffect(() => {
		return () => {
			void flushPendingSave(clientRef.current, {
				saveTimeoutRef,
				currentPathRef,
				codeRef,
				setSaveState,
				setSaveError,
			});
		};
	}, []);

	useEffect(() => {
		if (!client) {
			skipNextSaveRef.current = true;
			setCode('');
			setCurrentPath(null);
			setReadOnly(true);
			setSaveState('idle');
			setSaveError(null);
			setShowExplorerOnMobile(false);
		}
	}, [client]);

	useEffect(() => {
		setSelectedDirPath(DEFAULT_WORKSPACE_DIR);
		setCurrentPath(null);
		setCode('');
		setReadOnly(true);
		setSaveState('idle');
		setSaveError(null);
		skipNextSaveRef.current = true;
	}, [site.slug]);

	useEffect(() => {
		const activeClient = clientRef.current;
		if (!activeClient || !currentPath) {
			if (saveTimeoutRef.current !== null) {
				window.clearTimeout(saveTimeoutRef.current);
				saveTimeoutRef.current = null;
			}
			if (!currentPath) {
				setSaveState('idle');
			}
			return;
		}
		if (skipNextSaveRef.current) {
			skipNextSaveRef.current = false;
			return;
		}
		if (saveTimeoutRef.current !== null) {
			window.clearTimeout(saveTimeoutRef.current);
			saveTimeoutRef.current = null;
		}
		setSaveState('pending');
		const timeout = window.setTimeout(async () => {
			saveTimeoutRef.current = null;
			setSaveState('saving');
			try {
				await activeClient.writeFile(
					currentPathRef.current as string,
					codeRef.current
				);
				setSaveState('saved');
				setSaveError(null);
			} catch (error) {
				console.error('Failed to save file', error);
				setSaveState('error');
				setSaveError('Could not save changes. Try again.');
			}
		}, SAVE_DEBOUNCE_MS);
		saveTimeoutRef.current = timeout;

		return () => {
			if (saveTimeoutRef.current === timeout) {
				window.clearTimeout(timeout);
				saveTimeoutRef.current = null;
			}
		};
	}, [code, currentPath]);

	useEffect(() => {
		if (saveState !== 'saved') {
			return;
		}
		const timeout = window.setTimeout(() => {
			setSaveState((previous) =>
				previous === 'saved' ? 'idle' : previous
			);
		}, 2000);
		return () => window.clearTimeout(timeout);
	}, [saveState]);

	const handleFileOpened = useCallback(
		async (path: string, content: string, shouldFocus = true) => {
			try {
				await flushPendingSave(clientRef.current, {
					saveTimeoutRef,
					currentPathRef,
					codeRef,
					setSaveState,
					setSaveError,
				});
			} catch {
				// Best-effort save; ignore errors so the new file can still open.
			}
			skipNextSaveRef.current = true;
			setCurrentPath(path);
			setCode(content);
			setReadOnly(false);
			setSaveState('idle');
			setSaveError(null);
			setShowExplorerOnMobile(false);
			if (shouldFocus) {
				editorRef.current?.focus();
			}
		},
		[]
	);

	const handleClearSelection = useCallback(async () => {
		try {
			await flushPendingSave(clientRef.current, {
				saveTimeoutRef,
				currentPathRef,
				codeRef,
				setSaveState,
				setSaveError,
			});
		} catch {
			/* noop */
		}
		skipNextSaveRef.current = true;
		setCurrentPath(null);
		setCode('');
		setReadOnly(true);
		setSaveState('idle');
		setSaveError(null);
	}, []);

	const handleShowMessage = useCallback(async (message: string) => {
		try {
			await flushPendingSave(clientRef.current, {
				saveTimeoutRef,
				currentPathRef,
				codeRef,
				setSaveState,
				setSaveError,
			});
		} catch {
			/* noop */
		}
		skipNextSaveRef.current = true;
		setCurrentPath(null);
		setCode(message);
		setReadOnly(true);
		setSaveState('idle');
		setSaveError(null);
	}, []);

	const handleManualSave = useCallback(() => {
		void flushPendingSave(clientRef.current, {
			saveTimeoutRef,
			currentPathRef,
			codeRef,
			setSaveState,
			setSaveError,
		});
	}, []);

	const saveStatusLabel = getSaveStatusLabel(saveState, saveError);
	const saveStatusClassName = getSaveStatusClassName(saveState, styles);

	if (!client || !filesystem) {
		return (
			<div className={styles.container}>
				<div className={styles.placeholder}>
					Start this Playground to browse and edit its files.
				</div>
			</div>
		);
	}

	return (
		<div className={styles.container}>
			<div
				className={classNames(styles.content, {
					[styles.sidebarOpen]: showExplorerOnMobile,
				})}
			>
				<div
					className={styles.mobileOverlay}
					onClick={() => setShowExplorerOnMobile(false)}
				/>
				<aside className={styles.sidebarWrapper}>
					<FileExplorerSidebar
						filesystem={filesystem}
						currentPath={currentPath}
						selectedDirPath={selectedDirPath}
						setSelectedDirPath={setSelectedDirPath}
						onFileOpened={handleFileOpened}
						onSelectionCleared={handleClearSelection}
						onShowMessage={handleShowMessage}
					/>
				</aside>
				<section className={styles.editorWrapper}>
					<div className={styles.editorHeader}>
						<Button
							className={styles.mobileToggle}
							variant="secondary"
							onClick={() =>
								setShowExplorerOnMobile((previous) => !previous)
							}
						>
							{showExplorerOnMobile
								? 'Hide files'
								: 'Browse files'}
						</Button>
						<div
							className={classNames(styles.editorPath, {
								[styles.editorPathPlaceholder]:
									!currentPath?.length,
							})}
						>
							{currentPath?.length
								? currentPath
								: `Browse files under ${WORDPRESS_ROOT_DIR}`}
						</div>
						<div
							className={classNames(
								styles.saveStatus,
								saveStatusClassName
							)}
						>
							{saveStatusLabel}
						</div>
					</div>
					{saveError ? (
						<div style={{ padding: '8px 16px' }}>
							<Notice status="error" isDismissible={false}>
								{saveError}
							</Notice>
						</div>
					) : null}
					{currentPath || code ? (
						<CodeEditor
							ref={editorRef}
							code={code}
							onChange={setCode}
							currentPath={currentPath}
							className={styles.editor}
							onSaveShortcut={handleManualSave}
							readOnly={readOnly}
						/>
					) : (
						<div className={styles.placeholder}>
							Select a file to view or edit its contents.
						</div>
					)}
				</section>
			</div>
		</div>
	);
}

function useFilesystem(
	client: PlaygroundClient | null
): AsyncWritableFilesystem | null {
	return useMemo(() => {
		if (!client) {
			return null;
		}
		return {
			isDir: (path: string) => client.isDir(path),
			fileExists: (path: string) => client.fileExists(path),
			readFileAsBuffer: (path: string) => client.readFileAsBuffer(path),
			readFileAsText: (path: string) => client.readFileAsText(path),
			listFiles: (path: string) => client.listFiles(path),
			writeFile: (path: string, data: string | Uint8Array) =>
				client.writeFile(path, data),
			mkdir: (path: string) => client.mkdir(path),
			rmdir: (path: string, options?: { recursive?: boolean }) =>
				client.rmdir(path, options),
			mv: (source: string, destination: string) =>
				client.mv(source, destination),
			unlink: (path: string) => client.unlink(path),
		};
	}, [client]);
}

function getSaveStatusLabel(saveState: SaveState, saveError: string | null) {
	switch (saveState) {
		case 'pending':
		case 'saving':
			return 'Saving…';
		case 'saved':
			return 'Saved';
		case 'error':
			return saveError ?? 'Save failed';
		default:
			return '';
	}
}

function getSaveStatusClassName(
	saveState: SaveState,
	styleSheet: typeof styles
) {
	switch (saveState) {
		case 'pending':
			return styleSheet.saveStatusPending;
		case 'saving':
			return styleSheet.saveStatusSaving;
		case 'error':
			return styleSheet.saveStatusError;
		default:
			return undefined;
	}
}

async function flushPendingSave(
	client: PlaygroundClient | null,
	{
		saveTimeoutRef,
		currentPathRef,
		codeRef,
		setSaveState,
		setSaveError,
	}: {
		saveTimeoutRef: MutableRefObject<number | null>;
		currentPathRef: MutableRefObject<string | null>;
		codeRef: MutableRefObject<string>;
		setSaveState: React.Dispatch<React.SetStateAction<SaveState>>;
		setSaveError: React.Dispatch<React.SetStateAction<string | null>>;
	}
) {
	if (saveTimeoutRef.current === null) {
		return;
	}
	if (!client || !currentPathRef.current) {
		window.clearTimeout(saveTimeoutRef.current);
		saveTimeoutRef.current = null;
		return;
	}
	window.clearTimeout(saveTimeoutRef.current);
	saveTimeoutRef.current = null;
	setSaveState('saving');
	try {
		await client.writeFile(currentPathRef.current, codeRef.current);
		setSaveState('saved');
		setSaveError(null);
	} catch (error) {
		console.error('Failed to save file', error);
		setSaveState('error');
		setSaveError('Could not save changes. Try again.');
		throw error;
	}
}
