import { Button } from '@wordpress/components';
import { Icon, download, link } from '@wordpress/icons';
import { zipWpContent } from '@wp-playground/client';
import saveAs from 'file-saver';
import { useState } from 'react';
import { modalSlugs, setActiveModal } from '../../../lib/state/redux/slice-ui';
import { useAppDispatch, useAppSelector } from '../../../lib/state/redux/store';
import { usePlaygroundClient } from '../../../lib/use-playground-client';
import { GitHubIcon } from '../../../github/github';
import css from './style.module.css';

export function SiteSharePanel() {
	const dispatch = useAppDispatch();
	const offline = useAppSelector((state) => state.ui.offline);
	const playground = usePlaygroundClient();
	const [isDownloading, setIsDownloading] = useState(false);
	const [linkCopied, setLinkCopied] = useState(false);
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
					{GitHubIcon}
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
							onClick={() =>
								dispatch(
									setActiveModal(modalSlugs.GITHUB_EXPORT)
								)
							}
						>
							Export to GitHub
						</Button>
					</div>
				</div>
			</div>
		</section>
	);
}
