import { Semaphore, basename } from '@php-wasm/util';
import type {
	DataReferenceResolver,
	ResolvedFile,
	ResolvedDirectory,
	ExecutionContextBackend,
} from '../types';
import { DataReferenceResolutionError } from '../types';
import type { DataSources } from '../wep-1-blueprint-v2-schema/appendix-B-data-sources';
import type { DataReferenceResolverConfig } from './types';

const WORDPRESS_PLUGIN_DOWNLOAD_URL = 'https://downloads.wordpress.org/plugin/';
const WORDPRESS_THEME_DOWNLOAD_URL = 'https://downloads.wordpress.org/theme/';

/**
 * Default concurrency limiter used when none is provided.
 */
const DEFAULT_SEMAPHORE = new Semaphore({ concurrency: 5 });

/**
 * Resolves V2 data references into concrete file and directory
 * contents. Handles URLs, execution-context paths, inline
 * content, git repository paths, and WordPress.org slugs.
 */
export class DataReferenceResolverImpl implements DataReferenceResolver {
	private semaphore: Semaphore;
	private corsProxy: string;
	private executionContext?: ExecutionContextBackend;

	constructor(config: DataReferenceResolverConfig = {}) {
		this.semaphore = config.semaphore ?? DEFAULT_SEMAPHORE;
		this.corsProxy = config.corsProxy ?? '';
		this.executionContext = config.executionContext;
	}

	async resolveFile(ref: DataSources.DataReference): Promise<ResolvedFile> {
		if (isInlineFile(ref)) {
			return resolveInlineFile(ref);
		}
		if (typeof ref === 'string' && isUrlReference(ref)) {
			return this.fetchUrl(ref);
		}
		if (typeof ref === 'string' && isExecutionContextPath(ref)) {
			return this.readExecutionContextFile(ref);
		}
		if (typeof ref === 'object' && isGitPath(ref)) {
			throw new DataReferenceResolutionError(
				JSON.stringify(ref),
				'Git repository references are not yet supported'
			);
		}
		throw new DataReferenceResolutionError(
			typeof ref === 'string' ? ref : JSON.stringify(ref),
			'Unrecognized data reference type'
		);
	}

	async resolveDirectory(
		ref: DataSources.DataReference
	): Promise<ResolvedDirectory> {
		if (isInlineDirectory(ref)) {
			return resolveInlineDirectory(ref);
		}
		if (typeof ref === 'string' && isExecutionContextPath(ref)) {
			return this.readExecutionContextDirectory(ref);
		}
		throw new DataReferenceResolutionError(
			typeof ref === 'string' ? ref : JSON.stringify(ref),
			'Cannot resolve reference as a directory'
		);
	}

	/**
	 * Resolves a WordPress.org plugin slug (optionally
	 * versioned) to a downloaded zip file.
	 *
	 * @param slug - e.g. "jetpack" or "jetpack@6.4.3"
	 */
	async resolvePluginReference(
		slug: DataSources.PluginDirectoryReference
	): Promise<ResolvedFile> {
		const { name, version } = parseSlugWithVersion(slug);
		const versionSuffix = version ? `.${version}` : '';
		const url =
			`${WORDPRESS_PLUGIN_DOWNLOAD_URL}` + `${name}${versionSuffix}.zip`;
		return this.fetchUrl(url);
	}

	/**
	 * Resolves a WordPress.org theme slug (optionally versioned)
	 * to a downloaded zip file.
	 *
	 * @param slug - e.g. "twentytwentyfour" or "adventurer@4.6.0"
	 */
	async resolveThemeReference(
		slug: DataSources.ThemeDirectoryReference
	): Promise<ResolvedFile> {
		const { name, version } = parseSlugWithVersion(slug);
		const versionSuffix = version ? `.${version}` : '';
		const url =
			`${WORDPRESS_THEME_DOWNLOAD_URL}` + `${name}${versionSuffix}.zip`;
		return this.fetchUrl(url);
	}

	private async fetchUrl(url: string): Promise<ResolvedFile> {
		const effectiveUrl = this.corsProxy ? `${this.corsProxy}${url}` : url;
		return this.semaphore.run(async () => {
			const response = await fetch(effectiveUrl);
			if (!response.ok) {
				throw new DataReferenceResolutionError(
					url,
					`Failed to fetch ${url}: ` +
						`${response.status} ${response.statusText}`
				);
			}
			const buffer = await response.arrayBuffer();
			const name = fileNameFromUrl(url);
			return { name, contents: new Uint8Array(buffer) };
		});
	}

	private async readExecutionContextFile(
		path: string
	): Promise<ResolvedFile> {
		if (!this.executionContext) {
			throw new DataReferenceResolutionError(
				path,
				'No execution context backend available ' +
					'to resolve path references'
			);
		}
		const normalized = normalizePath(path);
		const contents =
			await this.executionContext.readFileAsBuffer(normalized);
		const name = basename(normalized);
		return { name, contents };
	}

