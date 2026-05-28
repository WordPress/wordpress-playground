import { getRemoteUrl } from './config';
import {
	getPlaygroundPrPreview,
	playgroundPrParam,
	playgroundPrShaParam,
} from './playground-pr-preview';

describe('getPlaygroundPrPreview', () => {
	it('returns a numeric PR and optional SHA', () => {
		expect(
			getPlaygroundPrPreview(
				'https://playground.test/?playground-pr=123&playground-pr-sha=abcdef1'
			)
		).toEqual({ pr: '123', sha: 'abcdef1' });
	});

	it('ignores invalid preview parameters', () => {
		expect(
			getPlaygroundPrPreview('https://playground.test/?playground-pr=abc')
		).toBeUndefined();
		expect(
			getPlaygroundPrPreview(
				'https://playground.test/?playground-pr=123&playground-pr-sha=not-a-sha'
			)
		).toBeUndefined();
	});
});

describe('getRemoteUrl', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('preserves Playground PR preview parameters for remote.html', () => {
		vi.stubGlobal('window', {
			location: new URL(
				'https://playground.test/?playground-pr=123&playground-pr-sha=abcdef1'
			),
		});

		const remoteUrl = getRemoteUrl();
		expect(remoteUrl.pathname).toBe('/remote.html');
		expect(remoteUrl.searchParams.get(playgroundPrParam)).toBe('123');
		expect(remoteUrl.searchParams.get(playgroundPrShaParam)).toBe(
			'abcdef1'
		);
	});
});
