import type { ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { chmod, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NativeCLIError, NativeCLIErrorCode } from './errors.js';

export interface NativeControlHandshake {
	protocolVersion: 1;
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
	error?: { code?: string; message?: string; data?: unknown };
}

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
					NativeCLIErrorCode.Protocol,
					'The native CLI failed before creating its control handshake.',
					{ cause: childError }
				);
			}
			if (child.exitCode !== null || child.signalCode !== null) {
				throw new NativeCLIError(
					NativeCLIErrorCode.Protocol,
					`The native CLI exited before creating its control handshake (exit ${child.exitCode ?? child.signalCode}).`
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
				else
					throw new NativeCLIError(
						NativeCLIErrorCode.Protocol,
						'The native control handshake is not valid JSON.',
						{ cause }
					);
			}
			await new Promise((resolvePromise) =>
				setTimeout(resolvePromise, 50)
			);
		}
		throw new NativeCLIError(
			NativeCLIErrorCode.Protocol,
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
	#nextId = 1;
	#closed = false;

	constructor(controlUrl: string, token: string) {
		this.#url = new URL(controlUrl);
		if (
			!['127.0.0.1', '::1', '[::1]', 'localhost'].includes(
				this.#url.hostname
			)
		) {
			throw new NativeCLIError(
				NativeCLIErrorCode.Protocol,
				'Native control endpoints must bind to loopback.'
			);
		}
		this.#token = token;
	}

	async call(method: string, params: unknown = {}): Promise<unknown> {
		if (this.#closed)
			throw new NativeCLIError(
				NativeCLIErrorCode.Protocol,
				'Native control client is closed.'
			);
		const id = this.#nextId++;
		let response: Response;
		try {
			response = await fetch(new URL('/rpc', this.#url), {
				method: 'POST',
				headers: {
					authorization: `Bearer ${this.#token}`,
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					protocolVersion: 1,
					id,
					method,
					params: encodeBinary(params),
				}),
			});
		} catch (cause) {
			throw new NativeCLIError(
				NativeCLIErrorCode.Protocol,
				`Native control request ${method} failed.`,
				{ cause }
			);
		}
		if (!response.ok) {
			throw new NativeCLIError(
				NativeCLIErrorCode.Protocol,
				`Native control request ${method} failed with HTTP ${response.status}.`
			);
		}
		const body = (await response.json()) as RPCResponse;
		if (body.protocolVersion !== 1)
			throw new NativeCLIError(
				NativeCLIErrorCode.Protocol,
				'Native control response protocol mismatch.'
			);
		if (body.id !== id)
			throw new NativeCLIError(
				NativeCLIErrorCode.Protocol,
				'Native control response ID mismatch.'
			);
		if (body.error) {
			const error = new NativeCLIError(
				body.error.code === NativeCLIErrorCode.Unsupported
					? NativeCLIErrorCode.Unsupported
					: NativeCLIErrorCode.Protocol,
				body.error.message ?? `Native control method ${method} failed.`
			);
			throw error;
		}
		return decodeBinary(body.result);
	}

	close(): void {
		this.#closed = true;
	}

	get eventsUrl(): URL {
		return new URL('/events', this.#url);
	}

	get token(): string {
		return this.#token;
	}
}

export function createPlaygroundProxy(
	client: NativeControlClient
): Record<string, unknown> {
	const eventBridge = new NativeEventBridge(client);
	const properties = new Set(['absoluteUrl', 'documentRoot']);
	return new Proxy<Record<string, unknown>>(
		{},
		{
			get(_target, property) {
				if (typeof property !== 'string') return undefined;
				if (properties.has(property)) return client.call(property);
				if (property === 'addEventListener') {
					return (type: string, listener: EventListener) => {
						assertSupportedEventType(type);
						eventBridge.add(type, listener);
					};
				}
				if (property === 'removeEventListener') {
					return (type: string, listener: EventListener) => {
						assertSupportedEventType(type);
						eventBridge.remove(type, listener);
					};
				}
				if (property === 'onMessage') {
					return () => {
						throw new NativeCLIError(
							NativeCLIErrorCode.Unsupported,
							'The native control protocol does not expose PHP worker message events yet.'
						);
					};
				}
				return (...args: unknown[]) =>
					callPlaygroundMethod(client, property, args);
			},
		}
	);
}

function assertSupportedEventType(type: string): void {
	if (type === 'ready' || type === 'shutdown') return;
	throw new NativeCLIError(
		NativeCLIErrorCode.Unsupported,
		`The native control protocol only exposes ready and shutdown lifecycle events; ${type} is not supported.`
	);
}

function validateHandshake(
	value: unknown,
	expectedPid: number | undefined
): NativeControlHandshake {
	if (
		typeof value !== 'object' ||
		value === null ||
		(value as NativeControlHandshake).protocolVersion !== 1 ||
		typeof (value as NativeControlHandshake).serverUrl !== 'string' ||
		typeof (value as NativeControlHandshake).nativeServerUrl !== 'string' ||
		typeof (value as NativeControlHandshake).controlUrl !== 'string' ||
		!Number.isInteger((value as NativeControlHandshake).workerCount) ||
		typeof (value as NativeControlHandshake).documentRoot !== 'string' ||
		!Number.isInteger((value as NativeControlHandshake).pid)
	) {
		throw new NativeCLIError(
			NativeCLIErrorCode.Protocol,
			'The native control handshake is invalid or incompatible.'
		);
	}
	const handshake = value as NativeControlHandshake;
	if (expectedPid === undefined || handshake.pid !== expectedPid) {
		throw new NativeCLIError(
			NativeCLIErrorCode.Protocol,
			`The native control handshake PID ${handshake.pid} does not match child PID ${expectedPid ?? 'unknown'}.`
		);
	}
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
			NativeCLIErrorCode.Protocol,
			'The native control handshake contains an invalid site URL.',
			{ cause }
		);
	}
	if (!['http:', 'https:'].includes(url.protocol)) {
		throw new NativeCLIError(
			NativeCLIErrorCode.Protocol,
			'The native control handshake site URL must use HTTP or HTTPS.'
		);
	}
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
			NativeCLIErrorCode.Protocol,
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
		url.pathname !== expectedPath
	) {
		throw new NativeCLIError(
			NativeCLIErrorCode.Protocol,
			`The native control handshake ${label} URL must be an unauthenticated loopback HTTP URL with path ${expectedPath}.`
		);
	}
}

