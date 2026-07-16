import { getDockToolsOverflow } from './dock-tools-overflow';

describe('getDockToolsOverflow', () => {
	it('reports no hidden destinations when every item fits', () => {
		expect(
			getDockToolsOverflow({
				clientWidth: 600,
				scrollLeft: 0,
				scrollWidth: 600,
			})
		).toEqual({
			canScrollBackward: false,
			canScrollForward: false,
		});
	});

	it.each([
		[0, false, true],
		[100, true, true],
		[240, true, false],
	] as const)(
		'reports the available directions at scrollLeft %d',
		(scrollLeft, canScrollBackward, canScrollForward) => {
			expect(
				getDockToolsOverflow({
					clientWidth: 360,
					scrollLeft,
					scrollWidth: 600,
				})
			).toEqual({ canScrollBackward, canScrollForward });
		}
	);

	it('treats a one-pixel remainder as the end of the strip', () => {
		expect(
			getDockToolsOverflow({
				clientWidth: 360,
				scrollLeft: 239,
				scrollWidth: 600,
			})
		).toEqual({
			canScrollBackward: true,
			canScrollForward: false,
		});
	});

	it.each([
		[-18, false, true],
		[258, true, false],
	] as const)(
		'clamps elastic overscroll at scrollLeft %d',
		(scrollLeft, canScrollBackward, canScrollForward) => {
			expect(
				getDockToolsOverflow({
					clientWidth: 360,
					scrollLeft,
					scrollWidth: 600,
				})
			).toEqual({ canScrollBackward, canScrollForward });
		}
	);
});
