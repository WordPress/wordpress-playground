import React, { useCallback, useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import { Button, Notice } from '@wordpress/components';
import { check } from '@wordpress/icons';
import type { AsyncWritableFilesystem } from '@wp-playground/storage';
import { FileExplorerSidebar } from './file-explorer-sidebar';
import { CodeEditor, type CodeEditorHandle } from './code-editor';
import styles from './playground-file-editor.module.css';
import { logger } from '@php-wasm/logger';

const SAVE_DEBOUNCE_MS = 1500;

const SaveState = {
	IDLE: 'idle',
	PENDING: 'pending',
	SAVING: 'saving',
	SAVED: 'saved',
	ERROR: 'error',
} as const;

type SaveState = (typeof SaveState)[keyof typeof SaveState];

/**
 * Per-`persistKey` editor state that outlives the component, so closing and
 * reopening the editor restores the last open file and its cursor position.
 */
type PersistedEditorState = {
	path: string | null;
	cursors: Map<string, number>;
};
const persistedEditorStates = new Map<string, PersistedEditorState>();

function getPersistedEditorState(key: string): PersistedEditorState {
	let state = persistedEditorStates.get(key);
	if (!state) {
		state = { path: null, cursors: new Map() };
		persistedEditorStates.set(key, state);
	}
	return state;
}

export type PlaygroundFileEditorProps = {
	filesystem: AsyncWritableFilesystem | null;
	isVisible?: boolean;
	documentRoot: string;
	initialPath?: string | null;
	/**
	 * Opt-in key (e.g. a Playground slug) for remembering the open file and
	 * cursor positions across unmounts. When the host unmounts and remounts
	 * this editor (such as a panel that closes and reopens), passing the same
	 * key reopens the last file at its last cursor position instead of falling
	 * back to `initialPath`. Omit it to keep the default stateless behavior.
	 */
	persistKey?: string;
	placeholderText?: string;
	onSaveFile?: (path: string, content: string) => Promise<void>;
	/**
	 * Called before the filesystem changes, allowing the parent to flush
	 * any pending saves to the old filesystem.
	 */
	onBeforeFilesystemChange?: (
		oldFilesystem: AsyncWritableFilesystem
	) => Promise<void>;
};

/**
 * A reusable file browser component with a file tree on the left and
 * a code editor on the right. Supports auto-save with debouncing,
 * cursor position preservation, and binary file handling.
 */
export function PlaygroundFileEditor({
	filesystem,
	isVisible = true,
	documentRoot,
	initialPath = null,
	persistKey,
	placeholderText = 'Select a file to view or edit its contents.',
	onSaveFile,
	onBeforeFilesystemChange,
}: PlaygroundFileEditorProps) {
	const persistedState = persistKey
		? getPersistedEditorState(persistKey)
		: null;
	const [selectedDirPath, setSelectedDirPath] = useState<string | null>(
		documentRoot
	);
	const [currentPath, setCurrentPath] = useState<string | null>(null);
	const [code, setCode] = useState<string>('');
	const [readOnly, setReadOnly] = useState<boolean>(true);
	const [saveState, setSaveState] = useState<SaveState>(SaveState.IDLE);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [showExplorerOnMobile, setShowExplorerOnMobile] =
		useState<boolean>(false);
	const [messageContent, setMessageContent] = useState<
		string | JSX.Element | null
	>(null);

	const editorRef = useRef<CodeEditorHandle | null>(null);
	const saveTimeoutRef = useRef<number | null>(null);
	const skipNextSaveRef = useRef<boolean>(false);
	const codeRef = useRef<string>(code);
	const currentPathRef = useRef<string | null>(currentPath);
	const filesystemRef = useRef<AsyncWritableFilesystem | null>(filesystem);
	const onSaveFileRef = useRef(onSaveFile);
	const previousFilesystemRef = useRef<AsyncWritableFilesystem | null>(null);
	// Cursor positions live in the persisted state (when a persistKey is given)
	// so they survive unmounts; otherwise they're a plain per-instance map.
	const cursorPositionsRef = useRef<Map<string, number>>(
		persistedState?.cursors ?? new Map()
	);
	const hasAutoOpenedRef = useRef<boolean>(false);
	// True while we're restoring a saved cursor on (re)open, so the periodic
	// save doesn't clobber the persisted position with the editor's initial 0
	// before the restore has a chance to apply it.
	const restoringCursorRef = useRef<boolean>(false);

	// Re-point the cursor map if the persistKey changes (e.g. a different
	// Playground) so we never write one site's cursors into another's state.
	useEffect(() => {
		if (persistedState) {
			cursorPositionsRef.current = persistedState.cursors;
		}
	}, [persistedState]);

	useEffect(() => {
		codeRef.current = code;
	}, [code]);

	useEffect(() => {
		currentPathRef.current = currentPath;
	}, [currentPath]);

	useEffect(() => {
		filesystemRef.current = filesystem;
	}, [filesystem]);

	useEffect(() => {
		onSaveFileRef.current = onSaveFile;
	}, [onSaveFile]);

	// Call onBeforeFilesystemChange when filesystem changes
	useEffect(() => {
		const oldFilesystem = previousFilesystemRef.current;
		if (oldFilesystem && oldFilesystem !== filesystem) {
			// Filesystem is changing - notify parent to flush saves
			if (onBeforeFilesystemChange) {
				void onBeforeFilesystemChange(oldFilesystem);
			}
		}
		previousFilesystemRef.current = filesystem;
	}, [filesystem, onBeforeFilesystemChange]);

	// Reset state when filesystem changes
	useEffect(() => {
		if (!filesystem) {
			skipNextSaveRef.current = true;
			setCode('');
			setCurrentPath(null);
			setReadOnly(true);
			setSaveState(SaveState.IDLE);
			setSaveError(null);
			setShowExplorerOnMobile(false);
			setMessageContent(null);
			hasAutoOpenedRef.current = false;
		}
	}, [filesystem]);

	// Auto-open when the filesystem becomes available: reopen the last file
	// remembered for this persistKey if we have one, otherwise initialPath.
	useEffect(() => {
		if (!filesystem || hasAutoOpenedRef.current) {
			return;
		}
		const pathToOpen = persistedState?.path ?? initialPath;
		if (!pathToOpen) {
			return;
		}

		const tryAutoOpen = async () => {
			try {
				const exists = await filesystem.fileExists(pathToOpen);
				if (exists) {
					const content = await filesystem.readFileAsText(pathToOpen);
					// Capture the saved cursor now, before any state change can
					// trigger the periodic save and overwrite it with 0.
					const savedPos = cursorPositionsRef.current.get(pathToOpen);
					restoringCursorRef.current = savedPos !== undefined;
					skipNextSaveRef.current = true;
					setCurrentPath(pathToOpen);
					setCode(content);
					setReadOnly(false);
					setSaveState(SaveState.IDLE);
					setSaveError(null);
					// Restore the saved cursor position, then focus the editor.
					setTimeout(() => {
						if (savedPos !== undefined) {
							editorRef.current?.setCursorPosition(savedPos);
						}
						editorRef.current?.focus();
						restoringCursorRef.current = false;
					}, 120);
				}
			} catch (error) {
				// Silently fail - file may not exist or may not be readable
				logger.debug('Could not auto-open initial path:', error);
			} finally {
				hasAutoOpenedRef.current = true;
			}
		};

		void tryAutoOpen();
	}, [filesystem, initialPath, persistedState]);

	// Reset when documentRoot changes
	useEffect(() => {
		setSelectedDirPath(documentRoot);
		setCurrentPath(null);
		setCode('');
		setReadOnly(true);
		setSaveState(SaveState.IDLE);
		setSaveError(null);
		skipNextSaveRef.current = true;
		setMessageContent(null);
		hasAutoOpenedRef.current = false;
	}, [documentRoot]);

	// Flush the unsaved edit on unmount. Edits are written by a 1.5s debounce,
	// and closing the panel mid-edit (while it still reads "Saving…") would
	// otherwise drop the change — the pending debounced write never fires. The
	// filesystem / onSaveFile client is keyed to the running Playground, not to
	// this panel, so it outlives the unmount: we read the file one last time and
	// write the buffer if it still differs, fire-and-forget. Comparing against
	// disk (rather than the timer) makes this independent of effect-cleanup
	// ordering and never double-writes or writes unchanged content.
	useEffect(() => {
		return () => {
			const activeFilesystem = filesystemRef.current;
			const path = currentPathRef.current;
			if (saveTimeoutRef.current !== null) {
				window.clearTimeout(saveTimeoutRef.current);
				saveTimeoutRef.current = null;
			}
			if (!activeFilesystem || !path) {
				return;
			}
			const content = codeRef.current;
			void (async () => {
				try {
					const onDisk = await activeFilesystem.readFileAsText(path);
					if (onDisk === content) {
						return;
					}
					if (onSaveFileRef.current) {
						await onSaveFileRef.current(path, content);
					} else {
						await activeFilesystem.writeFile(path, content);
					}
				} catch (error) {
					logger.error(
						'Failed to flush pending save on unmount',
						error
					);
				}
			})();
		};
	}, []);

	// Auto-save effect
	useEffect(() => {
		const activeFilesystem = filesystemRef.current;
		if (!activeFilesystem || !currentPath) {
			if (saveTimeoutRef.current !== null) {
				window.clearTimeout(saveTimeoutRef.current);
				saveTimeoutRef.current = null;
			}
			if (!currentPath) {
				setSaveState(SaveState.IDLE);
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
		setSaveState(SaveState.PENDING);
		const timeout = window.setTimeout(async () => {
			saveTimeoutRef.current = null;
			try {
				const pathToSave = currentPathRef.current as string;
				const contentToSave = codeRef.current;
				// Skip writing content that already matches what's on disk.
				// Opening a file loads its content into the editor, which would
				// otherwise trip this auto-save and write the file back
				// unchanged — triggering a needless persistence sync. Check disk
				// before flipping to "Saving…" so merely opening a file never
				// flashes a save indicator.
				let onDisk: string | null = null;
				try {
					onDisk = await activeFilesystem.readFileAsText(pathToSave);
				} catch {
					onDisk = null;
				}
				if (onDisk === contentToSave) {
					setSaveState(SaveState.IDLE);
					return;
				}
				setSaveState(SaveState.SAVING);
				if (onSaveFile) {
					await onSaveFile(pathToSave, contentToSave);
				} else {
					await activeFilesystem.writeFile(pathToSave, contentToSave);
				}
				setSaveState(SaveState.SAVED);
				setSaveError(null);
			} catch (error) {
				logger.error('Failed to save file', error);
				setSaveState(SaveState.ERROR);
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
	}, [code, currentPath, onSaveFile]);

	// Clear "Saved" state after 2 seconds
	useEffect(() => {
		if (saveState !== SaveState.SAVED) {
			return;
		}
		const timeout = window.setTimeout(() => {
			setSaveState((previous) =>
				previous === SaveState.SAVED ? SaveState.IDLE : previous
			);
		}, 2000);
		return () => window.clearTimeout(timeout);
	}, [saveState]);

	const handleFileOpened = useCallback(
		async (path: string, content: string, shouldFocus = true) => {
			// Save cursor position of current file before switching
			const currentPos = editorRef.current?.getCursorPosition();
			if (
				currentPos !== null &&
				currentPos !== undefined &&
				currentPathRef.current
			) {
				cursorPositionsRef.current.set(
					currentPathRef.current,
					currentPos
				);
			}

			skipNextSaveRef.current = true;
			setCurrentPath(path);
			if (persistedState) {
				persistedState.path = path;
			}
			setCode(content);
			setMessageContent(null);
			setReadOnly(false);
			setSaveState(SaveState.IDLE);
			setSaveError(null);
			setShowExplorerOnMobile(false);

			// Restore cursor position for this file if we have one saved
			setTimeout(() => {
				const savedPos = cursorPositionsRef.current.get(path);
				if (savedPos !== undefined) {
					editorRef.current?.setCursorPosition(savedPos);
				}
				if (shouldFocus) {
					editorRef.current?.focus();
				} else {
					editorRef.current?.blur();
				}
			}, 50);
		},
		[persistedState]
	);

	// Periodically save cursor position while editing
	useEffect(() => {
		if (!currentPath) {
			return;
		}

		const interval = setInterval(() => {
			const pos = editorRef.current?.getCursorPosition();
			if (pos !== null && pos !== undefined) {
				cursorPositionsRef.current.set(currentPath, pos);
			}
		}, 1000);

		// Save immediately on mount and when currentPath changes — unless we're
		// mid-restore, where the editor still sits at 0 and would overwrite the
		// position we're about to restore.
		if (!restoringCursorRef.current) {
			const pos = editorRef.current?.getCursorPosition();
			if (pos !== null && pos !== undefined) {
				cursorPositionsRef.current.set(currentPath, pos);
			}
		}

		return () => {
			clearInterval(interval);
			// Save one final time when unmounting or changing files
			const finalPos = editorRef.current?.getCursorPosition();
			if (finalPos !== null && finalPos !== undefined) {
				cursorPositionsRef.current.set(currentPath, finalPos);
			}
		};
	}, [currentPath]);

	// Restore cursor position when tab becomes visible
	useEffect(() => {
		if (!isVisible || !currentPath) {
			return;
		}

		// Wait a bit for the editor to be ready
		const timeout = setTimeout(() => {
			const savedPos = cursorPositionsRef.current.get(currentPath);
			if (savedPos !== undefined) {
				editorRef.current?.setCursorPosition(savedPos);
			}
		}, 100);

		return () => clearTimeout(timeout);
	}, [isVisible, currentPath]);

	const handleClearSelection = useCallback(async () => {
		// Save cursor position before clearing
		const currentPos = editorRef.current?.getCursorPosition();
		if (
			currentPos !== null &&
			currentPos !== undefined &&
			currentPathRef.current
		) {
			cursorPositionsRef.current.set(currentPathRef.current, currentPos);
		}

		skipNextSaveRef.current = true;
		setCurrentPath(null);
		if (persistedState) {
			persistedState.path = null;
		}
		setCode('');
		setMessageContent(null);
		setReadOnly(true);
		setSaveState(SaveState.IDLE);
		setSaveError(null);
	}, [persistedState]);

	const handleShowMessage = useCallback(
		async (_path: string | null, message: string | JSX.Element) => {
			skipNextSaveRef.current = true;
			setCurrentPath(null);

			// If it's a string, show it in the code editor
			// If it's JSX, show it in a separate message area
			if (typeof message === 'string') {
				setCode(message);
				setMessageContent(null);
			} else {
				setCode('');
				setMessageContent(message);
			}

			setReadOnly(true);
			setSaveState(SaveState.IDLE);
			setSaveError(null);
			setShowExplorerOnMobile(false);
		},
		[]
	);

	// Save now, on demand — from the Save button or Ctrl+S. Unlike the debounced
	// autosave this runs in any state (flushing a pending autosave, or retrying
	// after an error), but still skips a redundant write when the editor already
	// matches disk, so an explicit save on an unchanged file just re-confirms
	// "Saved".
	const handleManualSave = useCallback(async () => {
		if (!filesystemRef.current || !currentPathRef.current) {
			return;
		}
		if (saveTimeoutRef.current !== null) {
			window.clearTimeout(saveTimeoutRef.current);
			saveTimeoutRef.current = null;
		}
		const pathToSave = currentPathRef.current;
		const contentToSave = codeRef.current;
		setSaveState(SaveState.SAVING);
		try {
			let onDisk: string | null = null;
			try {
				onDisk = await filesystemRef.current.readFileAsText(pathToSave);
			} catch {
				onDisk = null;
			}
			if (onDisk !== contentToSave) {
				if (onSaveFile) {
					await onSaveFile(pathToSave, contentToSave);
				} else {
					await filesystemRef.current.writeFile(
						pathToSave,
						contentToSave
					);
				}
			}
			setSaveState(SaveState.SAVED);
			setSaveError(null);
		} catch (error) {
			logger.error('Failed to save file', error);
			setSaveState(SaveState.ERROR);
			setSaveError('Could not save changes. Try again.');
		}
	}, [onSaveFile]);

	const saveButtonLabel = getSaveButtonLabel(saveState);
	const saveButtonStateClassName = getSaveButtonStateClassName(
		saveState,
		styles
	);

	if (!filesystem) {
		return (
			<div className={styles['container']}>
				<div className={styles['placeholder']}>{placeholderText}</div>
			</div>
		);
	}

	return (
		<div className={styles['container']}>
			<div
				className={classNames(styles['content'], {
					[styles['sidebarOpen']]: showExplorerOnMobile,
				})}
			>
				<div
					className={styles['mobileOverlay']}
					onClick={() => setShowExplorerOnMobile(false)}
				/>
				<aside className={styles['sidebarWrapper']}>
					<FileExplorerSidebar
						filesystem={filesystem}
						currentPath={currentPath}
						selectedDirPath={selectedDirPath}
						setSelectedDirPath={setSelectedDirPath}
						onFileOpened={handleFileOpened}
						onSelectionCleared={handleClearSelection}
						onShowMessage={handleShowMessage}
						documentRoot={documentRoot}
					/>
				</aside>
				<section className={styles['editorWrapper']}>
					<div className={styles['editorHeader']}>
						<Button
							className={styles['mobileToggle']}
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
							className={classNames(styles['editorPath'], {
								[styles['editorPathPlaceholder']]:
									!currentPath?.length,
							})}
						>
							{currentPath?.length
								? currentPath
								: `Browse files under ${documentRoot}`}
						</div>
						{!readOnly && currentPath ? (
							<Button
								// The button's look carries the state: a calm,
								// checkmarked "File saved" once in sync; a solid
								// blue "Save file" when there are pending edits;
								// "Saving…" mid-write; a red "Retry save" on
								// failure.
								variant={
									saveState === SaveState.IDLE ||
									saveState === SaveState.SAVED
										? 'secondary'
										: 'primary'
								}
								isDestructive={saveState === SaveState.ERROR}
								icon={
									saveState === SaveState.IDLE ||
									saveState === SaveState.SAVED
										? check
										: undefined
								}
								className={classNames(
									styles['saveButton'],
									saveButtonStateClassName
								)}
								isBusy={saveState === SaveState.SAVING}
								disabled={saveState === SaveState.SAVING}
								onClick={handleManualSave}
								// Clicking saves now; it never closes the editor.
								title="Save this file"
							>
								{saveButtonLabel}
							</Button>
						) : null}
					</div>
					{saveError ? (
						<div style={{ padding: '8px 16px' }}>
							<Notice status="error" isDismissible={false}>
								{saveError}
							</Notice>
						</div>
					) : null}
					{currentPath || code || messageContent ? (
						messageContent ? (
							<div className={styles['messageArea']}>
								{messageContent}
							</div>
						) : (
							<CodeEditor
								ref={editorRef}
								code={code}
								onChange={setCode}
								currentPath={currentPath}
								className={styles['editor']}
								onSaveShortcut={handleManualSave}
								readOnly={readOnly}
							/>
						)
					) : (
						<div className={styles['placeholder']}>
							{placeholderText}
						</div>
					)}
				</section>
			</div>
		</div>
	);
}

function getSaveButtonLabel(saveState: SaveState) {
	switch (saveState) {
		case SaveState.PENDING:
			return 'Save file';
		case SaveState.SAVING:
			return 'Saving…';
		case SaveState.ERROR:
			return 'Retry save';
		// IDLE and the brief SAVED flash both read as "File saved" — the editor
		// is in sync with disk, and naming the file makes clear it's this file
		// that's saved (not the whole Playground).
		default:
			return 'File saved';
	}
}

function getSaveButtonStateClassName(
	saveState: SaveState,
	styleSheet: typeof styles
) {
	// Pending/saving/error looks are carried by the Button variant (primary) and
	// isDestructive; only the calm in-sync "Saved" gets a success tint here.
	switch (saveState) {
		case SaveState.IDLE:
		case SaveState.SAVED:
			return styleSheet['saveButtonSaved'];
		default:
			return undefined;
	}
}
