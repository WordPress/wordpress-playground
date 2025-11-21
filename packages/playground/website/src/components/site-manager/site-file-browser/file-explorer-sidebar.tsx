import {
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
	type AsyncWritableFilesystem,
	type FilePickerTreeHandle,
} from '@wp-playground/components';
import { logger } from '@php-wasm/logger';
import { dirname, normalizePath } from '@php-wasm/util';
import { BinaryFilePreview } from './binary-file-preview';
import mimeTypes from '@php-wasm/universal/mime-types';

export const MAX_INLINE_FILE_BYTES = 1024 * 1024; // 1MB

const seemsLikeBinary = (buffer: Uint8Array) => {
	// Assume that anything with a null byte in the first 4096 bytes is binary.
	// This isn't a perfect test, but it catches a lot of binary files.
	const len = buffer.byteLength;
	for (let i = 0; i < Math.min(len, 4096); i++) {
		if (buffer[i] === 0) {
			return true;
		}
	}

	// Next, try to decode the buffer as UTF-8. If it fails, it's probably binary.
	try {
		new TextDecoder('utf-8', { fatal: true }).decode(buffer);
		return false;
	} catch {
		return true;
	}
};

const createDownloadUrl = (data: Uint8Array, filename: string) => {
	const blob = new Blob([data]);
	const url = URL.createObjectURL(blob);
	setTimeout(() => URL.revokeObjectURL(url), 60_000);
	return { url, filename };
};

const getMimeType = (filename: string): string => {
	const extension = filename.split('.').pop() as keyof typeof mimeTypes;
	return mimeTypes[extension] || mimeTypes['_default'];
};

const isPreviewableBinary = (mimeType: string): boolean => {
	return (
		mimeType.startsWith('image/') ||
		mimeType.startsWith('video/') ||
		mimeType.startsWith('audio/')
	);
};

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
	onShowMessage: (message: string | JSX.Element) => Promise<void> | void;
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
			const data = await filesystem.readFileAsBuffer(path);
			const size = data.byteLength;
			const filename = path.split('/').pop() || 'download';

			if (size > MAX_INLINE_FILE_BYTES) {
				const { url, filename: fname } = createDownloadUrl(
					data,
					filename
				);
				await onShowMessage(
					<>
						<p>File too large to open (&gt;1MB).</p>
						<p>
							<a href={url} download={fname}>
								Download {fname}
							</a>
						</p>
					</>
				);
				return;
			}

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
			await onShowMessage('Could not open file.');
		}
	};

	return (
		<div className={styles.fileExplorerContainer}>
			<div className={styles.fileExplorerHeader}>
				<span className={styles.fileExplorerTitle}>Files</span>
				<div className={styles.fileExplorerActions}>
					<button
						className={styles.fileExplorerButton}
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
						className={styles.fileExplorerButton}
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
			<div className={styles.fileExplorerTree}>
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
				/>
			</div>
		</div>
	);
}