	private async readExecutionContextDirectory(
		path: string
	): Promise<ResolvedDirectory> {
		if (!this.executionContext) {
			throw new DataReferenceResolutionError(
				path,
				'No execution context backend available ' +
					'to resolve path references'
			);
		}
		const normalized = normalizePath(path);
		const entries = await this.executionContext.listFiles(normalized);
		const files: Record<string, Uint8Array | ResolvedDirectory> = {};
		for (const entry of entries) {
			const entryPath = `${normalized}/${entry}`;
			try {
				const contents =
					await this.executionContext.readFileAsBuffer(entryPath);
				files[entry] = contents;
			} catch {
				// If reading as file fails, try as directory.
				files[entry] =
					await this.readExecutionContextDirectory(entryPath);
			}
		}
		return { name: basename(normalized), files };
	}
}

// -----------------------------------------------------------------
// Type guard helpers (exported for testing)
// -----------------------------------------------------------------

/**
 * Checks whether a reference matches the InlineFile shape:
 * `{ filename, content }`.
 */
export function isInlineFile(
	ref: DataSources.DataReference
): ref is DataSources.InlineFile {
	return (
		typeof ref === 'object' &&
		ref !== null &&
		'filename' in ref &&
		'content' in ref
	);
}

/**
 * Checks whether a reference matches the InlineDirectory shape:
 * `{ directoryName, files }`.
 */
export function isInlineDirectory(
	ref: DataSources.DataReference
): ref is DataSources.InlineDirectory {
	return (
		typeof ref === 'object' &&
		ref !== null &&
		'directoryName' in ref &&
		'files' in ref
	);
}

/**
 * Checks whether a string reference is an HTTP or HTTPS URL.
 */
export function isUrlReference(ref: string): ref is DataSources.URLReference {
	return ref.startsWith('http://') || ref.startsWith('https://');
}

/**
 * Checks whether a string reference is a path within the
 * blueprint execution context (starts with `./` or `/`).
 */
export function isExecutionContextPath(
	ref: string
): ref is DataSources.ExecutionContextPath {
	return ref.startsWith('./') || ref.startsWith('/');
}

/**
 * Checks whether a reference matches the GitPath shape:
 * `{ gitRepository }`.
 */
export function isGitPath(
	ref: DataSources.DataReference
): ref is DataSources.GitPath {
	return typeof ref === 'object' && ref !== null && 'gitRepository' in ref;
}

/**
 * Splits a versioned slug like `"jetpack@6.4.3"` into name and
 * version components. Returns `{ name, version: undefined }` for
 * unversioned slugs like `"jetpack"`.
 */
export function parseSlugWithVersion(slug: string): {
	name: string;
	version: string | undefined;
} {
	const atIndex = slug.indexOf('@');
	if (atIndex === -1) {
		return { name: slug, version: undefined };
	}
	return {
		name: slug.substring(0, atIndex),
		version: slug.substring(atIndex + 1),
	};
}

/**
 * Normalizes an execution-context path by stripping a leading
 * `./` prefix and preventing `../` traversal attempts.
 *
 * @param path - A path starting with `./` or `/`.
 * @returns A cleaned path relative to the context root.
 * @throws DataReferenceResolutionError on traversal attempts.
 */
export function normalizePath(path: string): string {
	let normalized = path;
	if (normalized.startsWith('./')) {
		normalized = normalized.substring(2);
	} else if (normalized.startsWith('/')) {
		normalized = normalized.substring(1);
	}
	if (normalized.includes('..')) {
		throw new DataReferenceResolutionError(
			path,
			'Path traversal via ".." is not allowed'
		);
	}
	return normalized;
}

// -----------------------------------------------------------------
// Internal helpers
// -----------------------------------------------------------------

function resolveInlineFile(ref: DataSources.InlineFile): ResolvedFile {
	const encoder = new TextEncoder();
	return {
		name: ref.filename,
		contents: encoder.encode(ref.content),
	};
}

function resolveInlineDirectory(
	ref: DataSources.InlineDirectory
): ResolvedDirectory {
	const encoder = new TextEncoder();
	const files: Record<string, Uint8Array | ResolvedDirectory> = {};
	for (const [key, value] of Object.entries(ref.files)) {
		if (typeof value === 'string') {
			files[key] = encoder.encode(value);
		} else {
			files[key] = resolveInlineDirectory(value);
		}
	}
	return { name: ref.directoryName, files };
}

function fileNameFromUrl(url: string): string {
	try {
		const pathname = new URL(url).pathname;
		const name = basename(pathname);
		return name || 'download';
	} catch {
		return 'download';
	}
}
