import { normalizePath } from '@php-wasm/util';

export const OPENER_BLUEPRINT_PROTOCOL_VERSION = 1;
export const OPENER_BLUEPRINT_MAX_FILES = 200;
export const OPENER_BLUEPRINT_MAX_TOTAL_BYTES = 512 * 1024 * 1024;

export type OpenerBlueprintFile = {
	name: string;
	bytes: ArrayBuffer;
	mimeType?: string;
	destination: 'vfs' | 'media-library';
	path?: string;
};

export type OpenerBlueprintRun = {
	runId: string;
	blueprint: Record<string, unknown>;
	files: OpenerBlueprintFile[];
};

type ValidatedOpenerBlueprintRun = Omit<OpenerBlueprintRun, 'runId'>;

export type OpenerBlueprintReceiverState =
	| 'waiting'
	| 'booting'
	| 'booted'
	| 'error';

type PostMessageTarget = Pick<Window, 'postMessage'>;

type ReceiverWindow = {
	opener: PostMessageTarget | null;
	addEventListener(
		type: 'message',
		listener: (event: MessageEvent) => void
	): void;
	removeEventListener(
		type: 'message',
		listener: (event: MessageEvent) => void
	): void;
};

type ProtocolMessage = {
	type: string;
	protocolVersion: typeof OPENER_BLUEPRINT_PROTOCOL_VERSION;
	[key: string]: unknown;
};

let activeReceiver: OpenerBlueprintReceiver | undefined;

export function initializeOpenerBlueprintReceiver(
	url: URL = new URL(window.location.href),
	host: ReceiverWindow = window
): OpenerBlueprintReceiver | undefined {
	if (url.searchParams.get('blueprint-source') !== 'opener') {
		return undefined;
	}
	activeReceiver ??= new OpenerBlueprintReceiver(host);
	return activeReceiver;
}

export function getOpenerBlueprintReceiver():
	| OpenerBlueprintReceiver
	| undefined {
	return activeReceiver;
}

export class OpenerBlueprintReceiver {
	// TODO: Consider a MessageChannel-based persistent driving API in protocol v2.
	state: OpenerBlueprintReceiverState = 'waiting';
	terminalError?: Error;

	readonly #opener: PostMessageTarget | null;
	readonly #host: ReceiverWindow;
	#targetOrigin = '*';
	#acceptedRun?: OpenerBlueprintRun;
	#hasAcceptedRun = false;
	#resolveRun?: (run: OpenerBlueprintRun) => void;
	#rejectRun?: (error: Error) => void;

	constructor(host: ReceiverWindow = window) {
		this.#host = host;
		this.#opener = host.opener;
		host.addEventListener('message', this.#onMessage);
		this.#post({ type: 'playground-blueprint:ready' }, '*');
	}

	waitForRun(): Promise<OpenerBlueprintRun> {
		if (this.terminalError) {
			return Promise.reject(this.terminalError);
		}
		if (this.#acceptedRun) {
			return Promise.resolve(this.#acceptedRun);
		}
		if (this.#hasAcceptedRun) {
			return Promise.reject(
				new Error('The opener Blueprint run is no longer available.')
			);
		}
		return new Promise((resolve, reject) => {
			this.#resolveRun = resolve;
			this.#rejectRun = reject;
		});
	}

	getAcceptedRun(runId: string): OpenerBlueprintRun | undefined {
		return this.#acceptedRun?.runId === runId
			? this.#acceptedRun
			: undefined;
	}

	reportProgress(value: number, caption?: string): void {
		if (this.state !== 'booting') {
			return;
		}
		this.#post({
			type: 'playground-blueprint:progress',
			value: Math.max(0, Math.min(100, value)),
			...(caption ? { caption } : {}),
		});
	}

