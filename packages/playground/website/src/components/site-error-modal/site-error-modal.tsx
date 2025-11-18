import React, { useState } from 'react';
import classNames from 'classnames';
import { Button, TextareaControl } from '@wordpress/components';
import { logger } from '@php-wasm/logger';

import { Modal } from '../modal';
import css from './style.module.css';
import { useAppDispatch, setActiveSite } from '../../lib/state/redux/store';
import { removeClientInfo } from '../../lib/state/redux/slice-clients';
import {
	removeSite,
	setTemporarySiteSpec,
} from '../../lib/state/redux/slice-sites';
import {
	clearActiveSiteError,
	setActiveSiteError,
} from '../../lib/state/redux/slice-ui';
import type { SiteErrorModalProps, PresentationHelpers } from './types';
import { ErrorCopy } from './error-copy';
import { BlueprintStepErrorDetails } from './blueprint-step-error-details';
import {
	developerErrorTypes,
	MODAL_TITLES,
	DETAIL_SUMMARY_OVERRIDES,
} from './constants';
import { extractBlueprintStepError, formatErrorDetails } from './helpers';

export function SiteErrorModal({
	error,
	siteSlug,
	site,
	errorDetails,
}: SiteErrorModalProps) {
	const dispatch = useAppDispatch();
	const blueprintStepError = extractBlueprintStepError(errorDetails);
	const isBlueprintStepFailure = Boolean(blueprintStepError);
	const isDeveloperError =
		developerErrorTypes.has(error) || isBlueprintStepFailure;
	const [isStartingWithoutBlueprint, setIsStartingWithoutBlueprint] =
		useState(false);
	const [isReporting, setIsReporting] = useState(false);
	const [reportText, setReportText] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [reportSubmitted, setReportSubmitted] = useState(false);
	const [submitError, setSubmitError] = useState('');

	const detailText = formatErrorDetails(
		errorDetails,
		blueprintStepError?.rawMessage
	);

	function getContext() {
		return {
			...(site.metadata.originalBlueprint as any)?.preferredVersions,
			userAgent: navigator.userAgent,
			...((window.performance as any)?.memory ?? {}),
			window: {
				width: window.innerWidth,
				height: window.innerHeight,
			},
		};
	}

	async function onSubmit() {
		setIsSubmitting(true);
		const formdata = new FormData();
		formdata.append('description', reportText);
		const logs = logger.getLogs().join('\n');
		if (logs) {
			formdata.append('logs', logs);
		}
		const url = window.location.href;
		if (url) {
			formdata.append('url', url);
		}
		formdata.append('context', JSON.stringify(getContext()));
		formdata.append(
			'blueprint',
			JSON.stringify(site.metadata.originalBlueprint)
		);
		try {
			const response = await fetch(
				'https://playground.wordpress.net/logger.php',
				{
					method: 'POST',
					body: formdata,
				}
			);
			setReportSubmitted(true);

			const body = await response.json();
			if (!body.ok) {
				throw new Error(body.error);
			}

			setSubmitError('');
			setReportText('');
		} catch (e) {
			setSubmitError((e as Error).message);
		} finally {
			setIsSubmitting(false);
		}
	}

	const startWithoutBlueprint = async () => {
		if (isStartingWithoutBlueprint) {
			return;
		}
		setIsStartingWithoutBlueprint(true);
		try {
			const sanitizedUrl = new URL(window.location.href);
			sanitizedUrl.searchParams.delete('blueprint-url');
			sanitizedUrl.searchParams.delete('blueprint');
			window.history.replaceState({}, '', sanitizedUrl.toString());
			const newSite = await dispatch(
				setTemporarySiteSpec(site.metadata.name, sanitizedUrl)
			);
			await dispatch(setActiveSite(newSite.slug));
			dispatch(clearActiveSiteError());
		} catch (err) {
			logger.error('Failed to start without a Blueprint', err);
			dispatch(clearActiveSiteError());
			dispatch(
				setActiveSiteError({ error: 'site-boot-failed', details: err })
			);
			dispatch(setActiveSite(undefined));
		} finally {
			setIsStartingWithoutBlueprint(false);
		}
	};

	const helpers: PresentationHelpers = {
		deleteSite: () => {
			dispatch(removeSite(siteSlug));
			dispatch(removeClientInfo(siteSlug));
			dispatch(clearActiveSiteError());
		},
		restartWithoutPr: () => {
			const url = new URL(window.location.href);
			url.searchParams.delete('core-pr');
			window.location.href = url.toString();
		},
		startWithoutBlueprint,
		reload: () => {
			const url = new URL(window.location.href);
			url.search = '';
			url.pathname = '/';
			url.hash = '';
			window.location.href = url.toString();
		},
		startWithoutBlueprintBusy: isStartingWithoutBlueprint,
	};

	const modalTitle = blueprintStepError
		? 'Blueprint execution failed'
		: MODAL_TITLES[error] ?? 'Playground crashed';
	const detailSummary = blueprintStepError
		? 'Blueprint error details'
		: DETAIL_SUMMARY_OVERRIDES[error] ??
		  (isDeveloperError ? 'Inspection details' : 'Error details');
	const actionButtons = getErrorActions(error, helpers);
	const showActionBar = Boolean(actionButtons.length || !isDeveloperError);

	return (
		<Modal
			title={
				(
					<>
						<span className={css.errorBadge}>
							{isDeveloperError
								? 'Blueprint issue'
								: 'Runtime error'}
						</span>{' '}
						{modalTitle}
					</>
				) as unknown as string
			}
			onRequestClose={() => dispatch(clearActiveSiteError())}
			shouldCloseOnClickOutside
			className={classNames(css.errorModal, {
				[css.errorModalDeveloper]: isDeveloperError,
				[css.errorModalCrash]: !isDeveloperError,
			})}
		>
			<div className={css.errorModalContent}>
				<div className={css.errorModalBody}>
					<ErrorCopy
						error={error}
						site={site}
						blueprintStepError={blueprintStepError}
					/>
					{blueprintStepError ? (
						<BlueprintStepErrorDetails
							stepError={blueprintStepError}
						/>
					) : null}
					{detailText ? (
						<details
							className={css.errorDetails}
							open={isDeveloperError}
						>
							<summary>{detailSummary}</summary>
							<pre>{detailText}</pre>
						</details>
					) : null}
					{isReporting && !reportSubmitted && (
						<TextareaControl
							label="How can we recreate this error?"
							help="Describe what caused the error and how can we recreate it."
							value={reportText}
							onChange={setReportText}
							autoFocus={true}
						/>
					)}
					{reportSubmitted && !submitError && (
						<p style={{ color: 'green', fontWeight: '500' }}>
							Your report has been submitted to the{' '}
							<a
								href="https://wordpress.slack.com/archives/C06Q5DCKZ3L"
								target="_blank"
								rel="noopener noreferrer"
							>
								Making WordPress #playground-logs Slack channel
							</a>{' '}
							and will be reviewed by the team.
						</p>
					)}
					{submitError && (
						<p>
							We were unable to submit the error report. Please
							try again or open an{' '}
							<a
								href="https://github.com/WordPress/wordpress-playground/issues/"
								target="_blank"
								rel="noopener noreferrer"
							>
								issue on GitHub.
							</a>
						</p>
					)}
				</div>
				{showActionBar ? (
					<div className={css.errorModalFooter}>
						{!isDeveloperError &&
						!isReporting &&
						!reportSubmitted ? (
							<Button
								variant="secondary"
								onClick={() => setIsReporting(true)}
							>
								Report this crash
							</Button>
						) : null}
						{isReporting && !reportSubmitted && (
							<>
								<Button
									variant="secondary"
									onClick={() => setIsReporting(false)}
								>
									Cancel
								</Button>
								<Button
									variant="primary"
									onClick={onSubmit}
									isBusy={isSubmitting}
									disabled={!reportText || isSubmitting}
								>
									Submit report
								</Button>
							</>
						)}
						{(!isReporting || reportSubmitted) &&
							actionButtons.map((action, index) => (
								<div
									key={index}
									className={css.errorActionWrapper}
								>
									{action}
								</div>
							))}
					</div>
				) : null}
			</div>
		</Modal>
	);
}

