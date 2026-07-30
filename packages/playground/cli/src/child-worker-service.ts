/**
 * Main-thread coordinator for PHP processes spawned by proc_open() or system().
 *
 * A PHP worker cannot safely create and manage its children by itself. It may
 * be blocked inside a synchronous system() call while that child is running.
 * The main thread remains available, already owns the shared file-lock manager,
 * and can see every worker in the process tree. It therefore owns child worker
 * creation, unique process IDs, MessagePorts, post-install mount state, and
 * termination.
 *
 * One controller holds state shared by the entire CLI run:
 *
 * - The list of mounts that every current and future child must receive.
 * - Every live child, including workers that are still initializing.
 * - Parent/child ownership needed to dispose a complete descendant tree.
 * - The direct lock-manager connections that avoid routing a lock request
 *   through a parent blocked in system().
 *
 * Each worker receives a separate service endpoint. That endpoint closes over
 * an owner record, so disposing a worker also disposes only the descendants it
 * created. Every new child receives another endpoint backed by the same
 * controller, which makes the same rules apply at any nesting depth.
 *
 * Three MessageChannels connect each child to the main thread: one for
 * synchronous file locking, one for creating descendants, and one for the
 * main thread to apply mounts after the child finishes booting. Keeping all
 * three in one lifecycle record lets setup either complete fully or clean up
 * every partially created resource.
 */
import type { Mount } from '@php-wasm/cli-util';
import { logger } from '@php-wasm/logger';
import {
	consumeAPI,
	exposeAPI,
	exposeSyncAPI,
	releaseApiProxy,
	type FileLockManagerInMemory,
	type RemoteAPI,
} from '@php-wasm/universal';
import { MessageChannel, type MessagePort } from 'worker_threads';
import {
	CHILD_WORKER_CONTROL_READY,
	childWorkerServiceTransferPolicy,
	type ChildWorkerControl,
	type ChildWorkerService,
	type CreatedChildWorker,
} from './worker-boot';

/** The part of a Node Worker that the lifecycle service owns. */
export interface TerminableWorker {
	terminate(): Promise<number>;
}

export interface SpawnedChildWorker<Worker extends TerminableWorker> {
	processId: number;
	worker: Worker;
	phpPort: MessagePort;
}

export interface SpawnChildWorkerOptions<Worker extends TerminableWorker> {
	onWorkerCreated: (worker: Worker) => void;
	onExit: (code: number, processId: number) => void;
}

/**
 * The caller closes over its v1/v2 worker selection when providing this
 * function. Keeping that choice out of this module avoids a run-cli import
 * cycle and makes the lifecycle independently testable.
 */
export type SpawnChildWorker<Worker extends TerminableWorker> = (
	options: SpawnChildWorkerOptions<Worker>
) => Promise<SpawnedChildWorker<Worker>>;

export type EnqueuePostInstallMount = (
	mount: () => Promise<void>
) => Promise<void>;

export interface ChildWorkerServiceEndpoint {
	/** Worker-facing operations. Expose this object directly with `exposeAPI`. */
	api: ChildWorkerService;
	/** Terminate every child created through this worker's endpoint. */
	dispose(): Promise<void>;
}

export interface ChildWorkerServiceController {
	/** Create an owner-scoped API for one worker. */
	createEndpoint(): ChildWorkerServiceEndpoint;
	/** Record post-install mounts and apply them to every current child. */
	applyPostInstallMounts(mounts: Array<Mount>): Promise<void>;
	/** Number of children tracked from creation through final cleanup. */
	liveChildWorkerCount(): number;
	/** Terminate all children and close all main-thread endpoints. */
	dispose(): Promise<void>;
}

type Deferred = {
	promise: Promise<void>;
	resolve: () => void;
};

type ChildWorkerOwner<Worker extends TerminableWorker> = {
	/** Children created through one worker's private service endpoint. */
	children: Set<ChildWorkerRecord<Worker>>;
	disposed: boolean;
	disposePromise?: Promise<void>;
};

/**
 * Every resource and lifecycle signal owned for one spawned worker.
 *
 * The record is created before the Worker exists so mount application and
 * disposal can still account for a child that is between creation steps.
 */