	reportBooted(landingPage: string): void {
		if (this.state !== 'booting') {
			return;
		}
		this.state = 'booted';
		this.#acceptedRun = undefined;
		this.#post({
			type: 'playground-blueprint:booted',
			landingPage,
		});
	}

	reportError(error: unknown): void {
		if (this.state !== 'booting') {
			return;
		}
		this.state = 'error';
		this.terminalError = asError(error);
		this.#acceptedRun = undefined;
		this.#post({
			type: 'playground-blueprint:error',
			message: this.terminalError.message,
		});
	}

	dispose(): void {
		this.#host.removeEventListener('message', this.#onMessage);
	}

	#onMessage = (event: MessageEvent) => {
		if (
			!this.#opener ||
			event.source !== (this.#opener as MessageEventSource) ||
			!isProtocolMessage(event.data)
		) {
			return;
		}

		if (
			event.data.type === 'playground-blueprint:hello' &&
			this.state === 'waiting'
		) {
			this.#post({ type: 'playground-blueprint:ready' }, '*');
			return;
		}

		if (event.data.type !== 'playground-blueprint:run') {
			return;
		}

		if (this.state !== 'waiting') {
			this.#post(
				{
					type: 'playground-blueprint:rejected',
					reason: 'already-running',
				},
				this.#hasAcceptedRun
					? this.#targetOrigin
					: event.origin === 'null'
						? '*'
						: event.origin
			);
			return;
		}

		const validationResult = validateOpenerBlueprintRun(event.data);
		if (validationResult instanceof Error) {
			this.state = 'error';
			this.terminalError = validationResult;
			this.#post(
				{
					type: 'playground-blueprint:rejected',
					reason: validationResult.message,
				},
				event.origin === 'null' ? '*' : event.origin
			);
			const rejectRun = this.#rejectRun;
			this.#resolveRun = undefined;
			this.#rejectRun = undefined;
			rejectRun?.(validationResult);
			return;
		}

		// There is intentionally no origin allowlist. As with fragment Blueprints,
		// the PHP-WASM sandbox is the security boundary for untrusted code.
		this.#targetOrigin = event.origin === 'null' ? '*' : event.origin;
		const acceptedRun = {
			...validationResult,
			runId: crypto.randomUUID(),
		};
		this.#acceptedRun = acceptedRun;
		this.#hasAcceptedRun = true;
		this.state = 'booting';
		this.#post({ type: 'playground-blueprint:accepted' });
		const resolveRun = this.#resolveRun;
		this.#resolveRun = undefined;
		this.#rejectRun = undefined;
		resolveRun?.(acceptedRun);
	};

	#post(
		message: Omit<ProtocolMessage, 'protocolVersion'>,
		targetOrigin = this.#targetOrigin
	): void {
		this.#opener?.postMessage(
			{
				...message,
				protocolVersion: OPENER_BLUEPRINT_PROTOCOL_VERSION,
			},
			targetOrigin
		);
	}
}

export function validateOpenerBlueprintRun(
	message: Record<string, unknown>
): ValidatedOpenerBlueprintRun | Error {
	if (!isPlainObject(message.blueprint)) {
		return new Error('The Blueprint must be a plain object.');
	}

	const files = message.files === undefined ? [] : message.files;
	if (!Array.isArray(files)) {
		return new Error('Files must be an array.');
	}
	if (files.length > OPENER_BLUEPRINT_MAX_FILES) {
		return new Error(
			`A maximum of ${OPENER_BLUEPRINT_MAX_FILES} files may be transferred.`
		);
	}

	let totalBytes = 0;
	for (const file of files) {
		if (!isPlainObject(file)) {
			return new Error('Each file must be a plain object.');
		}
		if (typeof file.name !== 'string' || file.name.length === 0) {
			return new Error('Each file must have a name.');
		}
		if (!(file.bytes instanceof ArrayBuffer)) {
			return new Error('Each file must contain ArrayBuffer bytes.');
		}
		if (file.mimeType !== undefined && typeof file.mimeType !== 'string') {
			return new Error('A file MIME type must be a string.');
		}
		if (file.destination === 'vfs') {
			if (
				typeof file.path !== 'string' ||
				!file.path.startsWith('/') ||
				normalizePath(file.path) !== file.path
			) {
				return new Error(
					'Each VFS path must be absolute, normalized, and contain no ".." segments.'
				);
			}
		} else if (file.destination !== 'media-library') {
			return new Error(
				'Each file destination must be "vfs" or "media-library".'
			);
		}

		totalBytes += file.bytes.byteLength;
		if (totalBytes > OPENER_BLUEPRINT_MAX_TOTAL_BYTES) {
			return new Error('Transferred files may total at most 512 MB.');
		}
	}

	return {
		blueprint: message.blueprint,
		files: files as OpenerBlueprintFile[],
	};
}

function isProtocolMessage(value: unknown): value is ProtocolMessage {
	return (
		isPlainObject(value) &&
		typeof value.type === 'string' &&
		value.protocolVersion === OPENER_BLUEPRINT_PROTOCOL_VERSION
	);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (typeof value !== 'object' || value === null) {
		return false;
	}
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function asError(error: unknown): Error {
	return error instanceof Error ? error : new Error(String(error));
}
