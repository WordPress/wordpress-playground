import { parseOptionsAndRunCLI } from './run-cli';

// Do not await this as top-level await is not supported in all environments.
parseOptionsAndRunCLI().then(
	() => {
		// Do nothing, just keep the server alive.
	},
	() => {
		// process.exit(1); is here and not in parseOptionsAndRunCLI()
		// so that we can unit test the failure modes with try/catch.
		process.exit(1);
	}
);
