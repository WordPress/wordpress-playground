import {
	cloneResponseMonitorProgress,
	ProgressTracker,
} from '@php-wasm/progress';
import { UniversalPHP } from '@php-wasm/universal';
import { Semaphore } from '@php-wasm/util';
import { zipNameToHumanName } from './utils/zip-name-to-human-name';

export const ResourceTypes = [
	'vfs',
	'literal',
	'wordpress.org/themes',
	'wordpress.org/plugins',
	'url',
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

export type FileReference =
	| VFSReference
	| LiteralReference
	| CoreThemeReference
	| CorePluginReference
	| UrlReference;

export function isFileReference(ref: any): ref is FileReference {
	return (
		ref &&
		typeof ref === 'object' &&
		typeof ref.resource === 'string' &&
		ResourceTypes.includes(ref.resource)
	);
}

export interface ResourceOptions {
	/** Optional semaphore to limit concurrent downloads */
	semaphore?: Semaphore;
	progress?: ProgressTracker;
}
export abstract class Resource {
	/** Optional progress tracker to monitor progress */
	public abstract progress?: ProgressTracker;
	/** A Promise that resolves to the file contents */
	protected promise?: Promise<File>;

	protected playground?: UniversalPHP;

	/**
	 * Creates a new Resource based on the given file reference
	 *
	 * @param ref The file reference to create the Resource for
	 * @param options Additional options for the Resource
	 * @returns A new Resource instance
	 */
	static create(
		ref: FileReference,
		{ semaphore, progress }: ResourceOptions
	): Resource {
		let resource: Resource;
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
			default:
				throw new Error(`Invalid resource: ${ref}`);
		}
		resource = new CachedResource(resource);

		if (semaphore) {
			resource = new SemaphoreResource(resource, semaphore);
		}

		return resource;
	}

	setPlayground(playground: UniversalPHP) {
		this.playground = playground;
	}

	/**
	 * Resolves the file contents
	 * @returns The resolved file.
	 */
	abstract resolve(): Promise<File>;

	/** The name of the referenced file */
	abstract get name(): string;

	/** Whether this Resource is loaded asynchronously */
	get isAsync(): boolean {
		return false;
	}
}
/**
 * A `Resource` that represents a file in the VFS (virtual file system) of the playground.
 */
export class VFSResource extends Resource {
	/**
	 * Creates a new instance of `VFSResource`.
	 * @param playground The playground client.
	 * @param resource The VFS reference.
	 * @param progress The progress tracker.
	 */
	constructor(
		private resource: VFSReference,
		public override progress?: ProgressTracker
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
export class LiteralResource extends Resource {
	/**
	 * Creates a new instance of `LiteralResource`.
	 * @param resource The literal reference.
	 * @param progress The progress tracker.
	 */
	constructor(
		private resource: LiteralReference,
		public override progress?: ProgressTracker
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
export abstract class FetchResource extends Resource {
	/**
	 * Creates a new instance of `FetchResource`.
	 * @param progress The progress tracker.
	 */
	constructor(public override progress?: ProgressTracker) {
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
			throw new Error(`
				Could not download "${url}".
				Check if the URL is correct and the server is reachable.
				If the url is reachable, the server might be blocking the request.
				Check the console and network for more information.

				## Does the console shows an error about "No 'Access-Control-Allow-Origin' header"?
				
				This means the server where your file is hosted does not allow requests from other sites
				(cross-origin requests, or CORS).	You will need to move it to another server that allows
				cross-origin file downloads. You can learn more about CORS at
				https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS.
				
				If you're loading a file from https://github.com/, there's an easy fix – you can load it from 
				raw.githubusercontent.com instead. Here's how to do that:

				1. Start with the original GitHub URL for the file. For example:
				```
				https://github.com/username/repository/blob/branch/filename
				```
				2. Replace `github.com` with `raw.githubusercontent.com`.
				3. Remove the `/blob/` part of the URL.

				The resulting URL should look like this:
				```
				https://raw.githubusercontent.com/username/repository/branch/filename
				```

				Error:
				${e}`);
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
 * A decorator for a resource that adds functionality such as progress tracking and caching.
 */
export class DecoratedResource<T extends Resource> extends Resource {
	constructor(private resource: T) {
		super();
	}

	/** @inheritDoc */
	async resolve() {
		return this.resource.resolve();
	}

	/** @inheritDoc */
	override async setPlayground(playground: UniversalPHP) {
		return this.resource.setPlayground(playground);
	}

	/** @inheritDoc */
	get progress() {
		return this.resource.progress;
	}

	/** @inheritDoc */
	set progress(value) {
		this.resource.progress = value;
	}

	/** @inheritDoc */
	get name() {
		return this.resource.name;
	}

	/** @inheritDoc */
	override get isAsync() {
		return this.resource.isAsync;
	}
}

/**
 * A decorator for a resource that adds caching functionality.
 */
export class CachedResource<T extends Resource> extends DecoratedResource<T> {
	protected override promise?: Promise<File>;

	/** @inheritDoc */
	override async resolve() {
		if (!this.promise) {
			this.promise = super.resolve();
		}
		return this.promise;
	}
}

/**
 * A decorator for a resource that adds concurrency control functionality through a semaphore.
 */
export class SemaphoreResource<
	T extends Resource
> extends DecoratedResource<T> {
	constructor(resource: T, private readonly semaphore: Semaphore) {
		super(resource);
	}

	/** @inheritDoc */
	override async resolve() {
		if (!this.isAsync) {
			return super.resolve();
		}
		return this.semaphore.run(() => super.resolve());
	}
}
