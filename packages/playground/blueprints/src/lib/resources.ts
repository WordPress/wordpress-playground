import {
	cloneResponseMonitorProgress,
	ProgressTracker,
} from '@php-wasm/progress';
import { FileTree, UniversalPHP } from '@php-wasm/universal';
import { Semaphore } from '@php-wasm/util';
import { zipNameToHumanName } from './utils/zip-name-to-human-name';

export type { FileTree };
export const ResourceTypes = [
	'vfs',
	'literal',
	'wordpress.org/themes',
	'wordpress.org/plugins',
	'url',
	'git:directory',
] as const;

export type VFSReference = {
	/** Identifies the file resource as Virtual File System (VFS) */
	resource: 'vfs';
	/** The path to the file in the VFS */
	path: string;
};
export type LiteralReference = {
	/** Identifies the file resource as a literal file */
	resource: 'literal';
	/** The name of the file */
	name: string;
	/** The contents of the file */
	contents: string | Uint8Array;
};
export type CoreThemeReference = {
	/** Identifies the file resource as a WordPress Core theme */
	resource: 'wordpress.org/themes';
	/** The slug of the WordPress Core theme */
	slug: string;
};
export type CorePluginReference = {
	/** Identifies the file resource as a WordPress Core plugin */
	resource: 'wordpress.org/plugins';
	/** The slug of the WordPress Core plugin */
	slug: string;
};
export type UrlReference = {
	/** Identifies the file resource as a URL */
	resource: 'url';
	/** The URL of the file */
	url: string;
	/** Optional caption for displaying a progress message */
	caption?: string;
};
export type GitDirectoryReference = {
	/** Identifies the file resource as a git directory */
	resource: 'git:directory';
	/** The URL of the git repository */
	url: string;
	/** The branch of the git repository */
	ref: string;
	/** The path to the directory in the git repository */
	path: string;
};
export interface Directory {
	files: FileTree;
	name: string;
}
export type DirectoryLiteralReference = Directory & {
	/** Identifies the file resource as a git directory */
	resource: 'literal:directory';
};

export type FileReference =
	| VFSReference
	| LiteralReference
	| CoreThemeReference
	| CorePluginReference
	| UrlReference;

export type DirectoryReference =
	| GitDirectoryReference
	| DirectoryLiteralReference;

export function isResourceReference(ref: any): ref is FileReference {
	return (
		ref &&
		typeof ref === 'object' &&
		typeof ref.resource === 'string' &&
		ResourceTypes.includes(ref.resource)
	);
}

export abstract class Resource<T extends File | Directory> {
	/** Optional progress tracker to monitor progress */
	protected _progress?: ProgressTracker;
	get progress() {
		return this._progress;
	}
	set progress(value) {
		this._progress = value;
	}

	/** A Promise that resolves to the file contents */
	protected promise?: Promise<T>;
	protected playground?: UniversalPHP;

	setPlayground(playground: UniversalPHP) {
		this.playground = playground;
	}

	abstract resolve(): Promise<T>;

	/** The name of the referenced file */
	abstract get name(): string;

	/** Whether this Resource is loaded asynchronously */
	get isAsync(): boolean {
		return false;
	}

	/**
	 * Creates a new Resource based on the given file reference
	 *
	 * @param ref The file reference to create the Resource for
	 * @param options Additional options for the Resource
	 * @returns A new Resource instance
	 */
	static create(
		ref: FileReference | DirectoryReference,
		{
			semaphore,
			progress,
		}: {
			/** Optional semaphore to limit concurrent downloads */
			semaphore?: Semaphore;
			progress?: ProgressTracker;
		}
	): Resource<File | Directory> {
		let resource: Resource<File | Directory>;
		switch (ref.resource) {
			case 'vfs':
				resource = new VFSResource(ref, progress);
				break;
			case 'literal':
				resource = new LiteralResource(ref, progress);
				break;
			case 'wordpress.org/themes':
				resource = new CoreThemeResource(ref, progress);
				break;
			case 'wordpress.org/plugins':
				resource = new CorePluginResource(ref, progress);
				break;
			case 'url':
				resource = new UrlResource(ref, progress);
				break;
			case 'git:directory':
				resource = new GitDirectoryResource(ref, progress);
				break;
			case 'literal:directory':
				resource = new LiteralDirectoryResource(ref, progress);
				break;
			default:
				throw new Error(`Invalid resource: ${ref}`);
		}
		resource = new CachedResource(resource);

		if (semaphore) {
			resource = new SemaphoreResource(resource, semaphore);
		}

		return resource;
	}
}

