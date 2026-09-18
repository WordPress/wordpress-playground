export * from './lib/github';
export * from './lib/changeset';
export * from './lib/playground';
export * from './lib/browser-fs';
export * from './lib/paths';
export * from './lib/filesystems';
export { GitAuthenticationError } from './lib/git-authentication-error';
import type * as GitCreateDotGitDirectoryModule from './lib/git-create-dotgit-directory';
import type * as GitSparseCheckoutModule from './lib/git-sparse-checkout';
export type {
	GitAdditionalHeaders,
	GitFileTree,
	GitFileTreeFile,
	GitFileTreeFolder,
	GitRef,
	SparseCheckoutObject,
	SparseCheckoutPackfile,
	SparseCheckoutResult,
} from './lib/git-sparse-checkout';

function loadGitSparseCheckout(): Promise<typeof GitSparseCheckoutModule> {
	return import('./lib/git-sparse-checkout');
}

function loadGitCreateDotGitDirectory(): Promise<
	typeof GitCreateDotGitDirectoryModule
> {
	return import('./lib/git-create-dotgit-directory');
}

export async function sparseCheckout(
	...args: Parameters<typeof GitSparseCheckoutModule.sparseCheckout>
): ReturnType<typeof GitSparseCheckoutModule.sparseCheckout> {
	return (await loadGitSparseCheckout()).sparseCheckout(...args);
}

export async function listGitFiles(
	...args: Parameters<typeof GitSparseCheckoutModule.listGitFiles>
): ReturnType<typeof GitSparseCheckoutModule.listGitFiles> {
	return (await loadGitSparseCheckout()).listGitFiles(...args);
}

export async function resolveCommitHash(
	...args: Parameters<typeof GitSparseCheckoutModule.resolveCommitHash>
): ReturnType<typeof GitSparseCheckoutModule.resolveCommitHash> {
	return (await loadGitSparseCheckout()).resolveCommitHash(...args);
}

export async function listGitRefs(
	...args: Parameters<typeof GitSparseCheckoutModule.listGitRefs>
): ReturnType<typeof GitSparseCheckoutModule.listGitRefs> {
	return (await loadGitSparseCheckout()).listGitRefs(...args);
}

export async function createDotGitDirectory(
	...args: Parameters<
		typeof GitCreateDotGitDirectoryModule.createDotGitDirectory
	>
): ReturnType<typeof GitCreateDotGitDirectoryModule.createDotGitDirectory> {
	return (await loadGitCreateDotGitDirectory()).createDotGitDirectory(
		...args
	);
}
