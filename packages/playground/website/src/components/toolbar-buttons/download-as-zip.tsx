import { MenuItem } from '@wordpress/components';

import { logger } from '@php-wasm/logger';
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
			aria-label="Download the current playground as a .zip file"
			disabled={disabled}
			onClick={() => {
				if (!playground) return;
				void downloadPlaygroundAsZip(playground).catch((error) =>
					logger.error('Failed to download Playground zip', error)
				);
				onClose();
			}}
		>
			Download as .zip
		</MenuItem>
	);
}

/** Downloads a complete archive of the supplied Playground. */
export async function downloadPlaygroundAsZip(playground: PlaygroundClient) {
	const bytes = await zipWpContent(playground);
	saveAs(new File([bytes], 'wordpress-playground.zip'));
}
