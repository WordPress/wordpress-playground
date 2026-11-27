import type { PlaygroundClient } from '@wp-playground/client';
import { zipWpContent } from '@wp-playground/client';
import saveAs from 'file-saver';

/** Downloads a complete archive of the supplied Playground. */
export async function downloadPlaygroundAsZip(playground: PlaygroundClient) {
	const bytes = await zipWpContent(playground);
	saveAs(new File([bytes], 'wordpress-playground.zip'));
}
