import { createSpawnHandler } from '../create-spawn-handler';
import {
	phpEventStdinTransfer,
	type PHPEventWithStdinTransfer,
} from '../php-event';

/**
 * Limit captured sendmail stdin to 20 MB to match common email size limits.
 *
 * Gmail limits email attachments to 25 MB https://support.google.com/mail/answer/6584
 * Outlook limits email attachments to 20 MB https://support.microsoft.com/outlook/reduce-attachment-size-to-send-large-files-with-outlook
 */
export const SENDMAIL_CAPTURE_MAX_SIZE = 20 * 1024 * 1024;

/**
 * Emitted when a sendmail null transport receives the first stdin bytes from
 * `mail()`, `popen()`, `proc_open()`, or any other spawn of a `sendmail` binary.
 */
export interface PHPSendmailSpawnedEvent extends PHPEventWithStdinTransfer {
	type: 'sendmail.spawned';
}

/**
 * Creates a sendmail-compatible null transport for the given PHP instance.
 * Every message handed to sendmail – via mail(), proc_open(), etc. – is streamed
 * from stdin, dispatched as a `sendmail.spawned` event, and never delivered.
 * A listener that wants real delivery must relay the message itself.
 *
 * The captured payload is exposed as the raw bytes written to sendmail stdin.
 *
 * This stream does not apply backpressure to PHP. Each listener queues unread
 * chunks in JavaScript memory when it reads more slowly than PHP writes. The
 * source accepts at most SENDMAIL_CAPTURE_MAX_SIZE bytes. Cancelling the stream
 * stops delivery through that stream without terminating the sendmail process.
 */
export function sendmailSpawnHandler(php: {
	dispatchEvent: (event: PHPSendmailSpawnedEvent) => void;
}) {
	return createSpawnHandler(async function (commandArray, processApi) {
		let totalLength = 0;
		let dispatched = false;
		let exceededMaxSize = false;
		let streamCancelled = false;
		let controller: ReadableStreamDefaultController<Uint8Array>;
		// Construct the stream before registering stdin. Event dispatch is synchronous,
		// and a listener may start reading as soon as the first chunk arrives.
		const stdinStream = new ReadableStream<Uint8Array>({
			start(streamController) {
				controller = streamController;
			},
			cancel() {
				// Cancellation only means no reader wants more bytes from this source. Keep
				// the null transport alive so PHP can finish writing and receive an exit code.
				streamCancelled = true;
			},
		});

		processApi.on('stdin', (data: Uint8Array) => {
			if (!dispatched) {
				// Do not publish an email until sendmail receives actual message bytes. An
				// invocation that closes stdin immediately is a failed send, not an empty email.
				dispatched = true;
				php.dispatchEvent({
					type: 'sendmail.spawned',
					stdin: stdinStream,
					[phpEventStdinTransfer]: true,
				});
			}

			totalLength += data.length;
			if (totalLength > SENDMAIL_CAPTURE_MAX_SIZE) {
				// Fail the consumer now, but keep draining stdin. Exiting here would close
				// PHP's write end before the spawning code has finished with the process.
				exceededMaxSize = true;
				try {
					controller!.error(
						new Error(
							`sendmail: Message size exceeds fixed maximum message size (${SENDMAIL_CAPTURE_MAX_SIZE})`
						)
					);
				} catch {
					// The consumer may have cancelled the stream.
				}
				return;
			}
			if (!streamCancelled) {
				// The PHP bridge reuses its input buffer for later chunks. A stream reader
				// may retain this one indefinitely, so it must receive an owned copy.
				controller!.enqueue(data.slice());
			}
		});

		const stdin = processApi.childProcess
			.stdin as typeof processApi.childProcess.stdin & {
			writableEnded?: boolean;
			writableFinished?: boolean;
		};
		// proc_open() may write long after the spawn handler starts. Keep sendmail
		// alive until descriptor 0 closes or PHP will observe a truncated pipe.
		if (!(stdin.ended || stdin.writableEnded || stdin.writableFinished)) {
			await new Promise<void>((resolve) => {
				// stdin can finish between the outer check and listener registration.
				// Recheck here or that race leaves the sendmail process waiting forever.
				if (
					stdin.ended ||
					stdin.writableEnded ||
					stdin.writableFinished
				) {
					resolve();
					return;
				}

				const finish = () => {
					resolve();
				};

				stdin.once('finish', finish);
			});
		}

		if (exceededMaxSize) {
			processApi.stderr(
				`sendmail: Message size exceeds fixed maximum message size (${SENDMAIL_CAPTURE_MAX_SIZE})\n`
			);
			processApi.exit(1);
			return;
		}

		if (totalLength === 0) {
			// EX_TEMPFAIL is the sendmail-compatible result for an invocation that never
			// supplied a message. In particular, do not turn it into a successful no-op.
			processApi.stderr(
				'sendmail: fatal: No message bytes received over stdin\n'
			);
			processApi.exit(75);
			return;
		}

		try {
			controller!.close();
		} catch {
			// The consumer may have cancelled the stream.
		}
		processApi.exit(0);
	});
}
