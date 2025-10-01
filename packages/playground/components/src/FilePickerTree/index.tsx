import React, {
	forwardRef,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from 'react';
import {
	__experimentalTreeGrid as TreeGrid,
	__experimentalTreeGridRow as TreeGridRow,
	__experimentalTreeGridCell as TreeGridCell,
	Button,
	Popover,
	NavigableMenu,
	MenuItem,
} from '@wordpress/components';
import { Icon, chevronDown, chevronRight } from '@wordpress/icons';
import '@wordpress/components/build-style/style.css';
import css from './style.module.css';
import classNames from 'classnames';
import { file, folder } from '../icons';
import { basename, dirname, joinPaths } from '@php-wasm/util';

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

export interface AsyncWritableFilesystem {
	isDir: (path: string) => Promise<boolean>;
	fileExists: (path: string) => Promise<boolean>;
	readFileAsBuffer: (path: string) => Promise<Uint8Array>;
	readFileAsText: (path: string) => Promise<string>;
	listFiles: (path: string) => Promise<string[]>;
	writeFile: (path: string, data: Uint8Array | string) => Promise<void>;
	mkdir: (path: string) => Promise<void>;
	rmdir: (path: string, options?: { recursive?: boolean }) => Promise<void>;
	mv: (source: string, destination: string) => Promise<void>;
	unlink: (path: string) => Promise<void>;
}

export type FileNode = {
	name: string;
	type: 'file' | 'folder';
	children?: FileNode[];
};

export type FilePickerTreeProps = {
	filesystem: AsyncWritableFilesystem;
	root?: string; // default '/wordpress'
	initialSelectedPath?: string;
	onSelect?: (path: string | null) => void;
};

export type FilePickerTreeHandle = {
	focusPath: (
		path: string,
		options?: { select?: boolean; domFocus?: boolean; notify?: boolean }
	) => void;
	selectPath: (path: string) => void;
	getSelectedPath: () => string | null;
	expandToPath: (path: string) => Promise<void>;
	refresh: (path: string) => Promise<FileNode[] | undefined>;
	remapPath: (from: string, to: string) => void;
	// Filesystem helpers
	createFile: (absSelectedPath?: string) => Promise<void>;
	createFolder: (absSelectedPath?: string) => Promise<void>;
};

function buildPathChain(path: string): string[] {
	if (!path) return [];
	const normalized =
		path
			.replaceAll(/\\+/g, '/')
			.replace(/\/{2,}/g, '/')
			.replace(/\/$/, '') || path;
	const hasLeadingSlash = normalized.startsWith('/');
	const parts = normalized.split('/').filter(Boolean);
	const chain: string[] = [];
	let current = hasLeadingSlash ? '/' : '';
	if (hasLeadingSlash) chain.push('/');
	for (const part of parts) {
		if (!current || current === '/') {
			current = current === '/' ? `/${part}` : part;
		} else {
			current = `${current}/${part}`;
		}
		chain.push(current);
	}
	return chain;
}

function isDescendantPath(ancestor: string, candidate: string) {
	if (!ancestor || !candidate) return false;
	if (ancestor === candidate) return false;
	const normalizedAncestor =
		ancestor === '/' ? '/' : ancestor.replace(/\/{2,}/g, '/');
	const normalizedCandidate = candidate.replace(/\/{2,}/g, '/');
	if (normalizedAncestor === '/') {
		return (
			normalizedCandidate.startsWith('/') && normalizedCandidate !== '/'
		);
	}
	return normalizedCandidate.startsWith(`${normalizedAncestor}/`);
}

function remapSinglePath(value: string | null, from: string, to: string) {
	if (!value) return value;
	if (value === from) return to;
	if (value.startsWith(from === '/' ? '/' : `${from}/`)) {
		return to + value.slice(from.length);
	}
	return value;
}

export const FilePickerTree = forwardRef<
	FilePickerTreeHandle,
	FilePickerTreeProps
>(function FilePickerTree(
	{
		filesystem,
		root = '/wordpress',
		initialSelectedPath,
		onSelect = () => {},
	},
	ref
) {
	const normalizedRoot = useMemo(() => {
		let p = (root || '/').replace(/\\+/g, '/');
		if (!p.startsWith('/')) p = `/${p}`;
		p = p.replace(/\/{2,}/g, '/');
		if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
		return p || '/';
	}, [root]);

	const isValidNameSegment = (name: string) => {
		if (!name) return false;
		if (name === '.' || name === '..') return false;
		return !/[\\/]/.test(name);
	};

	const [expanded, setExpanded] = useState<ExpandedNodePaths>(() => {
		if (!initialSelectedPath) {
			return {};
		}
		const initialExpanded: ExpandedNodePaths = {};
		for (const path of buildPathChain(initialSelectedPath)) {
			initialExpanded[path] = true;
		}
		return initialExpanded;
	});
	const [selectedPath, setSelectedPath] = useState<string | null>(
		() => initialSelectedPath ?? null
	);
	const [focusedPath, setFocusedPath] = useState<string | null>(
		() => initialSelectedPath ?? null
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
		const focusTarget = containerRef.current?.querySelector(
			`[data-path="${path}"]`
		) as HTMLElement | null;
		if (focusTarget && typeof focusTarget.focus === 'function') {
			focusTarget.focus();
		}
	};

	const generatePath = (node: FileNode, parentPath = ''): string => {
		const raw = parentPath ? `${parentPath}/${node.name}` : node.name;
		return raw.replaceAll(/\\+/g, '/').replace(/\/{2,}/g, '/');
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
			if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
			return a.name.localeCompare(b.name);
		});
		return results as FileNode[];
	};

	const loadChildren = async (path: string): Promise<FileNode[]> => {
		return await listDir(filesystem as AsyncWritableFilesystem, path);
	};

	const loadChildrenForPath = (path: string, node: FileNode) => {
		if (node.type !== 'folder') {
			return node.children;
		}
		const existingChildren = node.children ?? lazyChildrenRef.current[path];
		if (existingChildren || loadingPathsRef.current[path]) {
			return existingChildren;
		}
		setLoadingPaths((prev) => ({ ...prev, [path]: true }));
		return new Promise<FileNode[]>((resolve) => {
			loadChildren(path)
				.then((children) => {
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

	const refreshChildren = (path: string) => {
		setLoadingPaths((prev) => ({ ...prev, [path]: true }));
		return new Promise<FileNode[]>((resolve) => {
			loadChildren(path)
				.then((children) => {
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
					setLoadingPaths((prev) => {
						const next = { ...prev };
						delete next[path];
						return next;
					});
				});
		});
	};

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
		if (!targetPath) return;
		const chain = buildPathChain(targetPath);
		if (chain.length === 0) return;
		setExpanded((prev) => {
			const next = { ...prev } as ExpandedNodePaths;
			for (const segment of chain) {
				next[segment] = true;
			}
			return next;
		});
		// always available in filesystem mode

		let currentChildren: FileNode[] | undefined = [
			{ name: normalizedRoot, type: 'folder' },
		];
		let parentPath = '';
		for (const segmentPath of chain) {
			const nextNode = currentChildren?.find((child) => {
				const childPath = generatePath(child, parentPath);
				return childPath === segmentPath;
			});
			if (!nextNode || nextNode.type !== 'folder') {
				parentPath = segmentPath;
				currentChildren = [];
				continue;
			}
			const loaded = await loadChildrenForPath(segmentPath, nextNode);
			currentChildren = loaded ?? lazyChildrenRef.current[segmentPath];
			parentPath = segmentPath;
		}
	};

	const remapPathState = (from: string, to: string) => {
		if (!from || !to || from === to) {
			return;
		}
		const fromPrefix = from === '/' ? '/' : `${from}/`;
		const remapKey = (key: string): string | null => {
			if (key === from) return to;
			if (key.startsWith(fromPrefix)) {
				return to + key.slice(from.length);
			}
			return null;
		};

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
	};

	const resetDragState = () => {
		setDraggedPath(null);
		setDropIndicator(null);
		clearAllDragExpandTimeouts();
	};

	const selectPath = (path: string, notify = true) => {
		setSelectedPath(path);
		if (notify) {
			onSelect(path);
		}
	};

	// Filesystem-specific state and actions (declare before exposing handle)
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
				if (!path) return;
				const {
					select = true,
					domFocus = true,
					notify = false,
				} = options;
				if (select) {
					selectPath(path, notify);
				}
				setFocusedPath(path);
				if (domFocus) {
					focusDomNode(path);
				}
			},
			selectPath: (path: string) => {
				if (!path) return;
				selectPath(path);
				setFocusedPath(path);
				focusDomNode(path);
			},
			getSelectedPath: () => selectedPath,
			expandToPath: async (path: string) => await expandToPath(path),
			refresh: async (path: string) => await refreshChildren(path),
			remapPath: remapPathState,
			createFile: async (absSelectedPath?: string) => {
				await createNode(absSelectedPath, 'file', 'untitled.php');
			},
			createFolder: async (absSelectedPath?: string) => {
				await createNode(absSelectedPath, 'folder', 'New Folder');
			},
		}),
		[selectedPath, refreshChildren, remapPathState, expandToPath]
	);

	const hasInitializedRef = useRef(false);
	const pendingInitialExpandRef = useRef<string | null>(
		initialSelectedPath ?? null
	);
	const previousInitialPathRef = useRef(initialSelectedPath);

	useEffect(() => {
		rootAutoExpandedRef.current = false;
	}, [normalizedRoot]);

	useEffect(() => {
		if (
			initialSelectedPath &&
			initialSelectedPath !== previousInitialPathRef.current
		) {
			pendingInitialExpandRef.current = initialSelectedPath;
		} else if (!initialSelectedPath) {
			pendingInitialExpandRef.current = null;
		}
		previousInitialPathRef.current = initialSelectedPath;
	}, [initialSelectedPath]);
	useEffect(() => {
		if (!initialSelectedPath || hasInitializedRef.current) {
			return;
		}
		hasInitializedRef.current = true;
		const chain = buildPathChain(initialSelectedPath);
		setExpanded((prev) => {
			const next = { ...prev } as ExpandedNodePaths;
			for (const path of chain) {
				next[path] = true;
			}
			return next;
		});
		const target = chain[chain.length - 1] || initialSelectedPath;
		setFocusedPath(target);
		setSelectedPath(target);
		void expandToPath(initialSelectedPath);
	}, [initialSelectedPath, expandToPath]);

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
		if (false) {
			return;
		}
		focusDomNode(focusedPath);
	}, [
		treeFiles,
		focusedPath,
		generatePath,
		effectiveRenamingPath,
		focusDomNode,
	]);

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

	useEffect(() => {
		return () => {
			if (searchBufferTimeoutRef.current) {
				clearTimeout(searchBufferTimeoutRef.current);
			}
			clearAllDragExpandTimeouts();
		};
	}, []);

	const [searchBuffer, setSearchBuffer] = useState('');

	// remove duplicate handle; unified handle is defined above

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
			if (destinationDir === sourcePath) {
				return { allowed: false, state: 'invalid', destination: null };
			}
			if (isDescendantPath(sourcePath, destinationDir)) {
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
				await importExternalItems(event, evaluation.destination);
			}
		} finally {
			resetDragState();
		}
	};

	const handleInternalContextMenu = (
		event: React.MouseEvent,
		node: FileNode,
		path: string
	) => {
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

	const createNode = async (
		absSelectedPath: string | undefined,
		type: 'file' | 'folder',
		initialName: string
	) => {
		if (!filesystem) return;
		let base = absSelectedPath || selectedPath || normalizedRoot;
		// Ensure base is directory
		try {
			if (!(await filesystem.isDir(base))) {
				base = dirname(base);
			}
		} catch {
			base = dirname(base);
		}
		const normalizedBase = base;
		const name = await findAvailableName(normalizedBase, initialName);
		const tempPath = joinPaths(normalizedBase, name);
		if (type === 'folder') {
			await filesystem.mkdir(tempPath);
		} else {
			await filesystem.writeFile(tempPath, '');
		}
		pendingCreateRef.current = { type, tempPath };
		setRenamingAbsolutePath(tempPath);
		await refreshChildren(normalizedBase);
		// Focus new node
		setTimeout(() => {
			setFocusedPath(tempPath);
			focusDomNode(tempPath);
		}, 0);
	};

	const pathExists = async (path: string) => {
		if (!filesystem) return false;
		try {
			if (await filesystem.fileExists(path)) {
				return true;
			}
		} catch {
			// ignore
		}
		try {
			if (await filesystem.isDir(path)) {
				return true;
			}
		} catch {
			// ignore
		}
		return false;
	};

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

	const moveNode = async (sourcePath: string, destinationDir: string) => {
		if (!filesystem) return;
		const fileName = basename(sourcePath);
		const destinationPath = joinPaths(destinationDir, fileName);
		if (destinationPath === sourcePath) {
			return;
		}
		if (await pathExists(destinationPath)) {
			return;
		}
		const sourceParent = dirname(sourcePath);
		try {
			await filesystem.mv(sourcePath, destinationPath);
			remapPathState(sourcePath, destinationPath);
			const mappedSelected = remapSinglePath(
				selectedPath,
				sourcePath,
				destinationPath
			);
			if (
				selectedPath &&
				(selectedPath === sourcePath ||
					selectedPath.startsWith(`${sourcePath}/`))
			) {
				onSelect(mappedSelected);
			}
			setFocusedPath((prev) =>
				remapSinglePath(prev, sourcePath, destinationPath)
			);
			setExpanded((prev) => ({
				...prev,
				[destinationDir]: true,
			}));
			await Promise.all([
				refreshChildren(sourceParent),
				refreshChildren(destinationDir),
			]);
			setSelectedPath((prev) =>
				remapSinglePath(prev, sourcePath, destinationPath)
			);
			focusDomNode(destinationPath);
		} catch {
			// ignore move errors
		}
	};

	const getEntryFromItem = (item: DataTransferItem) => {
		const maybeItem = item as DataTransferItem & {
			webkitGetAsEntry?: () => FileSystemEntryLike | null;
		};
		if (maybeItem.webkitGetAsEntry) {
			return maybeItem.webkitGetAsEntry() as FileSystemEntryLike | null;
		}
		return null;
	};

	const fileFromEntry = (entry: FileSystemFileEntryLike) => {
		return new Promise<File>((resolve, reject) => {
			entry.file(resolve, reject);
		});
	};

	const importFileBlob = async (file: File, destinationDir: string) => {
		if (!filesystem) return;
		const safeName = file.name || 'untitled';
		const targetName = await findAvailableName(destinationDir, safeName);
		const targetPath = joinPaths(destinationDir, targetName);
		const buffer = new Uint8Array(await file.arrayBuffer());
		await filesystem.writeFile(targetPath, buffer);
	};

	const importFileEntry = async (
		entry: FileSystemFileEntryLike,
		destinationDir: string
	) => {
		const file = await fileFromEntry(entry);
		await importFileBlob(file, destinationDir);
	};

	const importDirectoryEntry = async (
		entry: FileSystemDirectoryEntryLike,
		destinationDir: string
	) => {
		const folderName = await findAvailableName(
			destinationDir,
			entry.name || 'New Folder'
		);
		const folderPath = joinPaths(destinationDir, folderName);
		await ensureDirectory(folderPath);
		const reader = entry.createReader();
		const readEntries = () =>
			new Promise<FileSystemEntryLike[]>((resolve, reject) => {
				reader.readEntries(
					(entries) => resolve(Array.from(entries)),
					reject
				);
			});
		while (true) {
			const batch = await readEntries();
			if (!batch.length) {
				break;
			}
			for (const child of batch) {
				if (child.isFile) {
					await importFileEntry(
						child as FileSystemFileEntryLike,
						folderPath
					);
				} else if (child.isDirectory) {
					await importDirectoryEntry(
						child as FileSystemDirectoryEntryLike,
						folderPath
					);
				}
			}
		}
	};

	const importExternalItems = async (
		event: React.DragEvent,
		destinationDir: string
	) => {
		if (!filesystem) return;
		const items = event.dataTransfer?.items
			? Array.from(event.dataTransfer.items)
			: [];
		const entries = items
			.filter((item) => item.kind === 'file')
			.map((item) => getEntryFromItem(item))
			.filter((entry): entry is FileSystemEntryLike => Boolean(entry));
		if (entries.length > 0) {
			for (const entry of entries) {
				if (entry.isFile) {
					await importFileEntry(
						entry as FileSystemFileEntryLike,
						destinationDir
					);
				} else if (entry.isDirectory) {
					await importDirectoryEntry(
						entry as FileSystemDirectoryEntryLike,
						destinationDir
					);
				}
			}
		} else {
			const files = event.dataTransfer?.files
				? Array.from(event.dataTransfer.files)
				: [];
			for (const file of files) {
				await importFileBlob(file, destinationDir);
			}
		}
		await refreshChildren(destinationDir);
		setExpanded((prev) => ({
			...prev,
			[destinationDir]: true,
		}));
	};

	const handleDeletePath = async (
		absSelectedPath: string,
		type: 'file' | 'folder'
	) => {
		if (!filesystem) return;
		const normalized = absSelectedPath;
		setContextMenu(null);
		try {
			if (type === 'folder') {
				await filesystem.rmdir(normalized, { recursive: true } as any);
			} else {
				await filesystem.unlink(normalized);
			}
		} catch {
			// ignore
		} finally {
			setRenamingAbsolutePath(null);
			const parentDir = dirname(normalized);
			await refreshChildren(parentDir);
			// If current selection was removed, notify parent
			if (
				selectedPath &&
				(selectedPath === normalized ||
					selectedPath.startsWith(`${normalized}/`))
			) {
				onSelect(null);
			}
		}
	};

	const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
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

	// No explicit error UI; upstream can handle errors in filesystem

	// Filesystem-mode rename handlers
	const handleRename = async (path: string, newName: string) => {
		const pending = pendingCreateRef.current;
		const isPending = pending?.tempPath === path;
		const parent = dirname(path);
		const sanitized = (newName || '').trim();
		if (!isValidNameSegment(sanitized)) {
			if (isPending) {
				try {
					if (pending.type === 'folder') {
						await filesystem.rmdir(path, {
							recursive: true,
						} as any);
					} else {
						await filesystem.unlink(path);
					}
				} catch {
					/* noop */
				}
				pendingCreateRef.current = null;
			}
			setRenamingAbsolutePath(isPending ? null : path);
			return;
		}
		let candidate = joinPaths(parent, sanitized);
		let candidateNormalized = candidate;
		if (candidateNormalized === path) {
			setRenamingAbsolutePath(null);
			if (isPending) pendingCreateRef.current = null;
			setTimeout(() => {
				setFocusedPath(candidateNormalized);
				focusDomNode(candidateNormalized);
			}, 0);
			return;
		}
		const exists = await filesystem.fileExists(candidateNormalized);
		const existsDir = await filesystem.isDir(candidateNormalized);
		if ((exists || existsDir) && candidateNormalized !== path) {
			if (isPending) {
				try {
					const unique = await findAvailableName(
						parent === '/' ? '/' : parent,
						sanitized
					);
					candidate = joinPaths(parent, unique);
					candidateNormalized = candidate;
				} catch {
					/* noop */
				}
			} else {
				setRenamingAbsolutePath(path);
				return;
			}
		}
		let candidateIsDir = pending?.type === 'folder';
		try {
			await filesystem.mv(path, candidate);
			if (!pending) {
				const isDir = await filesystem.isDir(candidate);
				candidateIsDir = isDir;
			}
			if (candidateIsDir) {
				remapPathState(path, candidateNormalized);
			}
			if (selectedPath === path) {
				onSelect(candidateNormalized);
			}
			await refreshChildren(parent);
			setFocusedPath(candidateNormalized);
			focusDomNode(candidateNormalized);
		} catch {
			if (isPending) {
				try {
					if (pending?.type === 'folder') {
						await filesystem.rmdir(path, {
							recursive: true,
						} as any);
					} else {
						await filesystem.unlink(path);
					}
				} catch {
					/* noop */
				}
			}
		} finally {
			pendingCreateRef.current = null;
			setRenamingAbsolutePath(null);
		}
	};

	const handleRenameCancelInternal = async (path: string) => {
		const pending = pendingCreateRef.current;
		if (!filesystem || pending?.tempPath !== path) {
			setRenamingAbsolutePath((prev) => (prev === path ? null : prev));
			return;
		}
		try {
			if (pending.type === 'folder') {
				await filesystem.rmdir(path, { recursive: true } as any);
			} else {
				await filesystem.unlink(path);
			}
		} catch {
			/* noop */
		}
		pendingCreateRef.current = null;
		setRenamingAbsolutePath(null);
		const parentDir = dirname(path);
		await refreshChildren(parentDir);
		setFocusedPath(parentDir);
		focusDomNode(parentDir);
	};

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
						onContextMenu={handleInternalContextMenu}
						renamingPath={effectiveRenamingPath}
						onRename={handleRename}
						onRenameCancel={handleRenameCancelInternal}
						dropIndicator={dropIndicator}
						onDragStart={handleNodeDragStart}
						onDragEnd={handleNodeDragEnd}
						onDragEnter={handleNodeDragEnter}
						onDragOver={handleNodeDragOver}
						onDragLeave={handleNodeDragLeave}
						onDrop={handleNodeDrop}
						rootPath={normalizedRoot}
					/>
				))}
			</TreeGrid>
			{contextMenu && (
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
						{contextMenu.type === 'folder' && (
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
						{contextMenu.type === 'folder' && (
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
						<MenuItem
							role="menuitem"
							onClick={() => {
								setContextMenu(null);
								setRenamingAbsolutePath(contextMenu.absPath);
							}}
						>
							Rename
						</MenuItem>
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
					</NavigableMenu>
				</Popover>
			)}
		</div>
	);
});

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
	onDragStart,
	onDragEnd,
	onDragEnter,
	onDragOver,
	onDragLeave,
	onDrop,
	rootPath,
}) => {
	const path = generatePath(node, parentPath);
	const isExpanded = expandedNodePaths[path];
	const isRenaming = renamingPath === path;
	const renameInputRef = useRef<HTMLInputElement>(null);
	const [renameValue, setRenameValue] = useState(node.name);
	const renameHandledRef = useRef(false);
	const isDropTarget = dropIndicator?.path === path;
	const isDropTargetValid = isDropTarget && dropIndicator?.state === 'valid';
	const isDropTargetInvalid =
		isDropTarget && dropIndicator?.state === 'invalid';
	const isDraggable = !isRenaming && path !== rootPath;

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
			setRenameValue(node.name);
			renameHandledRef.current = false;
			if (typeof window !== 'undefined' && window.requestAnimationFrame) {
				window.requestAnimationFrame(() => {
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
				(
					document.querySelector(
						`[data-path="${parentPath}"]`
					) as HTMLButtonElement
				)?.focus();
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
					(
						document.querySelector(
							`[data-path="${firstChildPath}"]`
						) as HTMLButtonElement
					)?.focus();
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
			selectPath(path);
			focusPath(path);
			const form = (event.currentTarget as HTMLElement)?.closest('form');
			if (form) {
				setTimeout(() => {
					form.dispatchEvent(new Event('submit', { bubbles: true }));
				});
			}
		}
	};

	const handleContextMenu = (event: React.MouseEvent) => {
		onContextMenu?.(event, node, path);
	};

	const handleRenameSubmit = (event: React.FormEvent) => {
		event.preventDefault();
		renameHandledRef.current = true;
		onRename?.(path, renameValue.trim());
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
										ref={renameInputRef}
										className={css['renameInput']}
										value={renameValue}
										onChange={(event) =>
											setRenameValue(event.target.value)
										}
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
									onClick={() => {
										if (node.type === 'folder') {
											toggleOpen();
										}
										selectPath(path);
										focusPath(path);
									}}
									onKeyDown={handleKeyDown}
									onFocus={() => {
										focusPath(path);
									}}
									onContextMenu={handleContextMenu}
									className={classNames(
										css['fileNodeButton'],
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
						onDragStart={onDragStart}
						onDragEnd={onDragEnd}
						onDragEnter={onDragEnter}
						onDragOver={onDragOver}
						onDragLeave={onDragLeave}
						onDrop={onDrop}
						rootPath={rootPath}
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
