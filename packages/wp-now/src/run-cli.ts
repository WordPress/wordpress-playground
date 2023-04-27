#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { startServer } from './start-server';
import { portFinder } from './port-finder';

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
        describe: 'Path to the WordPress project. Defaults to the current working directory.',
        type: 'string',
        default: process.cwd(),
      });
    },
    async (argv) => {
      const spinner = startSpinner('Starting the server...');
      try {
        portFinder.setPort(argv.port as number);
        process.chdir(argv.path as string);
        // print current directory
        console.log(`Current directory: ${process.cwd()}`);
        await startServer({mode: 'plugin'});
        spinner.succeed(`Server started on port ${argv.port}.`);
      } catch (error) {
        spinner.fail(`Failed to start the server: ${(error as Error).message}`);
      }
    }
  )
  .demandCommand(1, 'You must provide a valid command')
  .help()
  .alias('h', 'help')
  .strict()
  .argv;
}
