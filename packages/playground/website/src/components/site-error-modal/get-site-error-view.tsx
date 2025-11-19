import React from 'react';
import { Button } from '@wordpress/components';
import css from './style.module.css';
import type { SiteError } from '../../lib/state/redux/slice-ui';
import type { SiteInfo } from '../../lib/state/redux/slice-sites';
import type { BlueprintStepError, PresentationHelpers } from './types';
import { BlueprintStepErrorDetails } from './blueprint-step-error-details';

export interface SiteErrorViewContext {
	error: SiteError;
	site: SiteInfo;
	blueprintStepError?: BlueprintStepError;
	helpers: PresentationHelpers;
}

export interface SiteErrorViewConfig {
	title: string;
	isDeveloperError: boolean;
	detailSummaryOverride?: string;
	body: React.ReactNode;
	actions: React.ReactNode[];
}

export function getSiteErrorView(
	context: SiteErrorViewContext
): SiteErrorViewConfig {
	const { error, blueprintStepError } = context;

	if (blueprintStepError) {
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
