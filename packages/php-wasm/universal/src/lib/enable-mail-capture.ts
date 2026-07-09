import {
	createSendmailCaptureSpawnHandler,
	type RawSendmailMessage,
} from '@php-wasm/util';
import { __private__dont__use } from './php';
import type { PHP } from './php';

export type MailCaptureOptions = {
	/**
	 * Receives the raw bytes written to sendmail stdin.
	 */
	onSendmail: (message: RawSendmailMessage) => void | Promise<void>;
};

/**
 * Enables outbound mail capture on a PHP instance.
 *
 * This wraps the spawn handler currently installed on the PHP instance. If you
 * need a custom spawn handler, install it first and then enable mail capture:
 *
 * ```ts
 * await php.setSpawnHandler(customSpawnHandler);
 * await enableMailCapture(php, mailOptions);
 * ```
 *
 * A later `php.setSpawnHandler()` call replaces the capture wrapper.
 */
export async function enableMailCapture(
	php: PHP,
	{ onSendmail }: MailCaptureOptions
) {
	await php.setSpawnHandler(
		createSendmailCaptureSpawnHandler(
			onSendmail,
			php[__private__dont__use].spawnProcess
		)
	);
}
