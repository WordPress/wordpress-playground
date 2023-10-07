import { saveAs } from 'file-saver';
import css from './style.module.css';
import type { PlaygroundClient } from '@wp-playground/client';
import { zipEntireSite } from '@wp-playground/client';
import { usePlaygroundContext } from '../playground-viewport/context';

export default function ExportButton() {
	const { playground } = usePlaygroundContext();
	if (!playground) {
		return null;
	}
	return (
		<button
			id="export-playground--btn"
			className={css.btn}
			aria-label="Download Playground export as ZIP file"
			title="Download Playground export as ZIP file"
			onClick={() => playground && startDownload(playground)}
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				width="28"
				height="28"
				aria-hidden="true"
				focusable="false"
			>
				<path
					fill="#ffffff"
					d="M18 11.3l-1-1.1-4 4V3h-1.5v11.3L7 10.2l-1 1.1 6.2 5.8 5.8-5.8zm.5 3.7v3.5h-13V15H4v5h16v-5h-1.5z"
				></path>
			</svg>
		</button>
	);
}

async function startDownload(playground: PlaygroundClient) {
	const file = await zipEntireSite(playground);
	console.log({ file });
	saveAs(file);
}
