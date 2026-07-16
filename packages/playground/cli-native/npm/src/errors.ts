export const NativeCLIErrorCode = {
	Configuration: 'ERR_WP_PLAYGROUND_NATIVE_CONFIGURATION',
	Download: 'ERR_WP_PLAYGROUND_NATIVE_DOWNLOAD',
	Integrity: 'ERR_WP_PLAYGROUND_NATIVE_INTEGRITY',
	Cache: 'ERR_WP_PLAYGROUND_NATIVE_CACHE',
	Spawn: 'ERR_WP_PLAYGROUND_NATIVE_SPAWN',
	Startup: 'ERR_WP_PLAYGROUND_NATIVE_STARTUP',
	Auth: 'ERR_WP_PLAYGROUND_NATIVE_AUTH',
	InvalidRequest: 'ERR_WP_PLAYGROUND_NATIVE_INVALID_REQUEST',
	RequestTooLarge: 'ERR_WP_PLAYGROUND_NATIVE_REQUEST_TOO_LARGE',
	Busy: 'ERR_WP_PLAYGROUND_NATIVE_BUSY',
	Protocol: 'ERR_WP_PLAYGROUND_NATIVE_PROTOCOL',
	IO: 'ERR_WP_PLAYGROUND_NATIVE_IO',
	Runtime: 'ERR_WP_PLAYGROUND_NATIVE_RUNTIME',
	Aborted: 'ERR_WP_PLAYGROUND_NATIVE_ABORTED',
	Exit: 'ERR_WP_PLAYGROUND_NATIVE_EXIT',
	Unsupported: 'ERR_WP_PLAYGROUND_NATIVE_UNSUPPORTED',
} as const;

export type NativeCLIErrorCode =
	(typeof NativeCLIErrorCode)[keyof typeof NativeCLIErrorCode];

export interface NativeCLIErrorDetails {
	command?: string;
	target?: string;
	rpcMethod?: string;
	httpStatus?: number;
	exitCode?: number;
	signal?: string;
}

export class NativeCLIError extends Error {
	readonly code: NativeCLIErrorCode;
	readonly details?: Readonly<NativeCLIErrorDetails>;

	constructor(
		code: NativeCLIErrorCode,
		message: string,
		options?: { cause?: unknown; details?: NativeCLIErrorDetails }
	) {
		super(message, options);
		this.name = 'NativeCLIError';
		this.code = code;
		this.details = options?.details
			? Object.freeze({ ...options.details })
			: undefined;
	}
}

const nativeErrorCodes = new Set<NativeCLIErrorCode>(
	Object.values(NativeCLIErrorCode)
);

export function asNativeCLIErrorCode(value: unknown): NativeCLIErrorCode {
	return typeof value === 'string' &&
		nativeErrorCodes.has(value as NativeCLIErrorCode)
		? (value as NativeCLIErrorCode)
		: NativeCLIErrorCode.Protocol;
}
