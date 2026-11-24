import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	parseOptionsAndRunCLI: vi.fn(),
	shouldRespawnWithJSPI: vi.fn(),
}));

vi.mock('../src/run-cli', () => ({
	parseOptionsAndRunCLI: mocks.parseOptionsAndRunCLI,
}));

vi.mock('../src/ensure-jspi', () => ({
	shouldRespawnWithJSPI: mocks.shouldRespawnWithJSPI,
}));

const handledSignals = ['SIGINT', 'SIGTERM'] as const;

describe('CLI signal handling', () => {
	beforeEach(() => {
		vi.resetModules();
		mocks.parseOptionsAndRunCLI.mockReset();
		mocks.shouldRespawnWithJSPI.mockReset();
		mocks.shouldRespawnWithJSPI.mockReturnValue(false);
	});

	test.each(handledSignals)('cleans up and exits on %s', async (signal) => {
		const listenersBeforeImport = new Map(
			handledSignals.map(
				(handledSignal) =>
					[handledSignal, process.listeners(handledSignal)] as const
			)
		);
		let finishDisposal: () => void;
		const disposalFinished = new Promise<void>((resolve) => {
			finishDisposal = resolve;
		});
		const asyncDispose = vi.fn().mockReturnValue(disposalFinished);
		mocks.parseOptionsAndRunCLI.mockResolvedValue({
			[Symbol.asyncDispose]: asyncDispose,
		});
		const exitSpy = vi
			.spyOn(process, 'exit')
			.mockImplementation((() => undefined) as any);

		const getAddedListeners = (
			handledSignal: (typeof handledSignals)[number]
		) =>
			process
				.listeners(handledSignal)
				.filter(
					(listener) =>
						!listenersBeforeImport
							.get(handledSignal)!
							.includes(listener)
				);

		try {
			await import('../src/cli');
			await vi.waitFor(() => {
				expect(getAddedListeners('SIGINT')).toHaveLength(1);
				expect(getAddedListeners('SIGTERM')).toHaveLength(1);
			});

			expect(exitSpy).not.toHaveBeenCalled();
			const signalHandler = getAddedListeners(
				signal
			)[0] as () => Promise<void>;
			const signalHandling = signalHandler();

			expect(asyncDispose).toHaveBeenCalledOnce();
			expect(exitSpy).not.toHaveBeenCalled();
			finishDisposal!();
			await signalHandling;
			expect(exitSpy).toHaveBeenCalledWith(0);
		} finally {
			for (const handledSignal of handledSignals) {
				for (const listener of getAddedListeners(handledSignal)) {
					process.off(handledSignal, listener);
				}
			}
			exitSpy.mockRestore();
		}
	});
});
