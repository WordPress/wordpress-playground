import { ensureNativeHost } from './host.js';
import { runNativeCLI } from './process.js';

async function main(): Promise<void> {
	const argv = process.argv.slice(2);
	const runtimeInstall = argv[0] === 'runtime' && argv[1] === 'install';
	if (runtimeInstall && argv.length !== 2) {
		throw new Error('Usage: wp-playground-cli runtime install');
	}
	if (runtimeInstall) await ensureNativeHost();
	const result = await runNativeCLI({ argv });
	if (result.signal) {
		process.kill(process.pid, result.signal);
		return;
	}
	process.exitCode = result.code ?? 1;
}

main().catch((error: unknown) => {
	const value = error as { code?: unknown; message?: unknown };
	const prefix = typeof value.code === 'string' ? `${value.code}: ` : '';
	console.error(`${prefix}${value.message ?? String(error)}`);
	process.exitCode = 1;
});
