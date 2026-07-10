import React, { useEffect, useMemo } from 'react';
import { FilePickerTree, type FilePickerTreeHandle } from '../FilePickerTree';
import type { AsyncWritableFilesystem } from '@wp-playground/storage';
import { normalizePath } from '@php-wasm/util';

export const DEFAULT_SELECTED_PATH = '/wordpress/workspace';

type DirNode = { type: 'dir'; children: Record<string, FsEntry> };
type FileNodeEntry = { type: 'file'; content: string };
type FsEntry = DirNode | FileNodeEntry;
type DeferredFilesystemOperation =
	| 'fileExists'
	| 'writeFile'
	| 'mkdir'
	| 'rmdir'
	| 'mv'
	| 'unlink';

declare global {
	interface Window {
		__filePickerHarness?: {
			filesystem: AsyncWritableFilesystem;
			requestIdentity: string;
			reload: () => void;
			switchFilesystem: () => void;
			setRequestIdentity: (identity: string) => void;
			setRoot: (root: string) => void;
			createFile: (path?: string) => Promise<void>;
			importExternalItems: (
				dataTransfer: DataTransfer,
				preferredPath?: string
			) => Promise<void>;
			deferNextFilesystemOperation: (
				operation: DeferredFilesystemOperation,
				path: string
			) => void;
			getDeferredFilesystemOperationState: () =>
				| 'idle'
				| 'waiting'
				| 'completed';
			releaseDeferredFilesystemOperation: () => void;
			lastSelectedPath: string | null;
			lastDoubleClickedPath: string | null;
			lastPreparedPathChange: string | null;
			lastPathMove: { from: string; to: string } | null;
			lastPathChangeCompletion: {
				path: string;
				outcome: 'moved' | 'deleted' | 'failed';
			} | null;
		};
	}
}

const baseFilesystem: DirNode = {
	type: 'dir',
	children: {
		wordpress: {
			type: 'dir',
			children: {
				workspace: {
					type: 'dir',
					children: {
						'back\\slash.php': {
							type: 'file',
							content: "<?php echo 'Backslash';",
						},
						'index.php': {
							type: 'file',
							content: "<?php echo 'Hello';",
						},
						'new-file.php': {
							type: 'file',
							content: "<?php echo 'Default';",
						},
						'notes.txt': {
							type: 'file',
							content: 'Workspace notes',
						},
						subdir: {
							type: 'dir',
							children: {
								'nested.php': {
									type: 'file',
									content: "<?php echo 'Nested';",
								},
							},
						},
						'selector "] edge': {
							type: 'dir',
							children: {
								'child.php': {
									type: 'file',
									content: "<?php echo 'Selector edge';",
								},
							},
						},
						'New Folder': {
							type: 'dir',
							children: {},
						},
					},
				},
				'wp-content': {
					type: 'dir',
					children: {
						plugins: {
							type: 'dir',
							children: {
								'akismet.php': {
									type: 'file',
									content: "<?php echo 'Plugin';",
								},
							},
						},
						themes: {
							type: 'dir',
							children: {
								twentytwentyone: {
									type: 'dir',
									children: {
										'style.css': {
											type: 'file',
											content:
												'body { background: #fff; }',
										},
									},
								},
							},
						},
					},
				},
				'readme.html': {
					type: 'file',
					content: '<h1>Readme</h1>',
				},
			},
		},
		'notes.txt': {
			type: 'file',
			content: 'Root notes',
		},
	},
};

const alternateFilesystem: DirNode = {
	type: 'dir',
	children: {
		wordpress: {
			type: 'dir',
			children: {
				workspace: {
					type: 'dir',
					children: {
						'alternate.php': {
							type: 'file',
							content: "<?php echo 'Alternate';",
						},
					},
				},
			},
		},
	},
};

const cloneStructure = <T,>(value: T): T => structuredClone(value);

