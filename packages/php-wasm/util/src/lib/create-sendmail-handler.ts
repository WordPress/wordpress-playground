import { createSendmailCaptureSpawnHandler } from './create-sendmail-capture-handler';
import { DEFAULT_SMTP_MAX_SIZE, parseMessage } from './smtp';
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
 *   Defaults to `DEFAULT_SMTP_MAX_SIZE`. Messages exceeding this limit are
 *   rejected with exit code 1 and a diagnostic written to stderr.
 */
export function createSendmailSpawnHandler(
	onEmail: (message: CaughtMessage) => void,
	fallbackSpawnHandler?: (
		command: any,
		argsArray?: any,
		options?: any
	) => any,
	{ maxSize = DEFAULT_SMTP_MAX_SIZE }: { maxSize?: number } = {}
) {
	return createSendmailCaptureSpawnHandler(
		async (captured) => {
			// PHP 7 pipes LF-only to sendmail. PHP 8 changed the default to
			// CRLF even on Unix to fix RFC non-compliance:
			// https://bugs.php.net/47983
			// Since Playground supports PHP 7.4–8.5, both line endings can
			// arrive here. Our parseMessage helpers expect RFC 5322 canonical
			// CRLF, so normalize before parsing:
			// https://www.rfc-editor.org/rfc/rfc5322.html#section-2.1
			const raw = captured.text.replace(/\r?\n/g, '\r\n');

			// Parse folded headers, MIME boundaries, and transfer encodings only
			// after sendmail has received the complete stdin payload.
			onEmail(
				await parseCapturedSendmailMessage(
					captured.receivedAt,
					raw,
					captured.envelopeSender
				)
			);
		},
		fallbackSpawnHandler,
		{ maxSize }
	);
}

async function parseCapturedSendmailMessage(
	receivedAt: string,
	raw: string,
	envelopeSender: string
): Promise<CaughtMessage> {
	const rawSize = new TextEncoder().encode(raw).byteLength;
	try {
		const parsed = await parseMessage(raw, envelopeSender, []);
		return {
			receivedAt,
			from: parsed.from,
			to: parsed.to,
			subject: parsed.subject,
			headers: parsed.headers,
			text: parsed.text,
			html: parsed.html,
			attachments: parsed.attachments,
			raw,
			// RFC 1870 SIZE values are measured in octets.
			// https://www.rfc-editor.org/rfc/rfc1870.html#section-3
			rawSize,
		};
	} catch {
		return {
			receivedAt,
			from: envelopeSender,
			to: '',
			subject: '(no subject)',
			headers: {},
			attachments: [],
			raw,
			rawSize,
		};
	}
}
