import {
	consumeAPI,
	FileLockManagerInMemory,
	exposeAPI,
} from '@php-wasm/universal';
import { MessageChannel, MessagePort } from 'worker_threads';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	createChildWorkerService,
	type ChildWorkerServiceController,
	type SpawnChildWorker,
	type SpawnChildWorkerOptions,
	type TerminableWorker,
} from '../src/child-worker-service';
import {
	CHILD_WORKER_CONTROL_READY,
	childWorkerServiceTransferPolicy,
	type ChildWorkerControl,
	type ChildWorkerService,
} from '../src/worker-boot-config';

type ExitListener = (code: number, processId: number) => void;

class FakeWorker implements TerminableWorker {
	terminateCalls = 0;
	private exited = false;
	private readonly processId: number;
	private readonly notifyExit: ExitListener;

	constructor(processId: number, notifyExit: ExitListener) {
		this.processId = processId;
		this.notifyExit = notifyExit;
	}

	async terminate(): Promise<number> {
		this.terminateCalls++;
		this.exit();
		return 0;
	}

	exit(code = 0): void {
		if (this.exited) {
			return;
		}
		this.exited = true;
		this.notifyExit(code, this.processId);
	}
}

type SpawnHarness = {
	spawnWorker: SpawnChildWorker<FakeWorker>;
	workers: FakeWorker[];
	phpMainPorts: MessagePort[];
};

type TestController = ChildWorkerServiceController & {
	api: ChildWorkerService;
};

const controllers: ChildWorkerServiceController[] = [];

afterEach(async function disposeControllers(): Promise<void> {
	await Promise.all(controllers.splice(0).map(disposeController));

	async function disposeController(
		controller: ChildWorkerServiceController
	): Promise<void> {
		await controller.dispose();
	}
});

