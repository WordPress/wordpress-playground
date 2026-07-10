import React, {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from 'react';
import classNames from 'classnames';
import { Button, Notice } from '@wordpress/components';
import { check } from '@wordpress/icons';
import type { AsyncWritableFilesystem } from '@wp-playground/storage';
import {
	FileExplorerSidebar,
	type FileOpenRequestGuard,
} from './file-explorer-sidebar';
import {
	CodeEditor,
	type CodeEditorCursorRestoreRequest,
	type CodeEditorHandle,
} from './code-editor';
import styles from './playground-file-editor.module.css';
import { logger } from '@php-wasm/logger';
import { dirname, ensureAbsolutePath, resolvePathUnder } from '@php-wasm/util';
import { pathContainsPath, remapPathAfterMove } from '../file-tree-paths';
import { serializeFilesystemOperation } from '../filesystem-operation-queue';
import type { FilePickerPathChangeOutcome } from '../FilePickerTree';

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

type EditorIdentity = {
	filesystem: AsyncWritableFilesystem | null;
	persistKey: string | undefined;
	documentRoot: string;
};

type FilesystemRecovery = {
	id: number;
	path: string | null;
	content: string;
	discard: () => void;
};

type PendingEditorPathChange = {
	identity: EditorIdentity;
	persistedState: PersistedEditorState | null;
	affectedCurrentPath: boolean;
	release: () => void;
};
const persistedEditorStates = new Map<
	string,
	Map<string, PersistedEditorState>
>();
type EditorWriteQueue = {
	pending: Promise<void>;
	pendingPathChanges: Promise<void>;
	recoveries: FilesystemRecovery[];
	recoveryListeners: Set<() => void>;
};
const filesystemWriteQueues = new WeakMap<
	AsyncWritableFilesystem,
	EditorWriteQueue
>();
const persistedWriteQueues = new Map<string, EditorWriteQueue>();
let nextEditorRecoveryId = 1;

export type PlaygroundFileEditorProps = {
	/**
	 * Filesystem object identity owns queued work. Replace the object whenever
	 * its backing storage changes, even when the replacement has the same paths.
	 */
	filesystem: AsyncWritableFilesystem | null;
	isVisible?: boolean;
	documentRoot: string;
	initialPath?: string | null;
	/**
	 * Opt-in stable identity (e.g. a Playground metadata ID) for remembering the
	 * open file and cursor positions across unmounts. When the host remounts this
	 * editor (such as a panel that closes and reopens), passing the same
	 * key reopens the last file at its last cursor position instead of falling
	 * back to `initialPath`. Omit it to keep the default stateless behavior.
	 */
	persistKey?: string;
	placeholderText?: string;
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
}: PlaygroundFileEditorProps) {
	const normalizedDocumentRoot = ensureAbsolutePath(documentRoot);
	const persistedState =
		persistKey !== undefined
			? getPersistedEditorState(persistKey, normalizedDocumentRoot)
			: null;
	const [selectedDirPath, setSelectedDirPath] = useState<string | null>(
		normalizedDocumentRoot
	);
	const [currentPath, setCurrentPath] = useState<string | null>(null);
	const [code, setCode] = useState<string>('');
	const [cursorRestore, setCursorRestore] =
		useState<CodeEditorCursorRestoreRequest>();
	const [readOnly, setReadOnly] = useState<boolean>(true);
	const [saveState, setSaveState] = useState<SaveState>(SaveState.IDLE);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [showExplorerOnMobile, setShowExplorerOnMobile] =
		useState<boolean>(false);
	const [messageContent, setMessageContent] = useState<
		string | JSX.Element | null
	>(null);
	const [filesystemRecoveries, setFilesystemRecoveries] = useState<
		FilesystemRecovery[]
	>([]);

	const editorRef = useRef<CodeEditorHandle | null>(null);
	const saveTimeoutRef = useRef<number | null>(null);
	const codeRef = useRef<string>(code);
	const currentPathRef = useRef<string | null>(currentPath);
	const filesystemRef = useRef<AsyncWritableFilesystem | null>(filesystem);
	const persistKeyRef = useRef(persistKey);
	const dirtyRef = useRef(false);
	const mountedRef = useRef(true);
	const pendingIdentityFlushRef = useRef<Promise<void>>(Promise.resolve());
	const pendingPathChangesRef = useRef(
		new Map<string, PendingEditorPathChange>()
	);
	const wasVisibleRef = useRef(isVisible);
	// Cursor positions live in the persisted state (when a persistKey is given)
	// so they survive unmounts; otherwise they're a plain per-instance map.
	const cursorPositionsRef = useRef<Map<string, number>>(
		persistedState?.cursors ?? new Map()
	);
	const hasAutoOpenedRef = useRef<boolean>(false);
	// True while a target document and cursor are committing. Hide or unmount
	// must not pair that target path with the previous CodeMirror selection.
	const restoringCursorRef = useRef<boolean>(false);
	const pendingCursorRestoreRevisionRef = useRef<number | null>(null);
	const delayedEditorActionIdRef = useRef(0);
	const nextCursorRestoreRevisionRef = useRef(1);
	const editorIdentityRef = useRef({
		filesystem,
		persistKey,
		documentRoot: normalizedDocumentRoot,
	});
	const identityTransitionRef = useRef(false);
	const [autoOpenRevision, setAutoOpenRevision] = useState(0);

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
		};
	}, []);

	// Capture the final cursor while the CodeEditor imperative handle is still
	// attached. Passive cleanup runs after ref detachment and cannot observe the
	// last keystroke when a keyed panel remounts immediately.
	useLayoutEffect(() => {
		return () => {
			if (restoringCursorRef.current) {
				return;
			}
			const path = currentPathRef.current;
			const cursor = editorRef.current?.getCursorPosition();
			if (path && cursor !== null && cursor !== undefined) {
				cursorPositionsRef.current.set(path, cursor);
			}
		};
	}, []);

	/** Marks a cursor restore complete only for the revision CodeMirror committed. */
	const handleCursorRestoreApplied = useCallback((revision: number) => {
		if (pendingCursorRestoreRevisionRef.current !== revision) {
			return;
		}
		pendingCursorRestoreRevisionRef.current = null;
		restoringCursorRef.current = false;
	}, []);

	/** Serializes one dirty snapshot behind every older write for its editor. */
	const queueFileWrite = useCallback(
		async ({
			filesystem: filesystemToWrite,
			persistKey: writePersistKey,
			path,
			content,
			shouldWrite,
			recoverOnFailure = false,
		}: {
			filesystem: AsyncWritableFilesystem;
			persistKey: string | undefined;
			path: string;
			content: string;
			shouldWrite?: () => boolean;
			recoverOnFailure?: boolean;
		}) => {
			const writeQueue = getEditorWriteQueue(
				filesystemToWrite,
				writePersistKey
			);
			let didWrite = false;
			const queuedWrite = Promise.all([
				writeQueue.pending.catch(() => undefined),
				writeQueue.pendingPathChanges.catch(() => undefined),
			]).then(async () => {
				if (shouldWrite && !shouldWrite()) {
					return;
				}
				await serializeFilesystemOperation(filesystemToWrite, () =>
					filesystemToWrite.writeFile(path, content)
				);
				didWrite = true;
			});
			const observedWrite = queuedWrite.catch((error) => {
				if (recoverOnFailure) {
					addEditorRecovery(writeQueue, path, content);
				}
				throw error;
			});
			writeQueue.pending = observedWrite.catch(() => undefined);
			await observedWrite;
			return didWrite;
		},
		[]
	);

	/** Adds queued recovery buffers to the visible recovery list once each. */
	const publishEditorRecoveries = useCallback((queue: EditorWriteQueue) => {
		setFilesystemRecoveries((visibleRecoveries) =>
			mergeEditorRecoveries(visibleRecoveries, queue.recoveries)
		);
	}, []);

	useLayoutEffect(() => {
		const queue = getExistingEditorWriteQueue(filesystem, persistKey);
		if (!queue) {
			return;
		}
		publishEditorRecoveries(queue);
		/** Publishes a failed final snapshot created after this mount appeared. */
		const publishRecoveries = () => publishEditorRecoveries(queue);
		queue.recoveryListeners.add(publishRecoveries);
		return () => {
			queue.recoveryListeners.delete(publishRecoveries);
		};
	}, [filesystem, persistKey, publishEditorRecoveries]);

	useEffect(() => {
		codeRef.current = code;
	}, [code]);

	useEffect(() => {
		currentPathRef.current = currentPath;
	}, [currentPath]);

	/**
	 * Drains the current buffer before an action replaces the open file.
	 *
	 * The editor remains interactive during the read and write, so this loops
	 * until it either saves the latest stable buffer or the caller changes the
	 * active path and makes the captured file irrelevant.
	 */
	const flushCurrentFile = useCallback(
		async ({
			updateState = true,
			filesystem: filesystemToFlush = filesystemRef.current,
		}: {
			updateState?: boolean;
			filesystem?: AsyncWritableFilesystem | null;
		} = {}) => {
			const activeFilesystem = filesystemToFlush;
			const pathToSave = currentPathRef.current;
			const flushActionId = delayedEditorActionIdRef.current;
			const writePersistKey = persistKeyRef.current;
			if (saveTimeoutRef.current !== null) {
				window.clearTimeout(saveTimeoutRef.current);
				saveTimeoutRef.current = null;
			}
			if (!dirtyRef.current || !activeFilesystem || !pathToSave) {
				return true;
			}

			try {
				// The editor stays interactive while a forced flush is in
				// flight. If the user types after we capture the buffer but
				// before the write finishes, save the newer buffer too instead
				// of switching files with only the older snapshot on disk.
				while (
					dirtyRef.current &&
					currentPathRef.current === pathToSave &&
					delayedEditorActionIdRef.current === flushActionId
				) {
					const contentToSave = codeRef.current;
					/** Detects edits made while the current snapshot is in flight. */
					const editorChanged = () =>
						!dirtyRef.current ||
						delayedEditorActionIdRef.current !== flushActionId ||
						currentPathRef.current !== pathToSave ||
						codeRef.current !== contentToSave;
					if (updateState) {
						setSaveState(SaveState.SAVING);
					}
					const didWrite = await queueFileWrite({
						filesystem: activeFilesystem,
						persistKey: writePersistKey,
						path: pathToSave,
						content: contentToSave,
						shouldWrite: () => !editorChanged(),
					});
					if (!editorChanged()) {
						if (didWrite) {
							dirtyRef.current = false;
						}
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

	/**
	 * Flushes an immutable buffer captured before an editor identity reset.
	 *
	 * Unlike `flushCurrentFile`, this deliberately ignores the live refs because
	 * they already point at the next Playground, persistence key, or root.
	 */
	const flushFileSnapshot = useCallback(
		async ({
			filesystem: filesystemToFlush,
			persistKey: writePersistKey,
			path,
			content,
			dirty,
		}: {
			filesystem: AsyncWritableFilesystem | null;
			persistKey: string | undefined;
			path: string | null;
			content: string;
			dirty: boolean;
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
			if (!filesystemToFlush) {
				return true;
			}
			try {
				if (dirty && path) {
					await queueFileWrite({
						filesystem: filesystemToFlush,
						persistKey: writePersistKey,
						path,
						content,
					});
				} else {
					await drainEditorOperations(
						getEditorWriteQueue(filesystemToFlush, writePersistKey)
					);
				}
				return true;
			} catch (error) {
				logger.error('Failed to save file', error);
				return false;
			}
		},
		[queueFileWrite]
	);

	// A filesystem, persistence key, or root change replaces the editor's
	// identity. Capture and flush the old buffer, but clear the live refs right
	// away so async work from the old identity cannot appear under the new one.
	useLayoutEffect(() => {
		const previousIdentity = editorIdentityRef.current;
		if (
			previousIdentity.filesystem === filesystem &&
			previousIdentity.persistKey === persistKey &&
			previousIdentity.documentRoot === normalizedDocumentRoot
		) {
			return;
		}

		let cancelled = false;
		const oldFilesystem = filesystemRef.current;
		const oldPersistKey = previousIdentity.persistKey;
		const previousPath = currentPathRef.current;
		const previousCode = codeRef.current;
		const previousBufferWasDirty = dirtyRef.current;
		const previousCursor = editorRef.current?.getCursorPosition();
		if (
			previousPath &&
			previousCursor !== null &&
			previousCursor !== undefined
		) {
			cursorPositionsRef.current.set(previousPath, previousCursor);
		}

		editorIdentityRef.current = {
			filesystem,
			persistKey,
			documentRoot: normalizedDocumentRoot,
		};
		identityTransitionRef.current = true;
		const actionId = ++delayedEditorActionIdRef.current;
		filesystemRef.current = filesystem;
		persistKeyRef.current = persistKey;
		cursorPositionsRef.current = persistedState?.cursors ?? new Map();
		dirtyRef.current = false;
		codeRef.current = '';
		currentPathRef.current = null;
		hasAutoOpenedRef.current = false;
		restoringCursorRef.current = false;
		pendingCursorRestoreRevisionRef.current = null;
		setSelectedDirPath(normalizedDocumentRoot);
		setCode('');
		setCursorRestore(undefined);
		setCurrentPath(null);
		setReadOnly(true);
		setSaveState(SaveState.IDLE);
		setSaveError(null);
		setShowExplorerOnMobile(false);
		setMessageContent(null);

		const previousIdentityFlush = pendingIdentityFlushRef.current;
		const identityFlush = (async () => {
			try {
				await previousIdentityFlush;
				const didFlush = await flushFileSnapshot({
					filesystem: oldFilesystem,
					persistKey: oldPersistKey,
					path: previousPath,
					content: previousCode,
					dirty: previousBufferWasDirty,
				});
				if (!didFlush && previousBufferWasDirty && oldFilesystem) {
					const recoveryQueue = getEditorWriteQueue(
						oldFilesystem,
						oldPersistKey
					);
					addEditorRecovery(
						recoveryQueue,
						previousPath,
						previousCode
					);
					if (mountedRef.current) {
						publishEditorRecoveries(recoveryQueue);
					}
					if (!cancelled) {
						setSaveState(SaveState.ERROR);
						setSaveError(
							`Could not save changes${
								previousPath ? ` in ${previousPath}` : ''
							} before switching Playgrounds or folders. Copy the recovered buffer before dismissing it.`
						);
					}
				}
			} catch (error) {
				logger.error('Failed to finish editor identity change', error);
				if (!cancelled) {
					setSaveState(SaveState.ERROR);
					setSaveError(
						'Could not finish switching Playgrounds or folders. Try again.'
					);
				}
			} finally {
				if (
					!cancelled &&
					delayedEditorActionIdRef.current === actionId
				) {
					identityTransitionRef.current = false;
					setAutoOpenRevision((revision) => revision + 1);
				}
			}
		})();
		pendingIdentityFlushRef.current = identityFlush.catch(() => undefined);
		void identityFlush;

		return () => {
			cancelled = true;
		};
	}, [
		filesystem,
		flushFileSnapshot,
		normalizedDocumentRoot,
		persistedState,
		persistKey,
		publishEditorRecoveries,
	]);

	// Auto-open when the filesystem becomes available: reopen the last file
	// remembered for this identity if it still exists under documentRoot,
	// otherwise fall back to initialPath.
	useEffect(() => {
		if (
			!filesystem ||
			identityTransitionRef.current ||
			hasAutoOpenedRef.current
		) {
			return;
		}
		let cancelled = false;
		const autoOpenActionId = delayedEditorActionIdRef.current;
		void (async () => {
			// A keyed editor may remount while its previous instance is flushing
			// the debounce buffer or finishing a path mutation. Wait for that
			// shared queue before reading disk.
			const editorQueue = getEditorWriteQueue(filesystem, persistKey);
			await drainEditorOperations(editorQueue);
			publishEditorRecoveries(editorQueue);
			if (
				cancelled ||
				delayedEditorActionIdRef.current !== autoOpenActionId
			) {
				return;
			}
			// A completed rename may have remapped the persisted path while the
			// queue was draining. Resolve candidates only after that ownership work.
			const rememberedPath = persistedState?.path
				? resolvePathUnder(persistedState.path, normalizedDocumentRoot)
				: undefined;
			const fallbackPath = initialPath
				? resolvePathUnder(initialPath, normalizedDocumentRoot)
				: undefined;
			const pathsToTry = Array.from(
				new Set(
					[rememberedPath, fallbackPath].filter(
						(path): path is string => Boolean(path)
					)
				)
			);
			if (pathsToTry.length === 0) {
				if (persistedState) {
					persistedState.path = null;
				}
				return;
			}
			for (const pathToOpen of pathsToTry) {
				try {
					if (!(await filesystem.fileExists(pathToOpen))) {
						continue;
					}
					const content = await filesystem.readFileAsText(pathToOpen);
					if (
						cancelled ||
						currentPathRef.current ||
						delayedEditorActionIdRef.current !== autoOpenActionId
					) {
						return;
					}
					// Restore a remembered cursor, or start an unseen file at 0. Every
					// activation gets a revision so identical file contents cannot carry
					// the previous file's CodeMirror selection across the switch.
					const savedPos = cursorPositionsRef.current.get(pathToOpen);
					const cursorRestoreRevision =
						nextCursorRestoreRevisionRef.current++;
					restoringCursorRef.current = true;
					pendingCursorRestoreRevisionRef.current =
						cursorRestoreRevision;
					setCursorRestore({
						revision: cursorRestoreRevision,
						position: savedPos ?? 0,
					});
					dirtyRef.current = false;
					currentPathRef.current = pathToOpen;
					codeRef.current = content;
					setCurrentPath(pathToOpen);
					setCode(content);
					setReadOnly(false);
					setSaveState(SaveState.IDLE);
					setSaveError(null);
					if (persistedState) {
						persistedState.path = pathToOpen;
					}
					// CodeEditor restores the cursor with its document update. Wait
					// only for the newly mounted editor before focusing it.
					const actionId = ++delayedEditorActionIdRef.current;
					setTimeout(() => {
						if (
							cancelled ||
							delayedEditorActionIdRef.current !== actionId ||
							currentPathRef.current !== pathToOpen
						) {
							return;
						}
						editorRef.current?.focus();
					}, 120);
					return;
				} catch (error) {
					// Auto-open is best-effort; the remembered file may disappear
					// between the existence check and the read.
					logger.debug('Could not auto-open file:', error);
				}
			}
			if (persistedState) {
				persistedState.path = null;
			}
		})().finally(() => {
			if (!cancelled) {
				hasAutoOpenedRef.current = true;
			}
		});
		return () => {
			cancelled = true;
		};
	}, [
		autoOpenRevision,
		filesystem,
		initialPath,
		normalizedDocumentRoot,
		persistedState,
		publishEditorRecoveries,
	]);

	// Flush the unsaved edit on unmount. Edits are written by a 1.5s debounce,
	// and closing the panel mid-edit (while it still reads "Saving…") would
	// otherwise drop the change — the pending debounced write never fires. The
	// save target is keyed to the running Playground, not this panel, so its
	// queue outlives unmount. Enqueue the captured buffer synchronously, but let
	// a completed path mutation invalidate it before it can recreate an old name.
	// An ordinary remount leaves the action intact and waits for this queue.
	useEffect(() => {
		return () => {
			const activeFilesystem = filesystemRef.current;
			const actionId = delayedEditorActionIdRef.current;
			const path = currentPathRef.current;
			if (saveTimeoutRef.current !== null) {
				window.clearTimeout(saveTimeoutRef.current);
				saveTimeoutRef.current = null;
			}
			if (!dirtyRef.current || !activeFilesystem || !path) {
				return;
			}
			const content = codeRef.current;
			void queueFileWrite({
				filesystem: activeFilesystem,
				persistKey: persistKeyRef.current,
				path,
				content,
				recoverOnFailure: true,
				shouldWrite: () =>
					dirtyRef.current &&
					delayedEditorActionIdRef.current === actionId &&
					currentPathRef.current === path &&
					codeRef.current === content,
			}).catch((error) => {
				logger.error('Failed to flush pending save on unmount', error);
			});
		};
	}, [queueFileWrite]);

	// Auto-save effect
	useEffect(() => {
		const activeFilesystem = filesystemRef.current;
		if (!activeFilesystem || !currentPath || !dirtyRef.current) {
			if (saveTimeoutRef.current !== null) {
				window.clearTimeout(saveTimeoutRef.current);
				saveTimeoutRef.current = null;
			}
			if (!currentPath) {
				setSaveState(SaveState.IDLE);
			}
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
				setSaveState(SaveState.SAVING);
				const didWrite = await queueFileWrite({
					filesystem: activeFilesystem,
					persistKey,
					path: pathToSave,
					content: contentToSave,
					shouldWrite: () =>
						dirtyRef.current &&
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
				if (didWrite) {
					dirtyRef.current = false;
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
	}, [code, currentPath, persistKey, queueFileWrite]);

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
		async (
			path: string,
			content: string,
			shouldFocus = true,
			isCurrentRequest?: FileOpenRequestGuard
		) => {
			const requestIdentity: EditorIdentity = {
				filesystem,
				persistKey,
				documentRoot: normalizedDocumentRoot,
			};
			if (
				!editorIdentitiesMatch(
					editorIdentityRef.current,
					requestIdentity
				)
			) {
				return;
			}
			const actionId = ++delayedEditorActionIdRef.current;

			const didFlush = await flushCurrentFile({ updateState: false });
			if (
				delayedEditorActionIdRef.current !== actionId ||
				!editorIdentitiesMatch(
					editorIdentityRef.current,
					requestIdentity
				) ||
				(isCurrentRequest && !isCurrentRequest())
			) {
				return;
			}
			if (!didFlush) {
				setSaveState(SaveState.ERROR);
				setSaveError(
					'Could not save changes before switching files. Try again.'
				);
				return;
			}
			// The editor remains interactive while flushCurrentFile waits. Capture
			// the cursor only after that work, immediately before committing the
			// path change, so a cursor move during the flush is not lost.
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

			if (path === currentPathRef.current) {
				setMessageContent(null);
				setReadOnly(false);
				setSaveError(null);
				setShowExplorerOnMobile(false);
				if (persistedState) {
					persistedState.path = path;
				}
				restoringCursorRef.current = false;
				pendingCursorRestoreRevisionRef.current = null;
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

			const savedPos = cursorPositionsRef.current.get(path);
			const cursorRestoreRevision =
				nextCursorRestoreRevisionRef.current++;
			restoringCursorRef.current = true;
			pendingCursorRestoreRevisionRef.current = cursorRestoreRevision;
			setCursorRestore({
				revision: cursorRestoreRevision,
				position: savedPos ?? 0,
			});
			dirtyRef.current = false;
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

			// CodeEditor restores the cursor with its document update. Apply the
			// requested focus policy once that render has committed.
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
		},
		[
			filesystem,
			flushCurrentFile,
			normalizedDocumentRoot,
			persistedState,
			persistKey,
		]
	);

	// File-open handlers own cursor restoration when currentPath changes. This
	// effect handles only a real visibility transition; tying a delayed restore
	// to currentPath can jump over cursor movement made just after a file opens.
	useEffect(() => {
		const wasVisible = wasVisibleRef.current;
		wasVisibleRef.current = isVisible;
		const visiblePath = currentPathRef.current;
		if (!visiblePath || wasVisible === isVisible) {
			return;
		}
		if (!isVisible) {
			if (restoringCursorRef.current) {
				return;
			}
			const currentPos = editorRef.current?.getCursorPosition();
			if (currentPos !== null && currentPos !== undefined) {
				cursorPositionsRef.current.set(visiblePath, currentPos);
			}
			return;
		}
		const savedPos = cursorPositionsRef.current.get(visiblePath);
		if (savedPos !== undefined) {
			editorRef.current?.setCursorPosition(savedPos);
		}
	}, [isVisible]);

	const handleClearSelection = useCallback(async () => {
		const requestIdentity: EditorIdentity = {
			filesystem,
			persistKey,
			documentRoot: normalizedDocumentRoot,
		};
		if (
			!editorIdentitiesMatch(editorIdentityRef.current, requestIdentity)
		) {
			return;
		}
		const actionId = ++delayedEditorActionIdRef.current;
		const didFlush = await flushCurrentFile({ updateState: false });
		if (
			delayedEditorActionIdRef.current !== actionId ||
			!editorIdentitiesMatch(editorIdentityRef.current, requestIdentity)
		) {
			return;
		}
		if (!didFlush) {
			setSaveState(SaveState.ERROR);
			setSaveError(
				'Could not save changes before clearing the file selection. Try again.'
			);
			return;
		}
		// The flush may wait while the editor stays interactive. Record the final
		// position only when the selection clear is ready to commit.
		const currentPos = editorRef.current?.getCursorPosition();
		if (
			currentPos !== null &&
			currentPos !== undefined &&
			currentPathRef.current
		) {
			cursorPositionsRef.current.set(currentPathRef.current, currentPos);
		}

		dirtyRef.current = false;
		currentPathRef.current = null;
		codeRef.current = '';
		restoringCursorRef.current = false;
		pendingCursorRestoreRevisionRef.current = null;
		setCursorRestore(undefined);
		setCurrentPath(null);
		if (persistedState) {
			persistedState.path = null;
		}
		setCode('');
		setMessageContent(null);
		setReadOnly(true);
		setSaveState(SaveState.IDLE);
		setSaveError(null);
	}, [
		filesystem,
		flushCurrentFile,
		normalizedDocumentRoot,
		persistedState,
		persistKey,
	]);

	/** Waits for final snapshots from earlier mounts before a file is read. */
	const handleBeforeFileRead = useCallback(
		async (filesystemToRead: AsyncWritableFilesystem) => {
			const readIdentity: EditorIdentity = {
				filesystem,
				persistKey,
				documentRoot: normalizedDocumentRoot,
			};
			if (
				filesystemToRead !== filesystem ||
				!editorIdentitiesMatch(editorIdentityRef.current, readIdentity)
			) {
				return;
			}
			await pendingIdentityFlushRef.current;
			if (
				!editorIdentitiesMatch(editorIdentityRef.current, readIdentity)
			) {
				return;
			}
			const editorQueue = getEditorWriteQueue(
				filesystemToRead,
				persistKey
			);
			await drainEditorOperations(editorQueue);
			publishEditorRecoveries(editorQueue);
		},
		[
			filesystem,
			normalizedDocumentRoot,
			persistKey,
			publishEditorRecoveries,
		]
	);

	/** Replaces the editor with a read-only file message after flushing edits. */
	const handleShowMessage = useCallback(
		async (
			_path: string | null,
			message: string | JSX.Element,
			isCurrentRequest?: FileOpenRequestGuard
		) => {
			const requestIdentity: EditorIdentity = {
				filesystem,
				persistKey,
				documentRoot: normalizedDocumentRoot,
			};
			if (
				!editorIdentitiesMatch(
					editorIdentityRef.current,
					requestIdentity
				)
			) {
				return;
			}
			const actionId = ++delayedEditorActionIdRef.current;
			const didFlush = await flushCurrentFile({ updateState: false });
			if (
				delayedEditorActionIdRef.current !== actionId ||
				!editorIdentitiesMatch(
					editorIdentityRef.current,
					requestIdentity
				) ||
				(isCurrentRequest && !isCurrentRequest())
			) {
				return;
			}
			if (!didFlush) {
				setSaveState(SaveState.ERROR);
				setSaveError(
					'Could not save changes before opening this file. Try again.'
				);
				return;
			}
			// The flush may wait while the editor stays interactive. Record the final
			// position only when the read-only message is ready to replace the file.
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

			dirtyRef.current = false;
			currentPathRef.current = null;
			restoringCursorRef.current = false;
			pendingCursorRestoreRevisionRef.current = null;
			setCursorRestore(undefined);
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
		},
		[filesystem, flushCurrentFile, normalizedDocumentRoot, persistKey]
	);

	/** Flushes the active file before a tree mutation can move or delete it. */
	const handleBeforePathChange = useCallback(
		async (path: string) => {
			const pathChangeIdentity: EditorIdentity = {
				filesystem,
				persistKey,
				documentRoot: normalizedDocumentRoot,
			};
			if (!filesystem) {
				return false;
			}
			await pendingIdentityFlushRef.current;
			if (
				!editorIdentitiesMatch(
					editorIdentityRef.current,
					pathChangeIdentity
				)
			) {
				return false;
			}
			const editorQueue = getEditorWriteQueue(filesystem, persistKey);
			await drainEditorOperations(editorQueue);
			publishEditorRecoveries(editorQueue);
			if (
				!editorIdentitiesMatch(
					editorIdentityRef.current,
					pathChangeIdentity
				)
			) {
				return false;
			}
			while (pathContainsPath(path, currentPathRef.current)) {
				const pathBeingFlushed = currentPathRef.current;
				const didFlush = await flushCurrentFile({ filesystem });
				if (!didFlush) {
					setSaveError(
						'Could not save changes before modifying this file. Try again.'
					);
					return false;
				}
				if (
					!editorIdentitiesMatch(
						editorIdentityRef.current,
						pathChangeIdentity
					)
				) {
					return false;
				}
				if (currentPathRef.current === pathBeingFlushed) {
					break;
				}
			}

			const affectedCurrentPath = pathContainsPath(
				path,
				currentPathRef.current
			);
			// A duplicate async submit can reach this point before the first
			// mutation installs its barrier. Only one completion callback can own a
			// given source path, so veto the duplicate rather than leak a promise.
			if (pendingPathChangesRef.current.has(path)) {
				return false;
			}
			if (affectedCurrentPath) {
				// No new snapshot may target the old name while mv/unlink/rmdir is
				// in flight. Writes also wait on the shared path-change barrier below.
				delayedEditorActionIdRef.current += 1;
				setReadOnly(true);
			}
			/** Releases writes queued behind this approved path mutation. */
			let releasePathChange = () => {};
			const pathChange = new Promise<void>((resolve) => {
				releasePathChange = resolve;
			});
			editorQueue.pendingPathChanges = Promise.all([
				editorQueue.pendingPathChanges.catch(() => undefined),
				pathChange,
			]).then(() => undefined);
			pendingPathChangesRef.current.set(path, {
				identity: pathChangeIdentity,
				persistedState,
				affectedCurrentPath,
				release: releasePathChange,
			});
			return true;
		},
		[
			filesystem,
			flushCurrentFile,
			normalizedDocumentRoot,
			persistedState,
			persistKey,
			publishEditorRecoveries,
		]
	);

	/** Remaps live and persisted editor state after a filesystem move succeeds. */
	const handlePathMoved = useCallback(
		(from: string, to: string) => {
			const pendingPathChange = pendingPathChangesRef.current.get(from);
			const stateToRemap =
				pendingPathChange?.persistedState ?? persistedState;
			if (stateToRemap) {
				remapCursorPositions(stateToRemap.cursors, from, to);
				stateToRemap.path = remapPathAfterMove(
					stateToRemap.path,
					from,
					to
				);
			}
			if (
				!mountedRef.current ||
				(pendingPathChange &&
					!editorIdentitiesMatch(
						editorIdentityRef.current,
						pendingPathChange.identity
					))
			) {
				return;
			}
			const activePath = currentPathRef.current;
			const mappedCurrentPath = remapPathAfterMove(activePath, from, to);
			if (activePath && mappedCurrentPath !== activePath) {
				const cursor = editorRef.current?.getCursorPosition();
				if (cursor !== null && cursor !== undefined) {
					cursorPositionsRef.current.set(activePath, cursor);
				}
			}

			remapCursorPositions(cursorPositionsRef.current, from, to);
			setSelectedDirPath((previous) =>
				remapPathAfterMove(previous, from, to)
			);
			if (!activePath || mappedCurrentPath === activePath) {
				return;
			}

			if (saveTimeoutRef.current !== null) {
				window.clearTimeout(saveTimeoutRef.current);
				saveTimeoutRef.current = null;
			}
			delayedEditorActionIdRef.current += 1;
			restoringCursorRef.current = false;
			pendingCursorRestoreRevisionRef.current = null;
			currentPathRef.current = mappedCurrentPath;
			setCurrentPath(mappedCurrentPath);
			setSaveState(SaveState.IDLE);
			setSaveError(null);
		},
		[persistedState]
	);

	/** Purges deleted paths before the tree can report its cleared selection. */
	const handlePathDeleted = useCallback(
		(path: string) => {
			const pendingPathChange = pendingPathChangesRef.current.get(path);
			const stateToClear =
				pendingPathChange?.persistedState ?? persistedState;
			if (stateToClear) {
				removeCursorPositionsForPath(stateToClear.cursors, path);
				if (pathContainsPath(path, stateToClear.path)) {
					stateToClear.path = null;
				}
			}
			if (
				!mountedRef.current ||
				(pendingPathChange &&
					!editorIdentitiesMatch(
						editorIdentityRef.current,
						pendingPathChange.identity
					))
			) {
				return;
			}
			if (!stateToClear) {
				removeCursorPositionsForPath(cursorPositionsRef.current, path);
			}
			const fallbackDirectory =
				resolvePathUnder(dirname(path), normalizedDocumentRoot) ??
				normalizedDocumentRoot;
			setSelectedDirPath((previous) =>
				pathContainsPath(path, previous) ? fallbackDirectory : previous
			);

			const activePath = currentPathRef.current;
			if (!pathContainsPath(path, activePath)) {
				return;
			}
			if (saveTimeoutRef.current !== null) {
				window.clearTimeout(saveTimeoutRef.current);
				saveTimeoutRef.current = null;
			}
			delayedEditorActionIdRef.current += 1;
			dirtyRef.current = false;
			restoringCursorRef.current = false;
			pendingCursorRestoreRevisionRef.current = null;
			currentPathRef.current = null;
			codeRef.current = '';
			setCursorRestore(undefined);
			setCurrentPath(null);
			setCode('');
			setMessageContent(null);
			setReadOnly(true);
			setSaveState(SaveState.IDLE);
			setSaveError(null);
			setShowExplorerOnMobile(false);
		},
		[normalizedDocumentRoot, persistedState]
	);

	/** Releases shared mutation ordering and restores editing after failures. */
	const handlePathChangeComplete = useCallback(
		(path: string, outcome: FilePickerPathChangeOutcome) => {
			const pendingPathChange = pendingPathChangesRef.current.get(path);
			if (!pendingPathChange) {
				return;
			}
			pendingPathChangesRef.current.delete(path);
			pendingPathChange.release();
			if (
				!pendingPathChange.affectedCurrentPath ||
				!mountedRef.current ||
				!editorIdentitiesMatch(
					editorIdentityRef.current,
					pendingPathChange.identity
				)
			) {
				return;
			}
			if (outcome !== 'deleted') {
				setReadOnly(false);
			}
		},
		[]
	);

	/**
	 * Saves immediately from the button or keyboard shortcut.
	 *
	 * Unlike the debounced save, this also retries an error immediately. A clean
	 * buffer is already saved and must not overwrite an external filesystem edit.
	 */
	const handleManualSave = useCallback(async () => {
		const activeFilesystem = filesystemRef.current;
		if (!activeFilesystem || !currentPathRef.current) {
			return;
		}
		if (saveTimeoutRef.current !== null) {
			window.clearTimeout(saveTimeoutRef.current);
			saveTimeoutRef.current = null;
		}
		if (!dirtyRef.current) {
			setSaveState(SaveState.SAVED);
			setSaveError(null);
			return;
		}
		const pathToSave = currentPathRef.current;
		const contentToSave = codeRef.current;
		const saveActionId = delayedEditorActionIdRef.current;
		setSaveState(SaveState.SAVING);
		try {
			const didWrite = await queueFileWrite({
				filesystem: activeFilesystem,
				persistKey: persistKeyRef.current,
				path: pathToSave,
				content: contentToSave,
				shouldWrite: () =>
					dirtyRef.current &&
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
			if (didWrite) {
				dirtyRef.current = false;
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
	}, [queueFileWrite]);

	/** Mirrors CodeMirror changes into both React state and async save refs. */
	const handleCodeChange = useCallback((newCode: string) => {
		if (newCode === codeRef.current) {
			return;
		}
		dirtyRef.current = true;
		codeRef.current = newCode;
		setCode(newCode);
	}, []);

	const saveButtonLabel = getSaveButtonLabel(saveState);
	const saveButtonStateClassName = getSaveButtonStateClassName(
		saveState,
		styles
	);
	const recoveryPanel = filesystemRecoveries.length ? (
		<div className={styles['recovery']}>
			{filesystemRecoveries.map((recovery) => (
				<React.Fragment key={recovery.id}>
					<Notice status="error" isDismissible={false}>
						Unsaved changes
						{recovery.path ? ` from ${recovery.path}` : ''} were not
						written. Copy this buffer if you still need it.
					</Notice>
					<textarea
						readOnly
						className={styles['recoveryBuffer']}
						value={recovery.content}
						aria-label="Recovered unsaved file buffer"
					/>
					<Button
						variant="secondary"
						onClick={() => {
							recovery.discard();
							setFilesystemRecoveries((visibleRecoveries) =>
								visibleRecoveries.filter(
									(candidate) => candidate.id !== recovery.id
								)
							);
						}}
					>
						Dismiss recovered buffer
					</Button>
				</React.Fragment>
			))}
		</div>
	) : null;

	if (!filesystem) {
		return (
			<div className={styles['container']}>
				<div className={styles['placeholder']}>{placeholderText}</div>
				{recoveryPanel}
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
						requestIdentity={persistKey}
						currentPath={currentPath}
						selectedDirPath={selectedDirPath}
						setSelectedDirPath={setSelectedDirPath}
						onFileOpened={handleFileOpened}
						onSelectionCleared={handleClearSelection}
						onBeforeFileRead={handleBeforeFileRead}
						onShowMessage={handleShowMessage}
						onBeforePathChange={handleBeforePathChange}
						onPathMoved={handlePathMoved}
						onPathDeleted={handlePathDeleted}
						onPathChangeComplete={handlePathChangeComplete}
						documentRoot={normalizedDocumentRoot}
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
								: `Browse files under ${normalizedDocumentRoot}`}
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
					{recoveryPanel}
					{currentPath || code || messageContent ? (
						messageContent ? (
							<div className={styles['messageArea']}>
								{messageContent}
							</div>
						) : (
							<CodeEditor
								ref={editorRef}
								code={code}
								cursorRestore={cursorRestore}
								onCursorRestoreApplied={
									handleCursorRestoreApplied
								}
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

/** Remaps every saved cursor whose file moved with a renamed subtree. */
function remapCursorPositions(
	cursorPositions: Map<string, number>,
	from: string,
	to: string
) {
	for (const [path, position] of [...cursorPositions.entries()]) {
		const mappedPath = remapPathAfterMove(path, from, to);
		if (mappedPath && mappedPath !== path) {
			cursorPositions.delete(path);
			cursorPositions.set(mappedPath, position);
		}
	}
}

/** Removes saved cursors for a deleted path and all of its descendants. */
function removeCursorPositionsForPath(
	cursorPositions: Map<string, number>,
	pathToRemove: string
) {
	for (const path of [...cursorPositions.keys()]) {
		if (pathContainsPath(pathToRemove, path)) {
			cursorPositions.delete(path);
		}
	}
}

/**
 * Returns editor state scoped to both the caller key and filesystem root.
 *
 * A Playground can expose more than one root over its lifetime. Keeping a
 * separate entry per root prevents a remembered path or cursor from escaping
 * into a newly selected root that happens to use the same `persistKey`.
 */
function getPersistedEditorState(
	key: string,
	documentRoot: string
): PersistedEditorState {
	let statesByRoot = persistedEditorStates.get(key);
	if (!statesByRoot) {
		statesByRoot = new Map();
		persistedEditorStates.set(key, statesByRoot);
	}
	let state = statesByRoot.get(documentRoot);
	if (!state) {
		state = { path: null, cursors: new Map() };
		statesByRoot.set(documentRoot, state);
	}
	return state;
}

/**
 * Returns the queue shared by `persistKey`, or by filesystem object when unkeyed.
 *
 * The keyed form deliberately spans filesystem and root changes so the new
 * editor cannot read before its previous mount finishes flushing.
 */
function getEditorWriteQueue(
	filesystem: AsyncWritableFilesystem,
	persistKey: string | undefined
) {
	if (persistKey !== undefined) {
		let queue = persistedWriteQueues.get(persistKey);
		if (!queue) {
			queue = createEditorWriteQueue();
			persistedWriteQueues.set(persistKey, queue);
		}
		return queue;
	}
	let queue = filesystemWriteQueues.get(filesystem);
	if (!queue) {
		queue = createEditorWriteQueue();
		filesystemWriteQueues.set(filesystem, queue);
	}
	return queue;
}

/** Creates an empty queue for writes, path mutations, and failed snapshots. */
function createEditorWriteQueue(): EditorWriteQueue {
	return {
		pending: Promise.resolve(),
		pendingPathChanges: Promise.resolve(),
		recoveries: [],
		recoveryListeners: new Set(),
	};
}

/** Returns an existing queue without manufacturing identity for a null source. */
function getExistingEditorWriteQueue(
	filesystem: AsyncWritableFilesystem | null,
	persistKey: string | undefined
) {
	if (persistKey !== undefined) {
		return persistedWriteQueues.get(persistKey);
	}
	return filesystem ? filesystemWriteQueues.get(filesystem) : undefined;
}

/** Retains one failed snapshot in its owner queue until the user dismisses it. */
function addEditorRecovery(
	queue: EditorWriteQueue,
	path: string | null,
	content: string
) {
	const existing = queue.recoveries.find(
		(recovery) => recovery.path === path && recovery.content === content
	);
	if (existing) {
		return existing;
	}
	const id = nextEditorRecoveryId++;
	const recovery: FilesystemRecovery = {
		id,
		path,
		content,
		discard: () => {
			queue.recoveries = queue.recoveries.filter(
				(candidate) => candidate.id !== id
			);
		},
	};
	queue.recoveries.push(recovery);
	for (const listener of queue.recoveryListeners) {
		listener();
	}
	return recovery;
}

/** Appends recoveries by identity without duplicating an existing panel. */
function mergeEditorRecoveries(
	current: FilesystemRecovery[],
	incoming: FilesystemRecovery[]
) {
	const currentIds = new Set(current.map((recovery) => recovery.id));
	const additions = incoming.filter(
		(recovery) => !currentIds.has(recovery.id)
	);
	return additions.length ? [...current, ...additions] : current;
}

/** Reports whether async work still belongs to the rendered editor identity. */
function editorIdentitiesMatch(left: EditorIdentity, right: EditorIdentity) {
	return (
		left.filesystem === right.filesystem &&
		left.persistKey === right.persistKey &&
		left.documentRoot === right.documentRoot
	);
}

/** Waits until writes and path mutations stay empty for one async turn. */
async function drainEditorOperations(queue: EditorWriteQueue) {
	while (true) {
		const pendingWrite = queue.pending;
		const pendingPathChanges = queue.pendingPathChanges;
		await Promise.all([pendingWrite, pendingPathChanges]);
		if (
			queue.pending === pendingWrite &&
			queue.pendingPathChanges === pendingPathChanges
		) {
			return;
		}
	}
}

/** Returns the action label that corresponds to the editor's save state. */
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

/** Returns the success tint used only while the file is in sync with disk. */
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
