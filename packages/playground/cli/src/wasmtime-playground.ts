import { randomUUID } from 'node:crypto';
import { lstatSync, realpathSync } from 'node:fs';
import {
	chmod,
	cp,
	lstat,
	mkdir,
	readFile,
	readdir,
	readlink,
	realpath,
	rename,
	rm,
	stat,
	symlink,
	unlink,
	writeFile,
} from 'node:fs/promises';
import { dirname, isAbsolute, posix, relative, resolve, sep } from 'node:path';
import {
	PHPResponse,
	StreamedPHPResponse,
	type PHPRequest,
	type PHPRunOptions,
} from '@php-wasm/universal';

export type WasmtimeVfsMount = {
	hostPath: string;
	vfsPath: string;
};

type WasmtimePlaygroundOptions = {
	serverUrl: string;
	siteUrl: string;
	mounts: WasmtimeVfsMount[];
	assertActive: () => void;
};

export interface WasmtimePlaygroundFacade {
	readonly absoluteUrl: Promise<string>;
	readonly documentRoot: Promise<string>;
	request(request: PHPRequest): Promise<PHPResponse>;
	requestStreamed(request: PHPRequest): Promise<StreamedPHPResponse>;
	run(request: PHPRunOptions): Promise<PHPResponse>;
	cli(
		argv: string[],
		options?: { env?: Record<string, string> }
	): Promise<never>;
	mkdir(path: string): Promise<void>;
	mkdirTree(path: string): Promise<void>;
	readFileAsText(path: string): Promise<string>;
	readFileAsBuffer(path: string): Promise<Uint8Array>;
	writeFile(path: string, data: string | Uint8Array): Promise<void>;
	unlink(path: string): Promise<void>;
	mv(fromPath: string, toPath: string): Promise<void>;
	cp(fromPath: string, toPath: string): Promise<void>;
	rmdir(path: string, options?: { recursive?: boolean }): Promise<void>;
	listFiles(
		path: string,
		options?: { prependPath?: boolean }
	): Promise<string[]>;
	isDir(path: string): Promise<boolean>;
	isFile(path: string): Promise<boolean>;
	fileExists(path: string): Promise<boolean>;
	chmod(path: string, mode: number): Promise<void>;
	symlink(target: string, path: string): Promise<void>;
	isSymlink(path: string): Promise<boolean>;
	readlink(path: string): Promise<string>;
	realpath(path: string): Promise<string>;
}

/**
 * Creates the programmatic PHP/VFS facade backed by the Wasmtime host mounts.
 *
 * The Wasmtime host uses shared host directories for mounted paths, so this
 * asynchronous facade performs VFS operations against those same files and
 * sends requests to the running server.
 */
export function createWasmtimePlayground(
	options: WasmtimePlaygroundOptions
): WasmtimePlaygroundFacade {
	return new WasmtimePlayground(options);
}

class WasmtimePlayground implements WasmtimePlaygroundFacade {
	readonly absoluteUrl: Promise<string>;
	readonly documentRoot = Promise.resolve('/wordpress');
	private readonly options: WasmtimePlaygroundOptions;

	constructor(options: WasmtimePlaygroundOptions) {
		this.options = options;
		this.absoluteUrl = Promise.resolve(options.siteUrl);
	}

	async request(request: PHPRequest): Promise<PHPResponse> {
		const response = await this.fetchRequest(request);
		return new PHPResponse(
			response.status,
			responseHeaders(response.headers),
			new Uint8Array(await response.arrayBuffer())
		);
	}

	async requestStreamed(request: PHPRequest): Promise<StreamedPHPResponse> {
		const response = await this.fetchRequest(request);
		const headers = responseHeaders(response.headers);
		const headerLines = Object.entries(headers).flatMap(([name, values]) =>
			values.map((value) => `${name}: ${value}`)
		);
		const headersStream = byteStream(
			new TextEncoder().encode(
				JSON.stringify({
					status: response.status,
					headers: headerLines,
				})
			)
		);
		return new StreamedPHPResponse(
			headersStream,
			response.body ?? byteStream(),
			byteStream(),
			Promise.resolve(0)
		);
	}

