import type { ProgressTracker } from '@php-wasm/progress';
import {
	cloneResponseMonitorProgress,
	cloneStreamMonitorProgress,
} from '@php-wasm/progress';
import type { FileTree, UniversalPHP } from '@php-wasm/universal';
import type { Semaphore } from '@php-wasm/util';
import { randomFilename } from '@php-wasm/util';
import {
	GitAuthenticationError,
	listDescendantFiles,
	listGitFiles,
	resolveCommitHash,
	sparseCheckout,
} from '@wp-playground/storage';
import { zipNameToHumanName } from '../utils/zip-name-to-human-name';
import { fetchWithCorsProxy } from '@php-wasm/web';
import { StreamedFile } from '@php-wasm/stream-compression';
import type { StreamBundledFile } from './types';
import { createDotGitDirectory } from '@wp-playground/storage';

const BUNDLED_RESOURCE_ERROR_MESSAGE =
	'Blueprint resource of type "bundled" requires a filesystem.\n\n' +
	'This Blueprint refers to files that should be bundled with it (like images, plugins, or themes), ' +
	'but the filesystem needed to access these files is not available. This usually happens when:\n\n' +
	"1. You're trying to load a Blueprint as a standalone JSON file that was meant to be part of a bundle\n" +
	'2. The Blueprint was not packaged correctly as a blueprint.zip file\n\n' +
	'To fix this:\n' +
	"• If you're loading from a URL, make sure all referenced files are accessible relative to the Blueprint file\n" +
	"• If you're using a blueprint.zip file, ensure it contains all the files referenced in the Blueprint\n" +
	'• Check that the "resource": "bundled" references in your Blueprint match actual files in your bundle\n\n' +
	'Learn more about Blueprint resources: https://wordpress.github.io/wordpress-playground/blueprints/data-format#resources';

