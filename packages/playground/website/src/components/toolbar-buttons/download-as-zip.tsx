import { MenuItem } from '@wordpress/components';
import { download } from '@wordpress/icons';

import { PlaygroundClient, zipWpContent } from '@wp-playground/client';
import saveAs from 'file-saver';
import { usePlaygroundContext } from '../../playground-context';

type Props = { onClose: () => void };
export function DownloadAsZipMenuItem({ onClose }: Props) {
	const { playground } = usePlaygroundContext();
	return (
		<MenuItem
			icon={download}
			iconPosition="left"
			data-cy="download-as-zip"
			aria-label="Download the current playground as a .zip file"
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
