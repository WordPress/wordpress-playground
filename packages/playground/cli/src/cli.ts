import { parseOptionsAndRunCLI } from './run-cli';

// The CLI args are after the original command and the script name
const args = process.argv.slice(2);

// Do not await this as top-level await is not supported in all environments.
parseOptionsAndRunCLI(args);
