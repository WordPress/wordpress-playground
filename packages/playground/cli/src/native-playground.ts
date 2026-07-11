import { randomUUID } from 'node:crypto';
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
import { basename, isAbsolute, posix, relative, resolve, sep } from 'node:path';
import {
	PHPResponse,
	StreamedPHPResponse,
	type PHPRequest,
	type PHPRunOptions,
	type Pooled,
} from '@php-wasm/universal';
import type { PlaygroundCliWorker } from './run-cli';

export type NativeVfsMount = {
	hostPath: string;
	vfsPath: string;
};

export type NativePHPCLIResult = {
	exitCode: number;
	stdout: Uint8Array;
	stderr: string;
};

export type NativePlaygroundOptions = {
	serverUrl: string;
	mounts: NativeVfsMount[];
	assertActive: () => void;
	executePHPCLI: (
		argv: string[],
		environment?: Record<string, string>
	) => Promise<NativePHPCLIResult>;
};

/**
 * Creates the programmatic PHP/VFS facade backed by the native host mounts.
 *
 * The public CLI API has always returned a pooled, asynchronous object. The
 * native host already uses shared host directories for those paths, so this
 * facade performs VFS operations against the same files and sends requests to
 * the running Wasmtime server.
 */
export function createNativePlayground(
	options: NativePlaygroundOptions
): Pooled<PlaygroundCliWorker> {
	return new NativePlayground(
		options
	) as unknown as Pooled<PlaygroundCliWorker>;
}

class NativePlayground {
	readonly absoluteUrl: Promise<string>;
	readonly documentRoot = Promise.resolve('/wordpress');
	private readonly options: NativePlaygroundOptions;
	#workingDirectory = '/wordpress';

	constructor(options: NativePlaygroundOptions) {
		this.options = options;
		this.absoluteUrl = Promise.resolve(options.serverUrl);
	}

	async request(request: PHPRequest): Promise<PHPResponse> {
		this.assertActive();
		const response = await fetch(this.requestUrl(request.url), {
			method: request.method,
			headers: request.headers,
			body: requestBody(request.body),
			redirect: 'manual',
		});
		return new PHPResponse(
			response.status,
			responseHeaders(response.headers),
			new Uint8Array(await response.arrayBuffer())
		);
	}

	async requestStreamed(request: PHPRequest): Promise<StreamedPHPResponse> {
		return StreamedPHPResponse.fromPHPResponse(await this.request(request));
	}

	async run(request: PHPRunOptions): Promise<PHPResponse> {
		this.assertActive();
		if (request.env || request.$_SERVER) {
			throw unsupportedNativePHPOption('run() environment overrides');
		}

		let temporaryPath: string | undefined;
		let requestPath: string;
		if (request.code !== undefined) {
			temporaryPath = `/wordpress/.wp-playground-native-run-${randomUUID()}.php`;
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
				'Native playground run() requires code or scriptPath.'
			);
		}

		try {
			if (request.relativeUri && request.relativeUri !== requestPath) {
				throw unsupportedNativePHPOption(
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

	async cli(
		argv: string[],
		options?: { env?: Record<string, string> }
	): Promise<StreamedPHPResponse> {
		this.assertActive();
		const phpArgs =
			argv.length > 0 && basename(argv[0]).startsWith('php')
				? argv.slice(1)
				: argv;
		const result = await this.options.executePHPCLI(phpArgs, options?.env);
		return StreamedPHPResponse.fromPHPResponse(
			new PHPResponse(
				result.exitCode === 0 ? 200 : 500,
				{},
				result.stdout,
				result.stderr,
				result.exitCode
			)
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
		await unlink(this.hostPath(path));
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
			return [
				...new Set(
					this.options.mounts.map(
						(mount) => mount.vfsPath.split('/')[1]
					)
				),
			]
				.filter(Boolean)
				.sort();
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
			await lstat(this.hostPath(path));
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
		const hostTarget = target.startsWith('/')
			? this.hostPath(target)
			: target;
		await symlink(hostTarget, this.hostPath(path));
	}

	async isSymlink(path: string): Promise<boolean> {
		this.assertActive();
		try {
			return (await lstat(this.hostPath(path))).isSymbolicLink();
		} catch (error) {
			if (isErrorWithCode(error, 'ENOENT')) {
				return false;
			}
			throw error;
		}
	}

	async readlink(path: string): Promise<string> {
		this.assertActive();
		return await readlink(this.hostPath(path));
	}

	async realpath(path: string): Promise<string> {
		this.assertActive();
		return this.vfsPath(await realpath(this.hostPath(path)));
	}

	async chdir(path: string): Promise<void> {
		this.assertActive();
		if (!(await this.isDir(path))) {
			throw new Error(
				`Native playground directory does not exist: ${path}`
			);
		}
		this.#workingDirectory = normalizeVfsPath(path);
	}

	async cwd(): Promise<string> {
		this.assertActive();
		return this.#workingDirectory;
	}

	async defineConstant(): Promise<never> {
		throw unsupportedNativePHPOption('defineConstant() after startup');
	}

	async onMessage(): Promise<never> {
		throw unsupportedNativePHPOption('onMessage()');
	}

	async addEventListener(): Promise<never> {
		throw unsupportedNativePHPOption('addEventListener()');
	}

	async removeEventListener(): Promise<never> {
		throw unsupportedNativePHPOption('removeEventListener()');
	}

	private assertActive() {
		this.options.assertActive();
	}

	private requestUrl(value: string): URL {
		const url = new URL(value, this.options.serverUrl);
		const server = new URL(this.options.serverUrl);
		if (url.origin !== server.origin) {
			throw new Error(
				`Native playground requests must target ${server.origin}, got ${url.origin}.`
			);
		}
		return url;
	}

	private requestPathForScript(scriptPath: string): string {
		const normalizedPath = normalizeVfsPath(scriptPath);
		const documentRoot = '/wordpress/';
		if (!normalizedPath.startsWith(documentRoot)) {
			throw new Error(
				`Native playground run() can only execute scripts below /wordpress, got ${normalizedPath}.`
			);
		}
		return `/${normalizedPath.slice(documentRoot.length)}`;
	}

	private hostPath(path: string): string {
		const normalizedPath = normalizeVfsPath(path);
		const mount = this.options.mounts.reduce<NativeVfsMount | undefined>(
			(best, candidate) => {
				if (
					normalizedPath !== candidate.vfsPath &&
					!normalizedPath.startsWith(`${candidate.vfsPath}/`)
				) {
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
				`Native playground has no host mount for ${normalizedPath}.`
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
				`Native playground path escapes its mount: ${normalizedPath}.`
			);
		}
		return hostPath;
	}

	private vfsPath(hostPath: string): string {
		const mount = this.options.mounts.reduce<NativeVfsMount | undefined>(
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
				`Native playground real path is outside its mounts: ${hostPath}.`
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
		throw new Error(`Native playground paths must be absolute: ${path}.`);
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

function unsupportedNativePHPOption(option: string): Error {
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
