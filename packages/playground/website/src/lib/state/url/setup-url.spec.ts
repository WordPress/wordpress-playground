import { getSetupUrlFingerprint } from './setup-url';

describe('getSetupUrlFingerprint', () => {
	it('ignores runtime, UI, and cache-busting parameters', () => {
		const first = getSetupUrlFingerprint(
			new URL(
				'https://playground.test/?php=8.3&wp=6.8&random=abc&modal=save-site&site-slug=demo&_=1&cacheBustWhatever=1#'
			)
		);
		const second = getSetupUrlFingerprint(
			new URL('https://playground.test/?wp=6.8&php=8.3&cb=2&ts=3&v=4')
		);

		expect(first).toBe(second);
	});

	it('keeps setup-affecting parameters distinct', () => {
		expect(
			getSetupUrlFingerprint(
				new URL('https://playground.test/?php=8.3&wp=6.8')
			)
		).not.toBe(
			getSetupUrlFingerprint(
				new URL('https://playground.test/?php=8.4&wp=6.8')
			)
		);
	});

	it('includes the blueprint fragment', () => {
		expect(
			getSetupUrlFingerprint(new URL('https://playground.test/#one'))
		).not.toBe(
			getSetupUrlFingerprint(new URL('https://playground.test/#two'))
		);
	});
});
