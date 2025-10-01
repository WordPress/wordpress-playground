import React, { useEffect, useMemo } from 'react';
import { FilePickerTree } from '../FilePickerTree';
import type { AsyncWritableFilesystem } from '../FilePickerTree';
import { normalizePath } from '@php-wasm/util';

const DEFAULT_SELECTED_PATH = '/wordpress/workspace';

type DirNode = { type: 'dir'; children: Record<string, FsEntry> };
type FileNodeEntry = { type: 'file'; content: string };
type FsEntry = DirNode | FileNodeEntry;

declare global {
	interface Window {
		__filePickerHarness?: {
			filesystem: AsyncWritableFilesystem;
			reload: () => void;
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

const cloneStructure = <T,>(value: T): T => structuredClone(value);

class InMemoryFilesystem implements AsyncWritableFilesystem {
	private root: DirNode;

	constructor(snapshot: DirNode) {
		this.root = snapshot;
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
		const node = this.resolve(path);
		return !!node && node.type === 'file';
	}

	async readFileAsBuffer(path: string): Promise<Uint8Array> {
		const text = await this.readFileAsText(path);
		return new TextEncoder().encode(text);
	}

	async readFileAsText(path: string): Promise<string> {
		const node = this.resolve(path);
		if (!node || node.type !== 'file') {
			throw new Error(`File not found: ${path}`);
		}
		return node.content;
	}

	async writeFile(path: string, data: Uint8Array | string): Promise<void> {
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

const createFilesystem = () =>
	new InMemoryFilesystem(cloneStructure(baseFilesystem));

export function FilePickerTreeHarness() {
	const filesystem = useMemo(() => createFilesystem(), []);

	useEffect(() => {
		window.__filePickerHarness = {
			filesystem,
			reload: () => window.location.reload(),
		};
		return () => {
			delete window.__filePickerHarness;
		};
	}, [filesystem]);

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
					filesystem={filesystem}
					root="/"
					initialSelectedPath={DEFAULT_SELECTED_PATH}
				/>
			</div>
		</div>
	);
}
