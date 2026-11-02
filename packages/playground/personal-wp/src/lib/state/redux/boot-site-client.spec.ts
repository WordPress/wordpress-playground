// @vitest-environment jsdom

import { playgroundAvailableInOpfs } from './boot-site-client';

// Avoid initializing the application store through boot dependencies.
vi.mock('./store', () => ({}));

describe('playgroundAvailableInOpfs', () => {
	it.each([
		['db-path.php', true],
		['.ht.sqlite', true],
		[undefined, false],
	])(
		'detects a site with database file %s',
		async (databaseFile, expected) => {
			const directory = {
				async *keys() {
					yield 'wp-config.php';
				},
				async getDirectoryHandle() {
					return directory;
				},
				async getFileHandle(name: string) {
					if (name !== 'wp-config.php' && name !== databaseFile) {
						throw new DOMException('Missing file', 'NotFoundError');
					}
					return {};
				},
			} as unknown as FileSystemDirectoryHandle;

			expect(await playgroundAvailableInOpfs(directory)).toBe(expected);
		}
	);
});
