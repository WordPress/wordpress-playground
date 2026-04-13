import { createSpawnHandler } from './create-spawn-handler';
import {
	splitHeaderBody,
	parseHeaderLines,
	parseMessage,
	extractAddresses,
} from './smtp';
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
 * Any command whose binary basename is `sendmail` is matched. Other
 * commands are forwarded to `fallbackSpawnHandler` if provided, otherwise
 * they throw.
 */
export function createSendmailSpawnHandler(
	onEmail: (message: CaughtMessage) => void,
	fallbackSpawnHandler?: (command: any, argsArray?: any, options?: any) => any
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
			const stdinDone = new Promise<void>((resolve) => {
				processApi.childProcess.stdin.on('finish', resolve);
			});
			processApi.on('stdin', (data: Uint8Array) => {
				chunks.push(data.slice());
			});

			await stdinDone;

			let totalLen = 0;
			for (const c of chunks) totalLen += c.length;
			const all = new Uint8Array(totalLen);
			let offset = 0;
			for (const c of chunks) {
				all.set(c, offset);
				offset += c.length;
			}
			const rawText = new TextDecoder().decode(all);

			if (!rawText.trim()) {
				processApi.exit(0);
				return;
			}

			// Normalize line endings to CRLF for the email parsers
			const raw = rawText.replace(/\r?\n/g, '\r\n');

			// Parse headers to extract envelope recipients (sendmail -t mode)
			const { headerRaw } = splitHeaderBody(raw);
			const headers = parseHeaderLines(headerRaw);

			const recipients: string[] = [];
			for (const hdr of ['to', 'cc', 'bcc']) {
				if (headers[hdr]) {
					recipients.push(...extractAddresses(headers[hdr]));
				}
			}
			if (!envelopeSender && headers['from']) {
				const fromAddrs = extractAddresses(headers['from']);
				if (fromAddrs.length > 0) {
					envelopeSender = fromAddrs[0];
				}
			}

			const parsed = parseMessage(raw, envelopeSender, recipients);

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

			// Yield to the event loop so PHP can drain any buffered stdout
			// before we close the streams. createSpawnHandler() throws if a
			// program callback exits synchronously — see the explanatory error
			// in create-spawn-handler.ts for the underlying reason.
			await new Promise((resolve) => setTimeout(resolve, 1));
			processApi.exit(0);
		}
	);

	return function (
		command: string | string[],
		argsArray: string[] = [],
		options: any = {}
	) {
		const cmdStr = Array.isArray(command)
			? command[0]
			: typeof command === 'string'
				? command.split(/\s+/)[0]
				: '';
		const bin = cmdStr.split('/').pop() || '';
		if (bin !== 'sendmail') {
			if (fallbackSpawnHandler) {
				return fallbackSpawnHandler(command, argsArray, options);
			}
			throw new Error(
				`createSendmailSpawnHandler: not a sendmail command: ${cmdStr}`
			);
		}
		return sendmailHandler(command, argsArray, options);
	};
}
