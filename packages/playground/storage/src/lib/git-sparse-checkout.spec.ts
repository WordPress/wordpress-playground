import { listRefs, sparseCheckout, listFiles } from './git-sparse-checkout';

describe('listRefs', () => {
	it('should return the latest commit hash for a given ref', async () => {
		const refs = await listRefs(
			'https://github.com/WordPress/wordpress-playground',
			'refs/heads/trunk'
		);
		expect(refs).toEqual({
			'refs/heads/trunk': expect.stringMatching(/^[a-f0-9]{40}$/),
		});
	});
});

describe('sparseCheckout', () => {
	it('should retrieve the requested files from a git repo', async () => {
		const files = await sparseCheckout(
			'https://github.com/WordPress/wordpress-playground.git',
			'refs/heads/trunk',
			['README.md']
		);
		expect(files).toEqual({
			'README.md': expect.any(Uint8Array),
		});
		expect(files['README.md'].length).toBeGreaterThan(0);
	});
});

describe.only('listFiles', () => {
	it('should list the files in a git repo', async () => {
		const files = await listFiles(
			'https://github.com/WordPress/wordpress-playground.git',
			'refs/heads/trunk'
		);
		expect(files).toHaveProperty(
			'packages/playground/storage/package.json'
		);
	});
});
