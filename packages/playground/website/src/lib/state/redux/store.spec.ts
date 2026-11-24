// @vitest-environment jsdom

import {
	isYouHaveAutosaveNudgeEnabled,
	setYouHaveAutosaveNudgeEnabled,
} from './store';

describe('You Have Autosave nudge preference', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('persists both enabled states across readers', () => {
		const values = new Map<string, string>();
		vi.stubGlobal('localStorage', {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) => values.set(key, value),
		});

		expect(isYouHaveAutosaveNudgeEnabled()).toBe(true);
		setYouHaveAutosaveNudgeEnabled(false);
		expect(isYouHaveAutosaveNudgeEnabled()).toBe(false);
		setYouHaveAutosaveNudgeEnabled(true);
		expect(isYouHaveAutosaveNudgeEnabled()).toBe(true);
	});

	it('degrades to a session dismissal when storage is unavailable', () => {
		vi.stubGlobal('localStorage', {
			getItem: () => {
				throw new Error('unavailable');
			},
			setItem: () => {
				throw new Error('unavailable');
			},
		});

		expect(isYouHaveAutosaveNudgeEnabled()).toBe(true);
		expect(() => setYouHaveAutosaveNudgeEnabled(false)).not.toThrow();
	});
});