function encodeBinary(value: unknown): unknown {
	if (value instanceof Uint8Array) {
		return {
			encoding: 'base64',
			data: Buffer.from(value).toString('base64'),
		};
	}
	if (Array.isArray(value)) return value.map(encodeBinary);
	if (typeof value === 'object' && value !== null) {
		return Object.fromEntries(
			Object.entries(value).map(([key, item]) => [
				key,
				encodeBinary(item),
			])
		);
	}
	return value;
}

function decodeBinary(value: unknown): unknown {
	if (value instanceof Uint8Array) return value;
	if (
		typeof value === 'object' &&
		value !== null &&
		(value as { encoding?: unknown }).encoding === 'base64' &&
		typeof (value as { data?: unknown }).data === 'string'
	) {
		return new Uint8Array(
			Buffer.from((value as { data: string }).data, 'base64')
		);
	}
	if (Array.isArray(value)) return value.map(decodeBinary);
	if (typeof value === 'object' && value !== null) {
		return Object.fromEntries(
			Object.entries(value).map(([key, item]) => [
				key,
				decodeBinary(item),
			])
		);
	}
	return value;
}

async function callPlaygroundMethod(
	client: NativeControlClient,
	method: string,
	args: unknown[]
): Promise<unknown> {
	if (method === 'requestStreamed') {
		const response = await callPlaygroundMethod(client, 'request', args);
		return NativeStreamedPHPResponse.fromPHPResponse(
			response as NativePHPResponse
		);
	}
	if (method === 'cli') {
		throw new NativeCLIError(
			NativeCLIErrorCode.Unsupported,
			'The native control protocol does not support `cli`.'
		);
	}
	const params = playgroundParams(method, args);
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
	return result;
}

