import compatibilitySchema from '../../compatibility.json' with { type: 'json' };
import {
	CLIArgsValidationError,
	NativeCLIError,
	NativeCLIErrorCode,
} from './errors.js';

type CompatibilityStatus =
	| 'supported'
	| 'native-only'
	| 'unsupported-by-design';

export interface CommandCompatibility {
	name: string;
	status: CompatibilityStatus;
	diagnostic?: string;
}

interface CLIOptionCompatibility {
	name: string;
	commands: string[];
	status: CompatibilityStatus;
	errorContains?: string;
}

export interface ProgrammaticOptionCompatibility {
	name: string;
	commands?: string[];
	status: CompatibilityStatus;
	allowFalse?: boolean;
	diagnostic?: string;
}

const schema = compatibilitySchema as {
	commands: CommandCompatibility[];
	options: ProgrammaticOptionCompatibility[];
	cliOptions: CLIOptionCompatibility[];
};

const commands = new Map(schema.commands.map((entry) => [entry.name, entry]));
const cliOptions = new Map(
	schema.cliOptions.map((entry) => [entry.name, entry])
);
const programmaticOptions = new Map(
	schema.options.map((entry) => [entry.name, entry])
);

/**
 * Rejects compatibility-matrix exclusions before host acquisition. Parsing the
 * supported argv remains the native executable's responsibility.
 */
export function assertSupportedArgv(value: unknown): string[] {
	const argv = snapshotArgv(value);
	if (argv.length === 0)
		validationError(
			'Please specify a command: start, server, run-blueprint, or build-snapshot.'
		);
	if (
		argv.length === 1 &&
		['--help', '-h', '--version', '-V'].includes(argv[0]!)
	)
		return argv;
	if (argv[0] === 'runtime') {
		if (
			(argv.length === 2 && argv[1] === 'install') ||
			(argv.length === 2 && ['--help', '-h'].includes(argv[1]!))
		)
			return argv;
		validationError(
			'Native CLI runtime accepts only `runtime install` or `runtime --help`.'
		);
	}

	const command = commands.get(argv[0] ?? '');
	if (!command)
		validationError(`Unknown native CLI command \`${argv[0] ?? ''}\`.`);
	if (command.status === 'unsupported-by-design')
		throw new NativeCLIError(
			NativeCLIErrorCode.Unsupported,
			command.diagnostic ??
				`The native CLI does not support the \`${command.name}\` command.`
		);

	let sawDelimiter = false;
	for (const argument of argv.slice(1)) {
		if (argument === '--') {
			sawDelimiter = true;
			continue;
		}
		if (argument === '--help' || argument === '-h') continue;
		if (argument === '--version' || argument === '-V')
			validationError(
				'Native CLI version flags must be used without a command.'
			);
		if (!argument.startsWith('--')) continue;
		const equalsIndex = argument.indexOf('=');
		const optionName =
			equalsIndex === -1 ? argument : argument.slice(0, equalsIndex);
		const option = cliOptions.get(optionName);
		if (!option) {
			const mixedAlias = mixedAliasTarget(optionName);
			if (!mixedAlias) continue;
			throw new NativeCLIError(
				NativeCLIErrorCode.Unsupported,
				mixedAlias.status === 'unsupported-by-design'
					? `The native CLI does not support ${mixedAlias.errorContains ?? mixedAlias.name}.`
					: `The native CLI does not support the mixed yargs alias ${optionName}. Use ${mixedAlias.name}.`
			);
		}
		if (option.status === 'unsupported-by-design')
			throw new NativeCLIError(
				NativeCLIErrorCode.Unsupported,
				`The native CLI does not support ${option.errorContains ?? option.name}.`
			);
		if (!option.commands.includes(command.name))
			validationError(
				`${option.name} is not supported by the ${command.name} command.`
			);
	}
	if (sawDelimiter)
		validationError(
			'The native CLI does not support the positional `--` delimiter.'
		);
	return argv;
}

function mixedAliasTarget(
	optionName: string
): CLIOptionCompatibility | undefined {
	const rawName = optionName.slice(2);
	const hasLiteralNegation = rawName.startsWith('no-');
	const positiveName = hasLiteralNegation ? rawName.slice(3) : rawName;
	const dashedPositive = positiveName
		.replaceAll(/([a-z0-9])([A-Z])/g, '$1-$2')
		.toLowerCase();
	if (dashedPositive === positiveName) return undefined;
	if (!hasLiteralNegation && dashedPositive.startsWith('no-'))
		return undefined;
	return cliOptions.get(
		`--${hasLiteralNegation ? 'no-' : ''}${dashedPositive}`
	);
}

function snapshotArgv(value: unknown): string[] {
	try {
		if (
			!Array.isArray(value) ||
			Object.getPrototypeOf(value) !== Array.prototype
		)
			invalidArgv(
				'Native CLI argv must be an ordinary array of strings.'
			);
		const keys = Reflect.ownKeys(value);
		if (
			keys.length !== value.length + 1 ||
			!keys.includes('length') ||
			keys.some(
				(key) =>
					typeof key !== 'string' ||
					(key !== 'length' &&
						(!/^(0|[1-9]\d*)$/.test(key) ||
							Number(key) >= value.length))
			)
		)
			invalidArgv(
				'Native CLI argv must be a dense array without symbols or extra properties.'
			);
		const snapshot: string[] = [];
		for (let index = 0; index < value.length; index++) {
			const descriptor = Object.getOwnPropertyDescriptor(
				value,
				String(index)
			);
			if (!descriptor || !('value' in descriptor))
				invalidArgv(
					'Native CLI argv entries must be own data properties.'
				);
			if (typeof descriptor.value !== 'string')
				invalidArgv('Native CLI argv must contain only strings.');
			if (descriptor.value.includes('\0'))
				invalidArgv(
					'Native CLI argv strings may not contain NUL bytes.'
				);
			snapshot.push(descriptor.value);
		}
		return snapshot;
	} catch (cause) {
		if (cause instanceof NativeCLIError) throw cause;
		invalidArgv('Native CLI argv could not be inspected safely.');
	}
}

function invalidArgv(message: string): never {
	throw new NativeCLIError(NativeCLIErrorCode.InvalidRequest, message);
}

function validationError(message: string): never {
	throw new CLIArgsValidationError(1, message);
}

export function programmaticOptionCompatibility(
	name: string
): ProgrammaticOptionCompatibility | undefined {
	return programmaticOptions.get(name);
}

export function commandCompatibility(
	name: string
): CommandCompatibility | undefined {
	return commands.get(name);
}
