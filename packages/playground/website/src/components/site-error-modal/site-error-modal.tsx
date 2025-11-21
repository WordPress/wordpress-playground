import { useState } from 'react';
import classNames from 'classnames';
import { Button, TextareaControl } from '@wordpress/components';
import { logger } from '@php-wasm/logger';

import { Modal } from '../modal';
import css from './style.module.css';
import { useAppDispatch } from '../../lib/state/redux/store';
import { removeClientInfo } from '../../lib/state/redux/slice-clients';
import { removeSite } from '../../lib/state/redux/slice-sites';
import {
	clearActiveSiteError,
	type SerializedBlueprintStepErrorDetails,
	type SerializedSiteErrorDetails,
} from '../../lib/state/redux/slice-ui';
import type {
	SiteErrorModalProps,
	PresentationHelpers,
	BlueprintStepError,
} from './types';
import { getSiteErrorView } from './get-site-error-view';
import type { SiteInfo } from '../../lib/state/redux/slice-sites';

export function SiteErrorModal({
	error,
	siteSlug,
	site,
	errorDetails,
}: SiteErrorModalProps) {
	const dispatch = useAppDispatch();
	const {
		isReporting,
		setIsReporting,
		reportText,
		setReportText,
		reportSubmitted,
		submitError,
		isSubmittingReport,
		handleSubmitReport,
	} = useErrorReporting(site);

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
		reloadWithoutBlueprint() {
			const url = new URL(window.location.href);
			url.search = '';
			url.pathname = '/';
			url.hash = '';
			window.location.href = url.toString();
		},
	};

	const blueprintStepError = extractBlueprintStepError(errorDetails);
	const view = getSiteErrorView({
		error,
		site,
		blueprintStepError,
		helpers,
	});

	const detailText = formatErrorDetails(errorDetails);
	return (
		<Modal
			title={
				(
					<>
						<span className={css.errorBadge}>
							{view.isDeveloperError
								? 'Blueprint issue'
								: 'Runtime error'}
						</span>{' '}
						{view.title || 'Playground crashed'}
					</>
				) as unknown as string
			}
			onRequestClose={() => dispatch(clearActiveSiteError())}
			shouldCloseOnClickOutside
			className={classNames(css.errorModal, {
				[css.errorModalDeveloper]: view.isDeveloperError,
				[css.errorModalCrash]: !view.isDeveloperError,
			})}
		>
			<div className={css.errorModalContent}>
				<div className={css.errorModalBody}>
					{view.body}
					{detailText ? (
						<details
							className={css.errorDetails}
							open={view.isDeveloperError}
						>
							<summary>
								{view.detailSummaryOverride ??
									(view.isDeveloperError
										? 'Inspection details'
										: 'Error details')}
							</summary>
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
				{view.actions.length || !view.isDeveloperError ? (
					<div className={css.errorModalFooter}>
						{!view.isDeveloperError &&
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
							view.actions.map((action: any, index: any) =>
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

function useErrorReporting(site: SiteInfo) {
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

	return {
		isReporting,
		setIsReporting,
		reportText,
		setReportText,
		reportSubmitted,
		submitError,
		isSubmittingReport,
		handleSubmitReport,
	};
}

/**
 * Extracts structured data about the blueprint step error from
 * potentially generic error details.
 */
export function extractBlueprintStepError(
	errorDetails?: SerializedSiteErrorDetails
): BlueprintStepError | undefined {
	if (!errorDetails || typeof errorDetails === 'string') {
		return undefined;
	}

	const maybeBlueprintStepError =
		errorDetails as SerializedBlueprintStepErrorDetails;
	if (maybeBlueprintStepError.type !== 'blueprint-step-error') {
		return undefined;
	}

	const step = maybeBlueprintStepError.step;
	const stepJson = JSON.stringify(step, null, 2);
	const messages = maybeBlueprintStepError.messages || [];
	return {
		stepNumber: maybeBlueprintStepError.stepNumber,
		step,
		stepJson,
		description: describeBlueprintStepAction(step),
		messages,
		rawMessage:
			maybeBlueprintStepError.rawMessage ||
			maybeBlueprintStepError.message ||
			'',
	};
}

/**
 * Turns a blueprint step JSON object into a human readable string.
 *
 * For example, `{ step: 'installPlugin', pluginData: { slug: 'hello-world' } }`
 * becomes "install plugin "hello-world"".
 *
 * @param step - The blueprint step JSON object.
 * @returns The human readable string.
 */
function describeBlueprintStepAction(step: Record<string, unknown>): string {
	const stepName = typeof step?.step === 'string' ? step.step : undefined;
	const readableName = stepName ? humanizeStepName(stepName) : undefined;
	const stepAny = step as Record<string, any>;

	switch (stepName) {
		case 'installPlugin': {
			const slug =
				stepAny?.pluginData?.slug ||
				stepAny?.pluginData?.pluginZipFile?.slug ||
				stepAny?.pluginZipFile?.slug;
			return slug ? `install plugin "${slug}"` : 'install plugin';
		}
		case 'installTheme': {
			const slug = stepAny?.themeData?.slug || stepAny?.theme?.slug;
			return slug ? `install theme "${slug}"` : 'install theme';
		}
		case 'runPHP':
			return 'run custom PHP code';
		case 'runSQL':
			return 'run SQL statements';
		case 'importWxr':
			return 'import WordPress XML content';
		case 'importWordPressFiles':
			return 'import a WordPress site archive';
		case 'installMuPlugin':
			return 'install an MU plugin';
		default:
			return readableName || 'run this step';
	}
}

/**
 * Convert a camel case step name, such as `installPlugin`, to a human readable
 * string, such as "install plugin".
 */
function humanizeStepName(stepName: string): string {
	const spaced = stepName.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
	return spaced.charAt(0).toLowerCase() + spaced.slice(1);
}

/**
 * Formats SerializedSiteErrorDetails object into a human readable string.
 *
 * @param errorDetails - The error details.
 * @returns The human readable string.
 */
export function formatErrorDetails(
	errorDetails?: SerializedSiteErrorDetails
): string | undefined {
	if (!errorDetails) {
		return undefined;
	}
	if (typeof errorDetails === 'string') {
		return errorDetails.trim();
	}
	return [errorDetails.name, errorDetails.message, errorDetails.stack]
		.filter(Boolean)
		.join('\n\n');
}
