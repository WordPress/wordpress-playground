/**
 * `LimitedPHPApi`-shaped surface against the kernel-resident WordPress.
 *
 * Backed by host fs (the kernel uses host fs directly, so writing through
 * Node and reading inside the kernel hit the same bytes), HTTP fetch
 * against nginx, and `php.wasm` CLI processes spawned through the kernel
 * runtime. `defineConstant` regenerates a mu-plugin so blueprint v1's
 * `login` / `defineWpConfigConsts` / `setSiteLanguage` propagate to every
 * request without restarting php-fpm.
 */

import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	renameSync,
	rmSync,
	statSync,
	unlinkSync,
	writeFileSync,
} from 'node:fs';
import type {
	ListFilesOptions,
	PHPRequest,
	PHPRunOptions,
	RmDirOptions,
} from '@php-wasm/universal';
import { PHPResponse } from '@php-wasm/universal';
import { dirname, joinPaths, toPosixPath } from '@php-wasm/util';
import type { KernelRuntime } from './boot';

import DEFINES_MU_PLUGIN_PHP from './wp-templates/playground-defines.php?raw';

const VFS_DOCUMENT_ROOT = '/wordpress';

/**
 * Match `/wordpress` only when it begins a fresh path token. Lookbehind
 * keeps host paths whose last segment is `wordpress` from being rewritten
 * a second time (the kernel's WP install lives in a directory called
 * `wordpress`, and `documentRoot` reports that host path).
 */
