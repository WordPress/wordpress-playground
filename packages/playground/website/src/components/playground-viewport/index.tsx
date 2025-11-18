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

type ErrorPresentation = {
	title: string;
	intro?: React.ReactNode;
	list?: React.ReactNode[];
	body?: React.ReactNode;
	detailsSummary?: string;
	actions?: React.ReactNode[];
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
	const detailText = formatErrorDetails(errorDetails);
	const isDeveloperError = developerErrorTypes.has(error);
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

	const presentation = getErrorPresentation({
		error,
		site,
		helpers,
	});

	const showActionBar = Boolean(
		presentation.actions?.length || !isDeveloperError
	);

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
						{presentation.title}
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
					{presentation.intro ? (
						<p className={css.errorLead}>{presentation.intro}</p>
					) : null}
					{presentation.list ? (
						<ul className={css.errorList}>
							{presentation.list.map((item, index) => (
								<li key={index}>{item}</li>
							))}
						</ul>
					) : null}
					{presentation.body}
					{detailText ? (
						<details
							className={css.errorDetails}
							open={isDeveloperError}
						>
							<summary>
								{presentation.detailsSummary ||
									(isDeveloperError
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
							presentation.actions?.map((action, index) => (
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

function getErrorPresentation({
	error,
	site,
	helpers,
}: {
	error: SiteError;
	site: SiteInfo;
	helpers: PresentationHelpers;
}): ErrorPresentation {
	switch (error) {
		case 'directory-handle-not-found-in-indexeddb':
		case 'directory-handle-permission-denied':
			return {
				title: 'Local directory permissions expired',
				intro: 'The browser no longer lets Playground access your previously shared local directory.',
				list: [
					'Re-selecting the directory is not supported yet.',
					<>
						Need urgent access? Let us know on{' '}
						<a
							target="_blank"
							rel="noopener noreferrer"
							href="https://github.com/WordPress/wordpress-playground/issues/1746"
						>
							GitHub
						</a>
						.
					</>,
				],
			};
		case 'directory-handle-directory-does-not-exist':
			return {
				title: 'Local directory was deleted',
				intro: 'It seems like the local directory backing this site was removed. This Playground copy will not load anymore.',
				actions: [
					<Button
						variant="primary"
						key="delete-site"
						onClick={helpers.deleteSite}
					>
						Delete this site and try again
					</Button>,
				],
			};
		case 'github-artifact-expired':
			return {
				title: 'This GitHub artifact expired',
				intro: 'GitHub only keeps pull-request build artifacts for a limited time. Re-run the workflow or restart without that PR.',
				actions: [
					<Button
						variant="primary"
						key="restart-pr"
						onClick={helpers.restartWithoutPr}
					>
						Restart without that PR
					</Button>,
				],
			};
		case 'blueprint-fetch-failed':
			return {
				title: 'Blueprint could not be loaded',
				intro: 'Double-check the Blueprint URL and hosting setup before trying again.',
				list: [
					'The Blueprint URL might be wrong or the file is unreachable.',
					'CORS might be blocking the request.',
					'The file must be valid JSON or blueprint.zip.',
				],
				body: (
					<p>
						<a
							target="_blank"
							rel="noopener noreferrer"
							href="https://wordpress.github.io/wordpress-playground/blueprints/troubleshoot-and-debug"
						>
							Troubleshoot Blueprint loading issues ↗
						</a>
					</p>
				),
				actions: [
					<Button
						variant="primary"
						key="start-without-blueprint"
						onClick={() => helpers.startWithoutBlueprint()}
						isBusy={helpers.startWithoutBlueprintBusy}
						disabled={helpers.startWithoutBlueprintBusy}
					>
						Start without a Blueprint
					</Button>,
				],
				detailsSummary: 'Network error details',
			};
		case 'blueprint-filesystem-required':
			return {
				title: 'Blueprint resources need a filesystem',
				intro: 'This Blueprint expects bundled files (plugins, media, etc.), but no filesystem was provided.',
				list: [
					'Ensure you are loading a blueprint.zip bundle.',
					'Confirm that referenced files exist next to the Blueprint.',
				],
				body: (
					<p>
						<a
							target="_blank"
							rel="noopener noreferrer"
							href="https://wordpress.github.io/wordpress-playground/blueprints/data-format#resources"
						>
							Learn how Blueprint resources work ↗
						</a>
					</p>
				),
				actions: [
					<Button
						variant="primary"
						key="try-again"
						onClick={helpers.reload}
					>
						Try again
					</Button>,
				],
				detailsSummary: 'Resource loader details',
			};
		case 'blueprint-validation-failed':
			return {
				title: 'Blueprint validation error',
				intro: 'The Blueprint does not conform to the required JSON schema. Fix the validation output and retry.',
				body: (
					<p>
						<a
							target="_blank"
							rel="noopener noreferrer"
							href="https://wordpress.github.io/wordpress-playground/blueprints/data-format"
						>
							Review the Blueprint data format ↗
						</a>
					</p>
				),
				actions: [
					<Button
						variant="primary"
						key="start-without-blueprint-invalid"
						onClick={() => helpers.startWithoutBlueprint()}
						isBusy={helpers.startWithoutBlueprintBusy}
						disabled={helpers.startWithoutBlueprintBusy}
					>
						Start without a Blueprint
					</Button>,
				],
				detailsSummary: 'Validation output',
			};
		case 'directory-handle-unknown-error':
			return {
				title: 'The local directory became unavailable',
				intro: 'The browser could no longer access your local directory handle. Re-importing the folder will be necessary to continue.',
			};
		case 'site-boot-failed':
		default:
			return {
				title: `Playground crashed`,
				intro: 'Something unexpected interrupted the boot process. Reload the tab or spin up a new site.',
				actions: [
					<Button
						variant="primary"
						key="reload-tab"
						onClick={helpers.reload}
					>
						Reload Fresh Playground
					</Button>,
				],
			};
	}
}

function formatErrorDetails(
	errorDetails?: SerializedSiteErrorDetails
): string | undefined {
	if (!errorDetails) {
		return undefined;
	}
	if (typeof errorDetails === 'string') {
		return errorDetails;
	}
	return [errorDetails.name, errorDetails.message, errorDetails.stack]
		.filter(Boolean)
		.join('\n\n');
}
