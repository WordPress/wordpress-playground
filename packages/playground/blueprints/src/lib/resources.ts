import type { ProgressTracker } from '@php-wasm/progress';
import {
	cloneResponseMonitorProgress,
	cloneStreamMonitorProgress,
} from '@php-wasm/progress';
import type { FileTree, UniversalPHP } from '@php-wasm/universal';
import type { Semaphore } from '@php-wasm/util';
import { dirname } from '@php-wasm/util';
import {
	listDescendantFiles,
	listGitFiles,
	resolveCommitHash,
	sparseCheckout,
} from '@wp-playground/storage';
import { zipNameToHumanName } from './utils/zip-name-to-human-name';
import { fetchWithCorsProxy } from '@php-wasm/web';
import { StreamedFile } from '@php-wasm/stream-compression';
import type { StreamBundledFile } from './blueprint';

export type { FileTree };
export const ResourceTypes = [
	'vfs',
	'literal',
	'wordpress.org/themes',
	'wordpress.org/plugins',
	'url',
	'git:directory',
	'bundled',
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

export type BundledReference = {
	/** Identifies the file resource as a Blueprint file */
	resource: 'bundled';
	/** The path to the file in the Blueprint */
	path: string;
};

export type FileReference =
	| VFSReference
	| LiteralReference
	| CoreThemeReference
	| CorePluginReference
	| UrlReference
	| BundledReference;

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
			corsProxy,
			streamBundledFile,
		}: {
			/** Optional semaphore to limit concurrent downloads */
			semaphore?: Semaphore;
			progress?: ProgressTracker;
			corsProxy?: string;
			streamBundledFile?: StreamBundledFile;
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
				resource = new UrlResource(ref, progress, { corsProxy });
				break;
			case 'git:directory':
				resource = new GitDirectoryResource(ref, progress, {
					corsProxy,
				});
				break;
			case 'literal:directory':
				resource = new LiteralDirectoryResource(ref, progress);
				break;
			case 'bundled':
				if (!streamBundledFile) {
					throw new Error(
						'Filesystem is required for blueprint resources'
					);
				}
				resource = new BundledResource(
					ref,
					streamBundledFile,
					progress
				);
				break;
			default:
				throw new Error(
					`Unknown resource type: ${(ref as any).resource}`
				);
		}

		if (semaphore) {
			resource = new SemaphoreResource(resource, semaphore);
		}

		return new CachedResource(resource);
	}
}

export abstract class ResourceDecorator<
	T extends File | Directory
