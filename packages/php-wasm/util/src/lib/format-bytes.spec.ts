import { formatBytes } from './format-bytes';

describe('formatBytes', () => {
	it('picks the unit by magnitude', () => {
		expect(formatBytes(512)).toBe('512 B');
		expect(formatBytes(20 * 1024)).toBe('20 KB');
		expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB');
	});
});