	async run(request: PHPRunOptions): Promise<PHPResponse> {
		this.assertActive();
		if (request.env || request.$_SERVER) {
			throw unsupportedWasmtimePHPOption('run() environment overrides');
		}

		let temporaryPath: string | undefined;
		let requestPath: string;
		if (request.code !== undefined) {
			temporaryPath = `/wordpress/.wp-playground-wasmtime-run-${randomUUID()}.php`;
			const source = request.code.trimStart().startsWith('<?')
				? request.code
				: `<?php\n${request.code}`;
			await writeFile(this.hostPath(temporaryPath), source);
			requestPath = this.requestPathForScript(temporaryPath);
		} else if (request.scriptPath) {
			if (!(await this.fileExists(request.scriptPath))) {
				throw new Error(
					`The script path "${request.scriptPath}" does not exist.`
				);
			}
			requestPath = this.requestPathForScript(request.scriptPath);
		} else {
			throw new Error(
				'Wasmtime playground run() requires code or scriptPath.'
			);
		}

		try {
			if (request.relativeUri && request.relativeUri !== requestPath) {
				throw unsupportedWasmtimePHPOption(
					'run() relativeUri values different from the script path'
				);
			}
			return await this.request({
				url: requestPath,
				method: request.method,
				headers: request.headers,
				body: request.body,
			});
		} finally {
			if (temporaryPath) {
				await rm(this.hostPath(temporaryPath), { force: true });
			}
		}
	}

	async cli(): Promise<never> {
		this.assertActive();
		throw new Error(
			'The Wasmtime PHP component does not expose a CLI-session ABI, so playground.cli() is unavailable. Use @php-wasm/cli for standalone PHP scripts; playground.run() uses HTTP SAPI and is not a PHP CLI substitute.'
		);
	}

	async mkdir(path: string): Promise<void> {
		this.assertActive();
		await mkdir(this.hostPath(path));
	}

	async mkdirTree(path: string): Promise<void> {
		this.assertActive();
		await mkdir(this.hostPath(path), { recursive: true });
	}

	async readFileAsText(path: string): Promise<string> {
		this.assertActive();
		return await readFile(this.hostPath(path), 'utf8');
	}

	async readFileAsBuffer(path: string): Promise<Uint8Array> {
		this.assertActive();
		return new Uint8Array(await readFile(this.hostPath(path)));
	}

	async writeFile(path: string, data: string | Uint8Array): Promise<void> {
		this.assertActive();
		await writeFile(this.hostPath(path), data);
	}

	async unlink(path: string): Promise<void> {
		this.assertActive();
		await unlink(this.hostPath(path, { followFinalSymlink: false }));
	}

	async mv(fromPath: string, toPath: string): Promise<void> {
		this.assertActive();
		const from = this.hostPath(fromPath);
		const to = this.hostPath(toPath);
		try {
			await rename(from, to);
		} catch (error) {
			if (!isErrorWithCode(error, 'EXDEV')) {
				throw error;
			}
			const source = await stat(from);
			await cp(from, to, { recursive: source.isDirectory() });
			await rm(from, { recursive: source.isDirectory(), force: true });
		}
	}

	async cp(fromPath: string, toPath: string): Promise<void> {
		this.assertActive();
		const from = this.hostPath(fromPath);
		await cp(from, this.hostPath(toPath), {
			recursive: (await stat(from)).isDirectory(),
		});
	}

	async rmdir(
		path: string,
		options: { recursive?: boolean } = { recursive: true }
	): Promise<void> {
		this.assertActive();
		await rm(this.hostPath(path), {
			recursive: options.recursive ?? true,
			force: false,
		});
	}

	async listFiles(
		path: string,
		options: { prependPath?: boolean } = { prependPath: false }
	): Promise<string[]> {
		this.assertActive();
		const normalizedPath = normalizeVfsPath(path);
		if (normalizedPath === '/') {
			const names = new Set<string>();
			if (this.options.mounts.some((mount) => mount.vfsPath === '/')) {
				for (const name of await readdir(this.hostPath('/'))) {
					names.add(name);
				}
			}
			for (const mount of this.options.mounts) {
				const topLevelName = mount.vfsPath.split('/')[1];
				if (topLevelName) {
					names.add(topLevelName);
				}
			}
			const sortedNames = [...names].sort();
			return options.prependPath
				? sortedNames.map((name) => `/${name}`)
				: sortedNames;
		}
		try {
			const names = await readdir(this.hostPath(normalizedPath));
			if (!options.prependPath) {
				return names;
			}
			return names.map((name) => posix.join(normalizedPath, name));
		} catch (error) {
			if (
				isErrorWithCode(error, 'ENOENT') ||
				isErrorWithCode(error, 'ENOTDIR')
			) {
				return [];
			}
			throw error;
		}
	}

	async isDir(path: string): Promise<boolean> {
		this.assertActive();
		if (normalizeVfsPath(path) === '/') {
			return true;
		}
		try {
			return (await stat(this.hostPath(path))).isDirectory();
		} catch (error) {
			if (isErrorWithCode(error, 'ENOENT')) {
				return false;
			}
			throw error;
		}
	}

