import type { AsyncWritableFilesystem } from '@wp-playground/components';
import type { BlueprintBundle } from '@wp-playground/blueprints';
import { StreamedFile } from '@php-wasm/stream-compression';
import { ensureAbsolutePath } from './convert-blueprint-to-filesystem';

export class WritableInMemoryBundle
	implements AsyncWritableFilesystem, BlueprintBundle
{
	private root: DirNode = { type: 'dir', children: {} };
	private readonly onChange?: (bundle: WritableInMemoryBundle) => void;
	private encoder = new TextEncoder();
	private decoder = new TextDecoder();

	constructor(
		initialFiles: Record<string, Uint8Array | string>,
		onChange?: (bundle: WritableInMemoryBundle) => void
	) {
		this.onChange = onChange;
		for (const [path, content] of Object.entries(initialFiles)) {
			this.writeFileSync(path, content);
		}
	}

	// --- AsyncWritableFilesystem methods ---
	async isDir(path: string): Promise<boolean> {
		const node = this.getNode(path);
		return !!node && node.type === 'dir';
	}

	async fileExists(path: string): Promise<boolean> {
		const node = this.getNode(path);
		return !!node && node.type === 'file';
	}

	async readFileAsBuffer(path: string): Promise<Uint8Array> {
		const file = this.getFile(path);
		return file.content;
	}

	async readFileAsText(path: string): Promise<string> {
		return this.decoder.decode(await this.readFileAsBuffer(path));
	}

	async listFiles(path: string): Promise<string[]> {
		const dir = this.getDir(path);
		return Object.keys(dir.children);
	}

	async writeFile(path: string, data: Uint8Array | string): Promise<void> {
		this.writeFileSync(path, data);
		this.emitChange();
	}

	async mkdir(path: string): Promise<void> {
		const { parent, name } = this.getParent(path);
		if (!parent.children[name]) {
			parent.children[name] = { type: 'dir', children: {} };
			this.emitChange();
		}
	}

	async rmdir(
		path: string,
		options?: { recursive?: boolean }
	): Promise<void> {
		const { parent, name } = this.getParent(path);
		const target = parent.children[name];
		if (!target || target.type !== 'dir') {
			return;
		}
		if (!options?.recursive && Object.keys(target.children).length > 0) {
			throw new Error('Directory not empty');
		}
		delete parent.children[name];
		this.emitChange();
	}

	async mv(source: string, destination: string): Promise<void> {
		const normalizedSource = ensureAbsolutePath(source);
		const normalizedDestination = ensureAbsolutePath(destination);
		if (normalizedSource === normalizedDestination) {
			return;
		}

		const { parent: sourceParent, name: sourceName } =
			this.getParent(normalizedSource);
		const entry = sourceParent.children[sourceName];
		if (!entry) {
			throw new Error(`Source not found: ${normalizedSource}`);
		}

		const { parent: destParent, name: destName } = this.getParent(
			normalizedDestination
		);
		destParent.children[destName] = entry;
		delete sourceParent.children[sourceName];
		this.emitChange();
	}

	async unlink(path: string): Promise<void> {
		const { parent, name } = this.getParent(path);
		const target = parent.children[name];
		if (target && target.type === 'file') {
			delete parent.children[name];
			this.emitChange();
		}
	}

	// --- BlueprintBundle (Filesystem) method ---
	async read(path: string): Promise<StreamedFile> {
		const file = this.getFile(path);
		const stream = new ReadableStream({
			start(controller) {
				controller.enqueue(file.content);
				controller.close();
			},
		});
		return new StreamedFile(stream, path, {
			filesize: file.content.byteLength,
		});
	}

	// --- Internal helpers ---
	private emitChange() {
		this.onChange?.(this);
	}

	private writeFileSync(path: string, data: Uint8Array | string) {
		const { parent, name } = this.getParent(path);
		const content =
			typeof data === 'string' ? this.encoder.encode(data) : data;
		parent.children[name] = {
			type: 'file',
			content: new Uint8Array(content),
		};
	}

	private getNode(path: string): FsNode | undefined {
		const normalized = ensureAbsolutePath(path);
		if (normalized === '/') {
			return this.root;
		}
		const parts = normalized.split('/').filter(Boolean);
		let current: FsNode = this.root;
		for (const segment of parts) {
			if (current.type !== 'dir') {
				return undefined;
			}
			const next = current.children[segment] as
				| DirNode
				| FileNode
				| undefined;
			if (!next) {
				return undefined;
			}
			current = next;
		}
		return current;
	}

	private getDir(path: string): DirNode {
		const node = this.getNode(path);
		if (!node || node.type !== 'dir') {
			throw new Error(`Directory not found: ${path}`);
		}
		return node;
	}

	private getFile(path: string): FileNode {
		const node = this.getNode(path);
		if (!node || node.type !== 'file') {
			throw new Error(`File not found: ${path}`);
		}
		return node;
	}

	private getParent(path: string): { parent: DirNode; name: string } {
		const normalized = ensureAbsolutePath(path);
		const segments = normalized.split('/').filter(Boolean);
		const name = segments.pop();
		const parentPath = segments.length ? `/${segments.join('/')}` : '/';
		const parent = this.ensureDir(parentPath);
		if (!name) {
			throw new Error(`Invalid path: ${path}`);
		}
		return { parent, name };
	}

	private ensureDir(path: string): DirNode {
		const normalized = ensureAbsolutePath(path);
		if (normalized === '/') {
			return this.root;
		}
		const parts = normalized.split('/').filter(Boolean);
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
					`Path segment "${part}" is not a directory in ${normalized}`
				);
			}
			current = next;
		}
		return current;
	}
}

type FileNode = { type: 'file'; content: Uint8Array };
type DirNode = { type: 'dir'; children: Record<string, FsNode> };
type FsNode = FileNode | DirNode;
