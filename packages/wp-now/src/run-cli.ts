#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { startServer } from './start-server';
import { DEFAULT_PORT } from './constants';

function startSpinner(message: string) {
  process.stdout.write(`${message}...`);
  return {
    succeed: (text: string) => {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      console.log(`${text}`);
    },
    fail: (text: string) => {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      console.error(`${text}`);
    },
  };
}


export function runCli() {
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
        default: DEFAULT_PORT,
      });
    },
    async (argv) => {
      const spinner = startSpinner('Starting the server...');
      try {
        await startServer(argv.port as number);
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
