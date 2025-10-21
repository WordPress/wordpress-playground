import {
	useMemo,
	useRef,
	useState,
	type Dispatch,
	type SetStateAction,
} from 'react';
import styles from './file-explorer.module.css';
import {
	FilePickerTree,
	type AsyncWritableFilesystem,
	type FilePickerTreeHandle,
} from '@wp-playground/components';
import {
	DEFAULT_WORKSPACE_DIR,
	MAX_INLINE_FILE_BYTES,
	WORDPRESS_ROOT_DIR,
} from './constants';

const normalizeFsPath = (path: string) => {
	if (!path) {
		return '/';
	}
	let normalized = path.replace(/\\+/g, '/');
	if (!normalized.startsWith('/')) {
		normalized = `/${normalized}`;
	}
	normalized = normalized.replace(/\/{2,}/g, '/');
	if (normalized.length > 1 && normalized.endsWith('/')) {
		normalized = normalized.slice(0, -1);
	}
	return normalized || '/';
};

const dirnameSafe = (path: string) => {
	const normalized = normalizeFsPath(path);
	if (normalized === '/') {
		return '/';
	}
	const index = normalized.lastIndexOf('/');
	return index <= 0 ? '/' : normalized.slice(0, index);
};

const isProbablyTextBuffer = (buffer: Uint8Array) => {
	const len = buffer.byteLength;
	for (let i = 0; i < Math.min(len, 4096); i++) {
		if (buffer[i] === 0) {
			return false;
		}
	}
	try {
		new TextDecoder('utf-8', { fatal: true }).decode(buffer);
		return true;
	} catch {
		return false;
	}
};

const createDownloadUrl = (data: Uint8Array, filename: string) => {
	const blob = new Blob([data]);
	const url = URL.createObjectURL(blob);
	setTimeout(() => URL.revokeObjectURL(url), 60_000);
	return { url, filename };
};

export type FileExplorerSidebarProps = {
	filesystem: AsyncWritableFilesystem;
	currentPath: string | null;
	selectedDirPath: string | null;
	setSelectedDirPath: Dispatch<SetStateAction<string | null>>;
	onFileOpened: (path: string, content: string) => Promise<void> | void;
	onSelectionCleared: () => Promise<void> | void;
	onShowMessage: (message: string) => Promise<void> | void;
};

export function FileExplorerSidebar({
	filesystem,
	currentPath,
	selectedDirPath,
	setSelectedDirPath,
	onFileOpened,
	onSelectionCleared,
	onShowMessage,
}: FileExplorerSidebarProps) {
	const treeRef = useRef<FilePickerTreeHandle | null>(null);

	const treeInitialPath = useMemo(() => {
		return normalizeFsPath(
			currentPath
				? dirnameSafe(currentPath)
				: selectedDirPath ?? DEFAULT_WORKSPACE_DIR
		);
		// Prevent tree from jumping unexpectedly when selectedDirPath changes.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentPath]);

	const [lastSelectedPath, setLastSelectedPath] = useState<string | null>(
		null
	);
	const [root, setRoot] = useState<string>(DEFAULT_WORKSPACE_DIR);

	return (
		<div className={styles.fileExplorerContainer}>
			<div className={styles.fileExplorerHeader}>
				<span className={styles.fileExplorerTitle}>Files</span>
				<div className={styles.fileExplorerActions}>
					<button
						className={styles.fileExplorerButton}
						type="button"
						onClick={() => {
							setRoot((prev) =>
								prev === DEFAULT_WORKSPACE_DIR
									? WORDPRESS_ROOT_DIR
									: DEFAULT_WORKSPACE_DIR
							);
						}}
						title="Toggle WordPress root"
					>
						Toggle WP
					</button>
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
						New Folder
					</button>
				</div>
			</div>
			<div className={styles.fileExplorerTree}>
				<FilePickerTree
					ref={treeRef}
					filesystem={filesystem}
					root={root}
					key={root}
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
						try {
							const data = await filesystem.readFileAsBuffer(
								path
							);
							const size = data.byteLength;
							if (size > MAX_INLINE_FILE_BYTES) {
								const { url, filename } = createDownloadUrl(
									data,
									path.split('/').pop() || 'download'
								);
								await onShowMessage(
									[
										'File too large to open (>1MB).',
										`Download: ${url}`,
										`Filename: ${filename}`,
									].join('\n')
								);
								return;
							}
							if (!isProbablyTextBuffer(data)) {
								const { url, filename } = createDownloadUrl(
									data,
									path.split('/').pop() || 'download'
								);
								await onShowMessage(
									[
										'Binary file. Download instead:',
										`Download: ${url}`,
										`Filename: ${filename}`,
									].join('\n')
								);
								return;
							}
							const text = new TextDecoder('utf-8').decode(data);
							await onFileOpened(path, text);
						} catch (error) {
							console.error('Could not open file', error);
							await onShowMessage('Could not open file.');
						}
					}}
				/>
			</div>
		</div>
	);
}