function playgroundParams(method: string, args: unknown[]): unknown {
	if (method === 'request') {
		assertArgumentCount(method, args, 1);
		const params = asRecord(args[0]);
		assertObjectKeys(method, params, [
			'url',
			'path',
			'method',
			'headers',
			'body',
		]);
		return {
			path: params['path'] ?? params['url'],
			method: params['method'],
			headers: normalizeHeaders(params['headers']),
			body: encodeBytes(params['body']),
		};
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
		if (
			params['server'] !== undefined &&
			params['$_SERVER'] !== undefined
		) {
			throw new NativeCLIError(
				NativeCLIErrorCode.Unsupported,
				'Pass either `server` or `$_SERVER` to `run`, not both.'
			);
		}
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
			'rmdir',
			'listFiles',
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
		return { name: args[0], value: args[1] };
	}
	if (method === 'internalUrlToPath') {
		assertArgumentCount(method, args, 1);
		return { url: args[0] };
	}
	assertArgumentCount(method, args, 0);
	return {};
}

function assertArgumentCount(
	method: string,
	args: unknown[],
	expected: number
): void {
	if (args.length === expected) return;
	throw new NativeCLIError(
		NativeCLIErrorCode.Unsupported,
		`The native control method \`${method}\` accepts ${expected} argument${expected === 1 ? '' : 's'}; additional options are not supported.`
	);
}

function assertObjectKeys(
	method: string,
	value: Record<string, unknown>,
	allowed: string[]
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
		NativeCLIErrorCode.Unsupported,
		'The native control protocol currently accepts request bodies only as strings or Uint8Array values.'
	);
}

function normalizeHeaders(
	value: unknown
): Array<{ name: string; value: string }> {
	if (Array.isArray(value))
		return value as Array<{ name: string; value: string }>;
	if (typeof value !== 'object' || value === null) return [];
	const headers: Array<{ name: string; value: string }> = [];
	for (const [name, values] of Object.entries(value)) {
		for (const item of Array.isArray(values) ? values : [values]) {
			headers.push({ name, value: String(item) });
		}
	}
	return headers;
}

