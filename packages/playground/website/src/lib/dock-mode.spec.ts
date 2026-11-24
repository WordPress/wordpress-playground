import { readDockMode } from './dock-mode';

describe('readDockMode', () => {
	it.each([
		'minimized',
		'collapsed',
		'expanded',
		'full-width',
		'full-width-collapsed',
	])('reads the %s initial mode', (mode) => {
		expect(
			readDockMode(new URL(`https://playground.test/?dock=${mode}`))
		).toBe(mode);
	});

	it.each(['', '?dock=unknown', '?dock='])(
		'uses the default for a missing or unsupported mode: %s',
		(query) => {
			expect(
				readDockMode(new URL(`https://playground.test/${query}`))
			).toBeUndefined();
		}
	);
});
