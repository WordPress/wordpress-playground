import {
	listGitRefs,
	sparseCheckout,
	listGitFiles,
	resolveCommitHash,
} from './git-sparse-checkout';

describe('listRefs', () => {
	it('should return the latest commit hash for a given ref', async () => {
		const refs = await listGitRefs(
			'https://github.com/WordPress/wordpress-playground',
			'refs/heads/trunk'
		);
		expect(refs).toEqual({
			'refs/heads/trunk': expect.stringMatching(/^[a-f0-9]{40}$/),
		});
	});
});

describe('resolveCommitHash', () => {
	const repoUrl = 'https://github.com/WordPress/wordpress-playground.git';

	it('infers branch refs when type is omitted', async () => {
		const commitHash = await resolveCommitHash(repoUrl, {
			value: 'trunk',
		});
		expect(commitHash).toMatch(/^[a-f0-9]{40}$/);
	});

	it('infers tag refs without an explicit type', async () => {
		const commitHash = await resolveCommitHash(repoUrl, {
			value: 'v0.1.28',
		});
		expect(commitHash).toMatch(/^[a-f0-9]{40}$/);
	});

	it('resolves explicit tag refs', async () => {
		const commitHash = await resolveCommitHash(repoUrl, {
			value: 'v0.1.28',
			type: 'tag',
		});
		expect(commitHash).toMatch(/^[a-f0-9]{40}$/);
	});

	it('returns the commit hash unchanged when type is commit', async () => {
		const commit = '1234567890abcdef1234567890abcdef12345678';
		const resolved = await resolveCommitHash(repoUrl, {
			value: commit,
			type: 'commit',
		});

		expect(resolved).toBe(commit);
	});

	it('resolves branch refs when type is branch', async () => {
		const resolved = await resolveCommitHash(repoUrl, {
			value: 'trunk',
			type: 'branch',
		});
		expect(resolved).toMatch(/^[a-f0-9]{40}$/);
	});

	it('falls back to tags when branches do not match', async () => {
		const resolved = await resolveCommitHash(repoUrl, {
			value: 'trunk',
		});
		expect(resolved).toMatch(/^[a-f0-9]{40}$/);
	});

	it('throws when the requested branch cannot be found', async () => {
		await expect(
			resolveCommitHash(repoUrl, {
				value: 'missing-branch',
				type: 'branch',
			})
		).rejects.toThrow(
			`Git ref "refs/heads/missing-branch" not found at ${repoUrl}`
		);
	});

	it('throws when neither branch nor tag can be inferred', async () => {
		await expect(
			resolveCommitHash(repoUrl, {
				value: 'missing-ref',
			})
		).rejects.toThrow(`Git ref "missing-ref" not found at ${repoUrl}`);
	});

	it('throws for unsupported ref types', async () => {
		await expect(
			resolveCommitHash(repoUrl, {
				value: 'whatever',
				type: 'unsupported' as any,
			})
		).rejects.toThrow('Invalid ref type: unsupported');
	});
});

describe('sparseCheckout', () => {
	it('should retrieve the requested files from a git repo', async () => {
		const commitHash = await resolveCommitHash(
			'https://github.com/WordPress/wordpress-playground.git',
			{
				value: 'trunk',
				type: 'branch',
			}
		);
		const files = await sparseCheckout(
			'https://github.com/WordPress/wordpress-playground.git',
			commitHash,
			['README.md']
		);
		expect(files).toEqual({
			'README.md': expect.any(Uint8Array),
		});
		expect(files['README.md'].length).toBeGreaterThan(0);
	});
});

describe('listGitFiles', () => {
	it('should list the files in a git repo', async () => {
		const commitHash = await resolveCommitHash(
			'https://github.com/WordPress/wordpress-playground.git',
			{
				value: 'trunk',
				type: 'branch',
			}
		);
		const files = await listGitFiles(
			'https://github.com/WordPress/wordpress-playground.git',
			commitHash
		);
		expect(files).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: 'packages',
					type: 'folder',
					children: expect.arrayContaining([
						expect.objectContaining({
							name: 'playground',
							type: 'folder',
							children: expect.arrayContaining([
								expect.objectContaining({
									name: 'storage',
									type: 'folder',
									children: expect.arrayContaining([
										expect.objectContaining({
											name: 'package.json',
											type: 'file',
										}),
									]),
								}),
							]),
						}),
					]),
				}),
			])
		);
	});
});
