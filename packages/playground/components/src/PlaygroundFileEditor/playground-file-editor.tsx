import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import classNames from 'classnames';
import { Button, Notice, Tooltip, VisuallyHidden } from '@wordpress/components';
import type { AsyncWritableFilesystem } from '@wp-playground/storage';
import { FileExplorerSidebar } from './file-explorer-sidebar';
import { CodeEditor, type CodeEditorHandle } from './code-editor';
import styles from './playground-file-editor.module.css';
import { logger } from '@php-wasm/logger';
import { basename, dirname } from '@php-wasm/util';

const SAVE_DEBOUNCE_MS = 1500;
const MANUAL_SAVING_FEEDBACK_DELAY_MS = 700;
const MANUAL_SAVED_FEEDBACK_DURATION_MS = 1000;

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
	dockPresentation?: boolean;
	/** Mobile Dock title row where the current path should be rendered. */
	mobileHeaderTarget?: Element | null;
};

type PendingSave = {
	filesystem: AsyncWritableFilesystem;
	path: string;
	content: string;
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
	dockPresentation = false,
	mobileHeaderTarget = null,
}: PlaygroundFileEditorProps) {
	const [selectedDirPath, setSelectedDirPath] = useState<string | null>(
		documentRoot
	);
	const [currentPath, setCurrentPath] = useState<string | null>(null);
	const [code, setCode] = useState<string>('');
	const [readOnly, setReadOnly] = useState<boolean>(true);
	const [saveState, setSaveState] = useState<SaveState>(SaveState.IDLE);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [manualSaveFeedback, setManualSaveFeedback] = useState<
		'idle' | 'waiting' | 'saving' | 'saved'
	>('idle');
	const [showExplorerOnMobile, setShowExplorerOnMobile] =
		useState<boolean>(false);
	const [messageContent, setMessageContent] = useState<
		string | JSX.Element | null
	>(null);

	const editorRef = useRef<CodeEditorHandle | null>(null);
	const saveTimeoutRef = useRef<number | null>(null);
	const skipNextSaveRef = useRef<boolean>(false);
	const currentPathRef = useRef<string | null>(currentPath);
	const activeFilesystemRef = useRef<AsyncWritableFilesystem | null>(
		filesystem
	);
	const pendingSaveRef = useRef<PendingSave | null>(null);
	const manualSaveRef = useRef<PendingSave | null>(null);
	const lastWriteByFilesystemRef = useRef(
		new WeakMap<AsyncWritableFilesystem, Promise<void>>()
	);
	const isMountedRef = useRef<boolean>(true);
	const cursorPositionsRef = useRef<Map<string, number>>(new Map());
	const hasAutoOpenedRef = useRef<boolean>(false);

	activeFilesystemRef.current = filesystem;

	useEffect(() => {
		currentPathRef.current = currentPath;
	}, [currentPath]);

	/**
	 * Keeps writes ordered within their owning filesystem without making an
	 * unrelated filesystem wait.
	 */
	const saveFile = useCallback(async (pendingSave: PendingSave) => {
		const { filesystem, path, content } = pendingSave;
		const isManualSave = manualSaveRef.current === pendingSave;
		const writes = lastWriteByFilesystemRef.current;
		const previousWrite = writes.get(filesystem);
		// A failed write reports its own error, but must not poison later writes.
		const writePromise = (previousWrite ?? Promise.resolve())
			.catch(() => undefined)
			.then(() => filesystem.writeFile(path, content));
		writes.set(filesystem, writePromise);

		let writeFailed = false;
		try {
			await writePromise;
		} catch (error) {
			writeFailed = true;
			logger.error('Failed to save file', error);
		}

		// The user may have switched filesystems, selected another file, or
		// typed again while the write was running. Only the last write that still
		// owns the visible buffer may update its save status.
		const ownsVisibleBuffer =
			isMountedRef.current &&
			writes.get(filesystem) === writePromise &&
			activeFilesystemRef.current === filesystem &&
			currentPathRef.current === path &&
			pendingSaveRef.current === null;

		if (writes.get(filesystem) === writePromise) {
			writes.delete(filesystem);
		}
		if (manualSaveRef.current === pendingSave) {
			manualSaveRef.current = null;
		}
		if (ownsVisibleBuffer) {
			setSaveState(writeFailed ? SaveState.ERROR : SaveState.SAVED);
			setSaveError(
				writeFailed ? 'Could not save changes. Try again.' : null
			);
			if (isManualSave) {
				setManualSaveFeedback(writeFailed ? 'idle' : 'saved');
			}
		}
	}, []);

	/** Flushes the latest buffered edit to the filesystem that produced it. */
	const flushPendingSave = useCallback(() => {
		const pendingSave = pendingSaveRef.current;
		if (!pendingSave) {
			return;
		}
		if (saveTimeoutRef.current !== null) {
			window.clearTimeout(saveTimeoutRef.current);
			saveTimeoutRef.current = null;
		}
		pendingSaveRef.current = null;
		void saveFile(pendingSave);
	}, [saveFile]);

	useEffect(() => {
		isMountedRef.current = true;
		return () => {
			isMountedRef.current = false;
		};
	}, []);

	// The cleanup captures the old filesystem. The pending save captures it too,
	// so switching to a filesystem with the same path cannot redirect the write.
	useEffect(() => {
		return () => {
			if (pendingSaveRef.current?.filesystem === filesystem) {
				flushPendingSave();
			}
		};
	}, [documentRoot, filesystem, flushPendingSave]);

	// Editor state belongs to one filesystem root. Never carry a path or buffer
	// into another filesystem just because that filesystem has the same path.
	useEffect(() => {
		skipNextSaveRef.current = true;
		setSelectedDirPath(documentRoot);
		setCode('');
		setCurrentPath(null);
		setReadOnly(true);
		setSaveState(SaveState.IDLE);
		setSaveError(null);
		setShowExplorerOnMobile(false);
		setMessageContent(null);
		cursorPositionsRef.current.clear();
		hasAutoOpenedRef.current = false;
	}, [documentRoot, filesystem]);

	// Auto-open initialPath when filesystem becomes available
	useEffect(() => {
		if (!filesystem || !initialPath || hasAutoOpenedRef.current) {
			return;
		}

		let cancelled = false;
		const tryAutoOpen = async () => {
			try {
				const exists = await filesystem.fileExists(initialPath);
				if (exists && !cancelled) {
					const content =
						await filesystem.readFileAsText(initialPath);
					if (cancelled) {
						return;
					}
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
				if (!cancelled) {
					hasAutoOpenedRef.current = true;
				}
			}
		};

		void tryAutoOpen();
		return () => {
			cancelled = true;
		};
	}, [filesystem, initialPath]);

	// Auto-save effect
	useEffect(() => {
		if (!filesystem || !currentPath) {
			if (saveTimeoutRef.current !== null) {
				window.clearTimeout(saveTimeoutRef.current);
				saveTimeoutRef.current = null;
			}
			pendingSaveRef.current = null;
			if (!currentPath) {
				setSaveState(SaveState.IDLE);
			}
			return;
		}
		if (skipNextSaveRef.current) {
			skipNextSaveRef.current = false;
			pendingSaveRef.current = null;
			return;
		}
		if (saveTimeoutRef.current !== null) {
			window.clearTimeout(saveTimeoutRef.current);
			saveTimeoutRef.current = null;
		}
		setSaveState(SaveState.PENDING);
		const pendingSave = {
			filesystem,
			path: currentPath,
			content: code,
		};
		pendingSaveRef.current = pendingSave;
		const timeout = window.setTimeout(() => {
			if (pendingSaveRef.current !== pendingSave) {
				return;
			}
			saveTimeoutRef.current = null;
			pendingSaveRef.current = null;
			setSaveState(SaveState.SAVING);
			void saveFile(pendingSave);
		}, SAVE_DEBOUNCE_MS);
		saveTimeoutRef.current = timeout;

		return () => {
			if (saveTimeoutRef.current === timeout) {
				window.clearTimeout(timeout);
				saveTimeoutRef.current = null;
			}
		};
	}, [code, currentPath, filesystem, saveFile]);

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

	// A new edit or file selection cancels feedback from an older manual save.
	useEffect(() => {
		if (
			manualSaveFeedback === 'idle' ||
			saveState === SaveState.SAVING ||
			saveState === SaveState.SAVED
		) {
			return;
		}
		setManualSaveFeedback('idle');
	}, [manualSaveFeedback, saveState]);

	useEffect(() => {
		if (manualSaveFeedback !== 'saved') {
			return;
		}
		const timeout = window.setTimeout(
			() => setManualSaveFeedback('idle'),
			MANUAL_SAVED_FEEDBACK_DURATION_MS
		);
		return () => window.clearTimeout(timeout);
	}, [manualSaveFeedback]);

	// Fast manual writes go straight to "Saved" instead of flashing "Saving…".
	useEffect(() => {
		if (manualSaveFeedback !== 'waiting') {
			return;
		}
		const timeout = window.setTimeout(
			() =>
				setManualSaveFeedback((feedback) =>
					feedback === 'waiting' ? 'saving' : feedback
				),
			MANUAL_SAVING_FEEDBACK_DELAY_MS
		);
		return () => window.clearTimeout(timeout);
	}, [manualSaveFeedback]);

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

	const handleManualSave = useCallback(() => {
		if (!pendingSaveRef.current) {
			return;
		}
		manualSaveRef.current = pendingSaveRef.current;
		setManualSaveFeedback('waiting');
		setSaveState(SaveState.SAVING);
		flushPendingSave();
	}, [flushPendingSave]);

	const handleDockManualSave = useCallback(() => {
		if (
			!pendingSaveRef.current &&
			saveState === SaveState.ERROR &&
			filesystem &&
			currentPath
		) {
			pendingSaveRef.current = {
				filesystem,
				path: currentPath,
				content: code,
			};
		}
		if (!pendingSaveRef.current) {
			return;
		}
		setSaveError(null);
		handleManualSave();
	}, [code, currentPath, filesystem, handleManualSave, saveState]);

	const saveStatusLabel = getSaveStatusLabel(saveState, saveError);
	const saveStatusClassName = getSaveStatusClassName(saveState, styles);
	const dockSaveTooltip = getDockSaveTooltip(saveState);
	let dockSaveButtonLabel = 'Save';
	if (saveState === SaveState.ERROR) {
		dockSaveButtonLabel = 'Retry';
	} else if (
		saveState === SaveState.SAVED &&
		manualSaveFeedback === 'saved'
	) {
		dockSaveButtonLabel = 'Saved';
	} else if (
		saveState === SaveState.SAVING &&
		manualSaveFeedback === 'saving'
	) {
		dockSaveButtonLabel = 'Saving…';
	}
	const dockHasUnsavedChanges =
		saveState === SaveState.PENDING ||
		saveState === SaveState.SAVING ||
		saveState === SaveState.ERROR;

	if (!filesystem) {
		return (
			<div
				className={classNames(styles['container'], {
					[styles['dockPresentation']]: dockPresentation,
				})}
			>
				<div className={styles['placeholder']}>{placeholderText}</div>
			</div>
		);
	}
	const currentDirectory = currentPath ? dirname(currentPath) : null;
	const currentFilename = currentPath ? basename(currentPath) : null;
	const editorPath = (
		<div
			className={classNames(styles['editorPath'], {
				[styles['editorPathPlaceholder']]: !currentPath?.length,
				[styles['editorPathPortaled']]: mobileHeaderTarget,
			})}
			title={currentPath ?? undefined}
		>
			{currentDirectory && currentFilename ? (
				<>
					<span className={styles['editorPathDirectory']}>
						{currentDirectory === '/' ? '' : currentDirectory}
					</span>
					<span className={styles['editorPathFilename']}>
						/{currentFilename}
					</span>
				</>
			) : (
				`Browse files under ${documentRoot}`
			)}
		</div>
	);

	return (
		<div
			className={classNames(styles['container'], {
				[styles['dockPresentation']]: dockPresentation,
			})}
		>
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
						dockPresentation={dockPresentation}
						useWordPressTooltips={dockPresentation}
					/>
				</aside>
				<section className={styles['editorWrapper']}>
					<div
						className={classNames(styles['editorHeader'], {
							[styles['editorHeaderPathPortaled']]:
								mobileHeaderTarget,
						})}
					>
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
						{mobileHeaderTarget
							? createPortal(editorPath, mobileHeaderTarget)
							: editorPath}
						{dockPresentation && !readOnly && currentPath ? (
							<div className={styles['editorHeaderActions']}>
								{dockHasUnsavedChanges ? (
									<span
										className={styles['dockDirtyIndicator']}
										aria-hidden="true"
									/>
								) : null}
								<Tooltip text={dockSaveTooltip} placement="top">
									<Button
										variant="secondary"
										className={styles['dockSaveButton']}
										isDestructive={
											saveState === SaveState.ERROR
										}
										onClick={handleDockManualSave}
									>
										{dockSaveButtonLabel}
									</Button>
								</Tooltip>
							</div>
						) : !dockPresentation ? (
							<div
								className={classNames(
									styles['saveStatus'],
									saveStatusClassName
								)}
							>
								{saveStatusLabel}
							</div>
						) : null}
						{dockPresentation && !readOnly && currentPath ? (
							<VisuallyHidden role="status" aria-live="polite">
								{dockSaveTooltip}
							</VisuallyHidden>
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

function getDockSaveTooltip(saveState: SaveState) {
	switch (saveState) {
		case SaveState.PENDING:
			return 'Unsaved changes. Click to save now.';
		case SaveState.SAVING:
			return 'Saving changes…';
		case SaveState.ERROR:
			return 'Saving failed. Click to retry.';
		default:
			return 'All changes saved.';
	}
}
