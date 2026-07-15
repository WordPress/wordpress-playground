import React, {
	useEffect,
	useMemo,
	useRef,
	useState,
	type Dispatch,
	type SetStateAction,
} from 'react';
import { Button, Icon, Tooltip } from '@wordpress/components';
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
	title?: string;
	showBinaryPreviewHeader?: boolean;
	dockPresentation?: boolean;
	useWordPressTooltips?: boolean;
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
	title = 'Files',
	showBinaryPreviewHeader = true,
	dockPresentation = false,
	useWordPressTooltips = false,
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
				if (!dockPresentation) {
					await onShowMessage(
						path,
						<>
							<p>{`File too large to open (>${maxInlineMegabytes}MB).`}</p>
							<p>
								Open or download it outside the in-browser
								editor.
							</p>
						</>
					);
					return;
				}
				const filename = basename(path) || 'download';
				await onShowMessage(
					path,
					<>
						<p>{`File too large to open (>${maxInlineMegabytes}MB).`}</p>
						<p>
							<Button
								type="button"
								variant="link"
								onClick={() => {
									void downloadFile(path, filename);
								}}
							>
								Download {filename}
							</Button>
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
							showHeader={showBinaryPreviewHeader}
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

	/** Reads a rejected large file only after the user asks to download it. */
	const downloadFile = async (path: string, filename: string) => {
		try {
			const file = await filesystem.read(path);
			const data = new Uint8Array(await file.arrayBuffer());
			const { url } = createDownloadUrl(data, filename);
			const anchor = document.createElement('a');
			anchor.href = url;
			anchor.download = filename;
			document.body.appendChild(anchor);
			anchor.click();
			document.body.removeChild(anchor);
		} catch (error) {
			logger.error('Could not download file', error);
			await onShowMessage(path, 'Could not download file.');
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
				[styles['dockPresentation']]: dockPresentation,
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
				<span className={styles['fileExplorerTitle']}>{title}</span>
				{!readOnly ? (
					<div className={styles['fileExplorerActions']}>
						<FileActionTooltip
							label="Create new file"
							useWordPressTooltip={useWordPressTooltips}
						>
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
								title={
									useWordPressTooltips
										? undefined
										: 'Create new file'
								}
							>
								{dockPresentation ? (
									<FilePlusIcon />
								) : (
									<Icon icon={fileIcon} size={20} />
								)}
							</button>
						</FileActionTooltip>
						<FileActionTooltip
							label="Create new folder"
							useWordPressTooltip={useWordPressTooltips}
						>
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
								title={
									useWordPressTooltips
										? undefined
										: 'Create new folder'
								}
							>
								{dockPresentation ? (
									<FolderPlusIcon />
								) : (
									<Icon icon={folderIcon} size={20} />
								)}
							</button>
						</FileActionTooltip>
						<FileActionTooltip
							label="Upload files"
							useWordPressTooltip={useWordPressTooltips}
						>
							<button
								className={classNames(
									styles['fileExplorerButton'],
									styles['fileExplorerIconButton'],
									styles['fileExplorerUploadButton']
								)}
								type="button"
								onClick={() => uploadInputRef.current?.click()}
								aria-label="Upload files"
								title={
									useWordPressTooltips
										? undefined
										: 'Upload files'
								}
							>
								<Icon
									icon={upload}
									size={dockPresentation ? 16 : 20}
								/>
							</button>
						</FileActionTooltip>
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

function FileActionTooltip({
	label,
	useWordPressTooltip,
	children,
}: {
	label: string;
	useWordPressTooltip: boolean;
	children: JSX.Element;
}) {
	if (!useWordPressTooltip) {
		return children;
	}
	return (
		<Tooltip text={label} delay={0} placement="top">
			{children}
		</Tooltip>
	);
}

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
