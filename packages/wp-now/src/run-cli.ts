import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { startServer } from './start-server';
import { portFinder } from './port-finder';
import { DEFAULT_PHP_VERSION } from './constants';
import { SupportedPHPVersion } from '@php-wasm/universal';

function startSpinner(message: string) {
	process.stdout.write(`${message}...\n`);
	return {
		succeed: (text: string) => {
			console.log(`${text}`);
		},
		fail: (text: string) => {
			console.error(`${text}`);
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
				yargs.option('phpVersion', {
					describe: 'PHP version to use.',
					type: 'string',
					default: DEFAULT_PHP_VERSION,
				});
			},
			async (argv) => {
				const spinner = startSpinner('Starting the server...');
				try {
					portFinder.setPort(argv.port as number);
					const options = {
						projectPath: argv.path as string,
						phpVersion: argv.phpVersion as SupportedPHPVersion,
					};
					await startServer(options);
				} catch (error) {
					console.error(error);
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