function asRecord(value: unknown): Record<string, unknown> {
	return typeof value === 'object' && value !== null
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
		const result = asRecord(value);
		return new NativePHPResponse(
			Number(result['httpStatusCode']),
			headerRecord(result['headers']),
			bytesValue(result['body'])
		);
	}

	static fromRunResult(value: unknown): NativePHPResponse {
		const result = asRecord(value);
		return new NativePHPResponse(
			Number(result['httpStatusCode']),
			headerRecord(result['headers']),
			bytesValue(result['stdout']),
			new TextDecoder().decode(bytesValue(result['stderr'])),
			Number(result['exitCode'])
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

export class NativeStreamedPHPResponse {
	readonly stdout: ReadableStream<Uint8Array>;
	readonly stderr: ReadableStream<Uint8Array>;
	readonly exitCode: Promise<number>;
	readonly #response: NativePHPResponse;

	private constructor(response: NativePHPResponse) {
		this.#response = response;
		this.stdout = bytesStream(response.bytes);
		this.stderr = bytesStream(new TextEncoder().encode(response.errors));
		this.exitCode = Promise.resolve(response.exitCode);
	}

	static fromPHPResponse(
		response: NativePHPResponse
	): NativeStreamedPHPResponse {
		return new NativeStreamedPHPResponse(response);
	}

	get finished(): Promise<void> {
		return this.exitCode.then(() => undefined);
	}

	get headers(): Promise<Record<string, string[]>> {
		return Promise.resolve(this.#response.headers);
	}

	get httpStatusCode(): Promise<number> {
		return Promise.resolve(this.#response.httpStatusCode);
	}

	get stdoutBytes(): Promise<Uint8Array> {
		return Promise.resolve(this.#response.bytes);
	}

	get stdoutText(): Promise<string> {
		return Promise.resolve(this.#response.text);
	}

	get stderrText(): Promise<string> {
		return Promise.resolve(this.#response.errors);
	}

	getHeadersStream(): ReadableStream<Uint8Array> {
		const headerLines: string[] = [];
		for (const [name, values] of Object.entries(this.#response.headers)) {
			for (const value of values) headerLines.push(`${name}: ${value}`);
		}
		return bytesStream(
			new TextEncoder().encode(
				JSON.stringify({
					status: this.#response.httpStatusCode,
					headers: headerLines,
				})
			)
		);
	}

	async ok(): Promise<boolean> {
		return this.#response.ok();
	}
}

function bytesStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
	return new ReadableStream<Uint8Array>({
		start(controller) {
			if (bytes.length > 0) controller.enqueue(bytes);
			controller.close();
		},
	});
}

function bytesValue(value: unknown): Uint8Array {
	const decoded = decodeBinary(value);
	return decoded instanceof Uint8Array ? decoded : new Uint8Array();
}

function headerRecord(value: unknown): Record<string, string[]> {
	const output: Record<string, string[]> = {};
	if (!Array.isArray(value)) return output;
	for (const item of value) {
		const header = asRecord(item);
		if (
			typeof header['name'] !== 'string' ||
			typeof header['value'] !== 'string'
		)
			continue;
		(output[header['name'].toLowerCase()] ??= []).push(header['value']);
	}
	return output;
}

class NativeEventBridge {
	readonly #client: NativeControlClient;
	readonly #listeners = new Map<string, Set<EventListener>>();
	#controller?: AbortController;

	constructor(client: NativeControlClient) {
		this.#client = client;
	}

	add(type: string, listener: EventListener): void {
		let listeners = this.#listeners.get(type);
		if (!listeners) this.#listeners.set(type, (listeners = new Set()));
		listeners.add(listener);
		if (!this.#controller) void this.#connect();
	}

	remove(type: string, listener: EventListener): void {
		this.#listeners.get(type)?.delete(listener);
		if (
			[...this.#listeners.values()].every(
				(listeners) => listeners.size === 0
			)
		) {
			this.#controller?.abort();
			this.#controller = undefined;
		}
	}

	async #connect(): Promise<void> {
		this.#controller = new AbortController();
		try {
			const response = await fetch(this.#client.eventsUrl, {
				headers: { authorization: `Bearer ${this.#client.token}` },
				signal: this.#controller.signal,
			});
			if (!response.ok || !response.body) return;
			let pending = '';
			for await (const chunk of ReadableStreamIterator(response.body)) {
				pending += new TextDecoder().decode(chunk, { stream: true });
				let boundary: number;
				while ((boundary = pending.indexOf('\n\n')) !== -1) {
					const message = pending.slice(0, boundary);
					pending = pending.slice(boundary + 2);
					this.#dispatch(message);
				}
			}
		} catch (cause) {
			if (!this.#controller?.signal.aborted)
				this.#dispatch(
					`event: error\ndata: ${JSON.stringify(String(cause))}`
				);
		}
	}

	#dispatch(message: string): void {
		let type = 'message';
		let data = '';
		let hasEventField = false;
		let hasDataField = false;
		for (const line of message.split('\n')) {
			if (line.startsWith(':') || line.length === 0) continue;
			if (line.startsWith('event:')) {
				type = line.slice(6).trim();
				hasEventField = true;
			}
			if (line.startsWith('data:')) {
				data += line.slice(5).trim();
				hasDataField = true;
			}
		}
		if (!hasEventField && !hasDataField) return;
		let parsed: unknown;
		try {
			parsed = data ? JSON.parse(data) : undefined;
		} catch {
			parsed = data;
		}
		const event = new MessageEvent(type, { data: parsed });
		for (const listener of this.#listeners.get(type) ?? []) listener(event);
	}
}

async function* ReadableStreamIterator(
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
