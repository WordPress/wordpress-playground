import { MenuItem } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

import type { PlaygroundClient } from '@wp-playground/client';
import { zipWpContent } from '@wp-playground/client';
import saveAs from 'file-saver';
import { usePlaygroundClient } from '../../lib/use-playground-client';

type Props = { onClose: () => void; disabled: boolean };
export function DownloadAsZipMenuItem({ onClose, disabled }: Props) {
	const playground = usePlaygroundClient();
	return (
		<MenuItem
			data-cy="download-as-zip"
			aria-label={__(
				'Download the current Playground as a .zip file',
				'playground-website'
			)}
			disabled={disabled}
			onClick={() => {
				if (!playground) return;
				startDownload(playground);
				onClose();
			}}
		>
			{__('Download as .zip', 'playground-website')}
		</MenuItem>
	);
}

async function startDownload(playground: PlaygroundClient) {
	const bytes = await zipWpContent(playground, {
		selfContained: true,
	});
	saveAs(new File([bytes], 'wordpress-playground.zip'));
}
