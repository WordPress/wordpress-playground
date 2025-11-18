import React, { useEffect, useMemo, useRef, useState } from 'react';

import css from './style.module.css';
import BrowserChrome from '../browser-chrome';
import {
	selectActiveSiteError,
	selectActiveSiteErrorDetails,
	setActiveSite,
	useActiveSite,
	useAppDispatch,
	useAppSelector,
} from '../../lib/state/redux/store';
import { removeClientInfo } from '../../lib/state/redux/slice-clients';
import { bootSiteClient } from '../../lib/state/redux/boot-site-client';
import {
	clearActiveSiteError,
	type SiteError,
	type SerializedSiteErrorDetails,
	setActiveSiteError,
} from '../../lib/state/redux/slice-ui';
import { Button, Spinner, TextareaControl } from '@wordpress/components';
import {
	removeSite,
	selectSiteBySlug,
	selectSitesLoaded,
	selectTemporarySites,
	setTemporarySiteSpec,
} from '../../lib/state/redux/slice-sites';
import type { SiteInfo } from '../../lib/state/redux/slice-sites';
import { Modal } from '../modal';
import classNames from 'classnames';
import { logger } from '@php-wasm/logger';

export const supportedDisplayModes = [
	'browser-full-screen',
	'seamless',
] as const;
export type DisplayMode = (typeof supportedDisplayModes)[number];
interface PlaygroundViewportProps {
	displayMode?: DisplayMode;
	children?: React.ReactNode;
	siteSlug?: string;
	className?: string;
}

export const PlaygroundViewport = ({
	displayMode = 'browser-full-screen',
	className,
}: PlaygroundViewportProps) => {
	if (displayMode === 'seamless') {
		return <KeepAliveTemporarySitesViewport />;
	}
	return (
		<BrowserChrome className={className}>
			<KeepAliveTemporarySitesViewport />
		</BrowserChrome>
	);
};

/**
 * A multi-viewport component that keeps all rendered temporary sites alive.
 * Technically, it retains their iframe node in the DOM. When the user switches
 * to another site, the iframe is hidden but not removed. This way, the state
 * of each temporary site is preserved as long as the browser tab remains open.
 *
 * Persistent sites are not affected by this. They are unmounted and rendered as usual
 * as there's no risk of data loss
 */
export const KeepAliveTemporarySitesViewport = () => {
	const temporarySites = useAppSelector(selectTemporarySites);
	const activeSite = useActiveSite();
	const siteSlugsToRender = useMemo(() => {
		let sites = temporarySites.filter(
			(site) => site.slug !== activeSite?.slug
		);
		if (activeSite) {
			sites = [...sites, activeSite];
		}
		return sites.map((site) => site.slug);
	}, [temporarySites, activeSite]);
	/**
	 * ## Critical data loss prevention mechanism
	 *
	 * The `slugsSeenSoFar` array is necessary to keep the Playground sites running
	 * without being implicitly destroyed by React.
	 *
	 * ## The problem
	 *
	 * When an iframe is moved around in the DOM, its internal state is reset
	 * and the Playground site is lost. Unfortunately, React liberally moves
	 * DOM nodes around even when the `key` prop is set.
	 *
	 * Imagine we're rendering five site viewports, and a sixth site viewport is
	 * added at the beginning of the list in the next render.
	 *
	 * The only way to preserve the state the existing viewports, is to create a new
	 * DOM node for the sixth site viewport and insert it before the already existing
	 * viewports without moving any of the iframes or their parent nodes. Unfortunately,
	 * that's not what React does.
	 *
	 * I don't know exactly which DOM operations React performs, but the existing
	 * iframes are moved around and the Playground sites inside them are trashed
	 * in the process.
	 *
	 * ## The solution
	 *
	 * We never trash, reorder, or remove any DOM nodes.
	 *
	 * This append-only list of slugs is used to keep track of all the sites this
	 * component was ever asked to render. Every site stays in its own div, always
	 * at the same index in the DOM. Every new site is appended to the end of the list,
	 * never in the middle. When a site is deleted, we keep the top-level wrapper div
	 * and only remove the iframe inside it.
	 *
	 * This way, React never reassigns which div is which site and never moves our
	 * precious iframes around.
	 *
	 * The cost is that we render more and more divs over time. That's not a problem.
	 * We're talking about maybe a 100 empty divs in an extreme scenario. That's nothing.
	 */
	const [slugsSeenSoFar, setSlugsSeenSoFar] = useState<string[]>([]);
	useEffect(() => {
		setSlugsSeenSoFar((prev) => [
			...prev,
			...siteSlugsToRender.filter((slug) => !prev.includes(slug)),
		]);
	}, [siteSlugsToRender]);

	const sitesFinishedLoading = useAppSelector(selectSitesLoaded);
	if (!sitesFinishedLoading) {
		return (
			<div
				className={css.fullSize}
				style={{
					display: 'flex',
					justifyContent: 'center',
					alignItems: 'center',
				}}
			>
				<Spinner style={{ width: '60px', height: '60px' }} />
			</div>
		);
	}

	return (
		<>
			{!activeSite && (
				// @TODO: Use the dedicated design for this
				// (the one in Figma with white background and pretty fonts.)
				<div className={css.fullSize}>
					<div className={css.siteError}>
						<div
							className={css.siteErrorContent}
							style={{ textAlign: 'center' }}
						>
							<h2>No site is selected</h2>
							<p>
								Select a site from the site manager to explore
								Playground.
							</p>
						</div>
					</div>
				</div>
			)}
			{slugsSeenSoFar.map((slug) => (
				<div
					key={slug}
					className={classNames(css.fullSize, {
						[css.hidden]: slug !== activeSite?.slug,
					})}
				>
					{siteSlugsToRender.includes(slug) ? (
						<JustViewport key={slug} siteSlug={slug} />
					) : null}
				</div>
			))}
		</>
	);
};

