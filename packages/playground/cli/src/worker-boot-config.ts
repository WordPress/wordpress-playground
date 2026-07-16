import type { PHPExtension } from '@php-wasm/node';
import type { AllPHPVersion, PathAlias } from '@php-wasm/universal';
import type { Mount } from '@php-wasm/cli-util';
import type { MessagePort } from 'worker_threads';

export const CHILD_WORKER_CONTROL_READY = 'child-worker-control-ready';

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
 * locks) and distinct service/control endpoints.
 */
export interface WorkerConfig {
	processId: number;
	/**
	 * Connects this worker directly to the main-thread child-worker service.
	 * It belongs in the per-worker configuration because every worker receives
	 * a distinct endpoint, even though all endpoints expose the same service.
	 */
	childWorkerServicePort: MessagePort;
	/**
	 * Child workers expose their post-install mount API on this port after boot.
	 * Top-level request workers are mounted directly and do not receive one.
	 */
	childWorkerControlPort?: MessagePort;
}

/** Runtime options left after the worker consumes its transport endpoints. */
export type WorkerBootRequestHandlerOptions = WorkerPlatformConfig &
	Pick<WorkerConfig, 'processId'>;

/** Per-worker configuration that is present only for spawned children. */
export interface ChildWorkerConfig extends WorkerConfig {
	childWorkerControlPort: MessagePort;
}

/**
 * The complete, naturally transferable result of creating a child worker.
 *
 * All worker-owned endpoints travel together so the caller can either finish
 * booting the child or dispose it without a partially-consumed service record.
 */
export interface CreatedChildWorker {
	/** Monotonic handle used for service operations over the child's lifetime. */
	childId: number;
	/** Endpoint for the child's Playground/PHP API. */
	phpPort: MessagePort;
	/** Direct endpoint for the main-thread file lock manager. */
	fileLockManagerPort: MessagePort;
	/** Configuration passed to the child's `bootRequestHandler()`. */
	workerConfig: ChildWorkerConfig;
}

/** The private control API every child exposes to the main thread after boot. */
export interface ChildWorkerControl {
	mountAfterWordPressInstall: (mounts: Array<Mount>) => Promise<void>;
}

/**
 * The service the main thread exposes to every worker so it can create child
 * workers on demand. It replaces the older approach of having workers propagate
 * FileLockManager ports to their children: the main thread already owns the
 * FileLockManager and everything else needed to configure a worker.
 */
export interface ChildWorkerService {
	/** Spawn and pre-wire a child worker, returning every child-owned endpoint. */
	createChildWorker: () => Promise<CreatedChildWorker>;
	/** Wait until any previously recorded post-install mounts are applied. */
	waitForChildReady: (childId: number) => Promise<void>;
	/** Fulfill when the child exits, so pending remote calls can be interrupted. */
	waitForChildExit: (childId: number) => Promise<void>;
	/** Terminate a child worker and close the main-thread ports it was given. */
	disposeChildWorker: (childId: number) => Promise<void>;
}
