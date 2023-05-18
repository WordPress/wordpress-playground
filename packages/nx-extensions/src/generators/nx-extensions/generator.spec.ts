import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, readProjectConfiguration } from '@nx/devkit';

import generator from './generator';
import { NxExtensionsGeneratorSchema } from './schema';

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
