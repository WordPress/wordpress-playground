import { Button } from '@wordpress/components';
import { download } from '@wordpress/icons';
import type { PlaygroundClient } from '@wp-playground/client';

const DATABASE_PATH = '/wordpress/wp-content/database/.ht.sqlite';

async function downloadDatabase(playground: PlaygroundClient): Promise<void> {
	const fileExists = await playground.fileExists(DATABASE_PATH);
	if (!fileExists) {
		throw new Error('Database file does not exist');
	}

	const buffer = await playground.readFileAsBuffer(DATABASE_PATH);
	const blob = new Blob([new Uint8Array(buffer)], {
		type: 'application/x-sqlite3',
	});

	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = 'database.sqlite';
	link.click();
	URL.revokeObjectURL(url);
}

export function DownloadButton({
	playground,
}: {
	playground: PlaygroundClient | undefined;
}) {
	return (
		<Button
			variant="secondary"
			disabled={!playground}
			onClick={
				playground ? () => downloadDatabase(playground) : undefined
			}
			icon={download}
			iconPosition="right"
			iconSize={16}
		>
			Download database.sqlite
		</Button>
	);
}
