import { parseOptionsAndRunCLI } from './lib/run-cli';

// Do not await this as top-level await is not supported in all environments.
parseOptionsAndRunCLI();
