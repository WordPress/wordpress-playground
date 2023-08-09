import Button from '../button';
import { usePlaygroundContext } from '../playground-viewport/context';

export function StartOverButton() {
	const { playground } = usePlaygroundContext();
	return (
		<Button
			onClick={async () => {
				if (
					!window.confirm(
						'This will wipe out all data and start a new site. Do you want to proceed?'
					)
				) {
					return;
				}
				await playground?.resetVirtualOpfs();
				window.location.reload();
			}}
		>
			Start over
		</Button>
	);
}
