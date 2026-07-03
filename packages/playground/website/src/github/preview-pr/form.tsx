import React, { useEffect } from 'react';
import { useState } from 'react';
import { Button, Notice, Spinner, TextControl } from '@wordpress/components';
import css from './style.module.css';
import { logger } from '@php-wasm/logger';
import ModalButtons from '../../components/modal/modal-buttons';
import type { BlueprintV1Declaration } from '@wp-playground/blueprints';
import type { ResolvedRef } from './resolve-pr-input';
import { resolvePrInput } from './resolve-pr-input';

interface PreviewPRFormProps {
	onClose: () => void;
	/**
	 * Preferred repository for ambiguous (bare) input. A recognized GitHub URL
	 * always wins over this; it only decides whether a bare number/branch is a
	 * WordPress Core or Gutenberg reference. Defaults to WordPress Core.
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
	// Track retry timers so they can be cancelled if the form unmounts mid-wait
	// (e.g. closing the dock pane), instead of firing a retry after teardown.
	const retryTimersRef = React.useRef<Array<ReturnType<typeof setTimeout>>>(
		[]
	);

	useEffect(() => {
		const query = new URLSearchParams(window.location.search);
		if (query.has('core-pr')) {
			const prNumber = query.get('core-pr');
			prNumber && setValue(prNumber);
		}
	}, []);

	useEffect(() => {
		return () => {
			for (const timer of retryTimersRef.current) {
				clearTimeout(timer);
				clearInterval(timer);
			}
			retryTimersRef.current = [];
		};
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
		setError('');
		await previewRef(resolved.value);
	}

	function renderRetryIn(resolved: ResolvedRef, retryIn: number) {
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
		// For WordPress PRs: artifact name is wordpress-build-{PR_NUMBER}.
		// For Gutenberg PRs/branches: artifact name is always gutenberg-plugin
		//   (branches use prefix matching with a trailing dash).
		const artifactSuffix = repo === 'wordpress' ? ref : '';
		return `https://playground.wordpress.net/plugin-proxy.php?org=WordPress&repo=${targetParams[repo].repo}&workflow=${targetParams[repo].workflow}&artifact=${targetParams[repo].artifact}${artifactSuffix}&${refType}=${ref}`;
	}

	async function previewRef(resolved: ResolvedRef) {
		const { target: repo, ref, isBranch } = resolved;
		setSubmitting(true);

		// For branches, skip verification since we'll use the most recent
		// artifact with prefix matching. For PRs, verify the build exists.
		if (!isBranch) {
			const zipArtifactUrl = buildArtifactUrl(resolved);
			let response: Response;
			try {
				response = await fetch(zipArtifactUrl + '&verify_only=true');
			} catch (e) {
				logger.error(e);
				setError(
					'Could not reach the build server. Check your connection and try again.'
				);
				setSubmitting(false);
				return;
			}
			if (response.status !== 200) {
				let error = 'invalid_pr_number';
				try {
					const json = await response.json();
					if (json.error) {
						error = json.error;
					}
				} catch (e) {
					logger.error(e);
					setError('An unexpected error occurred. Please try again.');
					setSubmitting(false);
					return;
				}

				if (error === 'invalid_pr_number' || error === 'no_ci_runs') {
					setError(`The PR ${ref} does not exist.`);
				} else if (
					error === 'artifact_not_found' ||
					error === 'artifact_not_available'
				) {
					if (parseInt(ref) < 5749) {
						setError(
							`The PR ${ref} predates the Pull Request previewer and requires a rebase before it can be previewed.`
						);
					} else {
						// For PRs, retry since we expect a specific build to complete
						let retryIn = 30000;
						renderRetryIn(resolved, retryIn);
						const timerInterval = setInterval(() => {
							retryIn -= 1000;
							if (retryIn <= 0) {
								retryIn = 0;
							}
							renderRetryIn(resolved, retryIn);
						}, 1000);
						const retryTimeout = setTimeout(() => {
							clearInterval(timerInterval);
							previewRef(resolved);
						}, retryIn);
						// Only one retry is ever pending at a time; clear any
						// already-finished handles so the list can't grow
						// unbounded across a long (15min+) retry loop.
						retryTimersRef.current.forEach((timer) => {
							clearTimeout(timer);
							clearInterval(timer);
						});
						retryTimersRef.current = [timerInterval, retryTimeout];
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
						`The PR ${ref} couldn't be previewed due to an unexpected error. Please try again later or file an issue in the WordPress Playground repository.`
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

	return (
		<form onSubmit={handleSubmit}>
			<div className={css.content}>
				{submitting && (
					<div className={css.overlay}>
						<Spinner />
					</div>
				)}
				<TextControl
					disabled={submitting}
					label="Pull request URL or number"
					value={value}
					autoFocus
					onChange={(e) => {
						setError('');
						setValue(e);
					}}
				/>
				<p className={css.hint}>
					Paste a link to a WordPress Core or Gutenberg pull request —
					or just the PR number for WordPress Core. Gutenberg branch
					links work too.
				</p>
				{errorMsg && (
					<Notice status="error" isDismissible={false}>
						{errorMsg}
					</Notice>
				)}
			</div>
			{inline ? (
				<div className={css.inlineActions}>
					<Button
						variant="primary"
						type="submit"
						disabled={submitting}
					>
						Preview
					</Button>
				</div>
			) : (
				<ModalButtons
					areDisabled={submitting}
					cancelDisabled={submitting}
					onCancel={onClose}
					onSubmit={handleSubmit}
					submitText="Preview"
				/>
			)}
		</form>
	);
}
