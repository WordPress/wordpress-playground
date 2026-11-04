import {
	getWordPressBridgePath,
	isWordPressBridgePath,
} from './wordpress-bridge-path';

describe('WordPress helper document paths', () => {
	it.each(['a'.repeat(40), '1793090000'])(
		'uses a separate allowed path for build %s',
		(version) => {
			const path = getWordPressBridgePath(version);
			expect(path).not.toBe('/wordpress-bridge.html');
			expect(isWordPressBridgePath(path)).toBe(true);
		}
	);

	it('keeps the legacy helper available', () => {
		expect(isWordPressBridgePath('/wordpress-bridge.html')).toBe(true);
	});

	it.each([
		'/api.html',
		'/wordpress-bridge-api.html',
		'/wordpress-bridge-.html',
		'/wordpress-bridge-deadbeef.php',
		'/wordpress-bridge-deadbeef.html/../api.html',
		'/wordpress-bridge-%2e%2e.html',
	])('does not map %s to the helper', (path) => {
		expect(isWordPressBridgePath(path)).toBe(false);
	});
});
