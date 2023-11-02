import { normalizeOperations } from './journal-memfs';

describe('Filesystem Journaling – normalize()', () => {
	it('Cancels out creating a file and deleting it', () => {
		expect(
			normalizeOperations([
				{ operation: 'CREATE', path: 'i_am_deleted', nodeType: 'file' },
				{
					operation: 'CREATE',
					path: 'i_am_preserved',
					nodeType: 'file',
				},
				{ operation: 'DELETE', path: 'i_am_deleted', nodeType: 'file' },
			])
		).toEqual([{ operation: 'UPDATE_FILE', path: 'i_am_preserved' }]);
	});

	it('Cancels out creating a file and deleting it, but preserves a file created later with the same path', () => {
		expect(
			normalizeOperations([
				{
					operation: 'CREATE',
					path: 'i_am_recreated',
					nodeType: 'file',
				},
				{
					operation: 'CREATE',
					path: 'i_am_preserved',
					nodeType: 'file',
				},
				{
					operation: 'DELETE',
					path: 'i_am_recreated',
					nodeType: 'file',
				},
				{
					operation: 'CREATE',
					path: 'i_am_recreated',
					nodeType: 'file',
				},
			])
		).toEqual([
			{ operation: 'UPDATE_FILE', path: 'i_am_preserved' },
			{ operation: 'UPDATE_FILE', path: 'i_am_recreated' },
		]);
	});

	it('Skips creating directories that are removed later in the stream', () => {
		expect(
			normalizeOperations([
				{
					operation: 'CREATE',
					path: 'deleted_dir',
					nodeType: 'directory',
				},
				{
					operation: 'CREATE',
					path: 'preserved_dir',
					nodeType: 'directory',
				},
				{
					operation: 'DELETE',
					path: 'deleted_dir',
					nodeType: 'directory',
				},
			])
		).toEqual([
			{
				operation: 'CREATE',
				path: 'preserved_dir',
				nodeType: 'directory',
			},
		]);
	});

	it('Skips creating files inside directories that are removed later in the stream', () => {
		expect(
			normalizeOperations([
				{
					operation: 'CREATE',
					path: 'preserved_file',
					nodeType: 'file',
				},
				{
					operation: 'CREATE',
					path: 'deleted_dir',
					nodeType: 'directory',
				},
				{
					operation: 'CREATE',
					path: 'deleted_dir/a_file',
					nodeType: 'file',
				},
				{
					operation: 'DELETE',
					path: 'deleted_dir',
					nodeType: 'directory',
				},
			])
		).toEqual([{ operation: 'UPDATE_FILE', path: 'preserved_file' }]);
	});

	it('Skips moving directories around and creates the final structure directly', () => {
		expect(
			normalizeOperations([
				{ operation: 'CREATE', path: 'a', nodeType: 'directory' },
				{ operation: 'CREATE', path: 'a/b', nodeType: 'directory' },
				{ operation: 'CREATE', path: 'a/b/b_file_1', nodeType: 'file' },
				{ operation: 'CREATE', path: 'a/b/b_file_2', nodeType: 'file' },
				{ operation: 'CREATE', path: 'a/b/c', nodeType: 'directory' },
				{ operation: 'CREATE', path: 'a/b/c/d', nodeType: 'directory' },
				{
					operation: 'CREATE',
					path: 'a/b/c/d/d_file',
					nodeType: 'file',
				},
				{ operation: 'CREATE', path: 'a/b/c/e', nodeType: 'directory' },
				{
					operation: 'CREATE',
					path: 'a/b/c/e/e_file',
					nodeType: 'file',
				},
				{
					operation: 'RENAME',
					path: 'a/b/c/d',
					toPath: 'a/d',
					nodeType: 'directory',
				},
				{
					operation: 'RENAME',
					path: 'a/b/c/e',
					toPath: 'a/e',
					nodeType: 'directory',
				},
				// Rename, then reverse rename, then rename again
				{
					operation: 'RENAME',
					path: 'a/d',
					toPath: 'a/e/d',
					nodeType: 'directory',
				},
				{
					operation: 'RENAME',
					path: 'a/e/d',
					toPath: 'a/d',
					nodeType: 'directory',
				},
				{
					operation: 'RENAME',
					path: 'a/d',
					toPath: 'a/e/d',
					nodeType: 'directory',
				},
				{
					operation: 'RENAME',
					path: 'a/b/c',
					toPath: 'a/c',
					nodeType: 'directory',
				},
				{ operation: 'DELETE', path: 'a/b', nodeType: 'directory' },
			])
		).toEqual([
			{ operation: 'CREATE', path: 'a', nodeType: 'directory' },
			{ operation: 'CREATE', path: 'a/e', nodeType: 'directory' },
			{ operation: 'UPDATE_FILE', path: 'a/e/e_file' },
			{ operation: 'CREATE', path: 'a/e/d', nodeType: 'directory' },
			{ operation: 'UPDATE_FILE', path: 'a/e/d/d_file' },
			{ operation: 'CREATE', path: 'a/c', nodeType: 'directory' },
		]);
	});

	it('Does not create directories that are implictly assumed to have already existed', () => {
		expect(
			normalizeOperations([
				{ operation: 'CREATE', path: 'a/b/a_file', nodeType: 'file' },
			])
		).toEqual([{ operation: 'UPDATE_FILE', path: 'a/b/a_file' }]);
	});

	it("Preserves DELETEs targeting paths that haven't been explicitly created in the stream", () => {
		expect(
			normalizeOperations([
				{
					operation: 'DELETE',
					path: 'wp-content/plugins/hello-dolly',
					nodeType: 'directory',
				},
				{
					operation: 'CREATE',
					path: 'wp-content/plugins/hello-dolly',
					nodeType: 'directory',
				},
			])
		).toEqual([
			{
				operation: 'DELETE',
				path: 'wp-content/plugins/hello-dolly',
				nodeType: 'directory',
			},
            {
                operation: 'CREATE',
                path: 'wp-content/plugins/hello-dolly',
                nodeType: 'directory',
            },
		]);
    });
    
	// it("Preserves operations targeting paths that haven't been explicitly created in the stream", () => {
	// 	expect(
	// 		normalizeOperations([
	// 			{
	// 				operation: 'RENAME',
	// 				path: 'wp-content/plugins/hello-dolly/index.php',
	// 				toPath: 'wp-content/mu-plugins/hello-dolly.php',
	// 				nodeType: 'file',
	// 			},
	// 			{
	// 				operation: 'DELETE',
	// 				path: 'wp-content/plugins/hello-dolly',
	// 				nodeType: 'file',
	// 			},
	// 		])
	// 	).toEqual([
	// 		{
	// 			operation: 'UPDATE_FILE',
	// 			path: 'wp-content/mu-plugins/hello-dolly.php',
	// 		},
	// 		{ operation: 'DELETE', path: 'wp-content/plugins/hello-dolly' },
	// 	]);
	// });
});
