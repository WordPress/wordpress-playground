import { dirname, joinPaths } from '@php-wasm/util';
import { DEFAULT_BASE_URL, removePathPrefix } from './urls';
import type { PHPResponse } from './php-response';
import type { PHPRequest } from './universal-php';
import type {
	RewriteRule,
	PathAlias,
	FileNotFoundGetActionCallback,
	FileNotFoundAction,
} from './php-request-handler';
import { applyRewriteRules } from './php-request-handler';

/**
 * Minimal filesystem interface for routing decisions.
 * Implementations can back this with a WASM filesystem,
 * host filesystem, or any other source.
 */
export interface RouterFilesystem {
	isFile(path: string): boolean;
	isDir(path: string): boolean;
}

export type ResolvedRoute =
	| { type: 'static-file'; fsPath: string }
	| {
			type: 'php';
			fsPath: string;
			/**
			 * The request URL as it arrived, minus the hash.
			 */
			originalRequestUrl: URL;
			/**
			 * The request URL after the rewrite rules and the directory
			 * index resolution have been applied. PHP superglobals such as
			 * PHP_SELF and QUERY_STRING are derived from this URL, so it
			 * must be the URL the router actually resolved `fsPath` from.
			 */
			rewrittenRequestUrl: URL;
	  }
	| {
			type: 'redirect';
			statusCode: number;
			headers: Record<string, string[]>;
	  }
	| { type: '404' }
	| { type: 'response'; response: PHPResponse };

export interface RequestRouterConfig {
	documentRoot: string;
	/**
	 * URL path prefix (e.g., '/scope:xxx'). Stripped from
	 * request URLs before filesystem resolution.
	 */
	pathname?: string;
	rewriteRules?: RewriteRule[];
	pathAliases?: PathAlias[];
	getFileNotFoundAction?: FileNotFoundGetActionCallback;
	fs: RouterFilesystem;
}

/**
 * A pure routing engine that resolves a request URL to a routing
 * decision. Has no PHP dependency — only needs a filesystem
 * abstraction for isFile/isDir checks.
 *
 * This class encapsulates the routing logic previously embedded in
 * PHPRequestHandler.requestStreamed(), making it reusable on the
 * main thread (e.g., the CLI can create a router backed by the
 * host filesystem to serve static files without a worker round-trip).
 */
export class RequestRouter {
	#documentRoot: string;
	#pathname: string;
	#rewriteRules: RewriteRule[];
	#pathAliases: PathAlias[];
	#getFileNotFoundAction: FileNotFoundGetActionCallback;
	#fs: RouterFilesystem;

	constructor(config: RequestRouterConfig) {
		this.#documentRoot = config.documentRoot;
		this.#pathname = config.pathname ?? '';
		this.#rewriteRules = config.rewriteRules ?? [];
		this.#pathAliases = config.pathAliases ?? [];
		this.#getFileNotFoundAction =
			config.getFileNotFoundAction ?? (() => ({ type: '404' }));
		this.#fs = config.fs;
	}

	resolve(request: PHPRequest): ResolvedRoute {
		const isAbsolute = looksLikeAbsoluteUrl(request.url);
		const originalRequestUrl = new URL(
			// Remove the hash part of the URL as it's not meant for the server.
			request.url.split('#')[0],
			isAbsolute ? undefined : DEFAULT_BASE_URL
		);

		const rewrittenRequestUrl = this.#applyRewriteRules(originalRequestUrl);

		const siteRelativePath = removePathPrefix(
			decodeURIComponent(rewrittenRequestUrl.pathname),
			this.#pathname
		);
		let fsPath = this.#resolveToFsPath(siteRelativePath);

		if (this.#fs.isDir(fsPath)) {
			if (!siteRelativePath.endsWith('/')) {
				return {
					type: 'redirect',
					statusCode: 301,
					headers: {
						location: [`${rewrittenRequestUrl.pathname}/`],
					},
				};
			}

			for (const possibleIndexFile of ['index.php', 'index.html']) {
				const possibleIndexPath = joinPaths(fsPath, possibleIndexFile);
				if (this.#fs.isFile(possibleIndexPath)) {
					fsPath = possibleIndexPath;
					rewrittenRequestUrl.pathname = joinPaths(
						rewrittenRequestUrl.pathname,
						possibleIndexFile
					);
					break;
				}
			}
		}

		if (!this.#fs.isFile(fsPath)) {
			// Try resolving a partial path (e.g., /file.php/path-info)
			let pathToTry = siteRelativePath;
			while (
				pathToTry.startsWith('/') &&
				pathToTry !== dirname(pathToTry)
			) {
				pathToTry = dirname(pathToTry);
				const resolvedPathToTry = this.#resolveToFsPath(pathToTry);
				if (
					this.#fs.isFile(resolvedPathToTry) &&
					resolvedPathToTry.endsWith('.php')
				) {
					fsPath = this.#resolveToFsPath(pathToTry);
					break;
				}
			}
		}

		if (!this.#fs.isFile(fsPath)) {
			const fileNotFoundAction = this.#getFileNotFoundAction(
				rewrittenRequestUrl.pathname
			);
			switch (fileNotFoundAction.type) {
				case 'response':
					return {
						type: 'response',
						response: fileNotFoundAction.response,
					};
				case 'internal-redirect':
					fsPath = joinPaths(
						this.#documentRoot,
						fileNotFoundAction.uri
					);
					break;
				case '404':
					return { type: '404' };
				default:
					throw new Error(
						'Unsupported file-not-found action type: ' +
							`'${
								(fileNotFoundAction as FileNotFoundAction).type
							}'`
					);
			}
		}

		if (this.#fs.isFile(fsPath)) {
			if (fsPath.endsWith('.php')) {
				return {
					type: 'php',
					fsPath,
					originalRequestUrl,
					rewrittenRequestUrl,
				};
			} else {
				return { type: 'static-file', fsPath };
			}
		}

		return { type: '404' };
	}

	#applyRewriteRules(originalRequestUrl: URL): URL {
		const siteRelativePath = removePathPrefix(
			decodeURIComponent(originalRequestUrl.pathname),
			this.#pathname
		);
		const rewrittenRequestPath = applyRewriteRules(
			siteRelativePath,
			this.#rewriteRules
		);
		const rewrittenRequestUrl = new URL(
			joinPaths(this.#pathname, rewrittenRequestPath),
			originalRequestUrl.toString()
		);
		for (const [key, value] of originalRequestUrl.searchParams.entries()) {
			rewrittenRequestUrl.searchParams.append(key, value);
		}
		return rewrittenRequestUrl;
	}

	#resolveToFsPath(urlPath: string): string {
		for (const alias of this.#pathAliases) {
			if (
				urlPath === alias.urlPrefix ||
				urlPath.startsWith(alias.urlPrefix + '/')
			) {
				const relativePath = urlPath.slice(alias.urlPrefix.length);
				return joinPaths(alias.fsPath, relativePath);
			}
		}
		return joinPaths(this.#documentRoot, urlPath);
	}
}

/**
 * Checks if the given URL looks like an absolute URL.
 *
 * @param url - The URL to check.
 * @returns `true` if the URL looks like an absolute URL, `false` otherwise.
 */
function looksLikeAbsoluteUrl(url: string): boolean {
	try {
		// NOTE: We could just use URL.canParse() but are avoiding it here
		// because we've seen users with older Safari versions that don't support it.
		// Maybe Playground will break in other ways for them,
		// but since this is an easy, low-risk change, let's give it a try.
		new URL(url);
		return true;
	} catch {
		return false;
	}
}