function getErrorActions(
	error: SiteErrorModalProps['error'],
	helpers: PresentationHelpers
): React.ReactNode[] {
	const startWithoutBlueprintButton = (key: string) => (
		<Button
			variant="primary"
			key={key}
			onClick={() => helpers.startWithoutBlueprint()}
			isBusy={helpers.startWithoutBlueprintBusy}
			disabled={helpers.startWithoutBlueprintBusy}
		>
			Start without a Blueprint
		</Button>
	);

	switch (error) {
		case 'directory-handle-directory-does-not-exist':
			return [
				<Button
					variant="primary"
					key="delete-site"
					onClick={helpers.deleteSite}
				>
					Delete this site and try again
				</Button>,
			];
		case 'github-artifact-expired':
			return [
				<Button
					variant="primary"
					key="restart-pr"
					onClick={helpers.restartWithoutPr}
				>
					Restart without that PR
				</Button>,
			];
		case 'blueprint-fetch-failed':
			return [startWithoutBlueprintButton('start-without-blueprint')];
		case 'blueprint-filesystem-required':
		case 'blueprint-validation-failed':
			return [
				startWithoutBlueprintButton('start-without-blueprint-invalid'),
			];
		case 'directory-handle-unknown-error':
		case 'directory-handle-not-found-in-indexeddb':
		case 'directory-handle-permission-denied':
			return [];
		case 'site-boot-failed':
		default:
			return [
				<Button
					variant="primary"
					key="reload-tab"
					onClick={helpers.reload}
				>
					Reload Fresh Playground
				</Button>,
			];
	}
}
