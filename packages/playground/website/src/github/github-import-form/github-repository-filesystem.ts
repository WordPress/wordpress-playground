import { ensureAbsolutePath, joinPaths } from '@php-wasm/util';
import type {
	AsyncWritableFilesystem,
	GithubClient,
} from '@wp-playground/storage';
import { removePathPrefix } from '@wp-playground/storage';

type RepositoryEntryType = 'file' | 'directory';
type RepositoryContentEntry = { name?: string; type?: string };

/**
 * Exposes a GitHub repository as the read-only filesystem expected by the
 * shared file picker. Directories are fetched only when they are expanded.
 */
export class GitHubRepositoryFilesystem
	extends EventTarget
	implements AsyncWritableFilesystem
{
	private readonly getClient: () => GithubClient;
	private readonly owner: string;
	private readonly repo: string;
	private readonly ref: string;
	private readonly entries = new Map<string, RepositoryEntryType>([
		['/', 'directory'],
	]);
	private readonly directoryEntries = new Map<string, string[]>();

	constructor(
		getClient: () => GithubClient,
		owner: string,
		repo: string,
		ref: string
	) {
		super();
		this.getClient = getClient;
		this.owner = owner;
		this.repo = repo;
		this.ref = ref;
	}

	async isDir(path: string): Promise<boolean> {
		const absolutePath = ensureAbsolutePath(path);
		const cachedType = this.entries.get(absolutePath);
		if (cachedType) {
			return cachedType === 'directory';
		}

		const { data } = await this.getRepositoryContent(absolutePath);
		if (Array.isArray(data)) {
			this.cacheDirectory(absolutePath, data);
			return true;
		}
		this.entries.set(absolutePath, 'file');
		return false;
	}

	async fileExists(path: string): Promise<boolean> {
		const absolutePath = ensureAbsolutePath(path);
		if (this.entries.has(absolutePath)) {
			return true;
		}
		try {
			await this.isDir(absolutePath);
			return true;
		} catch (error) {
			if ((error as { status?: number })?.status === 404) {
				return false;
			}
			throw error;
		}
	}

	async read(
		_path: string
	): Promise<{ arrayBuffer(): Promise<ArrayBuffer> }> {
		throw this.readOnlyError();
	}

	async readFileAsText(_path: string): Promise<string> {
		throw this.readOnlyError();
	}

	async listFiles(path: string): Promise<string[]> {
		const absolutePath = ensureAbsolutePath(path);
		const cachedEntries = this.directoryEntries.get(absolutePath);
		if (cachedEntries) {
			return cachedEntries;
		}

		const { data } = await this.getRepositoryContent(absolutePath);
		if (!Array.isArray(data)) {
			throw new Error(`${absolutePath} is not a directory.`);
		}
		return this.cacheDirectory(absolutePath, data);
	}

	async writeFile(_path: string, _data: Uint8Array | string): Promise<void> {
		throw this.readOnlyError();
	}

	async mkdir(
		_path: string,
		_options?: { recursive?: boolean }
	): Promise<void> {
		throw this.readOnlyError();
	}

	async rmdir(
		_path: string,
		_options?: { recursive?: boolean }
	): Promise<void> {
		throw this.readOnlyError();
	}

	async mv(_source: string, _destination: string): Promise<void> {
		throw this.readOnlyError();
	}

	async unlink(_path: string): Promise<void> {
		throw this.readOnlyError();
	}

	private getRepositoryContent(path: string) {
		return this.getClient().rest.repos.getContent({
			owner: this.owner,
			repo: this.repo,
			ref: this.ref,
			path: removePathPrefix(path, '/'),
		});
	}

	private cacheDirectory(
		path: string,
		data: RepositoryContentEntry[]
	): string[] {
		const names: string[] = [];
		for (const entry of data) {
			if (!entry?.name) {
				continue;
			}
			names.push(entry.name);
			this.entries.set(
				joinPaths(path, entry.name),
				entry.type === 'dir' ? 'directory' : 'file'
			);
		}
		this.entries.set(path, 'directory');
		this.directoryEntries.set(path, names);
		return names;
	}

	private readOnlyError() {
		return new Error('GitHub repository filesystems are read-only.');
	}
}
