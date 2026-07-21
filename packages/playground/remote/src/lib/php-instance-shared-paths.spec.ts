import { describe, expect, it } from 'vitest';
import { getPhpInstanceSharedPaths } from './php-instance-shared-paths';

describe('getPhpInstanceSharedPaths', () => {
	it('shares the parent of an alias that may be installed later', () => {
		const sharedPaths = getPhpInstanceSharedPaths('/wordpress', [
			{
				urlPrefix: '/phpmyadmin',
				fsPath: '/tools/phpmyadmin',
			},
		]);

		expect(sharedPaths).toContain('/tools');
		expect(sharedPaths).not.toContain('/tools/phpmyadmin');
	});
});