export const JustViewport = function JustViewport({
	siteSlug,
}: {
	siteSlug: string;
}) {
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const site = useAppSelector((state) => selectSiteBySlug(state, siteSlug))!;

	const dispatch = useAppDispatch();
	const runtimeConfigString = JSON.stringify(
		site.metadata.runtimeConfiguration
	);
	useEffect(() => {
		const iframe = iframeRef.current;
		if (!iframe) {
			return;
		}

		const abortController = new AbortController();
		dispatch(
			bootSiteClient(siteSlug, iframe, {
				signal: abortController.signal,
			})
		);

		return () => {
			abortController.abort();
			dispatch(removeClientInfo(siteSlug));
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [siteSlug, iframeRef, runtimeConfigString]);

	const error = useAppSelector(selectActiveSiteError);
	const errorDetails = useAppSelector(selectActiveSiteErrorDetails);
	const activeSiteSlug = useAppSelector((state) => state.ui.activeSite?.slug);
	const showOverlay = error && activeSiteSlug === siteSlug;

	return (
		<>
			<iframe
				key={siteSlug}
				title="WordPress Playground wrapper (the actual WordPress site is in another, nested iframe)"
				className={classNames('playground-viewport', css.fullSize)}
				ref={iframeRef}
			/>
			{showOverlay ? (
				<SiteErrorModal
					error={error}
					siteSlug={siteSlug}
					site={site}
					errorDetails={errorDetails}
				/>
			) : null}
		</>
	);
};

const developerErrorTypes = new Set<SiteError>([
	'blueprint-fetch-failed',
	'blueprint-filesystem-required',
	'blueprint-validation-failed',
]);

type PresentationHelpers = {
	deleteSite: () => void;
	restartWithoutPr: () => void;
	startWithoutBlueprint: () => Promise<void> | void;
	reload: () => void;
	startWithoutBlueprintBusy: boolean;
};

type BlueprintStepError = {
	stepNumber: number;
	step: Record<string, unknown>;
	stepJson: string;
	description: string;
	messages: string[];
	rawMessage: string;
};

const MODAL_TITLES: Partial<Record<SiteError, string>> = {
	'directory-handle-not-found-in-indexeddb':
		'Local directory permissions expired',
	'directory-handle-permission-denied': 'Local directory permissions expired',
	'directory-handle-directory-does-not-exist': 'Local directory was deleted',
	'github-artifact-expired': 'This GitHub artifact expired',
	'blueprint-fetch-failed': 'Blueprint could not be loaded',
	'blueprint-filesystem-required': 'Blueprint resources need a filesystem',
	'blueprint-validation-failed': 'Blueprint validation error',
	'directory-handle-unknown-error': 'The local directory became unavailable',
	'site-boot-failed': 'Playground crashed',
};

const DETAIL_SUMMARY_OVERRIDES: Partial<Record<SiteError, string>> = {
	'blueprint-fetch-failed': 'Network error details',
	'blueprint-filesystem-required': 'Resource loader details',
	'blueprint-validation-failed': 'Validation output',
};

function SiteErrorModal({
	error,
	siteSlug,
	site,
	errorDetails,
}: {
	error: SiteError;
	siteSlug: string;
	site: SiteInfo;
	errorDetails?: SerializedSiteErrorDetails;
}) {
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

	const detailText = formatErrorDetails(
		errorDetails,
		blueprintStepError?.rawMessage
	);

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

function ErrorCopy({
	error,
	site,
	blueprintStepError,
}: {
	error: SiteError;
	site: SiteInfo;
	blueprintStepError?: BlueprintStepError;
}) {
	switch (error) {
		case 'directory-handle-not-found-in-indexeddb':
		case 'directory-handle-permission-denied':
			return (
				<>
					<p className={css.errorLead}>
						The browser no longer lets Playground access your
						previously shared local directory.
					</p>
					<ul className={css.errorList}>
						<li>
							Re-selecting the directory is not supported yet.
						</li>
						<li>
							Need urgent access? Let us know on{' '}
							<a
								target="_blank"
								rel="noopener noreferrer"
								href="https://github.com/WordPress/wordpress-playground/issues/1746"
							>
								GitHub
							</a>
							.
						</li>
					</ul>
				</>
			);
		case 'directory-handle-directory-does-not-exist':
			return (
				<p className={css.errorLead}>
					It seems like the local directory backing this site was
					removed. This Playground copy will not load anymore.
				</p>
			);
		case 'github-artifact-expired':
			return (
				<p className={css.errorLead}>
					GitHub only keeps pull-request build artifacts for a limited
					time. Re-run the workflow or restart without that PR.
				</p>
			);
		case 'blueprint-fetch-failed': {
			const blueprintUrl = getBlueprintSourceUrl(site);
			return (
				<>
					<p className={css.errorLead}>
						Playground couldn’t download the Blueprint file. Make
						sure the file is reachable, responds with valid JSON or
						a blueprint.zip archive, and is still available at the
						link before trying again.
					</p>
					{blueprintUrl ? (
						<p>
							Blueprint URL:{' '}
							<a
								className={css.errorLink}
								href={blueprintUrl}
								target="_blank"
								rel="noopener noreferrer"
							>
								{blueprintUrl}
							</a>
						</p>
					) : null}
					<p>
						<a
							target="_blank"
							rel="noopener noreferrer"
							href="https://wordpress.github.io/wordpress-playground/blueprints/troubleshoot-and-debug"
						>
							Troubleshoot Blueprint loading issues ↗
						</a>
					</p>
				</>
			);
		}
		case 'blueprint-filesystem-required':
			return (
				<>
					<p className={css.errorLead}>
						This Blueprint expects bundled files (plugins, media,
						etc.), but no filesystem was provided.
					</p>
					<ul className={css.errorList}>
						<li>Ensure you are loading a blueprint.zip bundle.</li>
						<li>
							Confirm that referenced files exist next to the
							Blueprint.
						</li>
					</ul>
					<p>
						<a
							target="_blank"
							rel="noopener noreferrer"
							href="https://wordpress.github.io/wordpress-playground/blueprints/data-format#resources"
						>
							Learn how Blueprint resources work ↗
						</a>
					</p>
				</>
			);
		case 'blueprint-validation-failed':
			return (
				<>
					<p className={css.errorLead}>
						The Blueprint does not conform to the required JSON
						schema. Fix the validation output and retry.
					</p>
					<p>
						<a
							target="_blank"
							rel="noopener noreferrer"
							href="https://wordpress.github.io/wordpress-playground/blueprints/data-format"
						>
							Review the Blueprint data format ↗
						</a>
					</p>
				</>
			);
		case 'directory-handle-unknown-error':
			return (
				<p className={css.errorLead}>
					The browser could no longer access your local directory
					handle. Re-importing the folder will be necessary to
					continue.
				</p>
			);
		case 'site-boot-failed':
		default:
			if (blueprintStepError) {
				return null;
			}
			return (
				<p className={css.errorLead}>
					Something unexpected interrupted the boot process. Reload
					the tab or spin up a new site.
				</p>
			);
	}
}

function BlueprintStepErrorDetails({
	stepError,
}: {
	stepError: BlueprintStepError;
}) {
	return (
		<div className={css.stepError}>
			<div className={css.stepErrorHeader}>
				<p className={css.stepErrorTitle}>
					Blueprint failed at step #{stepError.stepNumber}: Could not{' '}
					{stepError.description}.
				</p>
			</div>
			{stepError.messages.length > 0 &&
				stepError.messages.map((line, index) => (
					<p key={index} className={css.stepErrorMessage}>
						{line}
					</p>
				))}
			<div className={css.stepErrorCodeWrapper}>
				<div className={css.stepErrorLabel}>Step definition</div>
				<pre className={css.stepErrorCode}>{stepError.stepJson}</pre>
			</div>
		</div>
	);
}

function getErrorActions(
	error: SiteError,
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
			return [
				<Button
					variant="primary"
					key="try-again"
					onClick={helpers.reload}
				>
					Try again
				</Button>,
			];
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

function extractBlueprintStepError(
	errorDetails?: SerializedSiteErrorDetails
): BlueprintStepError | undefined {
	const baseMessage =
		typeof errorDetails === 'string' ? errorDetails : errorDetails?.message;
	if (
		!baseMessage ||
		!baseMessage.startsWith('Error when executing the blueprint step #')
	) {
		return undefined;
	}

	const indexMatch = baseMessage.match(
		/^Error when executing the blueprint step #(\d+)/
	);
	if (!indexMatch) {
		return undefined;
	}

	const firstParen = baseMessage.indexOf('(');
	if (firstParen === -1) {
		return undefined;
	}

	let closingParen = -1;
	let parsedStep: Record<string, unknown> | undefined;
	let stepJson = '';

	for (let i = firstParen + 1; i < baseMessage.length; i++) {
		if (baseMessage[i] !== ')') {
			continue;
		}
		const candidateJson = baseMessage.slice(firstParen + 1, i).trim();
		try {
			parsedStep = JSON.parse(candidateJson);
			stepJson = JSON.stringify(parsedStep, null, 2);
			closingParen = i;
			break;
		} catch {
			continue;
		}
	}

	if (!parsedStep || closingParen === -1) {
		return undefined;
	}

	const remainder = baseMessage
		.slice(closingParen + 1)
		.replace(/^\s*:\s*/, '')
		.trim();
	const messages = remainder
		? remainder
				.split(/\n+/)
				.map((line) => line.trim())
				.filter(Boolean)
		: [];

	return {
		stepNumber: Number(indexMatch[1]),
		step: parsedStep,
		stepJson,
		description: describeBlueprintStepAction(parsedStep),
		messages,
		rawMessage: baseMessage,
	};
}

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

function humanizeStepName(stepName: string): string {
	const spaced = stepName.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
	return spaced.charAt(0).toLowerCase() + spaced.slice(1);
}

function getBlueprintSourceUrl(site?: SiteInfo): string | undefined {
	const source = site?.metadata?.originalBlueprintSource;
	return source?.type === 'remote-url' ? source.url : undefined;
}

function formatErrorDetails(
	errorDetails?: SerializedSiteErrorDetails,
	messageToOmit?: string
): string | undefined {
	if (!errorDetails) {
		return undefined;
	}
	if (typeof errorDetails === 'string') {
		const trimmed = errorDetails.trim();
		if (messageToOmit && trimmed.startsWith(messageToOmit)) {
			const remainder = trimmed.slice(messageToOmit.length).trim();
			return remainder || undefined;
		}
		return trimmed;
	}
	let message = errorDetails.message;
	if (message && messageToOmit && message.startsWith(messageToOmit)) {
		message = message.slice(messageToOmit.length).trim();
	}
	return [errorDetails.name, message, errorDetails.stack]
		.filter(Boolean)
		.join('\n\n');
}
