import React, { useEffect, useRef } from 'react';
import { useState } from 'react';
import { Button, Notice, Spinner, TextControl } from '@wordpress/components';
import css from './style.module.css';
import { logger } from '@php-wasm/logger';
import ModalButtons from '../../components/modal/modal-buttons';
import type { BlueprintV1Declaration } from '@wp-playground/blueprints';
import type { ResolvedRef } from './resolve-pr-input';
import {
	isWordPressPrBeforePreviewer,
	resolvePrInput,
} from './resolve-pr-input';

type PrVerification = { ok: true } | { ok: false; error: string };

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

				if (error === 'invalid_pr_number' || error === 'no_ci_runs') {
					setError(
						isBareWordPressPr
							? `Couldn’t find WordPress Core PR ${ref}. If this is a Gutenberg PR, paste its full GitHub URL instead.`
							: `The PR ${ref} does not exist.`
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

		return results.filter(({ verification }) =>
			isRepositoryMatch(verification)
		);
	}

	async function verifyPr(resolved: ResolvedRef): Promise<PrVerification> {
		const response = await fetch(
			buildArtifactUrl(resolved) + '&verify_only=true'
		);
		if (response.status === 200) {
			return { ok: true };
		}

		let error = 'invalid_pr_number';
		try {
			const json = await response.json();
			if (json.error) {
				error = json.error;
			}
		} catch (parseError) {
			logger.error(parseError);
			return { ok: false, error: 'unexpected_response' };
		}
		return { ok: false, error };
	}

	const inputLabel = inline
		? 'Pull request URL or number'
		: target === 'wordpress'
			? 'PR number or URL'
			: 'PR number, URL, or a branch name';

	return (
		<form onSubmit={handleSubmit}>
			<div>
				<TextControl
					disabled={submitting}
					label={inputLabel}
					value={value}
					autoFocus={!inline}
					onChange={(e) => {
						setError('');
						setRepositoryMatches([]);
						setValue(e);
					}}
				/>
				{inline && (
					<p className={css.hint}>
						Paste a link to a WordPress Core or Gutenberg pull
						request, or enter a PR number and Playground will find
						the repository. Gutenberg branch links work too.
					</p>
				)}
				{submitting && (
					<div className={css.loadingStatus} role="status">
						<Spinner />
						<span>{loadingMessage}</span>
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
						isBusy={submitting}
					>
						{submitting ? 'Checking…' : 'Preview'}
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

function isRepositoryMatch(verification: PrVerification): boolean {
	return (
		verification.ok ||
		[
			'artifact_not_found',
			'artifact_not_available',
			'artifact_invalid',
			'artifact_expired',
		].includes(verification.error)
	);
}
