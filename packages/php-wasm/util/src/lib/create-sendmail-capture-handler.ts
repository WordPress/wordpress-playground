import { createSpawnHandler } from './create-spawn-handler';
import { basename } from './paths';
import { splitShellCommand } from './split-shell-command';

/**
 * Limit captured sendmail stdin to 20 MB to match common email size limits.
 *
 * Gmail limits email attachments to 25 MB https://support.google.com/mail/answer/6584
 * Outlook limits email attachments to 20 MB https://support.microsoft.com/outlook/reduce-attachment-size-to-send-large-files-with-outlook
 */
export const SENDMAIL_CAPTURE_MAX_SIZE = 20 * 1024 * 1024;

export type RawSendmailMessage = {
	receivedAt: string;
	command: string[];
	bytes: Uint8Array;
	text: string;
	rawSize: number;
};

/**
 * Returns a spawn handler that captures stdin for sendmail process calls.
 *
 * The captured payload is left unparsed so callers can decide how to interpret
 * message headers, MIME bodies, attachments, and other mail formats.
 */
export function createSendmailCaptureSpawnHandler(
	onSendmail: (message: RawSendmailMessage) => void | Promise<void>,
	fallbackSpawnHandler?: (command: any, argsArray?: any, options?: any) => any
) {
	const sendmailHandler = createSpawnHandler(
		async function (commandArray, processApi) {
			const stdin = await processApi.readStdin({
				maxSize: SENDMAIL_CAPTURE_MAX_SIZE,
			});
			if (stdin.exceededMaxSize) {
				processApi.stderr(
					`sendmail: Message size exceeds fixed maximum message size (${SENDMAIL_CAPTURE_MAX_SIZE})\n`
				);
				processApi.exit(1);
				return;
			}

			if (stdin.bytes.length === 0) {
				processApi.stderr(
					'sendmail: fatal: No message bytes received over stdin\n'
				);
				processApi.exit(75);
				return;
			}

			await onSendmail({
				receivedAt: new Date().toISOString(),
				command: commandArray,
				bytes: stdin.bytes,
				text: new TextDecoder().decode(stdin.bytes),
				rawSize: stdin.bytes.byteLength,
			});
			processApi.exit(0);
		}
	);

	return function (
		command: string | string[],
		argsArray: string[] = [],
		options: any = {}
	) {
		const commandArray = argsArray.length
			? [command as string, ...argsArray]
			: Array.isArray(command)
				? command
				: splitShellCommand(command);
		if (!commandArray[0] || basename(commandArray[0]) !== 'sendmail') {
			if (fallbackSpawnHandler) {
				return fallbackSpawnHandler(command, argsArray, options);
			}
			return createSpawnHandler(async (command, processApi) => {
				await Promise.resolve();
				processApi.stderr(
					`${command[0] ?? 'command'}: command not found\n`
				);
				processApi.exit(127);
			})(command, argsArray, options);
		}
		return sendmailHandler(commandArray, [], options);
	};
}
