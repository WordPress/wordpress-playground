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
import { dirname, isParentOf, joinPaths, phpVar } from '@php-wasm/util';
import { KERNEL_DOCUMENT_ROOT, type KernelRuntime } from './boot';
import { readWasm } from './host-bridge';

import DEFINES_MU_PLUGIN_PHP from './wp-templates/playground-defines.php?raw';

const REQUEST_TIMEOUT_MS = 630_000;

const S_IFMT = 0o170000;
const S_IFDIR = 0o040000;

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
	phpWasmPath: string;
	runtime: KernelRuntime;
}

export class KernelLimitedPHPApi {
	readonly absoluteUrl: string;
	readonly documentRoot = KERNEL_DOCUMENT_ROOT;
	private readonly port: number;
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
		this.port = Number(new URL(options.serverUrl).port);
		this.hostRoot = options.wordPressRootHostPath;
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

	async mkdir(path: string): Promise<void> {
		if (this.isHostPath(path)) {
			mkdirSync(this.toHost(path), { recursive: true });
			return;
		}
		await this.runInKernel(
			`$path = ${phpVar(path)};
			if (!is_dir($path) && !mkdir($path, 0777, true)) exit(1);`
		);
	}

	async readFileAsText(path: string): Promise<string> {
		return new TextDecoder().decode(await this.readFileAsBuffer(path));
	}

	async readFileAsBuffer(path: string): Promise<Uint8Array> {
		if (this.isHostPath(path)) {
			const buf = readFileSync(this.toHost(path));
			return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
		}
		const bytes = await this.runtime.kernelHost.readFileFromVfs(path);
		if (bytes === null) {
			throw new Error(
				`Could not read ${path}: no such file in the kernel.`
			);
		}
		return bytes;
	}

	async writeFile(path: string, data: string | Uint8Array): Promise<void> {
		if (this.isHostPath(path)) {
			const target = this.toHost(path);
			mkdirSync(dirname(target), { recursive: true });
			writeFileSync(target, data);
			return;
		}
		if (!(await this.isDir(dirname(path)))) {
			await this.mkdir(dirname(path));
		}
		await this.runtime.kernelHost.writeFileToVfs(
			path,
			typeof data === 'string' ? new TextEncoder().encode(data) : data
		);
	}

	async unlink(path: string): Promise<void> {
		if (this.isHostPath(path)) {
			unlinkSync(this.toHost(path));
			return;
		}
		await this.runInKernel(`if (!unlink(${phpVar(path)})) exit(1);`);
	}

	async mv(fromPath: string, toPath: string): Promise<void> {
		if (this.isHostPath(fromPath) && this.isHostPath(toPath)) {
			renameSync(this.toHost(fromPath), this.toHost(toPath));
			return;
		}
		await this.runInKernel(
			`if (!rename(${phpVar(fromPath)}, ${phpVar(toPath)})) exit(1);`
		);
	}

	async rmdir(path: string, options?: RmDirOptions): Promise<void> {
		const recursive = options?.recursive !== false;
		if (this.isHostPath(path)) {
			rmSync(this.toHost(path), { recursive, force: true });
			return;
		}
		await this.runInKernel(
			`$path = ${phpVar(path)};
			if (!is_dir($path) || is_link($path)) exit(0);
			if (${recursive ? 'true' : 'false'}) {
				$entries = new RecursiveIteratorIterator(
					new RecursiveDirectoryIterator($path, FilesystemIterator::SKIP_DOTS),
					RecursiveIteratorIterator::CHILD_FIRST
				);
				foreach ($entries as $entry) {
					$entry->isDir() && !$entry->isLink()
						? rmdir($entry->getPathname())
						: unlink($entry->getPathname());
				}
			}
			if (!rmdir($path)) exit(1);`
		);
	}

	async listFiles(
		path: string,
		options?: ListFilesOptions
	): Promise<string[]> {
		const names = await this.readDirNames(path);
		if (options?.prependPath) {
			return names.map((name) => joinPaths(path, name));
		}
		return names;
	}

	async isDir(path: string): Promise<boolean> {
		if (this.isHostPath(path)) {
			try {
				return statSync(this.toHost(path)).isDirectory();
			} catch {
				return false;
			}
		}
		const stat = await this.runtime.kernelHost.statVfsPath(path);
		return stat !== null && (stat.mode & S_IFMT) === S_IFDIR;
	}

	async fileExists(path: string): Promise<boolean> {
		if (this.isHostPath(path)) {
			return existsSync(this.toHost(path));
		}
		return (await this.runtime.kernelHost.statVfsPath(path)) !== null;
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
				request.scriptPath,
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
				if (value instanceof File) {
					form.append(name, value, value.name);
				} else if (value instanceof Uint8Array) {
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
			...extra,
		};
		return Object.entries(env).map(([k, v]) => `${k}=${v}`);
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

	private async readDirNames(path: string): Promise<string[]> {
		if (this.isHostPath(path)) {
			return readdirSync(this.toHost(path));
		}
		const entries = await this.runtime.kernelHost.readDirFromVfs(path);
		if (entries === null) {
			throw new Error(
				`Could not list ${path}: no such directory in the kernel.`
			);
		}
		return entries.map((entry) => entry.name);
	}

	private async runInKernel(code: string): Promise<void> {
		await this.run({ code: `<?php ${code}` });
	}

	private isHostPath(path: string): boolean {
		return isParentOf(KERNEL_DOCUMENT_ROOT, path);
	}

	private toHost(path: string): string {
		return joinPaths(
			this.hostRoot,
			path.slice(KERNEL_DOCUMENT_ROOT.length)
		);
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
