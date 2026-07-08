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
	 * Called after this editor drains pending saves for the old filesystem.
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
	const [filesystemRecovery, setFilesystemRecovery] = useState<{
		path: string | null;
		content: string;
	} | null>(null);

	const editorRef = useRef<CodeEditorHandle | null>(null);
	const saveTimeoutRef = useRef<number | null>(null);
	const skipNextSaveRef = useRef<boolean>(false);
	const codeRef = useRef<string>(code);
	const currentPathRef = useRef<string | null>(currentPath);
	const filesystemRef = useRef<AsyncWritableFilesystem | null>(filesystem);
	const onSaveFileRef = useRef(onSaveFile);
	const documentRootRef = useRef(documentRoot);
	const writeQueueRef = useRef<Promise<void>>(Promise.resolve());
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
	const delayedEditorActionIdRef = useRef(0);

	// Re-point the cursor map if the persistKey changes (e.g. a different
	// Playground) so we never write one site's cursors into another's state.
	useEffect(() => {
		if (persistedState) {
			cursorPositionsRef.current = persistedState.cursors;
		}
	}, [persistedState]);

	const queueFileWrite = useCallback(
		async ({
			filesystem: filesystemToWrite,
			path,
			content,
			onSaveFile: saveFileToWrite,
			shouldWrite,
		}: {
			filesystem: AsyncWritableFilesystem;
			path: string;
			content: string;
			onSaveFile?: typeof onSaveFile;
			shouldWrite?: () => boolean;
		}) => {
			const write = async () => {
				if (shouldWrite && !shouldWrite()) {
					return;
				}
				if (saveFileToWrite) {
					await saveFileToWrite(path, content);
				} else {
					await filesystemToWrite.writeFile(path, content);
				}
			};
			const queuedWrite = writeQueueRef.current
				.catch(() => undefined)
				.then(write);
			writeQueueRef.current = queuedWrite.catch(() => undefined);
			await queuedWrite;
		},
		[]
	);

	useEffect(() => {
		codeRef.current = code;
	}, [code]);

	useEffect(() => {
		currentPathRef.current = currentPath;
	}, [currentPath]);

	// Any action that replaces editor state must drain debounced writes first,
	// otherwise cleanup can cancel unsaved edits for the previous file/site.
	const flushCurrentFile = useCallback(
		async ({
			updateState = true,
			filesystem: filesystemToFlush = filesystemRef.current,
			onSaveFile: saveFileToFlush = onSaveFileRef.current,
		}: {
			updateState?: boolean;
			filesystem?: AsyncWritableFilesystem | null;
			onSaveFile?: typeof onSaveFile;
		} = {}) => {
			const activeFilesystem = filesystemToFlush;
			const pathToSave = currentPathRef.current;
			if (saveTimeoutRef.current !== null) {
				window.clearTimeout(saveTimeoutRef.current);
				saveTimeoutRef.current = null;
			}
			if (!activeFilesystem || !pathToSave) {
				return true;
			}

			try {
				// The editor stays interactive while a forced flush is in
				// flight. If the user types after we capture the buffer but
				// before the write finishes, save the newer buffer too instead
				// of switching files with only the older snapshot on disk.
				while (currentPathRef.current === pathToSave) {
					const contentToSave = codeRef.current;
					const editorChanged = () =>
						currentPathRef.current !== pathToSave ||
						codeRef.current !== contentToSave;
					let onDisk: string | null = null;
					try {
						onDisk =
							await activeFilesystem.readFileAsText(pathToSave);
					} catch {
						onDisk = null;
					}
					if (editorChanged()) {
						continue;
					}
					if (onDisk === contentToSave) {
						if (updateState) {
							setSaveState(SaveState.IDLE);
							setSaveError(null);
						}
						return true;
					}
					if (updateState) {
						setSaveState(SaveState.SAVING);
					}
					await queueFileWrite({
						filesystem: activeFilesystem,
						path: pathToSave,
						content: contentToSave,
						onSaveFile: saveFileToFlush,
						shouldWrite: () => !editorChanged(),
					});
					if (!editorChanged()) {
						if (updateState) {
							setSaveState(SaveState.SAVED);
							setSaveError(null);
						}
						return true;
					}
				}
				return true;
			} catch (error) {
				logger.error('Failed to save file', error);
				if (updateState) {
					setSaveState(SaveState.ERROR);
					setSaveError('Could not save changes. Try again.');
				}
				return false;
			}
		},
		[queueFileWrite]
	);

	const flushFileSnapshot = useCallback(
		async ({
			filesystem: filesystemToFlush,
			path,
			content,
			onSaveFile: saveFileToFlush,
		}: {
			filesystem: AsyncWritableFilesystem | null;
			path: string | null;
			content: string;
			onSaveFile?: typeof onSaveFile;
		}) => {
			// Filesystem switches clear the live editor refs immediately so the
			// new Playground never shows stale content. Save the captured old
			// buffer independently of those refs; otherwise the live-ref guard in
			// flushCurrentFile would treat our own clear as "the user switched
			// files" and skip the write we still owe to the old filesystem.
			if (saveTimeoutRef.current !== null) {
				window.clearTimeout(saveTimeoutRef.current);
				saveTimeoutRef.current = null;
			}
			if (!filesystemToFlush || !path) {
				return true;
			}
			try {
				let onDisk: string | null = null;
				try {
					onDisk = await filesystemToFlush.readFileAsText(path);
				} catch {
					onDisk = null;
				}
				if (onDisk !== content) {
					await queueFileWrite({
						filesystem: filesystemToFlush,
						path,
						content,
						onSaveFile: saveFileToFlush,
					});
				}
				return true;
			} catch (error) {
				logger.error('Failed to save file', error);
				return false;
			}
		},
		[queueFileWrite]
	);

	useEffect(() => {
		let cancelled = false;
		const oldFilesystem = filesystemRef.current;
		const oldSaveFile = onSaveFileRef.current;
		const previousPath = currentPathRef.current;
		const previousCode = codeRef.current;
		let filesystemChangeActionId: number | null = null;
		if (oldFilesystem && oldFilesystem !== filesystem) {
			void (async () => {
				const didFlush = await flushFileSnapshot({
					filesystem: oldFilesystem,
					path: previousPath,
					content: previousCode,
					onSaveFile: oldSaveFile,
				});
				if (!didFlush) {
					if (cancelled) {
						return;
					}
					setFilesystemRecovery({
						path: previousPath,
						content: previousCode,
					});
					if (
						filesystemChangeActionId !== null &&
						delayedEditorActionIdRef.current ===
							filesystemChangeActionId
					) {
						codeRef.current = previousCode;
						currentPathRef.current = null;
						setCode(previousCode);
						setCurrentPath(null);
						setReadOnly(true);
						setMessageContent(null);
						setShowExplorerOnMobile(false);
						setSaveState(SaveState.ERROR);
						setSaveError(
							`Could not save changes${
								previousPath ? ` in ${previousPath}` : ''
							} before switching filesystems. Copy the recovered buffer before dismissing it.`
						);
					} else {
						setSaveState(SaveState.ERROR);
						setSaveError(
							`Could not save changes${
								previousPath ? ` in ${previousPath}` : ''
							} before switching filesystems. Copy the recovered buffer before dismissing it.`
						);
					}
					return;
				}
				if (onBeforeFilesystemChange) {
					await onBeforeFilesystemChange(oldFilesystem);
				}
			})().catch((error) => {
				logger.error('Failed to run filesystem change callback', error);
				if (
					!cancelled &&
					filesystemChangeActionId !== null &&
					delayedEditorActionIdRef.current ===
						filesystemChangeActionId
				) {
					setSaveState(SaveState.ERROR);
					setSaveError(
						'Could not save changes before switching filesystems. Reopen the previous Playground and try again.'
					);
				}
			});
		}
		filesystemRef.current = filesystem;
		if (oldFilesystem !== filesystem) {
			filesystemChangeActionId = delayedEditorActionIdRef.current + 1;
			skipNextSaveRef.current = true;
			codeRef.current = '';
			currentPathRef.current = null;
			setCode('');
			setCurrentPath(null);
			setReadOnly(true);
			setSaveState(SaveState.IDLE);
			setSaveError(null);
			setShowExplorerOnMobile(false);
			setMessageContent(null);
			hasAutoOpenedRef.current = false;
			restoringCursorRef.current = false;
			delayedEditorActionIdRef.current = filesystemChangeActionId;
		}
		return () => {
			cancelled = true;
		};
	}, [filesystem, flushFileSnapshot, onBeforeFilesystemChange]);

	useEffect(() => {
		onSaveFileRef.current = onSaveFile;
	}, [onSaveFile]);

	useEffect(() => {
		if (documentRootRef.current === documentRoot) {
			return;
		}
		documentRootRef.current = documentRoot;
		let cancelled = false;
		const actionId = ++delayedEditorActionIdRef.current;
		void (async () => {
			const didFlush = await flushCurrentFile({ updateState: false });
			if (cancelled || delayedEditorActionIdRef.current !== actionId) {
				return;
			}
			if (!didFlush) {
				setSaveState(SaveState.ERROR);
				setSaveError(
					'Could not save changes before changing folders. Try again.'
				);
				return;
			}
			setSelectedDirPath(documentRoot);
			codeRef.current = '';
			currentPathRef.current = null;
			setCurrentPath(null);
			setCode('');
			setReadOnly(true);
			setSaveState(SaveState.IDLE);
			setSaveError(null);
			skipNextSaveRef.current = true;
			setMessageContent(null);
			hasAutoOpenedRef.current = false;
			restoringCursorRef.current = false;
		})().catch((error) => {
			logger.error('Failed to save file before changing folders', error);
			if (!cancelled && delayedEditorActionIdRef.current === actionId) {
				setSaveState(SaveState.ERROR);
				setSaveError(
					'Could not save changes before changing folders. Try again.'
				);
			}
		});
		return () => {
			cancelled = true;
		};
	}, [documentRoot, flushCurrentFile]);

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

		let cancelled = false;
		const autoOpenActionId = delayedEditorActionIdRef.current;
		const tryAutoOpen = async () => {
			try {
				const exists = await filesystem.fileExists(pathToOpen);
				if (exists) {
					const content = await filesystem.readFileAsText(pathToOpen);
					if (
						cancelled ||
						currentPathRef.current ||
						delayedEditorActionIdRef.current !== autoOpenActionId
					) {
						return;
					}
					// Capture the saved cursor now, before any state change can
					// trigger the periodic save and overwrite it with 0.
					const savedPos = cursorPositionsRef.current.get(pathToOpen);
					restoringCursorRef.current = savedPos !== undefined;
					skipNextSaveRef.current = true;
					currentPathRef.current = pathToOpen;
					codeRef.current = content;
					setCurrentPath(pathToOpen);
					setCode(content);
					setReadOnly(false);
					setSaveState(SaveState.IDLE);
					setSaveError(null);
					// Restore the saved cursor position, then focus the editor.
					const actionId = ++delayedEditorActionIdRef.current;
					setTimeout(() => {
						if (
							cancelled ||
							delayedEditorActionIdRef.current !== actionId ||
							currentPathRef.current !== pathToOpen
						) {
							return;
						}
						if (savedPos !== undefined) {
							editorRef.current?.setCursorPosition(savedPos);
						}
						editorRef.current?.focus();
						restoringCursorRef.current = false;
					}, 120);
				}
			} catch (error) {
				// Auto-open is best-effort; the last path may have been deleted.
				logger.debug('Could not auto-open initial path:', error);
			} finally {
				if (!cancelled) {
					hasAutoOpenedRef.current = true;
				}
			}
		};

		void tryAutoOpen();
		return () => {
			cancelled = true;
		};
	}, [filesystem, initialPath, persistedState]);

	// Flush the unsaved edit on unmount. Edits are written by a 1.5s debounce,
	// and closing the panel mid-edit (while it still reads "Saving…") would
	// otherwise drop the change — the pending debounced write never fires. The
	// save target is keyed to the running Playground, not this panel, so it
	// outlives unmount: read the file one last time and write if it differs.
	// Comparing against disk makes this independent of effect-cleanup ordering
	// and never double-writes or writes unchanged content.
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
			const saveFile = onSaveFileRef.current;
			const content = codeRef.current;
			void (async () => {
				try {
					let onDisk: string | null = null;
					try {
						onDisk = await activeFilesystem.readFileAsText(path);
					} catch {
						onDisk = null;
					}
					if (onDisk === content) {
						return;
					}
					await queueFileWrite({
						filesystem: activeFilesystem,
						path,
						content,
						onSaveFile: saveFile,
					});
				} catch (error) {
					logger.error(
						'Failed to flush pending save on unmount',
						error
					);
				}
			})();
		};
	}, [queueFileWrite]);

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
		const saveActionId = delayedEditorActionIdRef.current;
		const timeout = window.setTimeout(async () => {
			saveTimeoutRef.current = null;
			try {
				const pathToSave = currentPathRef.current;
				if (
					!pathToSave ||
					delayedEditorActionIdRef.current !== saveActionId
				) {
					return;
				}
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
				if (
					delayedEditorActionIdRef.current !== saveActionId ||
					currentPathRef.current !== pathToSave ||
					codeRef.current !== contentToSave
				) {
					return;
				}
				if (onDisk === contentToSave) {
					setSaveState(SaveState.IDLE);
					return;
				}
				setSaveState(SaveState.SAVING);
				await queueFileWrite({
					filesystem: activeFilesystem,
					path: pathToSave,
					content: contentToSave,
					onSaveFile,
					shouldWrite: () =>
						delayedEditorActionIdRef.current === saveActionId &&
						currentPathRef.current === pathToSave &&
						codeRef.current === contentToSave,
				});
				if (
					delayedEditorActionIdRef.current !== saveActionId ||
					currentPathRef.current !== pathToSave ||
					codeRef.current !== contentToSave
				) {
					return;
				}
				setSaveState(SaveState.SAVED);
				setSaveError(null);
			} catch (error) {
				logger.error('Failed to save file', error);
				if (delayedEditorActionIdRef.current !== saveActionId) {
					return;
				}
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
	}, [code, currentPath, onSaveFile, queueFileWrite]);

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
			const actionId = ++delayedEditorActionIdRef.current;
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

			const didFlush = await flushCurrentFile({ updateState: false });
			if (delayedEditorActionIdRef.current !== actionId) {
				return;
			}
			if (!didFlush) {
				setSaveState(SaveState.ERROR);
				setSaveError(
					'Could not save changes before switching files. Try again.'
				);
				return;
			}

			if (path === currentPathRef.current) {
				setMessageContent(null);
				setReadOnly(false);
				setSaveError(null);
				setShowExplorerOnMobile(false);
				if (persistedState) {
					persistedState.path = path;
				}
				restoringCursorRef.current = false;
				setTimeout(() => {
					if (
						delayedEditorActionIdRef.current !== actionId ||
						currentPathRef.current !== path
					) {
						return;
					}
					if (shouldFocus) {
						editorRef.current?.focus();
					} else {
						editorRef.current?.blur();
					}
				}, 50);
				return;
			}

			skipNextSaveRef.current = true;
			currentPathRef.current = path;
			codeRef.current = content;
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
			restoringCursorRef.current = false;

			// Restore cursor position for this file if we have one saved
			setTimeout(() => {
				if (
					delayedEditorActionIdRef.current !== actionId ||
					currentPathRef.current !== path
				) {
					return;
				}
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
		[flushCurrentFile, persistedState]
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
		const actionId = ++delayedEditorActionIdRef.current;
		// Save cursor position before clearing
		const currentPos = editorRef.current?.getCursorPosition();
		if (
			currentPos !== null &&
			currentPos !== undefined &&
			currentPathRef.current
		) {
			cursorPositionsRef.current.set(currentPathRef.current, currentPos);
		}

		const didFlush = await flushCurrentFile({ updateState: false });
		if (delayedEditorActionIdRef.current !== actionId) {
			return;
		}
		if (!didFlush) {
			setSaveState(SaveState.ERROR);
			setSaveError(
				'Could not save changes before clearing the file selection. Try again.'
			);
			return;
		}

		skipNextSaveRef.current = true;
		currentPathRef.current = null;
		codeRef.current = '';
		restoringCursorRef.current = false;
		setCurrentPath(null);
		if (persistedState) {
			persistedState.path = null;
		}
		setCode('');
		setMessageContent(null);
		setReadOnly(true);
		setSaveState(SaveState.IDLE);
		setSaveError(null);
	}, [flushCurrentFile, persistedState]);

	const handleShowMessage = useCallback(
		async (_path: string | null, message: string | JSX.Element) => {
			const actionId = ++delayedEditorActionIdRef.current;
			const didFlush = await flushCurrentFile({ updateState: false });
			if (delayedEditorActionIdRef.current !== actionId) {
				return false;
			}
			if (!didFlush) {
				setSaveState(SaveState.ERROR);
				setSaveError(
					'Could not save changes before opening this file. Try again.'
				);
				return false;
			}

			skipNextSaveRef.current = true;
			currentPathRef.current = null;
			restoringCursorRef.current = false;
			setCurrentPath(null);

			if (typeof message === 'string') {
				codeRef.current = message;
				setCode(message);
				setMessageContent(null);
			} else {
				codeRef.current = '';
				setCode('');
				setMessageContent(message);
			}

			setReadOnly(true);
			setSaveState(SaveState.IDLE);
			setSaveError(null);
			setShowExplorerOnMobile(false);
			return true;
		},
		[flushCurrentFile]
	);

	// Save now, on demand — from the Save button or Ctrl+S. Unlike the debounced
	// autosave this runs in any state (flushing a pending autosave, or retrying
	// after an error), but still skips a redundant write when the editor already
	// matches disk, so an explicit save on an unchanged file just re-confirms
	// "Saved".
	const handleManualSave = useCallback(async () => {
		const activeFilesystem = filesystemRef.current;
		if (!activeFilesystem || !currentPathRef.current) {
			return;
		}
		if (saveTimeoutRef.current !== null) {
			window.clearTimeout(saveTimeoutRef.current);
			saveTimeoutRef.current = null;
		}
		const pathToSave = currentPathRef.current;
		const contentToSave = codeRef.current;
		const saveActionId = delayedEditorActionIdRef.current;
		setSaveState(SaveState.SAVING);
		try {
			let onDisk: string | null = null;
			try {
				onDisk = await activeFilesystem.readFileAsText(pathToSave);
			} catch {
				onDisk = null;
			}
			if (onDisk !== contentToSave) {
				await queueFileWrite({
					filesystem: activeFilesystem,
					path: pathToSave,
					content: contentToSave,
					onSaveFile,
					shouldWrite: () =>
						delayedEditorActionIdRef.current === saveActionId &&
						currentPathRef.current === pathToSave &&
						codeRef.current === contentToSave,
				});
			}
			if (
				delayedEditorActionIdRef.current !== saveActionId ||
				currentPathRef.current !== pathToSave ||
				codeRef.current !== contentToSave
			) {
				return;
			}
			setSaveState(SaveState.SAVED);
			setSaveError(null);
		} catch (error) {
			logger.error('Failed to save file', error);
			if (
				delayedEditorActionIdRef.current !== saveActionId ||
				currentPathRef.current !== pathToSave ||
				codeRef.current !== contentToSave
			) {
				return;
			}
			setSaveState(SaveState.ERROR);
			setSaveError('Could not save changes. Try again.');
		}
	}, [onSaveFile, queueFileWrite]);

	const handleCodeChange = useCallback((newCode: string) => {
		if (newCode === codeRef.current) {
			return;
		}
		codeRef.current = newCode;
		setCode(newCode);
	}, []);

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
							<div className={styles['editorHeaderActions']}>
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
									isDestructive={
										saveState === SaveState.ERROR
									}
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
							</div>
						) : null}
					</div>
					{saveError ? (
						<div style={{ padding: '8px 16px' }}>
							<Notice status="error" isDismissible={false}>
								{saveError}
							</Notice>
						</div>
					) : null}
					{filesystemRecovery ? (
						<div className={styles['recovery']}>
							<Notice status="error" isDismissible={false}>
								Unsaved changes
								{filesystemRecovery.path
									? ` from ${filesystemRecovery.path}`
									: ''}{' '}
								were not written before switching filesystems.
								Copy this buffer if you still need it.
							</Notice>
							<textarea
								readOnly
								className={styles['recoveryBuffer']}
								value={filesystemRecovery.content}
								aria-label="Recovered unsaved file buffer"
							/>
							<Button
								variant="secondary"
								onClick={() => setFilesystemRecovery(null)}
							>
								Dismiss recovered buffer
							</Button>
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
								onChange={handleCodeChange}
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
