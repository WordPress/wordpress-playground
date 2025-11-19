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
import { getSiteErrorView } from './get-site-error-view';
import { extractBlueprintStepError, formatErrorDetails } from './helpers';

export function SiteErrorModal({
	error,
	siteSlug,
	site,
	errorDetails,
}: SiteErrorModalProps) {
	const dispatch = useAppDispatch();
	const blueprintStepError = extractBlueprintStepError(errorDetails);
	const [isStartingWithoutBlueprint, setIsStartingWithoutBlueprint] =
		useState(false);
	const [isReporting, setIsReporting] = useState(false);
	const [reportText, setReportText] = useState('');
	const [isSubmittingReport, setIsSubmittingReport] = useState(false);
	const [reportSubmitted, setReportSubmitted] = useState(false);
	const [submitError, setSubmitError] = useState('');

	async function handleSubmitReport() {
		setIsSubmittingReport(true);
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
		formdata.append(
			'context',
			JSON.stringify({
				...(site.metadata.originalBlueprint as any)?.preferredVersions,
				userAgent: navigator.userAgent,
				...((window.performance as any)?.memory ?? {}),
				window: {
					width: window.innerWidth,
					height: window.innerHeight,
				},
			})
		);
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
			setIsSubmittingReport(false);
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

	const view = getSiteErrorView({
		error,
		site,
		blueprintStepError,
		helpers,
		startWithoutBlueprintBusy: isStartingWithoutBlueprint,
	});

	const isDeveloperError = view.isDeveloperError;
	const modalTitle = view.title || 'Playground crashed';
	const detailText = formatErrorDetails(errorDetails);
	const detailSummary =
		view.detailSummaryOverride ??
		(isDeveloperError ? 'Inspection details' : 'Error details');
	const actionButtons = view.actions;
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
					{view.body}
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
									onClick={handleSubmitReport}
									isBusy={isSubmittingReport}
									disabled={!reportText || isSubmittingReport}
								>
									Submit report
								</Button>
							</>
						)}
						{(!isReporting || reportSubmitted) &&
							actionButtons.map((action: any, index: any) =>
								action ? (
									<div
										key={index}
										className={css.errorActionWrapper}
									>
										{action}
									</div>
								) : null
							)}
					</div>
				) : null}
			</div>
		</Modal>
	);
}