> extends Resource<T> {
	protected resource: Resource<T>;
	constructor(resource: Resource<T>) {
		super();
		this.resource = resource;
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
	private resource: VFSReference;

	/**
	 * Creates a new instance of `VFSResource`.
	 * @param playground The playground client.
	 * @param resource The VFS reference.
	 * @param progress The progress tracker.
	 */
	constructor(resource: VFSReference, _progress?: ProgressTracker) {
		super();
		this.resource = resource;
		this._progress = _progress;
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
	private resource: LiteralReference;

	/**
	 * Creates a new instance of `LiteralResource`.
	 * @param resource The literal reference.
	 * @param progress The progress tracker.
	 */
	constructor(resource: LiteralReference, _progress?: ProgressTracker) {
		super();
		this.resource = resource;
		this._progress = _progress;
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
	private corsProxy?: string;

	/**
	 * Creates a new instance of `FetchResource`.
	 * @param progress The progress tracker.
	 */
	constructor(_progress?: ProgressTracker, corsProxy?: string) {
		super();
		this._progress = _progress;
		this.corsProxy = corsProxy;
	}

	/** @inheritDoc */
	async resolve() {
		this.progress?.setCaption(this.caption);
		const url = this.getURL();
		try {
			let response = await fetchWithCorsProxy(
				url,
				undefined,
				this.corsProxy
			);
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
		} catch {
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
	private resource: UrlReference;
	private options?: { corsProxy?: string };

	/**
	 * Creates a new instance of `UrlResource`.
	 * @param resource The URL reference.
	 * @param progress The progress tracker.
	 */
	constructor(
		resource: UrlReference,
		progress?: ProgressTracker,
		options?: { corsProxy?: string }
	) {
		super(progress, options?.corsProxy);
		this.resource = resource;
		this.options = options;
		/**
		 * Translates GitHub URLs into raw.githubusercontent.com URLs.
		 *
		 * Example:
		 * https://github.com/WordPress/wordpress-develop/blob/trunk/src/wp-includes/version.php
		 *
		 * Becomes
		 * https://raw.githubusercontent.com/WordPress/wordpress-develop/trunk/src/wp-includes/version.php
		 *
		 * There's virtually a zero chance you actually want to refer to the HTML response served
		 * by GitHub.com, with the GitHub UI, file preview, etc. in it. Almost certainly, you want
		 * to download the raw file.
		 *
		 * This often confuses Blueprint authors when the GitHub URL they've used in their Blueprint
		 * does not work. There's plenty of issues in the Playground repository asking specifically
		 * about that. Well, GitHub.com response is not what they want, and even if it was, GitHub
		 * does not provide the necessary CORS headers.
		 *
		 * While the URL rewriting might confuse advanced developers, they're in a good
		 * position to figure it out. This feature shouldn't do any harm.
		 *
		 * Note the rewriting is implemented in UrlResource, which is used in all Playground
		 * implementations, e.g. the browser, the CLI, Studio, etc. While most of them don't
		 * need to worry about CORS, we still want ot make sure the same Blueprints will work
		 * in all Playground runtimes.
		 *
		 * ## Caveats
		 *
		 * Directory URLs are not supported. For example, a URL such as
		 * https://github.com/WordPress/blueprints/tree/trunk/blueprints would be rewritten to
		 * https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints, which
		 * yields `404: Not Found`.
		 *
		 * There's no way to distinguish between a file and a directory based just on its GitHub.com
		 * URL. If this starts coming up a lot in Playground issues, let's explore consulting the
		 * repository contents and rewriting the URL resource as a git directory resource.
		 *
		 * @see https://github.com/WordPress/wordpress-playground/pull/1793
		 */
		if (this.resource.url.startsWith('https://github.com/')) {
			const match = this.resource.url.match(
				/^https:\/\/github\.com\/(?<owner>[^/]+)\/(?<repo>[^/]+)\/blob\/(?<branch>[^/]+)\/(?<path>.+[^/])$/
			);
			if (match?.groups) {
				this.resource = {
					...this.resource,
					url: `https://raw.githubusercontent.com/${match.groups['owner']}/${match.groups['repo']}/${match.groups['branch']}/${match.groups['path']}`,
				};
			}
		}
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
	private reference: GitDirectoryReference;
	private options?: { corsProxy?: string };

	constructor(
		reference: GitDirectoryReference,
		_progress?: ProgressTracker,
		options?: { corsProxy?: string }
	) {
		super();
		this.reference = reference;
		this._progress = _progress;
		this.options = options;
	}

	async resolve() {
		const repoUrl = this.options?.corsProxy
			? `${this.options.corsProxy}${this.reference.url}`
			: this.reference.url;

		const commitHash = await resolveCommitHash(repoUrl, {
			value: this.reference.ref,
			type: 'infer',
		});
		const allFiles = await listGitFiles(repoUrl, commitHash);

		const requestedPath = this.reference.path.replace(/^\/+/, '');
		const filesToClone = listDescendantFiles(allFiles, requestedPath);
		let files = await sparseCheckout(repoUrl, commitHash, filesToClone);

		// Remove the path prefix from the cloned file names.
		files = mapKeys(files, (name) =>
			name.substring(requestedPath.length).replace(/^\/+/, '')
		);
		return {
			name:
				dirname(this.reference.path) ||
				this.reference.url
					.replaceAll(/[^a-zA-Z0-9-.]/g, '-')
					.replaceAll(/-+/g, '-'),
			files,
		};
	}

	/** @inheritDoc */
	get name() {
		return this.reference.path.split('/').pop()!;
	}
}

function mapKeys(obj: Record<string, any>, fn: (key: string) => string) {
	return Object.fromEntries(
		Object.entries(obj).map(([key, value]) => [fn(key), value])
	);
}

/**
 * A `Resource` that represents a git directory.
 */
export class LiteralDirectoryResource extends Resource<Directory> {
	private reference: DirectoryLiteralReference;

	constructor(
		reference: DirectoryLiteralReference,
		_progress?: ProgressTracker
	) {
		super();
		this.reference = reference;
		this._progress = _progress;
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
	private resource: CoreThemeReference;

	constructor(resource: CoreThemeReference, progress?: ProgressTracker) {
		super(progress);
		this.resource = resource;
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
	private resource: CorePluginReference;

	constructor(resource: CorePluginReference, progress?: ProgressTracker) {
		super(progress);
		this.resource = resource;
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
	private readonly semaphore: Semaphore;
	constructor(resource: Resource<T>, semaphore: Semaphore) {
		super(resource);
		this.semaphore = semaphore;
	}

	/** @inheritDoc */
	override async resolve() {
		if (!this.isAsync) {
			return this.resource.resolve();
		}
		return this.semaphore.run(() => this.resource.resolve());
	}
}

/**
 * A `Resource` that represents a file bundled with the Blueprint.
 */
export class BundledResource extends Resource<File> {
	private resource: BundledReference;
	private streamBundledFile: StreamBundledFile;

	/**
	 * Creates a new instance of `BlueprintResource`.
	 * @param resource The blueprint reference.
	 * @param filesystem The filesystem to read from.
	 * @param progress The progress tracker.
	 */
	constructor(
		resource: BundledReference,
		streamBundledFile: StreamBundledFile,
		_progress?: ProgressTracker
	) {
		if (!streamBundledFile) {
			throw new Error(
				`You are trying to run a Blueprint that refers to a bundled file ("blueprint" resource type), ` +
					`but you did not provide the rest of the bundle. This Blueprint won't work as a standalone JSON file. ` +
					`You'll need to load the entire bundle, e.g. a blueprint.zip file. Alternatively, you may try loading it ` +
					`directly from a URL or a local directory and Playground will try (with your permission) to source the missing ` +
					`files from paths relative to the blueprint file.`
			);
		}
		super();
		this.resource = resource;
		this.streamBundledFile = streamBundledFile;
		this._progress = _progress;
	}

	/** @inheritDoc */
	async resolve() {
		this.progress?.set(0);

		try {
			// Get the file stream from the filesystem
			const file = await this.streamBundledFile(this.resource.path);
			const length = file.filesize;
			if (!length) {
				this.progress?.set(100);
				return file;
			}
			const progressStream = cloneStreamMonitorProgress(
				file.stream(),
				length,
				(event) => {
					this.progress?.set(
						(event.detail.loaded / event.detail.total) * 100
					);
				}
			);
			return new StreamedFile(progressStream, this.name, {
				filesize: length,
			});
		} catch (error: unknown) {
			this.progress?.set(100);
			throw new Error(
				`Failed to read file from blueprint. This Blueprint refers to a resource of type "bundled" with path "${this.resource.path}" that was not available. ` +
					`Please ensure that the entire bundle, such as a blueprint.zip file, is loaded. If you are trying to load the Blueprint ` +
					`directly from a URL or a local directory, make sure that all the necessary files are accessible and located relative ` +
					`to the blueprint file. \n\nError details: ${
						error instanceof Error ? error.message : String(error)
					}`,
				{ cause: error }
			);
		}
	}

	/** @inheritDoc */
	get name() {
		return this.resource.path.split('/').pop() || '';
	}

	/** @inheritDoc */
	override get isAsync(): boolean {
		return true;
	}
}
