export type GitModuleReference = {
	repoUrl: string;
	ref: string;
	refType?: 'branch' | 'tag' | 'commit' | 'refname';
	path?: string;
};

const GIT_PROTOCOL_PREFIX = 'git+';

export function encodeGitModuleReference(
	reference: GitModuleReference
): string {
	const { repoUrl, ref, refType, path } = reference;
	const params = new URLSearchParams();
	if (ref) {
		params.set('ref', ref);
	}
	if (refType) {
		params.set('refType', refType);
	}
	if (path) {
		params.set('path', path);
	}
	const hash = params.toString();
	return `${GIT_PROTOCOL_PREFIX}${repoUrl}${hash ? '#' + hash : ''}`;
}