export abstract class ResourceDecorator<
	T extends File | Directory
> extends Resource<T> {
	constructor(protected resource: Resource<T>) {
		super();
	}

	/** @inheritDoc */
	override get progress() {
		return this.resource.progress;
	}

	/** @inheritDoc */
	override set progress(value) {
		this.resource.progress = value;
	}

	/** @inheritDoc */
	abstract override resolve(): Promise<T>;

	/** @inheritDoc */
	get name(): string {
		return this.resource.name;
	}

	/** @inheritDoc */
	override get isAsync(): boolean {
		return this.resource.isAsync;
	}

	/** @inheritDoc */
	override setPlayground(playground: UniversalPHP): void {
		this.resource.setPlayground(playground);
	}
}

/**
 * A `Resource` that represents a file in the VFS (virtual file system) of the
 * playground.
 */
export class VFSResource extends Resource<File> {
	/**
	 * Creates a new instance of `VFSResource`.
	 * @param playground The playground client.
	 * @param resource The VFS reference.
	 * @param progress The progress tracker.
	 */
	constructor(
		private resource: VFSReference,
		public override _progress?: ProgressTracker
	) {
		super();
	}

	/** @inheritDoc */
	async resolve() {
		const buffer = await this.playground!.readFileAsBuffer(
			this.resource.path
		);
		this.progress?.set(100);
		return new File([buffer], this.name);
	}

	/** @inheritDoc */
	get name() {
		return this.resource.path.split('/').pop() || '';
	}
}

/**
 * A `Resource` that represents a literal file.
 */
export class LiteralResource extends Resource<File> {
	/**
	 * Creates a new instance of `LiteralResource`.
	 * @param resource The literal reference.
	 * @param progress The progress tracker.
	 */
	constructor(
		private resource: LiteralReference,
		public override _progress?: ProgressTracker
	) {
		super();
	}

	/** @inheritDoc */
	async resolve() {
		this.progress?.set(100);
		return new File([this.resource.contents], this.resource.name);
	}

	/** @inheritDoc */
	get name() {
		return this.resource.name;
	}
}

/**
 * A base class for `Resource`s that require fetching data from a remote URL.
 */
export abstract class FetchResource extends Resource<File> {
	/**
	 * Creates a new instance of `FetchResource`.
	 * @param progress The progress tracker.
	 */
	constructor(public override _progress?: ProgressTracker) {
		super();
	}

	/** @inheritDoc */
	async resolve() {
		this.progress?.setCaption(this.caption);
		const url = this.getURL();
		try {
			let response = await fetch(url);
			if (!response.ok) {
				throw new Error(`Could not download "${url}"`);
			}
			response = await cloneResponseMonitorProgress(
				response,
				this.progress?.loadingListener ?? noop
			);
			if (response.status !== 200) {
				throw new Error(`Could not download "${url}"`);
			}
			return new File([await response.blob()], this.name);
		} catch (e) {
			throw new Error(
				`Could not download "${url}".
				Check if the URL is correct and the server is reachable.
				If it is reachable, the server might be blocking the request.
				Check the browser console and network tabs for more information.

				## Does the console show the error "No 'Access-Control-Allow-Origin' header"?

				This means the server that hosts your file does not allow requests from other sites
				(cross-origin requests, or CORS).	You need to move the asset to a server that allows
				cross-origin file downloads. Learn more about CORS at
				https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS.

				If your file is on GitHub, load it from "raw.githubusercontent.com".
				Here's how to do that:

				1. Start with the original GitHub URL of the file. For example:
				https://github.com/username/repository/blob/branch/filename.
				2. Replace "github.com" with "raw.githubusercontent.com".
				3. Remove the "/blob/" part of the URL.

				The resulting URL should look like this:
				https://raw.githubusercontent.com/username/repository/branch/filename

				Error:
				${e}`
			);
		}
	}

	/**
	 * Gets the URL to fetch the data from.
	 * @returns The URL.
	 */
	protected abstract getURL(): string;

	/**
	 * Gets the caption for the progress tracker.
	 * @returns The caption.
	 */
	protected get caption() {
		return `Downloading ${this.name}`;
	}

