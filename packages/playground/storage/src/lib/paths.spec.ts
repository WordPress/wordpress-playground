import { FileTree } from './git-sparse-checkout';
import { listDescendantFiles } from './paths';

const testTree: FileTree[] = [
	{
		name: 'packages',
		type: 'folder',
		children: [
			{
				name: 'playground',
				type: 'folder',
				children: [
					{
						name: 'storage',
						type: 'folder',
						children: [
							{
								name: 'package.json',
								type: 'file',
							},
							{
								name: 'STORAGE_README.md',
								type: 'file',
							},
						],
					},
				],
			},
			{
				name: 'php-wasm',
				type: 'folder',
				children: [
					{
						name: 'package.json',
						type: 'file',
					},
				],
			},
		],
	},
	{
		name: 'wordpress',
		type: 'folder',
		children: [
			{
				name: 'wp-content',
				type: 'folder',
				children: [
					{
						name: 'plugins',
						type: 'folder',
						children: [
							{
								name: 'blocky-formats',
								type: 'folder',
								children: [
									{
										name: 'block.json',
										type: 'file',
									},
									{
										name: 'index.php',
										type: 'file',
									},
									{
										name: 'README.md',
										type: 'file',
									},
								],
							},
						],
					},
				],
			},
			{
				name: 'index.php',
				type: 'file',
			},
			{
				name: 'wp-includes',
				type: 'folder',
				children: [
					{
						name: 'version.php',
						type: 'file',
					},
				],
			},
			{
				name: 'wp-config.php',
				type: 'file',
			},
		],
	},
];

describe('listDescendantFiles', () => {
	it('should list all the descendant files from a subdirectory of a file tree', async () => {
		const files = listDescendantFiles(testTree, 'packages/playground');
		expect(files).toEqual(
			expect.arrayContaining([
				'packages/playground/storage/package.json',
				'packages/playground/storage/STORAGE_README.md',
			])
		);
	});
	it.each(['.', '/', ''])(
		'should list all the descendant files when "%s" is passed as path',
		async (path: string) => {
			const files = listDescendantFiles(
				[
					{
						name: 'index.php',
						type: 'file',
					},
				],
				path
			);
			expect(files).toEqual(expect.arrayContaining(['index.php']));
		}
	);
});
