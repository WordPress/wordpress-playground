export type GitHubURLInformation = {
	owner?: string;
	repo?: string;
	type: 'pr' | 'repo' | 'branch' | 'rawfile' | 'unknown';
	ref?: string;
	commitSha?: string;
	path?: string;
	pr?: number;
	branchPathSegments?: string[];
};

type GitHubBranchClient = {
	rest: {
		repos: {
			getBranch(args: {
				owner: string;
				repo: string;
				branch: string;
			}): Promise<{ data?: { commit?: { sha?: string } } }>;
		};
	};
};

/**
 * Parses supported GitHub URLs without making network requests.
 */
export function staticAnalyzeGitHubURL(url: string): GitHubURLInformation {
	let urlObj;
	try {
		urlObj = new URL(url);
	} catch {
		return {
			type: 'unknown',
		};
	}
	if (!['http:', 'https:'].includes(urlObj.protocol.toLowerCase())) {
		return {
			type: 'unknown',
		};
	}
	const [owner, repo, ...rest] = urlObj.pathname
		.replace(/^\/+|\/+$/g, '')
		.split('/');

	let pr,
		ref,
		type: GitHubURLInformation['type'] = 'unknown',
		path = '';
	const hostname = urlObj.hostname.toLowerCase();
	if (hostname === 'raw.githubusercontent.com') {
		type = 'rawfile';
		path = urlObj.pathname.substring(1);
	} else if (hostname !== 'github.com' && hostname !== 'www.github.com') {
		return {
			type: 'unknown',
		};
	} else if (!owner || !repo) {
		return {
			type: 'unknown',
		};
	} else if (rest[0] === 'pull') {
		type = 'pr';
		if (!/^[1-9]\d*$/.test(rest[1] ?? '')) {
			return {
				type: 'unknown',
			};
		}
		pr = Number(rest[1]);
	} else if (['blob', 'tree'].includes(rest[0])) {
		if (!rest[1]) {
			return {
				type: 'unknown',
			};
		}
		type = 'branch';
		ref = rest[1];
		path = rest.slice(2).join('/');
		// GitHub tree/blob URLs do not delimit branch names, so
		// `tree/feature/foo/src` may mean branch `feature/foo` plus path `src`.
		const branchPathSegments = rest.slice(1);
		return { owner, repo, type, ref, path, pr, branchPathSegments };
	} else if (rest.length === 0) {
		type = 'repo';
	}

	return { owner, repo, type, ref, path, pr };
}

/**
 * Resolves the ambiguous branch-and-path suffix in GitHub tree/blob URLs.
 *
 * GitHub does not mark where the branch name ends:
 * - `/tree/trunk/packages/playground` means branch `trunk`, path `packages/playground`.
 * - `/tree/feature/export-form/packages/playground` may mean branch `feature`
 *   plus path `export-form/packages/playground`, or branch `feature/export-form`
 *   plus path `packages/playground`.
 *
 * Try the longest possible branch name first, matching GitHub's routing for
 * branch names that contain `/`. If no candidate exists, keep the parser's
 * original first-segment branch guess.
 */
export async function resolveGitHubBranchPath(
	octokit: GitHubBranchClient,
	urlDetails: GitHubURLInformation
): Promise<GitHubURLInformation> {
	if (
		urlDetails.type !== 'branch' ||
		!urlDetails.owner ||
		!urlDetails.repo ||
		!urlDetails.branchPathSegments?.length
	) {
		return urlDetails;
	}

	// Try the longest possible branch name first so branch `feature/foo`
	// wins over branch `feature` for URLs such as `tree/feature/foo/src`.
	for (
		let length = urlDetails.branchPathSegments.length;
		length >= 1;
		length--
	) {
		const ref = urlDetails.branchPathSegments.slice(0, length).join('/');
		try {
			const branch = await octokit.rest.repos.getBranch({
				owner: urlDetails.owner,
				repo: urlDetails.repo,
				branch: ref,
			});
			return {
				...urlDetails,
				ref,
				commitSha: branch.data?.commit?.sha,
				path: urlDetails.branchPathSegments.slice(length).join('/'),
			};
		} catch (error) {
			if ((error as any)?.status === 404) {
				continue;
			}
			throw error;
		}
	}

	return urlDetails;
}
