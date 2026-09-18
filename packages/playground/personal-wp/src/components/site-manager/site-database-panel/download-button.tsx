import { Button, Icon, Flex, FlexItem } from '@wordpress/components';
import { download } from '@wordpress/icons';
import type { PlaygroundClient } from '@wp-playground/client';

async function downloadDatabase(
	playground: PlaygroundClient,
	databasePath: string
): Promise<void> {
	const fileExists = await playground.fileExists(databasePath);
	if (!fileExists) {
		throw new Error('Database file does not exist');
	}

	const buffer = await playground.readFileAsBuffer(databasePath);
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
	databasePath,
}: {
	playground: PlaygroundClient | undefined;
	databasePath: string | null;
}) {
	return (
		<Button
			variant="secondary"
			disabled={!playground || !databasePath}
			onClick={
				playground && databasePath
					? () => downloadDatabase(playground, databasePath)
					: undefined
			}
		>
			<Flex justify="space-between" gap={2} expanded={true}>
				<FlexItem>Download database.sqlite</FlexItem>
				<FlexItem>
					<Icon icon={download} size={16} />
				</FlexItem>
			</Flex>
		</Button>
	);
}