class InMemoryFilesystem
	extends EventTarget
	implements AsyncWritableFilesystem
{
	private root: DirNode;
	private deferredOperation?: {
		operation: DeferredFilesystemOperation;
		path: string;
		state: 'idle' | 'waiting' | 'completed';
		wait: Promise<void>;
		release: () => void;
	};

	constructor(snapshot: DirNode) {
		super();
		this.root = snapshot;
	}

	/** Defers one matching filesystem operation until the harness releases it. */
	deferNextOperation(operation: DeferredFilesystemOperation, path: string) {
		let release = () => {};
		const wait = new Promise<void>((resolve) => {
			release = resolve;
		});
		this.deferredOperation = {
			operation,
			path: normalizePath(path),
			state: 'idle',
			wait,
			release,
		};
	}

	/** Reports whether the deferred filesystem operation has reached its gate. */
	getDeferredOperationState() {
		return this.deferredOperation?.state ?? 'idle';
	}

	/** Releases the filesystem operation installed by deferNextOperation. */
	releaseDeferredOperation() {
		this.deferredOperation?.release();
	}

	/** Waits at the installed gate when this operation and path match it. */
	private async waitForDeferredOperation(
		operation: DeferredFilesystemOperation,
		path: string
	) {
		const deferred = this.deferredOperation;
		if (
			!deferred ||
			deferred.state !== 'idle' ||
			deferred.operation !== operation ||
			deferred.path !== normalizePath(path)
		) {
			return;
		}
		deferred.state = 'waiting';
		await deferred.wait;
		deferred.state = 'completed';
	}

	private resolve(path: string): FsEntry | undefined {
		const normalized = normalizePath(path);
		if (normalized === '/') {
			return this.root;
		}
		const segments = normalized.split('/').filter(Boolean);
		let current: FsEntry = this.root;
		for (const segment of segments) {
			if (current.type !== 'dir') {
				return undefined;
			}
			const next = current.children[segment] as any;
			if (!next) {
				return undefined;
			}
			current = next;
		}
		return current;
	}

	private resolveDir(path: string): DirNode | undefined {
		const node = this.resolve(path);
		return node && node.type === 'dir' ? node : undefined;
	}

	private resolveParent(
		path: string
	): { parent: DirNode; name: string } | undefined {
		const normalized = normalizePath(path);
		if (normalized === '/') {
			return undefined;
		}
		const segments = normalized.split('/').filter(Boolean);
		const name = segments.pop();
		const parentPath = segments.length ? `/${segments.join('/')}` : '/';
		const parent = this.resolveDir(parentPath);
		if (!parent || !name) {
			return undefined;
		}
		return { parent, name };
	}

	async listFiles(path: string): Promise<string[]> {
		const dir = this.resolveDir(path);
		if (!dir) {
			return [];
		}
		return Object.keys(dir.children);
	}

	async isDir(path: string): Promise<boolean> {
		const normalized = normalizePath(path);
		if (normalized === '/') {
			return true;
		}
		const node = this.resolve(path);
		return !!node && node.type === 'dir';
	}

	async fileExists(path: string): Promise<boolean> {
		await this.waitForDeferredOperation('fileExists', path);
		const node = this.resolve(path);
		return !!node && node.type === 'file';
	}

	async read(path: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> }> {
		const text = await this.readFileAsText(path);
		const buffer = new TextEncoder().encode(text);
		return {
			arrayBuffer: async () => buffer.buffer,
		};
	}

	async readFileAsText(path: string): Promise<string> {
		const node = this.resolve(path);
		if (!node || node.type !== 'file') {
			throw new Error(`File not found: ${path}`);
		}
		return node.content;
	}

	async writeFile(path: string, data: Uint8Array | string): Promise<void> {
		await this.waitForDeferredOperation('writeFile', path);
		const parentInfo = this.resolveParent(path);
		if (!parentInfo) {
			throw new Error(`Parent missing for ${path}`);
		}
		const content =
			typeof data === 'string' ? data : new TextDecoder().decode(data);
		parentInfo.parent.children[parentInfo.name] = {
			type: 'file',
			content,
		};
	}

	async mkdir(path: string): Promise<void> {
		await this.waitForDeferredOperation('mkdir', path);
		const parentInfo = this.resolveParent(path);
		if (!parentInfo) {
			throw new Error(`Parent missing for ${path}`);
		}
		if (!parentInfo.parent.children[parentInfo.name]) {
			parentInfo.parent.children[parentInfo.name] = {
				type: 'dir',
				children: {},
			};
		}
	}

	async rmdir(
		path: string,
		options?: { recursive?: boolean }
	): Promise<void> {
		await this.waitForDeferredOperation('rmdir', path);
		const parentInfo = this.resolveParent(path);
		if (!parentInfo) {
			return;
		}
		const target = parentInfo.parent.children[parentInfo.name];
		if (!target || target.type !== 'dir') {
			return;
		}
		if (!options?.recursive && Object.keys(target.children).length > 0) {
			throw new Error('Directory not empty');
		}
		delete parentInfo.parent.children[parentInfo.name];
	}

	async mv(source: string, destination: string): Promise<void> {
		await this.waitForDeferredOperation('mv', source);
		const normalizedSource = normalizePath(source);
		const normalizedDestination = normalizePath(destination);
		if (normalizedSource === normalizedDestination) {
			return;
		}
		const sourceInfo = this.resolveParent(source);
		const entry = this.resolve(source);
		const targetInfo = this.resolveParent(destination);
		if (!sourceInfo || !targetInfo || !entry) {
			throw new Error('Unable to move path');
		}
		targetInfo.parent.children[targetInfo.name] = entry;
		delete sourceInfo.parent.children[sourceInfo.name];
	}

	async unlink(path: string): Promise<void> {
		await this.waitForDeferredOperation('unlink', path);
		const parentInfo = this.resolveParent(path);
		if (!parentInfo) {
			return;
		}
		const target = parentInfo.parent.children[parentInfo.name];
		if (target && target.type === 'file') {
			delete parentInfo.parent.children[parentInfo.name];
		}
	}
}

