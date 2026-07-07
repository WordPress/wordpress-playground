import React, {
	useMemo,
	useRef,
	useState,
	type Dispatch,
	type SetStateAction,
} from 'react';
import { Icon } from '@wordpress/components';
import { file as folderIcon, page as fileIcon } from '@wordpress/icons';
import styles from './file-explorer.module.css';
import {
	FilePickerTree,
	type FilePickerTreeHandle,
} from '@wp-playground/components';
import type { AsyncWritableFilesystem } from '@wp-playground/storage';
import { logger } from '@php-wasm/logger';
import { dirname, normalizePath } from '@php-wasm/util';
import { BinaryFilePreview } from '@wp-playground/components';
import {
	seemsLikeBinary,
	createDownloadUrl,
	getMimeType,
	isPreviewableBinary,
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
	onBeforePathChange?: (
		path: string
	) => Promise<boolean | void> | boolean | void;
	onPathMoved?: (from: string, to: string) => Promise<void> | void;
	onPathDeleted?: (path: string) => Promise<void> | void;
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
	onBeforePathChange,
	onPathMoved,
	onPathDeleted,
	documentRoot,
}: FileExplorerSidebarProps) {
	const treeRef = useRef<FilePickerTreeHandle | null>(null);

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

	const handleOpenFile = async (path: string, shouldFocus: boolean) => {
		try {
			const file = await filesystem.read(path);
			const fileRead = await readFileForInlinePreview(file);
			const filename = path.split('/').pop() || 'download';
			if (fileRead.type === 'too-large') {
				await onShowMessage(
					path,
					<>
						<p>File too large to open (&gt;1MB).</p>
						<p>
							{fileRead.downloadUrl ? (
								<a
									href={fileRead.downloadUrl}
									download={filename}
								>
									Download {filename}
								</a>
							) : (
								'Open or download it outside the in-browser editor.'
							)}
						</p>
					</>
				);
				return;
			}
			const data = fileRead.data;
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

	const handlePathMoved = async (from: string, to: string) => {
		setLastSelectedPath((previous) => remapPath(previous, from, to));
		await onPathMoved?.(from, to);
	};

	const handlePathDeleted = async (path: string) => {
		setLastSelectedPath((previous) =>
			pathContainsCurrentFile(path, previous) ? null : previous
		);
		await onPathDeleted?.(path);
	};

	return (
		<div className={styles['fileExplorerContainer']}>
			<div className={styles['fileExplorerHeader']}>
				<span className={styles['fileExplorerTitle']}>Files</span>
				<div className={styles['fileExplorerActions']}>
					<button
						className={styles['fileExplorerButton']}
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
					>
						<Icon icon={fileIcon} size={16} />
						New File
					</button>
					<button
						className={styles['fileExplorerButton']}
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
					>
						<Icon icon={folderIcon} size={16} />
						New Folder
					</button>
				</div>
			</div>
			<div className={styles['fileExplorerTree']}>
				<FilePickerTree
					ref={treeRef}
					filesystem={filesystem}
					root={documentRoot}
					initialSelectedPath={treeInitialPath}
					onSelect={async (path) => {
						setLastSelectedPath(path);
						if (!path) {
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
				/>
			</div>
		</div>
	);
}

function remapPath(
	value: string | null,
	from: string,
	to: string
): string | null {
	if (!value) {
		return value;
	}
	if (value === from) {
		return to;
	}
	if (value.startsWith(from === '/' ? '/' : `${from}/`)) {
		return to + value.slice(from.length);
	}
	return value;
}

function pathContainsCurrentFile(path: string, currentFilePath: string | null) {
	if (!currentFilePath) {
		return false;
	}
	return (
		currentFilePath === path ||
		currentFilePath.startsWith(path === '/' ? '/' : `${path}/`)
	);
}
