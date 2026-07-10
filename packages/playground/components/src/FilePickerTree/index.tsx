import { basename, dirname, joinPaths } from '@php-wasm/util';
import { logger } from '@php-wasm/logger';
import type { AsyncWritableFilesystem } from '@wp-playground/storage';
import {
	Button,
	MenuItem,
	NavigableMenu,
	Popover,
	__experimentalTreeGrid as TreeGrid,
	__experimentalTreeGridCell as TreeGridCell,
	__experimentalTreeGridRow as TreeGridRow,
} from '@wordpress/components';
import '@wordpress/components/build-style/style.css';
import { Icon, chevronDown, chevronRight } from '@wordpress/icons';
import classNames from 'classnames';
import React, {
	forwardRef,
	useEffect,
	useImperativeHandle,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { file, folder } from '../icons';
import {
	isValidPosixPathSegment,
	pathContainsPath,
	remapPathAfterMove,
	resolvePathAtOrUnder,
} from '../file-tree-paths';
import { serializeFilesystemOperation } from '../filesystem-operation-queue';
import css from './style.module.css';

type ExpandedNodePaths = Record<string, boolean>;

type DropIndicatorState = 'valid' | 'invalid';

type DropIndicator = {
	path: string;
	state: DropIndicatorState;
};

type DropEvaluation = {
	allowed: boolean;
	state: DropIndicatorState;
	destination: string | null;
};

type PathAvailability = 'available' | 'exists' | 'unknown';

export type FilePickerPathChangeOutcome = 'moved' | 'deleted' | 'failed';

interface FileSystemEntryBaseLike {
	readonly isFile: boolean;
	readonly isDirectory: boolean;
	readonly name: string;
}

interface FileSystemFileEntryLike extends FileSystemEntryBaseLike {
	file: (
		successCallback: (file: File) => void,
		errorCallback?: (error: DOMException) => void
	) => void;
}

interface FileSystemDirectoryReaderLike {
	readEntries: (
		successCallback: (entries: FileSystemEntryLike[]) => void,
		errorCallback?: (error: DOMException) => void
	) => void;
}

interface FileSystemDirectoryEntryLike extends FileSystemEntryBaseLike {
	createReader: () => FileSystemDirectoryReaderLike;
}

type FileSystemEntryLike =
	| FileSystemFileEntryLike
	| FileSystemDirectoryEntryLike;

export type FileNode = {
	name: string;
	type: 'file' | 'folder';
	children?: FileNode[];
};

export type FilePickerTreeProps = {
	withContextMenu?: boolean;
	/** Prevent mutations through context menus, drag-and-drop, and ref actions. */
	readOnly?: boolean;
	/**
	 * Filesystem object identity owns async tree work. Replace the object when
	 * its backing storage changes, even if the replacement has the same paths.
	 */
	filesystem: AsyncWritableFilesystem;
	/**
	 * Invalidates queued work when the logical owner changes. A filesystem call
	 * that already started still reports through the old owner's callbacks.
	 */
	requestIdentity?: string;
	root?: string; // default '/wordpress'
	initialSelectedPath?: string;
	onSelect?: (path: string | null) => void;
	onDoubleClickFile?: (path: string) => void;
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
	 * It may outlive this tree owner, so hosts must identity-guard live UI state.
	 */
	onPathChangeComplete?: (
		path: string,
		outcome: FilePickerPathChangeOutcome
	) => Promise<void> | void;
	/** Reports a failed host-file import initiated on a visible tree row. */
	onImportError?: (error: unknown) => Promise<void> | void;
};

export type FilePickerTreeHandle = {
	focusPath: (
		path: string,
		options?: { select?: boolean; domFocus?: boolean; notify?: boolean }
	) => void;
	selectPath: (path: string) => void;
	getSelectedPath: () => string | null;
	expandToPath: (path: string) => Promise<void>;
	/**
	 * Reloads one directory, rejecting current-source read failures and returning
	 * undefined when the path or filesystem source became stale.
	 */
	refresh: (path: string) => Promise<FileNode[] | undefined>;
	remapPath: (from: string, to: string) => void;
	/**
	 * Recursively imports host files and directories below the preferred path.
	 * A file path selects its parent directory; an invalid path falls back to root.
	 */
	importExternalItems: (
		dataTransfer: DataTransfer,
		preferredPath?: string
	) => Promise<void>;
	// Filesystem helpers
	createFile: (absSelectedPath?: string) => Promise<void>;
	createFolder: (absSelectedPath?: string) => Promise<void>;
};

/**
 * Renders a filesystem tree with keyboard navigation and optional mutations.
 */
export const FilePickerTree = forwardRef<
	FilePickerTreeHandle,
	FilePickerTreeProps
>(function FilePickerTree(
	{
		withContextMenu = true,
		readOnly = false,
		filesystem,
		requestIdentity,
		root = '/wordpress',
		initialSelectedPath,
		onSelect = () => {},
		onDoubleClickFile,
		onBeforePathChange,
		onPathMoved,
		onPathDeleted,
		onPathChangeComplete,
		onImportError,
	},
	ref
) {
	const normalizedRoot = useMemo(() => joinPaths('/', root || '/'), [root]);

	const initialTreePath = useMemo(() => {
		if (!initialSelectedPath) {
			return null;
		}
		return (
			resolvePathAtOrUnder(initialSelectedPath, normalizedRoot) ??
			normalizedRoot
		);
	}, [initialSelectedPath, normalizedRoot]);

	/**
	 * Builds the expanded-node map needed to reveal a selected path.
	 */
	const buildExpandedPathsForPath = (path: string | null) => {
		if (!path) {
			return {};
		}
		const initialExpanded: ExpandedNodePaths = {};
		for (const segmentPath of buildPathChain(path, normalizedRoot)) {
			initialExpanded[segmentPath] = true;
		}
		return initialExpanded;
	};

	const [expanded, setExpanded] = useState<ExpandedNodePaths>(() =>
		buildExpandedPathsForPath(initialTreePath)
	);
	const [selectedPath, setSelectedPath] = useState<string | null>(
		() => initialTreePath
	);
	const [focusedPath, setFocusedPath] = useState<string | null>(
		() => initialTreePath
	);
	const [lazyChildren, setLazyChildren] = useState<
		Record<string, FileNode[]>
	>({});
	const [loadingPaths, setLoadingPaths] = useState<Record<string, boolean>>(
		{}
	);
	const [draggedPath, setDraggedPath] = useState<string | null>(null);
	const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(
		null
	);
	const dragExpandTimeoutsRef = useRef<Record<string, number>>({});
	const rootAutoExpandedRef = useRef(false);
	const treeSourceVersionRef = useRef(0);

	const containerRef = useRef<HTMLDivElement>(null);
	const searchBufferTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const loadingPathsRef = useRef(loadingPaths);
	const lazyChildrenRef = useRef(lazyChildren);
	const clearAllDragExpandTimeouts = () => {
		for (const key of Object.keys(dragExpandTimeoutsRef.current)) {
			clearTimeout(dragExpandTimeoutsRef.current[key]);
			delete dragExpandTimeoutsRef.current[key];
		}
	};
	const cancelExpandOnDrag = (path: string) => {
		const timeoutId = dragExpandTimeoutsRef.current[path];
		if (timeoutId) {
			clearTimeout(timeoutId);
			delete dragExpandTimeoutsRef.current[path];
		}
	};

	useEffect(() => {
		loadingPathsRef.current = loadingPaths;
	}, [loadingPaths]);

	useEffect(() => {
		lazyChildrenRef.current = lazyChildren;
	}, [lazyChildren]);

	const focusDomNode = (path: string) => {
		const focusTarget = findNodeButton(path);
		if (focusTarget && typeof focusTarget.focus === 'function') {
			focusTarget.focus();
			focusTarget.scrollIntoView({
				behavior: 'smooth',
				block: 'nearest',
			});
		}
	};

	/**
	 * Finds a node by its exact data-path value without interpolating a CSS
	 * selector that could reinterpret filename bytes.
	 */
	const findNodeButton = (path: string): HTMLElement | null => {
		const container = containerRef.current;
		if (!container) {
			return null;
		}
		const nodes = Array.from(
			container.querySelectorAll<HTMLElement>('[data-path]')
		);
		return nodes.find((node) => node.dataset['path'] === path) ?? null;
	};

	/**
	 * Resolves a node name below its parent while preserving POSIX filename bytes.
	 */
	const generatePath = (node: FileNode, parentPath = ''): string => {
		return parentPath
			? joinPaths(parentPath, node.name)
			: joinPaths('/', node.name);
	};

	const getResolvedChildren = (
		node: FileNode,
		path: string
	): FileNode[] | undefined => {
		if (node.children) {
			return node.children;
		}
		return lazyChildren[path];
	};

	const listDir = async (fs: AsyncWritableFilesystem, basePath: string) => {
		const names = await fs.listFiles(basePath);
		const results: { name: string; type: 'file' | 'folder' }[] = [];
		for (const name of names) {
			const childPath =
				basePath === '/' ? `/${name}` : `${basePath}/${name}`;
			const isDirectory = await fs.isDir(childPath);
			results.push({ name, type: isDirectory ? 'folder' : 'file' });
		}
		results.sort((a, b) => {
			// First, sort by type (folders before files)
			if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;

			// Within same type, prioritize pending create item
			const aPath =
				basePath === '/' ? `/${a.name}` : `${basePath}/${a.name}`;
			const bPath =
				basePath === '/' ? `/${b.name}` : `${basePath}/${b.name}`;
			const pendingPath = pendingCreateRef.current?.tempPath;

			if (pendingPath) {
				if (aPath === pendingPath) return -1;
				if (bPath === pendingPath) return 1;
			}

			// Otherwise, sort alphabetically
			return a.name.localeCompare(b.name);
		});
		return results as FileNode[];
	};

	const loadChildren = async (path: string): Promise<FileNode[]> => {
		return await listDir(filesystem as AsyncWritableFilesystem, path);
	};

	const loadChildrenForPath = (
		path: string,
		node: FileNode,
		sourceVersion = treeSourceVersionRef.current
	) => {
		if (node.type !== 'folder') {
			return node.children;
		}
		if (treeSourceVersionRef.current !== sourceVersion) {
			return [];
		}
		const existingChildren = node.children ?? lazyChildrenRef.current[path];
		if (existingChildren || loadingPathsRef.current[path]) {
			return existingChildren;
		}
		setLoadingPaths((prev) => ({ ...prev, [path]: true }));
		return new Promise<FileNode[]>((resolve) => {
			loadChildren(path)
				.then((children) => {
					if (treeSourceVersionRef.current !== sourceVersion) {
						resolve([]);
						return;
					}
					setLazyChildren((prev) => ({
						...prev,
						[path]: children ?? [],
					}));
					resolve(children ?? []);
				})
				.catch(() => {
					resolve([]);
				})
				.finally(() => {
					if (treeSourceVersionRef.current !== sourceVersion) {
						return;
					}
					setLoadingPaths((prev) => {
						const next = { ...prev };
						delete next[path];
						return next;
					});
				});
		});
	};

	const scheduleExpandOnDrag = (path: string, node: FileNode) => {
		if (node.type !== 'folder') {
			return;
		}
		if (typeof window === 'undefined') {
			return;
		}
		if (dragExpandTimeoutsRef.current[path]) {
			return;
		}
		dragExpandTimeoutsRef.current[path] = window.setTimeout(() => {
			setExpanded((prev) => {
				if (prev[path]) {
					return prev;
				}
				return { ...prev, [path]: true };
			});
			void loadChildrenForPath(path, node);
			delete dragExpandTimeoutsRef.current[path];
		}, 600);
	};

	/** Reloads one directory without making an unrelated mutation fail. */
	async function refreshChildren(
		path: string
	): Promise<FileNode[] | undefined> {
		try {
			return await refreshChildrenOrThrow(path);
		} catch (error) {
			logger.error('Failed to refresh file tree directory', error);
			return undefined;
		}
	}

	/** Reloads one directory and exposes genuine failures to import callers. */
	async function refreshChildrenOrThrow(
		path: string
	): Promise<FileNode[] | undefined> {
		const sourceVersion = treeSourceVersionRef.current;
		setLoadingPaths((prev) => ({ ...prev, [path]: true }));
		try {
			const children = await loadChildren(path);
			if (treeSourceVersionRef.current !== sourceVersion) {
				return undefined;
			}
			setLazyChildren((prev) => ({
				...prev,
				[path]: children,
			}));
			return children;
		} catch (error) {
			if (treeSourceVersionRef.current !== sourceVersion) {
				return undefined;
			}
			throw error;
		} finally {
			if (treeSourceVersionRef.current === sourceVersion) {
				setLoadingPaths((prev) => {
					const next = { ...prev };
					delete next[path];
					return next;
				});
			}
		}
	}

	const toggleNode = (path: string, node: FileNode, isOpen: boolean) => {
		setExpanded((prev) => ({
			...prev,
			[path]: isOpen,
		}));
		if (isOpen) {
			void loadChildrenForPath(path, node);
		} else {
			setLazyChildren((prev) => {
				if (prev[path] === undefined) {
					return prev;
				}
				const next = { ...prev } as Record<string, FileNode[]>;
				delete next[path];
				return next;
			});
		}
	};

	const expandToPath = async (targetPath: string) => {
		const sourceVersion = treeSourceVersionRef.current;
		const normalizedTarget = resolvePathAtOrUnder(
			targetPath,
			normalizedRoot
		);
		if (!normalizedTarget) return;
		const chain = buildPathChain(normalizedTarget, normalizedRoot);
		if (chain.length === 0) return;
		setExpanded((prev) => {
			if (treeSourceVersionRef.current !== sourceVersion) {
				return prev;
			}
			const next = { ...prev } as ExpandedNodePaths;
			for (const segment of chain) {
				next[segment] = true;
			}
			return next;
		});
		// The configured root is always available in filesystem mode, even
		// before its children finish loading.
		let currentChildren: FileNode[] | undefined = [
			{ name: normalizedRoot, type: 'folder' },
		];
		let parentPath = '';
		for (const segmentPath of chain) {
			if (treeSourceVersionRef.current !== sourceVersion) {
				return;
			}
			const nextNode = currentChildren?.find((child) => {
				const childPath = generatePath(child, parentPath);
				return childPath === segmentPath;
			});
			if (!nextNode || nextNode.type !== 'folder') {
				parentPath = segmentPath;
				currentChildren = [];
				continue;
			}
			const loaded = await loadChildrenForPath(
				segmentPath,
				nextNode,
				sourceVersion
			);
			if (treeSourceVersionRef.current !== sourceVersion) {
				return;
			}
			currentChildren = loaded ?? lazyChildrenRef.current[segmentPath];
			parentPath = segmentPath;
		}
	};

	/** Remaps selection and loaded-node state after a subtree moves. */
	const remapPathState = (from: string, to: string) => {
		if (!from || !to || from === to) {
			return;
		}

		setExpanded((prev) => {
			let changed = false;
			const next: ExpandedNodePaths = { ...prev };
			for (const key of Object.keys(prev)) {
				const mapped = remapKey(key);
				if (mapped && mapped !== key) {
					next[mapped] = prev[key];
					delete next[key];
					changed = true;
				}
			}
			return changed ? next : prev;
		});

		setLazyChildren((prev) => {
			let changed = false;
			const next = { ...prev } as Record<string, FileNode[]>;
			for (const key of Object.keys(prev)) {
				const mapped = remapKey(key);
				if (mapped && mapped !== key) {
					next[mapped] = prev[key];
					delete next[key];
					changed = true;
				}
			}
			return changed ? next : prev;
		});

		setSelectedPath((prev) => {
			if (!prev) return prev;
			const mapped = remapKey(prev);
			return mapped ?? prev;
		});
		setFocusedPath((prev) => {
			if (!prev) return prev;
			const mapped = remapKey(prev);
			return mapped ?? prev;
		});

		/** Returns a remapped key, or null when the key is outside the move. */
		function remapKey(key: string): string | null {
			const mapped = remapPathAfterMove(key, from, to);
			return mapped === key ? null : mapped;
		}
	};

	const resetDragState = () => {
		setDraggedPath(null);
		setDropIndicator(null);
		clearAllDragExpandTimeouts();
	};

	/** Runs the pre-mutation hook and treats hook failures as a veto. */
	const notifyBeforePathChange = async (path: string) => {
		try {
			return (await onBeforePathChange?.(path)) !== false;
		} catch (error) {
			logger.error('Failed to prepare file tree entry change', error);
			return false;
		}
	};

	/** Reports a completed move without turning observer failures into move failures. */
	const notifyPathMoved = async (from: string, to: string) => {
		try {
			await onPathMoved?.(from, to);
		} catch (error) {
			logger.error('Failed to notify file tree entry move', error);
		}
	};

	/** Reports a completed deletion without turning observer failures into delete failures. */
	const notifyPathDeleted = async (path: string) => {
		try {
			await onPathDeleted?.(path);
		} catch (error) {
			logger.error('Failed to notify file tree entry deletion', error);
		}
	};

	/** Releases host coordination after an approved mutation settles. */
	const notifyPathChangeComplete = async (
		path: string,
		outcome: FilePickerPathChangeOutcome
	) => {
		try {
			await onPathChangeComplete?.(path, outcome);
		} catch (error) {
			logger.error('Failed to finish file tree entry change', error);
		}
	};

	/** Reports a row-drop error without letting a host callback reject the event. */
	const notifyImportError = async (error: unknown) => {
		logger.error('Failed to import dropped files or directories', error);
		try {
			await onImportError?.(error);
		} catch (notificationError) {
			logger.error(
				'Failed to report dropped file import error',
				notificationError
			);
		}
	};

	const selectPath = (path: string, notify = true) => {
		setSelectedPath(path);
		if (notify) {
			onSelect(path);
		}
	};

	// Filesystem-specific state and actions must exist before the imperative
	// handle exposes them.
	const treeFiles: FileNode[] = useMemo(() => {
		return [{ name: normalizedRoot, type: 'folder' }];
	}, [normalizedRoot]);

	const [contextMenu, setContextMenu] = useState<{
		absPath: string;
		type: 'file' | 'folder';
		x: number;
		y: number;
	} | null>(null);
	const [renamingAbsolutePath, setRenamingAbsolutePath] = useState<
		string | null
	>(null);
	const pendingCreateRef = useRef<{
		type: 'file' | 'folder';
		tempPath: string;
	} | null>(null);

	const effectiveRenamingPath = renamingAbsolutePath;
	const hasInitializedRef = useRef(false);
	const pendingInitialExpandRef = useRef<string | null>(initialTreePath);
	const previousInitialPathRef = useRef(initialTreePath);
	const previousTreeSourceRef = useRef({
		filesystem,
		normalizedRoot,
		requestIdentity,
	});

	useLayoutEffect(() => {
		const previousTreeSource = previousTreeSourceRef.current;
		if (
			previousTreeSource.filesystem === filesystem &&
			previousTreeSource.normalizedRoot === normalizedRoot &&
			previousTreeSource.requestIdentity === requestIdentity
		) {
			return;
		}
		previousTreeSourceRef.current = {
			filesystem,
			normalizedRoot,
			requestIdentity,
		};
		// Invalidate old operations before the replacement tree can be painted or
		// interacted with. A matching path in another filesystem is not the same
		// tree node.
		treeSourceVersionRef.current += 1;
		const resetPath = initialTreePath;
		setExpanded(buildExpandedPathsForPath(resetPath));
		setSelectedPath(resetPath);
		setFocusedPath(resetPath);
		lazyChildrenRef.current = {};
		loadingPathsRef.current = {};
		setLazyChildren({});
		setLoadingPaths({});
		setDraggedPath(null);
		setDropIndicator(null);
		setContextMenu(null);
		setRenamingAbsolutePath(null);
		pendingCreateRef.current = null;
		rootAutoExpandedRef.current = false;
		hasInitializedRef.current = false;
		pendingInitialExpandRef.current = resetPath;
		previousInitialPathRef.current = resetPath;
		clearAllDragExpandTimeouts();
		onSelect(resetPath);
	}, [
		filesystem,
		initialTreePath,
		normalizedRoot,
		onSelect,
		requestIdentity,
	]);

	useImperativeHandle(
		ref,
		() => ({
			focusPath: (
				path: string,
				options: {
					select?: boolean;
					domFocus?: boolean;
					notify?: boolean;
				} = {}
			) => {
				const targetPath = resolvePathAtOrUnder(path, normalizedRoot);
				if (!targetPath) return;
				const {
					select = true,
					domFocus = true,
					notify = false,
				} = options;
				if (select) {
					selectPath(targetPath, notify);
				}
				setFocusedPath(targetPath);
				if (domFocus) {
					focusDomNode(targetPath);
				}
			},
			selectPath: (path: string) => {
				const targetPath = resolvePathAtOrUnder(path, normalizedRoot);
				if (!targetPath) return;
				selectPath(targetPath);
				setFocusedPath(targetPath);
				focusDomNode(targetPath);
			},
			getSelectedPath: () => selectedPath,
			expandToPath: async (path: string) => await expandToPath(path),
			refresh: async (path: string) => {
				const targetPath = resolvePathAtOrUnder(path, normalizedRoot);
				return targetPath
					? await refreshChildrenOrThrow(targetPath)
					: undefined;
			},
			remapPath: (from: string, to: string) => {
				const sourcePath = resolvePathAtOrUnder(from, normalizedRoot);
				const destinationPath = resolvePathAtOrUnder(
					to,
					normalizedRoot
				);
				if (sourcePath && destinationPath) {
					remapPathState(sourcePath, destinationPath);
				}
			},
			importExternalItems: async (
				dataTransfer: DataTransfer,
				preferredPath?: string
			) => {
				if (readOnly) {
					return;
				}
				await importDataTransferItems(dataTransfer, preferredPath);
			},
			createFile: async (absSelectedPath?: string) => {
				const hasExplicitTarget = absSelectedPath !== undefined;
				const targetPath = hasExplicitTarget
					? resolvePathAtOrUnder(absSelectedPath, normalizedRoot)
					: undefined;
				if (hasExplicitTarget && !targetPath) {
					return;
				}
				await createNode(
					targetPath ?? undefined,
					'file',
					'untitled.php'
				);
			},
			createFolder: async (absSelectedPath?: string) => {
				const hasExplicitTarget = absSelectedPath !== undefined;
				const targetPath = hasExplicitTarget
					? resolvePathAtOrUnder(absSelectedPath, normalizedRoot)
					: undefined;
				if (hasExplicitTarget && !targetPath) {
					return;
				}
				await createNode(
					targetPath ?? undefined,
					'folder',
					'New Folder'
				);
			},
		}),
		[
			selectedPath,
			refreshChildrenOrThrow,
			remapPathState,
			expandToPath,
			readOnly,
			filesystem,
			normalizedRoot,
		]
	);

	useEffect(() => {
		rootAutoExpandedRef.current = false;
	}, [normalizedRoot]);

	useEffect(() => {
		if (
			initialTreePath &&
			initialTreePath !== previousInitialPathRef.current
		) {
			pendingInitialExpandRef.current = initialTreePath;
		} else if (!initialTreePath) {
			pendingInitialExpandRef.current = null;
		}
		previousInitialPathRef.current = initialTreePath;
	}, [initialTreePath]);
	useEffect(() => {
		if (!initialTreePath || hasInitializedRef.current) {
			return;
		}
		hasInitializedRef.current = true;
		const chain = buildPathChain(initialTreePath, normalizedRoot);
		setExpanded((prev) => {
			const next = { ...prev } as ExpandedNodePaths;
			for (const path of chain) {
				next[path] = true;
			}
			return next;
		});
		const target = chain[chain.length - 1] || initialTreePath;
		setFocusedPath(target);
		setSelectedPath(target);
		void expandToPath(initialTreePath);
	}, [initialTreePath, expandToPath, normalizedRoot]);

	useEffect(() => {
		const target = pendingInitialExpandRef.current;
		if (!target || treeFiles.length === 0) {
			return;
		}
		pendingInitialExpandRef.current = null;
		void expandToPath(target);
	}, [treeFiles, expandToPath]);

	useEffect(() => {
		if (!focusedPath) {
			if (treeFiles.length > 0) {
				const firstPath = generatePath(treeFiles[0]);
				setFocusedPath(firstPath);
			}
			return;
		}
		if (effectiveRenamingPath && effectiveRenamingPath === focusedPath) {
			return;
		}
		focusDomNode(focusedPath);
	}, [treeFiles, focusedPath, effectiveRenamingPath]);

	useEffect(() => {
		if (treeFiles.length === 0) {
			return;
		}
		const rootNode = treeFiles[0];
		if (rootNode?.type !== 'folder') {
			return;
		}
		if (rootAutoExpandedRef.current) {
			return;
		}
		const rootPath = rootNode.name;
		rootAutoExpandedRef.current = true;
		setExpanded((prev) =>
			prev[rootPath] ? prev : { ...prev, [rootPath]: true }
		);
		if (
			!lazyChildrenRef.current[rootPath] &&
			!loadingPathsRef.current[rootPath]
		) {
			void loadChildrenForPath(rootPath, rootNode);
		}
	}, [treeFiles, loadChildrenForPath, normalizedRoot]);

	useLayoutEffect(() => {
		return () => {
			// Queued imports may outlive the DOM, but they must not continue a
			// recursive batch or refresh state owned by a replacement tree.
			treeSourceVersionRef.current += 1;
			if (searchBufferTimeoutRef.current) {
				clearTimeout(searchBufferTimeoutRef.current);
			}
			clearAllDragExpandTimeouts();
		};
	}, []);

	/**
	 * Wait for the context menu (right-click menu) to render, then focus the
	 * first menu item (e.g. "Rename"). This is similar to how VS Code works.
	 */
	useEffect(() => {
		if (contextMenu) {
			setTimeout(() => {
				const firstMenuItem = document.querySelector(
					'[role="menu"] [role="menuitem"]'
				) as HTMLElement | null;
				if (
					firstMenuItem &&
					typeof firstMenuItem.focus === 'function'
				) {
					firstMenuItem.focus();
				}
			}, 0);
		}
	}, [contextMenu]);

	const [searchBuffer, setSearchBuffer] = useState('');

	const getDropDestinationDir = (node: FileNode, path: string) => {
		if (node.type === 'folder') {
			return path;
		}
		const parent = dirname(path);
		if (!parent) {
			return '/';
		}
		return parent || '/';
	};

	const evaluateDropTarget = (
		node: FileNode,
		path: string,
		sourcePath: string | null
	): DropEvaluation => {
		const destinationDir = getDropDestinationDir(node, path);
		if (!destinationDir) {
			return { allowed: false, state: 'invalid', destination: null };
		}
		if (sourcePath) {
			if (pathContainsPath(sourcePath, destinationDir)) {
				return { allowed: false, state: 'invalid', destination: null };
			}
		}
		return { allowed: true, state: 'valid', destination: destinationDir };
	};

	const handleNodeDragStart = (
		event: React.DragEvent,
		node: FileNode,
		path: string
	) => {
		if (node.type !== 'folder' && node.type !== 'file') {
			return;
		}
		setDraggedPath(path);
		setDropIndicator(null);
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData(
				'application/x-wp-playground-path',
				path
			);
			event.dataTransfer.setData('text/plain', path);
		}
	};

	const handleNodeDragEnd = () => {
		resetDragState();
	};

	const handleNodeDragEnter = (
		event: React.DragEvent,
		node: FileNode,
		path: string
	) => {
		const evaluation = evaluateDropTarget(node, path, draggedPath);
		if (evaluation.allowed) {
			if (node.type === 'folder') {
				scheduleExpandOnDrag(path, node);
			}
		}
		setDropIndicator((prev) => {
			if (prev?.path === path && prev.state === evaluation.state) {
				return prev;
			}
			return { path, state: evaluation.state };
		});
	};

	const handleNodeDragOver = (
		event: React.DragEvent,
		node: FileNode,
		path: string
	) => {
		const evaluation = evaluateDropTarget(node, path, draggedPath);
		if (evaluation.allowed && evaluation.destination) {
			event.preventDefault();
			if (event.dataTransfer) {
				event.dataTransfer.dropEffect = draggedPath ? 'move' : 'copy';
			}
			if (node.type === 'folder') {
				scheduleExpandOnDrag(path, node);
			}
			setDropIndicator((prev) => {
				if (prev?.path === path && prev.state === evaluation.state) {
					return prev;
				}
				return { path, state: evaluation.state };
			});
		} else {
			if (event.dataTransfer) {
				event.dataTransfer.dropEffect = 'none';
			}
			cancelExpandOnDrag(path);
			setDropIndicator((prev) => {
				if (prev?.path === path && prev.state === 'invalid') {
					return prev;
				}
				return { path, state: 'invalid' };
			});
		}
	};

	const handleNodeDragLeave = (
		event: React.DragEvent,
		node: FileNode,
		path: string
	) => {
		cancelExpandOnDrag(path);
		const related = event.relatedTarget as Node | null;
		if (related && event.currentTarget.contains(related)) {
			return;
		}
		setDropIndicator((prev) => (prev?.path === path ? null : prev));
	};

	const handleNodeDrop = async (
		event: React.DragEvent,
		node: FileNode,
		path: string
	) => {
		const sourceVersion = treeSourceVersionRef.current;
		const sourcePath = draggedPath;
		const evaluation = evaluateDropTarget(node, path, sourcePath);
		if (!evaluation.allowed || !evaluation.destination) {
			resetDragState();
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		cancelExpandOnDrag(path);
		setDropIndicator(null);
		try {
			if (sourcePath) {
				await moveNode(sourcePath, evaluation.destination);
			} else {
				await importDataTransferItems(
					event.dataTransfer,
					evaluation.destination
				);
			}
		} catch (error) {
			if (treeSourceVersionRef.current === sourceVersion) {
				await notifyImportError(error);
			}
		} finally {
			if (treeSourceVersionRef.current === sourceVersion) {
				resetDragState();
			}
		}
	};

	const handleInternalContextMenu = (
		event: React.MouseEvent,
		node: FileNode,
		path: string
	) => {
		if (!withContextMenu || (readOnly && node.type !== 'file')) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		setRenamingAbsolutePath(null);
		setContextMenu({
			absPath: path,
			type: node.type,
			x: event.clientX,
			y: event.clientY,
		});
	};

	const findAvailableName = async (baseDir: string, baseName: string) => {
		let name = baseName;
		let counter = 0;
		const splitExt = (n: string) => {
			const dot = n.lastIndexOf('.');
			if (dot > 0) return { stem: n.slice(0, dot), ext: n.slice(dot) };
			return { stem: n, ext: '' };
		};
		const prefix = baseDir === '/' ? '' : baseDir;
		while (
			(await filesystem?.fileExists(`${prefix}/${name}`)) ||
			(await filesystem?.isDir(`${prefix}/${name}`))
		) {
			counter += 1;
			const { stem, ext } = splitExt(baseName);
			name = `${stem} (${counter})${ext}`;
		}
		return name;
	};

	/**
	 * Creates a uniquely named entry unless this tree is read-only.
	 */
	const createNode = async (
		absSelectedPath: string | undefined,
		type: 'file' | 'folder',
		initialName: string
	) => {
		if (readOnly || !filesystem) return;
		const sourceVersion = treeSourceVersionRef.current;
		const requestedBase = absSelectedPath ?? selectedPath ?? normalizedRoot;
		const created = await serializeFilesystemOperation(
			filesystem,
			async () => {
				let base = resolvePathAtOrUnder(requestedBase, normalizedRoot);
				if (!base) {
					return;
				}
				// Ensure base is directory
				try {
					if (!(await filesystem.isDir(base))) {
						base = dirname(base);
					}
				} catch {
					base = dirname(base);
				}
				if (treeSourceVersionRef.current !== sourceVersion) {
					return;
				}
				const normalizedBase = resolvePathAtOrUnder(
					base,
					normalizedRoot
				);
				if (!normalizedBase) {
					return;
				}
				const name = await findAvailableName(
					normalizedBase,
					initialName
				);
				if (treeSourceVersionRef.current !== sourceVersion) {
					return;
				}
				const tempPath = joinPaths(normalizedBase, name);
				if (type === 'folder') {
					await filesystem.mkdir(tempPath);
				} else {
					await filesystem.writeFile(tempPath, '');
				}
				if (treeSourceVersionRef.current !== sourceVersion) {
					return;
				}
				return { normalizedBase, tempPath };
			}
		);
		if (!created) {
			return;
		}
		const { normalizedBase, tempPath } = created;
		pendingCreateRef.current = { type, tempPath };
		setRenamingAbsolutePath(tempPath);
		await refreshChildren(normalizedBase);
		if (treeSourceVersionRef.current !== sourceVersion) {
			return;
		}
		// Focus new node
		setTimeout(() => {
			if (treeSourceVersionRef.current !== sourceVersion) {
				return;
			}
			setFocusedPath(tempPath);
			focusDomNode(tempPath);
		}, 0);
	};

	/** Creates an import directory while preserving a real mkdir failure. */
	const ensureDirectory = async (path: string) => {
		if (!filesystem) return;
		try {
			await filesystem.mkdir(path);
		} catch (error) {
			const exists = await filesystem.isDir(path).catch(() => false);
			if (!exists) {
				throw error;
			}
		}
	};

	/** Moves an entry and remaps tree state for the moved subtree. */
	const moveNode = async (sourcePath: string, destinationDir: string) => {
		if (!filesystem) return;
		const sourceVersion = treeSourceVersionRef.current;
		const normalizedSource = resolvePathAtOrUnder(
			sourcePath,
			normalizedRoot
		);
		const normalizedDestinationDir = resolvePathAtOrUnder(
			destinationDir,
			normalizedRoot
		);
		if (!normalizedSource || !normalizedDestinationDir) {
			return;
		}
		const fileName = basename(normalizedSource);
		const destinationPath = joinPaths(normalizedDestinationDir, fileName);
		if (destinationPath === normalizedSource) {
			return;
		}
		if ((await getPathAvailability(destinationPath)) !== 'available') {
			return;
		}
		if (treeSourceVersionRef.current !== sourceVersion) {
			return;
		}
		if (!(await notifyBeforePathChange(normalizedSource))) {
			return;
		}
		const sourceParent = dirname(normalizedSource);
		let pathChangeCompleted = false;
		try {
			const moved = await serializeFilesystemOperation(
				filesystem,
				async () => {
					if (treeSourceVersionRef.current !== sourceVersion) {
						return false;
					}
					// mv() overwrites, so claim its destination with the mutation lock.
					if (
						(await getPathAvailability(destinationPath)) !==
						'available'
					) {
						return false;
					}
					if (treeSourceVersionRef.current !== sourceVersion) {
						return false;
					}
					await filesystem.mv(normalizedSource, destinationPath);
					return true;
				}
			);
			if (!moved) {
				return;
			}
			await notifyPathMoved(normalizedSource, destinationPath);
			await notifyPathChangeComplete(normalizedSource, 'moved');
			pathChangeCompleted = true;
			if (treeSourceVersionRef.current !== sourceVersion) {
				return;
			}
			remapPathState(normalizedSource, destinationPath);
			const mappedSelected = remapPathAfterMove(
				selectedPath,
				normalizedSource,
				destinationPath
			);
			if (pathContainsPath(normalizedSource, selectedPath)) {
				onSelect(mappedSelected);
			}
			setFocusedPath((prev) =>
				remapPathAfterMove(prev, normalizedSource, destinationPath)
			);
			setExpanded((prev) => ({
				...prev,
				[normalizedDestinationDir]: true,
			}));
			await Promise.all([
				refreshChildren(sourceParent),
				refreshChildren(normalizedDestinationDir),
			]);
			if (treeSourceVersionRef.current !== sourceVersion) {
				return;
			}
			setSelectedPath((prev) =>
				remapPathAfterMove(prev, normalizedSource, destinationPath)
			);
			focusDomNode(destinationPath);
		} catch (error) {
			logger.error('Failed to move file tree entry', error);
		} finally {
			if (!pathChangeCompleted) {
				await notifyPathChangeComplete(normalizedSource, 'failed');
			}
		}
	};

	/** Reads Chromium's recursive-drop entry without assuming the API exists. */
	const getEntryFromItem = (item: DataTransferItem) => {
		const maybeItem = item as DataTransferItem & {
			webkitGetAsEntry?: () => FileSystemEntryLike | null;
		};
		if (maybeItem.webkitGetAsEntry) {
			return maybeItem.webkitGetAsEntry() as FileSystemEntryLike | null;
		}
		return null;
	};

	/** Converts the callback-based host file entry API into a promise. */
	const fileFromEntry = (entry: FileSystemFileEntryLike) => {
		return new Promise<File>((resolve, reject) => {
			entry.file(resolve, reject);
		});
	};

	/** Writes one host file under an unused name while its source is current. */
	const importFileBlob = async (
		file: File,
		destinationDir: string,
		sourceVersion: number
	): Promise<boolean> => {
		if (treeSourceVersionRef.current !== sourceVersion) {
			return false;
		}
		const safeName = file.name || 'untitled';
		if (!isValidPosixPathSegment(safeName)) {
			throw new Error(`Invalid imported file name: ${safeName}`);
		}
		const buffer = new Uint8Array(await file.arrayBuffer());
		if (treeSourceVersionRef.current !== sourceVersion) {
			return false;
		}
		const targetName = await findAvailableName(destinationDir, safeName);
		if (treeSourceVersionRef.current !== sourceVersion) {
			return false;
		}
		const targetPath = resolvePathAtOrUnder(
			joinPaths(destinationDir, targetName),
			normalizedRoot
		);
		if (!targetPath || targetPath === normalizedRoot) {
			throw new Error(
				`Imported file name escapes the tree root: ${safeName}`
			);
		}
		await filesystem.writeFile(targetPath, buffer);
		return treeSourceVersionRef.current === sourceVersion;
	};

	/** Resolves and imports one callback-based host file entry. */
	const importFileEntry = async (
		entry: FileSystemFileEntryLike,
		destinationDir: string,
		sourceVersion: number
	): Promise<boolean> => {
		if (treeSourceVersionRef.current !== sourceVersion) {
			return false;
		}
		if (entry.name && !isValidPosixPathSegment(entry.name)) {
			throw new Error(`Invalid imported file entry name: ${entry.name}`);
		}
		const file = await fileFromEntry(entry);
		if (treeSourceVersionRef.current !== sourceVersion) {
			return false;
		}
		return await importFileBlob(file, destinationDir, sourceVersion);
	};

	/** Recursively imports a host directory and reports its first child error. */
	const importDirectoryEntry = async (
		entry: FileSystemDirectoryEntryLike,
		destinationDir: string,
		sourceVersion: number
	): Promise<boolean> => {
		if (treeSourceVersionRef.current !== sourceVersion) {
			return false;
		}
		const safeName = entry.name || 'New Folder';
		if (!isValidPosixPathSegment(safeName)) {
			throw new Error(`Invalid imported directory name: ${safeName}`);
		}
		const folderName = await findAvailableName(destinationDir, safeName);
		if (treeSourceVersionRef.current !== sourceVersion) {
			return false;
		}
		const folderPath = resolvePathAtOrUnder(
			joinPaths(destinationDir, folderName),
			normalizedRoot
		);
		if (!folderPath || folderPath === normalizedRoot) {
			throw new Error(
				`Imported directory name escapes the tree root: ${safeName}`
			);
		}
		await ensureDirectory(folderPath);
		if (treeSourceVersionRef.current !== sourceVersion) {
			return false;
		}
		const reader = entry.createReader();
		const readEntries = () =>
			new Promise<FileSystemEntryLike[]>((resolve, reject) => {
				reader.readEntries(
					(entries) => resolve(Array.from(entries)),
					reject
				);
			});
		let firstFailure: unknown;
		while (true) {
			if (treeSourceVersionRef.current !== sourceVersion) {
				return false;
			}
			const batch = await readEntries();
			if (treeSourceVersionRef.current !== sourceVersion) {
				return false;
			}
			if (!batch.length) {
				break;
			}
			for (const child of batch) {
				if (treeSourceVersionRef.current !== sourceVersion) {
					return false;
				}
				try {
					let completed = true;
					if (child.isFile) {
						completed = await importFileEntry(
							child as FileSystemFileEntryLike,
							folderPath,
							sourceVersion
						);
					} else if (child.isDirectory) {
						completed = await importDirectoryEntry(
							child as FileSystemDirectoryEntryLike,
							folderPath,
							sourceVersion
						);
					}
					if (!completed) {
						return false;
					}
				} catch (error) {
					firstFailure ??= error;
				}
			}
		}
		if (treeSourceVersionRef.current !== sourceVersion) {
			return false;
		}
		if (firstFailure) {
			throw firstFailure;
		}
		return true;
	};

	/**
	 * Captures a host drop synchronously, then imports its files and directories.
	 * DataTransfer contents are protected once the drop handler yields control.
	 */
	const importDataTransferItems = async (
		dataTransfer: DataTransfer,
		preferredPath?: string
	) => {
		if (!filesystem) return;
		const sourceVersion = treeSourceVersionRef.current;
		const items = Array.from(dataTransfer.items ?? []);
		const entries = items
			.filter((item) => item.kind === 'file')
			.map((item) => getEntryFromItem(item))
			.filter((entry): entry is FileSystemEntryLike => Boolean(entry));
		const files = entries.length
			? []
			: Array.from(dataTransfer.files ?? []);
		await serializeFilesystemOperation(filesystem, async () => {
			if (treeSourceVersionRef.current !== sourceVersion) {
				return;
			}
			const destinationDir =
				await resolveExternalDropDirectory(preferredPath);
			if (treeSourceVersionRef.current !== sourceVersion) {
				return;
			}
			let firstFailure: unknown;
			let refreshFailure: unknown;
			try {
				if (entries.length > 0) {
					for (const entry of entries) {
						try {
							let completed = true;
							if (entry.isFile) {
								completed = await importFileEntry(
									entry as FileSystemFileEntryLike,
									destinationDir,
									sourceVersion
								);
							} else if (entry.isDirectory) {
								completed = await importDirectoryEntry(
									entry as FileSystemDirectoryEntryLike,
									destinationDir,
									sourceVersion
								);
							}
							if (!completed) {
								return;
							}
						} catch (error) {
							firstFailure ??= error;
						}
					}
				} else {
					for (const file of files) {
						try {
							const completed = await importFileBlob(
								file,
								destinationDir,
								sourceVersion
							);
							if (!completed) {
								return;
							}
						} catch (error) {
							firstFailure ??= error;
						}
					}
				}
			} finally {
				if (treeSourceVersionRef.current === sourceVersion) {
					try {
						await refreshChildrenOrThrow(destinationDir);
						if (treeSourceVersionRef.current === sourceVersion) {
							setExpanded((prev) => ({
								...prev,
								[destinationDir]: true,
							}));
						}
					} catch (error) {
						refreshFailure = error;
					}
				}
			}
			if (treeSourceVersionRef.current !== sourceVersion) {
				return;
			}
			if (firstFailure) {
				throw firstFailure;
			}
			if (refreshFailure) {
				throw new Error(
					'Files were imported, but the file list could not be refreshed.',
					{ cause: refreshFailure }
				);
			}
		});
	};

	/** Resolves an external drop target without allowing it to escape the root. */
	const resolveExternalDropDirectory = async (preferredPath?: string) => {
		const requestedPath = preferredPath ?? selectedPath;
		const candidatePath = requestedPath
			? resolvePathAtOrUnder(requestedPath, normalizedRoot)
			: null;
		if (!candidatePath) {
			return normalizedRoot;
		}
		if (await filesystem.isDir(candidatePath)) {
			return candidatePath;
		}
		const parentPath = resolvePathAtOrUnder(
			dirname(candidatePath),
			normalizedRoot
		);
		if (!parentPath) {
			return normalizedRoot;
		}
		return (await filesystem.isDir(parentPath))
			? parentPath
			: normalizedRoot;
	};

	/** Deletes an entry and clears selection when it pointed into that subtree. */
	const handleDeletePath = async (
		absSelectedPath: string,
		type: 'file' | 'folder'
	) => {
		if (!filesystem) return;
		const sourceVersion = treeSourceVersionRef.current;
		const normalized = resolvePathAtOrUnder(
			absSelectedPath,
			normalizedRoot
		);
		if (!normalized || normalized === normalizedRoot) return;
		const parentDir = dirname(normalized);
		setContextMenu(null);
		if (!(await notifyBeforePathChange(normalized))) {
			return;
		}
		let deleted = false;
		let pathChangeCompleted = false;
		try {
			deleted = await serializeFilesystemOperation(
				filesystem,
				async () => {
					if (treeSourceVersionRef.current !== sourceVersion) {
						return false;
					}
					if (type === 'folder') {
						await filesystem.rmdir(normalized, {
							recursive: true,
						} as any);
					} else {
						await filesystem.unlink(normalized);
					}
					return true;
				}
			);
			if (!deleted) {
				return;
			}
			await notifyPathDeleted(normalized);
			await notifyPathChangeComplete(normalized, 'deleted');
			pathChangeCompleted = true;
		} catch (error) {
			logger.error('Failed to delete file tree entry', error);
		} finally {
			if (!pathChangeCompleted) {
				await notifyPathChangeComplete(normalized, 'failed');
			}
		}
		if (treeSourceVersionRef.current !== sourceVersion) {
			return;
		}
		setRenamingAbsolutePath(null);
		await refreshChildren(parentDir);
		if (treeSourceVersionRef.current !== sourceVersion) {
			return;
		}
		// A failed delete must not make a live node disappear from selection.
		if (deleted && pathContainsPath(normalized, selectedPath)) {
			setSelectedPath(null);
			setFocusedPath(parentDir);
			onSelect(null);
			setTimeout(() => {
				if (treeSourceVersionRef.current !== sourceVersion) {
					return;
				}
				focusDomNode(parentDir);
			}, 0);
		}
	};

	const handleDownloadPath = async (absPath: string) => {
		if (!filesystem) {
			return;
		}
		try {
			const file = await filesystem.read(absPath);
			const buffer = await file.arrayBuffer();
			const blob = new Blob([buffer as BlobPart]);
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement('a');
			anchor.href = url;
			anchor.download = basename(absPath) || 'download';
			document.body.appendChild(anchor);
			anchor.click();
			document.body.removeChild(anchor);
			setTimeout(() => URL.revokeObjectURL(url), 60_000);
		} catch (error) {
			logger.error('Failed to download file', error);
		}
	};

	const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		// Skip type-ahead when renaming to avoid interfering with rename input
		if (renamingAbsolutePath) {
			return;
		}

		if (event.key.length === 1 && event.key.match(/\S/)) {
			const newSearchBuffer = searchBuffer + event.key.toLowerCase();
			setSearchBuffer(newSearchBuffer);
			if (searchBufferTimeoutRef.current) {
				clearTimeout(searchBufferTimeoutRef.current);
			}
			searchBufferTimeoutRef.current = setTimeout(() => {
				setSearchBuffer('');
			}, 1000);
			if (!containerRef.current) {
				return;
			}
			const buttons = Array.from(
				containerRef.current.querySelectorAll('.file-node-button')
			);
			const activeElement = document.activeElement;
			let startIndex = 0;
			if (
				activeElement &&
				buttons.includes(activeElement as HTMLButtonElement)
			) {
				startIndex = buttons.indexOf(
					activeElement as HTMLButtonElement
				);
			}
			for (let i = 0; i < buttons.length; i++) {
				const index = (startIndex + i) % buttons.length;
				const button = buttons[index] as HTMLElement;
				if (
					button.textContent
						?.toLowerCase()
						.trim()
						.startsWith(newSearchBuffer)
				) {
					button.focus();
					const path = button.getAttribute('data-path');
					if (path) {
						setFocusedPath(path);
					}
					break;
				}
			}
		} else {
			setSearchBuffer('');
			if (searchBufferTimeoutRef.current) {
				clearTimeout(searchBufferTimeoutRef.current);
			}
		}
	};

	// Filesystem errors are reported upstream; this tree has no separate error UI.
	// Filesystem-mode rename handlers
	const handleRename = async (absPath: string, newName: string) => {
		const sourceVersion = treeSourceVersionRef.current;
		const path = resolvePathAtOrUnder(absPath, normalizedRoot);
		if (!path || path === normalizedRoot) {
			return;
		}
		const pending = pendingCreateRef.current;
		const isPending = pending?.tempPath === path;
		const parent = dirname(path);
		const sanitized = (newName || '').trim();
		if (!isValidPosixPathSegment(sanitized)) {
			if (isPending) {
				try {
					await serializeFilesystemOperation(filesystem, async () => {
						if (treeSourceVersionRef.current !== sourceVersion) {
							return;
						}
						if (pending.type === 'folder') {
							await filesystem.rmdir(path, {
								recursive: true,
							} as any);
						} else {
							await filesystem.unlink(path);
						}
					});
				} catch {
					/* noop */
				}
				if (treeSourceVersionRef.current !== sourceVersion) {
					return;
				}
				pendingCreateRef.current = null;
				setRenamingAbsolutePath(null);
				await refreshChildren(parent);
				if (treeSourceVersionRef.current !== sourceVersion) {
					return;
				}
				setFocusedPath(parent);
				focusDomNode(parent);
				return;
			}
			setRenamingAbsolutePath(path);
			return;
		}
		let candidate = joinPaths(parent, sanitized);
		let candidateNormalized = candidate;
		if (candidateNormalized === path) {
			setRenamingAbsolutePath(null);
			const wasFileCreate = isPending && pending?.type === 'file';
			if (isPending) pendingCreateRef.current = null;
			setTimeout(() => {
				if (treeSourceVersionRef.current !== sourceVersion) {
					return;
				}
				setSelectedPath(candidateNormalized);
				setFocusedPath(candidateNormalized);
				focusDomNode(candidateNormalized);
				// We've just saved a new file, immediately open it in the code editor.
				if (wasFileCreate && onDoubleClickFile) {
					onDoubleClickFile(candidateNormalized);
				}
			}, 0);
			return;
		}
		const candidateAvailability =
			await getPathAvailability(candidateNormalized);
		if (treeSourceVersionRef.current !== sourceVersion) {
			return;
		}
		if (candidateAvailability === 'unknown') {
			setRenamingAbsolutePath(path);
			return;
		}
		if (
			candidateAvailability === 'exists' &&
			candidateNormalized !== path
		) {
			if (isPending) {
				try {
					const unique = await findAvailableName(
						parent === '/' ? '/' : parent,
						sanitized
					);
					candidate = joinPaths(parent, unique);
					candidateNormalized = candidate;
				} catch (error) {
					logger.error(
						'Failed to find an available file tree name',
						error
					);
					if (treeSourceVersionRef.current !== sourceVersion) {
						return;
					}
					setRenamingAbsolutePath(path);
					return;
				}
			} else {
				setRenamingAbsolutePath(path);
				return;
			}
		}
		if (treeSourceVersionRef.current !== sourceVersion) {
			return;
		}
		const mayRename = await notifyBeforePathChange(path);
		if (treeSourceVersionRef.current !== sourceVersion) {
			if (mayRename) {
				await notifyPathChangeComplete(path, 'failed');
			}
			return;
		}
		if (!mayRename) {
			setRenamingAbsolutePath(path);
			return;
		}
		let candidateIsDir = pending?.type === 'folder';
		let pathChangeCompleted = false;
		let keepRenameEditor = false;
		try {
			const moved = await serializeFilesystemOperation(
				filesystem,
				async () => {
					if (treeSourceVersionRef.current !== sourceVersion) {
						return false;
					}
					// mv() overwrites, so claim its destination with the mutation lock.
					const destinationIsAvailable =
						candidateNormalized === path ||
						(await getPathAvailability(candidateNormalized)) ===
							'available';
					if (
						!destinationIsAvailable ||
						treeSourceVersionRef.current !== sourceVersion
					) {
						return false;
					}
					if (!pending) {
						candidateIsDir = await filesystem.isDir(path);
						if (treeSourceVersionRef.current !== sourceVersion) {
							return false;
						}
					}
					await filesystem.mv(path, candidate);
					return true;
				}
			);
			if (!moved) {
				if (treeSourceVersionRef.current !== sourceVersion) {
					return;
				}
				keepRenameEditor = true;
				setRenamingAbsolutePath(path);
				return;
			}
			await notifyPathMoved(path, candidateNormalized);
			await notifyPathChangeComplete(path, 'moved');
			pathChangeCompleted = true;
			if (treeSourceVersionRef.current !== sourceVersion) {
				return;
			}
			const mappedSelectedPath = selectedPath
				? remapPathAfterMove(selectedPath, path, candidateNormalized)
				: selectedPath;
			const selectionWasInsideRenamedPath =
				selectedPath !== null && mappedSelectedPath !== selectedPath;
			if (candidateIsDir) {
				remapPathState(path, candidateNormalized);
			}
			if (selectionWasInsideRenamedPath) {
				onSelect(mappedSelectedPath);
			}
			await refreshChildren(parent);
			if (treeSourceVersionRef.current !== sourceVersion) {
				return;
			}
			setSelectedPath(
				selectionWasInsideRenamedPath && mappedSelectedPath
					? mappedSelectedPath
					: candidateNormalized
			);
			setFocusedPath(candidateNormalized);
			focusDomNode(candidateNormalized);
			// If this was a newly created file, open it in the editor
			if (isPending && !candidateIsDir && onDoubleClickFile) {
				onDoubleClickFile(candidateNormalized);
			}
		} catch (error) {
			logger.error('Failed to rename file tree entry', error);
			if (isPending && treeSourceVersionRef.current === sourceVersion) {
				try {
					await serializeFilesystemOperation(filesystem, async () => {
						if (treeSourceVersionRef.current !== sourceVersion) {
							return;
						}
						if (pending?.type === 'folder') {
							await filesystem.rmdir(path, {
								recursive: true,
							} as any);
						} else {
							await filesystem.unlink(path);
						}
					});
				} catch {
					/* noop */
				}
			}
		} finally {
			if (!pathChangeCompleted) {
				await notifyPathChangeComplete(path, 'failed');
			}
			if (
				treeSourceVersionRef.current === sourceVersion &&
				!keepRenameEditor
			) {
				pendingCreateRef.current = null;
				setRenamingAbsolutePath(null);
			}
		}
	};

	/** Classifies a path without treating failed metadata reads as absence. */
	const getPathAvailability = async (
		path: string
	): Promise<PathAvailability> => {
		try {
			if (await filesystem.fileExists(path)) {
				return 'exists';
			}
			if (await filesystem.isDir(path)) {
				return 'exists';
			}
			return 'available';
		} catch (error) {
			logger.error('Failed to inspect file tree destination', error);
			return 'unknown';
		}
	};

	const handleRenameCancelInternal = async (absPath: string) => {
		const sourceVersion = treeSourceVersionRef.current;
		const path = resolvePathAtOrUnder(absPath, normalizedRoot);
		const pending = pendingCreateRef.current;
		if (!path || pending?.tempPath !== path) {
			setRenamingAbsolutePath((prev) => (prev === path ? null : prev));
			return;
		}
		try {
			await serializeFilesystemOperation(filesystem, async () => {
				if (treeSourceVersionRef.current !== sourceVersion) {
					return;
				}
				if (pending.type === 'folder') {
					await filesystem.rmdir(path, { recursive: true } as any);
				} else {
					await filesystem.unlink(path);
				}
			});
		} catch {
			/* noop */
		}
		if (treeSourceVersionRef.current !== sourceVersion) {
			return;
		}
		pendingCreateRef.current = null;
		setRenamingAbsolutePath(null);
		const parentDir = dirname(path);
		await refreshChildren(parentDir);
		if (treeSourceVersionRef.current !== sourceVersion) {
			return;
		}
		setFocusedPath(parentDir);
		focusDomNode(parentDir);
	};

	useEffect(() => {
		if (!readOnly || !renamingAbsolutePath) {
			return;
		}
		if (pendingCreateRef.current?.tempPath === renamingAbsolutePath) {
			void handleRenameCancelInternal(renamingAbsolutePath);
			return;
		}
		setRenamingAbsolutePath(null);
	}, [readOnly, renamingAbsolutePath]);

	return (
		<div onKeyDown={handleKeyDown} ref={containerRef}>
			<TreeGrid className={css['filePickerTree']}>
				{treeFiles.map((file, index) => (
					<NodeRow
						key={file.name}
						node={file}
						level={0}
						position={index + 1}
						setSize={treeFiles.length}
						expandedNodePaths={expanded}
						onToggle={toggleNode}
						selectedNode={selectedPath}
						focusPath={(path) => setFocusedPath(path)}
						focusedNode={focusedPath}
						selectPath={selectPath}
						generatePath={generatePath}
						getChildren={getResolvedChildren}
						onContextMenu={
							withContextMenu
								? handleInternalContextMenu
								: undefined
						}
						renamingPath={effectiveRenamingPath}
						onRename={readOnly ? undefined : handleRename}
						onRenameCancel={
							readOnly ? undefined : handleRenameCancelInternal
						}
						dropIndicator={dropIndicator}
						canDrag={!readOnly}
						onDragStart={readOnly ? undefined : handleNodeDragStart}
						onDragEnd={readOnly ? undefined : handleNodeDragEnd}
						onDragEnter={readOnly ? undefined : handleNodeDragEnter}
						onDragOver={readOnly ? undefined : handleNodeDragOver}
						onDragLeave={readOnly ? undefined : handleNodeDragLeave}
						onDrop={readOnly ? undefined : handleNodeDrop}
						rootPath={normalizedRoot}
						findNodeButton={findNodeButton}
						onDoubleClickFile={onDoubleClickFile}
					/>
				))}
			</TreeGrid>
			{withContextMenu && contextMenu && (
				<Popover
					placement="bottom-start"
					onClose={() => setContextMenu(null)}
					anchor={{
						getBoundingClientRect: () => ({
							x: contextMenu.x,
							y: contextMenu.y,
							width: 0,
							height: 0,
							top: contextMenu.y,
							left: contextMenu.x,
							right: contextMenu.x,
							bottom: contextMenu.y,
							toJSON: () => ({}),
						}),
						ownerDocument: document,
					}}
					noArrow={true}
					resize={false}
					focusOnMount="firstElement"
				>
					<NavigableMenu role="menu">
						{!readOnly && contextMenu.type === 'folder' && (
							<MenuItem
								role="menuitem"
								onClick={async () => {
									setContextMenu(null);
									await createNode(
										contextMenu.absPath,
										'file',
										'untitled.php'
									);
								}}
							>
								Create file
							</MenuItem>
						)}
						{!readOnly && contextMenu.type === 'folder' && (
							<MenuItem
								role="menuitem"
								onClick={async () => {
									setContextMenu(null);
									await createNode(
										contextMenu.absPath,
										'folder',
										'New Folder'
									);
								}}
							>
								Create directory
							</MenuItem>
						)}
						{contextMenu.absPath !== normalizedRoot && (
							<>
								{!readOnly && (
									<MenuItem
										role="menuitem"
										onClick={() => {
											setContextMenu(null);
											setRenamingAbsolutePath(
												contextMenu.absPath
											);
										}}
									>
										Rename
									</MenuItem>
								)}
								{contextMenu.type === 'file' && (
									<MenuItem
										role="menuitem"
										onClick={async () => {
											setContextMenu(null);
											await handleDownloadPath(
												contextMenu.absPath
											);
										}}
									>
										Download
									</MenuItem>
								)}
								{!readOnly && (
									<MenuItem
										role="menuitem"
										onClick={() =>
											handleDeletePath(
												contextMenu.absPath,
												contextMenu.type
											)
										}
									>
										Delete
									</MenuItem>
								)}
							</>
						)}
					</NavigableMenu>
				</Popover>
			)}
		</div>
	);
});

