import { Button } from '@wordpress/components';
import { zipWpContent } from '@wp-playground/client';
import saveAs from 'file-saver';
import { useState } from 'react';
import { modalSlugs, setActiveModal } from '../../../lib/state/redux/slice-ui';
import { useAppDispatch, useAppSelector } from '../../../lib/state/redux/store';
import { usePlaygroundClient } from '../../../lib/use-playground-client';
import css from './style.module.css';

export function SiteSharePanel() {
	const dispatch = useAppDispatch();
	const offline = useAppSelector((state) => state.ui.offline);
	const playground = usePlaygroundClient();
	const [isDownloading, setIsDownloading] = useState(false);
	const disabled = !playground;

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
			<div className={css.actions}>
				<Button
					variant="primary"
					disabled={offline || disabled}
					onClick={() =>
						dispatch(setActiveModal(modalSlugs.GITHUB_EXPORT))
					}
				>
					Export to GitHub
				</Button>
				<Button
					variant="secondary"
					data-cy="download-as-zip"
					disabled={disabled || isDownloading}
					onClick={downloadZip}
				>
					{isDownloading ? 'Preparing .zip…' : 'Download as .zip'}
				</Button>
			</div>
			<p className={css.description}>
				Export the active Playground as a GitHub pull request or
				download a self-contained wp-content archive.
			</p>
		</section>
	);
}
