import React, {
	useEffect,
	useMemo,
	useRef,
	useState,
	type Dispatch,
	type ReactNode,
	type SetStateAction,
} from 'react';
import classNames from 'classnames';
import { Icon } from '@wordpress/components';
import { upload } from '@wordpress/icons';
import styles from './file-explorer.module.css';
import {
	FilePickerTree,
	type FilePickerTreeHandle,
} from '@wp-playground/components';
import type { AsyncWritableFilesystem } from '@wp-playground/storage';
import { logger } from '@php-wasm/logger';
import { basename, dirname, joinPaths, normalizePath } from '@php-wasm/util';
import { BinaryFilePreview } from '@wp-playground/components';
import {
	seemsLikeBinary,
	createDownloadUrl,
	getMimeType,
	isPreviewableBinary,
	readFileForInlinePreview,
} from './file-utils';

const FilePlusIcon = () => (
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

const FolderPlusIcon = () => (
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

export type FileExplorerSidebarProps = {
	filesystem: AsyncWritableFilesystem;
	currentPath: string | null;
	selectedDirPath: string | null;
	setSelectedDirPath: Dispatch<SetStateAction<string | null>>;
	onFileOpened: (
		path: string,
		content: string,
		shouldFocus?: boolean
	) => Promise<void> | void;
	onSelectionCleared: () => Promise<void> | void;
	onShowMessage: (
		path: string | null,
		message: string | JSX.Element
	) => Promise<boolean | void> | boolean | void;
	documentRoot: string;
};

export function FileExplorerSidebar({
	filesystem,
	currentPath,
	selectedDirPath,
	setSelectedDirPath,
	onFileOpened,
	onSelectionCleared,
	onShowMessage,
	documentRoot,
}: FileExplorerSidebarProps) {
	const treeRef = useRef<FilePickerTreeHandle | null>(null);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const uploadInputRef = useRef<HTMLInputElement | null>(null);
	const openFileRequestIdRef = useRef(0);

	useEffect(() => {
		return () => {
			// Slow reads from the previous filesystem must not reopen a file
			// after this tree starts browsing another Playground or folder.
			openFileRequestIdRef.current += 1;
		};
	}, [filesystem, documentRoot]);

	const treeInitialPath = useMemo(() => {
		return normalizePath(
			currentPath
				? dirname(normalizePath(currentPath))
				: (selectedDirPath ?? documentRoot)
		);
		// Prevent tree from jumping unexpectedly when selectedDirPath changes.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentPath, documentRoot]);

	const [lastSelectedPath, setLastSelectedPath] = useState<string | null>(
		null
	);
	const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);

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

	const isInternalDrag = (event: React.DragEvent) =>
		event.dataTransfer?.types?.includes('application/x-wp-playground-path');

	const resolveUploadDirectory = async () => {
		const candidates = [
			lastSelectedPath,
			selectedDirPath,
			documentRoot,
		].filter(Boolean) as string[];
		for (const candidate of candidates) {
			try {
				if (await filesystem.isDir(candidate)) {
					return candidate;
				}
			} catch {
				continue;
			}
			try {
				const parent = dirname(candidate);
				if (await filesystem.isDir(parent)) {
					return parent;
				}
			} catch {
				continue;
			}
		}
		return documentRoot;
	};

	const getAvailablePath = async (baseDir: string, desiredName: string) => {
		const uploadName = basename(desiredName.replace(/\\/g, '/'));
		const safeName =
			uploadName &&
			uploadName !== '/' &&
			uploadName !== '.' &&
			uploadName !== '..'
				? uploadName
				: 'upload';
		const basePath = baseDir === '/' ? '/' : baseDir;
		const splitExt = (name: string) => {
			const dot = name.lastIndexOf('.');
			if (dot > 0) {
				return { stem: name.slice(0, dot), ext: name.slice(dot) };
			}
			return { stem: name, ext: '' };
		};
		let counter = 0;
		while (true) {
			const { stem, ext } = splitExt(safeName);
			const suffix = counter ? ` (${counter})` : '';
			const candidateName = `${stem}${suffix}${ext}`;
			const candidatePath = joinPaths(basePath, candidateName);
			const exists = await filesystem
				.fileExists(candidatePath)
				.catch(() => false);
			const isDir = await filesystem
				.isDir(candidatePath)
				.catch(() => false);
			if (!exists && !isDir) {
				return candidatePath;
			}
			counter += 1;
		}
	};

	const importFileList = async (files: FileList | File[]) => {
		if (!files || !files.length) {
			return;
		}
		const baseDir = await resolveUploadDirectory();
		const createdPaths: string[] = [];
		let failedCount = 0;
		for (const file of Array.from(files)) {
			try {
				const targetPath = await getAvailablePath(baseDir, file.name);
				const buffer = new Uint8Array(await file.arrayBuffer());
				await filesystem.writeFile(targetPath, buffer);
				createdPaths.push(targetPath);
			} catch (error) {
				failedCount += 1;
				logger.error('Failed to import file', error);
			}
		}
		if (createdPaths.length) {
			setLastSelectedPath(baseDir);
			await treeRef.current?.refresh(baseDir);
		}
		if (failedCount) {
			alert(
				`Could not upload ${failedCount === 1 ? '1 file' : `${failedCount} files`}.`
			);
		}
	};

	const handleUploadButtonClick = () => {
		uploadInputRef.current?.click();
	};

	const handleUploadInputChange = async (
		event: React.ChangeEvent<HTMLInputElement>
	) => {
		await importFileList(event.target.files ?? []);
		// Reset input so the same file selection can be chosen again.
		event.target.value = '';
	};

	const handleSidebarDragEnter = (event: React.DragEvent) => {
		if (isInternalDrag(event)) {
			return;
		}
		event.preventDefault();
		setIsDraggingSidebar(true);
	};

	const handleSidebarDragOver = (event: React.DragEvent) => {
		if (isInternalDrag(event)) {
			return;
		}
		event.preventDefault();
		event.dataTransfer.dropEffect = 'copy';
		setIsDraggingSidebar(true);
	};

	const handleSidebarDragLeave = (event: React.DragEvent) => {
		const related = event.relatedTarget as Node | null;
		if (related && containerRef.current?.contains(related)) {
			return;
		}
		setIsDraggingSidebar(false);
	};

	const handleSidebarDrop = async (event: React.DragEvent) => {
		if (isInternalDrag(event)) {
			return;
		}
		event.preventDefault();
		setIsDraggingSidebar(false);
		await importFileList(event.dataTransfer?.files ?? []);
	};

	const handleOpenFile = async (path: string, shouldFocus: boolean) => {
		const requestId = ++openFileRequestIdRef.current;
		const isCurrentRequest = () =>
			openFileRequestIdRef.current === requestId;
		try {
			const file = await filesystem.read(path);
			if (!isCurrentRequest()) {
				return;
			}
			const filename = path.split('/').pop() || 'download';
			const previewRead = await readFileForInlinePreview(file);
			if (!isCurrentRequest()) {
				if (previewRead.type === 'too-large') {
					revokeMaybe(previewRead.downloadUrl);
				}
				return;
			}
			if (previewRead.type === 'too-large') {
				if (
					!(await showFileMessage(
						path,
						renderTooLargeMessage(filename, previewRead.downloadUrl)
					))
				) {
					revokeMaybe(previewRead.downloadUrl);
				}
				return;
			}
			const data = previewRead.data;

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

					if (
						!(await showFileMessage(
							path,
							<OwnedBinaryFilePreview
								filename={fname}
								mimeType={mimeType}
								dataUrl={dataUrl}
								downloadUrl={downloadUrl}
							/>
						))
					) {
						URL.revokeObjectURL(dataUrl);
						URL.revokeObjectURL(downloadUrl);
					}
					return;
				}

				// Non-previewable binary file
				if (
					!(await showFileMessage(
						path,
						<>
							<p>Binary file. Cannot be edited.</p>
							<p>
								<OwnedDownloadLink
									url={downloadUrl}
									filename={fname}
								>
									Download {fname}
								</OwnedDownloadLink>
							</p>
						</>
					))
				) {
					URL.revokeObjectURL(downloadUrl);
				}
				return;
			}

			const text = new TextDecoder('utf-8').decode(data);
			if (!isCurrentRequest()) {
				return;
			}
			await openFileInEditor(path, text, shouldFocus);
		} catch (error) {
			if (!isCurrentRequest()) {
				return;
			}
			logger.error('Could not open file', error);
			await showFileMessage(null, 'Could not open file.');
		}
	};

	function cancelPendingFileOpen() {
		openFileRequestIdRef.current += 1;
	}

	async function showFileMessage(
		path: string | null,
		message: string | JSX.Element
	) {
		try {
			const didShow = await onShowMessage(path, message);
			return didShow !== false;
		} catch (error) {
			logger.error('Could not show file message', error);
			return false;
		}
	}

	async function openFileInEditor(
		path: string,
		content: string,
		shouldFocus: boolean
	) {
		try {
			await onFileOpened(path, content, shouldFocus);
		} catch (error) {
			logger.error('Could not switch files', error);
		}
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
			onDrop={handleSidebarDrop}
		>
			<div className={styles['fileExplorerHeader']}>
				<span className={styles['fileExplorerTitle']}>Files</span>
				<div className={styles['fileExplorerActions']}>
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
						<FilePlusIcon />
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
						<FolderPlusIcon />
					</button>
					<button
						className={classNames(
							styles['fileExplorerButton'],
							styles['fileExplorerIconButton'],
							styles['fileExplorerUploadButton']
						)}
						type="button"
						onClick={handleUploadButtonClick}
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
				</div>
			</div>
			<div className={styles['fileExplorerTree']}>
				<FilePickerTree
					ref={treeRef}
					withContextMenu
					filesystem={filesystem}
					root={documentRoot}
					initialSelectedPath={treeInitialPath}
					onSelect={async (path) => {
						setLastSelectedPath(path);
						if (!path) {
							cancelPendingFileOpen();
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
								cancelPendingFileOpen();
								setSelectedDirPath(path);
								return;
							}
						} catch {
							// If we cannot determine whether it is a directory, treat as file.
						}
						// For files, open them but don't move focus to the editor
						await handleOpenFile(path, false);
					}}
					onDoubleClickFile={async (path) => {
						// On double-click, open the file and move focus to the editor
						await handleOpenFile(path, true);
					}}
				/>
			</div>
		</div>
	);
}

