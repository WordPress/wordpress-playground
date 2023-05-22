import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { startServer } from './start-server';
import { portFinder } from './port-finder';
import { SupportedPHPVersion } from '@php-wasm/universal';
import getWpNowConfig from './config';
import { spawn, SpawnOptionsWithoutStdio } from 'child_process';
import { executePHPFile } from './execute-php-file';
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

function commonParameters(yargs) {
	return yargs
		.option('path', {
			describe:
				'Path to the PHP or WordPress project. Defaults to the current working directory.',
			type: 'string',
		})
		.option('php', {
			describe: 'PHP version to use.',
			type: 'string',
		})
		.option('wp', {
			describe: "WordPress version to use: e.g. '--wp=6.2'",
			type: 'string',
		});
}

export async function runCli() {
	return yargs(hideBin(process.argv))
		.scriptName('wp-now')
		.usage('$0 <cmd> [args]')
		.command(
			'start',
			'Start the server',
			(yargs) => {
				commonParameters(yargs);
				yargs.option('port', {
					describe: 'Server port',
					type: 'number',
				});
			},
			async (argv) => {
				const spinner = startSpinner('Starting the server...');
				try {
					const options = await getWpNowConfig({
						path: argv.path as string,
						php: argv.php as SupportedPHPVersion,
						wp: argv.wp as string,
						port: argv.port as number,
					});
					portFinder.setPort(options.port as number);
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
		.command(
			'php <file>',
			'Run the php command passing the arguments for php cli',
			(yargs) => {
				commonParameters(yargs);
				yargs.positional('file', {
					describe: 'Path to the PHP file to run',
					type: 'string',
				});
			},
			async (argv) => {
				try {
					const options = await getWpNowConfig({
						path: argv.path as string,
						php: argv.php as SupportedPHPVersion,
						wp: argv.wp as string,
					});
					await executePHPFile(argv.file as string, options);
					process.exit(0);
				} catch (error) {
					console.error(error);
					process.exit(error.status || -1);
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
