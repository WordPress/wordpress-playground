import { readDockStartsMinimized } from './dock-minimized';

describe('readDockStartsMinimized', () => {
	it('starts minimized only for dock=minimized', () => {
		expect(
			readDockStartsMinimized(
				new URL('https://playground.test/?dock=minimized')
			)
		).toBe(true);
		expect(
			readDockStartsMinimized(new URL('https://playground.test/'))
		).toBe(false);
		expect(
			readDockStartsMinimized(
				new URL('https://playground.test/?dock=expanded')
			)
		).toBe(false);
	});
});
