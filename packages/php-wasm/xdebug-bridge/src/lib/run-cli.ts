import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { startBridge } from './start-bridge';

interface CLIArgs {
	protocol?: 'cdp' | 'dap';
	port?: number;
	host?: string;
	verbose?: boolean;
	help?: boolean;
	phpRoot?: string;
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
		.help()
		.epilog(
			`
Examples:
  xdebug-bridge                                    # Start with default settings
  xdebug-bridge --port 9000 --verbose         # Custom port with verbose logging
  xdebug-bridge --php-root /path/to/php/files       # Specify PHP root directory
		`
		)
		.parseSync() as CLIArgs;
}

export async function main(): Promise<void> {
	const args = parseCliArgs();

	if (args.help) {
		return;
	}

	console.log('Starting XDebug Bridge...');

	const bridge = await startBridge({
		cdpPort: 9229,
		cdpHost: args.host,
		dbgpPort: args.port,
		phpRoot: args.phpRoot,
	});

	bridge.start();
}
