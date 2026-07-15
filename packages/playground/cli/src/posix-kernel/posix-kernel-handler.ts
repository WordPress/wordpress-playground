import { ProgressTracker } from '@php-wasm/progress';
import type { BlueprintV1Declaration } from '@wp-playground/blueprints';
import {
	compileBlueprintV1,
	isBlueprintBundle,
	runBlueprintV1Steps,
} from '@wp-playground/blueprints';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { mkdirSync } from 'node:fs';
// Default `import path from 'path'` (not a named `node:path` import): the
// CLI is bundled with vite, which maps `node:path` to a browser-external
// stub that only exposes a default export. `path.resolve` also keeps
// native separators, which `@php-wasm/util` would rewrite on Windows.
import path from 'path';
import { type UniversalPHP } from '@php-wasm/universal';
import { type Mount } from '@php-wasm/cli-util';
import { type RunCLIArgs, mergeDefinedConstants } from '../run-cli';
import type { CLIOutput } from '../cli-output';
import { isPortInUse, reserveFreePort } from '../start-server';
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

/**
 * Boots Playground CLI under kandelo (nginx + PHP-FPM). Counterpart to
 * BlueprintsV{1,2}Handler; bypasses the Express server and PHP.wasm
 * worker pool entirely.
 */
export class PosixKernelHandler {
	private args: RunCLIArgs;
	private cliOutput: CLIOutput;

	constructor(args: RunCLIArgs, options: { cliOutput: CLIOutput }) {
		this.args = args;
		this.cliOutput = options.cliOutput;
	}

	async bootWordPress(): Promise<PosixKernelBootHandle> {
		const allMounts: Mount[] = [
			...((this.args['mount'] as Mount[]) || []),
			...((this.args['mount-before-install'] as Mount[]) || []),
		];
		const wordPressMount = allMounts.find(
			(mount) =>
				mount.vfsPath.replace(/\/$/, '') === '/wordpress' &&
				mount.hostPath
		);

		const requestedPort = this.args.port ?? 9400;
		const port =
			requestedPort === 0 || (await isPortInUse(requestedPort))
				? await reserveFreePort()
				: requestedPort;

		const tempDir = await createPosixKernelTempDir();

		let wordPressRootHostPath: string;
		// Kernel-facing WP root must live under a dir present in
		// rootfs.vfs; arbitrary host paths don't qualify. Stage under
		// tempDir.kernelPath and let extraMounts route to the host path.
		const nginxRootHostPath = path.join(tempDir.hostPath, 'wordpress');
		if (wordPressMount) {
			// `--mount host:vfs` keeps the host path verbatim (see
			// parseMountWithDelimiterArguments), so a relative value must be
			// cwd-resolved the same way mounts.ts does.
			wordPressRootHostPath = path.resolve(wordPressMount.hostPath);
			mkdirSync(nginxRootHostPath, { recursive: true });
		} else {
			wordPressRootHostPath = nginxRootHostPath;
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
			phpWasmPath: booted.runtime.phpWasmPath,
			runtime: booted.runtime,
		});

		// Apply CLI constants before the install probe so the installer
		// sees the same WP_DEBUG* defaults as classic mode.
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

		// Arm the marker after install so the install probe sees a clean
		// pipeline. router.php consumes the marker on the next request.
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
			// runBlueprintV1Steps types its second arg as UniversalPHP; the
			// shim implements every method v1 steps actually call.
			await runBlueprintV1Steps(compiled, api as unknown as UniversalPHP);
		}
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
