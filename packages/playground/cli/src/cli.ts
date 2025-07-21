import { parseOptionsAndRunCLI } from './run-cli';

// Do not await this as top-level await is not supported in all environments.
parseOptionsAndRunCLI().catch((e: any) => {
	// eslint-disable-next-line no-console
	console.error(e);
	process.exit(1);
});
