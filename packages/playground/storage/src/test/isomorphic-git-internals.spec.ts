import { GitTree } from '../lib/isomorphic-git-internals';

function encodeTreeEntry(mode: string, name: string) {
	return Buffer.concat([
		Buffer.from(`${mode} ${name}\0`),
		Buffer.alloc(20, 1),
	]);
}

describe('GitTree', () => {
	it.each([
		'',
		'.',
		'..',
		'.git',
		'.GIT',
		'.Git',
		'foo/bar',
		'../foo',
		'foo\\bar',
		'..\\foo',
	])('should reject the entry name %j', (name) => {
		expect(() => GitTree.from(encodeTreeEntry('40000', name))).toThrow(
			'Invalid Git tree entry name'
		);
	});

	it('should reject an unsafe entry name that follows a safe one', () => {
		const tree = Buffer.concat([
			encodeTreeEntry('100644', 'foo'),
			encodeTreeEntry('40000', '..'),
		]);
		expect(() => GitTree.from(tree)).toThrow('Invalid Git tree entry name');
	});

	it.each(['foo', 'foo.txt', '.github', '.gitignore', '.gitmodules', '...'])(
		'should accept the entry name %j',
		(name) => {
			const entries = GitTree.from(
				encodeTreeEntry('100644', name)
			).entries();
			expect(entries).toEqual([
				expect.objectContaining({ path: name, type: 'blob' }),
			]);
		}
	);
});
