import React from 'react';
import css from '../playground-viewport/style.module.css';
import type { SiteError } from '../../lib/state/redux/slice-ui';
import type { SiteInfo } from '../../lib/state/redux/slice-sites';
import type { BlueprintStepError } from './types';
import { getBlueprintSourceUrl } from './helpers';

interface Props {
	error: SiteError;
	site: SiteInfo;
	blueprintStepError?: BlueprintStepError;
}

export function ErrorCopy({ error, site, blueprintStepError }: Props) {
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
						This Blueprint references bundled files via{' '}
						<code>"resource": "bundled"</code>, but it was loaded as
						a standalone JSON file.
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
