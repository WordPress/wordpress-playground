import { parseOptionsAndRunCLI } from './run-cli';

// Do not await this as top-level await is not supported in all environments.
parseOptionsAndRunCLI().then(
	() => {
		process.exit(0);
	},
	(e) => {
		// eslint-disable-next-line no-console
		console.error(e);
		process.exit(1);
	}
);