type ChildWorkerRecord<Worker extends TerminableWorker> = {
	childId: number;
	owner: ChildWorkerOwner<Worker>;
	descendantEndpoint: ChildWorkerServiceEndpoint;
	worker?: Worker;
	workerCreated: Deferred;
	initializationFinished: Deferred;
	mainPorts: MessagePort[];
	workerPorts: MessagePort[];
	fileLockManagerPort: MessagePort;
	childWorkerServicePort: MessagePort;
	childWorkerControlPort: MessagePort;
	controlApi: RemoteAPI<ChildWorkerControl>;
	controlConnected: Deferred;
	disposeRequested: Deferred;
	terminated: Deferred;
	mountPromise?: Promise<void>;
	disposePromise?: Promise<void>;
	exited: boolean;
	cleanedUp: boolean;
};

const SHUTTING_DOWN_ERROR = 'The child-worker service is shutting down.';
const OWNER_EXITED_ERROR = 'The spawning worker has already exited.';
const CHILD_EXITED_DURING_CREATION_ERROR =
	'The child worker exited before its creation completed.';

/**
 * Create the main-thread service that owns all recursively spawned workers.
 *
 * A child is inserted into the lifecycle map before its spawn begins. This is
 * important during WordPress installation: an apply-all sweep must see a child
 * even when that child has not finished its initialization handshake yet.
 *
 * createEndpoint() returns an owner-scoped view for one worker. All of those
 * views share this controller's child map and post-install mount history.
 */
