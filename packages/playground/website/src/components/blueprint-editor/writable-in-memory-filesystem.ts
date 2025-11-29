import type { WritableFilesystemBackend } from './writable-filesystem';

export type FileNode = { type: 'file'; content: Uint8Array };
export type DirNode = { type: 'dir'; children: Record<string, FsNode> };
export type FsNode = FileNode | DirNode;

/**
 * In-memory filesystem backend that stores files in a tree structure.
 */
export class InMemoryFilesystemBackend implements WritableFilesystemBackend {
	private root: DirNode = { type: 'dir', children: {} };

	constructor(initialFiles: Record<string, Uint8Array> = {}) {
		for (const [path, content] of Object.entries(initialFiles)) {
			this.writeFileSync(path, content);
		}
	}

	async isDir(absolutePath: string): Promise<boolean> {
		const node = this.getNode(absolutePath);
		return !!node && node.type === 'dir';
	}

	async fileExists(absolutePath: string): Promise<boolean> {
		const node = this.getNode(absolutePath);
		return !!node && node.type === 'file';
	}

	async readFileAsBuffer(absolutePath: string): Promise<Uint8Array> {
		const file = this.getFile(absolutePath);
		return file.content;
	}

	async listFiles(absolutePath: string): Promise<string[]> {
		const dir = this.getDir(absolutePath);
		return Object.keys(dir.children);
	}

	async writeFile(absolutePath: string, data: Uint8Array): Promise<void> {
		this.writeFileSync(absolutePath, data);
	}

	async mkdir(absolutePath: string): Promise<void> {
		const { parent, name } = this.getParent(absolutePath);
		if (!parent.children[name]) {
			parent.children[name] = { type: 'dir', children: {} };
		}
	}

	async rmdir(absolutePath: string, recursive: boolean): Promise<void> {
		const { parent, name } = this.getParent(absolutePath);
		const target = parent.children[name];
		if (!target || target.type !== 'dir') {
			return;
		}
		if (!recursive && Object.keys(target.children).length > 0) {
			throw new Error('Directory not empty');
		}
		delete parent.children[name];
	}

	async mv(
		absoluteSource: string,
		absoluteDestination: string
	): Promise<void> {
		const { parent: sourceParent, name: sourceName } =
			this.getParent(absoluteSource);
		const entry = sourceParent.children[sourceName];
		if (!entry) {
			throw new Error(`Source not found: ${absoluteSource}`);
		}

		const { parent: destParent, name: destName } =
			this.getParent(absoluteDestination);
		destParent.children[destName] = entry;
		delete sourceParent.children[sourceName];
	}

	async unlink(absolutePath: string): Promise<void> {
		const { parent, name } = this.getParent(absolutePath);
		const target = parent.children[name];
		if (target && target.type === 'file') {
			delete parent.children[name];
		}
	}

	async clear(): Promise<void> {
		this.root = { type: 'dir', children: {} };
	}

	// --- Internal helpers ---
	private writeFileSync(absolutePath: string, data: Uint8Array): void {
		const { parent, name } = this.getParent(absolutePath);
		parent.children[name] = {
			type: 'file',
			content: new Uint8Array(data),
		};
	}

	private getNode(absolutePath: string): FsNode | undefined {
		if (absolutePath === '/') {
			return this.root;
		}
		const parts = absolutePath.split('/').filter(Boolean);
		let current: FsNode = this.root;
		for (const segment of parts) {
			if (current.type !== 'dir') {
				return undefined;
			}
			const next = current.children[segment] as FsNode | undefined;
			if (!next) {
				return undefined;
			}
			current = next;
		}
		return current;
	}

	private getDir(absolutePath: string): DirNode {
		const node = this.getNode(absolutePath);
		if (!node || node.type !== 'dir') {
			throw new Error(`Directory not found: ${absolutePath}`);
		}
		return node;
	}

	private getFile(absolutePath: string): FileNode {
		const node = this.getNode(absolutePath);
		if (!node || node.type !== 'file') {
			throw new Error(`File not found: ${absolutePath}`);
		}
		return node;
	}

	private getParent(absolutePath: string): { parent: DirNode; name: string } {
		const segments = absolutePath.split('/').filter(Boolean);
		const name = segments.pop();
		const parentPath = segments.length ? `/${segments.join('/')}` : '/';
		const parent = this.ensureDir(parentPath);
		if (!name) {
			throw new Error(`Invalid path: ${absolutePath}`);
		}
		return { parent, name };
	}

	private ensureDir(absolutePath: string): DirNode {
		if (absolutePath === '/') {
			return this.root;
		}
		const parts = absolutePath.split('/').filter(Boolean);
		let current: DirNode = this.root;
		for (const part of parts) {
			const next = current.children[part];
			if (!next) {
				const dir: DirNode = { type: 'dir', children: {} };
				current.children[part] = dir;
				current = dir;
				continue;
			}
			if (next.type !== 'dir') {
				throw new Error(
					`Path segment "${part}" is not a directory in ${absolutePath}`
				);
			}
			current = next;
		}
		return current;
	}
}
