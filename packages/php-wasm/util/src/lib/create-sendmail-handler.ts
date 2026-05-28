import { createSpawnHandler } from './create-spawn-handler';
import { concatUint8Arrays } from './concat-uint8-arrays';
import { splitShellCommand } from './split-shell-command';
import { parseMessage } from './smtp';
import type { CaughtMessage } from './smtp';

/**
 * Intercepts PHP's mail() function and routes the outgoing message to
 * `onEmail`.
 *
 * PHP's mail() pipes a fully-formed message to the program in php.ini's
 * `sendmail_path`, which defaults to `/usr/sbin/sendmail -t -i`. The `-t`
 * means a real sendmail would read recipients from the To/Cc/Bcc headers,
 * and this handler relies on that — it always extracts recipients from the
 * headers rather than from command-line arguments.
 *
 * The envelope sender is read from sendmail's `-f` flag. Both forms are
 * supported: `-f sender@example.com` and `-fsender@example.com`.
 *
 * The full message is buffered in memory before parsing so headers, MIME
 * boundaries, and text encodings can be inspected together. Messages larger
 * than `maxSize`, including large attachments, are rejected.
 *
 * Any command whose binary basename is `sendmail` is matched. Other
 * commands are forwarded to `fallbackSpawnHandler` if provided, otherwise
 * they throw. The fallback lets callers combine this mail interceptor with
 * their existing spawn handler for unrelated commands.
 */
const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10 MB, same as SmtpSink

export function createSendmailSpawnHandler(
	onEmail: (message: CaughtMessage) => void,
	fallbackSpawnHandler?: (
		command: any,
		argsArray?: any,
		options?: any
	) => any,
	{ maxSize = DEFAULT_MAX_SIZE }: { maxSize?: number } = {}
) {
	const sendmailHandler = createSpawnHandler(
		async function (command, processApi) {
			let envelopeSender = '';
			for (let i = 1; i < command.length; i++) {
				if (command[i] === '-f' && i + 1 < command.length) {
					envelopeSender = command[++i];
				} else if (
					command[i].startsWith('-f') &&
					command[i].length > 2
				) {
					envelopeSender = command[i].slice(2);
				}
			}

			const chunks: Uint8Array[] = [];
			let totalLength = 0;
			let overflow = false;
			const stdinDone = new Promise<void>((resolve) => {
				processApi.childProcess.stdin.on('finish', resolve);
			});
			processApi.on('stdin', (data: Uint8Array) => {
				if (overflow) return;
				totalLength += data.length;
				if (totalLength > maxSize) {
					overflow = true;
					chunks.length = 0;
					return;
				}
				chunks.push(data.slice());
			});

			await stdinDone;

			if (overflow) {
				processApi.stderr(
					`sendmail: message exceeds maximum size (${maxSize} bytes)\n`
				);
				processApi.exit(1);
				return;
			}

			const rawMessageBytes = concatUint8Arrays(chunks);
			const rawText = new TextDecoder().decode(rawMessageBytes);

			if (!rawText.trim()) {
				processApi.exit(0);
				return;
			}

			// PHP mail/sendmail input may use LF-only lines. Normalize to
			// RFC 5322's CRLF form before the MIME helpers split headers/body.
			const raw = rawText.replace(/\r?\n/g, '\r\n');

			// Parse folded headers, MIME boundaries, and transfer encodings only
			// after sendmail has received the complete stdin payload.
			const parsed = parseMessage(raw, envelopeSender, []);

			const message: CaughtMessage = {
				receivedAt: new Date().toISOString(),
				from: parsed.from,
				to: parsed.to,
				subject: parsed.subject,
				headers: parsed.headers,
				text: parsed.text,
				raw,
				rawSize: raw.length,
			};

			onEmail(message);

			processApi.exit(0);
		}
	);

	return function (
		command: string | string[],
		argsArray: string[] = [],
		options: any = {}
	) {
		const cmdStr = argsArray.length
			? (command as string)
			: Array.isArray(command)
				? command[0]
				: typeof command === 'string'
					? (splitShellCommand(command)[0] ?? '')
					: '';
		const bin = cmdStr.split('/').pop() || '';
		if (bin !== 'sendmail') {
			if (fallbackSpawnHandler) {
				// Preserve the caller's normal process spawning for anything
				// unrelated to email while the mail interceptor is installed.
				return fallbackSpawnHandler(command, argsArray, options);
			}
			throw new Error(
				`createSendmailSpawnHandler: not a sendmail command: ${cmdStr}`
			);
		}
		return sendmailHandler(command, argsArray, options);
	};
}
