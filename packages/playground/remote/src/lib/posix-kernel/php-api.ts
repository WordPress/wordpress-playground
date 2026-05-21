/**
 * `LimitedPHPApi`-shaped surface against the kernel-resident WordPress
 * in the browser. Mirror of the CLI's
 * `packages/playground/cli/src/posix-kernel/php-api.ts` — same public
 * methods, same `defineConstant` mu-plugin scheme, same cookie jar.
 * Storage is the difference:
 *
 *   - CLI: Node `fs` + `runtime.spawnCapturing(php.wasm, …)`.
 *   - Browser: `KernelSpawnAdapter` (coreutils-spawn for FS ops,
 *     `php.wasm` spawn for `run()`) + the `HttpBridgeHost` request
 *     sender for `request()`.
 *
 * The browser methods are async because every spawn is a round-trip
 * through `kernel.spawn`. Comlink already wraps the consumer-facing
 * Promise either way, so callers (blueprint v1's step runners) see no
 * difference between the CLI's sync methods and our async ones.
 */

import type {
	ListFilesOptions,
	PHPRequest,
	PHPRunOptions,
	RmDirOptions,
} from '@php-wasm/universal';
import { PHPResponse } from '@php-wasm/universal';
import { removeURLScope } from '@php-wasm/scopes';
import { dirname, joinPaths } from '@php-wasm/util';

import type { HttpRequest, HttpResponse } from './host-bridge';
import type { KernelSpawnAdapter } from './kernel-spawn-adapter';
import type { CookieJar } from './cookie-jar';

import DEFINES_MU_PLUGIN_PHP from './wp-templates/playground-defines.php?raw';

/**
 * Where WordPress lives inside the kernel VFS — set by
 * `vfs-builder.ts`'s `extractZipInto(fs, '/var/www/html', wpZip, …)`.
 * Blueprint v1 step source typically embeds the literal `/wordpress`
 * (carried over from classic Playground), so {@link translateVfsPathsInCode}
 * rewrites those occurrences to this constant before the code is fed
 * to `php -r`.
 */
const VFS_DOCUMENT_ROOT = '/var/www/html';

/**
 * The classic Playground convention: blueprint v1 step source addresses
 * the WordPress root as `/wordpress`. We rewrite to {@link VFS_DOCUMENT_ROOT}
 * only when the literal sits on a fresh path token (lookbehind guards
 * against double-rewriting paths already terminated by `/wordpress`).
 * Same pattern as the CLI's `php-api.ts`.
 */
