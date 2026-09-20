const NON_TERMINATING_COMMANDS = new Set(['server', 'shell']);

/**
 * Removes the `wp` executable so that pasting a full `wp ...` command does not
 * run as `wp wp ...`.
 */
export function stripWpPrefix(command: string) {
	return command
		.trim()
		.replace(/^\$\s*/, '')
		.replace(/^wp(?:\s+|$)/, '');
}

const GLOBAL_PARAMETERS_WITH_VALUES = new Set([
	'--exec',
	'--http',
	'--path',
	'--require',
	'--ssh',
	'--url',
	'--user',
]);

/**
 * Returns why a WP-CLI command cannot run in the non-interactive terminal.
 */
export function getWpCliCommandError(command: string) {
	const args = command.trim().split(/\s+/);
	if (args.shift() !== 'wp') {
		return undefined;
	}

	while (args.length > 0 && args[0].startsWith('--')) {
		const parameter = args.shift() as string;
		if (
			!parameter.includes('=') &&
			GLOBAL_PARAMETERS_WITH_VALUES.has(parameter)
		) {
			args.shift();
		}
	}

	const wpCliCommand = args[0];
	if (NON_TERMINATING_COMMANDS.has(wpCliCommand)) {
		return `wp ${wpCliCommand} is not supported in this terminal because it does not exit on its own.`;
	}

	return undefined;
}
