import { Button } from '@wordpress/components';
import { Icon, chevronLeft, download, link } from '@wordpress/icons';
import { zipWpContent } from '@wp-playground/client';
import saveAs from 'file-saver';
import { lazy, Suspense, useState } from 'react';
import { useAppSelector } from '../../../lib/state/redux/store';
import { usePlaygroundClient } from '../../../lib/use-playground-client';
import { GitHubIcon } from '../../../github/github';
import { Spinner } from '../../spinner';
import type { ExportFormValues } from '../../../github/github-export-form/form';
import css from './style.module.css';

// The export form pulls in the GitHub/storage stack, so load it only when the
// user actually opens it.
const GitHubExportForm = lazy(
	() => import('../../../github/github-export-form/form')
);

export function SiteSharePanel() {
	const offline = useAppSelector((state) => state.ui.offline);
	const playground = usePlaygroundClient();
	const [isDownloading, setIsDownloading] = useState(false);
	const [linkCopied, setLinkCopied] = useState(false);
	const [showGitHubExport, setShowGitHubExport] = useState(false);
	// Remember the form values so collapsing and reopening the export doesn't
	// wipe the repo URL the user already typed.
	const [exportValues, setExportValues] = useState<
		Partial<ExportFormValues> | undefined
	>();
	const disabled = !playground;

	const copyLink = async () => {
		try {
			await navigator.clipboard.writeText(window.location.href);
			setLinkCopied(true);
			setTimeout(() => setLinkCopied(false), 2000);
		} catch {
			// Clipboard can be blocked; fail quietly rather than alerting.
		}
	};

	const downloadZip = async () => {
		if (!playground) {
			return;
		}
		setIsDownloading(true);
		try {
			const bytes = await zipWpContent(playground, {
				selfContained: true,
			});
			saveAs(new File([bytes], 'wordpress-playground.zip'));
		} finally {
			setIsDownloading(false);
		}
	};

	// The GitHub export runs inline as a sub-view of this pane (no modal).
	if (showGitHubExport && playground) {
		return (
			<section className={css.sharePanel}>
				<button
					type="button"
					className={css.backButton}
					onClick={() => setShowGitHubExport(false)}
				>
					<Icon icon={chevronLeft} size={24} />
					Export to GitHub
				</button>
				<Suspense
					fallback={
						<div className={css.exportLoading}>
							<Spinner />
						</div>
					}
				>
					<GitHubExportForm
						playground={playground}
						onClose={() => setShowGitHubExport(false)}
						onExported={(_prUrl, formValues) =>
							setExportValues(formValues)
						}
						initialValues={exportValues}
					/>
				</Suspense>
			</section>
		);
	}

	return (
		<section className={css.sharePanel}>
			<div className={css.group}>
				<span className={css.groupIcon} aria-hidden="true">
					<Icon icon={download} size={22} />
				</span>
				<div className={css.groupBody}>
					<h3 className={css.groupTitle}>Download a copy</h3>
					<p className={css.hint}>
						Saves everything as it is right now — files, database,
						and your edits — to a .zip you can re-import later.
					</p>
					<div className={css.actions}>
						<Button
							variant="primary"
							data-cy="download-as-zip"
							disabled={disabled || isDownloading}
							onClick={downloadZip}
						>
							{isDownloading
								? 'Preparing .zip…'
								: 'Download as .zip'}
						</Button>
					</div>
				</div>
			</div>
			<div className={css.group}>
				<span className={css.groupIcon} aria-hidden="true">
					<Icon icon={link} size={22} />
				</span>
				<div className={css.groupBody}>
					<h3 className={css.groupTitle}>Share a link</h3>
					<p className={css.hint}>
						Copies a URL that rebuilds this Playground from its
						original Blueprint on any device. It restores the
						starting setup only — your edits to files and content
						aren&apos;t included.
					</p>
					<div className={css.actions}>
						<Button variant="secondary" onClick={copyLink}>
							{linkCopied ? 'Link copied' : 'Copy link'}
						</Button>
					</div>
				</div>
			</div>
			<div className={css.group}>
				<span className={css.groupIcon} aria-hidden="true">
					<Icon icon={GitHubIcon} size={22} />
				</span>
				<div className={css.groupBody}>
					<h3 className={css.groupTitle}>Export to GitHub</h3>
					<p className={css.hint}>
						Pushes the current state — including your edits — to a
						GitHub repository.
					</p>
					<div className={css.actions}>
						<Button
							variant="secondary"
							disabled={offline || disabled}
							onClick={() => setShowGitHubExport(true)}
						>
							Export to GitHub
						</Button>
					</div>
				</div>
			</div>
		</section>
	);
}
