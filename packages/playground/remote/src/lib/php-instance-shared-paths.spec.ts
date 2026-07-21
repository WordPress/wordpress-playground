import { describe, expect, it } from 'vitest';
import { getPhpInstanceSharedPaths } from './php-instance-shared-paths';

describe('getPhpInstanceSharedPaths', () => {
	it('shares an alias target without widening it to an ancestor', () => {
		const sharedPaths = getPhpInstanceSharedPaths('/wordpress', [
			{
				urlPrefix: '/phpmyadmin',
				fsPath: '/tools/phpmyadmin',
			},
		]);

		expect(sharedPaths).toContain('/tools/phpmyadmin');
		expect(sharedPaths).not.toContain('/tools');
	});
});
