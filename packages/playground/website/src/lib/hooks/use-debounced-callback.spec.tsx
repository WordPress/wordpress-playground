// @vitest-environment jsdom

import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { useDebouncedCallback } from './use-debounced-callback';

type SaveCallback = {
	(value: string): void;
	flush: () => Promise<string> | undefined;
};

describe('useDebouncedCallback', () => {
	let container: HTMLDivElement;
	let root: Root;
	let isMounted: boolean;
	let save: SaveCallback | undefined;

	beforeAll(() => {
		vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
	});

	afterAll(() => {
		vi.unstubAllGlobals();
	});

	beforeEach(() => {
		vi.useFakeTimers();
		container = document.createElement('div');
		document.body.append(container);
		root = createRoot(container);
		isMounted = true;
		save = undefined;
	});

	afterEach(() => {
		if (isMounted) {
			act(() => root.unmount());
		}
		container.remove();
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	it('flushes only the latest pending call and returns its result', async () => {
		const result = Promise.resolve('saved');
		const callback = vi.fn(() => result);
		act(() => {
			root.render(<DebouncedCallbackProbe callback={callback} />);
		});

		act(() => {
			getSave()('first');
			getSave()('latest');
		});
		const flushResult = getSave().flush();

		expect(flushResult).toBe(result);
		expect(callback).toHaveBeenCalledOnce();
		expect(callback).toHaveBeenCalledWith('latest');
		await expect(flushResult).resolves.toBe('saved');

		act(() => vi.advanceTimersByTime(100));
		expect(callback).toHaveBeenCalledOnce();
	});

	it('allows an owner cleanup to flush during unmount', () => {
		const callback = vi.fn(async (value: string) => value);
		act(() => {
			root.render(
				<DebouncedCallbackProbe callback={callback} flushOnUnmount />
			);
		});

		act(() => getSave()('pending'));
		act(() => root.unmount());
		isMounted = false;

		expect(callback).toHaveBeenCalledOnce();
		expect(callback).toHaveBeenCalledWith('pending');
		act(() => vi.advanceTimersByTime(100));
		expect(callback).toHaveBeenCalledOnce();
	});

	/** Exposes the hook result and optionally mirrors an owner's cleanup flush. */
	function DebouncedCallbackProbe({
		callback,
		flushOnUnmount = false,
	}: {
		callback: (value: string) => Promise<string>;
		flushOnUnmount?: boolean;
	}) {
		const debounced = useDebouncedCallback(callback, 100);
		save = debounced;

		useEffect(() => {
			if (!flushOnUnmount) {
				return;
			}
			return () => {
				void debounced.flush();
			};
		}, [debounced, flushOnUnmount]);

		return null;
	}

	/** Returns the latest hook result after its probe has rendered. */
	function getSave(): SaveCallback {
		if (!save) {
			throw new Error('The debounced callback probe has not rendered.');
		}
		return save;
	}
});
