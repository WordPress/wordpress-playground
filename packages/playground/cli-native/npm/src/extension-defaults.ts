const NETWORK_EXTENSION_COMMANDS = new Set([
	'start',
	'server',
	'run-blueprint',
	'build-snapshot',
]);

type NetworkExtensionArgs = {
	command: string;
	redis?: boolean;
	memcached?: boolean;
};

export interface ExecutableJspiRuntime {
	hasJspi: boolean;
	noRespawn: boolean;
	isBun: boolean;
	isDeno: boolean;
	execArgv: readonly string[];
	nodeVersion: string | undefined;
}

export function currentRuntimeHasJspi(): boolean {
	return 'Suspending' in WebAssembly;
}

export function defaultNetworkExtensionsInArgs<T extends NetworkExtensionArgs>(
	args: T,
	enabled: boolean
): T {
	if (!enabled || !NETWORK_EXTENSION_COMMANDS.has(args.command)) return args;
	if (args.redis === undefined) args.redis = true;
	if (args.memcached === undefined) args.memcached = true;
	return args;
}

export function defaultNetworkExtensionsInArgv(
	argv: string[],
	enabled: boolean
): string[] {
	if (
		!enabled ||
		!NETWORK_EXTENSION_COMMANDS.has(argv[0] ?? '') ||
		argv
			.slice(1)
			.some((argument) => argument === '--help' || argument === '-h')
	)
		return argv;

	const delimiter = argv.indexOf('--');
	const optionEnd = delimiter === -1 ? argv.length : delimiter;
	const explicitOptions = new Set(
		argv
			.slice(1, optionEnd)
			.filter((argument) => argument.startsWith('--'))
			.map((argument) => argument.split('=', 1)[0])
	);
	const defaults: string[] = [];
	for (const extension of ['redis', 'memcached'] as const) {
		if (
			!explicitOptions.has(`--${extension}`) &&
			!explicitOptions.has(`--no-${extension}`)
		)
			defaults.push(`--${extension}`);
	}
	if (defaults.length === 0) return argv;

	const defaulted = [...argv];
	defaulted.splice(
		delimiter === -1 ? defaulted.length : delimiter,
		0,
		...defaults
	);
	return defaulted;
}

export function executableShouldDefaultNetworkExtensions(
	runtime: ExecutableJspiRuntime = inspectExecutableJspiRuntime()
): boolean {
	if (runtime.hasJspi) return true;
	if (
		runtime.noRespawn ||
		runtime.isBun ||
		runtime.isDeno ||
		runtime.execArgv.includes('--experimental-wasm-jspi')
	)
		return false;

	// The Node CLI would respawn here. The native host does not need JSPI, so
	// matching the successful child's extension defaults is enough.
	const major = Number.parseInt(runtime.nodeVersion ?? '', 10);
	return Number.isFinite(major) && major >= 23;
}

export function defaultNetworkExtensionsForExecutable(
	argv: string[],
	runtime?: ExecutableJspiRuntime
): string[] {
	return defaultNetworkExtensionsInArgv(
		argv,
		executableShouldDefaultNetworkExtensions(runtime)
	);
}

function inspectExecutableJspiRuntime(): ExecutableJspiRuntime {
	return {
		hasJspi: currentRuntimeHasJspi(),
		noRespawn: Boolean(process.env['PLAYGROUND_NO_JSPI_RESPAWN']),
		isBun: Boolean(process.versions['bun']),
		isDeno: 'Deno' in globalThis,
		execArgv: process.execArgv,
		nodeVersion: process.versions.node,
	};
}
