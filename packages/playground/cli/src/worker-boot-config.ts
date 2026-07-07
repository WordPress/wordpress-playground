import type { PHPExtension } from '@php-wasm/node';
import type { AllPHPVersion, PathAlias } from '@php-wasm/universal';
import type { Mount } from '@php-wasm/cli-util';
import type { MessagePort } from 'worker_threads';

/**
 * Boot configuration shared by every worker in a Playground CLI run.
 *
 * It is identical across the primary request-handling workers and any child
 * worker spawned via `proc_open()`/`system()`, so a parent worker can forward
 * it to its children unchanged. Keeping the shared, platform-wide settings in
 * their own type (separate from the per-worker {@link WorkerConfig}) means we
 * can pass the platform config on to a child worker without having to remember
 * to strip out worker-specific fields such as `processId`.
 */
export interface WorkerPlatformConfig {
	siteUrl: string;
	phpVersion: AllPHPVersion;
	trace: boolean;
	/**
	 * Blueprints v2 only: toggles the networking-related php.ini entries and
	 * `disable_functions`. Unused by the v1 worker.
	 */
	networking?: boolean;
	nativeInternalDirPath: string;
	mountsBeforeWpInstall: Array<Mount>;
	mountsAfterWpInstall: Array<Mount>;
	followSymlinks: boolean;
	extensions?: PHPExtension[];
	pathAliases?: PathAlias[];
}

/**
 * Per-worker boot configuration.
 *
 * Unlike {@link WorkerPlatformConfig}, these fields must NOT be forwarded
 * verbatim to a child worker: the main thread mints a fresh `processId` for
 * every worker (reusing one would let two PHP instances share OS-level file
 * locks), and `bootedWordPress` reflects per-worker state.
 */
export interface WorkerConfig {
	processId: number;
	/**
	 * Whether WordPress is already installed from this worker's point of view.
	 *
	 * A worker that installs WordPress — or a child spawned by such a worker —
	 * applies the post-install (`--mount`) mounts as soon as its PHP instance is
	 * created. A child spawned before WordPress is installed receives `false`
	 * and skips them.
	 *
	 * This is declared as state ("has WordPress booted?") rather than an
	 * imperative "apply the mounts now" flag so the mount decision stays owned
	 * by the worker and decoupled from why it was asked to boot.
	 */
	bootedWordPress?: boolean;
}

/**
 * The full set of arguments the main thread passes to a worker's
 * `bootRequestHandler()`.
 */
export type WorkerBootRequestHandlerOptions = WorkerPlatformConfig &
	WorkerConfig;

/**
 * A fully-wired child worker the main thread hands back to a parent worker that
 * shelled out via `proc_open()`/`system()`.
 *
 * The main thread has already spawned the worker, exposed a direct
 * FileLockManager port and its own child-worker-service port on it, and minted
 * a fresh `processId`. The parent only has to plug the ports into the child and
 * boot its request handler.
 */
export interface CreatedChildWorker {
	/** Direct comlink line to the child worker's PHP API. */
	phpPort: MessagePort;
	/**
	 * FileLockManager port whose far end is exposed by the MAIN thread, so the
	 * child's synchronous `flock()` calls reach the broker directly instead of
	 * relaying through the (blocked) spawning worker.
	 */
	lockPort: MessagePort;
	/**
	 * The child's own child-worker-service port, so PHP running in the child can
	 * itself spawn grandchildren that also reach the main thread directly.
	 */
	servicePort: MessagePort;
	/** Fresh process id minted by the main thread. */
	processId: number;
}

/**
 * The service the main thread exposes to every worker so it can create child
 * workers on demand. It replaces the older approach of having workers propagate
 * FileLockManager ports to their children: the main thread already owns the
 * FileLockManager and everything else needed to configure a worker.
 */
export interface ChildWorkerService {
	/** Spawn and pre-wire a child worker; see {@link CreatedChildWorker}. */
	createChildWorker: () => Promise<CreatedChildWorker>;
	/** Terminate a child worker and close the main-thread ports it was given. */
	disposeChildWorker: (processId: number) => Promise<void>;
}
