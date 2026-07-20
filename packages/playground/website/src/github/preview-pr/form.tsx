import React, { useEffect, useRef } from 'react';
import { useState } from 'react';
import { Button, Notice, TextControl } from '@wordpress/components';
import css from './style.module.css';
import { logger } from '@php-wasm/logger';
import ModalButtons from '../../components/modal/modal-buttons';
import { InlineProgress } from '../../components/pane-loading';
import type { BlueprintV1Declaration } from '@wp-playground/blueprints';
import type { ResolvedRef } from './resolve-pr-input';
import {
	isWordPressPrBeforePreviewer,
	resolvePrInput,
} from './resolve-pr-input';

/**
 * Result returned by the preview proxy when asked whether a PR build exists.
 *
 * The proxy forwards operational error names as strings, so failures are not
 * restricted to the error names currently recognized by this form.
 */
type PrVerification = { ok: true } | { ok: false; error: string };

/**
 * Associates a repository candidate with the response that classified it.
 *
 * Keeping the response allows repository detection to pass it to the preview
 * flow instead of making a second request for the selected repository.
 */
type RepositoryMatch = {
	resolved: ResolvedRef;
	verification: PrVerification;
};

interface PreviewPRFormProps {
	onClose: () => void;
	/**
	 * Preferred repository for ambiguous input in the repository-specific
	 * modal. The inline form checks both repositories for bare PR numbers. A
	 * recognized GitHub URL always decides the repository.
	 */
	target?: 'wordpress' | 'gutenberg';
	/** Render a single left-aligned primary action (dock pane) instead of the
	 *  modal's right-aligned Cancel/Submit row. */
	inline?: boolean;
}

const urlParams = new URLSearchParams(window.location.search);

// This structure is from plugin-proxy.php
// where we set allowed inputs for WordPress and Gutenberg repositories
export const targetParams = {
	wordpress: {
		repo: 'wordpress-develop',
		workflow: 'Test%20Build%20Processes',
		artifact: 'wordpress-build-',
		pull: 'github.com/wordpress/wordpress-develop/pull',
	},
	gutenberg: {
		repo: 'gutenberg',
		workflow: 'Build%20Gutenberg%20Plugin%20Zip',
		artifact: 'gutenberg-plugin',
		pull: 'github.com/wordpress/gutenberg/pull',
	},
};

