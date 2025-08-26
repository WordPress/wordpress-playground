import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { startBridge } from './start-bridge';
import { logger, LogSeverity } from '@php-wasm/logger';

const LogVerbosity = {
	Quiet: { name: 'quiet', severity: LogSeverity.Fatal },
	Normal: { name: 'normal', severity: LogSeverity.Info },
	Debug: { name: 'debug', severity: LogSeverity.Debug },
} as const;

type LogVerbosity = (typeof LogVerbosity)[keyof typeof LogVerbosity]['name'];

interface CLIArgs {
	port?: number;
	host?: string;
	phpRoot?: string;
	verbosity?: LogVerbosity;
	help?: boolean;
}

function parseCliArgs(): CLIArgs {
	return yargs(hideBin(process.argv))
		.usage(
			`
XDebug Bridge Server CLI

Usage: xdebug-bridge [options]
		`
		)
		.option('port', {
			alias: 'p',
			type: 'number',
			description: 'Xdebug port to listen on',
			default: 9003,
		})
		.option('host', {
			alias: 'h',
			type: 'string',
			description: 'Xdebug host to bind to',
			default: 'localhost',
		})
		.option('php-root', {
			type: 'string',
			description: 'Path to PHP root directory',
			default: './',
		})
		.option('verbosity', {
			type: 'string',
			describe: 'Output logs',
			choices: Object.values(LogVerbosity).map(
				(verbosity) => verbosity.name
			),
			default: 'normal',
		})
		.help()
		.epilog(
			`
Examples:
  xdebug-bridge                                    # Start with default settings
  xdebug-bridge --port 9000 --verbosity debug      # Custom port with debug logs
  xdebug-bridge --php-root /path/to/php/files      # Specify PHP root directory
		`
		)
		.wrap(null)
		.parseSync() as CLIArgs;
}

export async function main(): Promise<void> {
	const args = parseCliArgs();

	if (args.help) {
		return;
	}

	if (args.verbosity) {
		const severity = Object.values(LogVerbosity).find(
			(v) => v.name === args.verbosity
		)!.severity;
		logger.setSeverityFilterLevel(severity);
	}

	const bridge = await startBridge({
		cdpPort: 9229,
		cdpHost: args.host,
		dbgpPort: args.port,
		phpRoot: args.phpRoot,
	});

	bridge.start();
}
