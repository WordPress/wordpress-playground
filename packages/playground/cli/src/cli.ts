import { parseOptionsAndRunCLI } from './run-cli';

// Do not await this as top-level await is not supported in all environments.
parseOptionsAndRunCLI().catch(() => {
	// process.exit(1); is here and not in parseOptionsAndRunCLI()
	// so that we can unit test the failure modes with try/catch.
	process.exit(1);
});
