// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@php-wasm/logger';
import { SiteLogs } from './index';
import { logTrackingEvent } from '../../lib/tracking';

vi.mock('../../lib/tracking', () => ({
	logTrackingEvent: vi.fn(),
}));

describe('log search analytics', () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeEach(async () => {
		vi.useFakeTimers();
		vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
		vi.spyOn(logger, 'getLogs').mockReturnValue([
			'PHP Notice: test notice',
		]);
		container = document.createElement('div');
		document.body.append(container);
		root = createRoot(container);
		await act(async () => root.render(<SiteLogs />));
	});

	afterEach(() => {
		act(() => root.unmount());
		container.remove();
		vi.restoreAllMocks();
		vi.clearAllMocks();
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('reports one event after typing pauses without sending the search text', async () => {
		for (const value of ['n', 'no', 'not', 'noti', 'notic', 'notice']) {
			await changeSearch(value);
			await act(async () => {
				await vi.advanceTimersByTimeAsync(100);
			});
		}
		expect(logTrackingEvent).not.toHaveBeenCalled();
		await act(async () => {
			await vi.advanceTimersByTimeAsync(500);
		});
		expect(logTrackingEvent).toHaveBeenCalledOnce();
		expect(logTrackingEvent).toHaveBeenCalledWith('logsSearch');
	});

	it('does not report searches cleared before the debounce finishes', async () => {
		await changeSearch('notice');
		await changeSearch('');
		await act(async () => {
			await vi.advanceTimersByTimeAsync(500);
		});
		expect(logTrackingEvent).not.toHaveBeenCalled();
	});

	it('cancels pending analytics when the component unmounts', async () => {
		await changeSearch('notice');
		await act(async () => root.render(null));
		await act(async () => {
			await vi.advanceTimersByTimeAsync(500);
		});
		expect(logTrackingEvent).not.toHaveBeenCalled();
	});

	async function changeSearch(value: string) {
		const input = container.querySelector('input');
		if (!input) {
			throw new Error('Search input is missing');
		}
		await act(async () => {
			Object.getOwnPropertyDescriptor(
				HTMLInputElement.prototype,
				'value'
			)?.set?.call(input, value);
			input.dispatchEvent(new Event('input', { bubbles: true }));
		});
	}
});
