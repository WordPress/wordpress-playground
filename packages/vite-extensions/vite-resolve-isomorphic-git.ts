import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

export function resolveIsomorphicGitEsmEntry() {
	return join(dirname(require.resolve('isomorphic-git')), 'index.js');
}
