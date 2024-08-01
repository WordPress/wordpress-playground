// import { usePlaygroundContext } from '../../playground-context';
import Button from '../button';

export function StartOverButton() {
	// const { playground } = usePlaygroundContext();
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
				window.alert('Not implemented yet.');
				// await playground?.resetVirtualOpfs();
				window.location.reload();
			}}
		>
			Start over
		</Button>
	);
}
