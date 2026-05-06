import { ProgressTracker } from '@php-wasm/progress';
import type { BlueprintV1Declaration } from '@wp-playground/blueprints';
import {
	compileBlueprintV1,
	isBlueprintBundle,
	runBlueprintV1Steps,
} from '@wp-playground/blueprints';
import { RecommendedPHPVersion } from '@wp-playground/common';
import path from 'path';
import { type Mount } from '@php-wasm/cli-util';
import { type RunCLIArgs, mergeDefinedConstants } from '../run-cli';
import type { CLIOutput } from '../cli-output';
import { isPortInUse, reserveFreePort } from '../start-server';
import { createPlaygroundCliTempDir } from '../temp-dir';
import { bootPosixKernelWordPress } from './boot';
import { KernelLimitedPHPApi } from './php-api';
import {
	ensureWordPressInstalled,
	prepareWordPressForPosixKernel,
} from './prepare-wordpress';

export interface PosixKernelBootHandle {
	serverUrl: string;
	api: KernelLimitedPHPApi;
	dispose: () => Promise<void>;
}

/**
 * Boots Playground CLI under wasm-posix-kernel (nginx + PHP-FPM).
 *
 * Counterpart to BlueprintsV1Handler / BlueprintsV2Handler. Bypasses the
 * Express server and PHP.wasm worker pool that those handlers
 * orchestrate — kernel-resident nginx is the front door, so this handler
 * owns its own port and surfaces its own AsyncDisposable.
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

		const nativeTempDir = await createPlaygroundCliTempDir(
			'-playground-cli-posix-kernel-'
		);

		let wordPressRoot: string;
		if (wordPressMount) {
			wordPressRoot = path.resolve(wordPressMount.hostPath);
		} else {
			wordPressRoot = path.join(nativeTempDir.path, 'wordpress');
			try {
				await prepareWordPressForPosixKernel({
					wordPressRoot,
					wpVersionQuery: this.args.wp,
					onStatus: (msg) => this.cliOutput.print(msg),
				});
			} catch (e) {
				await nativeTempDir.cleanup();
				throw e;
			}
		}

		this.cliOutput.print(
			`Booting WordPress under wasm-posix-kernel on http://127.0.0.1:${port}`
		);

		let booted: Awaited<ReturnType<typeof bootPosixKernelWordPress>>;
		try {
			booted = await bootPosixKernelWordPress({
				port,
				wordPressRoot,
				tempDir: nativeTempDir.path,
			});
		} catch (e) {
			await nativeTempDir.cleanup();
			throw e;
		}

		let disposed = false;
		const dispose = async () => {
			if (disposed) {
				return;
			}
			disposed = true;
			await booted[Symbol.asyncDispose]();
			await nativeTempDir.cleanup();
		};

		const api = new KernelLimitedPHPApi({
			serverUrl: booted.serverUrl,
			wordPressRoot: booted.wordPressRoot,
			phpWasmPath: booted.runtime.phpWasmPath,
			runtime: booted.runtime,
		});

		try {
			// Drive WP's installer programmatically once per fresh doc
			// root. The classic path does this implicitly via
			// `@wp-playground/wordpress`'s boot helpers; we bypass those.
			// Without it every step touching the database (setSiteOptions,
			// plugin activation, …) silently fails against an
			// uninstalled WP. Idempotent against a populated SQLite.
			await ensureWordPressInstalled(api);
		} catch (e) {
			await dispose();
			throw e;
		}

		// Arm the first-request marker now that install has completed.
		// router.php watches for the marker and serves a 302 + cookie-
		// clearing Set-Cookie on the first real request, mirroring the
		// classic CLI's Express middleware. We arm it post-install so
		// the install probe sees a clean pipeline.
		booted.resetFirstRequestMarker();

		return { serverUrl: booted.serverUrl, api, dispose };
	}

	async runBlueprint(api: KernelLimitedPHPApi): Promise<void> {
		// Apply --define / --define-bool / --define-number flags. The
		// classic path does this implicitly via bootWordPress(); here we
		// drive it ourselves so the equivalent constants make it into
		// the generated mu-plugin before any blueprint step runs.
		const cliConstants = mergeDefinedConstants(this.args);
		for (const [name, value] of Object.entries(cliConstants)) {
			api.defineConstant(name, value as string | number | boolean | null);
		}

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
			// `runBlueprintV1Steps` types its second arg as `UniversalPHP`,
			// a union that includes a LimitedPHPApi-shaped object. The
			// shim implements every method the v1 steps actually call.
			await runBlueprintV1Steps(compiled, api as any);
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
