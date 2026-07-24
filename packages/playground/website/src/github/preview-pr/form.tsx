import React, { useEffect, useRef } from 'react';
import { useState } from 'react';
import { Button, Notice, TextControl } from '@wordpress/components';
import { chevronRight, Icon, wordpress } from '@wordpress/icons';
import css from './style.module.css';
import gutenbergLogoUrl from './gutenberg-logo.svg';
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
 * restricted to the error names currently recognized by this form. Once the
 * proxy resolves a pull request, its title is preserved on both successful and
 * failed build checks so repository choices can identify the actual change.
 */
type PrVerification = {
	title?: string;
	openedAt?: string;
} & ({ ok: true } | { ok: false; error: string });

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

type PullRequestPreviewCardProps = {
	target: ResolvedRef['target'];
	title: string;
	repositoryName: string;
	details?: React.ReactNode;
	disabled?: boolean;
	onClick: () => void;
};

/**
 * User-facing state shown after the form cannot immediately open a preview.
 *
 * A title gives each message a scannable outcome while the detail explains
 * what happened and, when possible, what the user can do next. Waiting for a
 * build is a warning because the form will retry automatically; terminal
 * failures are errors.
 */
type FormFeedback = {
	title: string;
	message: string;
	status: 'error' | 'warning';
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
	const [feedback, setFeedback] = useState<FormFeedback>();
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

	const resolvedInput = resolvePrInput(value, target);
	const isBarePrNumber =
		inline &&
		resolvedInput.ok &&
		!resolvedInput.value.isBranch &&
		value.trim() === resolvedInput.value.ref;
	const resolvedSource =
		inline && resolvedInput.ok && !isBarePrNumber
			? resolvedInput.value
			: undefined;

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();

		if (!value.trim()) {
			return;
		}

		if (!resolvedInput.ok) {
			setFeedback({
				title: 'Check the pull request',
				message: resolvedInput.error,
				status: 'error',
			});
			return;
		}

		if (isBarePrNumber) {
			await detectRepository(resolvedInput.value.ref);
			return;
		}

		await previewPr(resolvedInput.value);
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
		setFeedback(undefined);
		setRepositoryMatches([]);
		setLoadingMessage('Checking WordPress Core and Gutenberg…');
		setSubmitting(true);

		let matches: RepositoryMatch[];
		try {
			matches = await findMatchingRepositories(ref);
		} catch (error) {
			logger.error(error);
			setFeedback({
				title: 'Playground couldn’t check GitHub right now.',
				message:
					'Check your internet connection, then try previewing the pull request again.',
				status: 'error',
			});
			setSubmitting(false);
			return;
		}

		if (matches.length === 0) {
			setFeedback({
				title: `Couldn’t find PR ${ref} in WordPress Core or Gutenberg.`,
				message:
					'Check the number, or paste the full GitHub URL if its preview build is still being prepared.',
				status: 'error',
			});
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

	function renderRetryIn(retryIn: number, resolved: ResolvedRef) {
		setFeedback({
			title: 'Preview build in progress',
			message: `GitHub is still building ${
				resolved.isBranch ? 'branch' : 'PR'
			} ${resolved.ref}. This can take 15 minutes or more. Retrying in ${
				retryIn / 1000
			} seconds…`,
			status: 'warning',
		});
	}

	function buildArtifactUrl(resolved: ResolvedRef): string {
		const { target: repo, ref, isBranch } = resolved;
		const refType = isBranch ? 'branch' : 'pr';
		const proxyUrl = import.meta.env.DEV
			? '/plugin-proxy.php'
			: 'https://playground.wordpress.net/plugin-proxy.php';
		// For WordPress PRs: artifact name is wordpress-build-{PR_NUMBER}
		// For Gutenberg PRs: artifact name is always gutenberg-plugin
		// For Gutenberg branches: artifact name is always gutenberg-plugin
		//   (we use prefix matching with trailing dash for branches)
		let artifactSuffix = '';
		if (repo === 'wordpress') {
			// WordPress only supports PRs, not branches
			artifactSuffix = ref;
		}
		return `${proxyUrl}?org=WordPress&repo=${targetParams[repo].repo}&workflow=${targetParams[repo].workflow}&artifact=${targetParams[repo].artifact}${artifactSuffix}&${refType}=${encodeURIComponent(ref)}`;
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
		setFeedback(undefined);

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
				setFeedback({
					title: 'Playground couldn’t check GitHub right now.',
					message:
						'Check your internet connection, then try previewing the pull request again.',
					status: 'error',
				});
				setSubmitting(false);
				return;
			}
			if (!verification.ok) {
				const { error } = verification;

				if (error === 'invalid_pr_number') {
					setFeedback({
						title: `PR ${ref} wasn’t found`,
						message: isBareWordPressPr
							? 'If this is a Gutenberg PR, paste its full GitHub URL instead.'
							: 'Check the pull request number or URL and try again.',
						status: 'error',
					});
				} else if (error === 'no_ci_runs') {
					setFeedback({
						title: 'Preview build not started',
						message: `GitHub hasn’t started a preview build for PR ${ref}. Check that its preview workflow is enabled, then try again.`,
						status: 'error',
					});
				} else if (
					error === 'artifact_not_found' ||
					error === 'artifact_not_available'
				) {
					if (isWordPressPrBeforePreviewer(resolved)) {
						setFeedback({
							title: 'Rebase required',
							message: `PR ${ref} predates the Pull Request previewer. Rebase it to create a preview build.`,
							status: 'error',
						});
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
					setFeedback({
						title: 'Rebase required',
						message: `Rebase PR ${ref} to create a valid preview build.`,
						status: 'error',
					});
				} else if (error === 'artifact_expired') {
					setFeedback({
						title: 'Preview build expired',
						message: `The CI build artifact has expired for PR ${ref}. Push a new commit, rebase, or rerun the CI job to create a fresh build.`,
						status: 'error',
					});
				} else {
					setFeedback({
						title: 'Preview unavailable',
						message: isBareWordPressPr
							? `Playground treated ${ref} as a WordPress Core PR but couldn’t verify it. If this is a Gutenberg PR, paste its full GitHub URL instead.`
							: `PR ${ref} couldn’t be previewed. Try again later or file an issue in the WordPress Playground repository.`,
						status: 'error',
					});
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
				!verification.ok &&
				verification.error !== 'invalid_pr_number' &&
				!isRepositoryMatch(verification)
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
		let json:
			| { error?: unknown; title?: unknown; created_at?: unknown }
			| undefined;
		try {
			json = await response.json();
		} catch (parseError) {
			logger.error(parseError);
		}
		const title = typeof json?.title === 'string' ? json.title : undefined;
		const openedAt =
			typeof json?.created_at === 'string' ? json.created_at : undefined;
		if (response.status === 200) {
			return { ok: true, title, openedAt };
		}

		if (typeof json?.error === 'string') {
			return {
				ok: false,
				error: json.error,
				title,
				openedAt,
			};
		}
		return { ok: false, error: 'unexpected_response' };
	}

	const inputLabel = inline
		? 'WordPress Core or Gutenberg'
		: target === 'wordpress'
			? 'PR number or URL'
			: 'PR number, URL, or a branch name';

	return (
		<form onSubmit={handleSubmit}>
			<div>
				<TextControl
					disabled={submitting}
					label={inputLabel}
					placeholder={inline ? 'PR number or GitHub URL' : undefined}
					value={value}
					autoFocus={!inline}
					onChange={(e) => {
						setFeedback(undefined);
						setRepositoryMatches([]);
						setValue(e);
					}}
				/>
				{resolvedSource && (
					<div className={css.repositoryChoices}>
						<PullRequestPreviewCard
							target={resolvedSource.target}
							title={
								resolvedSource.isBranch
									? resolvedSource.ref
									: `PR #${resolvedSource.ref}`
							}
							repositoryName={`wordpress/${targetParams[resolvedSource.target].repo}`}
							details={
								resolvedSource.isBranch ? 'Branch' : undefined
							}
							disabled={submitting}
							onClick={() => previewPr(resolvedSource)}
						/>
					</div>
				)}
				{submitting && (
					<div className={css.progress}>
						<InlineProgress message={loadingMessage} />
					</div>
				)}
				{repositoryMatches.length > 1 && (
					<section
						className={css.repositoryPicker}
						aria-labelledby="pr-repository-picker-title"
					>
						<p
							className={css.feedbackTitle}
							id="pr-repository-picker-title"
						>
							Two pull requests found
						</p>
						<p className={css.feedbackMessage}>
							Choose the change you want to preview.
						</p>
						<div className={css.repositoryChoices}>
							{repositoryMatches.map((match) => {
								const openedAt = formatPullRequestOpenedAt(
									match.verification.openedAt
								);
								const pullRequestTitle =
									match.verification.title ||
									`Pull request ${match.resolved.ref}`;
								const repositoryName = `wordpress/${
									targetParams[match.resolved.target].repo
								}`;
								return (
									<PullRequestPreviewCard
										key={match.resolved.target}
										target={match.resolved.target}
										title={pullRequestTitle}
										repositoryName={repositoryName}
										details={
											<>
												PR #{match.resolved.ref}
												{openedAt && (
													<>
														{' '}
														<span
															className={
																css.repositoryChoiceOpened
															}
														>
															opened{' '}
															<time
																dateTime={
																	match
																		.verification
																		.openedAt
																}
															>
																{openedAt}
															</time>
														</span>
													</>
												)}
											</>
										}
										onClick={async () => {
											setRepositoryMatches([]);
											await previewPr(
												match.resolved,
												match.verification
											);
										}}
									/>
								);
							})}
						</div>
					</section>
				)}
				{feedback &&
					(inline ? (
						<Notice
							className={css.feedbackNotice}
							status={feedback.status}
							isDismissible={false}
						>
							<p className={css.feedbackTitle}>
								{feedback.title}
							</p>
							<p className={css.feedbackMessage}>
								{feedback.message}
							</p>
						</Notice>
					) : (
						<div>{feedback.message}</div>
					))}
			</div>
			{inline && repositoryMatches.length === 0 && !resolvedSource ? (
				<div className={css.inlineActions}>
					<Button
						variant="primary"
						type="submit"
						disabled={submitting}
					>
						{isBarePrNumber ? 'Find pull request' : 'Preview'}
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
 * Renders a repository-aware action for previewing a pull request or branch.
 *
 * A recognized GitHub URL and an ambiguous bare pull-request number both lead
 * to the same action: a full-width row that identifies the repository and
 * opens its preview. Keeping that action in one component prevents the input
 * confirmation and repository picker from developing different interaction,
 * spacing, icon, or focus treatments.
 *
 * The title identifies the change when the proxy returned one, or the parsed
 * pull request or branch when the URL alone supplied the available context.
 * Optional details add metadata such as a pull-request number, opened date, or
 * the fact that the reference is a branch.
 *
 * @param props Repository, copy, state, and click handler for the preview row.
 * @returns A button using the shared pull-request preview-card presentation.
 */
function PullRequestPreviewCard({
	target,
	title,
	repositoryName,
	details,
	disabled = false,
	onClick,
}: PullRequestPreviewCardProps) {
	return (
		<Button
			className={css.repositoryChoice}
			variant="secondary"
			type="button"
			disabled={disabled}
			aria-label={`Preview ${title} from ${repositoryName}`}
			onClick={onClick}
		>
			<span className={css.repositoryChoiceMain}>
				<span className={css.repositoryChoiceLogo} aria-hidden="true">
					{target === 'wordpress' ? (
						<Icon icon={wordpress} size={42} />
					) : (
						<img src={gutenbergLogoUrl} alt="" />
					)}
				</span>
				<span className={css.repositoryChoiceText}>
					<span className={css.repositoryChoiceTitle}>{title}</span>
					<span className={css.repositoryChoiceMeta}>
						<span>{repositoryName}</span>
						{details && (
							<span className={css.repositoryChoiceDetails}>
								{details}
							</span>
						)}
					</span>
				</span>
			</span>
			<span className={css.repositoryChoiceAction} aria-hidden="true">
				<Icon icon={chevronRight} size={20} />
			</span>
		</Button>
	);
}

/**
 * Formats when a pull request was opened for its repository choice.
 *
 * Pull requests opened on the user's current calendar day include a concise
 * local time. Pull requests opened on the preceding calendar day say
 * "yesterday at" before that time. Older timestamps use the local calendar
 * date in YYYY-MM-DD form and omit the time.
 *
 * Calendar-day comparison uses local date parts rather than elapsed hours, so
 * crossing a daylight-saving boundary does not misclassify yesterday. Missing
 * or malformed timestamps are not shown, which keeps compatibility with older
 * proxy responses that returned only verification status and a title.
 *
 * @param openedAt ISO 8601 timestamp returned by the preview proxy.
 * @returns A concise local description, or `undefined` when the timestamp is
 * absent or invalid.
 */
function formatPullRequestOpenedAt(
	openedAt: string | undefined
): string | undefined {
	if (!openedAt) {
		return undefined;
	}
	const date = new Date(openedAt);
	if (Number.isNaN(date.getTime())) {
		return undefined;
	}
	const today = new Date();
	const yesterday = new Date(today);
	yesterday.setDate(today.getDate() - 1);
	const time = date
		.toLocaleTimeString('en-US', {
			hour: 'numeric',
			hour12: true,
			minute: '2-digit',
		})
		.toLowerCase()
		.replace(/\s/gu, '');

	if (date.toDateString() === today.toDateString()) {
		return `today ${time}`;
	}
	if (date.toDateString() === yesterday.toDateString()) {
		return `yesterday at ${time}`;
	}
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
		2,
		'0'
	)}-${String(date.getDate()).padStart(2, '0')}`;
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

/** Proxy errors that identify a PR even though its preview cannot be opened. */
const repositoryMatchErrors = new Set([
	'no_ci_runs',
	'artifact_not_found',
	'artifact_not_available',
	'artifact_invalid',
	'artifact_expired',
]);