	async isFile(path: string): Promise<boolean> {
		this.assertActive();
		try {
			return (await stat(this.hostPath(path))).isFile();
		} catch (error) {
			if (isErrorWithCode(error, 'ENOENT')) {
				return false;
			}
			throw error;
		}
	}

	async fileExists(path: string): Promise<boolean> {
		this.assertActive();
		if (normalizeVfsPath(path) === '/') {
			return true;
		}
		try {
			await lstat(this.hostPath(path, { followFinalSymlink: false }));
			return true;
		} catch (error) {
			if (isErrorWithCode(error, 'ENOENT')) {
				return false;
			}
			throw error;
		}
	}

	async chmod(path: string, mode: number): Promise<void> {
		this.assertActive();
		await chmod(this.hostPath(path), mode);
	}

	async symlink(target: string, path: string): Promise<void> {
		this.assertActive();
		const linkPath = this.hostPath(path, { followFinalSymlink: false });
		let hostTarget: string;
		if (target.startsWith('/')) {
			hostTarget = this.hostPath(target);
		} else {
			const targetVfsPath = posix.resolve(
				posix.dirname(normalizeVfsPath(path)),
				target
			);
			const mappedTarget = this.hostPath(targetVfsPath);
			const relativeTarget = resolve(dirname(linkPath), target);
			if (mappedTarget !== relativeTarget) {
				throw new Error(
					`Wasmtime playground symlink target escapes its mount: ${target}.`
				);
			}
			hostTarget = target;
		}
		await symlink(hostTarget, linkPath);
	}

	async isSymlink(path: string): Promise<boolean> {
		this.assertActive();
		try {
			return (
				await lstat(this.hostPath(path, { followFinalSymlink: false }))
			).isSymbolicLink();
		} catch (error) {
			if (isErrorWithCode(error, 'ENOENT')) {
				return false;
			}
			throw error;
		}
	}

	async readlink(path: string): Promise<string> {
		this.assertActive();
		const target = await readlink(
			this.hostPath(path, { followFinalSymlink: false })
		);
		return isAbsolute(target) ? this.vfsPath(target) : target;
	}

	async realpath(path: string): Promise<string> {
		this.assertActive();
		return this.vfsPath(await realpath(this.hostPath(path)));
	}

	async defineConstant(): Promise<never> {
		throw unsupportedWasmtimePHPOption('defineConstant() after startup');
	}

	async onMessage(): Promise<never> {
		throw unsupportedWasmtimePHPOption('onMessage()');
	}

	async addEventListener(): Promise<never> {
		throw unsupportedWasmtimePHPOption('addEventListener()');
	}

	async removeEventListener(): Promise<never> {
		throw unsupportedWasmtimePHPOption('removeEventListener()');
	}

	private assertActive() {
		this.options.assertActive();
	}

	private requestUrl(value: string): URL {
		const url = new URL(value, this.options.serverUrl);
		const server = new URL(this.options.serverUrl);
		if (url.origin !== server.origin) {
			throw new Error(
				`Wasmtime playground requests must target ${server.origin}, got ${url.origin}.`
			);
		}
		return url;
	}

	private fetchRequest(request: PHPRequest): Promise<Response> {
		this.assertActive();
		return fetch(this.requestUrl(request.url), {
			method: request.method,
			headers: request.headers,
			body: requestBody(request.body),
			redirect: 'manual',
		});
	}

	private requestPathForScript(scriptPath: string): string {
		const normalizedPath = normalizeVfsPath(scriptPath);
		const documentRoot = '/wordpress/';
		if (!normalizedPath.startsWith(documentRoot)) {
			throw new Error(
				`Wasmtime playground run() can only execute scripts below /wordpress, got ${normalizedPath}.`
			);
		}
		return `/${normalizedPath
			.slice(documentRoot.length)
			.split('/')
			.map(encodeURIComponent)
			.join('/')}`;
	}

