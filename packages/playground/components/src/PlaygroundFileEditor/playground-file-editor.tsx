import React, { useCallback, useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import { Button, Notice } from '@wordpress/components';
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

export type PlaygroundFileEditorProps = {
	filesystem: AsyncWritableFilesystem | null;
	isVisible?: boolean;
	documentRoot: string;
	initialPath?: string | null;
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
	placeholderText = 'Select a file to view or edit its contents.',
	onSaveFile,
	onBeforeFilesystemChange,
}: PlaygroundFileEditorProps) {
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
	const previousFilesystemRef = useRef<AsyncWritableFilesystem | null>(null);
	const cursorPositionsRef = useRef<Map<string, number>>(new Map());
	const hasAutoOpenedRef = useRef<boolean>(false);

	useEffect(() => {
		codeRef.current = code;
	}, [code]);

	useEffect(() => {
		currentPathRef.current = currentPath;
	}, [currentPath]);

	useEffect(() => {
		filesystemRef.current = filesystem;
	}, [filesystem]);

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

	// Auto-open initialPath when filesystem becomes available
	useEffect(() => {
		if (!filesystem || !initialPath || hasAutoOpenedRef.current) {
			return;
		}

		const tryAutoOpen = async () => {
			try {
				const exists = await filesystem.fileExists(initialPath);
				if (exists) {
					const content =
						await filesystem.readFileAsText(initialPath);
					skipNextSaveRef.current = true;
					setCurrentPath(initialPath);
					setCode(content);
					setReadOnly(false);
					setSaveState(SaveState.IDLE);
					setSaveError(null);
					// Focus the editor after opening
					setTimeout(() => {
						editorRef.current?.focus();
					}, 100);
				}
			} catch (error) {
				// Silently fail - file may not exist or may not be readable
				logger.debug('Could not auto-open initial path:', error);
			} finally {
				hasAutoOpenedRef.current = true;
			}
		};

		void tryAutoOpen();
	}, [filesystem, initialPath]);

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

	// Flush pending save on unmount
	useEffect(() => {
		return () => {
			if (saveTimeoutRef.current !== null) {
				window.clearTimeout(saveTimeoutRef.current);
				saveTimeoutRef.current = null;
			}
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
			setSaveState(SaveState.SAVING);
			try {
				const pathToSave = currentPathRef.current as string;
				const contentToSave = codeRef.current;
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
		[]
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

		// Save immediately on mount and when currentPath changes
		const pos = editorRef.current?.getCursorPosition();
		if (pos !== null && pos !== undefined) {
			cursorPositionsRef.current.set(currentPath, pos);
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
		setCode('');
		setMessageContent(null);
		setReadOnly(true);
		setSaveState(SaveState.IDLE);
		setSaveError(null);
	}, []);

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

	const handleManualSave = useCallback(async () => {
		if (saveTimeoutRef.current === null) {
			return;
		}
		if (!filesystemRef.current || !currentPathRef.current) {
			window.clearTimeout(saveTimeoutRef.current);
			saveTimeoutRef.current = null;
			return;
		}
		window.clearTimeout(saveTimeoutRef.current);
		saveTimeoutRef.current = null;
		setSaveState(SaveState.SAVING);
		try {
			const pathToSave = currentPathRef.current;
			const contentToSave = codeRef.current;
			if (onSaveFile) {
				await onSaveFile(pathToSave, contentToSave);
			} else {
				await filesystemRef.current.writeFile(
					pathToSave,
					contentToSave
				);
			}
			setSaveState(SaveState.SAVED);
			setSaveError(null);
		} catch (error) {
			logger.error('Failed to save file', error);
			setSaveState(SaveState.ERROR);
			setSaveError('Could not save changes. Try again.');
		}
	}, [onSaveFile]);

	const saveStatusLabel = getSaveStatusLabel(saveState, saveError);
	const saveStatusClassName = getSaveStatusClassName(saveState, styles);

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
						<div
							className={classNames(
								styles['saveStatus'],
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

function getSaveStatusLabel(saveState: SaveState, saveError: string | null) {
	switch (saveState) {
		case SaveState.PENDING:
		case SaveState.SAVING:
			return 'Saving…';
		case SaveState.SAVED:
			return 'Saved';
		case SaveState.ERROR:
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
		case SaveState.PENDING:
			return styleSheet['saveStatusPending'];
		case SaveState.SAVING:
			return styleSheet['saveStatusSaving'];
		case SaveState.ERROR:
			return styleSheet['saveStatusError'];
		default:
			return undefined;
	}
}
