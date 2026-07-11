import React, {
	useEffect,
	useMemo,
	useRef,
	useState,
	type Dispatch,
	type SetStateAction,
} from 'react';
import { Icon } from '@wordpress/components';
import { file as folderIcon, page as fileIcon, upload } from '@wordpress/icons';
import classNames from 'classnames';
import styles from './file-explorer.module.css';
import {
	FilePickerTree,
	type FilePickerTreeHandle,
} from '@wp-playground/components';
import type { AsyncWritableFilesystem } from '@wp-playground/storage';
import { logger } from '@php-wasm/logger';
import { basename, dirname } from '@php-wasm/util';
import { BinaryFilePreview } from '@wp-playground/components';
import {
	seemsLikeBinary,
	createDownloadUrl,
	getMimeType,
	isPreviewableBinary,
	MAX_INLINE_FILE_BYTES,
	readFileForInlinePreview,
} from './file-utils';

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
	) => Promise<void> | void;
	documentRoot: string;
	readOnly?: boolean;
};

/**
 * Renders the file explorer and opens selected files in the editor preview area.
 */
export function FileExplorerSidebar({
	filesystem,
	currentPath,
	selectedDirPath,
	setSelectedDirPath,
	onFileOpened,
	onSelectionCleared,
	onShowMessage,
	documentRoot,
	readOnly = false,
}: FileExplorerSidebarProps) {
	const treeRef = useRef<FilePickerTreeHandle | null>(null);
	const uploadInputRef = useRef<HTMLInputElement | null>(null);

	const treeInitialPath = useMemo(() => {
		return currentPath
			? dirname(currentPath)
			: (selectedDirPath ?? documentRoot);
		// Prevent tree from jumping unexpectedly when selectedDirPath changes.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentPath, documentRoot]);

	const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);

	// `currentPath` already owns the visible file. Mirror it into the tree
	// instead of introducing another focus-path prop that could drift.
	useEffect(() => {
		if (!currentPath || !treeRef.current) {
			return;
		}
		setSelectedDirPath(dirname(currentPath));
		treeRef.current.focusPath(currentPath, {
			select: true,
			domFocus: false,
			notify: false,
		});
		void treeRef.current.expandToPath(currentPath);
	}, [currentPath, setSelectedDirPath]);

	/**
	 * Opens a selected file as editable text, binary preview, or too-large notice.
	 */
	const handleOpenFile = async (path: string, shouldFocus: boolean) => {
		try {
			const file = await filesystem.read(path);
			const previewRead = await readFileForInlinePreview(file);

			if (previewRead.type === 'too-large') {
				const maxInlineMegabytes = MAX_INLINE_FILE_BYTES / 1024 / 1024;
				await onShowMessage(
					path,
					<>
						<p>{`File too large to open (>${maxInlineMegabytes}MB).`}</p>
						<p>
							Open or download it outside the in-browser editor.
						</p>
					</>
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

				// Check if this is a previewable binary file
				if (isPreviewableBinary(mimeType)) {
					// Create a data URL for the preview
					const blob = new Blob([data], { type: mimeType });
					const dataUrl = URL.createObjectURL(blob);

					await onShowMessage(
						path,
						<BinaryFilePreview
							filename={fname}
							mimeType={mimeType}
							dataUrl={dataUrl}
							downloadUrl={downloadUrl}
						/>
					);
					return;
				}

				// Non-previewable binary file
				await onShowMessage(
					path,
					<>
						<p>Binary file. Cannot be edited.</p>
						<p>
							<a href={downloadUrl} download={fname}>
								Download {fname}
							</a>
						</p>
					</>
				);
				return;
			}

			const text = new TextDecoder('utf-8').decode(data);
			await onFileOpened(path, text, shouldFocus);
		} catch (error) {
			logger.error('Could not open file', error);
			await onShowMessage(null, 'Could not open file.');
		}
	};

	/** Sends file-input uploads through the tree's existing import path. */
	const handleUploadInputChange = (
		event: React.ChangeEvent<HTMLInputElement>
	) => {
		const files = Array.from(event.target.files ?? []);
		event.target.value = '';
		if (files.length === 0) {
			return;
		}
		void treeRef.current
			?.importFiles(files, selectedDirPath ?? documentRoot)
			.catch((error) => logger.error('Failed to import files', error));
	};

	/** Sends a host drop through the same recursive importer used by tree rows. */
	const handleSidebarDrop = (event: React.DragEvent) => {
		if (
			event.dataTransfer.types.includes(
				'application/x-wp-playground-path'
			)
		) {
			return;
		}
		event.preventDefault();
		if (readOnly) {
			return;
		}
		void treeRef.current
			?.importDataTransfer(
				event.dataTransfer,
				selectedDirPath ?? documentRoot
			)
			.catch((error) =>
				logger.error('Failed to import dropped files', error)
			);
	};

	return (
		<div
			className={classNames(styles['fileExplorerContainer'], {
				[styles['dropActive']]: isDraggingSidebar,
			})}
			onDragEnter={(event) => {
				if (
					event.dataTransfer.types.includes(
						'application/x-wp-playground-path'
					)
				) {
					return;
				}
				event.preventDefault();
				if (!readOnly) {
					setIsDraggingSidebar(true);
				}
			}}
			onDragOver={(event) => {
				if (
					event.dataTransfer.types.includes(
						'application/x-wp-playground-path'
					)
				) {
					return;
				}
				event.preventDefault();
				event.dataTransfer.dropEffect = readOnly ? 'none' : 'copy';
			}}
			onDragLeave={(event) => {
				const related = event.relatedTarget as Node | null;
				if (!related || !event.currentTarget.contains(related)) {
					setIsDraggingSidebar(false);
				}
			}}
			onDropCapture={() => setIsDraggingSidebar(false)}
			onDrop={handleSidebarDrop}
		>
			<div className={styles['fileExplorerHeader']}>
				<span className={styles['fileExplorerTitle']}>Files</span>
				{!readOnly ? (
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
								void treeRef.current.createFile();
							}}
							aria-label="Create new file"
							title="Create new file"
						>
							<Icon icon={fileIcon} size={20} />
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
								void treeRef.current.createFolder();
							}}
							aria-label="Create new folder"
							title="Create new folder"
						>
							<Icon icon={folderIcon} size={20} />
						</button>
						<button
							className={classNames(
								styles['fileExplorerButton'],
								styles['fileExplorerIconButton']
							)}
							type="button"
							onClick={() => uploadInputRef.current?.click()}
							aria-label="Upload files"
							title="Upload files"
						>
							<Icon icon={upload} size={20} />
						</button>
						<input
							ref={uploadInputRef}
							type="file"
							multiple
							style={{ display: 'none' }}
							onChange={handleUploadInputChange}
						/>
					</div>
				) : null}
			</div>
			<div className={styles['fileExplorerTree']}>
				<FilePickerTree
					ref={treeRef}
					readOnly={readOnly}
					filesystem={filesystem}
					root={documentRoot}
					initialSelectedPath={treeInitialPath}
					onSelect={async (path) => {
						if (!path) {
							setSelectedDirPath(documentRoot);
							await onSelectionCleared();
							return;
						}
						try {
							if (await filesystem.isDir(path)) {
								setSelectedDirPath(path);
								return;
							}
						} catch {
							// If we cannot determine whether it is a directory, treat as file.
						}
						setSelectedDirPath(dirname(path));
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
