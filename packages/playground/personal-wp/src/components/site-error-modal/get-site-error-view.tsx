import React from 'react';
import { Button } from '@wordpress/components';
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
		title: 'Local directory permissions expired',
		isDeveloperError: false,
		body: (
			<>
				<p className={css.errorLead}>
					The browser no longer lets Playground access your previously
					shared local directory.
				</p>
				<ul className={css.errorList}>
					<li>Re-selecting the directory is not supported yet.</li>
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
		),
		actions: [],
		detailSummaryOverride: undefined,
	};
}

function directoryHandleDeletedView(): SiteErrorViewConfig {
	return {
		title: 'Local directory was deleted',
		isDeveloperError: false,
		body: (
			<p className={css.errorLead}>
				It seems like the local directory backing this site was removed.
				This Playground copy will not load anymore.
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
		title: 'This GitHub artifact expired',
		isDeveloperError: false,
		body: (
			<p className={css.errorLead}>
				GitHub only keeps pull-request build artifacts for a limited
				time. Re-run the workflow or restart without that PR.
			</p>
		),
		actions: [
			<Button
				variant="primary"
				key="restart-pr"
				onClick={helpers.restartWithoutPr}
			>
				Restart without that PR
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
		title: 'Blueprint could not be loaded',
		isDeveloperError: true,
		detailSummaryOverride: 'Network error details',
		body: (
			<>
				<p className={css.errorLead}>
					Playground couldn’t download the Blueprint file. Make sure
					the file is reachable, responds with valid JSON or a
					blueprint.zip archive, and is still available at the link
					before trying again.
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
		),
		actions: [
			<Button
				variant="primary"
				key="start-without-blueprint"
				onClick={helpers.reloadWithoutBlueprint}
			>
				Start without a Blueprint
			</Button>,
		],
	};
}

function blueprintFilesystemRequiredView({
	helpers,
}: SiteErrorViewContext): SiteErrorViewConfig {
	return {
		title: 'Bundled resources used outside of a Blueprint bundle',
		isDeveloperError: true,
		detailSummaryOverride: 'Resource loader details',
		body: (
			<>
				<p className={css.errorLead}>
					This Blueprint references bundled files via{' '}
					<code>"resource": "bundled"</code>, but it was loaded as a
					standalone JSON file.
				</p>
				<ul className={css.errorList}>
					<li>
						Ensure you are loading a Blueprint bundle (e.g. a
						blueprint.zip file or a URL).
					</li>
					<li>
						Confirm that referenced files exist next to the
						blueprint.json file inside the bundle.
					</li>
				</ul>
				<p>
					<a
						target="_blank"
						rel="noopener noreferrer"
						href="https://wordpress.github.io/wordpress-playground/blueprints/bundles"
					>
						Learn how Blueprint Bundles work ↗
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
				Start without a Blueprint
			</Button>,
		],
	};
}

function blueprintValidationFailedView({
	helpers,
}: SiteErrorViewContext): SiteErrorViewConfig {
	return {
		title: 'Blueprint validation error',
		isDeveloperError: true,
		detailSummaryOverride: 'Validation output',
		body: (
			<>
				<p className={css.errorLead}>
					The Blueprint does not conform to the required JSON schema.
					Fix the validation output and retry.
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
		),
		actions: [
			<Button
				variant="primary"
				key="start-without-blueprint-invalid"
				onClick={helpers.reloadWithoutBlueprint}
			>
				Start without a Blueprint
			</Button>,
		],
	};
}

function directoryHandleUnknownErrorView(): SiteErrorViewConfig {
	return {
		title: 'The local directory became unavailable',
		isDeveloperError: false,
		detailSummaryOverride: undefined,
		body: (
			<p className={css.errorLead}>
				The browser could no longer access your local directory handle.
				Re-importing the folder will be necessary to continue.
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
		title: 'Network blocked this request',
		isDeveloperError: false,
		hideReportButton: true,
		detailSummaryOverride: 'Technical details',
		body: (
			<>
				<p>
					<strong style={{ fontWeight: 'bold' }}>
						Playground couldn't download a file
						{effectiveTargetHost && (
							<>
								{' '}
								from <code>{effectiveTargetHost}</code>
							</>
						)}
						.
					</strong>{' '}
					Your network appears to be blocking the request.
				</p>

				<p>
					Playground runs entirely in your browser. To download
					plugins, themes, and other files, it routes requests through
					a CORS proxy server
					{corsProxyHost && (
						<>
							{' '}
							at <code>{corsProxyHost}</code>
						</>
					)}
					. Your network seems to be blocking this proxy — a common
					issue on school, university, and corporate networks.
				</p>

				<p>
					<strong style={{ fontWeight: 'bold' }}>
						Verify this is a network issue
					</strong>
				</p>
				<p>Try opening this link in a new browser tab:</p>
				<p>
					<a href={testUrl} target="_blank" rel="noopener noreferrer">
						{testUrl}
					</a>
				</p>

				<ul className={css.errorList}>
					<li>
						<strong style={{ fontWeight: 'bold' }}>
							Link fails to load?
						</strong>{' '}
						Your network is blocking the proxy. Try a different
						network (mobile data, personal Wi-Fi), use a VPN, or
						contact your IT administrator.
					</li>
					<li>
						<strong style={{ fontWeight: 'bold' }}>
							Link works fine?
						</strong>{' '}
						This might be a bug in Playground. Please{' '}
						<a
							href="https://github.com/WordPress/wordpress-playground/issues/new"
							target="_blank"
							rel="noopener noreferrer"
						>
							open an issue on GitHub
						</a>{' '}
						so we can investigate.
					</li>
				</ul>

				<p>
					<strong style={{ fontWeight: 'bold' }}>
						For IT administrators
					</strong>
				</p>
				<p>
					Allow outbound HTTPS requests to{' '}
					<code>{corsProxyHost || 'the CORS proxy domain'}</code>
					{window.location.hostname !== corsProxyHost && (
						<>
							{' '}
							and <code>{window.location.hostname}</code>
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
				Retry
			</Button>,
			<Button
				variant="primary"
				key="start-without-blueprint"
				onClick={helpers.reloadWithoutBlueprint}
			>
				Start without a Blueprint
			</Button>,
		],
	};
}

function resourceDownloadFailedView(): SiteErrorViewConfig {
	return {
		title: 'Could not download required files',
		isDeveloperError: false,
		hideReportButton: true,
		hideTroubleshootWithAiButton: true,
		detailSummaryOverride: 'Technical details',
		body: (
			<>
				<p className={css.errorLead}>
					Your WordPress could not download one or more files it needs
					to run. This is usually caused by a network problem.
				</p>
				<ul className={css.errorList}>
					<li>Check your internet connection and try again.</li>
					<li>
						A firewall, proxy, or VPN may be blocking the download.
					</li>
					<li>
						Browser extensions such as ad blockers can sometimes
						interfere with downloads.
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
				Reload page
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
		title: 'Playground crashed',
		isDeveloperError: false,
		detailSummaryOverride: undefined,
		body: (
			<p className={css.errorLead}>
				Something unexpected interrupted the boot process. Reload the
				tab or spin up a new site.
			</p>
		),
		actions: [
			<Button
				variant="primary"
				key="reload-tab"
				onClick={helpers.reloadWithoutBlueprint}
			>
				Reload Fresh Playground
			</Button>,
		],
	};
}

function blueprintStepExecutionView({
	blueprintStepError,
}: SiteErrorViewContext): SiteErrorViewConfig {
	if (!blueprintStepError) {
		return {
			title: 'Blueprint execution failed',
			isDeveloperError: true,
			detailSummaryOverride: 'Blueprint error details',
			body: null,
			actions: [],
		};
	}

	return {
		title: 'Blueprint execution failed',
		isDeveloperError: true,
		detailSummaryOverride: 'Blueprint error details',
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
