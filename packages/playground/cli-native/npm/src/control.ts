import type { ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { constants as fsConstants, rmSync } from 'node:fs';
import {
	chmod,
	mkdtemp,
	open as openFile,
	readFile,
	rm,
	type FileHandle,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	asNativeCLIErrorCode,
	NativeCLIError,
	NativeCLIErrorCode,
} from './errors.js';

const CONTROL_PROTOCOL_VERSION = 2 as const;
const MAX_STREAM_LINE_BYTES = 96 * 1024;
const STREAM_MEMORY_FRAME_LIMIT = 8;
const STREAM_FILE_READ_SIZE = 64 * 1024;
const STREAM_SPOOL_PREFIX = 'wp-playground-native-stream-';
const MAX_CLI_ARG_COUNT = 4_096;
const MAX_CLI_ENV_COUNT = 4_096;
const MAX_CLI_ENTRY_BYTES = 1024 * 1024;
const MAX_CLI_TOTAL_BYTES = 8 * 1024 * 1024;

const activeSpoolDirectories = new Set<string>();
process.once('exit', () => {
	for (const path of activeSpoolDirectories) {
		try {
			rmSync(path, { recursive: true, force: true });
		} catch {
			// Process teardown is best effort.
		}
	}
});

export interface NativeControlHandshake {
	protocolVersion: typeof CONTROL_PROTOCOL_VERSION;
	serverUrl: string;
	nativeServerUrl: string;
	controlUrl: string;
	workerCount: number;
	documentRoot: string;
	pid: number;
}

interface RPCResponse {
	protocolVersion: number;
	id: number;
	result?: unknown;
	error?: { code: string; message: string };
}

interface StreamHeadersFrame {
	protocolVersion: 2;
	id: number;
	type: 'headers';
	httpStatusCode: number;
	headers: Array<{ name: string; value: string }>;
}

interface StreamOutputFrame {
	protocolVersion: 2;
	id: number;
	type: 'stdout' | 'stderr';
	sequence: number;
	data: { encoding: 'base64'; data: string };
}

interface StreamCompleteFrame {
	protocolVersion: 2;
	id: number;
	type: 'complete';
	exitCode: number;
}

interface StreamErrorFrame {
	protocolVersion: 2;
	id: number;
	type: 'error';
	error: { code: string; message: string };
}

type StreamFrame =
	| StreamHeadersFrame
	| StreamOutputFrame
	| StreamCompleteFrame
	| StreamErrorFrame;

export async function createControlCredentials(): Promise<{
	token: string;
	handshakePath: string;
	handshakeDirectory: string;
}> {
	const handshakeDirectory = await mkdtemp(
		join(tmpdir(), 'wp-playground-native-control-')
	);
	await chmod(handshakeDirectory, 0o700);
	return {
		token: randomBytes(32).toString('hex'),
		handshakePath: join(handshakeDirectory, 'handshake.json'),
		handshakeDirectory,
	};
}

export async function waitForControlHandshake(
	child: ChildProcess,
	path: string,
	timeoutMs = 180_000
): Promise<NativeControlHandshake> {
	const deadline = Date.now() + timeoutMs;
	let childError: Error | undefined;
	const onChildError = (error: Error) => {
		childError = error;
	};
	child.once('error', onChildError);
	try {
		while (Date.now() < deadline) {
			if (childError) {
				throw new NativeCLIError(
					NativeCLIErrorCode.Spawn,
					'The native CLI failed before creating its control handshake.',
					{ cause: childError }
				);
			}
			if (child.exitCode !== null || child.signalCode !== null) {
				throw new NativeCLIError(
					NativeCLIErrorCode.Startup,
					`The native CLI exited before creating its control handshake (exit ${child.exitCode ?? child.signalCode}).`,
					{
						details: {
							exitCode: child.exitCode ?? undefined,
							signal: child.signalCode ?? undefined,
						},
					}
				);
			}
			try {
				const value = JSON.parse(
					await readFile(path, 'utf8')
				) as unknown;
				return validateHandshake(value, child.pid);
			} catch (cause) {
				if ((cause as NodeJS.ErrnoException).code === 'ENOENT') {
					// The native host publishes the handshake atomically.
				} else if (cause instanceof NativeCLIError) throw cause;
				else {
					throw new NativeCLIError(
						NativeCLIErrorCode.Startup,
						'The native control handshake is not valid JSON.',
						{ cause }
					);
				}
			}
			await new Promise((resolvePromise) =>
				setTimeout(resolvePromise, 50)
			);
		}
		throw new NativeCLIError(
			NativeCLIErrorCode.Startup,
			`Timed out after ${timeoutMs}ms waiting for the native control handshake.`
		);
	} finally {
		child.off('error', onChildError);
		await rm(path, { force: true });
	}
}

export class NativeControlClient {
	readonly #url: URL;
	readonly #token: string;
	readonly #streamControllers = new Map<number, AbortController>();
	readonly #closeListeners = new Set<() => void>();
	#nextId = 1;
	#closed = false;

	constructor(controlUrl: string, token: string) {
		this.#url = new URL(controlUrl);
		validateLoopbackUrl('control', this.#url.toString(), '/rpc');
		this.#token = token;
	}

	async call(method: string, params: unknown = {}): Promise<unknown> {
		this.#assertOpen();
		const id = this.#nextId++;
		let response: Response;
		try {
			response = await fetch(new URL('/rpc', this.#url), {
				method: 'POST',
				headers: this.#jsonHeaders(),
				body: JSON.stringify({
					protocolVersion: CONTROL_PROTOCOL_VERSION,
					id,
					method,
					params: encodeBinary(params),
				}),
			});
		} catch (cause) {
			throw new NativeCLIError(
				NativeCLIErrorCode.Protocol,
				`Native control request ${method} failed.`,
				{ cause, details: { rpcMethod: method } }
			);
		}
		if (!response.ok)
			throw await responseError(response, method, this.#token);
		let parsedBody: unknown;
		try {
			parsedBody = await response.json();
		} catch (cause) {
			throw protocolError(
				`Native control response for ${method} is not JSON.`,
				{
					cause,
					rpcMethod: method,
				}
			);
		}
		const body = validateRPCResponse(parsedBody, id, method);
		if (body.error) {
			throw new NativeCLIError(
				asNativeCLIErrorCode(body.error.code),
				sanitizeMessage(body.error.message, this.#token),
				{ details: { rpcMethod: method } }
			);
		}
		return decodeBinary(body.result, method);
	}

	async requestStream(params: unknown): Promise<NativeStreamedPHPResponse> {
		return this.#stream('requestStreamed', params);
	}

	async cli(params: unknown): Promise<NativeStreamedPHPResponse> {
		return this.#stream('cli', params);
	}

	async #stream(
		method: 'requestStreamed' | 'cli',
		params: unknown
	): Promise<NativeStreamedPHPResponse> {
		this.#assertOpen();
		const id = this.#nextId++;
		const controller = new AbortController();
		this.#streamControllers.set(id, controller);
		let response: Response;
		try {
			response = await fetch(new URL('/rpc/stream', this.#url), {
				method: 'POST',
				headers: this.#jsonHeaders(),
				body: JSON.stringify({
					protocolVersion: CONTROL_PROTOCOL_VERSION,
					id,
					method,
					params: encodeBinary(params),
				}),
				signal: controller.signal,
			});
		} catch (cause) {
			this.#streamControllers.delete(id);
			throw new NativeCLIError(
				controller.signal.aborted
					? NativeCLIErrorCode.Aborted
					: NativeCLIErrorCode.Protocol,
				controller.signal.aborted
					? 'Native streamed request was aborted.'
					: `Native ${method} stream failed.`,
				{ cause, details: { rpcMethod: method } }
			);
		}
		if (!response.ok) {
			this.#streamControllers.delete(id);
			throw await responseError(response, method, this.#token);
		}
		if (!response.body) {
			this.#streamControllers.delete(id);
			throw protocolError('Native streamed response has no body.', {
				rpcMethod: method,
			});
		}
		const contentType = response.headers.get('content-type') ?? '';
		if (!contentType.toLowerCase().includes('ndjson')) {
			controller.abort();
			this.#streamControllers.delete(id);
			throw protocolError('Native streamed response is not NDJSON.', {
				rpcMethod: method,
			});
		}
		const cancel = async () => {
			if (controller.signal.aborted) return;
			void this.#cancelStream(id);
			controller.abort();
		};
		return NativeStreamedPHPResponse.fromControlStream(
			response.body,
			id,
			cancel,
			() => this.#streamControllers.delete(id),
			(message) => sanitizeMessage(message, this.#token),
			method
		);
	}

	close(): void {
		if (this.#closed) return;
		this.#closed = true;
		for (const [id, controller] of this.#streamControllers) {
			void this.#cancelStream(id);
			controller.abort();
		}
		this.#streamControllers.clear();
		for (const listener of this.#closeListeners) listener();
		this.#closeListeners.clear();
	}

	get eventsUrl(): URL {
		return new URL('/events', this.#url);
	}

	get token(): string {
		return this.#token;
	}

	sanitize(message: string): string {
		return sanitizeMessage(message, this.#token);
	}

	onClose(listener: () => void): () => void {
		if (this.#closed) {
			listener();
			return () => undefined;
		}
		this.#closeListeners.add(listener);
		return () => this.#closeListeners.delete(listener);
	}

	#assertOpen(): void {
		if (this.#closed)
			throw protocolError('Native control client is closed.');
	}

	#jsonHeaders(): Record<string, string> {
		return {
			authorization: `Bearer ${this.#token}`,
			'content-type': 'application/json',
		};
	}

	async #cancelStream(id: number): Promise<void> {
		try {
			await fetch(new URL('/rpc/cancel', this.#url), {
				method: 'POST',
				headers: this.#jsonHeaders(),
				body: JSON.stringify({
					protocolVersion: CONTROL_PROTOCOL_VERSION,
					id,
				}),
			});
		} catch {
			// The stream is already locally interrupted; cancellation is best effort.
		}
	}
}

type SupportedMethod =
	| 'request'
	| 'requestStreamed'
	| 'cli'
	| 'run'
	| 'mkdir'
	| 'mkdirTree'
	| 'readFileAsText'
	| 'readFileAsBuffer'
	| 'writeFile'
	| 'unlink'
	| 'mv'
	| 'rmdir'
	| 'listFiles'
	| 'isDir'
	| 'isFile'
	| 'fileExists'
	| 'chdir'
	| 'cwd'
	| 'defineConstant'
	| 'pathToInternalUrl'
	| 'internalUrlToPath';

const supportedMethods = new Set<SupportedMethod>([
	'request',
	'requestStreamed',
	'cli',
	'run',
	'mkdir',
	'mkdirTree',
	'readFileAsText',
	'readFileAsBuffer',
	'writeFile',
	'unlink',
	'mv',
	'rmdir',
	'listFiles',
	'isDir',
	'isFile',
	'fileExists',
	'chdir',
	'cwd',
	'defineConstant',
	'pathToInternalUrl',
	'internalUrlToPath',
]);

const unsupportedMethods = new Set([
	'onMessage',
	'boot',
	'exit',
	'cp',
	'isReady',
	'getRuntimeId',
	'journalFSEvents',
	'replayFSJournal',
	'onDownloadProgress',
	'rotatePhpRuntime',
	'setPrimaryPHP',
	'getPrimaryPHP',
	'mount',
	'unmount',
]);

export function createPlaygroundProxy(
	client: NativeControlClient
): Record<string, unknown> {
	const eventBridge = new NativeEventBridge(client);
	return new Proxy<Record<string, unknown>>(
		{},
		{
			get(_target, property) {
				if (typeof property !== 'string') return undefined;
				if (property === 'then' || property === 'toJSON')
					return undefined;
				if (property === 'absoluteUrl' || property === 'documentRoot')
					return client.call(property);
				if (property === 'addEventListener')
					return (type: string, listener: NativeEventListener) => {
						assertSupportedEventType(type);
						eventBridge.add(type, listener);
						return Promise.resolve();
					};
				if (property === 'removeEventListener')
					return (type: string, listener: NativeEventListener) => {
						assertSupportedEventType(type);
						eventBridge.remove(type, listener);
						return Promise.resolve();
					};
				if (property === 'onMessage')
					return () => unsupportedMethod(property);
				if (unsupportedMethods.has(property))
					return async () => unsupportedMethod(property);
				if (supportedMethods.has(property as SupportedMethod))
					return (...args: unknown[]) =>
						callPlaygroundMethod(
							client,
							property as SupportedMethod,
							args
						);
				return (..._args: unknown[]) => unsupportedMethod(property);
			},
		}
	);
}

const nativeWireEventTypes = new Set([
	'request.end',
	'request.error',
	'filesystem.write',
	'ready',
	'shutdown',
]);

const supportedEventTypes = new Set([
	...nativeWireEventTypes,
	'runtime.initialized',
	'runtime.beforeExit',
	'*',
]);

function assertSupportedEventType(type: string): void {
	if (supportedEventTypes.has(type)) return;
	throw new NativeCLIError(
		NativeCLIErrorCode.Unsupported,
		`The native control protocol does not support the \`${type}\` event.`
	);
}

function unsupportedMethod(method: string): never {
	throw new NativeCLIError(
		NativeCLIErrorCode.Unsupported,
		`The native control protocol does not support \`${method}\`.`
	);
}

async function callPlaygroundMethod(
	client: NativeControlClient,
	method: SupportedMethod,
	args: unknown[]
): Promise<unknown> {
	const params = await playgroundParams(client, method, args);
	if (method === 'requestStreamed') return client.requestStream(params);
	if (method === 'cli') return client.cli(params);
	const result = await client.call(method, params);
	if (method === 'request')
		return NativePHPResponse.fromRequestResult(result);
	if (method === 'run') {
		const response = NativePHPResponse.fromRunResult(result);
		if (response.exitCode !== 0) {
			throw new PHPExecutionFailureError(
				`PHP.run() failed with exit code ${response.exitCode}. \n\n=== Stdout ===\n ${response.text}\n\n=== Stderr ===\n ${response.errors}`,
				response,
				'request'
			);
		}
		return response;
	}
	if (method === 'listFiles') {
		if (
			!Array.isArray(result) ||
			result.some((item) => typeof item !== 'string')
		)
			throw protocolError(
				'Native listFiles response must be a string array.',
				{
					rpcMethod: method,
				}
			);
		return [...result].sort();
	}
	return result;
}

async function playgroundParams(
	client: NativeControlClient,
	method: SupportedMethod,
	args: unknown[]
): Promise<unknown> {
	if (method === 'cli') return cliParams(args);
	if (method === 'request' || method === 'requestStreamed') {
		assertArgumentCount(method, args, 1);
		const params = asRecord(args[0]);
		assertObjectKeys(method, params, [
			'url',
			'path',
			'method',
			'headers',
			'body',
		]);
		const requestUrl = params['url'] ?? params['path'];
		const path = await normalizeRequestPath(client, requestUrl);
		let headers = normalizeHeaders(params['headers']);
		let body: unknown;
		let requestMethod = params['method'];
		if (isMultipartBody(params['body'])) {
			const multipart = await encodeAsMultipart(params['body']);
			headers = headers.filter(
				(header) => header.name.toLowerCase() !== 'content-type'
			);
			headers.push({
				name: 'content-type',
				value: multipart.contentType,
			});
			body = encodeBinary(multipart.bytes);
			requestMethod ??= 'POST';
		} else body = encodeBytes(params['body']);
		return { path, method: requestMethod, headers, body };
	}
	if (method === 'run') {
		assertArgumentCount(method, args, 1);
		const params = asRecord(args[0]);
		assertObjectKeys(method, params, [
			'code',
			'scriptPath',
			'relativeUri',
			'relative_uri',
			'protocol',
			'method',
			'headers',
			'body',
			'env',
			'server',
			'$_SERVER',
		]);
		if (params['server'] !== undefined && params['$_SERVER'] !== undefined)
			throw new NativeCLIError(
				NativeCLIErrorCode.InvalidRequest,
				'Pass either `server` or `$_SERVER` to `run`, not both.'
			);
		if (
			(params['code'] === undefined) ===
			(params['scriptPath'] === undefined)
		)
			throw new NativeCLIError(
				NativeCLIErrorCode.InvalidRequest,
				'PHP.run() requires exactly one of `code` or `scriptPath`.'
			);
		return {
			code: params['code'],
			scriptPath: params['scriptPath'],
			relativeUri: params['relativeUri'] ?? params['relative_uri'],
			protocol: params['protocol'],
			method: params['method'],
			headers: normalizeHeaders(params['headers']),
			body: encodeBytes(params['body']),
			env: params['env'],
			$_SERVER: params['$_SERVER'] ?? params['server'],
		};
	}
	if (
		[
			'mkdir',
			'mkdirTree',
			'readFileAsText',
			'readFileAsBuffer',
			'unlink',
			'isDir',
			'isFile',
			'fileExists',
			'chdir',
			'pathToInternalUrl',
		].includes(method)
	) {
		assertArgumentCount(method, args, 1);
		return { path: args[0] };
	}
	if (method === 'rmdir') {
		assertArgumentRange(method, args, 1, 2);
		if (
			args[1] !== undefined &&
			(typeof args[1] !== 'object' ||
				args[1] === null ||
				Array.isArray(args[1]))
		)
			throw new NativeCLIError(
				NativeCLIErrorCode.InvalidRequest,
				'rmdir() options must be an object.'
			);
		const options = args[1] === undefined ? undefined : asRecord(args[1]);
		if (options) assertObjectKeys(method, options, ['recursive']);
		return { path: args[0], options };
	}
	if (method === 'listFiles') {
		assertArgumentRange(method, args, 1, 2);
		if (
			args[1] !== undefined &&
			(typeof args[1] !== 'object' ||
				args[1] === null ||
				Array.isArray(args[1]))
		)
			throw new NativeCLIError(
				NativeCLIErrorCode.InvalidRequest,
				'listFiles() options must be an object.'
			);
		const options = args[1] === undefined ? undefined : asRecord(args[1]);
		if (options) assertObjectKeys(method, options, ['prependPath']);
		return { path: args[0], options };
	}
	if (method === 'writeFile') {
		assertArgumentCount(method, args, 2);
		return { path: args[0], data: encodeBytes(args[1]) };
	}
	if (method === 'mv') {
		assertArgumentCount(method, args, 2);
		return { fromPath: args[0], toPath: args[1] };
	}
	if (method === 'defineConstant') {
		assertArgumentCount(method, args, 2);
		const value = args[1];
		if (
			value !== null &&
			typeof value !== 'string' &&
			typeof value !== 'number' &&
			typeof value !== 'boolean'
		)
			throw new NativeCLIError(
				NativeCLIErrorCode.InvalidRequest,
				'defineConstant() accepts string, number, boolean, or null values.'
			);
		return { name: args[0], value };
	}
	if (method === 'internalUrlToPath') {
		assertArgumentCount(method, args, 1);
		return { url: args[0] };
	}
	assertArgumentCount(method, args, 0);
	return {};
}

function cliParams(args: unknown[]): {
	argv: string[];
	env: Record<string, string>;
	cwd?: string;
} {
	try {
		return snapshotCliParams(args);
	} catch (cause) {
		if (cause instanceof NativeCLIError) throw cause;
		throw new NativeCLIError(
			NativeCLIErrorCode.InvalidRequest,
			'cli inputs could not be inspected safely.',
			{ cause }
		);
	}
}

function snapshotCliParams(args: unknown[]): {
	argv: string[];
	env: Record<string, string>;
	cwd?: string;
} {
	assertArgumentRange('cli', args, 1, 2);
	const argv = snapshotCliStringArray(args[0], 'cli argv');
	if (argv.length === 0)
		throw new NativeCLIError(
			NativeCLIErrorCode.InvalidRequest,
			'cli argv must not be empty.'
		);
	if (argv.length > MAX_CLI_ARG_COUNT)
		throw new NativeCLIError(
			NativeCLIErrorCode.InvalidRequest,
			`cli argv must not contain more than ${MAX_CLI_ARG_COUNT} entries.`
		);
	if ((argv[0]!.split(/[\\/]/).pop() ?? '') !== 'php')
		throw new NativeCLIError(
			NativeCLIErrorCode.Unsupported,
			'The native cli() implementation supports the php command only.'
		);

	const options =
		args[1] === undefined
			? Object.create(null)
			: snapshotCliRecord(args[1], 'cli options', ['env', 'cwd']);
	const env: Record<string, string> =
		options['env'] === undefined
			? Object.create(null)
			: snapshotCliEnvironment(options['env']);
	const cwd = options['cwd'];
	if (cwd !== undefined && (typeof cwd !== 'string' || cwd.length === 0))
		throw new NativeCLIError(
			NativeCLIErrorCode.InvalidRequest,
			'cli cwd must be a non-empty string.'
		);

	let totalBytes = 0;
	const account = (value: string, description: string) => {
		if (value.includes('\0'))
			throw new NativeCLIError(
				NativeCLIErrorCode.InvalidRequest,
				`${description} must not contain NUL bytes.`
			);
		const bytes = Buffer.byteLength(value, 'utf8');
		if (bytes > MAX_CLI_ENTRY_BYTES)
			throw new NativeCLIError(
				NativeCLIErrorCode.InvalidRequest,
				`${description} must not exceed ${MAX_CLI_ENTRY_BYTES} bytes.`
			);
		totalBytes += bytes;
		if (totalBytes > MAX_CLI_TOTAL_BYTES)
			throw new NativeCLIError(
				NativeCLIErrorCode.InvalidRequest,
				`cli argv, env, and cwd must not exceed ${MAX_CLI_TOTAL_BYTES} bytes in total.`
			);
	};
	for (const argument of argv) account(argument, 'cli argv entry');
	for (const [name, value] of Object.entries(env)) {
		account(name, 'cli environment name');
		account(value, 'cli environment value');
	}
	if (typeof cwd === 'string') account(cwd, 'cli cwd');
	return { argv, env, ...(typeof cwd === 'string' ? { cwd } : {}) };
}

function snapshotCliStringArray(value: unknown, description: string): string[] {
	if (
		!Array.isArray(value) ||
		Object.getPrototypeOf(value) !== Array.prototype
	)
		throw new NativeCLIError(
			NativeCLIErrorCode.InvalidRequest,
			`${description} must be an ordinary dense array.`
		);
	const keys = Reflect.ownKeys(value);
	if (
		keys.length !== value.length + 1 ||
		!keys.includes('length') ||
		keys.some(
			(key) =>
				typeof key !== 'string' ||
				(key !== 'length' &&
					(!/^(0|[1-9]\d*)$/.test(key) ||
						Number(key) >= value.length))
		)
	)
		throw new NativeCLIError(
			NativeCLIErrorCode.InvalidRequest,
			`${description} must be dense and must not contain extra properties.`
		);
	const result: string[] = [];
	for (let index = 0; index < value.length; index++) {
		const descriptor = Object.getOwnPropertyDescriptor(
			value,
			String(index)
		);
		if (
			!descriptor ||
			!('value' in descriptor) ||
			typeof descriptor.value !== 'string'
		)
			throw new NativeCLIError(
				NativeCLIErrorCode.InvalidRequest,
				`${description} entries must be own string data properties.`
			);
		result.push(descriptor.value);
	}
	return result;
}

function snapshotCliRecord(
	value: unknown,
	description: string,
	allowed: readonly string[] | null
): Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value))
		throw new NativeCLIError(
			NativeCLIErrorCode.InvalidRequest,
			`${description} must be a plain object.`
		);
	const prototype = Object.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null)
		throw new NativeCLIError(
			NativeCLIErrorCode.InvalidRequest,
			`${description} must be a plain object.`
		);
	const result = Object.create(null) as Record<string, unknown>;
	for (const key of Reflect.ownKeys(value)) {
		if (
			typeof key !== 'string' ||
			(allowed !== null && !allowed.includes(key))
		)
			throw new NativeCLIError(
				NativeCLIErrorCode.InvalidRequest,
				`${description} contains an unsupported property.`
			);
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (!descriptor || !('value' in descriptor))
			throw new NativeCLIError(
				NativeCLIErrorCode.InvalidRequest,
				`${description} properties must be own data properties.`
			);
		result[key] = descriptor.value;
	}
	return result;
}

function snapshotCliEnvironment(value: unknown): Record<string, string> {
	const source = snapshotCliRecord(value, 'cli env', null);
	const entries = Object.entries(source);
	if (entries.length > MAX_CLI_ENV_COUNT)
		throw new NativeCLIError(
			NativeCLIErrorCode.InvalidRequest,
			`cli env must not contain more than ${MAX_CLI_ENV_COUNT} entries.`
		);
	const env = Object.create(null) as Record<string, string>;
	for (const [name, value] of entries) {
		if (name.length === 0 || name.includes('='))
			throw new NativeCLIError(
				NativeCLIErrorCode.InvalidRequest,
				"cli environment names must be non-empty and must not contain '='."
			);
		if (typeof value !== 'string')
			throw new NativeCLIError(
				NativeCLIErrorCode.InvalidRequest,
				'cli environment values must be strings.'
			);
		env[name] = value;
	}
	return env;
}

async function normalizeRequestPath(
	client: NativeControlClient,
	value: unknown
): Promise<string> {
	if (typeof value !== 'string' || value.length === 0)
		throw new NativeCLIError(
			NativeCLIErrorCode.InvalidRequest,
			'PHP.request() requires a non-empty `url`.'
		);
	let requested: URL;
	try {
		if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value)) {
			const absoluteUrl = await client.call('absoluteUrl');
			if (typeof absoluteUrl !== 'string')
				throw protocolError(
					'Native absoluteUrl property is not a string.'
				);
			const base = new URL(absoluteUrl);
			requested = new URL(value, base);
			if (requested.origin !== base.origin)
				throw new NativeCLIError(
					NativeCLIErrorCode.InvalidRequest,
					'PHP.request() absolute URLs must use the Playground origin.'
				);
		} else {
			requested = new URL(value, 'http://playground.internal/');
		}
	} catch (cause) {
		if (cause instanceof NativeCLIError) throw cause;
		throw new NativeCLIError(
			NativeCLIErrorCode.InvalidRequest,
			'PHP.request() received an invalid URL.',
			{ cause }
		);
	}
	return `${requested.pathname}${requested.search}`;
}

function assertArgumentCount(
	method: string,
	args: unknown[],
	expected: number
): void {
	assertArgumentRange(method, args, expected, expected);
}

function assertArgumentRange(
	method: string,
	args: unknown[],
	minimum: number,
	maximum: number
): void {
	if (args.length >= minimum && args.length <= maximum) return;
	throw new NativeCLIError(
		NativeCLIErrorCode.InvalidRequest,
		`The native control method \`${method}\` accepts ${minimum === maximum ? minimum : `${minimum}-${maximum}`} arguments.`
	);
}

function assertObjectKeys(
	method: string,
	value: Record<string, unknown>,
	allowed: readonly string[]
): void {
	const unsupported = Object.keys(value).filter(
		(key) => !allowed.includes(key) && value[key] !== undefined
	);
	if (unsupported.length === 0) return;
	throw new NativeCLIError(
		NativeCLIErrorCode.Unsupported,
		`The native control method \`${method}\` does not support: ${unsupported.join(', ')}.`
	);
}

function encodeBytes(value: unknown): unknown {
	if (value === undefined) return undefined;
	if (typeof value === 'string')
		return encodeBinary(new TextEncoder().encode(value));
	if (value instanceof Uint8Array) return encodeBinary(value);
	throw new NativeCLIError(
		NativeCLIErrorCode.InvalidRequest,
		'The native control protocol accepts request bodies as strings, Uint8Array values, or multipart records.'
	);
}

function isMultipartBody(
	value: unknown
): value is Record<string, string | Uint8Array | File> {
	return (
		typeof value === 'object' &&
		value !== null &&
		!(value instanceof Uint8Array) &&
		!Array.isArray(value)
	);
}

// This intentionally mirrors @php-wasm/universal's multipart encoder.
async function encodeAsMultipart(
	data: Record<string, string | Uint8Array | File>
): Promise<{ bytes: Uint8Array; contentType: string }> {
	const boundary = `----${Math.random().toString(36).slice(2)}`;
	const contentType = `multipart/form-data; boundary=${boundary}`;
	const parts: Array<string | Uint8Array> = [];
	for (const [name, value] of Object.entries(data)) {
		const isFile = typeof File !== 'undefined' && value instanceof File;
		if (
			typeof value !== 'string' &&
			!(value instanceof Uint8Array) &&
			!isFile
		)
			throw new NativeCLIError(
				NativeCLIErrorCode.InvalidRequest,
				`Multipart field \`${name}\` is not a string, Uint8Array, or File.`
			);
		parts.push(`--${boundary}\r\n`);
		parts.push(`Content-Disposition: form-data; name="${name}"`);
		if (isFile) parts.push(`; filename="${value.name}"`);
		parts.push('\r\n');
		if (isFile) parts.push('Content-Type: application/octet-stream\r\n');
		parts.push('\r\n');
		parts.push(
			isFile
				? new Uint8Array(await value.arrayBuffer())
				: (value as string | Uint8Array)
		);
		parts.push('\r\n');
	}
	parts.push(`--${boundary}--\r\n`);
	const encoder = new TextEncoder();
	const encoded = parts.map((part) =>
		typeof part === 'string' ? encoder.encode(part) : part
	);
	const length = encoded.reduce((total, part) => total + part.length, 0);
	const bytes = new Uint8Array(length);
	let offset = 0;
	for (const part of encoded) {
		bytes.set(part, offset);
		offset += part.length;
	}
	return { bytes, contentType };
}

function normalizeHeaders(
	value: unknown
): Array<{ name: string; value: string }> {
	if (value === undefined) return [];
	if (typeof value !== 'object' || value === null || Array.isArray(value))
		throw new NativeCLIError(
			NativeCLIErrorCode.InvalidRequest,
			'Request headers must be a record of string values.'
		);
	const headers: Array<{ name: string; value: string }> = [];
	for (const [name, item] of Object.entries(value)) {
		if (typeof item !== 'string')
			throw new NativeCLIError(
				NativeCLIErrorCode.InvalidRequest,
				`Request header \`${name}\` must be a string.`
			);
		headers.push({ name, value: item });
	}
	return headers;
}

function validateHandshake(
	value: unknown,
	expectedPid: number | undefined
): NativeControlHandshake {
	if (
		typeof value !== 'object' ||
		value === null ||
		(value as NativeControlHandshake).protocolVersion !==
			CONTROL_PROTOCOL_VERSION ||
		typeof (value as NativeControlHandshake).serverUrl !== 'string' ||
		typeof (value as NativeControlHandshake).nativeServerUrl !== 'string' ||
		typeof (value as NativeControlHandshake).controlUrl !== 'string' ||
		!Number.isInteger((value as NativeControlHandshake).workerCount) ||
		typeof (value as NativeControlHandshake).documentRoot !== 'string' ||
		!Number.isInteger((value as NativeControlHandshake).pid)
	) {
		throw new NativeCLIError(
			NativeCLIErrorCode.Startup,
			'The native control handshake is invalid or incompatible.'
		);
	}
	const handshake = value as NativeControlHandshake;
	if (expectedPid === undefined || handshake.pid !== expectedPid)
		throw new NativeCLIError(
			NativeCLIErrorCode.Startup,
			`The native control handshake PID ${handshake.pid} does not match child PID ${expectedPid ?? 'unknown'}.`
		);
	validateSiteUrl(handshake.serverUrl);
	validateLoopbackUrl('native server', handshake.nativeServerUrl, '/');
	validateLoopbackUrl('control', handshake.controlUrl, '/rpc');
	return handshake;
}

function validateSiteUrl(value: string): void {
	let url: URL;
	try {
		url = new URL(value);
	} catch (cause) {
		throw new NativeCLIError(
			NativeCLIErrorCode.Startup,
			'The native control handshake contains an invalid site URL.',
			{ cause }
		);
	}
	if (!['http:', 'https:'].includes(url.protocol))
		throw new NativeCLIError(
			NativeCLIErrorCode.Startup,
			'The native control handshake site URL must use HTTP or HTTPS.'
		);
}

function validateLoopbackUrl(
	label: string,
	value: string,
	expectedPath: string
): void {
	let url: URL;
	try {
		url = new URL(value);
	} catch (cause) {
		throw new NativeCLIError(
			NativeCLIErrorCode.Startup,
			`The native control handshake contains an invalid ${label} URL.`,
			{ cause }
		);
	}
	if (
		url.protocol !== 'http:' ||
		!['127.0.0.1', '::1', '[::1]', 'localhost'].includes(url.hostname) ||
		url.port === '' ||
		url.username !== '' ||
		url.password !== '' ||
		url.pathname !== expectedPath ||
		url.search !== '' ||
		url.hash !== ''
	)
		throw new NativeCLIError(
			NativeCLIErrorCode.Startup,
			`The native control handshake ${label} URL must be an unauthenticated loopback HTTP URL with path ${expectedPath}.`
		);
}

function encodeBinary(value: unknown): unknown {
	if (value instanceof Uint8Array)
		return {
			encoding: 'base64',
			data: Buffer.from(value).toString('base64'),
		};
	if (Array.isArray(value)) return value.map(encodeBinary);
	if (typeof value === 'object' && value !== null)
		return Object.fromEntries(
			Object.entries(value).map(([key, item]) => [
				key,
				encodeBinary(item),
			])
		);
	return value;
}

function decodeBinary(value: unknown, rpcMethod: string): unknown {
	if (value instanceof Uint8Array) return value;
	if (Array.isArray(value))
		return value.map((item) => decodeBinary(item, rpcMethod));
	if (typeof value === 'object' && value !== null) {
		const record = value as Record<string, unknown>;
		if (Object.prototype.hasOwnProperty.call(record, 'encoding'))
			return decodeTaggedBinary(record, rpcMethod);
		return Object.fromEntries(
			Object.entries(value).map(([key, item]) => [
				key,
				decodeBinary(item, rpcMethod),
			])
		);
	}
	return value;
}

function validateRPCResponse(
	value: unknown,
	expectedId: number,
	rpcMethod: string
): RPCResponse {
	if (typeof value !== 'object' || value === null || Array.isArray(value))
		throw protocolError(
			'Native control response envelope must be an object.',
			{
				rpcMethod,
			}
		);
	const response = value as Record<string, unknown>;
	if (response['protocolVersion'] !== CONTROL_PROTOCOL_VERSION)
		throw protocolError('Native control response protocol mismatch.', {
			rpcMethod,
		});
	if (response['id'] !== expectedId)
		throw protocolError('Native control response ID mismatch.', {
			rpcMethod,
		});
	const hasResult = Object.prototype.hasOwnProperty.call(response, 'result');
	const hasError = Object.prototype.hasOwnProperty.call(response, 'error');
	if (hasResult === hasError)
		throw protocolError(
			'Native control response must contain exactly one result or error.',
			{ rpcMethod }
		);
	if (hasError) {
		const error = response['error'];
		if (
			typeof error !== 'object' ||
			error === null ||
			Array.isArray(error) ||
			typeof (error as Record<string, unknown>)['code'] !== 'string' ||
			typeof (error as Record<string, unknown>)['message'] !== 'string'
		)
			throw protocolError('Native control response error is malformed.', {
				rpcMethod,
			});
	}
	return response as unknown as RPCResponse;
}

function asRecord(value: unknown): Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

export class NativePHPResponse {
	readonly headers: Record<string, string[]>;
	readonly bytes: Uint8Array;
	readonly errors: string;
	readonly exitCode: number;
	readonly httpStatusCode: number;

	constructor(
		httpStatusCode: number,
		headers: Record<string, string[]>,
		bytes: Uint8Array,
		errors = '',
		exitCode = 0
	) {
		this.httpStatusCode = httpStatusCode;
		this.headers = headers;
		this.bytes = bytes;
		this.errors = errors;
		this.exitCode = exitCode;
	}

	get text(): string {
		return new TextDecoder().decode(this.bytes);
	}

	get json(): unknown {
		return JSON.parse(this.text) as unknown;
	}

	ok(): boolean {
		return this.httpStatusCode >= 200 && this.httpStatusCode < 400;
	}

	toRawData(): {
		httpStatusCode: number;
		headers: Record<string, string[]>;
		bytes: Uint8Array;
		errors: string;
		exitCode: number;
	} {
		return {
			httpStatusCode: this.httpStatusCode,
			headers: this.headers,
			bytes: this.bytes,
			errors: this.errors,
			exitCode: this.exitCode,
		};
	}

	static fromRequestResult(value: unknown): NativePHPResponse {
		const result = bufferedResultRecord(value, 'request');
		const httpStatusCode = bufferedInteger(
			result['httpStatusCode'],
			'httpStatusCode',
			'request'
		);
		const exitCode = bufferedInteger(
			result['exitCode'],
			'exitCode',
			'request'
		);
		return new NativePHPResponse(
			httpStatusCode,
			headerRecord(result['headers']),
			bufferedBytes(result['body'], 'body', 'request'),
			new TextDecoder().decode(
				bufferedBytes(result['stderr'], 'stderr', 'request')
			),
			exitCode
		);
	}

	static fromRunResult(value: unknown): NativePHPResponse {
		const result = bufferedResultRecord(value, 'run');
		const httpStatusCode = bufferedInteger(
			result['httpStatusCode'],
			'httpStatusCode',
			'run'
		);
		const exitCode = bufferedInteger(result['exitCode'], 'exitCode', 'run');
		return new NativePHPResponse(
			httpStatusCode,
			headerRecord(result['headers']),
			bufferedBytes(result['stdout'], 'stdout', 'run'),
			new TextDecoder().decode(
				bufferedBytes(result['stderr'], 'stderr', 'run')
			),
			exitCode
		);
	}
}

export class PHPExecutionFailureError extends Error {
	readonly response: NativePHPResponse;
	readonly source: 'request' | 'php-wasm';

	constructor(
		message: string,
		response: NativePHPResponse,
		source: 'request' | 'php-wasm'
	) {
		super(message);
		this.name = 'PHPExecutionFailureError';
		this.response = response;
		this.source = source;
	}
}

interface Deferred<T> {
	promise: Promise<T>;
	resolve(value: T): void;
	reject(reason: unknown): void;
}

function deferred<T>(): Deferred<T> {
	let resolve!: (value: T) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	// Deferred values may reject before a consumer asks for a lazy response
	// property. Keep the rejection observable without triggering process-wide
	// unhandled-rejection behavior in the meantime.
	void promise.catch(() => undefined);
	return { promise, resolve, reject };
}

type StreamChannelName = 'stdout' | 'stderr';

interface SpoolFile {
	handle: FileHandle;
	readOffset: number;
	writeOffset: number;
}

class SharedStreamSpool {
	readonly #files = new Map<StreamChannelName, SpoolFile>();
	readonly #consumed = new Set<StreamChannelName>();
	readonly #cleanupListeners = new Set<() => void>();
	#directoryPromise?: Promise<string>;
	#cleanupPromise?: Promise<void>;
	#cleaned = false;

	async createFile(
		channel: StreamChannelName,
		chunks: readonly Uint8Array[]
	): Promise<SpoolFile> {
		if (this.#cleaned)
			throw spoolIOError('create a stream spool after cleanup');
		const existing = this.#files.get(channel);
		if (existing) return existing;
		try {
			const directory = await this.#directory();
			if (this.#cleaned)
				throw new Error(
					'The stream spool was cleaned before file creation.'
				);
			const handle = await openFile(
				join(directory, `${channel}.bin`),
				fsConstants.O_CREAT |
					fsConstants.O_EXCL |
					fsConstants.O_RDWR |
					(fsConstants.O_NOFOLLOW ?? 0),
				0o600
			);
			if (this.#cleaned) {
				await handle.close();
				throw new Error(
					'The stream spool was cleaned during file creation.'
				);
			}
			const file: SpoolFile = { handle, readOffset: 0, writeOffset: 0 };
			this.#files.set(channel, file);
			for (const chunk of chunks) await writeSpoolBytes(file, chunk);
			return file;
		} catch (cause) {
			await this.cleanup();
			throw spoolIOError(`create the ${channel} stream spool`, cause);
		}
	}

	markConsumed(channel: StreamChannelName): void {
		this.#consumed.add(channel);
		if (this.#consumed.size === 2) void this.cleanup();
	}

	onCleanup(listener: () => void): void {
		if (this.#cleaned) listener();
		else this.#cleanupListeners.add(listener);
	}

	cleanup(): Promise<void> {
		return (this.#cleanupPromise ??= this.#cleanup());
	}

	async #directory(): Promise<string> {
		return (this.#directoryPromise ??= (async () => {
			const directory = await mkdtemp(
				join(tmpdir(), STREAM_SPOOL_PREFIX)
			);
			await chmod(directory, 0o700);
			activeSpoolDirectories.add(directory);
			return directory;
		})());
	}

	async #cleanup(): Promise<void> {
		this.#cleaned = true;
		const directory = await this.#directoryPromise?.catch(() => undefined);
		await Promise.allSettled(
			[...this.#files.values()].map(({ handle }) => handle.close())
		);
		this.#files.clear();
		if (directory) {
			await rm(directory, { recursive: true, force: true }).catch(
				() => undefined
			);
			activeSpoolDirectories.delete(directory);
		}
		for (const listener of this.#cleanupListeners) listener();
		this.#cleanupListeners.clear();
	}
}

class DiskBackedByteStream {
	readonly stream: ReadableStream<Uint8Array>;
	readonly #channel: StreamChannelName;
	readonly #shared: SharedStreamSpool;
	#controller?: ReadableStreamDefaultController<Uint8Array>;
	#memoryFrames: Uint8Array[] = [];
	#spool?: SpoolFile;
	#spilling?: Promise<void>;
	#signal = deferred<void>();
	#ended = false;
	#consumed = false;
	#failure?: unknown;

	constructor(
		channel: StreamChannelName,
		shared: SharedStreamSpool,
		onCancel: () => Promise<void>
	) {
		this.#channel = channel;
		this.#shared = shared;
		this.stream = new ReadableStream<Uint8Array>(
			{
				start: (controller) => {
					this.#controller = controller;
				},
				pull: (controller) => this.#pull(controller),
				cancel: async () => {
					this.#markConsumed();
					await onCancel();
				},
			},
			{ highWaterMark: 0 }
		);
	}

	async write(bytes: Uint8Array): Promise<void> {
		if (bytes.length === 0) return;
		if (this.#failure) throw this.#failure;
		if (this.#ended)
			throw protocolError(
				`Native ${this.#channel} arrived after stream completion.`
			);
		if (this.#spool) {
			try {
				await writeSpoolBytes(this.#spool, bytes);
			} catch (cause) {
				throw this.#setFailure(
					spoolIOError(
						`write the ${this.#channel} stream spool`,
						cause
					)
				);
			}
			this.#notify();
			return;
		}
		if (this.#memoryFrames.length < STREAM_MEMORY_FRAME_LIMIT) {
			this.#memoryFrames.push(bytes);
			this.#notify();
			return;
		}
		const initial = [...this.#memoryFrames, bytes];
		this.#memoryFrames = [];
		this.#spilling = this.#shared
			.createFile(this.#channel, initial)
			.then((file) => {
				this.#spool = file;
			})
			.catch((cause) => {
				throw this.#setFailure(cause);
			})
			.finally(() => {
				this.#spilling = undefined;
				this.#notify();
			});
		await this.#spilling;
	}

	end(): void {
		if (this.#ended) return;
		this.#ended = true;
		this.#notify();
	}

	fail(reason: unknown): void {
		this.#setFailure(reason);
	}

	async #pull(
		controller: ReadableStreamDefaultController<Uint8Array>
	): Promise<void> {
		while (!this.#consumed) {
			if (this.#spilling) await this.#spilling;
			if (this.#failure) throw this.#failure;
			const memory = this.#memoryFrames.shift();
			if (memory) {
				controller.enqueue(memory);
				return;
			}
			if (
				this.#spool &&
				this.#spool.readOffset < this.#spool.writeOffset
			) {
				const remaining =
					this.#spool.writeOffset - this.#spool.readOffset;
				const buffer = new Uint8Array(
					Math.min(STREAM_FILE_READ_SIZE, remaining)
				);
				try {
					const { bytesRead } = await this.#spool.handle.read(
						buffer,
						0,
						buffer.length,
						this.#spool.readOffset
					);
					if (bytesRead <= 0)
						throw new Error('Unexpected end of stream spool file.');
					this.#spool.readOffset += bytesRead;
					controller.enqueue(buffer.subarray(0, bytesRead));
					return;
				} catch (cause) {
					throw this.#setFailure(
						spoolIOError(
							`read the ${this.#channel} stream spool`,
							cause
						)
					);
				}
			}
			if (this.#ended) {
				controller.close();
				this.#markConsumed();
				return;
			}
			const signal = this.#signal.promise;
			await signal;
		}
	}

	#markConsumed(): void {
		if (this.#consumed) return;
		this.#consumed = true;
		this.#shared.markConsumed(this.#channel);
	}

	#setFailure(reason: unknown): unknown {
		if (this.#failure) return this.#failure;
		this.#failure = reason;
		this.#ended = true;
		this.#memoryFrames = [];
		try {
			this.#controller?.error(reason);
		} catch {
			// The public stream may already be cancelled.
		}
		this.#notify();
		return reason;
	}

	#notify(): void {
		const signal = this.#signal;
		this.#signal = deferred<void>();
		signal.resolve();
	}
}

async function writeSpoolBytes(
	file: SpoolFile,
	bytes: Uint8Array
): Promise<void> {
	let offset = 0;
	while (offset < bytes.length) {
		const { bytesWritten } = await file.handle.write(
			bytes,
			offset,
			bytes.length - offset,
			file.writeOffset
		);
		if (bytesWritten <= 0)
			throw new Error('Stream spool write made no progress.');
		offset += bytesWritten;
		file.writeOffset += bytesWritten;
	}
}

function spoolIOError(operation: string, cause?: unknown): NativeCLIError {
	return new NativeCLIError(
		NativeCLIErrorCode.IO,
		`Could not ${operation}. The temporary stream spool may be full or unavailable.`,
		{ cause, details: { rpcMethod: 'requestStreamed' } }
	);
}

class AbandonedStreamLease {
	#remaining = 3;
	#active = true;
	readonly #spool: SharedStreamSpool;

	constructor(spool: SharedStreamSpool) {
		this.#spool = spool;
	}

	release(): void {
		if (!this.#active) return;
		this.#remaining--;
		if (this.#remaining === 0) void this.#spool.cleanup();
	}

	deactivate(): void {
		this.#active = false;
	}
}

const abandonedStreamFinalizer = new FinalizationRegistry<AbandonedStreamLease>(
	(lease) => lease.release()
);

export class NativeStreamedPHPResponse {
	readonly stdout: ReadableStream<Uint8Array>;
	readonly stderr: ReadableStream<Uint8Array>;
	readonly exitCode: Promise<number>;
	readonly #headers: Promise<{
		headers: Record<string, string[]>;
		httpStatusCode: number;
	}>;
	#stdoutBytes?: Promise<Uint8Array>;
	#stderrText?: Promise<string>;

	private constructor(
		headers: Promise<{
			headers: Record<string, string[]>;
			httpStatusCode: number;
		}>,
		stdout: ReadableStream<Uint8Array>,
		stderr: ReadableStream<Uint8Array>,
		exitCode: Promise<number>
	) {
		this.#headers = headers;
		this.stdout = stdout;
		this.stderr = stderr;
		this.exitCode = exitCode;
	}

	static fromControlStream(
		body: ReadableStream<Uint8Array>,
		id: number,
		cancel: () => Promise<void>,
		onFinished: () => void,
		redact: (message: string) => string,
		rpcMethod: 'requestStreamed' | 'cli' = 'requestStreamed'
	): NativeStreamedPHPResponse {
		const headerResult = deferred<{
			headers: Record<string, string[]>;
			httpStatusCode: number;
		}>();
		const exitResult = deferred<number>();
		const spool = new SharedStreamSpool();
		let active = true;
		const abort = async () => {
			if (!active) return;
			active = false;
			const error = new NativeCLIError(
				NativeCLIErrorCode.Aborted,
				'Native streamed request was aborted.'
			);
			headerResult.reject(error);
			exitResult.reject(error);
			stdout.fail(error);
			stderr.fail(error);
			await Promise.allSettled([cancel(), spool.cleanup()]);
			onFinished();
		};
		const stdout = new DiskBackedByteStream('stdout', spool, abort);
		const stderr = new DiskBackedByteStream('stderr', spool, abort);
		const response = new NativeStreamedPHPResponse(
			headerResult.promise,
			stdout.stream,
			stderr.stream,
			exitResult.promise
		);
		const lease = new AbandonedStreamLease(spool);
		spool.onCleanup(() => lease.deactivate());
		for (const target of [response, stdout.stream, stderr.stream])
			abandonedStreamFinalizer.register(target, lease);
		void pumpStreamFrames(
			body,
			id,
			stdout,
			stderr,
			headerResult,
			exitResult,
			redact,
			rpcMethod
		)
			.then(() => {
				active = false;
			})
			.catch((cause) => {
				active = false;
				void cancel();
				void spool.cleanup();
				headerResult.reject(cause);
				exitResult.reject(cause);
				stdout.fail(cause);
				stderr.fail(cause);
			})
			.finally(onFinished);
		return response;
	}

	get finished(): Promise<void> {
		return Promise.allSettled([this.exitCode]).then(() => undefined);
	}

	get headers(): Promise<Record<string, string[]>> {
		return this.#headers.then((value) => value.headers);
	}

	get httpStatusCode(): Promise<number> {
		return this.#headers.then((value) => value.httpStatusCode);
	}

	get stdoutBytes(): Promise<Uint8Array> {
		return (this.#stdoutBytes ??= streamToBytes(this.stdout));
	}

	get stdoutText(): Promise<string> {
		return this.stdoutBytes.then((bytes) =>
			new TextDecoder().decode(bytes)
		);
	}

	get stderrText(): Promise<string> {
		return (this.#stderrText ??= streamToBytes(this.stderr).then((bytes) =>
			new TextDecoder().decode(bytes)
		));
	}

	getHeadersStream(): ReadableStream<Uint8Array> {
		return new ReadableStream<Uint8Array>({
			start: async (controller) => {
				try {
					const { headers, httpStatusCode } = await this.#headers;
					const headerLines = Object.entries(headers).flatMap(
						([name, values]) =>
							values.map((value) => `${name}: ${value}`)
					);
					controller.enqueue(
						new TextEncoder().encode(
							JSON.stringify({
								status: httpStatusCode,
								headers: headerLines,
							})
						)
					);
					controller.close();
				} catch (cause) {
					controller.error(cause);
				}
			},
		});
	}

	async ok(): Promise<boolean> {
		try {
			const status = await this.httpStatusCode;
			return status >= 200 && status < 400;
		} catch {
			return false;
		}
	}
}

async function pumpStreamFrames(
	body: ReadableStream<Uint8Array>,
	id: number,
	stdout: DiskBackedByteStream,
	stderr: DiskBackedByteStream,
	headers: Deferred<{
		headers: Record<string, string[]>;
		httpStatusCode: number;
	}>,
	exitCode: Deferred<number>,
	redact: (message: string) => string,
	rpcMethod: 'requestStreamed' | 'cli'
): Promise<void> {
	let sawHeaders = false;
	let sawTerminal = false;
	let completedExitCode: number | undefined;
	let terminalError: NativeCLIError | undefined;
	let expectedSequence = 0;
	for await (const line of ndjsonLines(body)) {
		const frame = validateStreamFrame(line, id);
		if (sawTerminal)
			throw protocolError(
				'Native stream emitted a frame after termination.'
			);
		if (frame.type === 'error') {
			sawTerminal = true;
			terminalError = new NativeCLIError(
				asNativeCLIErrorCode(frame.error.code),
				redact(frame.error.message),
				{ details: { rpcMethod } }
			);
			continue;
		}
		if (frame.type === 'headers') {
			if (sawHeaders)
				throw protocolError('Native stream emitted duplicate headers.');
			sawHeaders = true;
			headers.resolve({
				httpStatusCode: frame.httpStatusCode,
				headers: headerRecord(frame.headers),
			});
			continue;
		}
		if (!sawHeaders)
			throw protocolError('Native stream emitted output before headers.');
		if (frame.type === 'stdout' || frame.type === 'stderr') {
			if (frame.sequence !== expectedSequence++)
				throw protocolError('Native stream frame sequence is invalid.');
			const bytes = strictBase64(frame.data.data);
			if (bytes.length > 64 * 1024)
				throw protocolError(
					'Native stream output frame exceeds 64 KiB.'
				);
			await (frame.type === 'stdout' ? stdout : stderr).write(bytes);
			continue;
		}
		if (frame.type === 'complete') {
			sawTerminal = true;
			completedExitCode = frame.exitCode;
			stdout.end();
			stderr.end();
			continue;
		}
		throw protocolError('Native stream frame type is unsupported.');
	}
	if (terminalError) throw terminalError;
	if (!sawTerminal)
		throw protocolError('Native stream ended before its completion frame.');
	exitCode.resolve(completedExitCode!);
}

async function* ndjsonLines(
	stream: ReadableStream<Uint8Array>
): AsyncGenerator<string> {
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	let pending = '';
	try {
		while (true) {
			const { done, value } = await reader.read();
			pending += done
				? decoder.decode()
				: decoder.decode(value, { stream: true });
			let newline: number;
			while ((newline = pending.indexOf('\n')) !== -1) {
				const line = pending.slice(0, newline).replace(/\r$/, '');
				pending = pending.slice(newline + 1);
				if (Buffer.byteLength(line) > MAX_STREAM_LINE_BYTES)
					throw protocolError(
						'Native stream contains an oversized NDJSON line.'
					);
				if (line.length > 0) yield line;
			}
			if (Buffer.byteLength(pending) > MAX_STREAM_LINE_BYTES)
				throw protocolError(
					'Native stream contains an oversized NDJSON line.'
				);
			if (done) break;
		}
		if (pending.length > 0) yield pending;
	} finally {
		reader.releaseLock();
	}
}

function validateStreamFrame(line: string, expectedId: number): StreamFrame {
	let value: unknown;
	try {
		value = JSON.parse(line);
	} catch (cause) {
		throw protocolError('Native stream contains invalid JSON.', { cause });
	}
	if (typeof value !== 'object' || value === null || Array.isArray(value))
		throw protocolError('Native stream frame must be an object.');
	const frame = value as Record<string, unknown>;
	if (frame['protocolVersion'] !== CONTROL_PROTOCOL_VERSION)
		throw protocolError('Native stream frame protocol mismatch.');
	if (frame['id'] !== expectedId)
		throw protocolError('Native stream frame ID mismatch.');
	const type = frame['type'];
	if (type === 'headers') {
		assertExactFrameKeys(frame, [
			'protocolVersion',
			'id',
			'type',
			'httpStatusCode',
			'headers',
		]);
		if (
			!Number.isInteger(frame['httpStatusCode']) ||
			!Array.isArray(frame['headers'])
		)
			throw protocolError('Native headers frame is malformed.');
		for (const header of frame['headers']) {
			const item = asRecord(header);
			if (
				Object.keys(item).sort().join(',') !== 'name,value' ||
				typeof item['name'] !== 'string' ||
				typeof item['value'] !== 'string'
			)
				throw protocolError(
					'Native headers frame contains a malformed header.'
				);
		}
		return frame as unknown as StreamHeadersFrame;
	}
	if (type === 'stdout' || type === 'stderr') {
		assertExactFrameKeys(frame, [
			'protocolVersion',
			'id',
			'type',
			'sequence',
			'data',
		]);
		const data = asRecord(frame['data']);
		if (
			!Number.isInteger(frame['sequence']) ||
			Object.keys(data).sort().join(',') !== 'data,encoding' ||
			data['encoding'] !== 'base64' ||
			typeof data['data'] !== 'string'
		)
			throw protocolError('Native output frame is malformed.');
		return frame as unknown as StreamOutputFrame;
	}
	if (type === 'complete') {
		assertExactFrameKeys(frame, [
			'protocolVersion',
			'id',
			'type',
			'exitCode',
		]);
		if (!Number.isInteger(frame['exitCode']))
			throw protocolError('Native completion frame is malformed.');
		return frame as unknown as StreamCompleteFrame;
	}
	if (type === 'error') {
		assertExactFrameKeys(frame, ['protocolVersion', 'id', 'type', 'error']);
		const error = asRecord(frame['error']);
		if (
			Object.keys(error).sort().join(',') !== 'code,message' ||
			typeof error['code'] !== 'string' ||
			typeof error['message'] !== 'string'
		)
			throw protocolError('Native error frame is malformed.');
		return frame as unknown as StreamErrorFrame;
	}
	throw protocolError('Native stream frame type is unsupported.');
}

function assertExactFrameKeys(
	frame: Record<string, unknown>,
	expected: readonly string[]
): void {
	const actual = Object.keys(frame).sort();
	const wanted = [...expected].sort();
	if (
		actual.length !== wanted.length ||
		actual.some((key, index) => key !== wanted[index])
	)
		throw protocolError('Native stream frame contains unexpected fields.');
}

function strictBase64(value: string): Uint8Array {
	return canonicalBase64(
		value,
		'Native stream output is not valid canonical base64.'
	);
}

function canonicalBase64(
	value: string,
	message: string,
	rpcMethod?: string
): Uint8Array {
	if (
		!/^(?:[A-Za-z\d+/]{4})*(?:[A-Za-z\d+/]{2}==|[A-Za-z\d+/]{3}=)?$/.test(
			value
		)
	)
		throw protocolError(message, { rpcMethod });
	const decoded = Buffer.from(value, 'base64');
	if (decoded.toString('base64') !== value)
		throw protocolError(message, { rpcMethod });
	return new Uint8Array(decoded);
}

async function streamToBytes(
	stream: ReadableStream<Uint8Array>
): Promise<Uint8Array> {
	const chunks: Uint8Array[] = [];
	let length = 0;
	const reader = stream.getReader();
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			chunks.push(value);
			length += value.length;
		}
	} finally {
		reader.releaseLock();
	}
	const output = new Uint8Array(length);
	let offset = 0;
	for (const chunk of chunks) {
		output.set(chunk, offset);
		offset += chunk.length;
	}
	return output;
}

function decodeTaggedBinary(
	value: Record<string, unknown>,
	rpcMethod: string
): Uint8Array {
	if (
		Object.keys(value).sort().join(',') !== 'data,encoding' ||
		value['encoding'] !== 'base64' ||
		typeof value['data'] !== 'string'
	)
		throw protocolError(
			'Native control response contains malformed tagged binary data.',
			{ rpcMethod }
		);
	return canonicalBase64(
		value['data'],
		'Native control response contains non-canonical base64 data.',
		rpcMethod
	);
}

function bufferedResultRecord(
	value: unknown,
	rpcMethod: 'request' | 'run'
): Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value))
		throw protocolError(`Native ${rpcMethod} response must be an object.`, {
			rpcMethod,
		});
	return value as Record<string, unknown>;
}

function bufferedInteger(
	value: unknown,
	field: 'httpStatusCode' | 'exitCode',
	rpcMethod: 'request' | 'run'
): number {
	if (!Number.isInteger(value))
		throw protocolError(
			`Native ${rpcMethod} response has an invalid ${field}.`,
			{ rpcMethod }
		);
	return value as number;
}

function bufferedBytes(
	value: unknown,
	field: 'body' | 'stdout' | 'stderr',
	rpcMethod: 'request' | 'run'
): Uint8Array {
	if (!(value instanceof Uint8Array))
		throw protocolError(
			`Native ${rpcMethod} response requires tagged binary ${field}.`,
			{ rpcMethod }
		);
	return value;
}

function headerRecord(value: unknown): Record<string, string[]> {
	const output: Record<string, string[]> = {};
	if (!Array.isArray(value))
		throw protocolError('Native response headers must be an array.');
	for (const item of value) {
		const header = asRecord(item);
		if (
			Object.keys(header).sort().join(',') !== 'name,value' ||
			typeof header['name'] !== 'string' ||
			typeof header['value'] !== 'string'
		)
			throw protocolError('Native response contains a malformed header.');
		(output[header['name'].toLowerCase()] ??= []).push(header['value']);
	}
	return output;
}

class NativeEventBridge {
	readonly #client: NativeControlClient;
	readonly #listeners = new Map<string, Set<NativeEventListener>>();
	#controller?: AbortController;
	#loop?: Promise<void>;
	#closed = false;
	#shutdownReceived = false;
	#runtimeInitializedDispatched = false;
	#runtimeBeforeExitDispatched = false;

	constructor(client: NativeControlClient) {
		this.#client = client;
		client.onClose(() => this.#close());
	}

	add(type: string, listener: NativeEventListener): void {
		let listeners = this.#listeners.get(type);
		if (!listeners) this.#listeners.set(type, (listeners = new Set()));
		listeners.add(listener);
		if (!this.#loop && !this.#closed) {
			const loop = this.#connectLoop().finally(() => {
				if (this.#loop === loop) this.#loop = undefined;
			});
			this.#loop = loop;
		}
	}

	remove(type: string, listener: NativeEventListener): void {
		this.#listeners.get(type)?.delete(listener);
		if (!this.#hasListeners()) this.#controller?.abort();
	}

	async #connectLoop(): Promise<void> {
		let backoffMs = 25;
		while (
			!this.#closed &&
			!this.#shutdownReceived &&
			this.#hasListeners()
		) {
			const controller = new AbortController();
			this.#controller = controller;
			let eventCount = 0;
			try {
				const response = await fetch(this.#client.eventsUrl, {
					headers: { authorization: `Bearer ${this.#client.token}` },
					signal: controller.signal,
				});
				if (!response.ok || !response.body)
					throw protocolError(
						`Native event stream failed with HTTP ${response.status}.`
					);
				eventCount = await this.#consume(response.body);
			} catch (cause) {
				if (!controller.signal.aborted && !this.#closed)
					this.#dispatch(
						`event: request.error\ndata: ${JSON.stringify({ protocolVersion: 2, error: String(cause) })}`
					);
			} finally {
				if (this.#controller === controller)
					this.#controller = undefined;
			}
			if (this.#closed || this.#shutdownReceived || !this.#hasListeners())
				break;
			backoffMs = eventCount > 0 ? 25 : Math.min(backoffMs * 2, 1_000);
			await new Promise((resolve) => setTimeout(resolve, backoffMs));
		}
	}

	async #consume(stream: ReadableStream<Uint8Array>): Promise<number> {
		const decoder = new TextDecoder();
		let pending = '';
		let eventCount = 0;
		const drain = (flush: boolean) => {
			while (true) {
				const match = /\r?\n\r?\n/.exec(pending);
				if (!match) break;
				const message = pending.slice(0, match.index);
				pending = pending.slice(match.index + match[0].length);
				assertEventMessageSize(message);
				if (this.#dispatch(message)) eventCount++;
			}
			if (flush && pending.trim() !== '') {
				assertEventMessageSize(pending);
				if (this.#dispatch(pending)) eventCount++;
				pending = '';
			}
		};
		for await (const chunk of readableStreamIterator(stream)) {
			pending += decoder.decode(chunk, { stream: true });
			drain(false);
			if (Buffer.byteLength(pending) > MAX_STREAM_LINE_BYTES)
				throw protocolError(
					'Native event stream message is oversized.'
				);
		}
		pending += decoder.decode();
		drain(true);
		return eventCount;
	}

	#dispatch(message: string): boolean {
		let type = '';
		const dataLines: string[] = [];
		for (const line of message.split('\n')) {
			const normalized = line.replace(/\r$/, '');
			if (normalized.startsWith(':') || normalized.length === 0) continue;
			if (normalized.startsWith('event:'))
				type = normalized.slice(6).trim();
			if (normalized.startsWith('data:'))
				dataLines.push(normalized.slice(5).trimStart());
		}
		const data = dataLines.join('\n');
		if (!nativeWireEventTypes.has(type) || !data) return false;
		let parsed: unknown;
		try {
			parsed = JSON.parse(data);
		} catch {
			return false;
		}
		parsed = redactEventValue(parsed, (message) =>
			this.#client.sanitize(message)
		);
		if (
			typeof parsed !== 'object' ||
			parsed === null ||
			(parsed as { protocolVersion?: unknown }).protocolVersion !== 2
		)
			return false;
		let event: NativeDispatchedEvent;
		if (type === 'request.error') {
			const payload = parsed as Record<string, unknown>;
			const wireError = asRecord(payload['error']);
			const error = new Error(
				typeof wireError['message'] === 'string'
					? this.#client.sanitize(wireError['message'])
					: typeof payload['error'] === 'string'
						? this.#client.sanitize(payload['error'])
						: 'Native PHP request failed.'
			);
			if (typeof wireError['code'] === 'string')
				Object.defineProperty(error, 'code', {
					value: wireError['code'],
					enumerable: true,
				});
			event = {
				type,
				error,
				source:
					payload['source'] === 'request' ||
					payload['source'] === 'php-wasm'
						? payload['source']
						: undefined,
				data: parsed,
			};
		} else if (type === 'request.end' || type === 'filesystem.write')
			event = { type, data: parsed };
		else event = new MessageEvent(type, { data: parsed });
		if (type === 'ready') {
			this.#emit(type, event);
			this.#emitRuntimeInitialized();
		} else if (type === 'shutdown') {
			this.#emitRuntimeBeforeExit();
			this.#emit(type, event);
			this.#shutdownReceived = true;
		} else {
			this.#emit(type, event, true);
		}
		return true;
	}

	#emit(
		type: string,
		event: NativeDispatchedEvent,
		includeWildcard = false
	): void {
		const listeners = new Set(this.#listeners.get(type));
		if (includeWildcard)
			for (const listener of this.#listeners.get('*') ?? [])
				listeners.add(listener);
		for (const listener of listeners) {
			try {
				listener(event);
			} catch {
				// One consumer must not disconnect the shared event stream.
			}
		}
	}

	#emitRuntimeInitialized(): void {
		if (this.#runtimeInitializedDispatched) return;
		this.#runtimeInitializedDispatched = true;
		this.#emit(
			'runtime.initialized',
			{ type: 'runtime.initialized' },
			true
		);
	}

	#emitRuntimeBeforeExit(): void {
		if (this.#runtimeBeforeExitDispatched) return;
		this.#runtimeBeforeExitDispatched = true;
		this.#emit('runtime.beforeExit', { type: 'runtime.beforeExit' }, true);
	}

	#hasListeners(): boolean {
		return [...this.#listeners.values()].some(
			(listeners) => listeners.size > 0
		);
	}

	#close(): void {
		if (this.#closed) return;
		this.#closed = true;
		this.#emitRuntimeBeforeExit();
		this.#listeners.clear();
		this.#controller?.abort();
	}
}

function assertEventMessageSize(message: string): void {
	if (Buffer.byteLength(message) > MAX_STREAM_LINE_BYTES)
		throw protocolError('Native event stream message is oversized.');
}

type NativeDispatchedEvent =
	| MessageEvent<unknown>
	| { type: 'request.end' | 'filesystem.write'; data: unknown }
	| { type: 'runtime.initialized' | 'runtime.beforeExit' }
	| {
			type: 'request.error';
			error: Error;
			source?: 'request' | 'php-wasm';
			data: unknown;
	  };

type NativeEventListener = (event: NativeDispatchedEvent) => void;

function redactEventValue(
	value: unknown,
	redact: (message: string) => string
): unknown {
	if (typeof value === 'string') return redact(value);
	if (Array.isArray(value))
		return value.map((item) => redactEventValue(item, redact));
	if (typeof value === 'object' && value !== null)
		return Object.fromEntries(
			Object.entries(value).map(([key, item]) => [
				key,
				redactEventValue(item, redact),
			])
		);
	return value;
}

async function* readableStreamIterator(
	stream: ReadableStream<Uint8Array>
): AsyncGenerator<Uint8Array> {
	const reader = stream.getReader();
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) return;
			yield value;
		}
	} finally {
		reader.releaseLock();
	}
}

