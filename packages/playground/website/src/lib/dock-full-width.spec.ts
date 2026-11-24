// @vitest-environment jsdom

import { readDockFullWidth, writeDockFullWidth } from './dock-full-width';

describe('Dock full-width preference', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('persists and clears full-width mode', () => {
		expect(readDockFullWidth()).toBe(false);

		writeDockFullWidth(true);
		expect(readDockFullWidth()).toBe(true);

		writeDockFullWidth(false);
		expect(readDockFullWidth()).toBe(false);
		expect(localStorage.getItem('playground-dock-full-width')).toBeNull();
	});

	it('falls back when storage is unavailable', () => {
		const getItem = vi
			.spyOn(Storage.prototype, 'getItem')
			.mockImplementation(() => {
				throw new Error('Storage is unavailable');
			});
		const setItem = vi
			.spyOn(Storage.prototype, 'setItem')
			.mockImplementation(() => {
				throw new Error('Storage is unavailable');
			});

		expect(readDockFullWidth()).toBe(false);
		expect(() => writeDockFullWidth(true)).not.toThrow();

		getItem.mockRestore();
		setItem.mockRestore();
	});
});
