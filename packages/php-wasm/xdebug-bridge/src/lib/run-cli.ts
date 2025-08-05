import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { startBridge } from './start-bridge';
import { LogVerbosity } from '@php-wasm/logger';

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
			choices: Object.values(LogVerbosity),
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

	const bridge = await startBridge({
		cdpPort: 9229,
		cdpHost: args.host,
		dbgpPort: args.port,
		phpRoot: args.phpRoot,
		verbosity: args.verbosity,
	});

	bridge.start();
}
