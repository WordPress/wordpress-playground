import { runWasmtimeCLI } from './wasmtime-binary';

async function main() {
	const result = await runWasmtimeCLI(process.argv.slice(2), {
		forwardSignals: true,
		stdio: 'inherit',
	});
	if (result.signal) {
		process.kill(process.pid, result.signal);
		return;
	}
	process.exitCode = result.code ?? 1;
}

void main().catch((error) => {
	process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
	process.exitCode = 1;
});