describe('createChildWorkerService', function () {
	it('returns every child port and its worker config in one aggregate', async function () {
		const harness = createSpawnHarness();
		const controller = createController(harness);

		const first = await controller.api.createChildWorker();
		const second = await controller.api.createChildWorker();

		expect(first.childId).toBe(1);
		expect(first.workerConfig).toMatchObject({
			processId: 101,
		});
		expect(first.workerConfig).not.toHaveProperty('childId');
		expect(first.phpPort).toBeInstanceOf(MessagePort);
		expect(first.fileLockManagerPort).toBeInstanceOf(MessagePort);
		expect(first.workerConfig.childWorkerServicePort).toBeInstanceOf(
			MessagePort
		);
		expect(first.workerConfig.childWorkerControlPort).toBeInstanceOf(
			MessagePort
		);
		expect(
			new Set([
				first.phpPort,
				first.fileLockManagerPort,
				first.workerConfig.childWorkerServicePort,
				first.workerConfig.childWorkerControlPort,
			]).size
		).toBe(4);
		expect(second.childId).toBe(2);
		expect(second.workerConfig.processId).toBe(102);
		expect(controller.liveChildWorkerCount()).toBe(2);
	});

	it('applies post-install mounts to a connected current child', async function () {
		const harness = createSpawnHarness();
		const controller = createController(harness);
		const child = await controller.api.createChildWorker();
		const mountHandler = vi.fn(
			async function mountAfterWordPressInstall(): Promise<void> {}
		);
		exposeChildControl(
			child.workerConfig.childWorkerControlPort,
			mountHandler
		);
		const mounts = [
			{ hostPath: '/host/plugin', vfsPath: '/wordpress/plugin' },
		];

		await controller.applyPostInstallMounts(mounts);

		expect(mountHandler).toHaveBeenCalledOnce();
		expect(mountHandler).toHaveBeenCalledWith(mounts);
	});

	it('records mounts for a future child and waits until its mount finishes', async function () {
		const harness = createSpawnHarness();
		const controller = createController(harness);
		const mounts = [
			{ hostPath: '/host/theme', vfsPath: '/wordpress/theme' },
		];
		await controller.applyPostInstallMounts(mounts);
		const child = await controller.api.createChildWorker();
		let finishMount!: () => void;
		const mountFinished = new Promise<void>(function captureFinishMount(
			resolve
		): void {
			finishMount = resolve;
		});
		const mountHandler = vi.fn(
			async function mountAfterWordPressInstall(): Promise<void> {
				await mountFinished;
			}
		);

		const childReady = controller.api.waitForChildReady(child.childId);
		let readySettled = false;
		void childReady.finally(function noteReadySettled(): void {
			readySettled = true;
		});
		await nextTask();
		expect(readySettled).toBe(false);

		exposeChildControl(
			child.workerConfig.childWorkerControlPort,
			mountHandler
		);
		await vi.waitFor(function waitForMountStart(): void {
			expect(mountHandler).toHaveBeenCalledOnce();
		});
		expect(mountHandler).toHaveBeenCalledWith(mounts);
		expect(readySettled).toBe(false);

		finishMount();
		await childReady;
		expect(readySettled).toBe(true);
	});

	it('fulfills the exit signal and unblocks mount application on child exit', async function () {
		const harness = createSpawnHarness();
		const controller = createController(harness);
		const child = await controller.api.createChildWorker();
		const childExited = controller.api.waitForChildExit(child.childId);
		const mountsApplied = controller.applyPostInstallMounts([
			{ hostPath: '/host/data', vfsPath: '/wordpress/data' },
		]);

		await nextTask();
		harness.workers[0].exit(7);

		await expect(childExited).resolves.toBeUndefined();
		await expect(mountsApplied).resolves.toBeUndefined();
		await expect(
			controller.api.waitForChildExit(child.childId)
		).resolves.toBeUndefined();
		expect(controller.liveChildWorkerCount()).toBe(0);
	});

	it('cascades endpoint disposal through child and grandchild workers', async function () {
		const harness = createSpawnHarness();
		const controller = createChildWorkerService(
			harness.spawnWorker,
			new FileLockManagerInMemory(),
			async function runMountImmediately(mount): Promise<void> {
				await mount();
			}
		);
		controllers.push(controller);
		const topLevelWorkerEndpoint = controller.createEndpoint();
		const child = await topLevelWorkerEndpoint.api.createChildWorker();
		const childService = consumeAPI<ChildWorkerService>(
			child.workerConfig.childWorkerServicePort,
			undefined,
			childWorkerServiceTransferPolicy
		);
		await childService.createChildWorker();

		await topLevelWorkerEndpoint.dispose();

		expect(harness.workers).toHaveLength(2);
		expect(harness.workers[0].terminateCalls).toBe(1);
		expect(harness.workers[1].terminateCalls).toBe(1);
		expect(controller.liveChildWorkerCount()).toBe(0);
	});

	it('terminates a parent when grandchild termination fails', async function () {
		const harness = createSpawnHarness();
		const controller = createChildWorkerService(
			harness.spawnWorker,
			new FileLockManagerInMemory(),
			async function runMountImmediately(mount): Promise<void> {
				await mount();
			}
		);
		const topLevelWorkerEndpoint = controller.createEndpoint();
		const child = await topLevelWorkerEndpoint.api.createChildWorker();
		const childService = consumeAPI<ChildWorkerService>(
			child.workerConfig.childWorkerServicePort,
			undefined,
			childWorkerServiceTransferPolicy
		);
		await childService.createChildWorker();
		harness.workers[1].terminate = vi.fn(
			async function rejectGrandchildTermination(): Promise<number> {
				throw new Error('Grandchild termination was rejected');
			}
		);

		await expect(topLevelWorkerEndpoint.dispose()).rejects.toThrow(
			'Failed to terminate child worker 2.'
		);

		expect(harness.workers[0].terminateCalls).toBe(1);
		expect(harness.workers[1].terminate).toHaveBeenCalledOnce();
		expect(controller.liveChildWorkerCount()).toBe(1);

		// Model a later native exit so this test leaves no live service records.
		harness.workers[1].exit();
		await vi.waitFor(function waitForLateGrandchildExitCleanup(): void {
			expect(controller.liveChildWorkerCount()).toBe(0);
		});
		harness.phpMainPorts.forEach(function closePHPMainPort(port): void {
			port.close();
		});
	});

	it('disposes descendants when their spawning child exits', async function () {
		const harness = createSpawnHarness();
		const controller = createController(harness);
		const child = await controller.api.createChildWorker();
		const childService = consumeAPI<ChildWorkerService>(
			child.workerConfig.childWorkerServicePort,
			undefined,
			childWorkerServiceTransferPolicy
		);
		await childService.createChildWorker();

		harness.workers[0].exit(17);

		await vi.waitFor(function waitForDescendantDisposal(): void {
			expect(harness.workers[1].terminateCalls).toBe(1);
			expect(controller.liveChildWorkerCount()).toBe(0);
		});
	});

	it('closes a PHP port returned after the worker has already exited', async function () {
		let phpPortClosed = false;
		let phpMainPort: MessagePort | undefined;
		const spawnWorker = async function spawnWorker(
			options: SpawnChildWorkerOptions<FakeWorker>
		) {
			const processId = 101;
			const worker = new FakeWorker(processId, options.onExit);
			const phpChannel = new MessageChannel();
			phpMainPort = phpChannel.port1;
			phpChannel.port2.once('close', function recordPortClose(): void {
				phpPortClosed = true;
			});
			options.onWorkerCreated(worker);
			worker.exit(9);
			return {
				processId,
				worker,
				phpPort: phpChannel.port2,
			};
		};
		const controller = createChildWorkerService(
			spawnWorker,
			new FileLockManagerInMemory(),
			async function runMountImmediately(mount): Promise<void> {
				await mount();
			}
		);
		controllers.push(controller);
		const endpoint = controller.createEndpoint();

		await expect(endpoint.api.createChildWorker()).rejects.toThrow(
			'exited before its creation completed'
		);
		await vi.waitFor(function waitForPortClose(): void {
			expect(phpPortClosed).toBe(true);
		});
		expect(controller.liveChildWorkerCount()).toBe(0);
		phpMainPort?.close();
	});

	it('propagates a child mount failure and still disposes cleanly', async function () {
		const harness = createSpawnHarness();
		const controller = createController(harness);
		const child = await controller.api.createChildWorker();
		const mountFailure = new Error('Could not mount the child filesystem');
		exposeChildControl(
			child.workerConfig.childWorkerControlPort,
			async function rejectMount(): Promise<void> {
				throw mountFailure;
			}
		);

		await expect(
			controller.applyPostInstallMounts([
				{ hostPath: '/host/failure', vfsPath: '/wordpress/failure' },
			])
		).rejects.toThrow(mountFailure.message);

		await expect(controller.dispose()).resolves.toBeUndefined();
		expect(controller.liveChildWorkerCount()).toBe(0);
		expect(harness.workers[0].terminateCalls).toBe(1);
	});

	it('makes child and service disposal idempotent', async function () {
		const harness = createSpawnHarness();
		const controller = createController(harness);
		const child = await controller.api.createChildWorker();

		await Promise.all([
			controller.api.disposeChildWorker(child.childId),
			controller.api.disposeChildWorker(child.childId),
		]);
		await Promise.all([controller.dispose(), controller.dispose()]);

		expect(harness.workers[0].terminateCalls).toBe(1);
		expect(controller.liveChildWorkerCount()).toBe(0);
		await expect(controller.api.createChildWorker()).rejects.toThrow(
			'shutting down'
		);
	});

	it('retains and reports a worker whose termination fails', async function () {
		const terminationFailure = new Error('Worker termination was rejected');
		const worker: TerminableWorker = {
			terminate: vi.fn(
				async function rejectTermination(): Promise<number> {
					throw terminationFailure;
				}
			),
		};
		let signalExit!: ExitListener;
		const phpChannel = new MessageChannel();
		const controller = createChildWorkerService(
			async function spawnWorker(options) {
				signalExit = options.onExit;
				options.onWorkerCreated(worker);
				return {
					processId: 101,
					worker,
					phpPort: phpChannel.port2,
				};
			},
			new FileLockManagerInMemory(),
			async function runMountImmediately(mount): Promise<void> {
				await mount();
			}
		);
		const endpoint = controller.createEndpoint();
		await endpoint.api.createChildWorker();

		await expect(controller.dispose()).rejects.toThrow(
			'Failed to terminate child worker 1.'
		);
		expect(worker.terminate).toHaveBeenCalledOnce();
		expect(controller.liveChildWorkerCount()).toBe(1);

		// Model a later native exit so this test leaves no live service records.
		signalExit(0, 101);
		await vi.waitFor(function waitForLateExitCleanup(): void {
			expect(controller.liveChildWorkerCount()).toBe(0);
		});
		phpChannel.port1.close();
	});
});

