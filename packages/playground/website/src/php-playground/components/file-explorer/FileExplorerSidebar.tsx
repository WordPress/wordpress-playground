import React, { useMemo, useRef, useState } from 'react';
import styles from './FileExplorer.module.css';
import { FilePickerTree } from '@wp-playground/components';
import type {
	AsyncWritableFilesystem,
	FilePickerTreeHandle,
} from '@wp-playground/components';
import { useAppDispatch } from '../../hooks';
import { setCode, setCurrentPath } from '../../store';
import { DEFAULT_WORKSPACE_DIR } from '../../constants';

const MAX_INLINE_BYTES = 1024 * 1024; // 1MB

// @TODO: Examing the difference between this and normalize() and, likely, just migrate
//        to normalize() and dirname() from @php-wasm/util.
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

export default function FileExplorerSidebar({
	filesystem,
	currentPath,
	selectedDirPath,
	setSelectedDirPath,
	forceSelectedPath,
	setForceSelectedPath,
}: {
	filesystem: AsyncWritableFilesystem;
	currentPath: string | null;
	selectedDirPath: string | null;
	setSelectedDirPath: React.Dispatch<React.SetStateAction<string | null>>;
	forceSelectedPath: string | null;
	setForceSelectedPath: React.Dispatch<React.SetStateAction<string | null>>;
}) {
	const treeRef = useRef<FilePickerTreeHandle | null>(null);
	const dispatch = useAppDispatch();

	// Only set initial path once to prevent jumping between directories
	const treeInitialPath = useMemo(() => {
		return normalizeFsPath(
			forceSelectedPath ??
				(currentPath
					? dirnameSafe(currentPath)
					: selectedDirPath ?? DEFAULT_WORKSPACE_DIR)
		);
		// Remove selectedDirPath from dependencies to prevent unwanted updates
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [forceSelectedPath, currentPath]);
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
						onClick={() => {
							if (root === DEFAULT_WORKSPACE_DIR) {
								setRoot('/wordpress');
							} else {
								setRoot(DEFAULT_WORKSPACE_DIR);
							}
						}}
						title="Toggle WP"
					>
						Toggle WP
					</button>
					<button
						className={styles.fileExplorerButton}
						onClick={() =>
							treeRef.current &&
							treeRef.current.createFile(
								lastSelectedPath ?? undefined
							)
						}
						title="Create new file"
					>
						New File
					</button>
					<button
						className={styles.fileExplorerButton}
						onClick={() => {
							if (treeRef.current) {
								treeRef.current.createFolder(
									lastSelectedPath ?? undefined
								);
							}
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
					// excludePaths={['/dev', '/internal', '/proc', '/request']}
					onSelect={async (path) => {
						setLastSelectedPath(path);
						if (!path) {
							setForceSelectedPath(null);
							dispatch(setCode(''));
							dispatch(setCurrentPath(null));
							return;
						}
						setForceSelectedPath(null);
						if (filesystem && (await filesystem.isDir(path))) {
							setSelectedDirPath(path);
							return;
						}
						try {
							const data = await filesystem.readFileAsBuffer(
								path
							);
							const size = data.byteLength;
							if (size > MAX_INLINE_BYTES) {
								const { url, filename } = createDownloadUrl(
									data,
									path.split('/').pop() || 'download'
								);
								dispatch(
									setCode(
										`File too large to open (>1MB)\nDownload: ${url}\nFilename: ${filename}`
									)
								);
								dispatch(setCurrentPath(null));
								// Don't change selectedDirPath when clicking a file
								return;
							}
							if (!isProbablyTextBuffer(data)) {
								const { url, filename } = createDownloadUrl(
									data,
									path.split('/').pop() || 'download'
								);
								dispatch(
									setCode(
										`binary file. can't edit (download): ${url}\nFilename: ${filename}`
									)
								);
								dispatch(setCurrentPath(null));
								// Don't change selectedDirPath when clicking a file
								return;
							}
							const text = new TextDecoder('utf-8').decode(data);
							dispatch(setCode(text));
							dispatch(setCurrentPath(path));
							// Don't change selectedDirPath when clicking a file
						} catch {
							dispatch(setCode('Could not open file'));
							dispatch(setCurrentPath(null));
							// Don't change selectedDirPath when clicking a file
						}
					}}
				/>
			</div>
		</div>
	);
}
