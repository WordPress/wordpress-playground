import type { EmscriptenOptions } from './load-php-runtime';
import {
	createSendmailCaptureSpawnHandler,
	type RawSendmailMessage,
} from '@php-wasm/util';

export type WithMailCaptureOptions = {
	/**
	 * Called with raw bytes written to sendmail stdin.
	 */
	onSendmail: (message: RawSendmailMessage) => void;
	/**
	 * Maximum accepted raw message size in bytes.
	 */
	maxSize?: number;
};

/**
 * Adds raw sendmail capture to Emscripten options.
 *
 * This is plumbing only: it captures the byte stream PHP writes to sendmail,
 * without parsing headers, MIME bodies, attachments, or SMTP socket sessions.
 */
export function withMailCapture(
	{ onSendmail, maxSize }: WithMailCaptureOptions,
	emscriptenOptions: EmscriptenOptions = {}
): EmscriptenOptions {
	return {
		...emscriptenOptions,
		spawnProcess: createSendmailCaptureSpawnHandler(
			onSendmail,
			emscriptenOptions['spawnProcess'],
			{ maxSize }
		),
	};
}