	private hostPath(
		path: string,
		{ followFinalSymlink = true }: { followFinalSymlink?: boolean } = {}
	): string {
		const normalizedPath = normalizeVfsPath(path);
		const mount = this.options.mounts.reduce<WasmtimeVfsMount | undefined>(
			(best, candidate) => {
				const containsPath =
					candidate.vfsPath === '/'
						? normalizedPath.startsWith('/')
						: normalizedPath === candidate.vfsPath ||
							normalizedPath.startsWith(`${candidate.vfsPath}/`);
				if (!containsPath) {
					return best;
				}
				return !best || candidate.vfsPath.length >= best.vfsPath.length
					? candidate
					: best;
			},
			undefined
		);
		if (!mount) {
			throw new Error(
				`Wasmtime playground has no host mount for ${normalizedPath}.`
			);
		}

		const suffix = normalizedPath
			.slice(mount.vfsPath.length)
			.replace(/^\//, '');
		const hostPath = resolve(
			mount.hostPath,
			...suffix.split('/').filter(Boolean)
		);
		if (
			hostPath !== mount.hostPath &&
			!hostPath.startsWith(`${mount.hostPath}${sep}`)
		) {
			throw new Error(
				`Wasmtime playground path escapes its mount: ${normalizedPath}.`
			);
		}
		this.assertResolvedPathInsideMount(
			hostPath,
			mount,
			normalizedPath,
			followFinalSymlink
		);
		return hostPath;
	}

	private assertResolvedPathInsideMount(
		hostPath: string,
		mount: WasmtimeVfsMount,
		normalizedPath: string,
		followFinalSymlink: boolean
	) {
		const resolvedMount = realpathSync(mount.hostPath);
		let candidate =
			followFinalSymlink || hostPath === mount.hostPath
				? hostPath
				: dirname(hostPath);

		while (true) {
			try {
				const resolvedCandidate = realpathSync(candidate);
				if (!isPathInside(resolvedMount, resolvedCandidate)) {
					throw new Error(
						`Wasmtime playground path escapes its mount through a symlink: ${normalizedPath}.`
					);
				}
				return;
			} catch (error) {
				if (!isErrorWithCode(error, 'ENOENT')) {
					throw error;
				}
				try {
					if (lstatSync(candidate).isSymbolicLink()) {
						throw new Error(
							`Wasmtime playground path escapes its mount through an unresolved symlink: ${normalizedPath}.`
						);
					}
				} catch (lstatError) {
					if (!isErrorWithCode(lstatError, 'ENOENT')) {
						throw lstatError;
					}
				}

				const parent = dirname(candidate);
				if (parent === candidate) {
					throw error;
				}
				candidate = parent;
			}
		}
	}

	private vfsPath(hostPath: string): string {
		const mount = this.options.mounts.reduce<WasmtimeVfsMount | undefined>(
			(best, candidate) => {
				const suffix = relative(candidate.hostPath, hostPath);
				if (pathEscapesMount(suffix)) {
					return best;
				}
				return !best ||
					candidate.hostPath.length >= best.hostPath.length
					? candidate
					: best;
			},
			undefined
		);
		if (!mount) {
			throw new Error(
				`Wasmtime playground real path is outside its mounts: ${hostPath}.`
			);
		}
		const suffix = relative(mount.hostPath, hostPath)
			.split(sep)
			.filter(Boolean)
			.join('/');
		return suffix ? posix.join(mount.vfsPath, suffix) : mount.vfsPath;
	}
}

function normalizeVfsPath(path: string): string {
	if (!path.startsWith('/')) {
		throw new Error(`Wasmtime playground paths must be absolute: ${path}.`);
	}
	const normalized = posix.normalize(path);
	return normalized === '.' ? '/' : normalized;
}

function requestBody(body: PHPRequest['body']): BodyInit | undefined {
	if (body === undefined || typeof body === 'string') {
		return body;
	}
	if (body instanceof Uint8Array) {
		return body as BodyInit;
	}

	const formData = new FormData();
	for (const [name, value] of Object.entries(body)) {
		if (typeof value === 'string') {
			formData.append(name, value);
		} else if (value instanceof Uint8Array) {
			formData.append(name, new Blob([value]), name);
		} else {
			formData.append(name, value);
		}
	}
	return formData;
}

function byteStream(bytes?: Uint8Array): ReadableStream<Uint8Array> {
	return new ReadableStream<Uint8Array>({
		start(controller) {
			if (bytes) {
				controller.enqueue(bytes);
			}
			controller.close();
		},
	});
}

function responseHeaders(headers: Headers): Record<string, string[]> {
	const result: Record<string, string[]> = {};
	headers.forEach((value, name) => {
		result[name] = [value];
	});
	const setCookies = (
		headers as Headers & { getSetCookie?: () => string[] }
	).getSetCookie?.();
	if (setCookies?.length) {
		result['set-cookie'] = setCookies;
	}
	return result;
}

function unsupportedWasmtimePHPOption(option: string): Error {
	return new Error(
		`The Wasmtime runCLI() adapter does not support ${option} yet. Supply startup options to runCLI() instead.`
	);
}

function isErrorWithCode(error: unknown, code: string): boolean {
	return (
		error instanceof Error &&
		'code' in error &&
		(error as NodeJS.ErrnoException).code === code
	);
}

function pathEscapesMount(path: string): boolean {
	return path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path);
}

function isPathInside(parent: string, path: string): boolean {
	return !pathEscapesMount(relative(parent, path));
}