export function createChildWorkerService<Worker extends TerminableWorker>(
	spawnWorker: SpawnChildWorker<Worker>,
	fileLockManager: FileLockManagerInMemory,
	enqueuePostInstallMount: EnqueuePostInstallMount
): ChildWorkerServiceController {
	const children = new Map<number, ChildWorkerRecord<Worker>>();
	const pendingCreations = new Set<Promise<CreatedChildWorker>>();
	let nextChildId = 1;
	let postInstallMounts: Array<Mount> | undefined;
	let disposed = false;
	let disposePromise: Promise<void> | undefined;

	return {
		createEndpoint,
		applyPostInstallMounts,
		liveChildWorkerCount,
		dispose,
	};

	function createEndpoint(): ChildWorkerServiceEndpoint {
		// Each worker gets a distinct owner even though every endpoint delegates
		// to the same controller. This is what lets parent exit clean up exactly
		// that parent's descendants.
		const owner: ChildWorkerOwner<Worker> = {
			children: new Set(),
			disposed,
		};
		const api: ChildWorkerService = {
			createChildWorker: function createOwnedChildWorker() {
				return createChildWorker(owner);
			},
			waitForChildReady,
			waitForChildExit,
			disposeChildWorker,
		};
		return {
			api,
			dispose: function disposeEndpoint() {
				return disposeOwner(owner);
			},
		};
	}

	function createChildWorker(
		owner: ChildWorkerOwner<Worker>
	): Promise<CreatedChildWorker> {
		if (disposed) {
			return Promise.reject(new Error(SHUTTING_DOWN_ERROR));
		}
		if (owner.disposed) {
			return Promise.reject(new Error(OWNER_EXITED_ERROR));
		}

		const child = createChildRecord(nextChildId++, owner);
		children.set(child.childId, child);
		owner.children.add(child);
		const creation = initializeChild(child);
		pendingCreations.add(creation);
		creation.then(removePendingCreation, removePendingCreation);
		return creation;

		function removePendingCreation(): void {
			pendingCreations.delete(creation);
		}
	}

	function createChildRecord(
		childId: number,
		owner: ChildWorkerOwner<Worker>
	): ChildWorkerRecord<Worker> {
		const lockChannel = new MessageChannel();
		const serviceChannel = new MessageChannel();
		const controlChannel = new MessageChannel();
		// A child can spawn its own descendants. Give it an owner-scoped endpoint
		// backed by this same controller so nesting does not create isolated state.
		const descendantEndpoint = createEndpoint();
		const controlApi = consumeAPI<ChildWorkerControl>(controlChannel.port1);
		const controlConnected = createDeferred();
		// Use a one-shot signal instead of consumeAPI().isConnected(), whose
		// deliberate retry loop cannot be cancelled if initialization never ends.
		controlChannel.port1.on(
			'message',
			function recognizeControlConnection(message): void {
				if (message === CHILD_WORKER_CONTROL_READY) {
					controlChannel.port1.off(
						'message',
						recognizeControlConnection
					);
					controlConnected.resolve();
				}
			}
		);

		// The main ends remain owned here for the child's entire lifetime. The
		// other ends are returned once, as one naturally transferable aggregate.
		exposeAPI(
			descendantEndpoint.api,
			undefined,
			serviceChannel.port1,
			childWorkerServiceTransferPolicy
		);
		lockChannel.port1.unref();
		serviceChannel.port1.unref();
		controlChannel.port1.unref();

		return {
			childId,
			owner,
			descendantEndpoint,
			workerCreated: createDeferred(),
			initializationFinished: createDeferred(),
			mainPorts: [
				lockChannel.port1,
				serviceChannel.port1,
				controlChannel.port1,
			],
			workerPorts: [
				lockChannel.port2,
				serviceChannel.port2,
				controlChannel.port2,
			],
			fileLockManagerPort: lockChannel.port2,
			childWorkerServicePort: serviceChannel.port2,
			childWorkerControlPort: controlChannel.port2,
			controlApi,
			controlConnected,
			disposeRequested: createDeferred(),
			terminated: createDeferred(),
			exited: false,
			cleanedUp: false,
		};
	}

	async function initializeChild(
		child: ChildWorkerRecord<Worker>
	): Promise<CreatedChildWorker> {
		try {
			await exposeSyncAPI(fileLockManager, child.mainPorts[0]);
			assertChildIsActive(child);

			const spawnedWorker = await spawnWorker({
				onWorkerCreated: function recordCreatedWorker(worker): void {
					child.worker = worker;
					child.workerCreated.resolve();
				},
				onExit: function recordWorkerExit(): void {
					handleChildExit(child);
				},
			});
			child.worker ??= spawnedWorker.worker;
			if (!isChildActive(child)) {
				// The exit callback can run before spawnWorker() returns its PHP
				// endpoint. In that ordering the first cleanup pass could not know
				// about this port, so close it at the ownership handoff.
				closePortQuietly(spawnedWorker.phpPort);
				assertChildIsActive(child);
			}
			child.workerPorts.push(spawnedWorker.phpPort);

			if (postInstallMounts !== undefined) {
				observeFutureChildMount(child, ensureChildMounted(child));
			}

			return {
				childId: child.childId,
				phpPort: spawnedWorker.phpPort,
				fileLockManagerPort: child.fileLockManagerPort,
				workerConfig: {
					processId: spawnedWorker.processId,
					childWorkerServicePort: child.childWorkerServicePort,
					childWorkerControlPort: child.childWorkerControlPort,
				},
			};
		} catch (error) {
			// Let a concurrent disposal know that spawnWorker() cannot produce a
			// Worker before asking that same disposal operation to finish.
			child.initializationFinished.resolve();
			await disposeChildRecord(child);
			throw error;
		} finally {
			child.initializationFinished.resolve();
		}
	}

	function assertChildIsActive(child: ChildWorkerRecord<Worker>): void {
		if (!isChildActive(child)) {
			throw new Error(
				disposed
					? SHUTTING_DOWN_ERROR
					: child.owner.disposed
						? OWNER_EXITED_ERROR
						: CHILD_EXITED_DURING_CREATION_ERROR
			);
		}
	}

	function observeFutureChildMount(
		child: ChildWorkerRecord<Worker>,
		mountPromise: Promise<void>
	): void {
		mountPromise.catch(function disposeChildAfterMountFailure(): void {
			// The original apply-all caller cannot observe a future child's mount
			// failure. Stop that child so its positive exit signal interrupts the
			// spawning worker instead of leaving it in a partially mounted state.
			if (children.get(child.childId) === child) {
				disposeChildWorker(child.childId).catch(
					function reportFailedChildDisposal(error): void {
						logger.error(
							`Failed to dispose child worker ${child.childId} ` +
								`after its mount failed: ${String(error)}`
						);
					}
				);
			}
		});
	}

	function waitForChildExit(childId: number): Promise<void> {
		const child = children.get(childId);
		if (child) {
			return child.terminated.promise;
		}
		// IDs are monotonic and never reused. A previously allocated ID that no
		// longer has a record therefore describes a child that already exited.
		if (Number.isInteger(childId) && childId > 0 && childId < nextChildId) {
			return Promise.resolve();
		}
		return Promise.reject(new Error(`Unknown child worker ${childId}.`));
	}

	async function waitForChildReady(childId: number): Promise<void> {
		const child = children.get(childId);
		if (!child) {
			throw new Error(`Child worker ${childId} has already exited.`);
		}
		await ensureChildMounted(child);
		if (!isChildActive(child)) {
			throw new Error(
				`Child worker ${childId} exited before becoming ready.`
			);
		}
	}

	async function applyPostInstallMounts(mounts: Array<Mount>): Promise<void> {
		// This records the mounts expected by future workers. Future workers do
		// not exist yet, so their application starts atomically at creation time.
		postInstallMounts ??= [...mounts];
		await Promise.all(
			[...children.values()].map(function mountChild(child) {
				return ensureChildMounted(child);
			})
		);
	}

	function ensureChildMounted(
		child: ChildWorkerRecord<Worker>
	): Promise<void> {
		if (postInstallMounts === undefined) {
			return Promise.resolve();
		}
		if (!child.mountPromise) {
			child.mountPromise = mountChildWhenConnected(
				child,
				postInstallMounts
			);
		}
		return child.mountPromise;
	}

	async function mountChildWhenConnected(
		child: ChildWorkerRecord<Worker>,
		mounts: Array<Mount>
	): Promise<void> {
		// A child exposes this private API only after its boot completes. Racing
		// connection with termination prevents WordPress installation from hanging
		// if the child crashes before it can expose the control endpoint.
		await Promise.race([
			child.controlConnected.promise,
			child.terminated.promise,
			child.disposeRequested.promise,
		]);
		if (!isChildActive(child)) {
			return;
		}

		const queuedMount = enqueuePostInstallMount(
			async function mountConnectedChild(): Promise<void> {
				if (!isChildActive(child)) {
					return;
				}
				const mountOperation =
					child.controlApi.mountAfterWordPressInstall(mounts);
				// Comlink does not reject a pending call when its endpoint closes.
				// Termination wins this race so install and disposal always settle.
				await Promise.race([
					mountOperation,
					child.terminated.promise,
					child.disposeRequested.promise,
				]);
			}
		);
		// A child waiting behind another NODEFS mount must not hold disposal open.
		await Promise.race([
			queuedMount,
			child.terminated.promise,
			child.disposeRequested.promise,
		]);
	}

	function isChildActive(child: ChildWorkerRecord<Worker>): boolean {
		return (
			!disposed &&
			!child.cleanedUp &&
			!child.disposePromise &&
			children.get(child.childId) === child
		);
	}

	function handleChildExit(child: ChildWorkerRecord<Worker>): void {
		child.exited = true;
		child.terminated.resolve();
		child.disposeRequested.resolve();
		child.descendantEndpoint
			.dispose()
			.catch(function reportDescendantDisposalFailure(error): void {
				logger.error(
					`Failed to dispose descendants of child worker ${child.childId}: ${String(
						error
					)}`
				);
			});
		cleanupChild(child);
	}

	function disposeOwner(owner: ChildWorkerOwner<Worker>): Promise<void> {
		if (!owner.disposePromise) {
			owner.disposed = true;
			owner.disposePromise = disposeOwnedChildren(owner);
		}
		return owner.disposePromise;
	}

	async function disposeOwnedChildren(
		owner: ChildWorkerOwner<Worker>
	): Promise<void> {
		const results = await Promise.allSettled(
			[...owner.children].map(function disposeOwnedChild(child) {
				return disposeChildRecord(child);
			})
		);
		const failures = results.flatMap(
			function collectDisposalFailure(result): unknown[] {
				return result.status === 'rejected' ? [result.reason] : [];
			}
		);
		if (failures.length === 1) {
			throw failures[0];
		}
		if (failures.length > 1) {
			throw new AggregateError(
				failures,
				'Failed to dispose one or more owned child workers.'
			);
		}
	}

	async function disposeChildWorker(childId: number): Promise<void> {
		const child = children.get(childId);
		if (!child) {
			return;
		}
		await disposeChildRecord(child);
	}

	function disposeChildRecord(
		child: ChildWorkerRecord<Worker>
	): Promise<void> {
		if (!child.disposePromise) {
			child.disposeRequested.resolve();
			child.disposePromise = stopAndCleanupChild(child);
		}
		return child.disposePromise;
	}

	async function stopAndCleanupChild(
		child: ChildWorkerRecord<Worker>
	): Promise<void> {
		// Descendants may be keeping this worker blocked in system(). Stop them
		// first so this worker can leave the synchronous spawn call cleanly.
		const failures: unknown[] = [];
		try {
			await child.descendantEndpoint.dispose();
		} catch (error) {
			// A failed descendant must not prevent this worker from being stopped.
			// It may still be blocked waiting for that descendant in system().
			failures.push(error);
		}
		if (!child.worker) {
			await Promise.race([
				child.workerCreated.promise,
				child.initializationFinished.promise,
			]);
		}
		let childTerminationFailed = false;
		if (child.worker) {
			try {
				await terminateChildWorker(child);
			} catch (error) {
				childTerminationFailed = true;
				failures.push(error);
			}
		}
		if (!childTerminationFailed) {
			// Worker.terminate() settling is sufficient even when a test double or
			// unusual Worker implementation does not emit the normal exit callback.
			child.terminated.resolve();
			try {
				await child.mountPromise;
			} catch {
				// A mount failure initiated disposal; cleanup still owns all endpoints.
			}
			cleanupChild(child);
		}
		if (failures.length === 1) {
			throw failures[0];
		}
		if (failures.length > 1) {
			throw new AggregateError(
				failures,
				`Failed to dispose child worker ${child.childId} and one or more descendants.`
			);
		}
	}

	async function terminateChildWorker(
		child: ChildWorkerRecord<Worker>
	): Promise<void> {
		try {
			await child.worker!.terminate();
		} catch (error) {
			if (!child.exited) {
				throw new Error(
					`Failed to terminate child worker ${child.childId}.`,
					{ cause: error }
				);
			}
			// An exit observed concurrently is stronger evidence than a rejected
			// redundant terminate() call; normal cleanup may continue.
		}
	}

	function cleanupChild(child: ChildWorkerRecord<Worker>): void {
		if (child.cleanedUp) {
			return;
		}
		child.cleanedUp = true;
		if (children.get(child.childId) === child) {
			children.delete(child.childId);
		}
		child.owner.children.delete(child);
		child.disposeRequested.resolve();
		child.terminated.resolve();
		releaseControlApiQuietly(child.controlApi);
		child.mainPorts.forEach(closePortQuietly);
		child.workerPorts.forEach(closePortQuietly);
	}

	function liveChildWorkerCount(): number {
		return children.size;
	}

	function dispose(): Promise<void> {
		if (!disposePromise) {
			disposed = true;
			// Observe every rejection immediately while pending creations unwind;
			// finishDisposal() reports them after the creation promises settle.
			const initialDisposals = Promise.allSettled(
				[...children.values()].map(function disposeChild(child) {
					return disposeChildRecord(child);
				})
			);
			disposePromise = finishDisposal(initialDisposals);
		}
		return disposePromise;
	}

	async function finishDisposal(
		initialDisposals: Promise<PromiseSettledResult<void>[]>
	): Promise<void> {
		// An initializing worker is already visible in `children`. Terminating
		// every worker known so far lets its pending spawn promise settle first.
		await Promise.allSettled([...pendingCreations]);
		const results = await initialDisposals;
		const failures = results.flatMap(
			function collectDisposalFailure(result) {
				return result.status === 'rejected' ? [result.reason] : [];
			}
		);
		if (failures.length === 1) {
			throw failures[0];
		}
		if (failures.length > 1) {
			throw new AggregateError(
				failures,
				'Failed to dispose one or more child workers.'
			);
		}
	}
}

function createDeferred(): Deferred {
	let resolvePromise!: () => void;
	const promise = new Promise<void>(function captureResolve(resolve): void {
		resolvePromise = resolve;
	});
	return { promise, resolve: resolvePromise };
}

function releaseControlApiQuietly(
	controlApi: RemoteAPI<ChildWorkerControl>
): void {
	try {
		controlApi[releaseApiProxy]();
	} catch {
		// The child exit may already have released or closed this endpoint.
	}
}

function closePortQuietly(port: MessagePort): void {
	try {
		port.close();
	} catch {
		// A transferred or previously closed port needs no further cleanup.
	}
}