/**
 * Returns the root-to-target expansion chain, or none when target escapes root.
 */
function buildPathChain(path: string, root: string): string[] {
	const normalizedRoot = joinPaths('/', root || '/');
	const normalized = resolvePathAtOrUnder(path, normalizedRoot);
	if (!normalized) {
		return [];
	}

	const chain: string[] = [];
	let current = normalized;
	while (current) {
		chain.unshift(current);
		if (current === normalizedRoot) {
			break;
		}
		const parent = dirname(current);
		if (!parent || parent === current) {
			break;
		}
		current = parent;
	}
	return chain;
}

/**
 * Renders one tree row and recursively renders its expanded descendants.
 */
const NodeRow: React.FC<{
	node: FileNode;
	level: number;
	position: number;
	setSize: number;
	expandedNodePaths: ExpandedNodePaths;
	onToggle: (
		path: string,
		node: FileNode,
		isOpen: boolean
	) => void | Promise<void>;
	selectedNode: string | null;
	focusPath: (path: string) => void;
	focusedNode: string | null;
	selectPath: (path: string, notify?: boolean) => void;
	generatePath: (node: FileNode, parentPath?: string) => string;
	getChildren: (node: FileNode, path: string) => FileNode[] | undefined;
	onContextMenu?: (
		event: React.MouseEvent,
		node: FileNode,
		path: string
	) => void;
	renamingPath: string | null;
	onRename?: (path: string, newName: string) => void;
	onRenameCancel?: (path: string) => void;
	parentPath?: string;
	dropIndicator: DropIndicator | null;
	canDrag: boolean;
	onDragStart?: (
		event: React.DragEvent,
		node: FileNode,
		path: string
	) => void;
	onDragEnd?: (event: React.DragEvent, node: FileNode, path: string) => void;
	onDragEnter?: (
		event: React.DragEvent,
		node: FileNode,
		path: string
	) => void;
	onDragOver?: (event: React.DragEvent, node: FileNode, path: string) => void;
	onDragLeave?: (
		event: React.DragEvent,
		node: FileNode,
		path: string
	) => void;
	onDrop?: (event: React.DragEvent, node: FileNode, path: string) => void;
	rootPath: string;
	findNodeButton: (path: string) => HTMLElement | null;
	onDoubleClickFile?: (path: string) => void;
}> = ({
	node,
	level,
	position,
	setSize,
	expandedNodePaths,
	onToggle,
	selectedNode,
	focusPath,
	focusedNode,
	selectPath,
	generatePath,
	getChildren,
	onContextMenu,
	renamingPath,
	onRename,
	onRenameCancel,
	parentPath = '',
	dropIndicator,
	canDrag,
	onDragStart,
	onDragEnd,
	onDragEnter,
	onDragOver,
	onDragLeave,
	onDrop,
	rootPath,
	findNodeButton,
	onDoubleClickFile,
}) => {
	const path = generatePath(node, parentPath);
	const isExpanded = expandedNodePaths[path];
	const isRenaming = renamingPath === path;
	const renameInputRef = useRef<HTMLInputElement>(null);
	const renameHandledRef = useRef(false);
	const isDropTarget = dropIndicator?.path === path;
	const isDropTargetValid = isDropTarget && dropIndicator?.state === 'valid';
	const isDropTargetInvalid =
		isDropTarget && dropIndicator?.state === 'invalid';
	const isDraggable = canDrag && !isRenaming && path !== rootPath;
	const clickTimeoutRef = useRef<number | null>(null);

	const dragHandlers = {
		onDragEnter: (event: React.DragEvent) =>
			onDragEnter?.(event, node, path),
		onDragOver: (event: React.DragEvent) => onDragOver?.(event, node, path),
		onDragLeave: (event: React.DragEvent) =>
			onDragLeave?.(event, node, path),
		onDrop: (event: React.DragEvent) => onDrop?.(event, node, path),
	};

	const resolvedChildren = getChildren(node, path) ?? [];

	useEffect(() => {
		if (isRenaming) {
			renameHandledRef.current = false;
			if (typeof window !== 'undefined' && requestAnimationFrame) {
				requestAnimationFrame(() => {
					renameInputRef.current?.select();
				});
			} else {
				renameInputRef.current?.select();
			}
		} else {
			renameHandledRef.current = false;
		}
	}, [isRenaming, node.name]);

	const toggleOpen = () => {
		if (node.type === 'folder') {
			onToggle(path, node, !isExpanded);
		}
	};

	const handleKeyDown = (event: React.KeyboardEvent) => {
		if (event.key === 'ArrowLeft') {
			if (isExpanded) {
				toggleOpen();
			} else {
				findNodeButton(parentPath)?.focus();
			}
			event.preventDefault();
			event.stopPropagation();
		} else if (event.key === 'ArrowRight') {
			if (isExpanded) {
				if (resolvedChildren?.length) {
					const firstChildPath = generatePath(
						resolvedChildren[0],
						path
					);
					findNodeButton(firstChildPath)?.focus();
				}
			} else {
				toggleOpen();
			}
			event.preventDefault();
			event.stopPropagation();
		} else if (
			event.key === ' ' ||
			event.key === 'Space' ||
			event.key === 'Spacebar'
		) {
			if (node.type === 'folder') {
				onToggle(path, node, !isExpanded);
			}
			event.preventDefault();
		} else if (event.key === 'Enter') {
			if (node.type === 'folder') {
				// For folders, toggle open/closed
				onToggle(path, node, !isExpanded);
			} else {
				// For files, behave like double-click: open with focus
				selectPath(path, false); // Update visual selection
				focusPath(path);
				if (onDoubleClickFile) {
					onDoubleClickFile(path); // Open file and move focus to editor
				} else {
					selectPath(path, true); // Fallback behavior
				}
			}
			event.preventDefault();
		}
	};

	const handleContextMenu = (event: React.MouseEvent) => {
		onContextMenu?.(event, node, path);
	};

	const handleRenameSubmit = (event: React.FormEvent) => {
		event.preventDefault();
		renameHandledRef.current = true;
		const form = event.currentTarget as HTMLFormElement;
		const submittedName = new FormData(form).get('filename');
		onRename?.(
			path,
			(typeof submittedName === 'string'
				? submittedName
				: node.name
			).trim()
		);
	};

	const handleRenameKeyDown = (
		event: React.KeyboardEvent<HTMLInputElement>
	) => {
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			renameHandledRef.current = true;
			onRenameCancel?.(path);
			return;
		}
		if (
			event.key === 'ArrowLeft' ||
			event.key === 'ArrowRight' ||
			event.key === 'ArrowUp' ||
			event.key === 'ArrowDown'
		) {
			event.stopPropagation();
		}
	};

	const handleRenameBlur = () => {
		if (!renameHandledRef.current) {
			onRenameCancel?.(path);
		}
		renameHandledRef.current = false;
	};

	const handleClick = () => {
		// Folders – collapse or expand immediately
		if (node.type === 'folder') {
			toggleOpen();
			selectPath(path);
			focusPath(path);
			return;
		}

		const wasWaitingForDoubleClick = clickTimeoutRef.current !== null;
		if (wasWaitingForDoubleClick && clickTimeoutRef.current) {
			clearTimeout(clickTimeoutRef.current);
		}
		clickTimeoutRef.current = null;

		if (wasWaitingForDoubleClick) {
			if (onDoubleClickFile) {
				onDoubleClickFile(path);
			} else {
				selectPath(path, true);
			}
			return;
		}

		// Single click: update selection, keep focus in the tree, and open the file.
		selectPath(path, false);
		focusPath(path);
		selectPath(path, true);

		clickTimeoutRef.current = window.setTimeout(() => {
			clickTimeoutRef.current = null;
		}, 300);
	};

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => {
			if (
				clickTimeoutRef.current !== null &&
				typeof window !== 'undefined'
			) {
				clearTimeout(clickTimeoutRef.current);
			}
		};
	}, []);

	return (
		<>
			<TreeGridRow
				level={level}
				positionInSet={position}
				setSize={setSize}
			>
				<TreeGridCell>
					{() => (
						<>
							{isRenaming ? (
								<form
									onSubmit={handleRenameSubmit}
									className={classNames(
										css['fileNodeButton'],
										css['renaming'],
										'file-node-button',
										{
											[css['selected']]:
												selectedNode === path,
											[css['focused']]:
												focusedNode === path,
											[css['dropTarget']]:
												isDropTargetValid,
											[css['dropTargetInvalid']]:
												isDropTargetInvalid,
										}
									)}
									data-path={path}
									onContextMenu={handleContextMenu}
									{...dragHandlers}
								>
									<FileName
										node={node}
										isOpen={
											node.type === 'folder' && isExpanded
										}
										level={level}
										hideName
									/>
									<input
										name="filename"
										ref={renameInputRef}
										className={css['renameInput']}
										defaultValue={node.name}
										onBlur={handleRenameBlur}
										onFocus={() => focusPath(path)}
										onKeyDown={handleRenameKeyDown}
									/>
								</form>
							) : (
								<Button
									{...dragHandlers}
									draggable={isDraggable}
									onDragStart={(event: any) =>
										onDragStart?.(event, node, path)
									}
									onDragEnd={(event: any) =>
										onDragEnd?.(event, node, path)
									}
									onClick={handleClick}
									onKeyDown={handleKeyDown}
									onFocus={() => {
										focusPath(path);
									}}
									onContextMenu={handleContextMenu}
									className={classNames(
										css['fileNodeButton'],
										'file-node-button',
										{
											[css['selected']]:
												selectedNode === path,
											[css['focused']]:
												focusedNode === path,
											[css['dropTarget']]:
												isDropTargetValid,
											[css['dropTargetInvalid']]:
												isDropTargetInvalid,
										}
									)}
									data-path={path}
									data-expanded={
										isExpanded ? 'true' : 'false'
									}
								>
									<FileName
										node={node}
										isOpen={
											node.type === 'folder' && isExpanded
										}
										level={level}
									/>
								</Button>
							)}
						</>
					)}
				</TreeGridCell>
			</TreeGridRow>
			{isExpanded &&
				resolvedChildren &&
				resolvedChildren.map((child, index) => (
					<NodeRow
						key={child.name}
						node={child}
						level={level + 1}
						position={index + 1}
						setSize={resolvedChildren.length}
						expandedNodePaths={expandedNodePaths}
						onToggle={onToggle}
						selectedNode={selectedNode}
						focusPath={focusPath}
						focusedNode={focusedNode}
						selectPath={selectPath}
						generatePath={generatePath}
						getChildren={getChildren}
						onContextMenu={onContextMenu}
						renamingPath={renamingPath}
						onRename={onRename}
						onRenameCancel={onRenameCancel}
						parentPath={path}
						dropIndicator={dropIndicator}
						canDrag={canDrag}
						onDragStart={onDragStart}
						onDragEnd={onDragEnd}
						onDragEnter={onDragEnter}
						onDragOver={onDragOver}
						onDragLeave={onDragLeave}
						onDrop={onDrop}
						rootPath={rootPath}
						findNodeButton={findNodeButton}
						onDoubleClickFile={onDoubleClickFile}
					/>
				))}
		</>
	);
};

const FileName: React.FC<{
	node: FileNode;
	level: number;
	isOpen?: boolean;
	hideName?: boolean;
}> = ({ node, level, isOpen, hideName = false }) => {
	const indent: string[] = [];
	for (let i = 0; i < level; i++) {
		indent.push('&nbsp;&nbsp;&nbsp;&nbsp;');
	}
	return (
		<>
			<span
				aria-hidden="true"
				dangerouslySetInnerHTML={{ __html: indent.join('') }}
			></span>
			{node.type === 'folder' ? (
				<Icon width={16} icon={isOpen ? chevronDown : chevronRight} />
			) : (
				<div style={{ width: 16 }}>&nbsp;</div>
			)}
			<Icon width={16} icon={node.type === 'folder' ? folder : file} />
			{!hideName && <span className={css['fileName']}>{node.name}</span>}
		</>
	);
};

export default FilePickerTree;