function createController(harness: SpawnHarness): TestController {
	let mountQueue = Promise.resolve();
	const controller = createChildWorkerService(
		harness.spawnWorker,
		new FileLockManagerInMemory(),
		function enqueuePostInstallMount(
			mount: () => Promise<void>
		): Promise<void> {
			const result = mountQueue.then(mount);
			// Keep the private tail fulfilled so one caller's failure does not stop
			// later workers. The returned promise still reports this mount's failure.
			mountQueue = result.then(ignoreMountResult, ignoreMountFailure);
			return result;

			function ignoreMountResult(): void {
				// The private queue only represents when the next mount may start.
			}

			function ignoreMountFailure(): void {
				// The operation's own returned promise preserves this failure.
			}
		}
	);
	controllers.push(controller);
	const endpoint = controller.createEndpoint();
	return { ...controller, api: endpoint.api };
}

function createSpawnHarness(): SpawnHarness {
	const workers: FakeWorker[] = [];
	const phpMainPorts: MessagePort[] = [];
	let nextProcessId = 101;

	const spawnWorker = async function spawnWorker(
		options: SpawnChildWorkerOptions<FakeWorker>
	) {
		const processId = nextProcessId++;
		const worker = new FakeWorker(processId, options.onExit);
		const phpChannel = new MessageChannel();
		workers.push(worker);
		phpMainPorts.push(phpChannel.port1);
		options.onWorkerCreated(worker);
		return {
			processId,
			worker,
			phpPort: phpChannel.port2,
		};
	};

	return { spawnWorker, workers, phpMainPorts };
}

function exposeChildControl(
	port: MessagePort,
	mountAfterWordPressInstall: ChildWorkerControl['mountAfterWordPressInstall']
): void {
	exposeAPI({ mountAfterWordPressInstall }, undefined, port);
	port.postMessage(CHILD_WORKER_CONTROL_READY);
}

function nextTask(): Promise<void> {
	return new Promise<void>(function resolveOnNextTask(resolve): void {
		setTimeout(resolve, 0);
	});
}
