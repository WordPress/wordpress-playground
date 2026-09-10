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
import { logger } from '@php-wasm/logger';
import { dirname, joinPaths } from '@php-wasm/util';
import type { KernelRuntime } from './boot';
import { readWasm } from './host-bridge';

import DEFINES_MU_PLUGIN_PHP from './wp-templates/playground-defines.php?raw';

const VFS_DOCUMENT_ROOT = '/wordpress';

const VFS_TEMP_DIR = '/tmp';
const VFS_TEMP_SUBDIR = 'vfs-tmp';

const REQUEST_TIMEOUT_MS = 630_000;

const VFS_PATHS_IN_CODE =
	/(?<![\w/-])(\/wordpress|\/tmp)(?=$|[/"'`\s\\,;:)$])/g;

const PHP_EXTENSION_ARGS = [
	'-d',
	'extension_dir=/usr/lib/php/extensions',
	'-d',
	'extension=zip.so',
	'-d',
	'extension=curl.so',
	'-d',
	'extension=phar.so',
	'-d',
	'curl.cainfo=/etc/ssl/certs/ca-certificates.crt',
	'-d',
	'zend.max_allowed_stack_size=131072',
];

export interface KernelLimitedPHPApiOptions {
	serverUrl: string;
	wordPressRootHostPath: string;
	wordPressRootKernelPath: string;
	tempDirHostPath: string;
	tempDirKernelPath: string;
	phpWasmPath: string;
	runtime: KernelRuntime;
}

export class KernelLimitedPHPApi {
	readonly absoluteUrl: string;
	readonly documentRoot: string;
	private readonly port: number;
	private readonly hostRoot: string;
	private readonly tempDirKernelRoot: string;
	private readonly vfsTempHostPath: string;
	private readonly vfsTempKernelPath: string;
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
		this.port = Number(new URL(options.serverUrl).port);
		this.hostRoot = options.wordPressRootHostPath;
		this.documentRoot = options.wordPressRootKernelPath;
		this.tempDirKernelRoot = options.tempDirKernelPath;
		this.vfsTempHostPath = joinPaths(
			options.tempDirHostPath,
			VFS_TEMP_SUBDIR
		);
		this.vfsTempKernelPath = joinPaths(
			options.tempDirKernelPath,
			VFS_TEMP_SUBDIR
		);
		mkdirSync(this.vfsTempHostPath, { recursive: true });
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

		for (const [k, v] of Object.entries(this.readDefinesStore())) {
			this.constants.set(k, v as string | number | boolean | null);
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
			argv = [
				'php',
				...PHP_EXTENSION_ARGS,
				'-d',
				'display_errors=stderr',
				'-r',
				code,
			];
		} else if (request.scriptPath !== undefined) {
			argv = [
				'php',
				...PHP_EXTENSION_ARGS,
				'-d',
				'display_errors=stderr',
				this.toKernel(request.scriptPath),
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

		const response = new PHPResponse(
			200,
			{},
			stdout,
			new TextDecoder().decode(stderr),
			exitCode
		);

		if (exitCode !== 0) {
			throw new Error(
				`PHP.run() failed with exit code ${exitCode}. \n\n=== Stdout ===\n ` +
					`${response.text}\n\n=== Stderr ===\n ${response.errors}`
			);
		}
		return response;
	}

	async request(request: PHPRequest): Promise<PHPResponse> {
		const url = new URL(request.url, this.absoluteUrl);
		const headers: Record<string, string> = { host: url.host };
		for (const [name, value] of Object.entries(request.headers ?? {})) {
			headers[name.toLowerCase()] = value;
		}
		const cookieHeader = this.serializeCookies();
		if (cookieHeader && !('cookie' in headers)) {
			headers['cookie'] = cookieHeader;
		}

		let body: Uint8Array | null = null;
		if (typeof request.body === 'string') {
			body = new TextEncoder().encode(request.body);
		} else if (request.body instanceof Uint8Array) {
			body = request.body;
		} else if (request.body && typeof request.body === 'object') {
			const form = new FormData();
			for (const [name, value] of Object.entries(request.body)) {
				if (value instanceof Uint8Array || value instanceof File) {
					form.append(name, new Blob([value as BlobPart]));
				} else {
					form.append(name, String(value));
				}
			}

			const encoded = new Response(form);

			headers['content-type'] =
				encoded.headers.get('content-type') ?? 'multipart/form-data';

			body = new Uint8Array(await encoded.arrayBuffer());
		}

		const kernelResponse = await this.runtime.kernelHost.fetchInKernel(
			this.port,
			{
				method: request.method ?? 'GET',
				url: url.pathname + url.search,
				headers,
				body,
			},
			{ timeoutMs: REQUEST_TIMEOUT_MS }
		);

		if (kernelResponse.status === 504) {
			logger.warn(
				`Request to ${url} timed out at the gateway (HTTP 504): ` +
					`PHP-FPM did not respond within nginx's ` +
					`fastcgi_read_timeout. This is a timeout, not a PHP error.`
			);
		}

		const responseHeaders: Record<string, string[]> = {};
		for (const [name, value] of Object.entries(kernelResponse.headers)) {
			const key = name.toLowerCase();

			responseHeaders[key] =
				key === 'set-cookie' ? value.split('\n') : [value];
		}
		for (const raw of responseHeaders['set-cookie'] ?? []) {
			this.ingestSetCookie(raw);
		}

		return new PHPResponse(
			kernelResponse.status,
			responseHeaders,
			kernelResponse.body,
			'',
			0
		);
	}

	private readDefinesStore(): Record<string, unknown> {
		if (!existsSync(this.definesStorePath)) {
			return {};
		}
		try {
			const parsed = JSON.parse(
				readFileSync(this.definesStorePath, 'utf8')
			);
			if (parsed && typeof parsed === 'object') {
				return parsed;
			}
		} catch {
			logger.debug(
				`[posix-kernel] Ignoring malformed defines store at ` +
					`${this.definesStorePath}.`
			);
		}
		return {};
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
			WP_CLI_ALLOW_ROOT: '1',
		};
		if (extra) {
			for (const [k, v] of Object.entries(extra)) {
				env[k] = this.translateVfsPathsInCode(v);
			}
		}
		return Object.entries(env).map(([k, v]) => `${k}=${v}`);
	}

	private translateVfsPathsInCode(code: string): string {
		return code.replace(
			VFS_PATHS_IN_CODE,
			(match, _root, offset: number, whole: string) => {
				if (match === VFS_DOCUMENT_ROOT) {
					return this.documentRoot;
				}
				if (whole.startsWith(this.tempDirKernelRoot, offset)) {
					return match;
				}
				return this.vfsTempKernelPath;
			}
		);
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

		if (vfsPath === this.documentRoot) {
			return this.hostRoot;
		}
		if (vfsPath.startsWith(this.documentRoot + '/')) {
			return joinPaths(
				this.hostRoot,
				vfsPath.slice(this.documentRoot.length)
			);
		}
		if (vfsPath === VFS_TEMP_DIR) {
			return this.vfsTempHostPath;
		}
		if (vfsPath.startsWith(VFS_TEMP_DIR + '/')) {
			return joinPaths(
				this.vfsTempHostPath,
				vfsPath.slice(VFS_TEMP_DIR.length)
			);
		}
		return vfsPath;
	}

	private toKernel(vfsPath: string): string {
		if (vfsPath === VFS_DOCUMENT_ROOT) {
			return this.documentRoot;
		}
		if (vfsPath.startsWith(VFS_DOCUMENT_ROOT + '/')) {
			return joinPaths(
				this.documentRoot,
				vfsPath.slice(VFS_DOCUMENT_ROOT.length)
			);
		}
		if (
			vfsPath === this.tempDirKernelRoot ||
			vfsPath.startsWith(this.tempDirKernelRoot + '/')
		) {
			return vfsPath;
		}
		if (vfsPath === VFS_TEMP_DIR) {
			return this.vfsTempKernelPath;
		}
		if (vfsPath.startsWith(VFS_TEMP_DIR + '/')) {
			return joinPaths(
				this.vfsTempKernelPath,
				vfsPath.slice(VFS_TEMP_DIR.length)
			);
		}
		return vfsPath;
	}
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
