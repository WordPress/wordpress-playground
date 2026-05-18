import React from 'react';
import { Button } from '@wordpress/components';
import { createInterpolateElement } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import css from './style.module.css';
import type { SiteError } from '../../lib/state/redux/slice-ui';
import type { SiteInfo } from '../../lib/state/redux/slice-sites';
import type { BlueprintStepError, PresentationHelpers } from './types';
import { BlueprintStepErrorDetails } from './blueprint-step-error-details';
// @ts-ignore
import { corsProxyUrl } from 'virtual:cors-proxy-url';

export interface SiteErrorViewContext {
	error: SiteError;
	site: SiteInfo;
	blueprintStepError?: BlueprintStepError;
	helpers: PresentationHelpers;
	errorDetails?: unknown;
}

export interface SiteErrorViewConfig {
	title: string;
	isDeveloperError: boolean;
	detailSummaryOverride?: string;
	hideReportButton?: boolean;
	hideTroubleshootWithAiButton?: boolean;
	body: React.ReactNode;
	actions: React.ReactNode[];
}

export function getSiteErrorView(
	context: SiteErrorViewContext
): SiteErrorViewConfig {
	const { error, blueprintStepError } = context;

	// Show specific error views for certain error types, even if they occurred
	// during a blueprint step. These errors have dedicated user-friendly views
	// that provide better guidance than the generic step error view.
	if (
		blueprintStepError &&
		error !== 'network-firewall-interference' &&
		error !== 'resource-download-failed'
	) {
		return blueprintStepExecutionView(context);
	}

	switch (error) {
		case 'directory-handle-not-found-in-indexeddb':
		case 'directory-handle-permission-denied':
			return directoryHandlePermissionsExpiredView();
		case 'directory-handle-directory-does-not-exist':
			return directoryHandleDeletedView();
		case 'github-artifact-expired':
			return githubArtifactExpiredView(context);
		case 'blueprint-fetch-failed':
			return blueprintFetchFailedView(context);
		case 'blueprint-filesystem-required':
			return blueprintFilesystemRequiredView(context);
		case 'blueprint-validation-failed':
			return blueprintValidationFailedView(context);
		case 'directory-handle-unknown-error':
			return directoryHandleUnknownErrorView();
		case 'network-firewall-interference':
			return networkFirewallInterferenceView(context);
		case 'resource-download-failed':
			return resourceDownloadFailedView();
		case 'site-boot-failed':
		default:
			return genericSiteBootFailedView(context);
	}
}

function directoryHandlePermissionsExpiredView(): SiteErrorViewConfig {
	return {
		title: __('Local directory permissions expired', 'playground-website'),
		isDeveloperError: false,
		body: (
			<>
				<p className={css.errorLead}>
					{__(
						'The browser no longer lets Playground access your previously shared local directory.',
						'playground-website'
					)}
				</p>
				<ul className={css.errorList}>
					<li>
						{__(
							'Re-selecting the directory is not supported yet.',
							'playground-website'
						)}
					</li>
					<li>
						{createInterpolateElement(
							__(
								'Need urgent access? Let us know on <githubLink>GitHub</githubLink>.',
								'playground-website'
							),
							{
								githubLink: (
									<a
										aria-label={__(
											'GitHub',
											'playground-website'
										)}
										target="_blank"
										rel="noopener noreferrer"
										href="https://github.com/WordPress/wordpress-playground/issues/1746"
									/>
								),
							}
						)}
					</li>
				</ul>
			</>
		),
		actions: [],
		detailSummaryOverride: undefined,
	};
}

function directoryHandleDeletedView(): SiteErrorViewConfig {
	return {
		title: __('Local directory was deleted', 'playground-website'),
		isDeveloperError: false,
		body: (
			<p className={css.errorLead}>
				{__(
					'It seems like the local directory backing this site was removed. This Playground copy will not load anymore.',
					'playground-website'
				)}
			</p>
		),
		actions: [],
		detailSummaryOverride: undefined,
	};
}

function githubArtifactExpiredView({
	helpers,
}: SiteErrorViewContext): SiteErrorViewConfig {
	return {
		title: __('This GitHub artifact expired', 'playground-website'),
		isDeveloperError: false,
		body: (
			<p className={css.errorLead}>
				{__(
					'GitHub only keeps pull-request build artifacts for a limited time. Re-run the workflow or restart without that PR.',
					'playground-website'
				)}
			</p>
		),
		actions: [
			<Button
				variant="primary"
				key="restart-pr"
				onClick={helpers.restartWithoutPr}
			>
				{__('Restart without that PR', 'playground-website')}
			</Button>,
		],
		detailSummaryOverride: undefined,
	};
}

