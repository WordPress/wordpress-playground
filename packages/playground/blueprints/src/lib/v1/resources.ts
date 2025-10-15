import type { ProgressTracker } from '@php-wasm/progress';
import {
	cloneResponseMonitorProgress,
	cloneStreamMonitorProgress,
} from '@php-wasm/progress';
import type { FileTree, UniversalPHP } from '@php-wasm/universal';
import type { Semaphore } from '@php-wasm/util';
import { randomFilename } from '@php-wasm/util';
import {
	listDescendantFiles,
	listGitFiles,
	resolveCommitHash,
	sparseCheckout,
	type SparseCheckoutObject,
} from '@wp-playground/storage';
import { zipNameToHumanName } from '../utils/zip-name-to-human-name';
import { fetchWithCorsProxy } from '@php-wasm/web';
import { StreamedFile } from '@php-wasm/stream-compression';
import type { StreamBundledFile } from './types';
import pako from 'pako';
const deflate = pako.deflate;

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
			type: this.reference.refType ?? 'infer',
		});
		const allFiles = await listGitFiles(repoUrl, commitHash);

		const requestedPath = (this.reference.path ?? '').replace(/^\/+/, '');
		const filesToClone = listDescendantFiles(allFiles, requestedPath);
		const checkout = await sparseCheckout(
			repoUrl,
			commitHash,
			filesToClone
		);
		let files = checkout.files;

		// Remove the path prefix from the cloned file names.
		files = mapKeys(files, (name) =>
			name.substring(requestedPath.length).replace(/^\/+/, '')
		);
		if (this.reference['.git']) {
			const gitFiles = createGitDirectoryContents({
				repoUrl: this.reference.url,
				commitHash,
				ref: this.reference.ref,
				refType: this.reference.refType,
				objects: checkout.objects,
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

type GitHeadInfo = {
	headContent: string;
	branchName?: string;
	branchRef?: string;
	tagName?: string;
};

function createGitDirectoryContents({
	repoUrl,
	commitHash,
	ref,
	refType,
	objects,
}: {
	repoUrl: string;
	commitHash: string;
	ref: string;
	refType?: GitDirectoryRefType;
	objects: SparseCheckoutObject[];
}): Record<string, string | Uint8Array> {
	const gitFiles: Record<string, string | Uint8Array> = {};
	const headInfo = resolveHeadInfo(ref, refType, commitHash);

	gitFiles['.git/HEAD'] = headInfo.headContent;
	gitFiles['.git/config'] = buildGitConfig(repoUrl, {
		branchName: headInfo.branchName,
	});
	gitFiles['.git/description'] = 'WordPress Playground clone\n';
	gitFiles['.git/shallow'] = `${commitHash}\n`;
	// const logEntry = `${'0'.repeat(
	// 	40
	// )} ${commitHash} Playground <noreply@wordpress.org> 0 +0000\tclone: from ${repoUrl}\n`;
	// gitFiles['.git/logs/HEAD'] = logEntry;
	// gitFiles['.git/info/exclude'] =
	// 	'# git ls-files --others --exclude-standard\n';

	// Create refs/ directory structure
	gitFiles['.git/refs/heads/.gitkeep'] = '';
	gitFiles['.git/refs/tags/.gitkeep'] = '';
	gitFiles['.git/refs/remotes/.gitkeep'] = '';

	if (headInfo.branchRef && headInfo.branchName) {
		gitFiles['.git/logs/HEAD'] = `ref: ${headInfo.branchRef}\n`;
		gitFiles[`.git/${headInfo.branchRef}`] = `${commitHash}\n`;
		gitFiles[
			`.git/refs/remotes/origin/${headInfo.branchName}`
		] = `${commitHash}\n`;
		gitFiles[
			'.git/refs/remotes/origin/HEAD'
		] = `ref: refs/remotes/origin/${headInfo.branchName}\n`;
		// gitFiles[`.git/logs/${headInfo.branchRef}`] = logEntry;
	}

	if (headInfo.tagName) {
		gitFiles[`.git/refs/tags/${headInfo.tagName}`] = `${commitHash}\n`;
	}

	// Use loose objects only, no packfiles
	Object.assign(gitFiles, createLooseGitObjectFiles(objects));

	return gitFiles;
}

const FULL_SHA_REGEX = /^[0-9a-f]{40}$/i;

function createLooseGitObjectFiles(objects: SparseCheckoutObject[]) {
	const files: Record<string, Uint8Array> = {};
	const encoder = new TextEncoder();
	for (const { oid, type, body } of objects) {
		if (!oid || body.length === 0) {
			continue;
		}
		const header = encoder.encode(`${type} ${body.length}\0`);
		const combined = new Uint8Array(header.length + body.length);
		combined.set(header, 0);
		combined.set(body, header.length);
		const compressed = deflate(combined);
		const prefix = oid.slice(0, 2);
		const suffix = oid.slice(2);
		files[`.git/objects/${prefix}/${suffix}`] = compressed;
	}
	return files;
}

function resolveHeadInfo(
	ref: string,
	refType: GitDirectoryRefType | undefined,
	commitHash: string
): GitHeadInfo {
	const trimmed = ref?.trim() ?? '';
	let fullRef: string | null = null;

	switch (refType) {
		case 'branch':
			if (trimmed) {
				fullRef = `refs/heads/${trimmed}`;
			}
			break;
		case 'refname':
			fullRef = trimmed || null;
			break;
		case 'tag':
			if (trimmed.startsWith('refs/')) {
				fullRef = trimmed;
			} else if (trimmed) {
				fullRef = `refs/tags/${trimmed}`;
			}
			break;
		case 'commit':
			fullRef = null;
			break;
		default:
			if (trimmed.startsWith('refs/')) {
				fullRef = trimmed;
			} else if (FULL_SHA_REGEX.test(trimmed)) {
				fullRef = null;
			} else if (trimmed && trimmed !== 'HEAD') {
				fullRef = `refs/heads/${trimmed}`;
			}
			break;
	}

	const headContent = fullRef ? `ref: ${fullRef}\n` : `${commitHash}\n`;

	const branchRef =
		fullRef && fullRef.startsWith('refs/heads/') ? fullRef : undefined;
	const branchName = branchRef?.slice('refs/heads/'.length);

	const tagRef =
		fullRef && fullRef.startsWith('refs/tags/') ? fullRef : undefined;
	const tagName = tagRef?.slice('refs/tags/'.length);

	return {
		headContent,
		branchName,
		branchRef,
		tagName,
	};
}

function buildGitConfig(
	repoUrl: string,
	{
		branchName,
		partialCloneFilter,
	}: { branchName?: string; partialCloneFilter?: string }
) {
	const repositoryFormatVersion = partialCloneFilter ? 1 : 0;
	const lines = [
		'[core]',
		`\trepositoryformatversion = ${repositoryFormatVersion}`,
		'\tfilemode = true',
		'\tbare = false',
		'\tlogallrefupdates = true',
		'\tignorecase = true',
		'\tprecomposeunicode = true',
		'[remote "origin"]',
		`\turl = ${repoUrl}`,
		'\tfetch = +refs/heads/*:refs/remotes/origin/*',
		'\tfetch = +refs/tags/*:refs/tags/*',
	];
	if (partialCloneFilter) {
		lines.push('\tpromisor = true');
		lines.push(`\tpartialclonefilter = ${partialCloneFilter}`);
		lines.push('[extensions]');
		lines.push('\tpartialclone = origin');
	}
	if (branchName) {
		lines.push(
			`[branch "${branchName}"]`,
			'\tremote = origin',
			`\tmerge = refs/heads/${branchName}`
		);
	}
	return lines.join('\n') + '\n';
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
