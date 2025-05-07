import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import type { Tree } from '@nx/devkit';
import { readProjectConfiguration } from '@nx/devkit';

import generator from './generator';
import type { NxExtensionsGeneratorSchema } from './schema';

describe('nx-extensions generator', () => {
	let appTree: Tree;
	const options: NxExtensionsGeneratorSchema = { name: 'test' };

	beforeEach(() => {
		appTree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
	});

	it('should run successfully', async () => {
		await generator(appTree, options);
		const config = readProjectConfiguration(appTree, 'test');
		expect(config).toBeDefined();
	});
});
