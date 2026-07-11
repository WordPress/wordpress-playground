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
 * locks), and a fresh monotonic `childId` for every spawned child.
 */
export interface WorkerConfig {
	processId: number;
	/**
	 * Stable service handle for a spawned child. Unlike `processId`, this value
	 * is never recycled, so a delayed reap cannot target a newer worker.
	 */
	childId?: number;
}

/**
 * The full set of arguments the main thread passes to a worker's
 * `bootRequestHandler()`.
 */
export type WorkerBootRequestHandlerOptions = WorkerPlatformConfig &
	WorkerConfig;

export type ChildWorkerPortName =
	| 'php'
	| 'fileLockManager'
	| 'childWorkerService';

/** Cloneable metadata for a child worker whose ports are taken separately. */
export interface CreatedChildWorker {
	/** Monotonic handle used for service operations over the child's lifetime. */
	childId: number;
	/** PHP process id used by the child's runtime. */
	processId: number;
}

/**
 * The service the main thread exposes to every worker so it can create child
 * workers on demand. It replaces the older approach of having workers propagate
 * FileLockManager ports to their children: the main thread already owns the
 * FileLockManager and everything else needed to configure a worker.
 */
export interface ChildWorkerService {
	/** Spawn and pre-wire a child worker, returning its cloneable metadata. */
	createChildWorker: () => Promise<CreatedChildWorker>;
	/**
	 * Take one of the worker's ports. Returning each port as a top-level Comlink
	 * result lets the MessagePort transfer handler transfer it automatically.
	 */
	takeChildWorkerPort: (
		childId: number,
		portName: ChildWorkerPortName
	) => Promise<MessagePort>;
	/** Register the operation used to mount a child after WordPress installs. */
	registerChildWorker: (
		childId: number,
		mountAfterWordPressInstall: (mounts: Array<Mount>) => Promise<void>
	) => Promise<void>;
	/** Reject when the child exits, so pending remote calls can be interrupted. */
	waitForChildExit: (childId: number) => Promise<never>;
	/** Terminate a child worker and close the main-thread ports it was given. */
	disposeChildWorker: (childId: number) => Promise<void>;
}
