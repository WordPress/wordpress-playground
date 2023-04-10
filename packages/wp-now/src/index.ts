#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { startServer, stopServer, runCommand } from './tasks';

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


const argv = yargs(hideBin(process.argv))
  .scriptName('wp-now')
  .usage('$0 <cmd> [args]')
  .command(
    'start',
    'Start the server',
    (yargs) => {
      yargs.option('port', {
        describe: 'Server port',
        type: 'number',
        default: 8000,
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
  .command(
    'stop',
    'Stop the server',
    {},
    async () => {
      const spinner = startSpinner('Stopping the server...');
      try {
        await stopServer();
        spinner.succeed('Server stopped.');
      } catch (error) {
        spinner.fail(`Failed to stop the server: ${(error as Error).message}`);
      }
    }
  )
  .command(
    'run',
    'Run a command',
    (yargs) => {
      yargs.option('cmd', {
        describe: 'Command to run',
        type: 'string',
        demandOption: true,
      });
    },
    async (argv) => {
      const spinner = startSpinner(`Running command: ${argv.cmd}`);
      try {
        const result = await runCommand(`${argv.cmd}`);
        spinner.succeed(`Command execution result: ${result}`);
      } catch (error) {
        spinner.fail(`Failed to run command: ${(error as Error).message}`);
      }
    }
  )
  .demandCommand(1, 'You must provide a valid command')
  .help()
  .alias('h', 'help')
  .strict()
  .argv;