export default function PreviewPRForm({
	onClose,
	target = 'wordpress',
	inline = false,
}: PreviewPRFormProps) {
	const [value, setValue] = useState<string>('');
	const [submitting, setSubmitting] = useState<boolean>(false);
	const [errorMsg, setError] = useState<string>('');
	const [loadingMessage, setLoadingMessage] = useState<string>('');
	const [repositoryMatches, setRepositoryMatches] = useState<
		RepositoryMatch[]
	>([]);
	const cleanupRetryRef = useRef<() => void>(() => {});

	useEffect(() => {
		const query = new URLSearchParams(window.location.search);
		let initialValue = '';
		if (target === 'wordpress') {
			initialValue = query.get('core-pr') || '';
		} else {
			initialValue =
				query.get('gutenberg-pr') ||
				query.get('gutenberg-branch') ||
				'';
		}
		if (initialValue) {
			setValue(initialValue);
		}
	}, [target]);

	useEffect(() => {
		return () => cleanupRetryRef.current();
	}, []);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();

		if (!value.trim()) {
			return;
		}

		const resolved = resolvePrInput(value, target);
		if (!resolved.ok) {
			setError(resolved.error);
			return;
		}

		const isBarePrNumber =
			inline &&
			!resolved.value.isBranch &&
			value.trim() === resolved.value.ref;
		if (isBarePrNumber) {
			await detectRepository(resolved.value.ref);
			return;
		}

		await previewPr(resolved.value);
	}

	/**
	 * Resolves a bare PR number to WordPress Core, Gutenberg, or both.
	 *
	 * Both repositories are checked concurrently. No matches produces a
	 * combined error, one match continues directly to the preview flow, and two
	 * matches expose a repository choice. The matching verification response
	 * is preserved so continuing does not repeat the proxy request.
	 *
	 * A rejected request or a response that is neither a match nor a conclusive
	 * miss stops detection. In that case the form reports that GitHub could not
	 * be checked instead of claiming the PR does not exist.
	 *
	 * @param ref Decimal pull-request number entered without a repository URL.
	 * @returns A promise that settles after the next form state is selected.
	 */
	async function detectRepository(ref: string) {
		cleanupRetryRef.current();
		cleanupRetryRef.current = () => {};
		setError('');
		setRepositoryMatches([]);
		setLoadingMessage('Checking WordPress Core and Gutenberg…');
		setSubmitting(true);

		let matches: RepositoryMatch[];
		try {
			matches = await findMatchingRepositories(ref);
		} catch (error) {
			logger.error(error);
			setError(
				'Playground couldn’t check GitHub right now. Check your connection and try again.'
			);
			setSubmitting(false);
			return;
		}

		if (matches.length === 0) {
			setError(
				`Couldn’t find PR ${ref} in WordPress Core or Gutenberg. Check the number, or paste the full GitHub URL if its preview build is still being prepared.`
			);
			setSubmitting(false);
			return;
		}
		if (matches.length === 1) {
			await previewPr(matches[0].resolved, matches[0].verification);
			return;
		}

		setRepositoryMatches(matches);
		setSubmitting(false);
	}

	/**
	 * Continues the preview flow with a repository selected by the user.
	 *
	 * The repository choices are removed before the preview begins. The
	 * verification response obtained during detection is reused so choosing a
	 * repository does not issue the same proxy request again.
	 *
	 * @param match Repository and verification response selected by the user.
	 * @returns A promise that settles when the preview flow has handled the PR.
	 */
	async function selectRepository(match: RepositoryMatch) {
		setRepositoryMatches([]);
		await previewPr(match.resolved, match.verification);
	}

	function renderRetryIn(retryIn: number, resolved: ResolvedRef) {
		setError(
			`Waiting for GitHub to finish building ${
				resolved.isBranch ? 'branch' : 'PR'
			} ${resolved.ref}. This might take 15 minutes or more! Retrying in ${
				retryIn / 1000
			}...`
		);
	}

	function buildArtifactUrl(resolved: ResolvedRef): string {
		const { target: repo, ref, isBranch } = resolved;
		const refType = isBranch ? 'branch' : 'pr';
		// For WordPress PRs: artifact name is wordpress-build-{PR_NUMBER}
		// For Gutenberg PRs: artifact name is always gutenberg-plugin
		// For Gutenberg branches: artifact name is always gutenberg-plugin
		//   (we use prefix matching with trailing dash for branches)
		let artifactSuffix = '';
		if (repo === 'wordpress') {
			// WordPress only supports PRs, not branches
			artifactSuffix = ref;
		}
		return `https://playground.wordpress.net/plugin-proxy.php?org=WordPress&repo=${targetParams[repo].repo}&workflow=${targetParams[repo].workflow}&artifact=${targetParams[repo].artifact}${artifactSuffix}&${refType}=${encodeURIComponent(ref)}`;
	}

	/**
	 * Verifies a resolved reference and opens its Playground preview.
	 *
	 * Pull requests must have a usable preview build. Missing or incomplete
	 * artifacts are translated into an error or a scheduled retry, depending on
	 * their state. Gutenberg branches skip this verification because the proxy
	 * selects their most recent artifact by prefix.
	 *
	 * Repository detection may provide `knownVerification`. Reusing it avoids a
	 * duplicate request while preserving the same error and retry behavior as a
	 * direct preview. A successful flow writes the repository reference and
	 * Blueprint to the URL, then navigates to it.
	 *
	 * @param resolved Repository, reference, and reference type to preview.
	 * @param knownVerification Response already obtained during detection.
	 * @returns A promise that settles after navigation or form error handling.
	 */
	async function previewPr(
		resolved: ResolvedRef,
		knownVerification?: PrVerification
	) {
		cleanupRetryRef.current();
		cleanupRetryRef.current = () => {};

		const { target: repo, ref, isBranch } = resolved;
		const isBareWordPressPr =
			!inline && repo === 'wordpress' && value.trim() === ref;
		setLoadingMessage('Checking GitHub for a preview build…');
		setSubmitting(true);

		// For branches, skip verification since we'll use the most recent artifact with prefix matching
		// For PRs, verify that the specific PR build exists
		if (!isBranch) {
			let verification: PrVerification;
			try {
				verification = knownVerification ?? (await verifyPr(resolved));
			} catch (error) {
				logger.error(error);
				setError(
					'Playground couldn’t check GitHub right now. Check your connection and try again.'
				);
				setSubmitting(false);
				return;
			}
			if (!verification.ok) {
				const { error } = verification;

				if (error === 'invalid_pr_number') {
					setError(
						isBareWordPressPr
							? `Couldn’t find WordPress Core PR ${ref}. If this is a Gutenberg PR, paste its full GitHub URL instead.`
							: `The PR ${ref} does not exist.`
					);
				} else if (error === 'no_ci_runs') {
					setError(
						`GitHub hasn’t started a preview build for PR ${ref} yet. Check that its preview workflow is enabled, then try again.`
					);
				} else if (
					error === 'artifact_not_found' ||
					error === 'artifact_not_available'
				) {
					if (isWordPressPrBeforePreviewer(resolved)) {
						setError(
							`The PR ${ref} predates the Pull Request previewer and requires a rebase before it can be previewed.`
						);
					} else {
						// For PRs, retry since we expect a specific build to complete
						let retryIn = 30000;
						renderRetryIn(retryIn, resolved);
						const timerInterval = setInterval(() => {
							retryIn -= 1000;
							if (retryIn <= 0) {
								retryIn = 0;
							}
							renderRetryIn(retryIn, resolved);
						}, 1000);
						const scheduledRetry = setTimeout(() => {
							previewPr(resolved);
						}, retryIn);
						cleanupRetryRef.current = () => {
							clearInterval(timerInterval);
							clearTimeout(scheduledRetry);
							cleanupRetryRef.current = () => {};
						};
					}
				} else if (error === 'artifact_invalid') {
					setError(
						`The PR ${ref} requires a rebase before it can be previewed.`
					);
				} else if (error === 'artifact_expired') {
					setError(
						`The PR ${ref} couldn't be previewed because the CI build artifact has expired. To load that pull request, the author or a maintainer should push a new commit, rebase, or rerun the CI job to trigger a fresh CI build.`
					);
				} else {
					setError(
						isBareWordPressPr
							? `Playground treated ${ref} as a WordPress Core PR, but couldn’t verify it. If this is a Gutenberg PR, paste its full GitHub URL instead.`
							: `The PR ${ref} couldn't be previewed due to an unexpected error. Please try again later or file an issue in the WordPress Playground repository.`
					);
					// https://github.com/WordPress/wordpress-playground/issues/new
				}

				setSubmitting(false);
				return;
			}
		}

		// Redirect to the Playground site with the Blueprint to download and apply the PR/branch
		const blueprint: BlueprintV1Declaration = {
			landingPage: urlParams.get('url') || '/wp-admin',
			login: true,
			features: {
				networking: true,
			},
			steps: [],
		};

		const refParam = isBranch
			? `${repo === 'wordpress' ? 'core' : 'gutenberg'}-branch`
			: `${repo === 'wordpress' ? 'core' : 'gutenberg'}-pr`;
		const urlWithPreview = new URL(
			window.location.pathname,
			window.location.href
		);

		if (repo === 'wordpress') {
			// [wordpress] Passthrough the mode query parameter if it exists
			if (urlParams.has('mode')) {
				urlWithPreview.searchParams.set(
					'mode',
					urlParams.get('mode') as string
				);
			}
			urlWithPreview.searchParams.set(refParam, ref);
		} else if (repo === 'gutenberg') {
			// [gutenberg] If there's a import-site query parameter, pass that to the blueprint
			try {
				const importSite = new URL(
					urlParams.get('import-site') as string
				);
				if (importSite) {
					// Add it as the first step in the blueprint
					blueprint.steps!.unshift({
						step: 'importWordPressFiles',
						wordPressFilesZip: {
							resource: 'url',
							url: importSite.origin + importSite.pathname,
						},
					});
				}
			} catch {
				logger.error('Invalid import-site URL');
			}
			urlWithPreview.searchParams.set(refParam, ref);
		}

		urlWithPreview.hash = encodeURI(JSON.stringify(blueprint));
		window.location.href = urlWithPreview.toString();
	}

	/**
	 * Checks which supported repositories can handle a bare PR number.
	 *
	 * WordPress Core and Gutenberg are queried concurrently. Responses are
	 * divided into matches, conclusive misses, and verification failures. Only
	 * matches are returned. A verification failure is thrown so callers do not
	 * misrepresent an unavailable or malformed response as a missing PR.
	 *
	 * @param ref Decimal pull-request number to check in both repositories.
	 * @returns Zero, one, or two repository matches with reusable responses.
	 * @throws If a request rejects or returns an unclassified response.
	 */
	async function findMatchingRepositories(
		ref: string
	): Promise<RepositoryMatch[]> {
		const candidates: ResolvedRef[] = [
			{ target: 'wordpress', ref, isBranch: false },
			{ target: 'gutenberg', ref, isBranch: false },
		];
		const results = await Promise.all(
			candidates.map(async (resolved) => ({
				resolved,
				verification: await verifyPr(resolved),
			}))
		);
		const failedVerification = results.find(
			({ verification }) =>
				!isRepositoryMatch(verification) &&
				!isRepositoryMiss(verification)
		);
		if (failedVerification && !failedVerification.verification.ok) {
			throw new Error(
				`Unexpected response while checking ${failedVerification.resolved.target}: ${failedVerification.verification.error}`
			);
		}

		return results.filter(({ verification }) =>
			isRepositoryMatch(verification)
		);
	}

	/**
	 * Asks the preview proxy whether a resolved PR has a usable build.
	 *
	 * HTTP 200 is a successful verification. For other statuses, a JSON `error`
	 * string is preserved for classification and user-facing handling. A body
	 * that cannot be parsed, or does not contain an error string, becomes
	 * `unexpected_response`. Network failures reject the returned promise.
	 *
	 * @param resolved Repository and PR number to verify.
	 * @returns The successful response or the proxy's error classification.
	 */
	async function verifyPr(resolved: ResolvedRef): Promise<PrVerification> {
		const response = await fetch(
			buildArtifactUrl(resolved) + '&verify_only=true'
		);
		if (response.status === 200) {
			return { ok: true };
		}

		try {
			const json = await response.json();
			if (typeof json?.error === 'string') {
				return { ok: false, error: json.error };
			}
		} catch (parseError) {
			logger.error(parseError);
		}
		return { ok: false, error: 'unexpected_response' };
	}

	const inputLabel = inline
		? 'WordPress Core or Gutenberg PR'
		: target === 'wordpress'
			? 'PR number or URL'
			: 'PR number, URL, or a branch name';

	return (
		<form onSubmit={handleSubmit}>
			<div>
				<TextControl
					disabled={submitting}
					label={inputLabel}
					placeholder={inline ? 'URL or number' : undefined}
					value={value}
					autoFocus={!inline}
					onChange={(e) => {
						setError('');
						setRepositoryMatches([]);
						setValue(e);
					}}
				/>
				{submitting && (
					<div className={css.progress}>
						<InlineProgress message={loadingMessage} />
					</div>
				)}
				{repositoryMatches.length > 1 && (
					<Notice status="warning" isDismissible={false}>
						PR {repositoryMatches[0].resolved.ref} has preview
						builds in both repositories. Choose the one you want to
						open.
						<div className={css.repositoryChoices}>
							{repositoryMatches.map((match) => (
								<Button
									key={match.resolved.target}
									variant="secondary"
									type="button"
									onClick={() => selectRepository(match)}
								>
									{match.resolved.target === 'wordpress'
										? `WordPress Core PR ${match.resolved.ref}`
										: `Gutenberg PR ${match.resolved.ref}`}
								</Button>
							))}
						</div>
					</Notice>
				)}
				{errorMsg &&
					(inline ? (
						<Notice status="error" isDismissible={false}>
							{errorMsg}
						</Notice>
					) : (
						<div>{errorMsg}</div>
					))}
			</div>
			{inline && repositoryMatches.length === 0 ? (
				<div className={css.inlineActions}>
					<Button
						variant="primary"
						type="submit"
						disabled={submitting}
					>
						Preview
					</Button>
				</div>
			) : !inline ? (
				<ModalButtons
					areDisabled={submitting}
					onCancel={onClose}
					onSubmit={handleSubmit}
					submitText="Preview"
				/>
			) : null}
		</form>
	);
}