const VFS_DOCROOT_IN_CODE = /(?<![\w/-])\/wordpress(?=$|[/"'`\s\\,;:)$])/g;

export interface KernelLimitedPHPApiOptions {
	absoluteUrl: string;
	adapter: KernelSpawnAdapter;
	sendRequest: (request: HttpRequest) => Promise<HttpResponse>;
	/**
	 * Shared cookie jar — the SW-driven `requestStreamed` flow and the
	 * blueprint `playground.request(...)` flow both update the same jar
	 * so the iframe and blueprint code see a consistent session. The
	 * jar is owned by {@link KernelPlaygroundWorkerEndpoint} and passed
	 * in here; see `cookie-jar.ts` for why we maintain it in JS rather
	 * than relying on Chrome's cookie store.
	 */
	cookieJar: CookieJar;
}

export class KernelLimitedPHPApi {
	readonly absoluteUrl: string;
	private readonly adapter: KernelSpawnAdapter;
	private readonly sendRequest: (
		request: HttpRequest
	) => Promise<HttpResponse>;
	private readonly cookieJar: CookieJar;
	private readonly constants = new Map<
		string,
		string | number | boolean | null
	>();
	private readonly definesPluginPath = joinPaths(
		VFS_DOCUMENT_ROOT,
		'wp-content/mu-plugins/0-playground-defines.php'
	);
	private readonly definesStorePath = joinPaths(
		VFS_DOCUMENT_ROOT,
		'wp-content/mu-plugins/0-playground-defines.json'
	);

	constructor(options: KernelLimitedPHPApiOptions) {
		this.absoluteUrl = options.absoluteUrl;
		this.adapter = options.adapter;
		this.sendRequest = options.sendRequest;
		this.cookieJar = options.cookieJar;
	}

	async mkdir(path: string): Promise<void> {
		await this.adapter.mkdir(this.toVfs(path));
	}

	/**
	 * Identical to {@link mkdir} — `coreutils mkdir -p` is already
	 * recursive and no-fail on existing dirs. Mirrors the CLI shim,
	 * which collapses `mkdir` / `mkdirTree` to the same `mkdirSync`
	 * with `recursive: true`.
	 */
	async mkdirTree(path: string): Promise<void> {
		await this.adapter.mkdir(this.toVfs(path));
	}

	async readFileAsText(path: string): Promise<string> {
		return this.adapter.readFileAsText(this.toVfs(path));
	}

	async readFileAsBuffer(path: string): Promise<Uint8Array> {
		return this.adapter.readFileAsBuffer(this.toVfs(path));
	}

	async writeFile(path: string, data: string | Uint8Array): Promise<void> {
		const target = this.toVfs(path);
		// `tee` doesn't create parent dirs; blueprint steps frequently
		// write into freshly-created paths. Match the CLI shim's
		// implicit `mkdir -p` before `writeFileSync`.
		await this.adapter.mkdir(dirname(target));
		await this.adapter.writeFile(target, data);
	}

	async unlink(path: string): Promise<void> {
		await this.adapter.unlink(this.toVfs(path));
	}

	async mv(fromPath: string, toPath: string): Promise<void> {
		await this.adapter.mv(this.toVfs(fromPath), this.toVfs(toPath));
	}

	async rmdir(path: string, options?: RmDirOptions): Promise<void> {
		const recursive = options?.recursive !== false;
		await this.adapter.rmdir(this.toVfs(path), recursive);
	}

	async listFiles(
		path: string,
		options?: ListFilesOptions
	): Promise<string[]> {
		const entries = await this.adapter.listFiles(this.toVfs(path));
		if (options?.prependPath) {
			return entries.map((name) => joinPaths(path, name));
		}
		return entries;
	}

	async isDir(path: string): Promise<boolean> {
		return this.adapter.isDir(this.toVfs(path));
	}

	async fileExists(path: string): Promise<boolean> {
		return this.adapter.fileExists(this.toVfs(path));
	}

	/**
	 * No-op. Blueprint v1 callers expect `chdir` to be present but
	 * kernel-resident processes each get their own cwd through
	 * {@link run}'s `options.cwd`. The CLI shim doesn't implement it
	 * either; matching that omission keeps the surfaces aligned.
	 */
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async chdir(_path: string): Promise<void> {
		/* intentionally empty — see docstring */
	}

	async defineConstant(
		key: string,
		value: string | number | boolean | null
	): Promise<void> {
		this.constants.set(key, value);
		await this.regenerateDefinesPlugin();
	}

	async run(request: PHPRunOptions): Promise<PHPResponse> {
		const env = this.buildEnv(request.env);
		let argv: string[];
		let stdin: Uint8Array | undefined;

		if (request.code !== undefined) {
			let code = request.code;
			if (code.startsWith('<?php')) {
				code = code.slice('<?php'.length);
			}
			code = this.serializeConstantsForEval() + code;
			code = this.translateVfsPathsInCode(code);
			argv = ['php', '-d', 'display_errors=stderr', '-r', code];
		} else if (request.scriptPath !== undefined) {
			argv = [
				'php',
				'-d',
				'display_errors=stderr',
				this.toVfs(request.scriptPath),
			];
		} else {
			throw new Error(
				'KernelLimitedPHPApi.run: either `code` or `scriptPath` must be set.'
			);
		}

		if (request.body !== undefined) {
			stdin =
				typeof request.body === 'string'
					? new TextEncoder().encode(request.body)
					: request.body;
		}

		const { exitCode, stdout, stderr } = await this.adapter.runPhpCli({
			argv,
			env,
			cwd: VFS_DOCUMENT_ROOT,
			stdin,
		});

		return new PHPResponse(
			200,
			{},
			stdout,
			new TextDecoder().decode(stderr),
			exitCode
		);
	}

	async request(request: PHPRequest): Promise<PHPResponse> {
		// Blueprint steps build URLs by appending paths to
		// `this.absoluteUrl`, which is the scoped iframe URL. The
		// kernel-resident nginx has no notion of scopes, so strip
		// `/scope:<id>/` before forwarding — same logic as the worker
		// endpoint's `requestStreamed`.
		const resolved = new URL(request.url, this.absoluteUrl);
		const unscoped = removeURLScope(resolved).toString();

		const headers = flattenAndLowercase(request.headers);
		const cookieHeader = this.cookieJar.serialize();
		if (cookieHeader && !('cookie' in headers)) {
			headers['cookie'] = cookieHeader;
		}

		const body = encodeBody(request.body);

		const bridgeResponse = await this.sendRequest({
			method: request.method ?? 'GET',
			url: unscoped,
			headers,
			body,
		});

		// `set-cookie` arrives as a single joined string from the
		// bridge (HttpResponse uses `Record<string, string>`). The jar
		// re-separates and ingests each cookie; we keep the split list
		// to re-emit per-cookie entries in the response headers.
		const setCookies = this.cookieJar.ingestAll(
			bridgeResponse.headers['set-cookie'] ??
				bridgeResponse.headers['Set-Cookie']
		);

		const responseHeaders: Record<string, string[]> = {};
		for (const [name, value] of Object.entries(bridgeResponse.headers)) {
			const key = name.toLowerCase();
			if (key === 'set-cookie' && setCookies.length > 0) {
				continue; // populated below
			}
			if (!(key in responseHeaders)) {
				responseHeaders[key] = [];
			}
			responseHeaders[key].push(value);
		}
		if (setCookies.length > 0) {
			responseHeaders['set-cookie'] = setCookies;
		}

		return new PHPResponse(
			bridgeResponse.status,
			responseHeaders,
			bridgeResponse.body,
			'',
			0
		);
	}

	private async regenerateDefinesPlugin(): Promise<void> {
		const entries: Record<string, string | number | boolean | null> = {};
		for (const [k, v] of this.constants.entries()) {
			entries[k] = v;
		}
		await this.adapter.mkdir(dirname(this.definesPluginPath));
		await this.adapter.writeFile(
			this.definesStorePath,
			JSON.stringify(entries, null, 2)
		);
		await this.adapter.writeFile(
			this.definesPluginPath,
			DEFINES_MU_PLUGIN_PHP
		);
	}

	/**
	 * Prepend `define(...)` calls for every tracked constant to PHP
	 * code passed to `run()`. Without this, blueprint steps that read
	 * a constant set earlier (e.g. `WP_AUTO_LOGIN_USER` from `login`)
	 * see an undefined symbol — `php -r` spawns a fresh process every
	 * time and the mu-plugin only runs for HTTP requests through
	 * php-fpm, not for one-off CLI invocations.
	 */
	private serializeConstantsForEval(): string {
		if (this.constants.size === 0) {
			return '';
		}
		const lines: string[] = [];
		for (const [k, v] of this.constants.entries()) {
			lines.push(
				`if (!defined(${phpString(k)})) { define(${phpString(
					k
				)}, ${phpLiteral(v)}); }`
			);
		}
		return lines.join('\n') + '\n';
	}

	private buildEnv(extra?: Record<string, string>): string[] {
		const env: Record<string, string> = {
			HOME: '/tmp',
			PATH: '/usr/local/bin:/usr/bin:/bin',
			DOCROOT: VFS_DOCUMENT_ROOT,
		};
		if (extra) {
			for (const [k, v] of Object.entries(extra)) {
				env[k] = this.translateVfsPathsInCode(v);
			}
		}
		return Object.entries(env).map(([k, v]) => `${k}=${v}`);
	}

	private translateVfsPathsInCode(code: string): string {
		return code.replace(VFS_DOCROOT_IN_CODE, VFS_DOCUMENT_ROOT);
	}

	/**
	 * Translate from the classic Playground convention (`/wordpress`)
	 * to the kernel VFS docroot (`/var/www/html`). Paths that don't
	 * begin with `/wordpress` pass through unchanged so absolute VFS
	 * paths supplied by blueprint steps still work.
	 */
	private toVfs(path: string): string {
		if (path === '/wordpress') {
			return VFS_DOCUMENT_ROOT;
		}
		if (path.startsWith('/wordpress/')) {
			return joinPaths(
				VFS_DOCUMENT_ROOT,
				path.slice('/wordpress'.length)
			);
		}
		return path;
	}
}

function flattenAndLowercase(
	headers: Record<string, string> | undefined
): Record<string, string> {
	if (!headers) {
		return {};
	}
	const out: Record<string, string> = {};
	for (const [k, v] of Object.entries(headers)) {
		out[k.toLowerCase()] = v;
	}
	return out;
}

/**
 * Coerce `PHPRequest.body` into the bridge's `Uint8Array | null` shape.
 * Mirrors `encodeRequestBody` in `playground-worker-endpoint.ts`; the
 * multipart object form (uploads from blueprints v1) is rejected the
 * same way — first reachable from `installPlugin` which we'll wire when
 * v1 starts running.
 */
function encodeBody(body: PHPRequest['body']): Uint8Array | null {
	if (body === undefined) {
		return null;
	}
	if (typeof body === 'string') {
		return new TextEncoder().encode(body);
	}
	if (body instanceof Uint8Array) {
		return body;
	}
	throw new Error(
		'KernelLimitedPHPApi.request: multipart `body` objects are not ' +
			'supported in the kernel-mode worker yet.'
	);
}

function phpString(value: string): string {
	return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function phpLiteral(value: string | number | boolean | null): string {
	if (value === null) {
		return 'null';
	}
	if (typeof value === 'boolean') {
		return value ? 'true' : 'false';
	}
	if (typeof value === 'number') {
		if (!Number.isFinite(value)) {
			throw new Error(
				`KernelLimitedPHPApi.defineConstant: cannot serialize ` +
					`non-finite number ${value}.`
			);
		}
		return String(value);
	}
	return phpString(value);
}
