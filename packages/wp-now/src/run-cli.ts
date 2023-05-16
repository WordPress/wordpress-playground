import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { startServer } from './start-server';
import { portFinder } from './port-finder';
import { DEFAULT_PHP_VERSION, DEFAULT_WORDPRESS_VERSION } from './constants';
import { SupportedPHPVersion } from '@php-wasm/universal';
import { spawn, SpawnOptionsWithoutStdio } from 'child_process';
import { output } from './output';

function startSpinner(message: string) {
	process.stdout.write(`${message}...\n`);
	return {
		succeed: (text: string) => {
			output?.log(`${text}`);
		},
		fail: (text: string) => {
			output?.error(`${text}`);
		},
	};
}

export async function runCli() {
	const port = await portFinder.getOpenPort();
	return yargs(hideBin(process.argv))
		.scriptName('wp-now')
		.usage('$0 <cmd> [args]')
		.command(
			'start',
			'Start the server',
			(yargs) => {
				yargs.option('port', {
					describe: 'Server port',
					type: 'number',
					default: port,
				});
				yargs.option('path', {
					describe:
						'Path to the PHP or WordPress project. Defaults to the current working directory.',
					type: 'string',
					default: process.cwd(),
				});
				yargs.option('php', {
					describe: 'PHP version to use.',
					type: 'string',
					default: DEFAULT_PHP_VERSION,
				});
				yargs.option('wp', {
					describe: "WordPress version to use: e.g. '--wp=6.2'",
					type: 'string',
					default: DEFAULT_WORDPRESS_VERSION,
				});
			},
			async (argv) => {
				const spinner = startSpinner('Starting the server...');
				try {
					portFinder.setPort(argv.port as number);
					const options = {
						projectPath: argv.path as string,
						phpVersion: argv.php as SupportedPHPVersion,
						wordPressVersion: argv.wp as string,
					};
					const { url } = await startServer(options);
					openInDefaultBrowser(url);
				} catch (error) {
					output?.error(error);
					spinner.fail(
						`Failed to start the server: ${
							(error as Error).message
						}`
					);
				}
			}
		)
		.demandCommand(1, 'You must provide a valid command')
		.help()
		.alias('h', 'help')
		.strict().argv;
}

function openInDefaultBrowser(url: string) {
	let cmd: string, args: string[] | SpawnOptionsWithoutStdio;
	switch (process.platform) {
		case 'darwin':
			cmd = 'open';
			args = [url];
			break;
		case 'linux':
			cmd = 'xdg-open';
			args = [url];
			break;
		case 'win32':
			cmd = 'cmd';
			args = ['/c', `start ${url}`];
			break;
		default:
			output?.log(`Platform '${process.platform}' not supported`);
			return;
	}
	spawn(cmd, args);
}
