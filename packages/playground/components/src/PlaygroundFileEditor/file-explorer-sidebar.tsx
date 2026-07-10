import React, {
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type Dispatch,
	type SetStateAction,
} from 'react';
import classNames from 'classnames';
import { Icon, Notice } from '@wordpress/components';
import { upload } from '@wordpress/icons';
import styles from './file-explorer.module.css';
import {
	FilePickerTree,
	type FilePickerPathChangeOutcome,
	type FilePickerTreeHandle,
} from '../FilePickerTree';
import { BinaryFilePreview } from '../BinaryFilePreview';
import type { AsyncWritableFilesystem } from '@wp-playground/storage';
import { logger } from '@php-wasm/logger';
import {
	basename,
	dirname,
	ensureAbsolutePath,
	joinPaths,
	normalizePath,
} from '@php-wasm/util';
import {
	seemsLikeBinary,
	createDownloadUrl,
	getMimeType,
	isPreviewableBinary,
	MAX_INLINE_FILE_BYTES,
	readFileForInlinePreview,
} from './file-utils';
import {
	isValidPosixPathSegment,
	pathContainsPath,
	remapPathAfterMove,
	resolvePathAtOrUnder,
} from '../file-tree-paths';
import { serializeFilesystemOperation } from '../filesystem-operation-queue';

const filePlusIcon = (
	<svg viewBox="0 0 32 32" width="24" height="24" aria-hidden="true">
		<path
			d="M11 6h7l5 5v12a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinejoin="round"
		/>
		<path
			d="M18 6v5h5"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinejoin="round"
		/>
		<g transform="translate(19 19)">
			<circle cx="5" cy="5" r="8" fill="var(--paper-2, #fff)" />
			<path
				d="M5 1.5v7M1.5 5h7"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
			/>
		</g>
	</svg>
);

const folderPlusIcon = (
	<svg viewBox="0 0 32 32" width="24" height="24" aria-hidden="true">
		<path
			d="M6 9h7l3 3h10v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9z"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinejoin="round"
		/>
		<path
			d="M6 9V8a2 2 0 0 1 2-2h5l3 3"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinejoin="round"
		/>
		<g transform="translate(19 19)">
			<circle cx="5" cy="5" r="8" fill="var(--paper-2, #fff)" />
			<path
				d="M5 1.5v7M1.5 5h7"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
			/>
		</g>
	</svg>
);

/** Reports whether an asynchronous file-open request may still update state. */
export type FileOpenRequestGuard = () => boolean;

export type FileExplorerSidebarProps = {
	/**
	 * Filesystem object identity owns async explorer work. Replace the object
	 * whenever its backing storage changes.
	 */
	filesystem: AsyncWritableFilesystem;
	/**
	 * Distinguishes owners that share a filesystem/root. Callbacks captured by an
	 * already-started mutation still settle against their original owner.
	 */
	requestIdentity?: string;
	currentPath: string | null;
	selectedDirPath: string | null;
	setSelectedDirPath: Dispatch<SetStateAction<string | null>>;
	/**
	 * Opens decoded file content. Async hosts must recheck `isCurrentRequest`
	 * after every await before replacing their editor state.
	 */
	onFileOpened: (
		path: string,
		content: string,
		shouldFocus?: boolean,
		isCurrentRequest?: FileOpenRequestGuard
	) => Promise<void> | void;
	onSelectionCleared: () => Promise<void> | void;
	/** Waits for writes owned by an earlier editor mount before reading a file. */
	onBeforeFileRead?: (
		filesystem: AsyncWritableFilesystem
	) => Promise<void> | void;
	/**
	 * Displays a file preview or read error. Async hosts must recheck
	 * `isCurrentRequest` after every await before replacing their preview state.
	 */
	onShowMessage: (
		path: string | null,
		message: string | JSX.Element,
		isCurrentRequest?: FileOpenRequestGuard
	) => Promise<void> | void;
	/**
	 * Runs before an existing path is moved, renamed, or deleted. Returning
	 * false, or throwing, cancels the mutation.
	 */
	onBeforePathChange?: (
		path: string
	) => Promise<boolean | void> | boolean | void;
	/** Reports a successful move to the host closure that approved it. */
	onPathMoved?: (from: string, to: string) => Promise<void> | void;
	/** Reports a successful deletion to the host closure that approved it. */
	onPathDeleted?: (path: string) => Promise<void> | void;
	/**
	 * Releases host coordination after an approved path change settles or aborts.
	 * It may outlive this owner, so hosts must identity-guard live UI state.
	 */
	onPathChangeComplete?: (
		path: string,
		outcome: FilePickerPathChangeOutcome
	) => Promise<void> | void;
	documentRoot: string;
	/** Disable file creation, uploads, renames, deletes, and moves. */
	readOnly?: boolean;
};

