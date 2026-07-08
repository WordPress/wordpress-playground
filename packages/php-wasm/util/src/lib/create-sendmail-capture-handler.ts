import { createSpawnHandler } from './create-spawn-handler';
import { basename } from './paths';
import { splitShellCommand } from './split-shell-command';

export const DEFAULT_SENDMAIL_CAPTURE_MAX_SIZE = 10 * 1024 * 1024;

export type RawSendmailMessage = {
	receivedAt: string;
	command: string[];
	envelopeSender: string;
	bytes: Uint8Array;
	text: string;
	rawSize: number;
};

/**
 * Intercepts sendmail-style process calls and captures their raw stdin bytes.
 *
 * This is intentionally a transport-level helper. It does not parse message
 * headers, MIME parts, or SMTP sessions; higher layers can interpret `bytes`
 * once the raw stream has been captured.
 */
export function createSendmailCaptureSpawnHandler(
	onSendmail: (message: RawSendmailMessage) => void | Promise<void>,
	fallbackSpawnHandler?: (
		command: any,
		argsArray?: any,
		options?: any
	) => any,
	{ maxSize = DEFAULT_SENDMAIL_CAPTURE_MAX_SIZE }: { maxSize?: number } = {}
) {
	const sendmailHandler = createSpawnHandler(
		async function (command, processApi) {
			const envelopeSender = getEnvelopeSender(command);
			const stdin = await processApi.readStdin({ maxSize });
			if (stdin.exceededMaxSize) {
				processApi.stderr(
					`sendmail: message exceeds maximum size (${maxSize} bytes)\n`
				);
				processApi.exit(1);
				return;
			}

			if (stdin.bytes.length > 0) {
				await onSendmail({
					receivedAt: new Date().toISOString(),
					command,
					envelopeSender,
					bytes: stdin.bytes,
					text: new TextDecoder().decode(stdin.bytes),
					rawSize: stdin.bytes.byteLength,
				});
			}

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
		const bin = basename(cmdStr);
		if (bin !== 'sendmail') {
			if (fallbackSpawnHandler) {
				return fallbackSpawnHandler(command, argsArray, options);
			}
			throw new Error(
				`createSendmailCaptureSpawnHandler: not a sendmail command: ${cmdStr}`
			);
		}
		return sendmailHandler(command, argsArray, options);
	};
}

function getEnvelopeSender(command: string[]) {
	for (let commandIndex = 1; commandIndex < command.length; commandIndex++) {
		const argument = command[commandIndex];
		if (argument === '--') {
			break;
		}
		if (argument === '-f' && commandIndex + 1 < command.length) {
			return command[++commandIndex];
		}
		if (argument.startsWith('-f') && argument.length > 2) {
			return argument.slice(2);
		}
	}
	return '';
}
