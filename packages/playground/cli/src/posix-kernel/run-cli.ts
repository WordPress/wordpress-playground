import type { RunCLIArgs } from '../run-cli';
import { CLIOutput } from '../cli-output';
import { resolveBlueprint } from '../resolve-blueprint';
import type { KernelLimitedPHPApi } from './php-api';
import { PosixKernelHandler } from './posix-kernel-handler';

/**
 * Server returned by `--experimental-posix-kernel`. Kernel-resident
 * nginx is the front door, so no Node `http.Server` and no worker pool.
 */
export interface PosixKernelRunCliServer extends AsyncDisposable {
	serverUrl: string;
	playground: KernelLimitedPHPApi;
	[Symbol.asyncDispose](): Promise<void>;
}

export async function runCLIWithPosixKernel(
	args: RunCLIArgs
): Promise<PosixKernelRunCliServer | void> {
	if (args.command !== 'server' && args.command !== 'run-blueprint') {
		throw new Error(
			'--experimental-posix-kernel currently only supports the ' +
				'"server" and "run-blueprint" commands.'
		);
	}

	for (const flag of ['xdebug', 'redis', 'memcached'] as const) {
		if (args[flag]) {
			throw new Error(
				`--${flag} is not supported with --experimental-posix-kernel yet.`
			);
		}
	}

	const cliOutput = new CLIOutput({
		verbosity: args.verbosity || 'normal',
	});
	const handler = new PosixKernelHandler(args, { cliOutput });

	if (typeof args.blueprint === 'string') {
		args.blueprint = await resolveBlueprint({
			sourceString: args.blueprint,
			blueprintMayReadAdjacentFiles:
				args['blueprint-may-read-adjacent-files'] === true,
		});
	}

	const { serverUrl, api, dispose } = await handler.bootWordPress();
	try {
		await handler.runBlueprint(api);
	} catch (e) {
		await dispose();
		throw e;
	}

	if (args.command === 'run-blueprint') {
		cliOutput.finishProgress('Done');
		await dispose();
		return;
	}

	cliOutput.print(`WordPress is ready at ${serverUrl}`);

	return {
		serverUrl,
		playground: api,
		[Symbol.asyncDispose]: dispose,
	};
}