function blueprintFetchFailedView({
	site,
	helpers,
}: SiteErrorViewContext): SiteErrorViewConfig {
	const blueprintUrl = getBlueprintSourceUrl(site);
	return {
		title: __('Blueprint could not be loaded', 'playground-website'),
		isDeveloperError: true,
		detailSummaryOverride: __(
			'Network error details',
			'playground-website'
		),
		body: (
			<>
				<p className={css.errorLead}>
					{__(
						"Playground couldn't download the Blueprint file. Make sure the file is reachable, responds with valid JSON or a blueprint.zip archive, and is still available at the link before trying again.",
						'playground-website'
					)}
				</p>
				{blueprintUrl ? (
					<p>
						{__('Blueprint URL:', 'playground-website')}{' '}
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
						{__(
							'Troubleshoot Blueprint loading issues',
							'playground-website'
						)}
					</a>
				</p>
			</>
		),
		actions: [
			<Button
				variant="primary"
				key="start-without-blueprint"
				onClick={helpers.reloadWithoutBlueprint}
			>
				{__('Start without a Blueprint', 'playground-website')}
			</Button>,
		],
	};
}

function blueprintFilesystemRequiredView({
	helpers,
}: SiteErrorViewContext): SiteErrorViewConfig {
	return {
		title: __(
			'Bundled resources used outside of a Blueprint bundle',
			'playground-website'
		),
		isDeveloperError: true,
		detailSummaryOverride: __(
			'Resource loader details',
			'playground-website'
		),
		body: (
			<>
				<p className={css.errorLead}>
					{__(
						'This Blueprint references bundled files via',
						'playground-website'
					)}{' '}
					<code>"resource": "bundled"</code>,{' '}
					{__(
						'but it was loaded as a standalone JSON file.',
						'playground-website'
					)}
				</p>
				<ul className={css.errorList}>
					<li>
						{__(
							'Ensure you are loading a Blueprint bundle (for example, a blueprint.zip file or a URL).',
							'playground-website'
						)}
					</li>
					<li>
						{__(
							'Confirm that referenced files exist next to the blueprint.json file inside the bundle.',
							'playground-website'
						)}
					</li>
				</ul>
				<p>
					<a
						target="_blank"
						rel="noopener noreferrer"
						href="https://wordpress.github.io/wordpress-playground/blueprints/bundles"
					>
						{__(
							'Learn how Blueprint Bundles work',
							'playground-website'
						)}
					</a>
				</p>
			</>
		),
		actions: [
			<Button
				variant="primary"
				key="start-without-blueprint-invalid"
				onClick={helpers.reloadWithoutBlueprint}
			>
				{__('Start without a Blueprint', 'playground-website')}
			</Button>,
		],
	};
}

function blueprintValidationFailedView({
	helpers,
}: SiteErrorViewContext): SiteErrorViewConfig {
	return {
		title: __('Blueprint validation error', 'playground-website'),
		isDeveloperError: true,
		detailSummaryOverride: __('Validation output', 'playground-website'),
		body: (
			<>
				<p className={css.errorLead}>
					{__(
						'The Blueprint does not conform to the required JSON schema. Fix the validation output and retry.',
						'playground-website'
					)}
				</p>
				<p>
					<a
						target="_blank"
						rel="noopener noreferrer"
						href="https://wordpress.github.io/wordpress-playground/blueprints/data-format"
					>
						{__(
							'Review the Blueprint data format',
							'playground-website'
						)}
					</a>
				</p>
			</>
		),
		actions: [
			<Button
				variant="primary"
				key="start-without-blueprint-invalid"
				onClick={helpers.reloadWithoutBlueprint}
			>
				{__('Start without a Blueprint', 'playground-website')}
			</Button>,
		],
	};
}

function directoryHandleUnknownErrorView(): SiteErrorViewConfig {
	return {
		title: __(
			'The local directory became unavailable',
			'playground-website'
		),
		isDeveloperError: false,
		detailSummaryOverride: undefined,
		body: (
			<p className={css.errorLead}>
				{__(
					'The browser could no longer access your local directory handle. Re-importing the folder will be necessary to continue.',
					'playground-website'
				)}
			</p>
		),
		actions: [],
	};
}

/**
 * Extract the target URL that Playground was trying to fetch from the error details.
 * This is the original URL (e.g., a plugin download), not the CORS proxy URL.
 *
 * First checks for a structured `url` property on the error object (preferred),
 * then falls back to pattern matching in the error message.
 */
function extractTargetUrl(errorDetails: unknown): string | undefined {
	if (!errorDetails || typeof errorDetails !== 'object') {
		return undefined;
	}

	const details = errorDetails as Record<string, unknown>;

	// Prefer the structured url property if available
	if (typeof details.url === 'string' && details.url) {
		return details.url;
	}

	// Fall back to pattern matching in the message for backwards compatibility
	const message = (details.rawMessage || details.message || '') as string;

	// "Could not fetch {url}" from FirewallInterferenceError
	const fetchMatch = message.match(/Could not fetch ([^\s]+)/);
	if (fetchMatch) {
		return fetchMatch[1];
	}

	// "Could not download "{url}"" from resource fetching
	const downloadMatch = message.match(/Could not download "([^"]+)"/);
	if (downloadMatch) {
		return downloadMatch[1];
	}

	return undefined;
}

function networkFirewallInterferenceView({
	helpers,
	errorDetails,
}: SiteErrorViewContext): SiteErrorViewConfig {
	// The target URL is what Playground was trying to download (e.g., a plugin)
	const targetUrl = extractTargetUrl(errorDetails);

	// The CORS proxy is what's actually being blocked - all external requests
	// go through it due to browser security restrictions
	let corsProxyHost: string | undefined;
	let testUrl: string | undefined;
	try {
		corsProxyHost = new URL(corsProxyUrl).hostname;
		testUrl = `${corsProxyUrl}https://wordpress.org`;
	} catch {
		// corsProxyUrl might be a relative URL
	}

	const effectiveTargetUrl = targetUrl
		? corsProxyUrl
			? `${corsProxyUrl}?${encodeURIComponent(targetUrl)}`
			: targetUrl
		: undefined;
	let effectiveTargetHost: string | undefined;
	try {
		if (effectiveTargetUrl) {
			effectiveTargetHost = new URL(effectiveTargetUrl).hostname;
		}
	} catch {
		// Invalid URL
	}

	return {
		title: __('Network blocked this request', 'playground-website'),
		isDeveloperError: false,
		hideReportButton: true,
		detailSummaryOverride: __('Technical details', 'playground-website'),
		body: (
			<>
				<p>
					<strong style={{ fontWeight: 'bold' }}>
						{effectiveTargetHost
							? createInterpolateElement(
									sprintf(
										__(
											"Playground couldn't download a file from <host>%s</host>.",
											'playground-website'
										),
										effectiveTargetHost
									),
									{
										host: <code />,
									}
								)
							: __(
									"Playground couldn't download a file.",
									'playground-website'
								)}
					</strong>{' '}
					{__(
						'Your network appears to be blocking the request.',
						'playground-website'
					)}
				</p>

				<p>
					{corsProxyHost
						? createInterpolateElement(
								sprintf(
									__(
										'Playground runs entirely in your browser. To download plugins, themes, and other files, it routes requests through a CORS proxy server at <host>%s</host>. Your network seems to be blocking this proxy, a common issue on school, university, and corporate networks.',
										'playground-website'
									),
									corsProxyHost
								),
								{
									host: <code />,
								}
							)
						: __(
								'Playground runs entirely in your browser. To download plugins, themes, and other files, it routes requests through a CORS proxy server. Your network seems to be blocking this proxy, a common issue on school, university, and corporate networks.',
								'playground-website'
							)}
				</p>

				<p>
					<strong style={{ fontWeight: 'bold' }}>
						{__(
							'Verify this is a network issue',
							'playground-website'
						)}
					</strong>
				</p>
				<p>
					{__(
						'Try opening this link in a new browser tab:',
						'playground-website'
					)}
				</p>
				<p>
					<a href={testUrl} target="_blank" rel="noopener noreferrer">
						{testUrl}
					</a>
				</p>

				<ul className={css.errorList}>
					<li>
						<strong style={{ fontWeight: 'bold' }}>
							{__('Link fails to load?', 'playground-website')}
						</strong>{' '}
						{__(
							'Your network is blocking the proxy. Try a different network (mobile data, personal Wi-Fi), use a VPN, or contact your IT administrator.',
							'playground-website'
						)}
					</li>
					<li>
						<strong style={{ fontWeight: 'bold' }}>
							{__('Link works fine?', 'playground-website')}
						</strong>{' '}
						{createInterpolateElement(
							__(
								'This might be a bug in Playground. Please <githubIssueLink>open an issue on GitHub</githubIssueLink> so we can investigate.',
								'playground-website'
							),
							{
								githubIssueLink: (
									<a
										aria-label={__(
											'open an issue on GitHub',
											'playground-website'
										)}
										href="https://github.com/WordPress/wordpress-playground/issues/new"
										target="_blank"
										rel="noopener noreferrer"
									/>
								),
							}
						)}
					</li>
				</ul>

				<p>
					<strong style={{ fontWeight: 'bold' }}>
						{__('For IT administrators', 'playground-website')}
					</strong>
				</p>
				<p>
					{__(
						'Allow outbound HTTPS requests to',
						'playground-website'
					)}{' '}
					<code>
						{corsProxyHost ||
							__('the CORS proxy domain', 'playground-website')}
					</code>
					{window.location.hostname !== corsProxyHost && (
						<>
							{' '}
							{__('and', 'playground-website')}{' '}
							<code>{window.location.hostname}</code>
						</>
					)}
					.
				</p>
			</>
		),
		actions: [
			<Button
				variant="secondary"
				key="retry"
				onClick={() => window.location.reload()}
			>
				{__('Retry', 'playground-website')}
			</Button>,
			<Button
				variant="primary"
				key="start-without-blueprint"
				onClick={helpers.reloadWithoutBlueprint}
			>
				{__('Start without a Blueprint', 'playground-website')}
			</Button>,
		],
	};
}

function resourceDownloadFailedView(): SiteErrorViewConfig {
	return {
		title: __('Could not download required files', 'playground-website'),
		isDeveloperError: false,
		hideReportButton: true,
		hideTroubleshootWithAiButton: true,
		detailSummaryOverride: __('Technical details', 'playground-website'),
		body: (
			<>
				<p className={css.errorLead}>
					{__(
						'Playground could not download one or more files it needs to run. This is usually caused by a network problem.',
						'playground-website'
					)}
				</p>
				<ul className={css.errorList}>
					<li>
						{__(
							'Check your internet connection and try again.',
							'playground-website'
						)}
					</li>
					<li>
						{__(
							'A firewall, proxy, or VPN may be blocking the download.',
							'playground-website'
						)}
					</li>
					<li>
						{__(
							'Browser extensions such as ad blockers can sometimes interfere with downloads.',
							'playground-website'
						)}
					</li>
				</ul>
			</>
		),
		actions: [
			<Button
				variant="primary"
				key="reload"
				onClick={() => window.location.reload()}
			>
				{__('Reload page', 'playground-website')}
			</Button>,
		],
	};
}

function genericSiteBootFailedView({
	blueprintStepError,
	helpers,
}: SiteErrorViewContext): SiteErrorViewConfig {
	// If we have a Blueprint step error, the dedicated view will have been used.
	if (blueprintStepError) {
		return blueprintStepExecutionView({
			error: 'site-boot-failed',
			site: {} as SiteInfo,
			blueprintStepError,
			helpers,
		});
	}

	return {
		title: __('Playground crashed', 'playground-website'),
		isDeveloperError: false,
		detailSummaryOverride: undefined,
		body: (
			<p className={css.errorLead}>
				{__(
					'Something unexpected interrupted the boot process. Reload the tab or spin up a new site.',
					'playground-website'
				)}
			</p>
		),
		actions: [
			<Button
				variant="primary"
				key="reload-tab"
				onClick={helpers.reloadWithoutBlueprint}
			>
				{__('Reload Fresh Playground', 'playground-website')}
			</Button>,
		],
	};
}

function blueprintStepExecutionView({
	blueprintStepError,
}: SiteErrorViewContext): SiteErrorViewConfig {
	if (!blueprintStepError) {
		return {
			title: __('Blueprint execution failed', 'playground-website'),
			isDeveloperError: true,
			detailSummaryOverride: __(
				'Blueprint error details',
				'playground-website'
			),
			body: null,
			actions: [],
		};
	}

	return {
		title: __('Blueprint execution failed', 'playground-website'),
		isDeveloperError: true,
		detailSummaryOverride: __(
			'Blueprint error details',
			'playground-website'
		),
		body: <BlueprintStepErrorDetails stepError={blueprintStepError} />,
		actions: [
			// Default action is handled by the generic reload button in the footer.
		],
	};
}

/**
 * Extract the source URL of the Blueprint from the site metadata.
 *
 * @param site - The site metadata.
 * @returns The source URL of the Blueprint.
 */
export function getBlueprintSourceUrl(site?: SiteInfo): string | undefined {
	const source = site?.metadata?.originalBlueprintSource;
	if (source?.type !== 'remote-url') {
		return undefined;
	}
	try {
		const url = new URL(source.url);
		if (url.searchParams.has('blueprint-url')) {
			return url.searchParams.get('blueprint-url') || undefined;
		}
		return source.url;
	} catch {
		return undefined;
	}
}
