import { MenuItem } from '@wordpress/components';
import { download } from '@wordpress/icons';

import { usePlaygroundContext } from '../playground-viewport/context';
import { PlaygroundClient, zipWpContent } from '@wp-playground/client';
import saveAs from 'file-saver';

type Props = { onClose: () => void };
export function DownloadAsZipMenuItem({ onClose }: Props) {
	const { playground } = usePlaygroundContext();
	return (
		<MenuItem
			icon={download}
			iconPosition="left"
			id="import-open-modal--btn"
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
	const file = await zipWpContent(playground);
	console.log({ file });
	saveAs(file);
}
