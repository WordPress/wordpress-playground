import { createSpawnHandler } from './create-spawn-handler';
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
 *
 * @param onEmail - Called once per successfully parsed message.
 * @param fallbackSpawnHandler - Receives any non-sendmail command. Omit to
 *   throw on unrecognized commands instead.
 * @param options.maxSize - Maximum accepted message size in bytes.
 *   Defaults to 10 MB. Messages exceeding this limit are rejected with
 *   exit code 1 and a diagnostic written to stderr.
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
			// Parse -f: supports `-f sender@domain.com` and `-fsender@domain.com`.
			// A standalone `--` ends option parsing; anything after it is a recipient.
			let envelopeSender = '';
			for (
				let commandIndex = 1;
				commandIndex < command.length;
				commandIndex++
			) {
				const argument = command[commandIndex];
				if (argument === '--') {
					break;
				}
				if (argument === '-f' && commandIndex + 1 < command.length) {
					envelopeSender = command[++commandIndex];
				} else if (argument.startsWith('-f') && argument.length > 2) {
					envelopeSender = argument.slice(2);
				}
			}

			const stdin = await processApi.readStdin({ maxSize });
			if (stdin.exceededMaxSize) {
				processApi.stderr(
					`sendmail: message exceeds maximum size (${maxSize} bytes)\n`
				);
				processApi.exit(1);
				return;
			}

			const rawText = new TextDecoder().decode(stdin.bytes);

			if (!rawText.trim()) {
				processApi.exit(0);
				return;
			}

			// PHP 7 pipes LF-only to sendmail. PHP 8 changed the default to
			// CRLF even on Unix to fix RFC non-compliance:
			// https://bugs.php.net/47983
			// Since Playground supports PHP 7.4–8.5, both line endings can
			// arrive here. Our parseMessage helpers expect RFC 5322 canonical
			// CRLF, so normalize before parsing:
			// https://www.rfc-editor.org/rfc/rfc5322#section-2.1
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