function renderTooLargeMessage(filename: string, downloadUrl?: string) {
	return (
		<>
			<p>File too large to open (&gt;1MB).</p>
			<p>
				{downloadUrl ? (
					<OwnedDownloadLink url={downloadUrl} filename={filename}>
						Download {filename}
					</OwnedDownloadLink>
				) : (
					'Open or download it outside the in-browser editor.'
				)}
			</p>
		</>
	);
}

function revokeMaybe(url: string | undefined) {
	if (url) {
		URL.revokeObjectURL(url);
	}
}

function OwnedBinaryFilePreview(
	props: React.ComponentProps<typeof BinaryFilePreview>
) {
	useEffect(() => {
		const dataUrl = props.dataUrl;
		const downloadUrl = props.downloadUrl;
		return () => {
			URL.revokeObjectURL(dataUrl);
			if (downloadUrl) {
				URL.revokeObjectURL(downloadUrl);
			}
		};
	}, [props.dataUrl, props.downloadUrl]);

	return <BinaryFilePreview {...props} />;
}

function OwnedDownloadLink({
	url,
	filename,
	children,
}: {
	url: string;
	filename: string;
	children: ReactNode;
}) {
	useEffect(() => {
		return () => URL.revokeObjectURL(url);
	}, [url]);

	return (
		<a href={url} download={filename}>
			{children}
		</a>
	);
}
