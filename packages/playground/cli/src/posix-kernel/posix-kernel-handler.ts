import { ProgressTracker } from '@php-wasm/progress';
import type { BlueprintV1Declaration } from '@wp-playground/blueprints';
import {
	compileBlueprintV1,
	isBlueprintBundle,
	runBlueprintV1Steps,
} from '@wp-playground/blueprints';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { mkdirSync } from 'node:fs';
import path from 'path';
import { type UniversalPHP } from '@php-wasm/universal';
import { type Mount } from '@php-wasm/cli-util';
import { type RunCLIArgs, mergeDefinedConstants } from '../run-cli';
import type { CLIOutput } from '../cli-output';
import { isPortInUse } from '../start-server';
import { bootPosixKernelWordPress } from './boot';
import { KernelLimitedPHPApi } from './php-api';
import {
	ensureWordPressInstalled,
	prepareWordPressForPosixKernel,
} from './prepare-wordpress';
import { createPosixKernelTempDir } from './temp-dir';

export interface PosixKernelBootHandle {
	serverUrl: string;
	api: KernelLimitedPHPApi;
	dispose: () => Promise<void>;
}

export class PosixKernelHandler {
	private args: RunCLIArgs;
	private cliOutput: CLIOutput;

	constructor(args: RunCLIArgs, options: { cliOutput: CLIOutput }) {
		this.args = args;
		this.cliOutput = options.cliOutput;
	}

	async bootWordPress(): Promise<PosixKernelBootHandle> {
		const isWordPressMount = (mount: Mount) =>
			mount.vfsPath.replace(/\/$/, '') === '/wordpress' &&
			Boolean(mount.hostPath);

		const installableWordPressMount = (
			(this.args['mount-before-install'] as Mount[]) || []
		).find(isWordPressMount);

		const wordPressMount =
			installableWordPressMount ??
			((this.args['mount'] as Mount[]) || []).find(isWordPressMount);

		const port = await this.selectPort();

		const tempDir = await createPosixKernelTempDir();

		let wordPressRootHostPath: string;

		const nginxRootHostPath = path.join(tempDir.hostPath, 'wordpress');

		if (wordPressMount) {
			wordPressRootHostPath = path.resolve(wordPressMount.hostPath);
			mkdirSync(nginxRootHostPath, { recursive: true });
		} else {
			wordPressRootHostPath = nginxRootHostPath;
		}

		if (!wordPressMount || wordPressMount === installableWordPressMount) {
			try {
				await prepareWordPressForPosixKernel({
					wordPressRoot: wordPressRootHostPath,
					wpVersionQuery: this.args.wp,
					onStatus: (msg) => this.cliOutput.print(msg),
				});
			} catch (e) {
				await tempDir.cleanup();
				throw e;
			}
		}

		const wordPressRootKernelPath = `${tempDir.kernelPath}/wordpress`;

		this.cliOutput.print(`Booting WordPress under kandelo...`);

		let booted: Awaited<ReturnType<typeof bootPosixKernelWordPress>>;
		try {
			booted = await bootPosixKernelWordPress({
				port,
				wordPressRootHostPath,
				wordPressRootKernelPath,
				tempDirHostPath: tempDir.hostPath,
				tempDirKernelPath: tempDir.kernelPath,
				requireHostTcpPort: this.args.command === 'server',
				quiet: this.cliOutput.isQuiet,
			});
		} catch (e) {
			await tempDir.cleanup();
			throw e;
		}

		let disposed = false;
		const dispose = async () => {
			if (disposed) {
				return;
			}
			disposed = true;
			await booted[Symbol.asyncDispose]();
			await tempDir.cleanup();
		};

		const api = new KernelLimitedPHPApi({
			serverUrl: booted.serverUrl,
			wordPressRootHostPath,
			wordPressRootKernelPath,
			tempDirHostPath: tempDir.hostPath,
			tempDirKernelPath: tempDir.kernelPath,
			phpWasmPath: booted.runtime.phpWasmPath,
			runtime: booted.runtime,
		});

		const cliConstants = mergeDefinedConstants(this.args);
		for (const [name, value] of Object.entries(cliConstants)) {
			api.defineConstant(name, value as string | number | boolean | null);
		}

		try {
			await ensureWordPressInstalled(api);
		} catch (e) {
			await dispose();
			throw e;
		}

		booted.resetFirstRequestMarker();

		return { serverUrl: booted.serverUrl, api, dispose };
	}

	async runBlueprint(api: KernelLimitedPHPApi): Promise<void> {
		const blueprint = this.getEffectiveBlueprint();
		const additionalSteps = this.args['additional-blueprint-steps'] || [];
		if (blueprint === undefined && additionalSteps.length === 0) {
			return;
		}

		const tracker = new ProgressTracker();
		let lastCaption = '';
		let progressReached100 = false;
		tracker.addEventListener('progress', (e: any) => {
			if (progressReached100) {
				return;
			}
			progressReached100 = e.detail.progress === 100;
			const progressInteger = Math.floor(e.detail.progress);
			lastCaption =
				e.detail.caption || lastCaption || 'Running Blueprint';
			this.cliOutput.updateProgress(lastCaption.trim(), progressInteger);
		});

		const compiled = await compileBlueprintV1(
			(blueprint as BlueprintV1Declaration) ?? { steps: [] },
			{ progress: tracker, additionalSteps }
		);
		if (compiled) {
			await runBlueprintV1Steps(compiled, api as unknown as UniversalPHP);
		}
	}

	private async selectPort(): Promise<number> {
		const requestedPort =
			this.args.command === 'server' ? (this.args.port ?? 9400) : 0;
		if (requestedPort !== 0 && !(await isPortInUse(requestedPort))) {
			return requestedPort;
		}
		for (let attempt = 0; attempt < 20; attempt++) {
			const candidate = nextCandidatePort();
			if (!(await isPortInUse(candidate))) {
				return candidate;
			}
		}
		throw new Error('Could not find a free TCP port for nginx.');
	}

	private getEffectiveBlueprint(): BlueprintV1Declaration | undefined {
		const resolved = this.args.blueprint as
			| BlueprintV1Declaration
			| undefined;
		if (resolved && isBlueprintBundle(resolved)) {
			return resolved;
		}
		const merged: BlueprintV1Declaration = {
			login: this.args.login,
			...(resolved || {}),
			preferredVersions: {
				php:
					this.args.php ??
					resolved?.preferredVersions?.php ??
					RecommendedPHPVersion,
				wp: this.args.wp ?? resolved?.preferredVersions?.wp ?? 'latest',
				...(resolved?.preferredVersions || {}),
			},
		};
		const hasContent =
			(merged.steps && merged.steps.length > 0) ||
			merged.login !== undefined;
		return hasContent ? merged : undefined;
	}
}

const EPHEMERAL_PORT_START = 49152;
const EPHEMERAL_PORT_SPAN = 16384;
let portSequence = 0;

function nextCandidatePort(): number {
	portSequence += 1;
	return (
		EPHEMERAL_PORT_START +
		((process.pid * 61 + portSequence * 4093) % EPHEMERAL_PORT_SPAN)
	);
}
