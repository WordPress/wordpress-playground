export const NativeCLIErrorCode = {
	Configuration: 'ERR_WP_PLAYGROUND_NATIVE_CONFIGURATION',
	Download: 'ERR_WP_PLAYGROUND_NATIVE_DOWNLOAD',
	Integrity: 'ERR_WP_PLAYGROUND_NATIVE_INTEGRITY',
	Protocol: 'ERR_WP_PLAYGROUND_NATIVE_PROTOCOL',
	Unsupported: 'ERR_WP_PLAYGROUND_NATIVE_UNSUPPORTED',
} as const;

export type NativeCLIErrorCode =
	(typeof NativeCLIErrorCode)[keyof typeof NativeCLIErrorCode];

export class NativeCLIError extends Error {
	readonly code: NativeCLIErrorCode;

	constructor(
		code: NativeCLIErrorCode,
		message: string,
		options?: { cause?: unknown }
	) {
		super(message, options);
		this.name = 'NativeCLIError';
		this.code = code;
	}
}
