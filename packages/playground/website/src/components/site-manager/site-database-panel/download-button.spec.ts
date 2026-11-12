// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlaygroundClient } from '@wp-playground/client';
import {
	downloadDatabase,
	OBJECT_URL_REVOKE_DELAY_MS,
} from './download-button';

describe('downloadDatabase', () => {
	const createObjectURL = vi.fn(() => 'blob:database');
	const revokeObjectURL = vi.fn();
	const click = vi
		.spyOn(HTMLAnchorElement.prototype, 'click')
		.mockImplementation(() => {});

	beforeEach(() => {
		vi.useFakeTimers();
		Object.defineProperty(URL, 'createObjectURL', {
			configurable: true,
			value: createObjectURL,
		});
		Object.defineProperty(URL, 'revokeObjectURL', {
			configurable: true,
			value: revokeObjectURL,
		});
		createObjectURL.mockClear();
		revokeObjectURL.mockClear();
		click.mockClear();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('rejects missing database files', async () => {
		const playground = {
			fileExists: vi.fn().mockResolvedValue(false),
		} as unknown as PlaygroundClient;

		await expect(
			downloadDatabase(playground, '/wordpress/database.sqlite')
		).rejects.toThrow('Database file does not exist');
		expect(createObjectURL).not.toHaveBeenCalled();
	});

	it('keeps the object URL alive long enough for the browser download', async () => {
		const playground = {
			fileExists: vi.fn().mockResolvedValue(true),
			readFileAsBuffer: vi.fn().mockResolvedValue(new Uint8Array([1, 2])),
		} as unknown as PlaygroundClient;

		await downloadDatabase(playground, '/wordpress/database.sqlite');

		expect(click).toHaveBeenCalledOnce();
		expect(
			document.querySelector('a[download="database.sqlite"]')
		).toBeNull();
		expect(revokeObjectURL).not.toHaveBeenCalled();

		vi.advanceTimersByTime(OBJECT_URL_REVOKE_DELAY_MS);
		expect(revokeObjectURL).toHaveBeenCalledWith('blob:database');
	});
});