const VFS_DOCROOT_IN_CODE = /(?<![\w/-])\/wordpress(?=$|[/"'`\s\\,;:)$])/g;

export interface KernelLimitedPHPApiOptions {
	serverUrl: string;
	wordPressRootHostPath: string;
	phpWasmPath: string;
	runtime: KernelRuntime;
}

export class KernelLimitedPHPApi {
	readonly absoluteUrl: string;
	/**
	 * The host doc-root, POSIX-shaped — `/Users/...` on macOS/Linux,
	 * `/C/Users/...` on Windows. Not the VFS literal `/wordpress`.
	 *
	 * Blueprint v1 steps embed `documentRoot` into PHP source via
	 * `phpVar`, which base64-encodes the value past
	 * `translateVfsPathsInCode`'s rewrite. The embedded value is then
	 * resolved by PHP running inside the kernel, whose musl-libc
	 * `path[0] == '/'` "absolute" check rejects native `C:\...` paths;
	 * the POSIX-shaped form passes that check and the kernel's
	 * `NodePlatformIO.rewritePath` translates it back for `fs.*`.
	 */
	readonly documentRoot: string;
	/**
	 * Native host path used by this class's own Node `fs.*` calls
	 * (read/write/mkdir/...). Equal to `documentRoot` on macOS/Linux;
	 * differs on Windows.
	 */
	private readonly hostRoot: string;
	private readonly runtime: KernelRuntime;
	private readonly phpWasmBytes: ArrayBuffer;
	private readonly cookieJar = new Map<string, string>();
	private readonly constants = new Map<
		string,
		string | number | boolean | null
	>();
	private readonly definesPluginPath: string;
	private readonly definesStorePath: string;

	constructor(options: KernelLimitedPHPApiOptions) {
		this.absoluteUrl = options.serverUrl;
		this.hostRoot = options.wordPressRootHostPath;
		this.documentRoot = toPosixPath(this.hostRoot);
		this.runtime = options.runtime;
		this.phpWasmBytes = readWasm(options.phpWasmPath);
		this.definesPluginPath = joinPaths(
			this.hostRoot,
			'wp-content/mu-plugins/0-playground-defines.php'
		);
		this.definesStorePath = joinPaths(
			this.hostRoot,
			'wp-content/mu-plugins/0-playground-defines.json'
		);
		// Reuse a previous run's defines store so the same set of
		// constants survives a CLI restart against a persisted doc root.
		if (existsSync(this.definesStorePath)) {
			try {
				const parsed = JSON.parse(
					readFileSync(this.definesStorePath, 'utf8')
				);
				if (parsed && typeof parsed === 'object') {
					for (const [k, v] of Object.entries(parsed)) {
						this.constants.set(k, v as any);
					}
				}
			} catch {
				/* malformed — start fresh */
			}
		}
	}

	mkdir(path: string): void {
		mkdirSync(this.toHost(path), { recursive: true });
	}

	readFileAsText(path: string): string {
		return readFileSync(this.toHost(path), 'utf8');
	}

	readFileAsBuffer(path: string): Uint8Array {
		const buf = readFileSync(this.toHost(path));
		return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
	}

	writeFile(path: string, data: string | Uint8Array): void {
		const target = this.toHost(path);
		mkdirSync(dirname(target), { recursive: true });
		writeFileSync(target, data);
	}

	unlink(path: string): void {
		unlinkSync(this.toHost(path));
	}

	mv(fromPath: string, toPath: string): void {
		renameSync(this.toHost(fromPath), this.toHost(toPath));
	}

	rmdir(path: string, options?: RmDirOptions): void {
		const recursive = options?.recursive !== false;
		rmSync(this.toHost(path), { recursive, force: true });
	}

	listFiles(path: string, options?: ListFilesOptions): string[] {
		const entries = readdirSync(this.toHost(path));
		if (options?.prependPath) {
			return entries.map((name) => joinPaths(path, name));
		}
		return entries;
	}

	isDir(path: string): boolean {
		try {
			return statSync(this.toHost(path)).isDirectory();
		} catch {
			return false;
		}
	}

	fileExists(path: string): boolean {
		return existsSync(this.toHost(path));
	}

	defineConstant(key: string, value: string | number | boolean | null): void {
		this.constants.set(key, value);
		this.regenerateDefinesPlugin();
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
				toPosixPath(this.toHost(request.scriptPath)),
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

		const { exitCode, stdout, stderr } = await this.runtime.spawnCapturing({
			programBytes: this.phpWasmBytes,
			argv,
			options: { env, cwd: this.documentRoot, stdin },
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
		const url = new URL(request.url, this.absoluteUrl).toString();
		const headers = new Headers(request.headers ?? {});
		const cookieHeader = this.serializeCookies();
		if (cookieHeader && !headers.has('cookie')) {
			headers.set('cookie', cookieHeader);
		}

		let body: BodyInit | undefined;
		if (request.body !== undefined) {
			if (typeof request.body === 'string') {
				body = request.body;
			} else if (request.body instanceof Uint8Array) {
				body = request.body as BodyInit;
			} else if (request.body && typeof request.body === 'object') {
				const form = new FormData();
				for (const [name, value] of Object.entries(request.body)) {
					if (value instanceof Uint8Array || value instanceof File) {
						form.append(name, new Blob([value as BlobPart]));
					} else {
						form.append(name, String(value));
					}
				}
				body = form;
			}
		}

		const fetchResponse = await fetch(url, {
			method: request.method ?? 'GET',
			headers,
			body,
			redirect: 'manual',
		});

		const setCookies = collectSetCookieHeaders(fetchResponse.headers);
		for (const raw of setCookies) {
			this.ingestSetCookie(raw);
		}

		const responseHeaders: Record<string, string[]> = {};
		fetchResponse.headers.forEach((value, name) => {
			const key = name.toLowerCase();
			if (!(key in responseHeaders)) {
				responseHeaders[key] = [];
			}
			responseHeaders[key].push(value);
		});
		if (setCookies.length > 0) {
			responseHeaders['set-cookie'] = setCookies;
		}

		const bytes = new Uint8Array(await fetchResponse.arrayBuffer());
		return new PHPResponse(
			fetchResponse.status,
			responseHeaders,
			bytes,
			'',
			0
		);
	}

	private regenerateDefinesPlugin(): void {
		const entries: Record<string, string | number | boolean | null> = {};
		for (const [k, v] of this.constants.entries()) {
			entries[k] = v;
		}
		mkdirSync(dirname(this.definesPluginPath), { recursive: true });
		writeFileSync(this.definesStorePath, JSON.stringify(entries, null, 2));
		writeFileSync(this.definesPluginPath, DEFINES_MU_PLUGIN_PHP);
	}

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
			DOCROOT: this.documentRoot,
		};
		if (extra) {
			for (const [k, v] of Object.entries(extra)) {
				env[k] = this.translateVfsPathsInCode(v);
			}
		}
		return Object.entries(env).map(([k, v]) => `${k}=${v}`);
	}

	private translateVfsPathsInCode(code: string): string {
		return code.replace(VFS_DOCROOT_IN_CODE, this.documentRoot);
	}

	private serializeCookies(): string {
		if (this.cookieJar.size === 0) {
			return '';
		}
		return Array.from(this.cookieJar.entries())
			.map(([k, v]) => `${k}=${v}`)
			.join('; ');
	}

	private ingestSetCookie(raw: string): void {
		const segments = raw.split(';');
		const first = segments[0]?.trim();
		if (!first) {
			return;
		}
		const eq = first.indexOf('=');
		if (eq === -1) {
			return;
		}
		const name = first.slice(0, eq).trim();
		const value = first.slice(eq + 1).trim();
		const isExpired = segments.slice(1).some((seg) => {
			const trimmed = seg.trim().toLowerCase();
			if (trimmed.startsWith('max-age=')) {
				const n = Number(trimmed.slice('max-age='.length));
				return Number.isFinite(n) && n <= 0;
			}
			if (trimmed.startsWith('expires=')) {
				const d = Date.parse(trimmed.slice('expires='.length));
				return Number.isFinite(d) && d <= Date.now();
			}
			return false;
		});
		if (isExpired) {
			this.cookieJar.delete(name);
		} else {
			this.cookieJar.set(name, value);
		}
	}

	private toHost(vfsPath: string): string {
		if (vfsPath === VFS_DOCUMENT_ROOT) {
			return this.hostRoot;
		}
		if (vfsPath.startsWith(VFS_DOCUMENT_ROOT + '/')) {
			return joinPaths(
				this.hostRoot,
				vfsPath.slice(VFS_DOCUMENT_ROOT.length)
			);
		}
		return vfsPath;
	}
}

function readWasm(path: string): ArrayBuffer {
	const buf = readFileSync(path);
	return buf.buffer.slice(
		buf.byteOffset,
		buf.byteOffset + buf.byteLength
	) as ArrayBuffer;
}

function collectSetCookieHeaders(headers: Headers): string[] {
	// Node 24's Headers exposes a non-standard getSetCookie() that
	// preserves duplicates; fall back to splitting on `, <token>=` for
	// older runtimes.
	const anyHeaders = headers as unknown as {
		getSetCookie?: () => string[];
	};
	if (typeof anyHeaders.getSetCookie === 'function') {
		return anyHeaders.getSetCookie();
	}
	const joined = headers.get('set-cookie');
	if (!joined) {
		return [];
	}
	return joined.split(/,(?=\s*[A-Za-z0-9!#$%&'*+\-.^_`|~]+=)/);
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
				`KernelLimitedPHPApi.defineConstant: cannot serialize non-finite number ${value}.`
			);
		}
		return String(value);
	}
	return phpString(value);
}