/**
 * Determines whether a verification response identifies a repository match.
 *
 * A usable artifact is a direct match. Build and artifact lifecycle errors
 * also count as matches because they occur only after the proxy has resolved
 * the PR in that repository; the preview flow will explain or retry that
 * state.
 *
 * @param verification Response returned by the preview proxy.
 * @returns Whether the candidate should be offered as a repository match.
 */
function isRepositoryMatch(verification: PrVerification): boolean {
	return verification.ok || repositoryMatchErrors.has(verification.error);
}

/**
 * Determines whether a response can be treated as a repository miss.
 *
 * Only known negative responses belong here. Any other failure remains
 * unclassified and stops repository detection rather than producing a false
 * “PR not found” result.
 *
 * @param verification Response returned by the preview proxy.
 * @returns Whether detection may safely discard the repository candidate.
 */
function isRepositoryMiss(verification: PrVerification): boolean {
	return !verification.ok && repositoryMissErrors.has(verification.error);
}

/** Proxy errors that identify a PR even though its preview cannot be opened. */
const repositoryMatchErrors = new Set([
	'no_ci_runs',
	'artifact_not_found',
	'artifact_not_available',
	'artifact_invalid',
	'artifact_expired',
]);

/** Proxy errors that repository detection treats as conclusive misses. */
const repositoryMissErrors = new Set(['invalid_pr_number']);