/**
 * Browses one filesystem root without owning the editor state.
 *
 * File reads are request-ordered so a slow selection cannot replace a newer
 * one. Tree mutations and recursive drop imports remain delegated to
 * `FilePickerTree`; this component chooses background upload targets and owns
 * uploads from the file input.
 */
export function FileExplorerSidebar({
	filesystem,
	requestIdentity,
	currentPath,
	selectedDirPath,
	setSelectedDirPath,
	onFileOpened,
	onSelectionCleared,
	onBeforeFileRead,
	onShowMessage,
	onBeforePathChange,
	onPathMoved,
	onPathDeleted,
	onPathChangeComplete,
	documentRoot,
	readOnly = false,
}: FileExplorerSidebarProps) {
	const treeRef = useRef<FilePickerTreeHandle | null>(null);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const uploadInputRef = useRef<HTMLInputElement | null>(null);
	const openFileRequestIdRef = useRef(0);
	// Track the path through both directory classification and file reading so a
	// concurrent move or delete can invalidate the whole selection request.
	const pendingFileOpenPathRef = useRef<string | null>(null);
	const normalizedDocumentRoot = useMemo(
		() => ensureAbsolutePath(documentRoot),
		[documentRoot]
	);
	const filesystemGenerationRef = useRef({
		filesystem,
		documentRoot: normalizedDocumentRoot,
		requestIdentity,
		value: 0,
	});

	useLayoutEffect(() => {
		return () => {
			// Async work may finish against an unmounted filesystem, but must not
			// update whichever explorer replaces it.
			filesystemGenerationRef.current.value += 1;
			openFileRequestIdRef.current += 1;
			pendingFileOpenPathRef.current = null;
		};
	}, []);

	const treeInitialPath = useMemo(() => {
		return normalizePath(
			currentPath
				? dirname(normalizePath(currentPath))
				: (selectedDirPath ?? normalizedDocumentRoot)
		);
		// Prevent tree from jumping unexpectedly when selectedDirPath changes.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentPath, normalizedDocumentRoot]);

	const [lastSelectedPath, setLastSelectedPath] = useState<string | null>(
		null
	);
	const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);
	const [uploadError, setUploadError] = useState<string | null>(null);

	useLayoutEffect(() => {
		const previousSource = filesystemGenerationRef.current;
		if (
			previousSource.filesystem === filesystem &&
			previousSource.documentRoot === normalizedDocumentRoot &&
			previousSource.requestIdentity === requestIdentity
		) {
			return;
		}
		// Invalidate old reads before the replacement explorer can be painted or
		// interacted with. A matching path in another filesystem is still a
		// different selection.
		filesystemGenerationRef.current = {
			filesystem,
			documentRoot: normalizedDocumentRoot,
			requestIdentity,
			value: previousSource.value + 1,
		};
		openFileRequestIdRef.current += 1;
		pendingFileOpenPathRef.current = null;
		setLastSelectedPath(null);
		setSelectedDirPath(normalizedDocumentRoot);
		setIsDraggingSidebar(false);
		setUploadError(null);
	}, [
		filesystem,
		normalizedDocumentRoot,
		requestIdentity,
		setSelectedDirPath,
	]);

	// Mirror the editor's open file into the tree selection. The tree's
	// initialSelectedPath only applies on mount and points at the parent
	// directory, so when the editor restores a file (e.g. reopening the panel
	// via persistKey) the open file would otherwise stay unhighlighted. Expand
	// to it and select it without moving DOM focus, so focus stays wherever the
	// editor put it.
	useEffect(() => {
		if (!currentPath) {
			return;
		}
		let cancelled = false;
		void (async () => {
			await treeRef.current?.expandToPath(currentPath);
			if (cancelled) {
				return;
			}
			treeRef.current?.focusPath(currentPath, {
				select: true,
				domFocus: false,
				notify: false,
			});
		})();
		return () => {
			cancelled = true;
		};
	}, [currentPath]);

	/** Distinguishes tree moves from files dragged in from the host system. */
	const isInternalDrag = (event: React.DragEvent) =>
		event.dataTransfer?.types?.includes('application/x-wp-playground-path');

	/** Finds the selected directory that can receive uploaded files. */
	const resolveUploadDirectory = async () => {
		const candidates = [
			lastSelectedPath,
			currentPath,
			selectedDirPath,
			normalizedDocumentRoot,
		].filter(Boolean) as string[];
		for (const candidate of candidates) {
			const normalizedCandidate = resolvePathAtOrUnder(
				candidate,
				normalizedDocumentRoot
			);
			if (!normalizedCandidate) {
				continue;
			}
			if (await filesystem.isDir(normalizedCandidate)) {
				return normalizedCandidate;
			}
			const parent = resolvePathAtOrUnder(
				dirname(normalizedCandidate),
				normalizedDocumentRoot
			);
			if (!parent) {
				continue;
			}
			if (await filesystem.isDir(parent)) {
				return parent;
			}
		}
		return normalizedDocumentRoot;
	};

	/**
	 * Chooses an unused upload path without changing any bytes in the file name.
	 *
	 * Metadata errors are allowed to reject the upload. Treating an unchecked
	 * path as available could overwrite a file that the explorer failed to stat.
	 */
	const getAvailablePath = async (baseDir: string, desiredName: string) => {
		const safeName = desiredName || 'upload';
		if (!isValidPosixPathSegment(safeName)) {
			throw new Error(`Invalid uploaded file name: ${safeName}`);
		}
		const basePath = baseDir === '/' ? '/' : baseDir;
		let counter = 0;
		while (true) {
			const { stem, extension } = splitFileExtension(safeName);
			const suffix = counter ? ` (${counter})` : '';
			const candidateName = `${stem}${suffix}${extension}`;
			const candidatePath = resolvePathAtOrUnder(
				joinPaths(basePath, candidateName),
				normalizedDocumentRoot
			);
			if (!candidatePath) {
				throw new Error(
					`Upload path escapes the document root: ${candidateName}`
				);
			}
			const fileExists = await filesystem.fileExists(candidatePath);
			const directoryExists = fileExists
				? false
				: await filesystem.isDir(candidatePath);
			if (!fileExists && !directoryExists) {
				return candidatePath;
			}
			counter += 1;
		}
	};

	/** Uploads a batch, then refreshes the tree once for all successful files. */
	const importFileList = async (files: FileList | File[]) => {
		if (readOnly || !files || !files.length) {
			return;
		}
		const capturedFiles = Array.from(files);
		setUploadError(null);
		const filesystemGeneration = filesystemGenerationRef.current.value;
		await serializeFilesystemOperation(filesystem, async () => {
			if (
				filesystemGeneration !== filesystemGenerationRef.current.value
			) {
				return;
			}
			let baseDir: string;
			try {
				baseDir = await resolveUploadDirectory();
			} catch (error) {
				if (
					filesystemGeneration ===
					filesystemGenerationRef.current.value
				) {
					logger.error('Failed to resolve upload directory', error);
					setUploadError(
						'Could not inspect the selected upload folder.'
					);
				}
				return;
			}
			if (
				filesystemGeneration !== filesystemGenerationRef.current.value
			) {
				return;
			}
			const createdPaths: string[] = [];
			let failedCount = 0;
			let refreshFailed = false;
			for (const file of capturedFiles) {
				if (
					filesystemGeneration !==
					filesystemGenerationRef.current.value
				) {
					return;
				}
				try {
					const buffer = new Uint8Array(await file.arrayBuffer());
					if (
						filesystemGeneration !==
						filesystemGenerationRef.current.value
					) {
						return;
					}
					const targetPath = await getAvailablePath(
						baseDir,
						file.name
					);
					if (
						filesystemGeneration !==
						filesystemGenerationRef.current.value
					) {
						return;
					}
					await filesystem.writeFile(targetPath, buffer);
					if (
						filesystemGeneration !==
						filesystemGenerationRef.current.value
					) {
						return;
					}
					createdPaths.push(targetPath);
				} catch (error) {
					failedCount += 1;
					logger.error('Failed to import file', error);
				}
			}
			if (
				filesystemGeneration !== filesystemGenerationRef.current.value
			) {
				return;
			}
			if (createdPaths.length) {
				setLastSelectedPath(baseDir);
				try {
					await treeRef.current?.refresh(baseDir);
				} catch (error) {
					if (
						filesystemGeneration !==
						filesystemGenerationRef.current.value
					) {
						return;
					}
					logger.error('Failed to refresh files after upload', error);
					refreshFailed = true;
				}
			}
			if (
				filesystemGeneration !== filesystemGenerationRef.current.value
			) {
				return;
			}
			const failedFilesMessage = `Could not upload ${
				failedCount === 1 ? '1 file' : `${failedCount} files`
			}.`;
			if (refreshFailed) {
				setUploadError(
					failedCount
						? `${failedFilesMessage} Other files were uploaded, but the file list could not be refreshed.`
						: 'Files were uploaded, but the file list could not be refreshed.'
				);
			} else if (failedCount) {
				setUploadError(failedFilesMessage);
			}
		});
	};

	/** Imports the selected files and clears the input so they can be reselected. */
	const handleUploadInputChange = async (
		event: React.ChangeEvent<HTMLInputElement>
	) => {
		try {
			await importFileList(event.target.files ?? []);
		} finally {
			// Reset input so the same file selection can be chosen again.
			event.target.value = '';
		}
	};

	/** Shows the upload target only for writable external file drags. */
	const handleSidebarDragEnter = (event: React.DragEvent) => {
		if (readOnly) {
			event.preventDefault();
			event.dataTransfer.dropEffect = 'none';
			return;
		}
		if (isInternalDrag(event)) {
			return;
		}
		event.preventDefault();
		setIsDraggingSidebar(true);
	};

	/** Keeps the browser from taking over a writable external file drop. */
	const handleSidebarDragOver = (event: React.DragEvent) => {
		if (readOnly) {
			event.preventDefault();
			event.dataTransfer.dropEffect = 'none';
			return;
		}
		if (isInternalDrag(event)) {
			return;
		}
		event.preventDefault();
		event.dataTransfer.dropEffect = 'copy';
		setIsDraggingSidebar(true);
	};

	/** Clears the upload target after the pointer leaves the whole explorer. */
	const handleSidebarDragLeave = (event: React.DragEvent) => {
		const related = event.relatedTarget as Node | null;
		if (related && containerRef.current?.contains(related)) {
			return;
		}
		setIsDraggingSidebar(false);
	};

	/** Clears external-drop feedback before either drop handler can stop bubbling. */
	const handleSidebarDropCapture = () => {
		setIsDraggingSidebar(false);
	};

	/** Imports host files and directories without intercepting tree moves. */
	const handleSidebarDrop = async (event: React.DragEvent) => {
		if (readOnly) {
			event.preventDefault();
			setIsDraggingSidebar(false);
			return;
		}
		if (isInternalDrag(event)) {
			return;
		}
		event.preventDefault();
		setIsDraggingSidebar(false);
		setUploadError(null);
		const filesystemGeneration = filesystemGenerationRef.current.value;
		try {
			await treeRef.current?.importExternalItems(
				event.dataTransfer,
				lastSelectedPath ??
					currentPath ??
					selectedDirPath ??
					normalizedDocumentRoot
			);
		} catch (error) {
			if (
				filesystemGeneration !== filesystemGenerationRef.current.value
			) {
				return;
			}
			logger.error(
				'Failed to import dropped files or directories',
				error
			);
			setUploadError(
				'Could not import the dropped files or directories.'
			);
		}
	};

	/**
	 * Opens the latest requested file and discards reads superseded by selection.
	 */
	const handleOpenFile = async (path: string, shouldFocus: boolean) => {
		const fileOpenSource = filesystemGenerationRef.current;
		if (
			fileOpenSource.filesystem !== filesystem ||
			fileOpenSource.documentRoot !== normalizedDocumentRoot ||
			fileOpenSource.requestIdentity !== requestIdentity
		) {
			return;
		}
		const requestId = ++openFileRequestIdRef.current;
		const filesystemGeneration = fileOpenSource.value;
		pendingFileOpenPathRef.current = path;
		/** Reports whether this read still owns the preview surface. */
		const isCurrentRequest = () =>
			filesystemGenerationRef.current.value === filesystemGeneration &&
			openFileRequestIdRef.current === requestId &&
			pendingFileOpenPathRef.current === path;
		try {
			await onBeforeFileRead?.(filesystem);
			if (!isCurrentRequest()) {
				return;
			}
			const file = await filesystem.read(path);
			if (!isCurrentRequest()) {
				return;
			}
			const previewRead = await readFileForInlinePreview(file);
			if (!isCurrentRequest()) {
				return;
			}
			if (previewRead.type === 'too-large') {
				const maxInlineMegabytes = MAX_INLINE_FILE_BYTES / 1024 / 1024;
				await showFileMessage(
					path,
					<>
						<p>{`File too large to open (>${maxInlineMegabytes}MB).`}</p>
						<p>
							Open or download it outside the in-browser editor.
						</p>
					</>,
					isCurrentRequest
				);
				return;
			}
			const data = previewRead.data;
			const filename = basename(path) || 'download';

			if (seemsLikeBinary(data)) {
				const mimeType = getMimeType(filename);
				const { url: downloadUrl, filename: fname } = createDownloadUrl(
					data,
					filename
				);
				if (!isCurrentRequest()) {
					URL.revokeObjectURL(downloadUrl);
					return;
				}

				// Check if this is a previewable binary file
				if (isPreviewableBinary(mimeType)) {
					// Create a data URL for the preview
					const blob = new Blob([data], { type: mimeType });
					const dataUrl = URL.createObjectURL(blob);
					if (!isCurrentRequest()) {
						URL.revokeObjectURL(dataUrl);
						URL.revokeObjectURL(downloadUrl);
						return;
					}

					await showFileMessage(
						path,
						<BinaryFilePreview
							filename={fname}
							mimeType={mimeType}
							dataUrl={dataUrl}
							downloadUrl={downloadUrl}
						/>,
						isCurrentRequest
					);
					return;
				}

				// Non-previewable binary file
				await showFileMessage(
					path,
					<>
						<p>Binary file. Cannot be edited.</p>
						<p>
							<a href={downloadUrl} download={fname}>
								Download {fname}
							</a>
						</p>
					</>,
					isCurrentRequest
				);
				return;
			}

			const text = new TextDecoder('utf-8').decode(data);
			if (!isCurrentRequest()) {
				return;
			}
			await openFileInEditor(path, text, shouldFocus, isCurrentRequest);
		} catch (error) {
			if (!isCurrentRequest()) {
				return;
			}
			logger.error('Could not open file', error);
			await showFileMessage(
				null,
				'Could not open file.',
				isCurrentRequest
			);
		} finally {
			if (isCurrentRequest()) {
				pendingFileOpenPathRef.current = null;
			}
		}
	};

	/** Invalidates any file read that has not reached the preview surface yet. */
	function cancelPendingFileOpen() {
		openFileRequestIdRef.current += 1;
		pendingFileOpenPathRef.current = null;
	}

	/** Displays a preview message without letting a host callback break the tree. */
	async function showFileMessage(
		path: string | null,
		message: string | JSX.Element,
		isCurrentRequest: FileOpenRequestGuard
	) {
		if (!isCurrentRequest()) {
			return;
		}
		try {
			await onShowMessage(path, message, isCurrentRequest);
		} catch (error) {
			if (isCurrentRequest()) {
				logger.error('Could not show file message', error);
			}
		}
	}

	/** Hands decoded text to the editor without letting a host callback escape. */
	async function openFileInEditor(
		path: string,
		content: string,
		shouldFocus: boolean,
		isCurrentRequest: FileOpenRequestGuard
	) {
		try {
			await onFileOpened(path, content, shouldFocus, isCurrentRequest);
		} catch (error) {
			logger.error('Could not switch files', error);
		}
	}

	/** Keeps the upload target attached to a subtree after the tree moves it. */
	async function handlePathMoved(from: string, to: string) {
		const currentSource = filesystemGenerationRef.current;
		if (
			currentSource.filesystem === filesystem &&
			currentSource.documentRoot === normalizedDocumentRoot &&
			currentSource.requestIdentity === requestIdentity
		) {
			if (pathContainsPath(from, pendingFileOpenPathRef.current)) {
				cancelPendingFileOpen();
			}
			setLastSelectedPath((previous) =>
				remapPathAfterMove(previous, from, to)
			);
		}
		await onPathMoved?.(from, to);
	}

	/** Clears the upload target when the tree deletes that path or an ancestor. */
	async function handlePathDeleted(path: string) {
		const currentSource = filesystemGenerationRef.current;
		if (
			currentSource.filesystem === filesystem &&
			currentSource.documentRoot === normalizedDocumentRoot &&
			currentSource.requestIdentity === requestIdentity
		) {
			if (pathContainsPath(path, pendingFileOpenPathRef.current)) {
				cancelPendingFileOpen();
			}
			setLastSelectedPath((previous) =>
				pathContainsPath(path, previous) ? null : previous
			);
		}
		await onPathDeleted?.(path);
	}

	/** Shows an import error produced by a drop on a visible tree row. */
	async function handleImportError(error: unknown) {
		const importSource = filesystemGenerationRef.current;
		if (
			importSource.filesystem !== filesystem ||
			importSource.documentRoot !== normalizedDocumentRoot ||
			importSource.requestIdentity !== requestIdentity
		) {
			return;
		}
		logger.error('Failed to import dropped files or directories', error);
		setUploadError(
			error instanceof Error &&
				error.message ===
					'Files were imported, but the file list could not be refreshed.'
				? error.message
				: 'Could not import the dropped files or directories.'
		);
	}

	return (
		<div
			ref={containerRef}
			className={classNames(styles['fileExplorerContainer'], {
				[styles['dropActive']]: isDraggingSidebar,
			})}
			onDragEnter={handleSidebarDragEnter}
			onDragOver={handleSidebarDragOver}
			onDragLeave={handleSidebarDragLeave}
			onDropCapture={handleSidebarDropCapture}
			onDrop={handleSidebarDrop}
		>
			<div className={styles['fileExplorerHeader']}>
				<span className={styles['fileExplorerTitle']}>Files</span>
				<div className={styles['fileExplorerActions']}>
					{!readOnly && (
						<>
							<button
								className={classNames(
									styles['fileExplorerButton'],
									styles['fileExplorerIconButton']
								)}
								type="button"
								onClick={() => {
									if (!treeRef.current) {
										return;
									}
									void treeRef.current.createFile(
										lastSelectedPath ?? undefined
									);
								}}
								title="Create new file"
								aria-label="Create new file"
							>
								{filePlusIcon}
							</button>
							<button
								className={classNames(
									styles['fileExplorerButton'],
									styles['fileExplorerIconButton']
								)}
								type="button"
								onClick={() => {
									if (!treeRef.current) {
										return;
									}
									void treeRef.current.createFolder(
										lastSelectedPath ?? undefined
									);
								}}
								title="Create new folder"
								aria-label="Create new folder"
							>
								{folderPlusIcon}
							</button>
							<button
								className={classNames(
									styles['fileExplorerButton'],
									styles['fileExplorerIconButton'],
									styles['fileExplorerUploadButton']
								)}
								type="button"
								onClick={() => uploadInputRef.current?.click()}
								title="Upload files"
								aria-label="Upload files"
							>
								<Icon icon={upload} size={16} />
							</button>
							<input
								ref={uploadInputRef}
								name="playground-file-upload"
								type="file"
								multiple
								style={{ display: 'none' }}
								onChange={handleUploadInputChange}
							/>
						</>
					)}
				</div>
			</div>
			{uploadError ? (
				<div className={styles['uploadError']}>
					<Notice
						status="error"
						isDismissible
						onRemove={() => setUploadError(null)}
					>
						{uploadError}
					</Notice>
				</div>
			) : null}
			<div className={styles['fileExplorerTree']}>
				<FilePickerTree
					ref={treeRef}
					withContextMenu
					readOnly={readOnly}
					filesystem={filesystem}
					requestIdentity={requestIdentity}
					root={normalizedDocumentRoot}
					initialSelectedPath={treeInitialPath}
					onSelect={async (path) => {
						const selectionSource = filesystemGenerationRef.current;
						if (
							selectionSource.filesystem !== filesystem ||
							selectionSource.documentRoot !==
								normalizedDocumentRoot ||
							selectionSource.requestIdentity !== requestIdentity
						) {
							return;
						}
						const selectionGeneration = selectionSource.value;
						const selectionRequestId =
							++openFileRequestIdRef.current;
						pendingFileOpenPathRef.current = path;
						setLastSelectedPath(path);
						if (!path) {
							try {
								await onSelectionCleared();
							} catch (error) {
								logger.error(
									'Could not clear file selection',
									error
								);
							}
							return;
						}
						try {
							if (await filesystem.isDir(path)) {
								if (
									filesystemGenerationRef.current.value !==
										selectionGeneration ||
									openFileRequestIdRef.current !==
										selectionRequestId
								) {
									return;
								}
								pendingFileOpenPathRef.current = null;
								setSelectedDirPath(path);
								return;
							}
						} catch {
							// If we cannot determine whether it is a directory, treat as file.
						}
						if (
							filesystemGenerationRef.current.value !==
								selectionGeneration ||
							openFileRequestIdRef.current !== selectionRequestId
						) {
							return;
						}
						// For files, open them but don't move focus to the editor
						await handleOpenFile(path, false);
					}}
					onDoubleClickFile={async (path) => {
						// On double-click, open the file and move focus to the editor
						await handleOpenFile(path, true);
					}}
					onBeforePathChange={onBeforePathChange}
					onPathMoved={handlePathMoved}
					onPathDeleted={handlePathDeleted}
					onPathChangeComplete={onPathChangeComplete}
					onImportError={handleImportError}
				/>
			</div>
		</div>
	);
}

/** Keeps the original extension after numeric upload-collision suffixes. */
function splitFileExtension(name: string) {
	const dot = name.lastIndexOf('.');
	if (dot > 0) {
		return {
			stem: name.slice(0, dot),
			extension: name.slice(dot),
		};
	}
	return { stem: name, extension: '' };
}
