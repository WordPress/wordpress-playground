import React, { useEffect } from 'react';
import { useState } from 'react';
import { Spinner, TextControl } from '@wordpress/components';
import css from './style.module.css';
import { logger } from '@php-wasm/logger';
import ModalButtons from '../../components/modal/modal-buttons';
import type { BlueprintV1Declaration } from '@wp-playground/blueprints';

interface PreviewPRFormProps {
	onClose: () => void;
	target: 'wordpress' | 'gutenberg';
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
}: PreviewPRFormProps) {
	const [value, setValue] = useState<string>('');
	const [submitting, setSubmitting] = useState<boolean>(false);
	const [errorMsg, setError] = useState<string>('');

	useEffect(() => {
		const query = new URLSearchParams(window.location.search);
		if (query.has('core-pr')) {
			const prNumber = query.get('core-pr');
			prNumber && setValue(prNumber);
		}
	}, []);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();

		if (!value) {
			return;
		}

		await previewPr(value);
	}

	function renderRetryIn(retryIn: number, isBranch: boolean) {
		setError(
			`Waiting for GitHub to finish building ${
				isBranch ? 'branch' : 'PR'
			} ${value}. This might take 15 minutes or more! Retrying in ${
				retryIn / 1000
			}...`
		);
	}

	function buildArtifactUrl(ref: string, isBranch: boolean): string {
		const refType = isBranch ? 'branch' : 'pr';
		// For WordPress PRs: artifact name is wordpress-build-{PR_NUMBER}
		// For Gutenberg PRs: artifact name is always gutenberg-plugin
		// For Gutenberg branches: artifact name is always gutenberg-plugin
		//   (we use prefix matching with trailing dash for branches)
		let artifactSuffix = '';
		if (target === 'wordpress') {
			// WordPress only supports PRs, not branches
			artifactSuffix = ref;
		}
		return `https://playground.wordpress.net/plugin-proxy.php?org=WordPress&repo=${targetParams[target].repo}&workflow=${targetParams[target].workflow}&artifact=${targetParams[target].artifact}${artifactSuffix}&${refType}=${ref}`;
	}

	async function previewPr(prValue: string) {
		let cleanupRetry = () => {};
		if (cleanupRetry) {
			cleanupRetry();
		}

		let prNumber: string = prValue;
		let branchName: string | null = null;
		setSubmitting(true);

		// Extract number from a GitHub URL
		if (prNumber.toLowerCase().includes(targetParams[target].pull)) {
			prNumber = prNumber.match(/\/pull\/(\d+)/)![1];
		} else if (!/^\d+$/.test(prNumber)) {
			// For WordPress core, only allow PR numbers/URLs, not branch names
			if (target === 'wordpress') {
				setError(
					'Please enter a valid PR number or PR URL for WordPress Core.'
				);
				setSubmitting(false);
				return;
			}
			// For Gutenberg, treat non-numeric input as a branch name
			branchName = prNumber;
		}

		const ref = branchName || prNumber;
		const isBranch = !!branchName;

		// For branches, skip verification since we'll use the most recent artifact with prefix matching
		// For PRs, verify that the specific PR build exists
		if (!isBranch) {
			const zipArtifactUrl = buildArtifactUrl(ref, isBranch);
			const response = await fetch(zipArtifactUrl + '&verify_only=true');
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
						renderRetryIn(retryIn, false);
						const timerInterval = setInterval(() => {
							retryIn -= 1000;
							if (retryIn <= 0) {
								retryIn = 0;
							}
							renderRetryIn(retryIn, false);
						}, 1000);
						const scheduledRetry = setTimeout(() => {
							previewPr(ref);
						}, retryIn);
						cleanupRetry = () => {
							clearInterval(timerInterval);
							clearTimeout(scheduledRetry);
							cleanupRetry = () => {};
						};
					}
				} else if (error === 'artifact_invalid') {
					setError(
						`The PR ${ref} requires a rebase before it can be previewed.`
					);
				} else {
					setError(
						`The PR ${ref} couldn't be previewed due to an unexpected error. Please try again later or fill an issue in the WordPress Playground repository.`
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
			? `${target === 'wordpress' ? 'core' : 'gutenberg'}-branch`
			: `${target === 'wordpress' ? 'core' : 'gutenberg'}-pr`;
		const urlWithPreview = new URL(
			window.location.pathname,
			window.location.href
		);

		if (target === 'wordpress') {
			// [wordpress] Passthrough the mode query parameter if it exists
			if (urlParams.has('mode')) {
				urlWithPreview.searchParams.set(
					'mode',
					urlParams.get('mode') as string
				);
			}
			urlWithPreview.searchParams.set(refParam, ref);
		} else if (target === 'gutenberg') {
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

	const inputLabel =
		target === 'wordpress'
			? 'PR number or URL'
			: 'PR number, URL, or a branch name';

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
					label={inputLabel}
					value={value}
					autoFocus
					onChange={(e) => {
						setError('');
						setValue(e);
					}}
				/>
				{errorMsg && <div>{errorMsg}</div>}
			</div>
			<ModalButtons
				areDisabled={submitting}
				onCancel={onClose}
				onSubmit={handleSubmit}
				submitText="Preview"
			/>
		</form>
	);
}