	/** @inheritDoc */
	get name() {
		try {
			return new URL(this.getURL(), 'http://example.com').pathname
				.split('/')
				.pop()!;
		} catch (e) {
			return this.getURL();
		}
	}

	/** @inheritDoc */
	override get isAsync(): boolean {
		return true;
	}
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = (() => {}) as any;

/**
 * A `Resource` that represents a file available from a URL.
 */
export class UrlResource extends FetchResource {
	/**
	 * Creates a new instance of `UrlResource`.
	 * @param resource The URL reference.
	 * @param progress The progress tracker.
	 */
	constructor(private resource: UrlReference, progress?: ProgressTracker) {
		super(progress);
	}

	/** @inheritDoc */
	getURL() {
		return this.resource.url;
	}

	/** @inheritDoc */
	protected override get caption() {
		return this.resource.caption ?? super.caption;
	}
}

/**
 * A `Resource` that represents a git directory.
 */
export class GitDirectoryResource extends Resource<Directory> {
	constructor(
		private reference: GitDirectoryReference,
		public override _progress?: ProgressTracker
	) {
		super();
	}

	async resolve() {
		// @TODO: Use the actual sparse checkout logic here once
		//        https://github.com/WordPress/wordpress-playground/pull/1764 lands.
		throw new Error('Not implemented yet');
		return {
			name: 'hello-world',
			files: {
				'README.md': 'Hello, World!',
				'index.php': `<?php
/**
* Plugin Name: Hello World
* Description: A simple plugin that says hello world.
*/
			 	`,
			},
		};
	}

	/** @inheritDoc */
	get name() {
		return this.reference.path.split('/').pop()!;
	}
}

/**
 * A `Resource` that represents a git directory.
 */
export class LiteralDirectoryResource extends Resource<Directory> {
	constructor(
		private reference: DirectoryLiteralReference,
		public override _progress?: ProgressTracker
	) {
		super();
	}

	async resolve() {
		return this.reference;
	}

	/** @inheritDoc */
	get name() {
		return this.reference.name;
	}
}

/**
 * A `Resource` that represents a WordPress core theme.
 */
export class CoreThemeResource extends FetchResource {
	constructor(
		private resource: CoreThemeReference,
		progress?: ProgressTracker
	) {
		super(progress);
	}
	override get name() {
		return zipNameToHumanName(this.resource.slug);
	}
	getURL() {
		const zipName = toDirectoryZipName(this.resource.slug);
		return `https://downloads.wordpress.org/theme/${zipName}`;
	}
}

/**
 * A resource that fetches a WordPress plugin from wordpress.org.
 */
export class CorePluginResource extends FetchResource {
	constructor(
		private resource: CorePluginReference,
		progress?: ProgressTracker
	) {
		super(progress);
	}

	/** @inheritDoc */
	override get name() {
		return zipNameToHumanName(this.resource.slug);
	}

	/** @inheritDoc */
	getURL() {
		const zipName = toDirectoryZipName(this.resource.slug);
		return `https://downloads.wordpress.org/plugin/${zipName}`;
	}
}

/**
 * Transforms a plugin slug into a directory zip name.
 * If the input already ends with ".zip", returns it unchanged.
 * Otherwise, appends ".latest-stable.zip".
 */
export function toDirectoryZipName(rawInput: string) {
	if (!rawInput) {
		return rawInput;
	}
	if (rawInput.endsWith('.zip')) {
		return rawInput;
	}
	return rawInput + '.latest-stable.zip';
}

/**
 * A decorator for a resource that adds caching functionality.
 */
export class CachedResource<
	T extends File | Directory
> extends ResourceDecorator<T> {
	protected override promise?: Promise<T>;

	/** @inheritDoc */
	override async resolve() {
		if (!this.promise) {
			this.promise = this.resource.resolve();
		}
		return this.promise;
	}
}

/**
 * A decorator for a resource that adds concurrency control functionality
 * through a semaphore.
 */
export class SemaphoreResource<
	T extends File | Directory
> extends ResourceDecorator<T> {
	constructor(resource: Resource<T>, private readonly semaphore: Semaphore) {
		super(resource);
	}

	/** @inheritDoc */
	override async resolve() {
		if (!this.isAsync) {
			return this.resource.resolve();
		}
		return this.semaphore.run(() => this.resource.resolve());
	}
}
