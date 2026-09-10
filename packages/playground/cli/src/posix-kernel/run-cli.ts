import { logger } from '@php-wasm/logger';
import { LogVerbosity, type RunCLIArgs } from '../run-cli';
import { CLIOutput } from '../cli-output';
import { resolveBlueprint } from '../resolve-blueprint';
import type { KernelLimitedPHPApi } from './php-api';
import { PosixKernelHandler } from './posix-kernel-handler';

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

	const verbosity = args.quiet
		? 'quiet'
		: args.debug
			? 'debug'
			: args.verbosity || 'normal';
	logger.setSeverityFilterLevel(
		Object.values(LogVerbosity).find((v) => v.name === verbosity)!.severity
	);
	const cliOutput = new CLIOutput({ verbosity });
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
		throw collapseDuplicatedCauses(e);
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

function collapseDuplicatedCauses(error: unknown): unknown {
	let current = error;
	while (current instanceof Error && current.cause instanceof Error) {
		if (
			current.cause.message &&
			current.message.includes(current.cause.message)
		) {
			current.cause = current.cause.cause;
			continue;
		}
		current = current.cause;
	}
	return error;
}