async function responseError(
	response: Response,
	method: string,
	token: string
): Promise<NativeCLIError> {
	let body: RPCResponse | undefined;
	try {
		body = (await response.json()) as RPCResponse;
	} catch {
		// The status code still provides a stable category.
	}
	const statusCode =
		response.status === 401 || response.status === 403
			? NativeCLIErrorCode.Auth
			: response.status === 413
				? NativeCLIErrorCode.RequestTooLarge
				: response.status === 429 || response.status === 503
					? NativeCLIErrorCode.Busy
					: NativeCLIErrorCode.Protocol;
	return new NativeCLIError(
		body?.error?.code ? asNativeCLIErrorCode(body.error.code) : statusCode,
		sanitizeMessage(
			body?.error?.message ??
				`Native control request ${method} failed with HTTP ${response.status}.`,
			token
		),
		{ details: { rpcMethod: method, httpStatus: response.status } }
	);
}

function sanitizeMessage(message: string, token: string): string {
	return message.replaceAll(token, '[redacted]');
}

function protocolError(
	message: string,
	options?: { cause?: unknown; rpcMethod?: string }
): NativeCLIError {
	return new NativeCLIError(NativeCLIErrorCode.Protocol, message, {
		cause: options?.cause,
		details: options?.rpcMethod
			? { rpcMethod: options.rpcMethod }
			: undefined,
	});
}
