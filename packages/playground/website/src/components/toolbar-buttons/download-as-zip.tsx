import { MenuItem } from '@wordpress/components';

import { PlaygroundClient, zipWpContent } from '@wp-playground/client';
import saveAs from 'file-saver';
import { usePlaygroundClient } from '../../lib/use-playground-client';

type Props = { onClose: () => void; disabled: boolean };
export function DownloadAsZipMenuItem({ onClose, disabled }: Props) {
	const playground = usePlaygroundClient();
	return (
		<MenuItem
			data-cy="download-as-zip"
			aria-label="Download the current playground as a .zip file"
			disabled={disabled}
			onClick={() => {
				if (!playground) return;
				startDownload(playground);
				onClose();
			}}
		>
			Download as .zip
		</MenuItem>
	);
}

async function startDownload(playground: PlaygroundClient) {
	const bytes = await zipWpContent(playground, {
		selfContained: true,
	});
	saveAs(new File([bytes], 'wordpress-playground.zip'));
}