/** Creates an isolated in-memory filesystem from a fixture snapshot. */
export const createFilesystem = (snapshot: DirNode = baseFilesystem) =>
	new InMemoryFilesystem(cloneStructure(snapshot));

/**
 * Renders the file picker against a controllable in-memory filesystem.
 */
export function FilePickerTreeHarness() {
	const query = new URLSearchParams(window.location.search);
	const readOnly = query.has('readOnly');
	const withContextMenu = !query.has('withoutContextMenu');
	const useNestedInitialPath = query.has('nestedInitialPath');
	const treeRef = React.useRef<FilePickerTreeHandle | null>(null);
	const [root, setRoot] = React.useState(
		useNestedInitialPath ? '/wordpress' : '/'
	);
	const [filesystemVariant, setFilesystemVariant] = React.useState<
		'base' | 'alternate'
	>('base');
	const filesystem = useMemo(
		() =>
			createFilesystem(
				filesystemVariant === 'base'
					? baseFilesystem
					: alternateFilesystem
			),
		[filesystemVariant]
	);
	const [requestIdentity, setRequestIdentity] = React.useState('owner-a');
	const [lastSelectedPath, setLastSelectedPath] = React.useState<
		string | null
	>(null);
	const [lastDoubleClickedPath, setLastDoubleClickedPath] = React.useState<
		string | null
	>(null);
	const [lastPreparedPathChange, setLastPreparedPathChange] = React.useState<
		string | null
	>(null);
	const [lastPathMove, setLastPathMove] = React.useState<{
		from: string;
		to: string;
	} | null>(null);
	const [lastPathChangeCompletion, setLastPathChangeCompletion] =
		React.useState<{
			path: string;
			outcome: 'moved' | 'deleted' | 'failed';
		} | null>(null);

	useEffect(() => {
		window.__filePickerHarness = {
			filesystem,
			requestIdentity,
			reload: () => window.location.reload(),
			switchFilesystem: () => {
				setFilesystemVariant((variant) =>
					variant === 'base' ? 'alternate' : 'base'
				);
			},
			setRequestIdentity,
			setRoot,
			createFile: async (path?: string) => {
				await treeRef.current?.createFile(path);
			},
			importExternalItems: async (
				dataTransfer: DataTransfer,
				preferredPath?: string
			) => {
				await treeRef.current?.importExternalItems(
					dataTransfer,
					preferredPath
				);
			},
			deferNextFilesystemOperation: (operation, path) => {
				filesystem.deferNextOperation(operation, path);
			},
			getDeferredFilesystemOperationState: () =>
				filesystem.getDeferredOperationState(),
			releaseDeferredFilesystemOperation: () => {
				filesystem.releaseDeferredOperation();
			},
			lastSelectedPath,
			lastDoubleClickedPath,
			lastPreparedPathChange,
			lastPathMove,
			lastPathChangeCompletion,
		};
		return () => {
			delete window.__filePickerHarness;
		};
	}, [
		filesystem,
		requestIdentity,
		lastDoubleClickedPath,
		lastPreparedPathChange,
		lastPathChangeCompletion,
		lastPathMove,
		lastSelectedPath,
	]);

	return (
		<div
			style={{
				padding: '1rem',
				minHeight: '100vh',
				background: '#f5f5f5',
			}}
		>
			<div style={{ maxWidth: 320 }} data-testid="file-picker-tree">
				<FilePickerTree
					ref={treeRef}
					filesystem={filesystem}
					requestIdentity={requestIdentity}
					readOnly={readOnly}
					withContextMenu={withContextMenu}
					root={root}
					initialSelectedPath={
						useNestedInitialPath
							? '/wordpress/workspace/index.php'
							: DEFAULT_SELECTED_PATH
					}
					onSelect={(path) => {
						setLastSelectedPath(path);
					}}
					onDoubleClickFile={(path) => {
						setLastDoubleClickedPath(path);
					}}
					onBeforePathChange={(path) => {
						setLastPreparedPathChange(path);
					}}
					onPathMoved={(from, to) => {
						setLastPathMove({ from, to });
					}}
					onPathChangeComplete={(path, outcome) => {
						setLastPathChangeCompletion({ path, outcome });
					}}
				/>
			</div>
		</div>
	);
}