export class BlueprintFilesystemRequiredError extends Error {
	constructor(message = BUNDLED_RESOURCE_ERROR_MESSAGE) {
		super(message);
		this.name = 'BlueprintFilesystemRequiredError';
	}
}

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
type GitDirectoryRefType = 'branch' | 'tag' | 'commit' | 'refname';
export type GitDirectoryReference = {
	/** Identifies the file resource as a git directory */
	resource: 'git:directory';
	/** The URL of the git repository */
	url: string;
	/** The ref (branch, tag, or commit) of the git repository */
	ref: string;
	/** Explicit hint about the ref type (branch, tag, commit, refname) */
	refType?: GitDirectoryRefType;
	/** The path to the directory in the git repository. Defaults to the repo root. */
	path?: string;
	/** When true, include a `.git` directory with Git metadata (experimental). */
	'.git'?: boolean;
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
			gitAdditionalHeadersCallback,
		}: {
			/** Optional semaphore to limit concurrent downloads */
			semaphore?: Semaphore;
			progress?: ProgressTracker;
			corsProxy?: string;
			streamBundledFile?: StreamBundledFile;
			gitAdditionalHeadersCallback?: (
				url: string
			) => Record<string, string>;
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
					additionalHeaders: gitAdditionalHeadersCallback,
				});
				break;
			case 'literal:directory':
				resource = new LiteralDirectoryResource(ref, progress);
				break;
			case 'bundled':
				if (!streamBundledFile) {
					throw new BlueprintFilesystemRequiredError();
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
				this.corsProxy,
				await this.playground?.absoluteUrl
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
			const filename =
				this.name ||
				parseContentDisposition(
					response.headers.get('content-disposition') || ''
				) ||
				encodeURIComponent(url);
			return new File([await response.blob()], filename);
		} catch (e) {
			throw new Error(
				`Could not download "${url}".\n\n` +
					`Confirm that the URL is correct, the server is reachable, and the file is` +
					`actually served at that URL. Original error: \n ${e}`
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

/**
 * Parses the Content-Disposition header to extract the filename.
 *
 * @param contentDisposition The Content-Disposition header value
 * @returns The filename if found, null otherwise
 */
function parseContentDisposition(contentDisposition: string): string | null {
	if (!contentDisposition) {
		return null;
	}

	// Handle both filename and filename* parameters
	const filenameMatch = contentDisposition.match(/filename\*?=([^;]+)/i);
	if (!filenameMatch) {
		return null;
	}

	let filename = filenameMatch[1].trim();

	// Remove surrounding quotes
	if (
		(filename.startsWith('"') && filename.endsWith('"')) ||
		(filename.startsWith("'") && filename.endsWith("'"))
	) {
		filename = filename.slice(1, -1);
	}

	// Handle RFC 5987 encoded filenames (filename*=UTF-8''example.txt)
	if (filenameMatch[0].includes('filename*')) {
		const encodedMatch = filename.match(/^[^']*'[^']*'(.+)$/);
		if (encodedMatch) {
			try {
				filename = decodeURIComponent(encodedMatch[1]);
			} catch {
				// If decoding fails, use the original filename
			}
		}
	}

	return filename;
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
				/^https:\/\/github\.com\/(?<owner>[^/]+)\/(?<repo>[^/]+)\/(?:blob|raw)\/(?<branch>[^/]+)\/(?<path>.+[^/])$/
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
	private options?: {
		corsProxy?: string;
		additionalHeaders?: (url: string) => Record<string, string>;
	};

	constructor(
		reference: GitDirectoryReference,
		_progress?: ProgressTracker,
		options?: {
			corsProxy?: string;
			additionalHeaders?: (url: string) => Record<string, string>;
		}
	) {
		super();
		this.reference = reference;
		this._progress = _progress;
		this.options = options;
	}

	async resolve() {
		const additionalHeaders =
			this.options?.additionalHeaders?.(this.reference.url) ?? {};

		const repoUrl = this.options?.corsProxy
			? `${this.options.corsProxy}${this.reference.url}`
			: this.reference.url;

		try {
			const commitHash = await resolveCommitHash(
				repoUrl,
				{
					value: this.reference.ref,
					type: this.reference.refType ?? 'infer',
				},
				additionalHeaders
			);
			const allFiles = await listGitFiles(
				repoUrl,
				commitHash,
				additionalHeaders
			);

			const requestedPath = (this.reference.path ?? '').replace(
				/^\/+/,
				''
			);
			const filesToClone = listDescendantFiles(allFiles, requestedPath);
			const checkout = await sparseCheckout(
				repoUrl,
				commitHash,
				filesToClone,
				{
					withObjects: this.reference['.git'],
					additionalHeaders,
				}
			);
			let files = checkout.files;

			// Remove the path prefix from the cloned file names.
			files = mapKeys(files, (name) =>
				name.substring(requestedPath.length).replace(/^\/+/, '')
			);
			if (this.reference['.git']) {
				const gitFiles = await createDotGitDirectory({
					repoUrl: this.reference.url,
					commitHash,
					ref: this.reference.ref,
					refType: this.reference.refType,
					objects: checkout.objects ?? [],
					fileOids: checkout.fileOids ?? {},
					pathPrefix: requestedPath,
				});
				files = {
					...gitFiles,
					...files,
				};
			}
			return {
				name: this.filename,
				files,
			};
		} catch (error) {
			if (error instanceof GitAuthenticationError) {
				// Unwrap and re-throw with the original URL (without CORS proxy)
				throw new GitAuthenticationError(
					this.reference.url,
					error.status
				);
			}
			throw error;
		}
	}

	/**
	 * Generate a nice, non-empty filename – the installPlugin step depends on it.
	 */
	get filename() {
		return (
			this.name
				.replaceAll(/[^a-zA-Z0-9-.]/g, '-')
				.replaceAll(/-+/g, '-')
				.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '') ||
			randomFilename()
		);
	}

	/** @inheritDoc */
	get name() {
		return [
			this.reference.url,
			this.reference.ref ? `(${this.reference.ref})` : '',
			this.reference.path?.replace(/^\/+/, '')
				? `at ${this.reference.path}`
				: '',
		]
			.filter((segment) => segment.length > 0)
			.join(' ');
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
